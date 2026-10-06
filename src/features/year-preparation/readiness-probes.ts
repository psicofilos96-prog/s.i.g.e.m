// BB — leituras do readiness com escopo de ano. Só SELECT com a sessão do usuário (RLS).
// Itens anuais leem exclusivamente o ano-alvo; registros de outro ano (ex.: 2026 histórico) nunca contam.
import type { Probe } from "./readiness-model";

type Res = { data: unknown[] | null; error: { code?: string } | null };
export interface ReadQuery extends PromiseLike<Res> {
  in(col: string, values: readonly string[]): ReadQuery;
  eq(col: string, value: string): ReadQuery;
  gte(col: string, value: string): ReadQuery;
  lte(col: string, value: string): ReadQuery;
  range(from: number, to: number): ReadQuery;
}
/** Cliente mínimo: só `from().select()`. Nenhum método de escrita é exigido nem usado. */
export interface ReadClient { from(table: string): { select(cols: string): ReadQuery } }

type Rows = { kind: "rows"; rows: Record<string, unknown>[] } | { kind: "denied" } | { kind: "error" };
const PAGE = 1000;

async function rows(c: ReadClient, table: string, cols: string, f: (q: ReadQuery) => ReadQuery = (q) => q): Promise<Rows> {
  const out: Record<string, unknown>[] = [];
  try {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await f(c.from(table).select(cols)).range(from, from + PAGE - 1);
      if (error) return error.code === "42501" ? { kind: "denied" } : { kind: "error" };
      if (!data) return { kind: "error" };
      out.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE) return { kind: "rows", rows: out };
    }
  } catch { return { kind: "error" }; }
}
const probe = (r: Rows, n?: (rows: Record<string, unknown>[]) => number): Probe =>
  r.kind === "rows" ? { kind: "count", n: n ? n(r.rows) : r.rows.length } : r;
/** Dependência ilegível propaga desconhecido; nunca vira zero. */
const unread = (r: Rows): Probe => (r.kind === "rows" ? { kind: "error" } : r);
const ids = (r: Rows, col = "id") => (r.kind === "rows" ? [...new Set(r.rows.map((x) => String(x[col])))] : []);
const overlaps = (from: unknown, until: unknown, start: string, end: string) =>
  (from == null || String(from) <= end) && (until == null || String(until) >= start);

async function inIds(c: ReadClient, table: string, col: string, values: string[], cols = "id"): Promise<Rows> {
  if (values.length === 0) return { kind: "rows", rows: [] }; // ano/turma alvo legível e inexistente ⇒ zero conhecido
  const acc: Record<string, unknown>[] = [];
  for (let i = 0; i < values.length; i += 200) {
    const r = await rows(c, table, cols, (q) => q.in(col, values.slice(i, i + 200)));
    if (r.kind !== "rows") return r;
    acc.push(...r.rows);
  }
  return { kind: "rows", rows: acc };
}

export async function readProbes(c: ReadClient, year = 2027): Promise<Record<string, Probe>> {
  const yStart = `${year}-01-01`, yEnd = `${year}-12-31`;
  const years = await rows(c, "institutional_academic_year_versions", "academic_year_id,starts_on,ends_on", (q) => q.gte("starts_on", yStart).lte("starts_on", yEnd));
  const yearIds = ids(years, "academic_year_id");
  const yr = years.kind === "rows" ? years.rows : [];
  const start = yr.map((r) => String(r.starts_on)).sort()[0] ?? yStart;
  const end = yr.map((r) => String(r.ends_on ?? yEnd)).sort().at(-1) ?? yEnd;

  // Sem ano-alvo legível, nada anual pode ser lido com escopo: desconhecido.
  const scoped = async (fn: () => Promise<Rows>): Promise<Rows> => (years.kind === "rows" ? fn() : years);
  const classes = await scoped(() => inIds(c, "institutional_classes", "academic_year_id", yearIds));
  const classIds = ids(classes);
  const viaClasses = (table: string) => (classes.kind === "rows" ? inIds(c, table, "class_id", classIds) : Promise.resolve(classes));

  const [state, offerings, schedules, assignments, applic, schools, students, engagements, policies] = await Promise.all([
    scoped(() => inIds(c, "academic_year_operational_states", "academic_year_id", yearIds)),
    viaClasses("class_offering_versions"),
    viaClasses("class_schedules"),
    viaClasses("teaching_assignments"),
    scoped(() => inIds(c, "curricular_matrix_applicability", "academic_year_id", yearIds, "matrix_version_id")),
    rows(c, "institutional_schools", "id"),
    rows(c, "institutional_students", "id"),
    rows(c, "institutional_engagements", "id,valid_from,valid_until"),
    rows(c, "capability_policies", "id,valid_from,valid_until", (q) => q.eq("status", "homologated")),
  ]);
  const homolog = applic.kind === "rows" ? await inIds(c, "curricular_matrix_version_homologations", "matrix_version_id", ids(applic, "matrix_version_id")) : applic;
  const vig = (rs: Record<string, unknown>[]) => rs.filter((r) => overlaps(r.valid_from, r.valid_until, start, end)).length;

  return {
    year2027: years.kind === "rows" ? { kind: "count", n: yearIds.length } : years,
    year2027State: probe(state),
    calendarHomologations: { kind: "not-read" }, // homologação do calendário só é legível no módulo
    guardianAuthorizations: { kind: "not-read" },
    classes: probe(classes),
    offerings: classes.kind === "rows" ? probe(offerings) : unread(classes),
    schedules: probe(schedules),
    assignments: probe(assignments),
    matrixHomologations: probe(homolog),
    schools: probe(schools),
    students: probe(students),
    engagements: probe(engagements, vig),
    homologatedPolicies: probe(policies, vig),
  };
}
