/**
 * AR — Central de relatórios: metadados de catálogo SOBRE o registro único (`REPORTS`).
 * Não executa nem exporta: a execução acontece na tela dona, com o reader dela e o motor comum,
 * para que a ACL da exportação seja exatamente a da leitura. Não existe "exportar tudo".
 */
import { REPORTS } from "./report-registry";
import type { ReportDefinition, ReportFormat } from "./report-engine";

export type ReportNature = "dinamico" | "snapshot" | "oficial-emitido";
export type ReportScope = "rede" | "escola" | "pessoa" | "conta";

export type CatalogMeta = Readonly<{ domain: string; scope: ReportScope; nature: ReportNature; route: string; acl: string }>;

const META: Record<string, CatalogMeta> = {
  "mapa-estatistico-rede": { domain: "Mapa Estatístico", scope: "rede", nature: "snapshot", route: "/mapa-estatistico-rede", acl: "Leitura do Mapa da rede pela sessão; versão oficializada exporta o snapshot imutável." },
  "mapa-estatistico-escola": { domain: "Mapa Estatístico", scope: "escola", nature: "snapshot", route: "/mapa-estatistico", acl: "Leitura do Mapa da própria unidade pela sessão; versão oficializada exporta o snapshot imutável." },
  "inclusao-relatorio-pedagogico-minimizado": { domain: "Educação inclusiva", scope: "escola", nature: "dinamico", route: "/inclusao", acl: "Capability de inclusão com escopo; dados minimizados." },
  "total-aulas-ofertadas": { domain: "Quadro docente", scope: "escola", nature: "dinamico", route: "/quadro-docente", acl: "Readers do quadro docente pela sessão." },
  "total-aulas-rede": { domain: "Quadro docente", scope: "rede", nature: "dinamico", route: "/quadro-docente", acl: "Readers do quadro docente pela sessão." },
  "necessidade-de-professor": { domain: "Quadro docente", scope: "escola", nature: "dinamico", route: "/quadro-docente", acl: "Readers do quadro docente pela sessão; carga contratual bloqueada pela fonte do DP." },
  "ficha-longitudinal-aluno": { domain: "Acompanhamento do aluno", scope: "pessoa", nature: "dinamico", route: "/unidades", acl: "Só o aluno que a sessão já pode ver; aberta a partir da unidade/aluno, nunca por lista geral." },
  "indicadores-da-rede": { domain: "Indicadores (CIECE)", scope: "rede", nature: "dinamico", route: "/paineis", acl: "network_indicators_at (SECURITY INVOKER) com RLS e capability." },
  "situacao-operacional-escola": { domain: "Gestão escolar", scope: "escola", nature: "dinamico", route: "/gestao-escolar", acl: "Readers canônicos da Estação da Direção pela sessão." },
  "acompanhamento-supervisao-escolar": { domain: "Supervisão escolar", scope: "escola", nature: "dinamico", route: "/supervisao-escolar", acl: "school_supervision_records_at com capability de rede/escola." },
  "pedidos-alimentacao": { domain: "Alimentação Escolar", scope: "escola", nature: "dinamico", route: "/alimentacao-escolar", acl: "meal_orders_at: escola vê só os próprios pedidos; rede exige capability de análise/autorização/consolidação." },
  "consolidado-demanda-alimentacao": { domain: "Alimentação Escolar", scope: "rede", nature: "dinamico", route: "/alimentacao-escolar", acl: "meal_demand_consolidation_at com capability de consolidação/autorização/acompanhamento da rede." },
  "entregas-alimentacao": { domain: "Alimentação Escolar", scope: "escola", nature: "dinamico", route: "/alimentacao-escolar", acl: "meal_deliveries_at: escola só a própria; rede exige capability de programação/acompanhamento." },
  "fornecedor-fatos-alimentacao": { domain: "Alimentação Escolar", scope: "rede", nature: "dinamico", route: "/alimentacao-escolar", acl: "meal_deliveries_at com capability de rede; só fatos, sem nota ou sanção." },
  "ficha-estoque-alimentacao": { domain: "Alimentação Escolar", scope: "escola", nature: "dinamico", route: "/alimentacao-escolar", acl: "meal_stock_ledger_at: escola só a própria; rede por capability." },
  "execucao-alimentacao": { domain: "Alimentação Escolar", scope: "escola", nature: "dinamico", route: "/alimentacao-escolar", acl: "meal_executions_at: escola só a própria; rede por capability." },
  "trilha-alimentacao": { domain: "Alimentação Escolar", scope: "rede", nature: "dinamico", route: "/alimentacao-escolar", acl: "meal_audit_trail_at: exige acompanhar-alimentacao-rede." },
  "qualidade-alimentacao": { domain: "Alimentação Escolar", scope: "rede", nature: "dinamico", route: "/alimentacao-escolar", acl: "meal_network_data_quality: exige acompanhar-alimentacao-rede." },
  "saldo-estoque-alimentacao": { domain: "Alimentação Escolar", scope: "escola", nature: "dinamico", route: "/alimentacao-escolar", acl: "meal_stock_balance_at: escola só a própria; rede por capability." },
  "trilha-de-auditoria": { domain: "Auditoria", scope: "conta", nature: "dinamico", route: "/auditoria", acl: "Ledgers visíveis à conta pela RLS; exportação exige exportar-auditoria." },
};

/** Documentos oficiais não são relatórios da Central: emitidos só pela Secretaria, com template versionado. */
export const OFFICIAL_DOCUMENTS = Readonly_({
  id: "documentos-escolares-emitidos",
  title: "Documentos escolares emitidos (declarações, históricos)",
  route: "/secretaria",
  note: "Emitidos só pela Secretaria a partir de fatos canônicos e de template versionado homologado, com impressão digital e trilha de reemissão. A Central não gera documento oficial. Modelos oficiais aprovados: pendentes (OFFICIAL_TEMPLATES_PENDING).",
});
function Readonly_<T>(x: T): Readonly<T> { return Object.freeze(x); }

export const NATURE_LABEL: Record<ReportNature, string> = {
  dinamico: "Projeção dinâmica (não é documento oficial)",
  snapshot: "Versão imutável quando oficializada; senão projeção dinâmica",
  "oficial-emitido": "Documento oficial emitido",
};

export type CatalogEntry = Readonly<{
  id: string; title: string; description: string; version: number; source: string;
  formats: readonly ReportFormat[]; available: boolean; dependency: string | null;
  temporal: { asOf: boolean; knownAt: boolean }; params: readonly string[];
} & CatalogMeta>;

export function catalogEntry(def: ReportDefinition): CatalogEntry {
  const m = META[def.id];
  if (!m) throw new Error(`Relatório sem metadados de catálogo: ${def.id}`);
  const ids = def.params.map((p) => p.id);
  return {
    id: def.id, title: def.title, description: def.description, version: def.version, source: def.source,
    formats: def.formats, available: !def.dependency, dependency: def.dependency ?? null,
    temporal: { asOf: ids.some((i) => i === "asOf" || i === "on"), knownAt: ids.includes("knownAt") },
    params: def.params.map((p) => p.label), ...m,
    // Natureza oficial nunca é inferida: só "snapshot" quando a definição é reproduzível.
    nature: m.nature === "snapshot" && !def.reproducible ? "dinamico" : m.nature,
  };
}

export const CATALOG: readonly CatalogEntry[] = REPORTS.map(catalogEntry);

export type CatalogFilter = { query: string; domain: string; scope: string; nature: string; availability: "" | "disponivel" | "indisponivel" };
export const emptyCatalogFilter: CatalogFilter = { query: "", domain: "", scope: "", nature: "", availability: "" };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function filterCatalog(entries: readonly CatalogEntry[], f: CatalogFilter): CatalogEntry[] {
  const q = norm(f.query.trim());
  return entries.filter((e) =>
    (!q || norm(`${e.title} ${e.description} ${e.domain}`).includes(q)) &&
    (!f.domain || e.domain === f.domain) && (!f.scope || e.scope === f.scope) && (!f.nature || e.nature === f.nature) &&
    (!f.availability || (f.availability === "disponivel") === e.available));
}

export const catalogOptions = (entries: readonly CatalogEntry[]) => ({
  domain: [...new Set(entries.map((e) => e.domain))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  scope: [...new Set(entries.map((e) => e.scope))].sort(),
  nature: [...new Set(entries.map((e) => e.nature))].sort(),
});
