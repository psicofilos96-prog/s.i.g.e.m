// L22 — 20 relatórios da Permanência sobre o motor comum (`report-engine`).
// Cada relatório declara fonte (módulo L02–L21 lido com a sessão), metodologia,
// UNIDADE DE CONTAGEM (alerta, caso ou estudante único — nunca somadas entre si),
// data de referência + knownAt e filtros. Exportação exige capacidade; relatório
// nominal exige capacidade própria. Fonte sem regra homologada declara dependência.
import { runReport, toCsv, toXlsx, toPrintableHtml, type Branding, type CellValue, type ColumnDef, type ParamDef, type ReportDefinition, type ReportRequest, type ReportResult } from "@/features/reports/report-engine";

export type CountUnit = "alerta" | "caso" | "estudante-unico" | "evento";

const PARAMS: readonly ParamDef[] = [
  { id: "asOf", label: "Data de referência", type: "date", required: true },
  { id: "knownAt", label: "Conhecido até", type: "datetime", required: true },
  { id: "scope", label: "Escopo", type: "enum", required: true, options: ["escola", "rede"] },
  { id: "from", label: "Período — início", type: "date", required: false },
  { id: "segment", label: "Etapa/modalidade", type: "text", required: false, maxLength: 80 },
];

export const PERMANENCE_COLUMNS: readonly ColumnDef[] = [
  { id: "escola", label: "Escola", kind: "text" },
  { id: "segmento", label: "Etapa/modalidade", kind: "text" },
  { id: "caso", label: "Nº do caso", kind: "text", sensitive: true },
  { id: "estudante", label: "Estudante", kind: "text", sensitive: true },
  { id: "item", label: "Item", kind: "text" },
  { id: "valor", label: "Valor", kind: "number" },
  { id: "unidade", label: "Unidade de contagem", kind: "text" },
  { id: "situacao", label: "Situação", kind: "text" },
  { id: "data", label: "Data", kind: "date" },
  { id: "motivo", label: "Motivo/lacuna", kind: "text" },
];

export type PermanenceReportDefinition = ReportDefinition & Readonly<{ methodology: string; unit: CountUnit; nominal: boolean }>;
const d = (id: string, title: string, source: string, unit: CountUnit, methodology: string, o: { nominal?: boolean; dependency?: string } = {}): PermanenceReportDefinition => ({
  id, version: 1, title, description: methodology, source, methodology, unit, nominal: o.nominal ?? false,
  params: PARAMS, columns: PERMANENCE_COLUMNS, formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 20000, dependency: o.dependency ?? null,
});
const NO_RULE = "sem regra preventiva homologada";

export const PERMANENCE_REPORTS: readonly PermanenceReportDefinition[] = [
  d("frequencia-monitorada", "Frequência monitorada", "attendance-monitoring.ts", "estudante-unico", "Faltas/aulas com lançamento na janela; aula sem lançamento fora do denominador; sem calendário ⇒ não disponível."),
  d("faltas-consecutivas", "Faltas consecutivas", "attendance-monitoring.ts", "estudante-unico", "Sequência atual só de lançamentos contíguos; lacuna de registro interrompe.", { nominal: true }),
  d("alertas-emitidos", "Alertas emitidos", "alert-center.ts", "alerta", "Alertas por regra aprovada e situação; um alerta por chave idempotente.", { dependency: NO_RULE }),
  d("alertas-conferidos", "Alertas conferidos e encerrados", "alert-center.ts", "alerta", "Conferências e encerramentos justificados no período."),
  d("casos-abertos", "Casos abertos", "permanence-cases.ts", "caso", "Casos BA-ano-seq em aberto na data; estado derivado dos eventos."),
  d("estudantes-acompanhados", "Estudantes acompanhados", "permanence-cases.ts", "estudante-unico", "Estudantes distintos com ao menos um caso aberto; nunca soma com casos."),
  d("prioridades", "Casos por prioridade", "permanence-cases.ts", "caso", "Prioridade vigente do catálogo configurado.", { dependency: "catálogo de prioridades não homologado" }),
  d("etapas-fluxo", "Casos por etapa do fluxo", "follow-up-flow.ts", "caso", "Etapa atual no motor de Tramitação.", { dependency: "fluxo não homologado" }),
  d("barreiras", "Barreiras confirmadas", "barrier-catalog.ts", "caso", "Barreiras confirmadas por tipo; sensibilidade restrita/reforçada só com capacidade; sem julgamento."),
  d("contatos-familia", "Tentativas de contato", "family-contacts.ts", "evento", "Tentativas por canal e resultado; sem resposta não é negligência."),
  d("visitas", "Visitas e atendimentos", "visits.ts", "evento", "Planejadas, realizadas, não realizadas e canceladas; sem endereço."),
  d("planos", "Planos individuais", "individual-plan.ts", "caso", "Planos vigentes, ações em aberto e reavaliações pendentes."),
  d("encaminhamentos", "Encaminhamentos intersetoriais", "referrals.ts", "evento", "Por destino aprovado e situação; só campos da allowlist."),
  d("comunicacoes-legais", "Comunicações legais", "legal-notifications.ts", "caso", "Obrigação aplicável e envio comprovado por SHA-256; sem prova = pendente.", { dependency: "norma e limiar não conferidos" }),
  d("retornos", "Retornos à escola", "school-return.ts", "estudante-unico", "Retornos registrados com enturmação oficial vigente; não gera presença."),
  d("pos-retorno", "Acompanhamento pós-retorno", "post-return.ts", "caso", "Frequência após retorno, barreiras remanescentes e bloqueios de encerramento."),
  d("encerramentos-reaberturas", "Encerramentos e reaberturas", "post-return.ts + follow-up-flow.ts", "evento", "Encerramentos fundamentados e reaberturas por reincidência no mesmo caso."),
  d("fora-da-escola", "Sinalizações fora da escola", "permanence-cases.ts", "caso", "Sinalizações restritas (HMAC/iniciais); sem nome nem matrícula fictícia.", { nominal: true }),
  d("territorial", "Distribuição territorial", "territorial-map.ts", "estudante-unico", "Por escola/região com supressão abaixo do limiar homologado.", { dependency: "limiar de supressão não homologado" }),
  d("conciliacao-bae", "Conciliação com a BAE nacional", "national-bae.ts", "caso", "Casos conciliados/divergentes/não conciliados por conferência manual.", { dependency: "adesão municipal não comprovada" }),
];

export const EXPORT_CAP = "exportar-relatorios-de-permanencia";
export const NOMINAL_CAP = "ler-relatorio-nominal-de-permanencia";

/** Conta pela unidade declarada; alertas, casos e estudantes nunca se misturam. */
export function countBy(unit: CountUnit, rows: readonly { alertId?: string | null; caseId?: string | null; studentRef?: string | null; eventId?: string | null }[]): number {
  const key = unit === "alerta" ? "alertId" : unit === "caso" ? "caseId" : unit === "evento" ? "eventId" : "studentRef";
  return new Set(rows.map((r) => r[key]).filter((v): v is string => !!v)).size;
}

export type PermRow = Readonly<Partial<Record<string, CellValue>>>;
export function runPermanenceReport(id: string, req: ReportRequest, rows: readonly PermRow[], caps: ReadonlySet<string>): { def: PermanenceReportDefinition; result: ReportResult } {
  const def = PERMANENCE_REPORTS.find((r) => r.id === id);
  if (!def) throw new Error(`report:unknown:${id}`);
  if (req.includeSensitive && !caps.has(NOMINAL_CAP)) throw new Error("report:nominal-not-authorized");
  const src = rows.map((r) => { const o: Record<string, CellValue> = {}; for (const c of PERMANENCE_COLUMNS) o[c.id] = (r[c.id] as CellValue) ?? null; o["unidade"] = def.unit; return o; });
  return { def, result: runReport(def, req, src) };
}

export function reportMeta(def: PermanenceReportDefinition, result: ReportResult): string[] {
  return [`Fonte: ${def.source}`, `Metodologia: ${def.methodology}`, `Unidade de contagem: ${def.unit}`,
    `Data de referência: ${String(result.params["asOf"])}`, `Conhecido até: ${String(result.params["knownAt"])}`, `Gerado em: ${result.generatedAt}`];
}

export async function exportPermanenceReport(def: PermanenceReportDefinition, result: ReportResult, branding: Branding, format: "csv" | "xlsx" | "pdf", caps: ReadonlySet<string>) {
  if (!caps.has(EXPORT_CAP)) throw new Error("report:export-not-authorized");
  const meta = reportMeta(def, result);
  return format === "csv" ? toCsv(result, branding, meta) : format === "xlsx" ? toXlsx(result, branding, meta) : toPrintableHtml(result, branding, meta);
}
