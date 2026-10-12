/**
 * Gestão de Pessoas L18 — 22 relatórios sobre o motor comum (`report-engine`).
 * Cada relatório é `ReportDefinition` com data de referência + knownAt
 * obrigatórios, fonte = motor puro já existente (L02–L17 / staffing) lido com a
 * sessão do usuário, natureza sempre "projeção dinâmica". Linhas só entram por
 * `peopleReportRows`, que recusa cenário simulado e mantém ausência como null.
 * Relatório cuja fonte ainda não é persistida declara `dependency` e é recusado
 * pelo `runReport`.
 */
import { runReport, type CellValue, type ColumnDef, type ParamDef, type ReportDefinition, type ReportRequest } from "@/features/reports/report-engine";
import { NECESSIDADE_PROFESSOR, TOTAL_AULAS_OFERTADAS, TOTAL_AULAS_REDE, DYNAMIC_NATURE } from "@/features/staffing/teacher-need-reports";

const PARAMS: readonly ParamDef[] = [
  { id: "asOf", label: "Data de referência", type: "date", required: true },
  { id: "knownAt", label: "Conhecido até", type: "datetime", required: true },
  { id: "scope", label: "Escopo", type: "enum", required: true, options: ["escola", "rede"] },
];

export const PEOPLE_COLUMNS: readonly ColumnDef[] = [
  { id: "escola", label: "Escola", kind: "text" },
  { id: "pessoa", label: "Pessoa", kind: "text" },
  { id: "vinculo", label: "Vínculo/matrícula funcional", kind: "text", sensitive: true },
  { id: "item", label: "Item", kind: "text" },
  { id: "valor", label: "Valor", kind: "number" },
  { id: "unidade", label: "Unidade", kind: "text" },
  { id: "situacao", label: "Situação", kind: "text" },
  { id: "inicio", label: "Início", kind: "date" },
  { id: "fim", label: "Fim", kind: "date" },
  { id: "motivo", label: "Motivo/lacuna", kind: "text" },
  { id: "natureza", label: "Natureza", kind: "text" },
  { id: "proveniencia", label: "Proveniência", kind: "text" },
];

const PENDING_PERSIST = "fonte ainda não persistida: o motor existe, mas falta writer/reader institucional";

const d = (id: string, title: string, description: string, source: string, dependency: string | null = null): ReportDefinition => ({
  id, version: 1, title, description, source, params: PARAMS, columns: PEOPLE_COLUMNS,
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 20000, dependency,
});

/** Três relatórios já existentes da Frente X.1 são reusados, não duplicados. */
export const PEOPLE_REPORTS: readonly ReportDefinition[] = [
  TOTAL_AULAS_OFERTADAS,
  TOTAL_AULAS_REDE,
  NECESSIDADE_PROFESSOR,
  d("quadro-de-pessoal", "Quadro de pessoal", "Pessoas com vínculos vigentes na data, por escola de lotação.", "functional-links + functionalPicture (professional_functional_links)"),
  d("vinculos-funcionais", "Vínculos funcionais", "Vínculos por pessoa com cargo, regime e jornada registrados; jornada ausente fica não disponível.", "functional-links.ts"),
  d("lotacao", "Lotação administrativa", "Lotações vigentes por escola com ato.", "placement-exercise.ts (lotações do DP)"),
  d("exercicio", "Exercício profissional", "Exercício por unidade e período, distinto de lotação.", "placement-exercise.ts (professional_exercises)"),
  d("divergencias-lotacao-exercicio", "Divergências lotação × exercício", "Divergências sinalizadas, sem correção automática.", "placement-exercise.ts"),
  d("movimentacoes", "Histórico de movimentações", "Movimentações derivadas das lotações e solicitações protocoladas.", "placement-exercise.ts + movement-requests.ts", PENDING_PERSIST),
  d("designacoes", "Designações de função", "Designações por função, vínculo, escola, ato e situação derivada.", "role-designations.ts", PENDING_PERSIST),
  d("jornadas-cargas", "Jornadas e cargas", "Cargas contratual, exercício, regência, extraclasse, designação e atribuída em unidades separadas.", "workload.ts"),
  d("disponibilidade", "Disponibilidade operacional", "Capacidade total, comprometida, livre e conflitos por vínculo/data.", "availability.ts"),
  d("afastamentos", "Afastamentos", "Tipo administrativo, período e impacto; sem conteúdo clínico nem documento.", "leave-substitution.ts", PENDING_PERSIST),
  d("substituicoes", "Substituições", "Fluxo e vigência das substituições.", "leave-substitution.ts", PENDING_PERSIST),
  d("oferta-planejada", "Planejamento da oferta", "Oferta por turma/componente com proveniência e lacunas.", "offer-plan.ts"),
  d("atribuicoes-docentes", "Atribuições docentes", "Atribuições por etapa do fluxo; só vigência ocupa horário.", "class-assignment-flow.ts", PENDING_PERSIST),
  d("aulas-descobertas", "Aulas descobertas", "Pacotes descobertos por turma/componente com habilitação exigida.", "teacher-need-engine.ts"),
  d("conflitos-horario", "Conflitos de horário e jornada", "Achados com evidência e orientação, sem correção.", "schedule-integrity.ts"),
  d("cobertura-docente", "Mapa de cobertura docente", "Cobertura integral/parcial/ausente; execução só do Diário.", "coverage-map.ts"),
  d("habilitacoes", "Habilitações", "Habilitações validadas vigentes; habilitação não é autorização.", "professional_qualifications"),
  d("dimensionamento-nao-docente", "Dimensionamento não docente", "Referência só por critério homologado; sem critério = não disponível.", "non-teaching-sizing.ts", "critérios oficiais por área ainda não homologados"),
  d("pedidos-escolas", "Solicitações das escolas", "Pedidos de professor, mediador, substituição e divergência com protocolo.", "movement-requests.ts", PENDING_PERSIST),
];

export type ProjectedRow = Readonly<Partial<Record<(typeof PEOPLE_COLUMNS)[number]["id"], CellValue>>>;

export function peopleReportRows(rows: readonly ProjectedRow[], opts: { simulated?: boolean } = {}): Record<string, CellValue>[] {
  if (opts.simulated) throw new Error("report:simulation-not-admitted");
  return rows.map((r) => {
    const out: Record<string, CellValue> = {};
    for (const c of PEOPLE_COLUMNS) out[c.id] = r[c.id as keyof ProjectedRow] ?? null;
    out["natureza"] = DYNAMIC_NATURE;
    if (out["valor"] === null && out["motivo"] === null && "valor" in r) out["motivo"] = "valor não disponível na fonte";
    return out;
  });
}

export function runPeopleReport(id: string, req: ReportRequest, rows: readonly ProjectedRow[], opts: { simulated?: boolean } = {}) {
  const def = PEOPLE_REPORTS.find((r) => r.id === id);
  if (!def) throw new Error(`report:unknown:${id}`);
  return runReport(def, req, def.columns === PEOPLE_COLUMNS ? peopleReportRows(rows, opts) : (rows as Record<string, CellValue>[]));
}
