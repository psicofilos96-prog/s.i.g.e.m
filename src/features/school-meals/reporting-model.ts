// NAE.8 Lote 4 — Central e relatórios da Alimentação: modelo puro sobre meal_reporting_summary/meal_reporting_rows (0192/0193).
// O cartão e o drill-down usam o MESMO conjunto factual do banco: o filtro de cada cartão é o que explica o número.
// Nenhuma métrica normativa: adesão, desperdício, estoque mínimo, custo, prazo e baixa teórica chegam BLOCKED do banco.
import type { CellValue, ColumnDef, ReportDefinition } from "@/features/reports/report-engine";

export type Dataset = "pedidos" | "entregas" | "nao-conformidades" | "evidencias" | "documentos-fiscais" | "movimentos" | "inventarios" | "execucoes" | "publicacoes" | "fechamentos";
export type RepState = "AVAILABLE" | "ZERO" | "UNKNOWN" | "BLOCKED" | "UNAVAILABLE";
export interface SummaryRow { dataset: string; key: string; value: number | string | null; state: string; reason: string | null }
export type Filters = Partial<Record<"situacao" | "classe" | "item" | "lote" | "validade" | "ref" | "submetido", string | boolean>>;

export const PAGE_SIZE = 25;
export const EXPORT_LIMIT = 500; // limite do reader por página; exportação percorre páginas até o total

export const DATASETS: Record<Dataset, string> = {
  pedidos: "Pedidos", entregas: "Entregas e recebimentos", "nao-conformidades": "Não conformidades", evidencias: "Evidências",
  "documentos-fiscais": "Documentos fiscais", movimentos: "Movimentos de estoque", inventarios: "Inventário físico",
  execucoes: "Execução e refeições", publicacoes: "Publicações de cardápio", fechamentos: "Fechamento por competência",
};

export const KEY_LABEL: Record<string, string> = {
  total: "Total", submetidos: "Solicitados (chegaram a ser submetidos)", "autorizado-total": "Autorizados integralmente", "autorizado-parcial": "Autorizados parcialmente",
  rejeitado: "Rejeitados", "em-analise": "Em análise", submetido: "Aguardando análise", devolvido: "Devolvidos", rascunho: "Em rascunho",
  integral: "Recebidas integralmente", parcial: "Recebidas parcialmente", rejeitada: "Rejeitadas no recebimento", pendente: "Pendentes de recebimento",
  aberta: "Abertas", tratada: "Resolvidas/encerradas", ativa: "Ativas", revogada: "Revogadas (só histórico)",
  "entrada-aceite": "Entradas por aceite", "consumo-observado": "Consumo observado", perda: "Perdas", devolucao: "Devoluções",
  "ajuste-inventario": "Ajustes de inventário", "classe-desconhecida": "Movimentos sem classe (antigos)",
  "lote-informado": "Entradas com lote", "lote-ausente": "Entradas sem lote informado", "validade-informada": "Entradas com validade", "validade-ausente": "Entradas sem validade informada",
  "aprovada-divergente": "Aprovados com divergência físico × calculado", "aprovada-sem-divergencia": "Aprovados sem divergência", conferida: "Conferidos, sem aprovação",
  seguido: "Cardápio seguido", desvio: "Com desvio do planejado", "seguimento-nao-informado": "Seguimento não informado",
  "refeicoes-nao-informadas": "Sem refeições informadas", "refeicoes-servidas": "Refeições servidas", "alunos-presentes": "Alunos presentes (medida separada)",
  publicacao: "Publicações", retirada: "Retiradas", emissao: "Fechamentos emitidos", reemissao: "Reemissões (nova versão)",
  adesao: "Adesão", desperdicio: "Desperdício", "estoque-minimo": "Estoque mínimo", "prazo-nao-conformidade": "Prazo de não conformidade", custo: "Custo", "baixa-teorica": "Baixa teórica",
};

/** Estado honesto do cartão: ausência nunca vira zero; zero só quando lido. */
export function classifyRep(r: SummaryRow | undefined): { state: RepState; value: number | null; reason: string | null } {
  if (!r) return { state: "UNKNOWN", value: null, reason: "Não lido." };
  if (r.state === "BLOCKED" || r.state === "UNAVAILABLE") return { state: r.state, value: null, reason: r.reason };
  if (r.state === "UNKNOWN" || r.value === null || r.value === undefined) return { state: "UNKNOWN", value: null, reason: r.reason ?? "Sem valor informado." };
  const n = Number(r.value);
  return { state: n === 0 ? "ZERO" : "AVAILABLE", value: n, reason: null };
}

/** Filtro do drill-down que reproduz exatamente o predicado do agregado; null = soma sem conjunto próprio (abre o dataset). */
export function drillFilter(dataset: string, key: string): Filters | null {
  if (key === "total") return {};
  if (key === "submetidos") return { submetido: true };
  if (key === "lote-informado" || key === "lote-ausente") return { classe: "entrada-aceite", lote: key.slice(5) };
  if (key === "validade-informada" || key === "validade-ausente") return { classe: "entrada-aceite", validade: key.slice(9) };
  if (key === "refeicoes-servidas" || key === "alunos-presentes") return null;
  if ((dataset === "movimentos" && key !== "classe-desconhecida") || key === "refeicoes-nao-informadas") return { classe: key };
  return { situacao: key };
}

export function groupSummary(rows: SummaryRow[] | null) {
  const by = new Map<string, SummaryRow[]>();
  for (const r of rows ?? []) by.set(r.dataset, [...(by.get(r.dataset) ?? []), r]);
  return by;
}

export function reportingMessage(raw: string): string {
  if (raw.includes("capability:acompanhar-alimentacao-rede")) return "Sua atuação não tem acompanhamento da rede nesta data. Escolha uma escola do seu escopo.";
  if (raw.includes("capability:")) return "Sua atuação não autoriza ler esta escola nesta data.";
  if (raw.includes("period-invalid")) return "Período inválido (início ≤ fim, até 370 dias).";
  if (raw.includes("session-required")) return "Entre com sua conta para ler os dados.";
  if (raw.includes("page-invalid") || raw.includes("filter-unknown") || raw.includes("dataset-unknown")) return "Consulta recusada pelo banco.";
  return "Não foi possível ler.";
}

// ---------- relatórios: um por dataset, todos sobre meal_reporting_rows ----------
const params = [{ id: "from", label: "De", type: "date" as const, required: true }, { id: "to", label: "Até", type: "date" as const, required: true }];
const C = (id: string, label: string, kind: ColumnDef["kind"] = "text"): ColumnDef => ({ id, label, kind });
const def = (dataset: Dataset, title: string, description: string, columns: ColumnDef[]): ReportDefinition => ({
  id: `nae-${dataset}`, version: 1, title, description, source: `meal_reporting_rows('${dataset}')`, params,
  columns: [C("school", "Escola"), ...columns], formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
});

export const REPORTING_REPORTS: Record<Dataset, ReportDefinition> = {
  pedidos: def("pedidos", "Pedidos: solicitado × autorizado", "Última versão de cada pedido, com linhas da última submissão e linhas autorizadas. Não é ordem de compra.",
    [C("competence", "Competência"), C("status", "Situação"), C("requested", "Solicitado (linhas)"), C("authorized", "Autorizado (linhas)"), C("version", "Versão", "number"), C("reason", "Motivo")]),
  entregas: def("entregas", "Entregas, recebimentos e pendências", "Programado × aceito/rejeitado por entrega; pendente = sem recebimento confirmado.",
    [C("expected", "Prevista", "date"), C("situation", "Situação"), C("scheduled", "Programado", "number"), C("accepted", "Aceito", "number"), C("rejected", "Rejeitado", "number"), C("lot", "Lote"), C("expires", "Validade", "date")]),
  "nao-conformidades": def("nao-conformidades", "Não conformidades", "Última versão de cada ocorrência; prazo depende de regra homologada.",
    [C("updated", "Atualizada em"), C("status", "Situação"), C("motive", "Motivo"), C("returned", "Devolvido", "number"), C("evidences", "Evidências", "number"), C("deadline", "Prazo")]),
  evidencias: def("evidencias", "Evidências (metadados)", "Somente metadados autorizados; sem arquivo, caminho de armazenamento ou link. Revogadas ficam no histórico.",
    [C("recorded", "Registrada em"), C("target", "Vinculada a"), C("event", "Evento"), C("label", "Rótulo"), C("type", "Tipo"), C("bytes", "Bytes", "number"), C("sha256", "SHA-256")]),
  "documentos-fiscais": def("documentos-fiscais", "Documentos fiscais (metadados)", "Número, emissão, situação e hash. Não é aceite nem pagamento.",
    [C("number", "Número"), C("issued", "Emitido em", "date"), C("status", "Situação"), C("sha256", "SHA-256")]),
  movimentos: def("movimentos", "Movimentos de estoque: entradas, consumo observado, perdas, devoluções e ajustes", "Ledger canônico por data; lote/validade só quando informados. Quantidades de unidades diferentes não são somadas.",
    [C("date", "Data", "date"), C("class", "Classe"), C("item", "Item"), C("unit", "Unidade"), C("quantity", "Quantidade", "number"), C("direction", "Sentido"), C("lot", "Lote"), C("expires", "Validade", "date"), C("reason", "Motivo")]),
  inventarios: def("inventarios", "Inventário físico × saldo calculado", "Última versão de cada contagem; divergência por linha conforme o writer.",
    [C("counted", "Contada em", "date"), C("status", "Situação"), C("lines", "Linhas (físico/diferença)"), C("version", "Versão", "number")]),
  execucoes: def("execucoes", "Execução: planejado × executado e refeições servidas", "Refeições servidas e alunos presentes são medidas separadas. Sem adesão.",
    [C("date", "Data", "date"), C("slot", "Refeição"), C("followed", "Planejado × executado"), C("deviation", "Desvio"), C("meals", "Refeições servidas", "number"), C("basis", "Base da contagem"), C("students", "Alunos presentes", "number")]),
  publicacoes: def("publicacoes", "Cardápios: publicações e retiradas", "Atos de publicação sobre versões de cardápio.",
    [C("at", "Em"), C("act", "Ato"), C("sequence", "Sequência", "number"), C("reason", "Motivo")]),
  fechamentos: def("fechamentos", "Fechamento de estoque por competência", "Emissões e reemissões versionadas com manifesto SHA-256.",
    [C("competence", "Competência"), C("version", "Versão", "number"), C("closed", "Fechado em", "date"), C("movements", "Movimentos", "number"), C("manifest", "Manifesto SHA-256"), C("reason", "Motivo")]),
};

const s = (v: unknown): CellValue => (v === null || v === undefined || v === "" ? null : typeof v === "number" ? v : String(v));
const n = (v: unknown): CellValue => (v === null || v === undefined ? null : Number(v));
const lines = (v: unknown): CellValue => (Array.isArray(v) ? v.map((l: Record<string, unknown>) => `${l["item_ref"] ?? l["item_value_id"] ?? "item"}: ${l["quantidade"] ?? l["fisica"] ?? "?"}${l["diferenca"] !== undefined ? ` (dif. ${l["diferenca"]})` : ""}`).join("; ") : null);
const followed = (v: unknown): CellValue => (v === true ? "seguido" : v === false ? "desvio" : null);

/** Linha do reader → linha do relatório. Ausência permanece null ("não disponível"), nunca zero. */
export function toReportRow(dataset: Dataset, school: string, r: Record<string, unknown>): Record<string, CellValue> {
  switch (dataset) {
    case "pedidos": return { school, competence: s(r["competencia"]), status: s(r["situacao"]), requested: lines(r["linhas_solicitadas"]), authorized: lines(r["linhas_autorizadas"]), version: n(r["versao"]), reason: s(r["motivo"]) };
    case "entregas": return { school, expected: s(r["prevista_para"]), situation: s(r["aceito"] === null || r["aceito"] === undefined ? "pendente" : Number(r["aceito"]) === 0 ? "rejeitada" : Number(r["aceito"]) >= Number(r["programado"]) ? "integral" : "parcial"),
      scheduled: n(r["programado"]), accepted: n(r["aceito"]), rejected: n(r["rejeitado"]), lot: s(r["lote"]), expires: s(r["validade"]) };
    case "nao-conformidades": return { school, updated: s(r["atualizada_em"]), status: s(r["situacao"]), motive: s(r["motivo_nc"]), returned: n(r["devolvido"]), evidences: n(r["evidencias"]), deadline: s(r["prazo"]) };
    case "evidencias": return { school, recorded: s(r["registrada_em"]), target: s(r["alvo"]), event: s(r["evento"]), label: s(r["rotulo"]), type: s(r["tipo"]), bytes: n(r["bytes"]), sha256: s(r["sha256"]) };
    case "documentos-fiscais": return { school, number: s(r["numero"]), issued: s(r["emitido_em"]), status: s(r["situacao"]), sha256: s(r["sha256"]) };
    case "movimentos": return { school, date: s(r["data"]), class: s(r["classe"] ?? r["tipo"]), item: s(r["item"]), unit: s(r["unidade"]), quantity: n(r["quantidade"]),
      direction: r["sentido"] === 1 ? "entrada" : r["sentido"] === -1 ? "saída" : null, lot: s(r["lote"]), expires: s(r["validade"]), reason: s(r["motivo"]) };
    case "inventarios": return { school, counted: s(r["contada_em"]), status: s(r["situacao"]), lines: lines(r["linhas"]), version: n(r["versao"]) };
    case "execucoes": return { school, date: s(r["data"]), slot: s(r["refeicao"]), followed: followed(r["seguido"]), deviation: s(r["desvio"]), meals: n(r["refeicoes_servidas"]), basis: s(r["base_contagem"]), students: n(r["alunos_presentes"]) };
    case "publicacoes": return { school, at: s(r["em"]), act: s(r["ato"]), sequence: n(r["sequencia"]), reason: s(r["motivo"]) };
    case "fechamentos": return { school, competence: s(r["competencia"]), version: n(r["versao"]), closed: s(r["fechado_em"]), movements: n(r["movimentos"]), manifest: s(r["manifesto_sha256"]), reason: s(r["motivo"]) };
  }
}

/** Nada que identifique pessoa, arquivo ou link pode sair destes relatórios. */
export const FORBIDDEN_ROW_KEYS = ["author_person_id", "author_user_id", "storage_path", "signed_url", "url", "student_id", "person_id"] as const;

// ---------- handoff para a Inteligência Educacional (contrato BM.1 existente) ----------
import type { Dataset as SemanticDataset } from "@/features/educational-intelligence/semantic-layer";
/** Só agregados factuais observados; refeições e alunos têm escalas distintas e nunca se agregam juntos.
 *  Adesão, desperdício, eficiência, qualidade nutricional e causalidade NÃO existem aqui (HOMOLOGATED_RULE_PENDING). */
export const MEAL_EXECUTION_SEMANTIC: SemanticDataset = {
  id: "nae-execucoes", version: 1, label: "Alimentação: execução diária (observado)", source: "meal_reporting_rows('execucoes')",
  grain: "escola × dia × refeição (última versão)",
  dimensions: [{ id: "school", label: "Escola" }, { id: "date", label: "Data" }, { id: "slot", label: "Refeição" }, { id: "followed", label: "Planejado × executado" }],
  measures: [
    { id: "meals", label: "Refeições servidas", unit: "refeições", scaleKind: "numerico", nature: "observado", aggregations: ["soma", "contagem"], scaleKey: "nae-refeicoes-servidas" },
    { id: "students", label: "Alunos presentes informados", unit: "alunos", scaleKind: "numerico", nature: "observado", aggregations: ["soma", "contagem"], scaleKey: "nae-alunos-presentes" },
  ],
  joins: [], readCapability: "acompanhar-alimentacao-rede",
};
export const ANALYTICS_BLOCKED = ["adesao", "desperdicio", "eficiencia", "qualidade-nutricional", "risco", "score", "causalidade"] as const;
