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

/** LOTE 11 — vínculos (episódios correntes) × estudantes distintos por turma. Episódio substituído sai. */
export type EpisodeRow = { id: string; supersedes_id: string | null; student_id: string; school_id: string | null; class_id: string; class_label_snapshot: string | null };
export function classCountRows(eps: EpisodeRow[], schoolNames: Map<string, string>) {
  const superseded = new Set(eps.map((e) => e.supersedes_id).filter(Boolean) as string[]);
  const by = new Map<string, { school: string | null; label: string | null; bonds: number; students: Set<string> }>();
  for (const e of eps) {
    if (superseded.has(e.id)) continue;
    const g = by.get(e.class_id) ?? { school: e.school_id, label: e.class_label_snapshot, bonds: 0, students: new Set<string>() };
    g.bonds += 1; g.students.add(e.student_id); by.set(e.class_id, g);
  }
  return [...by.values()].map((g) => ({
    school: g.school ? (schoolNames.get(g.school) ?? "Escola sem nome cadastrado") : null, class_label: g.label, bonds: g.bonds, students: g.students.size,
  })).sort((a, b) => `${a.school}${a.class_label}`.localeCompare(`${b.school}${b.class_label}`, "pt-BR"));
}

/** LOTE 11 — jornada declarada por escola: declarações e estudantes distintos (sem nomes). */
export type DayObsRow = { school_id: string; student_id: string };
export function journeySchoolRows(obs: DayObsRow[], schoolNames: Map<string, string>) {
  const by = new Map<string, { n: number; s: Set<string> }>();
  for (const o of obs) { const g = by.get(o.school_id) ?? { n: 0, s: new Set<string>() }; g.n += 1; g.s.add(o.student_id); by.set(o.school_id, g); }
  return [...by.entries()].map(([id, g]) => ({ school: schoolNames.get(id) ?? "Escola sem nome cadastrado", declarations: g.n, students: g.s.size }))
    .sort((a, b) => a.school.localeCompare(b.school, "pt-BR"));
}

/** LOTE 11 — valor de infraestrutura: ausência continua null, nunca "não". */
export function infraValue(o: { value_boolean: boolean | null; value_integer: number | null; value_decimal: number | null; value_text: string | null; value_catalog: string | null }): string | number | null {
  if (o.value_boolean !== null) return o.value_boolean ? "sim" : "não";
  return o.value_integer ?? (o.value_decimal !== null ? Number(o.value_decimal) : null) ?? o.value_text ?? o.value_catalog ?? null;
}
