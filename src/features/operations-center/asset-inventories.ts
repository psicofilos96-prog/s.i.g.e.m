/**
 * Centro de Operações — L11: inventários patrimoniais (migration 0418).
 * Escopo = escola + ambientes (vazio = escola toda) + data de referência. Na abertura, o banco congela a fotografia dos
 * bens ESPERADOS (última localização com data ≤ referência, no escopo, sem baixa) — mudanças posteriores não a alteram.
 * Equipe = atuações vigentes da escola, fechada no início. Conferência (uma por bem esperado) e providência só por membro;
 * item encontrado e não esperado é registrado por descrição. Divergência é PROJEÇÃO (esperado × conferido).
 * Encerramento por pessoa fora da equipe exige todo esperado conferido e toda divergência com providência.
 * O inventário nunca altera o bem: providência é encaminhada aos writers canônicos (transferência L10, baixa L09).
 */
export type CountResult = "localizado" | "outro-ambiente" | "nao-localizado" | "nao-esperado";
export interface Expected { assetId: string; expectedSpace: string | null }
export interface Count { id: string; assetId: string | null; result: CountResult; foundSpace: string | null; foundDescription?: string; actorPerson: string; hasEvidence: boolean }
export interface Action { assetId: string | null; countId?: string; kind: string; note: string }

export interface Divergence { countId: string | null; assetId: string | null; kind: "nao-conferido" | "nao-localizado" | "outro-ambiente" | "nao-esperado"; hasAction: boolean; hasEvidence: boolean }

export function divergences(expected: readonly Expected[], counts: readonly Count[], actions: readonly Action[]): Divergence[] {
  const byAsset = new Map(counts.filter((c) => c.assetId).map((c) => [c.assetId!, c]));
  const acted = (c: Count | null, assetId: string | null) => actions.some((a) => (assetId && a.assetId === assetId) || (c && a.countId === c.id));
  const out: Divergence[] = [];
  for (const e of expected) {
    const c = byAsset.get(e.assetId) ?? null;
    if (!c) { out.push({ countId: null, assetId: e.assetId, kind: "nao-conferido", hasAction: false, hasEvidence: false }); continue; }
    // Coerência: "localizado" em ambiente diferente do esperado é tratado como outro-ambiente.
    const kind = c.result === "localizado" && e.expectedSpace && c.foundSpace && c.foundSpace !== e.expectedSpace ? "outro-ambiente" : c.result;
    if (kind !== "localizado") out.push({ countId: c.id, assetId: e.assetId, kind: kind as Divergence["kind"], hasAction: acted(c, e.assetId), hasEvidence: c.hasEvidence });
  }
  for (const c of counts.filter((x) => !x.assetId)) out.push({ countId: c.id, assetId: null, kind: "nao-esperado", hasAction: acted(c, null), hasEvidence: c.hasEvidence });
  return out;
}

export function canClose(input: { team: readonly string[]; counters: readonly string[]; closer: string; divergences: readonly Divergence[] }) {
  if (input.team.includes(input.closer) || input.counters.includes(input.closer)) return { ok: false as const, reason: "Encerramento por pessoa fora da equipe." };
  if (input.divergences.some((d) => d.kind === "nao-conferido")) return { ok: false as const, reason: "Há bens esperados não conferidos." };
  if (input.divergences.some((d) => !d.hasAction)) return { ok: false as const, reason: "Há divergência sem providência registrada." };
  return { ok: true as const };
}

export function summary(expected: readonly Expected[], d: readonly Divergence[]) {
  const n = (k: Divergence["kind"]) => d.filter((x) => x.kind === k).length;
  return { expected: expected.length, located: expected.length - n("nao-conferido") - n("nao-localizado") - n("outro-ambiente"), notChecked: n("nao-conferido"),
    notLocated: n("nao-localizado"), otherSpace: n("outro-ambiente"), unexpected: n("nao-esperado") };
}
/** Inventário não escreve na cadeia do bem. */
export const INVENTORY_ASSET_WRITES: readonly string[] = [];
