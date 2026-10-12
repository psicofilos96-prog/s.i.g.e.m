// L20 — avaliação das formações e impacto institucional (migration 0451).
// Variação antes/depois é observação descritiva; causalidade nunca é atribuída automaticamente nem usada para punição.
export const CAUSALITY_NOTE = "Variação observada não demonstra que a formação causou a mudança; a leitura exige interpretação humana com limitações.";

export interface Observation { moment: "antes" | "depois" | "reavaliacao"; observedOn: string; value: number; groupSize: number; schoolId: string | null }

/** Compara antes × depois no MESMO escopo; sem os dois momentos, não há comparação (nunca zero). */
export function observedChange(obs: Observation[], schoolId: string | null) {
  const pick = (m: Observation["moment"]) => obs.filter((o) => o.schoolId === schoolId && o.moment === m).sort((a, b) => b.observedOn.localeCompare(a.observedOn))[0];
  const before = pick("antes"), after = pick("depois") ?? pick("reavaliacao");
  if (!before || !after) return { comparable: false as const, note: "Sem observação antes e depois no mesmo escopo" };
  return { comparable: true as const, before: before.value, after: after.value, difference: after.value - before.value, causal: false as const, note: CAUSALITY_NOTE };
}

export function readingProblems(x: { interpretation: string; limitations: string }): string[] {
  const p: string[] = [];
  if (x.interpretation.trim().length < 40) p.push("Interpretação humana obrigatória");
  if (x.limitations.trim().length < 20) p.push("Limitações obrigatórias");
  return p;
}

export function aggregateVisible(n: number, threshold: number | null): boolean { return threshold != null && n >= threshold; }
