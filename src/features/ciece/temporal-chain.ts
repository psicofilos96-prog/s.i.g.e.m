/**
 * CIECE Lote 03 — cadeia estudante → matrícula → participação/enturmação → alocação (núcleo puro).
 * Pessoa, vínculo e posição são grandezas distintas; vigência desconhecida nunca entra em contagem
 * "na data" — vai para `unknownTemporal`. Correção (supersedes) conta só a versão vigente.
 */
export type Enrollment = { id: string; logicalId: string; studentId: string; schoolId: string; yearId: string; openedOn: string | null; endedOn: string | null; supersedesId: string | null };
export type Allocation = { id: string; enrollmentId: string; classId: string; from: string | null; to: string | null };

/** Só a cabeça de cada cadeia lógica (versão não superada). */
export function currentVersions(rows: Enrollment[]): Enrollment[] {
  const superseded = new Set(rows.map((r) => r.supersedesId).filter(Boolean));
  return rows.filter((r) => !superseded.has(r.id));
}

type Status = "vigente" | "fora" | "desconhecido";
const status = (from: string | null, to: string | null, on: string): Status => (from == null ? "desconhecido" : from <= on && (to == null || on <= to) ? "vigente" : "fora");

export function snapshotAt(enrollments: Enrollment[], allocations: Allocation[], on: string) {
  const heads = currentVersions(enrollments);
  const active = heads.filter((e) => status(e.openedOn, e.endedOn, on) === "vigente");
  const unknown = heads.filter((e) => status(e.openedOn, e.endedOn, on) === "desconhecido");
  const activeIds = new Set(active.map((e) => e.id));
  const allocs = allocations.filter((a) => activeIds.has(a.enrollmentId));
  const allocActive = allocs.filter((a) => status(a.from, a.to, on) === "vigente");
  const multiSchool = [...groupBy(active, (e) => e.studentId)].filter(([, es]) => new Set(es.map((e) => e.schoolId)).size > 1).map(([s]) => s);
  return {
    on,
    pessoas: new Set(active.map((e) => e.studentId)).size,
    matriculas: active.length,
    alocacoes: allocActive.length,
    semEnturmacao: active.filter((e) => !allocActive.some((a) => a.enrollmentId === e.id)).length,
    alocacaoDesconhecida: allocs.filter((a) => a.from == null).length,
    unknownTemporal: unknown.map((e) => e.id),
    multiSchoolStudents: multiSchool,
  };
}

/** Histórico do estudante em ordem; matrícula sem início fica no fim, marcada, nunca datada por inferência. */
export function studentHistory(enrollments: Enrollment[], studentId: string) {
  return currentVersions(enrollments).filter((e) => e.studentId === studentId)
    .sort((a, b) => (a.openedOn == null ? 1 : b.openedOn == null ? -1 : a.openedOn.localeCompare(b.openedOn)))
    .map((e) => ({ id: e.id, schoolId: e.schoolId, yearId: e.yearId, from: e.openedOn ?? "início não declarado", to: e.endedOn }));
}

/** Transferência/rematrícula: sobreposição só com datas conhecidas; sem data é "não verificável". */
export function overlaps(enrollments: Enrollment[], studentId: string): { a: string; b: string }[] | "nao-verificavel" {
  const es = currentVersions(enrollments).filter((e) => e.studentId === studentId);
  if (es.some((e) => e.openedOn == null)) return "nao-verificavel";
  const out: { a: string; b: string }[] = [];
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
    const x = es[i]!, y = es[j]!;
    if (x.openedOn! <= (y.endedOn ?? "9999") && y.openedOn! <= (x.endedOn ?? "9999")) out.push({ a: x.id, b: y.id });
  }
  return out;
}

function groupBy<T>(xs: T[], k: (x: T) => string) { const m = new Map<string, T[]>(); for (const x of xs) m.set(k(x), [...(m.get(k(x)) ?? []), x]); return m; }
