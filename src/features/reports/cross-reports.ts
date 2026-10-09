/**
 * INT.12 — Cruzamentos da Central sobre leituras já feitas com a sessão de quem gera.
 * Puro: nada é inventado; ausência fica null ("não disponível"), nunca zero.
 */
export type ReconRow = { school_id: string; inep: string | null; measure: string; operational_value: number | null; official_value: number | null };
export type PanoramaRow = {
  school: string; inep: string | null; classes: number | null; enrollments: number | null; students: number | null;
  enrollments_per_class: number | null; staff_records: number | null; census_match: string;
};

export function panoramaRows(recon: ReconRow[], names: Map<string, string>, staff: Map<string, number> | null): PanoramaRow[] {
  const by = new Map<string, { inep: string | null; m: Record<string, { op: number | null; of: number | null }> }>();
  for (const r of recon) {
    const e = by.get(r.school_id) ?? { inep: r.inep, m: {} };
    e.m[r.measure] = { op: r.operational_value == null ? null : Number(r.operational_value), of: r.official_value == null ? null : Number(r.official_value) };
    by.set(r.school_id, e);
  }
  return [...by.entries()].map(([id, e]) => {
    const classes = e.m["turmas"]?.op ?? null, enr = e.m["matriculas_total"]?.op ?? null, stu = e.m["alunos"]?.op ?? null;
    const measures = Object.values(e.m);
    const match = measures.some((x) => x.of === null || x.op === null) ? "incompleto" : measures.every((x) => x.of === x.op) ? "coincide" : "diverge";
    return {
      school: names.get(id) ?? "Escola sem nome cadastrado", inep: e.inep, classes, enrollments: enr, students: stu,
      enrollments_per_class: classes && enr !== null ? Math.round((enr / classes) * 10) / 10 : null,
      staff_records: staff ? (staff.get(id) ?? 0) : null, census_match: match,
    };
  }).sort((a, b) => a.school.localeCompare(b.school, "pt-BR"));
}

/** Totais reconciliados: soma só o que foi observado; qualquer ausência torna o total null. */
export function panoramaTotals(rows: PanoramaRow[]) {
  const sum = (k: "classes" | "enrollments" | "students" | "staff_records") => rows.some((r) => r[k] === null) ? null : rows.reduce((s, r) => s + (r[k] as number), 0);
  return { schools: rows.length, classes: sum("classes"), enrollments: sum("enrollments"), students: sum("students"), staff_records: sum("staff_records") };
}
