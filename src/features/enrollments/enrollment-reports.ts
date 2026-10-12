/**
 * Organização da Rede L23 — 22 relatórios sobre o motor comum (`report-engine`).
 * Cada relatório declara fonte (módulo L02–L22 lido com a sessão do usuário),
 * metodologia por extenso e exige data de referência + knownAt. CSV/XLSX/PDF
 * saem só do `report-engine`; o cabeçalho de metadados (`reportMeta`) leva
 * fonte, metodologia e data. Cenário simulado (L22) é recusado; ausência fica
 * null. Fonte ainda não persistida declara `dependency` e é recusada.
 */
import { runReport, toCsv, toPrintableHtml, type Branding, type CellValue, type ColumnDef, type ParamDef, type ReportDefinition, type ReportRequest, type ReportResult } from "@/features/reports/report-engine";

const PARAMS: readonly ParamDef[] = [
  { id: "asOf", label: "Data de referência", type: "date", required: true },
  { id: "knownAt", label: "Conhecido até", type: "datetime", required: true },
  { id: "scope", label: "Escopo", type: "enum", required: true, options: ["escola", "rede"] },
];

export const ENROLLMENT_COLUMNS: readonly ColumnDef[] = [
  { id: "escola", label: "Escola", kind: "text" },
  { id: "etapa", label: "Etapa/modalidade", kind: "text" },
  { id: "turno", label: "Turno", kind: "text" },
  { id: "turma", label: "Turma", kind: "text" },
  { id: "protocolo", label: "Protocolo", kind: "text", sensitive: true },
  { id: "item", label: "Item", kind: "text" },
  { id: "valor", label: "Valor", kind: "number" },
  { id: "situacao", label: "Situação", kind: "text" },
  { id: "data", label: "Data", kind: "date" },
  { id: "motivo", label: "Motivo/lacuna", kind: "text" },
  { id: "proveniencia", label: "Proveniência", kind: "text" },
];

const PENDING = "fonte ainda não persistida: o motor existe, mas falta writer/reader institucional";

export type EnrollmentReportDefinition = ReportDefinition & Readonly<{ methodology: string }>;

const d = (id: string, title: string, source: string, methodology: string, dependency: string | null = null): EnrollmentReportDefinition => ({
  id, version: 1, title, description: methodology, source, methodology, params: PARAMS, columns: ENROLLMENT_COLUMNS,
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 20000, dependency,
});

export const ENROLLMENT_REPORTS: readonly EnrollmentReportDefinition[] = [
  d("oferta-escolar", "Oferta por escola", "school-offer-lifecycle.ts", "Ofertas em funcionamento na data por escola×etapa×modalidade×ano×turno; rascunho e encerrada ficam fora."),
  d("capacidades", "Capacidades instalada/operacional/autorizada", "capacity-model.ts", "As três capacidades em colunas separadas; autorizada só com ato; ausência = não disponível.", PENDING),
  d("planejamento-turmas", "Planejamento de turmas", "class-planning.ts", "Propostas de abertura/ampliação/reorganização/encerramento e sua situação; nenhuma vira turma sem writer canônico."),
  d("quadro-vagas", "Quadro de vagas", "vacancy-board.ts", "Disponível = autorizadas − ocupação vigente − reservas ativas; sem autorizada ⇒ não disponível, nunca zero.", PENDING),
  d("campanhas", "Campanhas de matrícula", "enrollment-campaigns.ts", "Campanhas por estado e janela publicada."),
  d("inscricoes", "Inscrições e pré-matrículas", "pre-registration.ts", "Protocolos por situação; dado pessoal só como HMAC, nunca em claro."),
  d("pedidos-vagas", "Pedidos de vagas", "vacancy-requests.ts", "Pedidos por escola de preferência e situação."),
  d("distribuicao", "Resultado da distribuição", "distribution-engine.ts", "Alocações propostas pelo motor com o critério homologado aplicado e a posição de cada protocolo."),
  d("reservas", "Reservas", "reservation-ledger.ts", "Reservas ativas, expiradas e consumidas na data.", PENDING),
  d("lista-espera", "Lista de espera", "waiting-list.ts", "Posição por escola×etapa×turno, ordenada pelo critério homologado vigente."),
  d("confirmacoes", "Confirmações oficiais", "official-confirmation.ts", "Etapas concluídas por protocolo; matrícula só pelo writer canônico record_enrollment."),
  d("enturmacoes", "Enturmações", "temporal-allocation.ts (class_enrollment_episodes)", "Alocações vigentes na data com início/fim."),
  d("transferencias", "Transferências", "transfer-flow.ts", "Transferências por origem, destino e data efetiva; remanejados em grupo próprio, sem dupla contagem."),
  d("ocupacao", "Ocupação e alertas", "occupancy-panel.ts", "Ocupação/autorizada por turma; alerta só por limiar homologado.", "limiar de ocupação não homologado"),
  d("mapa-territorial", "Demanda territorial", "territorial-map.ts", "Demanda agregada por território com supressão de células pequenas.", "provedor de mapa e limiar de supressão não definidos"),
  d("educacao-infantil", "Educação Infantil", "early-childhood.ts", "Demanda por escola×grupo×jornada; grupo só por regra etária homologada; não classificados à parte.", "ato oficial de data de corte e faixas não registrado"),
  d("fundamental-eja", "Fundamental e EJA semestral", "fundamental-eja.ts", "Turmas e vagas por período do calendário aplicável; regime declarado na oferta."),
  d("acessibilidade", "Acessibilidade e recursos", "accessibility-planning.ts", "Lacunas de recurso por escola a partir de contagens agregadas do NEI; nenhum dado individual."),
  d("demanda-pessoal", "Demanda de pessoal das novas turmas", "staffing-bridge.ts", "Pacotes componente×turma×aulas da matriz homologada; nunca número de professores."),
  d("familia-acompanhamento", "Acompanhamento pela família", "family-enrollment-portal.ts", "Contagem de protocolos acompanhados e confirmados pela família; sem identificação."),
  d("movimentacao-mensal", "Movimentação mensal", "transfer-flow.ts + temporal-allocation.ts", "Entradas, saídas e remanejados por escola no mês da data de referência."),
  d("ged-atos", "Editais, atos, critérios e decisões", "enrollment-ged.ts", "Documentos do GED com versão vigente, autoria e histórico.", PENDING),
];

export type EnrollmentRow = Readonly<Partial<Record<(typeof ENROLLMENT_COLUMNS)[number]["id"], CellValue>>>;

export function enrollmentReportRows(rows: readonly EnrollmentRow[], opts: { simulated?: boolean } = {}): Record<string, CellValue>[] {
  if (opts.simulated) throw new Error("report:simulation-not-admitted");
  return rows.map((r) => {
    const out: Record<string, CellValue> = {};
    for (const c of ENROLLMENT_COLUMNS) out[c.id] = r[c.id as keyof EnrollmentRow] ?? null;
    if ("valor" in r && out["valor"] === null && out["motivo"] === null) out["motivo"] = "valor não disponível na fonte";
    return out;
  });
}

export function runEnrollmentReport(id: string, req: ReportRequest, rows: readonly EnrollmentRow[], opts: { simulated?: boolean } = {}) {
  const def = ENROLLMENT_REPORTS.find((r) => r.id === id);
  if (!def) throw new Error(`report:unknown:${id}`);
  return { def, result: runReport(def, req, enrollmentReportRows(rows, opts)) };
}

/** Linhas de metadados que acompanham toda exportação. */
export function reportMeta(def: EnrollmentReportDefinition, result: ReportResult): string[] {
  return [
    `Fonte: ${def.source}`,
    `Metodologia: ${def.methodology}`,
    `Data de referência: ${String(result.params["asOf"])}`,
    `Conhecido até: ${String(result.params["knownAt"])}`,
    `Gerado em: ${result.generatedAt}`,
  ];
}

export function exportEnrollmentReport(def: EnrollmentReportDefinition, result: ReportResult, branding: Branding, format: "csv" | "pdf") {
  const meta = reportMeta(def, result);
  return format === "csv" ? toCsv(result, branding, meta) : toPrintableHtml(result, branding, meta);
}
