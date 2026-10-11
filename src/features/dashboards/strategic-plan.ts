/**
 * Lote 10 (Expansão) — Plano Municipal de Educação e metas: núcleo puro.
 * Meta só existe com fonte documental (lei/plano) e homologação; nada é semeado.
 * Indicador lê valores do catálogo da rede; orçamento só com fonte contábil real.
 */

export type Goal = Readonly<{ id: string; source: string | null; homologated: boolean; baseline: { year: number; value: number } | null; target: { year: number; value: number } | null; direction: "maior-melhor" | "menor-melhor" }>;

export function goalIssue(g: Goal): string | null {
  if (!g.source?.trim()) return "sem-fonte-documental";
  if (!g.homologated) return "nao-homologada";
  if (!g.baseline) return "sem-linha-de-base";
  if (!g.target) return "sem-alvo";
  if (g.target.year <= g.baseline.year) return "prazo-anterior-a-base";
  return null;
}

/** Trajetória linear esperada entre base e alvo — hipótese declarada, nunca meta nova. */
export function expectedOn(g: Goal, year: number): number | null {
  if (goalIssue(g) || !g.baseline || !g.target) return null;
  const t = (year - g.baseline.year) / (g.target.year - g.baseline.year);
  return Math.round((g.baseline.value + (g.target.value - g.baseline.value) * Math.min(Math.max(t, 0), 1)) * 100) / 100;
}

/** Desvio: só com valor observado comparável; tolerância só configurada. */
export function deviation(g: Goal, obs: { year: number; value: number | null; comparable: boolean }, tolerance: number | null) {
  const exp = expectedOn(g, obs.year);
  if (exp == null || obs.value == null) return { state: "nao-apurado" as const };
  if (!obs.comparable) return { state: "nao-comparavel" as const };
  const gap = g.direction === "maior-melhor" ? obs.value - exp : exp - obs.value;
  if (tolerance == null) return { state: "sem-tolerancia" as const, gap };
  return { state: gap >= -tolerance ? "no-rumo" as const : "desvio" as const, gap: Math.round(gap * 100) / 100 };
}

/** Série: só pontos da mesma versão/escala; os demais ficam fora e contados. */
export function comparableSeries<T extends { scaleKey: string; year: number; value: number | null }>(points: readonly T[], scaleKey: string) {
  const kept = points.filter((p) => p.scaleKey === scaleKey && p.value != null).sort((a, b) => a.year - b.year);
  return { kept, excluded: points.length - kept.length };
}

/** Orçamento: executado só de fonte contábil real; sem ela, nunca 0. */
export function budgetView(planned: number | null, executed: { value: number; source: string } | null) {
  if (planned == null) return { state: "sem-planejado" as const };
  if (!executed || !executed.source.trim()) return { state: "sem-fonte-contabil" as const, planned };
  return { state: "apurado" as const, planned, executed: executed.value, pct: planned === 0 ? null : Math.round((executed.value / planned) * 1000) / 10 };
}

/** Painel público: só agregados autorizados; grupo menor que o limiar declarado é suprimido; sem limiar, nada publica. */
export function publicCell(value: number | null, n: number | null, threshold: number | null, authorized: boolean) {
  if (!authorized || threshold == null) return { publish: false as const, reason: "nao-autorizado" };
  if (value == null || n == null) return { publish: false as const, reason: "sem-dado" };
  if (n < threshold) return { publish: false as const, reason: "grupo-pequeno" };
  return { publish: true as const, value };
}
