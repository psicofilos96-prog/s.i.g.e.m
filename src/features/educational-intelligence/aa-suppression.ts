/** A&A Lote 8 — supressão de grupos pequenos com supressão complementar. Só roda com limiar de política registrada. */
export type Group = { key: string; n: number | null };
export type Suppressed = { key: string; n: number | null; suppressed: boolean };

/**
 * minN nulo = sem política: nada é suprimido nem alterado (o chamador sinaliza a ausência).
 * Com política: suprime n < minN; se só um grupo ficou suprimido, suprime também o menor visível,
 * para que total − visíveis não revele o protegido. Ausência (null) nunca vira zero.
 */
export function suppressSmallGroups(groups: readonly Group[], minN: number | null): { rows: Suppressed[]; policy: "sem-politica" | "aplicada" } {
  if (minN === null) return { rows: groups.map((g) => ({ ...g, suppressed: false })), policy: "sem-politica" };
  const rows = groups.map((g) => ({ ...g, suppressed: g.n !== null && g.n > 0 && g.n < minN }));
  const sup = rows.filter((r) => r.suppressed);
  const sumSup = sup.reduce((s, r) => s + (r.n ?? 0), 0);
  if (sup.length > 0 && (sup.length < 2 || sumSup < minN)) {
    const cand = rows.filter((r) => !r.suppressed && r.n !== null).sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
    for (const c of cand) { c.suppressed = true; if (rows.filter((r) => r.suppressed).reduce((s, r) => s + (r.n ?? 0), 0) >= minN) break; }
  }
  return { rows: rows.map((r) => (r.suppressed ? { ...r, n: null } : r)), policy: "aplicada" };
}
