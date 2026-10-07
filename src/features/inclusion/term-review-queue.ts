/**
 * N8.2-3 — fila de termos não reconhecidos (projeção pura sobre eventos append-only).
 * Sugestão é só textual/visual; nunca confirma: associação a alias/categoria exige evento humano "validado".
 */
export type TermEvent = Readonly<
  | { kind: "recebido"; termId: string; original: string; origin: string; context: string; at: string }
  | { kind: "validado"; termId: string; categoryId: string; alias: string; actor: string; at: string }
  | { kind: "recusado"; termId: string; reason: string; actor: string; at: string }
>;
export type TermItem = Readonly<{
  termId: string; original: string; origin: string; context: string;
  status: "pendente" | "validado" | "recusado"; categoryId: string | null; history: readonly TermEvent[];
}>;

export function projectTermQueue(events: readonly TermEvent[]): TermItem[] {
  const by = new Map<string, TermEvent[]>();
  for (const e of [...events].sort((a, b) => a.at.localeCompare(b.at))) { const l = by.get(e.termId) ?? []; l.push(e); by.set(e.termId, l); }
  const out: TermItem[] = [];
  for (const [termId, h] of by) {
    const r = h.find((e) => e.kind === "recebido"); if (!r || r.kind !== "recebido") continue;
    const last = [...h].reverse().find((e) => e.kind !== "recebido");
    out.push({ termId, original: r.original, origin: r.origin, context: r.context,
      status: !last ? "pendente" : last.kind === "validado" ? "validado" : "recusado",
      categoryId: last?.kind === "validado" ? last.categoryId : null, history: h });
  }
  return out;
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Sugestões por semelhança de texto com aliases já validados; retorno é apenas candidato, nunca decisão. */
export function suggestAliases(original: string, aliases: readonly { alias: string; categoryId: string }[], limit = 3) {
  const t = new Set(norm(original).split(" ").filter(Boolean));
  return aliases.map((a) => { const w = norm(a.alias).split(" ").filter(Boolean); const hit = w.filter((x) => t.has(x)).length;
    return { ...a, score: w.length ? hit / Math.max(w.length, t.size) : 0, confirmed: false as const }; })
    .filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
