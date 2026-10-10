/**
 * SIA — gabarito por versão (A–H), mapeamento reversível e correção assistida.
 * Puro: o gabarito canônico é o do item (assessment_item_keys); a versão só reordena.
 * Nada é persistido aqui: a correção é proposta, e só vira lançamento após confirmação
 * explícita sobre a MESMA impressão digital aprovada pela OP.
 */
import { variantProjection, type InstrumentVersion, type ItemVersion } from "./authoring-model";

const POS = "ABCDEFGHIJ";
export type VariantMapEntry = { number: number; itemVersionId: string; displayToKey: Record<string, string>; keyToDisplay: Record<string, string> };
export type VariantMap = { instrumentVersionId: string; variant: string; entries: VariantMapEntry[] };

export function variantMap(ins: InstrumentVersion, items: ReadonlyMap<string, ItemVersion>, letter: string, approved: boolean) {
  const r = variantProjection(ins, items, letter, approved);
  if (!r.ok) return r;
  const entries = r.p.questions.map((q) => {
    const displayToKey: Record<string, string> = {}, keyToDisplay: Record<string, string> = {};
    q.options.forEach((o, i) => { const d = POS[i]!; displayToKey[d] = o.key; keyToDisplay[o.key] = d; });
    return { number: q.number, itemVersionId: q.itemVersionId, displayToKey, keyToDisplay };
  });
  return { ok: true as const, map: { instrumentVersionId: ins.id, variant: letter, entries } satisfies VariantMap };
}

/** Gabarito da versão: número → letra exibida. Item sem chave canônica fica ausente (nunca presumido). */
export function variantAnswerKey(map: VariantMap, canonicalKeys: ReadonlyMap<string, string>) {
  const key: Record<number, string | null> = {};
  for (const e of map.entries) { const k = canonicalKeys.get(e.itemVersionId); key[e.number] = k && e.keyToDisplay[k] ? e.keyToDisplay[k]! : null; }
  return key;
}

/** Volta resposta da versão para o item/alternativa canônicos. */
export function toCanonical(map: VariantMap, number: number, displayed: string) {
  const e = map.entries.find((x) => x.number === number);
  if (!e) return null;
  const k = e.displayToKey[displayed.toUpperCase()];
  return k ? { itemVersionId: e.itemVersionId, optionKey: k } : null;
}

export type CorrectionLine = { number: number; itemVersionId: string; answered: string | null; correct: boolean | null; reason?: string };
export function proposeCorrection(map: VariantMap, canonicalKeys: ReadonlyMap<string, string>, answers: Readonly<Record<number, string | null>>) {
  const lines: CorrectionLine[] = map.entries.map((e) => {
    const a = answers[e.number] ?? null; const ck = canonicalKeys.get(e.itemVersionId);
    if (!ck) return { number: e.number, itemVersionId: e.itemVersionId, answered: a, correct: null, reason: "Sem gabarito registrado" };
    if (!a) return { number: e.number, itemVersionId: e.itemVersionId, answered: null, correct: null, reason: "Em branco" };
    const c = toCanonical(map, e.number, a);
    if (!c) return { number: e.number, itemVersionId: e.itemVersionId, answered: a, correct: null, reason: "Alternativa inexistente" };
    return { number: e.number, itemVersionId: e.itemVersionId, answered: a, correct: c.optionKey === ck };
  });
  return { status: "proposta" as const, lines, hits: lines.filter((l) => l.correct === true).length, undetermined: lines.filter((l) => l.correct === null).length };
}

/** Confirmação antes de persistir: exige ato humano e que a impressão atual seja a aprovada pela OP. */
export function confirmCorrection(input: { confirmedByUser: boolean; approvedFingerprint: string | null; currentFingerprint: string }) {
  if (!input.approvedFingerprint) return { ok: false as const, reason: "Instrumento sem aprovação da OP." };
  if (input.approvedFingerprint !== input.currentFingerprint) return { ok: false as const, reason: "Instrumento editado após a aprovação: exige nova aprovação da OP." };
  if (!input.confirmedByUser) return { ok: false as const, reason: "Confirme a correção antes de gravar." };
  return { ok: true as const };
}

/** LOTE 8 — toda linha indeterminada exige decisão humana explícita; sem ela nada é gravável. */
export function finalizeLines(lines: readonly CorrectionLine[], manual: Readonly<Record<number, boolean | undefined>>) {
  const out = lines.map((l) => ({ number: l.number, itemVersionId: l.itemVersionId, answered: l.answered, correct: l.correct ?? manual[l.number] ?? null }));
  const pending = out.filter((l) => l.correct === null).map((l) => l.number);
  if (pending.length) return { ok: false as const, pending };
  return { ok: true as const, lines: out as { number: number; itemVersionId: string; answered: string | null; correct: boolean }[], hits: out.filter((l) => l.correct).length };
}
