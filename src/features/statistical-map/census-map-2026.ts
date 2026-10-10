/**
 * LOTE 15 — Mapa do Censo 2026 (descritivo). Projeção pura sobre os readers INVOKER
 * `census_map_2026_*` (RLS de quem consulta). Não é o Mapa Estatístico mensal oficial
 * (que exige regra homologada); nada é gravado, nada é fixado no código.
 * Ausência fica null; AEE nunca soma como aluno novo (alunos = distintos das matrículas escolares).
 */
import { runReport, toCsv, toXlsx, toPrintableHtml, type Branding, type CellValue, type ReportDefinition } from "@/features/reports/report-engine";

export type MapSchoolRow = {
  school_id: string; inep: string | null; school_name: string | null; classes: number; school_enrollments: number; distinct_students: number;
  bonds: number; aee_bonds: number; aee_students: number; aee_only_students: number; teachers: number; professionals: number;
  infra_items: number; infra_informed: number; receipt_students: number | null; receipt_bonds: number | null; receipt_aee: number | null;
  receipt_classes: number | null; receipt_teachers: number | null;
};
export type MapClassRow = {
  school_id: string; class_id: string; class_code: string | null; class_name: string | null; stage: string | null; stage_group: string | null;
  class_type: string | null; mediation: string | null; organization: string | null; schedule_literal: string | null;
  declared_students: number | null; bonds: number; distinct_students: number; is_aee: boolean; professionals: number;
};
export type MapNetworkRow = {
  schools: number; classes: number; school_enrollments: number; distinct_students: number; bonds: number;
  aee_bonds: number; aee_students: number; professionals: number; infra_items: number;
};

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export function normalizeSchools(raw: Record<string, unknown>[]): MapSchoolRow[] {
  return raw.map((r) => {
    const o: Record<string, unknown> = { ...r };
    for (const k of Object.keys(o)) if (!["school_id", "inep", "school_name"].includes(k)) o[k] = n(o[k]);
    return o as MapSchoolRow;
  });
}
export function normalizeClasses(raw: Record<string, unknown>[]): MapClassRow[] {
  return raw.map((r) => ({ ...(r as MapClassRow), declared_students: n(r["declared_students"]), bonds: Number(r["bonds"] ?? 0), distinct_students: Number(r["distinct_students"] ?? 0), professionals: Number(r["professionals"] ?? 0), is_aee: Boolean(r["is_aee"]) }));
}

/** Divergências escola × recibo oficial do Censo. Recibo ausente é divergência "sem recibo", nunca zero. */
export type Divergence = { school_id: string; inep: string | null; measure: string; base: number; receipt: number | null };
export function divergences(rows: MapSchoolRow[]): Divergence[] {
  const out: Divergence[] = [];
  for (const r of rows) {
    if (r.classes === 0 && r.bonds === 0 && r.receipt_classes === null) continue; // escola fora do recorte 2026
    const pairs: [string, number, number | null][] = [
      ["turmas", r.classes, r.receipt_classes], ["alunos", r.distinct_students, r.receipt_students],
      ["matrículas (vínculos de turma)", r.bonds, r.receipt_bonds], ["matrículas AEE", r.aee_bonds, r.receipt_aee],
    ];
    for (const [measure, base, receipt] of pairs) if (receipt === null || receipt !== base) out.push({ school_id: r.school_id, inep: r.inep, measure, base, receipt });
  }
  return out;
}

/** Agrupamento por etapa/tipo (turmas, vínculos, alunos distintos dentro do grupo). */
export function groupClasses(rows: MapClassRow[], key: "stage" | "stage_group" | "class_type" | "mediation") {
  const by = new Map<string, { label: string; classes: number; bonds: number; declared: number | null }>();
  for (const c of rows) {
    const label = c[key] ?? "não informado";
    const g = by.get(label) ?? { label, classes: 0, bonds: 0, declared: 0 };
    g.classes += 1; g.bonds += c.bonds; g.declared = g.declared === null || c.declared_students === null ? null : g.declared + c.declared_students;
    by.set(label, g);
  }
  return [...by.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** Totais de um recorte de escolas. Alunos distintos NÃO somam entre escolas como alunos da rede. */
export function sliceTotals(rows: MapSchoolRow[]) {
  const s = (k: keyof MapSchoolRow) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
  return { schools: rows.length, classes: s("classes"), school_enrollments: s("school_enrollments"), bonds: s("bonds"), aee_bonds: s("aee_bonds"), teachers: s("teachers"), professionals: s("professionals") };
}

export const SCHOOL_COLUMNS = [
  { id: "inep", label: "INEP", kind: "text" }, { id: "school", label: "Escola", kind: "text" },
  { id: "classes", label: "Turmas", kind: "number" }, { id: "students", label: "Alunos distintos", kind: "number" },
  { id: "enrollments", label: "Matrículas escolares", kind: "number" }, { id: "bonds", label: "Vínculos de turma", kind: "number" },
  { id: "aee", label: "Vínculos AEE", kind: "number" }, { id: "aee_only", label: "Só AEE (sem turma regular)", kind: "number" },
  { id: "teachers", label: "Docentes declarados", kind: "number" }, { id: "professionals", label: "Profissionais declarados", kind: "number" },
  { id: "infra", label: "Infraestrutura informada", kind: "text" }, { id: "receipt", label: "Recibo Censo", kind: "text" },
] as const;
export const CLASS_COLUMNS = [
  { id: "school", label: "Escola", kind: "text" }, { id: "class", label: "Turma", kind: "text" }, { id: "stage", label: "Etapa", kind: "text" },
  { id: "type", label: "Tipo", kind: "text" }, { id: "mediation", label: "Mediação", kind: "text" }, { id: "schedule", label: "Horário declarado", kind: "text" },
  { id: "declared", label: "Qtd. declarada", kind: "number" }, { id: "bonds", label: "Vínculos", kind: "number" }, { id: "professionals", label: "Profissionais", kind: "number" },
] as const;

const def = (id: string, title: string, columns: ReportDefinition["columns"]): ReportDefinition => ({
  id, version: 1, title, description: "Mapa do Censo 2026 — descritivo, lido com a sessão de quem gera.", source: "census_map_2026_*",
  params: [], columns, formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000,
});
export const MAP_SCHOOL_REPORT = def("mapa-censo-2026-escolas", "Mapa do Censo 2026 — escolas", SCHOOL_COLUMNS);
export const MAP_CLASS_REPORT = def("mapa-censo-2026-turmas", "Mapa do Censo 2026 — turmas", CLASS_COLUMNS);

export function receiptStatus(r: MapSchoolRow, divs: Divergence[]): string {
  if (r.receipt_classes === null) return "sem recibo";
  return divs.some((d) => d.school_id === r.school_id) ? "diverge" : "coincide";
}
export function schoolCells(rows: MapSchoolRow[]): Record<string, CellValue>[] {
  const divs = divergences(rows);
  return rows.map((r) => ({
    inep: r.inep, school: r.school_name, classes: r.classes, students: r.distinct_students, enrollments: r.school_enrollments, bonds: r.bonds,
    aee: r.aee_bonds, aee_only: r.aee_only_students, teachers: r.teachers, professionals: r.professionals,
    infra: r.infra_items ? `${r.infra_informed} de ${r.infra_items}` : null, receipt: receiptStatus(r, divs),
  }));
}
export function classCells(rows: MapClassRow[], names: Map<string, string>): Record<string, CellValue>[] {
  return rows.map((c) => ({
    school: names.get(c.school_id) ?? null, class: c.class_name ?? c.class_code, stage: c.stage, type: c.class_type, mediation: c.mediation,
    schedule: c.schedule_literal, declared: c.declared_students, bonds: c.bonds, professionals: c.professionals,
  }));
}

/** Exporta pelo motor comum; PDF em A4 paisagem. */
export async function exportMap(defn: ReportDefinition, cells: Record<string, CellValue>[], format: "csv" | "xlsx" | "pdf", branding: Branding, meta: string[]): Promise<Blob> {
  const result = runReport(defn, { params: {} }, cells);
  if (format === "csv") return new Blob([toCsv(result, branding, meta)], { type: "text/csv;charset=utf-8" });
  if (format === "xlsx") return new Blob([await toXlsx(result, branding, meta)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return new Blob([toPrintableHtml(result, branding, meta).replace("size:A4;", "size:A4 landscape;")], { type: "text/html;charset=utf-8" });
}

/** LOTE 16 — grade no leiaute do mapa: Etapa agregada → etapa, com subtotal por grupo e total geral. Tudo derivado (somente leitura). */
export type GridRow = { kind: "linha" | "subtotal" | "total"; group: string; stage: string; classes: number; declared: number | null; bonds: number; aee_bonds: number };
export function mapGrid(rows: MapClassRow[]): GridRow[] {
  const groups = new Map<string, MapClassRow[]>();
  for (const c of rows) { const g = c.stage_group ?? "não informado"; groups.set(g, [...(groups.get(g) ?? []), c]); }
  const sum = (cs: MapClassRow[], group: string, stage: string, kind: GridRow["kind"]): GridRow => ({
    kind, group, stage, classes: cs.length, bonds: cs.reduce((t, c) => t + c.bonds, 0), aee_bonds: cs.filter((c) => c.is_aee).reduce((t, c) => t + c.bonds, 0),
    declared: cs.some((c) => c.declared_students === null) ? null : cs.reduce((t, c) => t + (c.declared_students as number), 0),
  });
  const out: GridRow[] = [];
  for (const g of [...groups.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"))) {
    const cs = groups.get(g)!;
    const stages = new Map<string, MapClassRow[]>();
    for (const c of cs) { const s = c.stage ?? "não informado"; stages.set(s, [...(stages.get(s) ?? []), c]); }
    for (const s of [...stages.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"))) out.push(sum(stages.get(s)!, g, s, "linha"));
    out.push(sum(cs, g, `Subtotal — ${g}`, "subtotal"));
  }
  if (rows.length) out.push(sum(rows, "", "Total geral", "total"));
  return out;
}

/** Comparador por turma: quantidade declarada no Censo × vínculos no banco. Sem declaração é erro explícito, nunca zero. */
export type ClassCheck = { class_id: string; school_id: string; label: string; status: "coincide" | "diverge" | "sem-declaracao"; declared: number | null; bonds: number };
export function classChecks(rows: MapClassRow[]): ClassCheck[] {
  return rows.map((c) => ({
    class_id: c.class_id, school_id: c.school_id, label: c.class_name ?? c.class_code ?? c.class_id, declared: c.declared_students, bonds: c.bonds,
    status: c.declared_students === null ? "sem-declaracao" : c.declared_students === c.bonds ? "coincide" : "diverge",
  }));
}

/** Campos editáveis: só células que uma regra homologada do Mapa declare ajustáveis (ledger N4.3). Sem regra ⇒ nenhum. */
export function editableCells(adjustableCellIds: readonly string[] | null): readonly string[] {
  return adjustableCellIds ?? [];
}

export const MAP_GRID_REPORT = def("mapa-censo-2026-grade", "Mapa do Censo 2026 — grade por modalidade e etapa", [
  { id: "group", label: "Modalidade / etapa agregada", kind: "text" }, { id: "stage", label: "Etapa", kind: "text" },
  { id: "classes", label: "Turmas", kind: "number" }, { id: "declared", label: "Qtd. declarada", kind: "number" },
  { id: "bonds", label: "Vínculos", kind: "number" }, { id: "aee", label: "AEE", kind: "number" },
]);
export function gridCells(grid: GridRow[]): Record<string, CellValue>[] {
  return grid.map((g) => ({ group: g.kind === "linha" ? g.group : "", stage: g.stage, classes: g.classes, declared: g.declared, bonds: g.bonds, aee: g.aee_bonds }));
}
