// NAE.6 — Central do Núcleo: modelo puro dos indicadores factuais, estados e navegação do domínio.
// Nenhum indicador normativo (adesão, eficiência, desperdício %, estoque ideal, score, conformidade PNAE) existe aqui.
import type { ReportDefinition } from "@/features/reports/report-engine";

export type SummaryState = "AVAILABLE" | "ZERO" | "UNKNOWN" | "UNAVAILABLE" | "BLOCKED";
export interface SummaryRow { key: string; value: number | string | null; state: string; reason: string | null }
export interface Indicator { key: string; label: string; help: string; state: SummaryState; value: number | null; reason: string | null; anchor: string }

export const INDICATORS: Record<string, { label: string; help: string; anchor: string }> = {
  "pedidos-submetidos": { label: "Pedidos aguardando análise", help: "Última versão de cada pedido da competência em 'submetido'.", anchor: "pedidos" },
  "pedidos-em-analise": { label: "Pedidos em análise", help: "Última versão em 'em análise'.", anchor: "pedidos" },
  "pedidos-devolvidos": { label: "Pedidos devolvidos à escola", help: "Última versão em 'devolvido'.", anchor: "pedidos" },
  "pedidos-rascunho": { label: "Pedidos ainda em rascunho", help: "Escola iniciou e não submeteu.", anchor: "pedidos" },
  "pedidos-autorizados": { label: "Pedidos autorizados", help: "Autorização total ou parcial (última versão).", anchor: "autorizacoes" },
  consolidacoes: { label: "Consolidações da competência", help: "Consolidações congeladas registradas.", anchor: "consolidacao" },
  "entregas-hoje": { label: "Entregas previstas para hoje", help: "Programações vigentes com data prevista hoje e sem recebimento confirmado.", anchor: "entregas" },
  "entregas-atrasadas": { label: "Entregas atrasadas", help: "Data prevista anterior a hoje e sem recebimento confirmado.", anchor: "entregas" },
  "nao-conformidades-abertas": { label: "Não conformidades em aberto", help: "Fora de 'resolvida' ou 'encerrada'.", anchor: "nao-conformidades" },
  "prazo-nao-conformidade": { label: "Prazo das não conformidades", help: "Depende de regra homologada de prazo.", anchor: "nao-conformidades" },
  "inventarios-pendentes": { label: "Inventários pendentes", help: "Contagens em rascunho ou conferidas, sem aprovação.", anchor: "estoque" },
  "documentos-com-fim-de-vigencia": { label: "Registros técnicos com fim de vigência", help: "Homologados com data final declarada a partir de hoje.", anchor: "planejamento" },
  "escolas-sem-execucao": { label: "Escolas sem execução registrada", help: "Só pode ser afirmado com o calendário aplicável resolvido.", anchor: "execucao" },
  adesao: { label: "Adesão", help: "Sem definição homologada, não é calculada.", anchor: "execucao" },
};

/** Estado honesto: só leitura com número vira AVAILABLE/ZERO; ausência nunca é zero. */
export function classify(row: SummaryRow | undefined): { state: SummaryState; value: number | null; reason: string | null } {
  if (!row) return { state: "UNKNOWN", value: null, reason: "Não lido." };
  if (row.state === "BLOCKED" || row.state === "UNAVAILABLE") return { state: row.state, value: null, reason: row.reason };
  if (row.value === null || row.value === undefined) return { state: "UNKNOWN", value: null, reason: row.reason ?? "Sem valor." };
  const n = Number(row.value);
  return { state: n === 0 ? "ZERO" : "AVAILABLE", value: n, reason: null };
}

export function indicators(rows: SummaryRow[] | null): Indicator[] {
  return Object.entries(INDICATORS).map(([key, d]) => {
    const c = rows ? classify(rows.find((r) => r.key === key)) : { state: "UNKNOWN" as const, value: null, reason: "Fonte não legível para esta conta." };
    return { key, ...d, ...c };
  });
}

/** Fila de trabalho: só itens com contagem positiva, na ordem declarada (sem prioridade inventada). */
export const workQueue = (ind: Indicator[]) => ind.filter((i) => i.state === "AVAILABLE" && (i.value ?? 0) > 0);

export const FORBIDDEN_METRICS = ["adesao", "eficiencia", "qualidade-nutricional", "desperdicio-percentual", "estoque-ideal", "score-fornecedor", "conformidade-pnae"] as const;

export const QUALITY_LABELS: Record<string, string> = {
  "movimento-sinal-desconhecido": "Ajuste antigo sem direção (saldo desconhecido)",
  "recebimento-sem-programacao": "Recebimento sem programação de origem",
  "cardapio-sem-publicacao": "Cardápio vigente sem publicação",
  "documento-vencido": "Documento técnico com vigência encerrada",
  "consumo-sem-vinculo": "Consumo de execução sem vínculo",
  "estoque-negativo": "Saldo negativo",
  "conversao-ausente": "Conversão de unidade ausente",
};

export const NAV = [
  ["visao-geral", "Visão geral"], ["planejamento", "Planejamento nutricional"], ["pedidos", "Pedidos"], ["autorizacoes", "Autorizações"],
  ["consolidacao", "Compras/Consolidação"], ["entregas", "Entregas"], ["estoque", "Estoque"], ["execucao", "Execução"],
  ["nao-conformidades", "Não conformidades"], ["documentos", "Documentos"], ["relatorios", "Relatórios"], ["qualidade", "Qualidade dos dados"], ["trilha", "Trilha"],
] as const;

export const SOURCE_LABEL: Record<string, string> = {
  pedido: "Pedido", programacao: "Programação de entrega", recebimento: "Recebimento", "nao-conformidade": "Não conformidade", estoque: "Estoque", execucao: "Execução",
};

const period = [{ id: "from", label: "De", type: "date" as const, required: true }, { id: "to", label: "Até", type: "date" as const, required: true }];
export const EXECUCAO_ALIMENTACAO: ReportDefinition = {
  id: "execucao-alimentacao", version: 1, title: "Execução diária: planejado × executado e refeições servidas",
  description: "Por dia e refeição: seguido/desvio, refeições servidas com base da contagem e alunos presentes como medida separada. Sem adesão.",
  source: "meal_executions_at", params: period,
  columns: [
    { id: "date", label: "Data", kind: "date" }, { id: "slot", label: "Refeição", kind: "text" }, { id: "situation", label: "Planejado × executado", kind: "text" },
    { id: "deviation", label: "Desvio", kind: "text" }, { id: "meals", label: "Refeições servidas", kind: "number" }, { id: "basis", label: "Base da contagem", kind: "text" },
    { id: "students", label: "Alunos presentes", kind: "number" }, { id: "studentsSource", label: "Fonte dos alunos", kind: "text" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};
export const TRILHA_ALIMENTACAO: ReportDefinition = {
  id: "trilha-alimentacao", version: 1, title: "Trilha da alimentação escolar",
  description: "Quem fez o quê, quando, em qual escola, versão e motivo: pedido → programação → recebimento → estoque → execução.",
  source: "meal_audit_trail_at", params: period,
  columns: [
    { id: "recordedAt", label: "Registrado em", kind: "text" }, { id: "source", label: "Origem", kind: "text" }, { id: "act", label: "Ato", kind: "text" },
    { id: "version", label: "Versão", kind: "number" }, { id: "school", label: "Escola", kind: "text" }, { id: "reason", label: "Motivo", kind: "text" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 2000,
};
export const QUALIDADE_ALIMENTACAO: ReportDefinition = {
  id: "qualidade-alimentacao", version: 1, title: "Qualidade dos dados da alimentação",
  description: "Contagens de inconsistências. Não corrige nada; bloqueios aparecem com motivo.",
  source: "meal_network_data_quality", params: [{ id: "on", label: "Em", type: "date" as const, required: true }],
  columns: [{ id: "check", label: "Verificação", kind: "text" }, { id: "value", label: "Ocorrências", kind: "number" }, { id: "state", label: "Estado", kind: "text" }, { id: "reason", label: "Motivo", kind: "text" }],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 100,
};

export function nucleoMessage(raw: string): string {
  if (raw.includes("capability:")) return "Sua atuação não tem acompanhamento da rede nesta data.";
  if (raw.includes("competence-invalid")) return "Competência inválida (use AAAA-MM).";
  if (raw.includes("period-invalid")) return "Período inválido (até 370 dias).";
  return "Não foi possível ler.";
}
