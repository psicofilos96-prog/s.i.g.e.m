/**
 * SIGEM 2.0 — A&A Lote 05: planejamento e editor de avaliações institucionais.
 * Núcleo puro sobre o banco de itens (Lote 04) e a edição/programa (0179).
 * Nunca grava: produz planos e versões para o writer canônico, com base esperada.
 * Versão aplicada é congelada; caderno é permutação determinística por semente;
 * gabarito só sai pela visão restrita; adaptação só se aprovada por outra pessoa.
 */
import { statusOf, type ReviewEvent, type BankMeta } from "./aa-item-bank";

export type PlanVersion = {
  planId: string; version: number; supersedes: string | null; editionId: string;
  objective: string; audience: { stage: string; year: string | null; components: string[] };
  skillRefIds: string[]; instrumentKind: "impresso" | "digital" | "hibrido";
  schedule: { step: string; on: string; sourceDoc: string | null }[];
  criteria: string; responsibles: { engagementId: string; role: string }[];
  authorPersonId: string; recordedAt: string;
};

export function planProblems(p: PlanVersion): string[] {
  const out: string[] = [];
  if (!p.objective.trim()) out.push("objetivo obrigatório");
  if (!p.audience.stage) out.push("etapa obrigatória");
  if (!p.audience.components.length) out.push("componente obrigatório");
  if (!p.skillRefIds.length) out.push("habilidade obrigatória");
  if (!p.criteria.trim()) out.push("critérios obrigatórios");
  if (!p.responsibles.length) out.push("responsável (atuação) obrigatório");
  for (const s of p.schedule) if (!/^\d{4}-\d{2}-\d{2}$/.test(s.on)) out.push(`data inválida em "${s.step}"`);
  const dates = p.schedule.map((s) => s.on); if ([...dates].sort().join() !== dates.join()) out.push("cronograma fora de ordem");
  return out;
}

export type Slot = { itemVersionId: string; points: number | null; section: string | null };
export type Booklet = { letter: string; seed: string; shuffleItems: boolean; shuffleOptions: boolean };
export type Adaptation = { id: string; kind: string; description: string; requestedBy: string; approvedBy: string | null };
export type EditorVersion = {
  instrumentId: string; version: number; supersedes: string | null; planId: string;
  title: string; instructions: string; slots: Slot[]; booklets: Booklet[]; adaptations: Adaptation[];
  mode: "impresso" | "digital" | "hibrido"; appliedOn: string | null; authorPersonId: string;
};

/** Operações do editor visual: puras, devolvem nova lista. */
export const moveSlot = (s: readonly Slot[], from: number, to: number) => { const c = [...s]; const [x] = c.splice(from, 1); if (x) c.splice(Math.max(0, Math.min(to, c.length)), 0, x); return c; };
export const addSlot = (s: readonly Slot[], id: string) => s.some((x) => x.itemVersionId === id) ? [...s] : [...s, { itemVersionId: id, points: null, section: null }];
export const setPoints = (s: readonly Slot[], i: number, p: number | null) => s.map((x, k) => (k === i ? { ...x, points: p } : x));
export const totalPoints = (s: readonly Slot[]) => s.some((x) => x.points == null) ? null : s.reduce((a, x) => a + (x.points as number), 0);

export function editorProblems(v: EditorVersion, bank: { events: readonly ReviewEvent[]; meta: ReadonlyMap<string, BankMeta> }): string[] {
  const out: string[] = [];
  if (!v.slots.length) out.push("nenhum item selecionado");
  for (const s of v.slots) {
    if (statusOf(bank.events, s.itemVersionId) !== "aprovado") out.push(`item ${s.itemVersionId} não aprovado no banco`);
    if (!bank.meta.get(s.itemVersionId)?.rights?.allowsReuse) out.push(`item ${s.itemVersionId} sem direito de reuso`);
    if (s.points == null) out.push(`item ${s.itemVersionId} sem pontuação (ausente não é zero)`);
  }
  const letters = v.booklets.map((b) => b.letter);
  if (!letters.length) out.push("ao menos um caderno");
  if (new Set(letters).size !== letters.length) out.push("cadernos com letra repetida");
  for (const b of v.booklets) if ((b.shuffleItems || b.shuffleOptions) && !b.seed) out.push(`caderno ${b.letter}: embaralhar exige semente declarada`);
  for (const a of v.adaptations) {
    if (!a.approvedBy) out.push(`adaptação ${a.kind} não aprovada`);
    else if (a.approvedBy === a.requestedBy) out.push(`adaptação ${a.kind}: aprovador deve ser distinto do solicitante`);
  }
  return out;
}

/** Nova versão: só sobre a cabeça esperada e nunca sobre versão aplicada. */
export function nextVersion(head: EditorVersion | null, expectedHead: number | null, draft: Omit<EditorVersion, "version" | "supersedes" | "appliedOn">):
  { ok: true; version: EditorVersion } | { ok: false; reason: string } {
  if ((head?.version ?? null) !== expectedHead) return { ok: false, reason: "base esperada divergente" };
  if (head?.appliedOn) return { ok: false, reason: "versão aplicada é imutável — duplicar como novo instrumento" };
  return { ok: true, version: { ...draft, version: (head?.version ?? 0) + 1, supersedes: head ? `${head.instrumentId}@${head.version}` : null, appliedOn: null } };
}

/** PRNG determinístico (mulberry32 sobre hash FNV da semente). */
function rng(seed: string) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = <T,>(xs: readonly T[], r: () => number) => { const c = [...xs]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [c[i], c[j]] = [c[j]!, c[i]!]; } return c; };

export type PrintedQuestion = { number: number; itemVersionId: string; optionOrder: string[] | null; points: number };
/** Caderno impresso: sem gabarito; mesma semente ⇒ mesma prova (fidelidade PDF/digital). */
export function bookletLayout(v: EditorVersion, letter: string, optionKeys: ReadonlyMap<string, string[]>, fixedOrder: ReadonlySet<string>): PrintedQuestion[] | null {
  const b = v.booklets.find((x) => x.letter === letter); if (!b || totalPoints(v.slots) == null) return null;
  const r = rng(`${v.instrumentId}@${v.version}:${b.letter}:${b.seed}`);
  const slots = b.shuffleItems ? shuffle(v.slots, r) : v.slots;
  return slots.map((s, i) => { const keys = optionKeys.get(s.itemVersionId) ?? null;
    return { number: i + 1, itemVersionId: s.itemVersionId, points: s.points as number,
      optionOrder: keys && b.shuffleOptions && !fixedOrder.has(s.itemVersionId) ? shuffle(keys, r) : keys }; });
}

/** Gabarito por caderno: só para quem tem a capacidade restrita. */
export function bookletAnswerKey(layout: readonly PrintedQuestion[], keys: ReadonlyMap<string, string>, caps: ReadonlySet<string>) {
  if (!caps.has("ver-gabarito-avaliacao-institucional")) return { refused: "sem capacidade ver-gabarito-avaliacao-institucional" as const };
  return { lines: layout.map((q) => { const k = keys.get(q.itemVersionId) ?? null; if (k == null) return { number: q.number, key: null };
    const letters = "ABCDEFGHIJ"; const pos = q.optionOrder ? q.optionOrder.indexOf(k) : -1; return { number: q.number, key: pos >= 0 ? letters[pos]! : k }; }) };
}
