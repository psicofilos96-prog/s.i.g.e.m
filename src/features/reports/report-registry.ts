import { INDICADORES_REDE } from "@/features/dashboards/network-indicator-runtime";
/**
 * Catálogo de relatórios do SIGEM sobre o motor comum. Só entram definições cuja fonte é
 * canônica; as demais ficam catalogadas com a dependência declarada, sem fórmula inventada.
 */
import { NECESSIDADE_PROFESSOR, TOTAL_AULAS_OFERTADAS, TOTAL_AULAS_REDE } from "@/features/staffing/teacher-need-reports";
import { AUDIT_REPORT } from "@/features/audit/audit-report";
import { FICHA_LONGITUDINAL } from "@/features/school-followup/student-trajectory-source";
import { PEDIDOS_ALIMENTACAO, CONSOLIDADO_ALIMENTACAO } from "@/features/school-meals/order-model";
import { ENTREGAS_ALIMENTACAO, FORNECEDOR_FATOS_ALIMENTACAO } from "@/features/school-meals/receiving-model";
import { FICHA_ESTOQUE_ALIMENTACAO, SALDO_ESTOQUE_ALIMENTACAO } from "@/features/school-meals/stock-model";
import type { Branding, CellValue, ReportDefinition } from "./report-engine";
import { HEADER_LINES, MAP_TITLE, MEASURE_KEYS, MEASURE_LABEL, networkTotal, type SchoolProjection } from "@/features/statistical-map/network-projection";

export const NETWORK_BRANDING: Branding = { headerLines: HEADER_LINES, title: MAP_TITLE };

export const MAPA_ESTATISTICO: ReportDefinition = {
  id: "mapa-estatistico-rede", version: 1, title: "Mapa Estatístico (mensal)",
  description: "Projeção mensal por escola a partir dos registros bitemporais de matrícula, participação, alocação e movimentação.",
  source: "getNetworkProjection (cycle_enrollments_at / cycle_participations_at / class_allocations_at / movimentações)",
  params: [
    { id: "year", label: "Ano", type: "integer", required: true, min: 2000, max: 2100 },
    { id: "month", label: "Mês", type: "integer", required: true, min: 1, max: 12 },
    { id: "referenceDate", label: "Data de referência", type: "date", required: false },
    { id: "knownAt", label: "Conhecido até", type: "datetime", required: false },
  ],
  columns: [
    { id: "schoolName", label: "Escola", kind: "text" }, { id: "schoolId", label: "Identificador", kind: "text" },
    { id: "district", label: "Distrito", kind: "text" },
    ...MEASURE_KEYS.map((k) => ({ id: k, label: MEASURE_LABEL[k], kind: "number" as const })),
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};

/** Linhas do Mapa: mesma projeção, sem recálculo; medida não lida = null. Linha "Rede" igual à semântica existente. */
/** T — Mapa por escola: CSV/XLSX/PDF saem da MESMA fotografia (viva ou snapshot oficial), sem recálculo. */
export const MAPA_ESTATISTICO_ESCOLA: ReportDefinition = {
  id: "mapa-estatistico-escola", version: 1, title: "Mapa Estatístico da unidade",
  description: "Células da fotografia do Mapa (preparação ou versão oficial congelada).",
  source: "getStatisticalMap (assembleMapSnapshot / statistical_map_versions.snapshot)",
  params: [
    { id: "competence", label: "Competência", type: "text", required: true, maxLength: 7 },
    { id: "status", label: "Situação", type: "text", required: true, maxLength: 80 },
  ],
  columns: [
    { id: "section", label: "Seção", kind: "text" }, { id: "label", label: "Campo", kind: "text" },
    { id: "value", label: "Valor", kind: "text" }, { id: "state", label: "Estado", kind: "text" }, { id: "origin", label: "Origem", kind: "text" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};
export function mapaEscolaRows(cells: readonly { sectionId: string; label: string; value: unknown; state: string; origin: string }[]): Record<string, CellValue>[] {
  return cells.map((c) => ({ section: c.sectionId, label: c.label,
    value: c.state === "disponivel" && c.value != null ? String(c.value) : null, state: c.state, origin: c.origin }));
}

export function mapaRows(schools: readonly SchoolProjection[]): Record<string, CellValue>[] {
  const rows: Record<string, CellValue>[] = schools.map((s) => ({
    schoolName: s.schoolName, schoolId: s.schoolId, district: s.district,
    ...Object.fromEntries(MEASURE_KEYS.map((k) => [k, s[k].value])),
  }));
  rows.push({ schoolName: "Rede (escolas com dado)", schoolId: "", district: "",
    ...Object.fromEntries(MEASURE_KEYS.map((k) => { const t = networkTotal(schools, k);
      return [k, t.value == null ? null : t.missingSchools.length ? `${t.value} (faltam ${t.missingSchools.length})` : t.value]; })) });
  return rows;
}

export const INCLUSAO_MINIMIZADO: ReportDefinition = {
  id: "inclusao-relatorio-pedagogico-minimizado", version: 1, title: "Relatório pedagógico minimizado (Inclusão)",
  description: "Só tipo, período, finalidade e texto pedagógico de registros vigentes; sem autoria, categorias, anexos ou encerrados.",
  source: "inclusion_records (RLS + capability de inclusão)",
  params: [{ id: "on", label: "Vigente em", type: "date", required: true }],
  columns: [
    { id: "tipo", label: "tipo", kind: "text" }, { id: "desde", label: "desde", kind: "date" },
    { id: "ate", label: "ate", kind: "date" }, { id: "finalidade", label: "finalidade", kind: "text" },
    { id: "registro", label: "registro", kind: "text" },
  ],
  formats: ["csv"], reproducible: false, syncRowLimit: 2000,
};


/** AK — situação operacional da escola: projeção dinâmica, NÃO é documento oficial. */
export const GESTAO_ESCOLAR: ReportDefinition = {
  id: "situacao-operacional-escola", version: 1, title: "Situação operacional da escola (projeção, não oficial)",
  description: "Blocos da Estação da Direção com estado (disponível/zero/desconhecido/não disponível/bloqueado), motivo e fonte.",
  source: "secretariat_overview_at / class_schedule_at / diary_school_overview_at / teaching_plans_overview_at / school_communications_at / aee_services_at / meal_services_at",
  params: [{ id: "school", label: "Escola", type: "text", required: true, maxLength: 120 }, { id: "on", label: "Data de referência", type: "date", required: true }],
  columns: [
    { id: "block", label: "Bloco", kind: "text" }, { id: "state", label: "Estado", kind: "text" }, { id: "value", label: "Valor", kind: "number" },
    { id: "detail", label: "Detalhe", kind: "text" }, { id: "reason", label: "Motivo", kind: "text" }, { id: "source", label: "Fonte", kind: "text" }, { id: "knownAt", label: "Reproduz conhecido até", kind: "text" },
  ],
  formats: ["csv"], reproducible: false, syncRowLimit: 100,
};

export const SUPERVISAO_ACOMPANHAMENTO: ReportDefinition = {
  id: "acompanhamento-supervisao-escolar", version: 1, title: "Acompanhamento da Supervisão Escolar",
  description: "Registros vigentes (cabeça de cada cadeia) da Supervisão para uma escola, como o reader os devolve à sessão; sem identificação de pessoas.",
  source: "school_supervision_records_at",
  params: [{ id: "school", label: "Escola", type: "text", required: true, maxLength: 120 }, { id: "knownAt", label: "Conhecido até", type: "datetime", required: false }],
  columns: [
    { id: "school", label: "Escola", kind: "text" }, { id: "occurredOn", label: "Data", kind: "date" }, { id: "modality", label: "Modalidade", kind: "text" },
    { id: "subject", label: "Assunto", kind: "text" }, { id: "referral", label: "Encaminhamento", kind: "text" },
    { id: "responsible", label: "Responsável (rótulo)", kind: "text", sensitive: true }, { id: "returnOn", label: "Prazo/retorno", kind: "date" },
    { id: "state", label: "Situação", kind: "text" }, { id: "version", label: "Versão", kind: "number" }, { id: "visibleToSchool", label: "Visível à escola", kind: "text" },
    { id: "recordedAt", label: "Registrado em", kind: "text" },
  ],
  formats: ["csv"], reproducible: true, syncRowLimit: 500,
};

export const REPORTS: readonly ReportDefinition[] = [
  MAPA_ESTATISTICO,
  MAPA_ESTATISTICO_ESCOLA,
  INCLUSAO_MINIMIZADO,
  TOTAL_AULAS_OFERTADAS,
  TOTAL_AULAS_REDE,
  NECESSIDADE_PROFESSOR,
  FICHA_LONGITUDINAL,
  INDICADORES_REDE,
  GESTAO_ESCOLAR,
  SUPERVISAO_ACOMPANHAMENTO,
  AUDIT_REPORT,
  PEDIDOS_ALIMENTACAO,
  CONSOLIDADO_ALIMENTACAO,
  ENTREGAS_ALIMENTACAO,
  FORNECEDOR_FATOS_ALIMENTACAO,
  FICHA_ESTOQUE_ALIMENTACAO,
  SALDO_ESTOQUE_ALIMENTACAO,
];
export const reportById = (id: string) => REPORTS.find((r) => r.id === id) ?? null;
