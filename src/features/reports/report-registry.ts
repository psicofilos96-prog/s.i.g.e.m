import { INDICADORES_REDE } from "@/features/dashboards/network-indicator-runtime";
/**
 * Catálogo de relatórios do SIGEM sobre o motor comum. Só entram definições cuja fonte é
 * canônica; as demais ficam catalogadas com a dependência declarada, sem fórmula inventada.
 */
import { NECESSIDADE_PROFESSOR, TOTAL_AULAS_OFERTADAS, TOTAL_AULAS_REDE } from "@/features/staffing/teacher-need-reports";
import { FICHA_LONGITUDINAL } from "@/features/school-followup/student-trajectory-source";
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


export const REPORTS: readonly ReportDefinition[] = [
  MAPA_ESTATISTICO,
  MAPA_ESTATISTICO_ESCOLA,
  INCLUSAO_MINIMIZADO,
  TOTAL_AULAS_OFERTADAS,
  TOTAL_AULAS_REDE,
  NECESSIDADE_PROFESSOR,
  FICHA_LONGITUDINAL,
  INDICADORES_REDE,
];
export const reportById = (id: string) => REPORTS.find((r) => r.id === id) ?? null;
