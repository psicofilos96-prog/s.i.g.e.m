/**
 * CIECE Lote 04 — turmas, oferta e pessoal (núcleo puro sobre readers canônicos).
 * Turma agrupa só por oferta/turno lidos (class_offering_at/class_shift_at; ausente = "não declarado",
 * nunca inferido do nome); ocupação só com capacidade registrada; pessoa ≠ vínculo ≠ lotação ≠ atribuição.
 * Aulas ofertadas/da rede/necessidade continuam em staffing/teacher-need(-reports).ts — não recalculadas aqui.
 */
export type ClassRow = { classId: string; schoolId: string; yearId: string; stage: string | null; modality: string | null; shift: string | null; capacity: number | null; occupied: number | null };

export function classPanel(rows: ClassRow[], by: "stage" | "modality" | "shift" | "schoolId") {
  const groups = new Map<string, ClassRow[]>();
  for (const r of rows) { const k = r[by] ?? "não declarado"; groups.set(k, [...(groups.get(k) ?? []), r]); }
  return [...groups].map(([key, rs]) => {
    const known = rs.every((r) => r.capacity != null && r.occupied != null);
    const cap = known ? rs.reduce((a, r) => a + r.capacity!, 0) : null;
    const occ = known ? rs.reduce((a, r) => a + r.occupied!, 0) : null;
    return { key, turmas: rs.length, capacidade: cap, ocupadas: occ, vagas: cap != null && occ != null ? cap - occ : null, ocupacao: cap ? occ! / cap : null, semCapacidade: rs.filter((r) => r.capacity == null).length };
  });
}

type Span = { from: string | null; to: string | null };
const on = (s: Span, d: string) => (s.from == null ? null : s.from <= d && (s.to == null || d <= s.to));

export type StaffFacts = {
  links: (Span & { id: string; personId: string })[];
  postings: (Span & { linkId: string; schoolId: string })[];
  exercises: (Span & { linkId: string; schoolId: string; role: string })[];
  assignments: (Span & { personId: string; classId: string; weeklyLessons: number | null })[];
};

/** Por data: profissionais únicos, vínculos, lotados, em exercício, com atribuição e carga atribuída; desconhecido nunca vira vigente. */
export function staffAt(f: StaffFacts, d: string) {
  const activeLinks = f.links.filter((l) => on(l, d) === true);
  const ids = new Set(activeLinks.map((l) => l.id));
  const asg = f.assignments.filter((a) => on(a, d) === true);
  return {
    date: d,
    profissionais: new Set(activeLinks.map((l) => l.personId)).size,
    vinculos: activeLinks.length,
    vinculosSemInicio: f.links.filter((l) => l.from == null).length,
    lotados: f.postings.length ? f.postings.filter((p) => ids.has(p.linkId) && on(p, d) === true).length : null,
    emExercicio: f.exercises.length ? f.exercises.filter((e) => ids.has(e.linkId) && on(e, d) === true).length : null,
    comAtribuicao: f.assignments.length ? new Set(asg.map((a) => a.personId)).size : null,
    cargaAtribuida: asg.length && asg.every((a) => a.weeklyLessons != null) ? asg.reduce((s, a) => s + a.weeklyLessons!, 0) : null,
  };
}

/** Calendário: só o aplicável já resolvido pelo adaptador institucional; nenhum calendário próprio. */
export function calendarBasis(resolved: { calendarId: string; schoolDays: number | null } | "nao-resolvido" | "ambiguo") {
  return typeof resolved === "string" ? { state: "BLOCKED" as const, reason: resolved === "ambiguo" ? "mais de um calendário aplicável" : "sem calendário aplicável resolvido" } : resolved.schoolDays == null ? { state: "UNKNOWN" as const, reason: "dias indeterminados" } : { state: "OK" as const, ...resolved };
}
