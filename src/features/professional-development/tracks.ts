/**
 * SIGEM Desenvolvimento L06 — trilhas (projeção pura; banco = 0434).
 * Progresso só por conclusão registrada; obrigatoriedade só por mandato vigente com ato, nunca campo da trilha.
 */
export type Step = Readonly<{ ord: number; title: string; courseId: string; prerequisiteOrds: readonly number[]; elective: boolean }>;
export type Mandate = Readonly<{ id: string; audience: string; legalBasis: string; validFrom: string; validUntil: string | null; revokedOn: string | null }>;
export type StepState = "concluida" | "liberada" | "bloqueada";

/** Pré-requisito só aponta para etapa anterior; ao menos uma etapa não eletiva (espelha o writer). */
export function stepProblems(steps: readonly Omit<Step, "ord">[]): string[] {
  const p: string[] = [];
  if (steps.length === 0) p.push("Informe ao menos uma etapa.");
  steps.forEach((s, i) => { if (s.prerequisiteOrds.some((o) => o < 1 || o >= i + 1)) p.push(`Etapa ${i + 1}: pré-requisito precisa ser etapa anterior.`); });
  if (steps.length > 0 && steps.every((s) => s.elective)) p.push("A trilha precisa de ao menos uma etapa não eletiva.");
  return p;
}

/** Estado por etapa a partir dos cursos concluídos (conclusão registrada, L02). */
export function trackProgress(steps: readonly Step[], concludedCourses: ReadonlySet<string>) {
  const done = new Set(steps.filter((s) => concludedCourses.has(s.courseId)).map((s) => s.ord));
  const states = steps.map((s) => ({ ord: s.ord, title: s.title, elective: s.elective,
    state: (done.has(s.ord) ? "concluida" : s.prerequisiteOrds.every((o) => done.has(o)) ? "liberada" : "bloqueada") as StepState }));
  const core = states.filter((s) => !s.elective);
  return { states, coreDone: core.filter((s) => s.state === "concluida").length, coreTotal: core.length, complete: core.length > 0 && core.every((s) => s.state === "concluida") };
}

/** Obrigatória na data só com mandato vigente e não revogado; sem mandato = opcional. */
export function mandatoryOn(mandates: readonly Mandate[], on: string): { mandatory: boolean; basis: Mandate[] } {
  const basis = mandates.filter((m) => m.validFrom <= on && (m.validUntil == null || on <= m.validUntil) && (m.revokedOn == null || on < m.revokedOn));
  return { mandatory: basis.length > 0, basis };
}
