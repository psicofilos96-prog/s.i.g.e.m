/**
 * Autoria de avaliações do professor — modelo puro.
 * Tipos de item vêm de registro aberto; o banco aceita qualquer identificador e a tela usa só o que estiver registrado.
 * Não há peso, escala nem fórmula: resultado continua no motor existente (Pauta), ligado opcionalmente pelo id do instrumento.
 * Conteúdo é texto puro renderizado com escape do React; nada é interpretado como HTML.
 * Gerador automático de itens: só interface (`ItemSuggestionProvider`), sem implementação.
 */
export type ItemOption = { key: string; text: string };
export type ItemTypeDef = Readonly<{ id: string; label: string; usesOptions: boolean; answerHint: string }>;

const registry = new Map<string, ItemTypeDef>();
export const registerItemType = (d: ItemTypeDef) => { if (registry.has(d.id)) throw new Error(`tipo duplicado: ${d.id}`); registry.set(d.id, d); };
export const itemType = (id: string) => registry.get(id) ?? null;
export const itemTypes = () => [...registry.values()];
registerItemType({ id: "escolha", label: "Escolha entre alternativas", usesOptions: true, answerHint: "Alternativa(s) correta(s)" });
registerItemType({ id: "resposta-curta", label: "Resposta curta", usesOptions: false, answerHint: "Resposta esperada" });
registerItemType({ id: "discursiva", label: "Discursiva", usesOptions: false, answerHint: "Critério de correção" });

/** Interface de extensão para sugestão de itens; não há provedor registrado neste bloco. */
export interface ItemSuggestionProvider { id: string; suggest(input: { refIds: string[] }): Promise<never> }

export type ItemVersion = Readonly<{
  id: string; item_id: string; version: number; supersedes_id: string | null; item_type_id: string; stem: string;
  options: unknown; curricular_refs: unknown; school_id: string; visibility: "pessoal" | "compartilhado"; status: "rascunho" | "publicado";
  key_shared: boolean; copied_from_version_id: string | null; author_user_id: string; recorded_at: string;
}>;
export type InstrumentVersion = Readonly<{
  id: string; instrument_id: string; version: number; supersedes_id: string | null; assignment_id: string; class_id: string; school_id: string;
  period_id: string | null; title: string; instructions: string | null; items: unknown; randomization: unknown;
  status: "rascunho" | "publicado"; results_instrument_id: string | null; author_user_id: string; recorded_at: string;
}>;

export const heads = <T extends { id: string; supersedes_id: string | null }>(rows: readonly T[]) => {
  const sup = new Set(rows.map((r) => r.supersedes_id).filter(Boolean)); return rows.filter((r) => !sup.has(r.id));
};
export function parseOptions(v: unknown): ItemOption[] {
  return Array.isArray(v) ? v.flatMap((o: any) => (o && typeof o.key === "string" && typeof o.text === "string" ? [{ key: o.key, text: o.text }] : [])) : [];
}
export const parseRefIds = (v: unknown): string[] => Array.isArray(v) ? v.flatMap((r: any) => (r?.kind === "reference-item" && typeof r.item_id === "string" ? [r.item_id] : [])) : [];
export const parseInstrumentItems = (v: unknown): string[] => Array.isArray(v) ? v.flatMap((x: any) => (typeof x?.item_version_id === "string" ? [x.item_version_id] : [])) : [];

/** Habilidade removida da base em edição futura: a versão antiga mantém o ID; a tela mostra como "não encontrada na base atual". */
export const refStatus = (refIds: readonly string[], known: ReadonlySet<string>) => refIds.map((id) => ({ id, found: known.has(id) }));

export type Randomization = { seed: string; shuffleItems: boolean; shuffleOptions: boolean };
export function parseRandomization(v: unknown): Randomization | null {
  const r = v as any; return r && typeof r.seed === "string" && r.seed ? { seed: r.seed, shuffleItems: !!r.shuffleItems, shuffleOptions: !!r.shuffleOptions } : null;
}
function rng(seed: string) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
export function shuffled<T>(xs: readonly T[], seed: string): T[] { const a = [...xs]; const r = rng(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }

export type PrintQuestion = { number: number; itemVersionId: string; typeLabel: string; stem: string; options: ItemOption[] };
/** Projeção de impressão: só enunciado/alternativas; gabarito nunca entra. Ordem só muda com randomização explícita. */
export function printProjection(ins: InstrumentVersion, items: ReadonlyMap<string, ItemVersion>) {
  const ids = parseInstrumentItems(ins.items); const rz = parseRandomization(ins.randomization);
  const missing = ids.filter((id) => !items.has(id));
  const order = rz?.shuffleItems ? shuffled(ids, rz.seed) : ids;
  const questions: PrintQuestion[] = order.filter((id) => items.has(id)).map((id, i) => {
    const it = items.get(id)!; const opts = parseOptions(it.options);
    return { number: i + 1, itemVersionId: id, typeLabel: itemType(it.item_type_id)?.label ?? it.item_type_id, stem: it.stem, options: rz?.shuffleOptions ? shuffled(opts, `${rz.seed}:${id}`) : opts };
  });
  return { title: ins.title, instructions: ins.instructions, instrumentVersionId: ins.id, version: ins.version, questions, missing };
}
/** Versões embaralhadas (A, B, C…): só depois que a OP aprovou ESTA versão do instrumento; cada letra deriva da semente declarada, então a mesma letra sempre imprime igual. */
export const VARIANT_LETTERS = "ABCDEFGH";
export function variantProjection(ins: InstrumentVersion, items: ReadonlyMap<string, ItemVersion>, letter: string | null, approvedForThisVersion: boolean) {
  if (!letter) return { ok: true as const, p: printProjection(ins, items) };
  if (!approvedForThisVersion) return { ok: false as const, reason: "Versões embaralhadas só depois da aprovação da OP para esta versão." };
  if (!VARIANT_LETTERS.includes(letter) || letter.length !== 1) return { ok: false as const, reason: "Letra de versão inválida." };
  const base = parseRandomization(ins.randomization)?.seed ?? ins.id;
  const p = printProjection({ ...ins, randomization: { seed: `${base}:${letter}`, shuffleItems: true, shuffleOptions: true } }, items);
  return { ok: true as const, p: { ...p, variant: letter } };
}
export const canonicalPrint = (p: ReturnType<typeof printProjection>) => JSON.stringify([p.instrumentVersionId, p.title, p.instructions, p.questions.map((q) => [q.itemVersionId, q.stem, q.options])]);
export async function printFingerprint(p: ReturnType<typeof printProjection>) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalPrint(p)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const MESSAGES: Record<string, string> = {
  "item:no-session": "Entre novamente para continuar.",
  "item:no-current-assignment-in-school": "Você precisa de regência vigente nesta escola para criar itens.",
  "item:stale-head": "Alterado em outra janela. Recarregue antes de salvar.",
  "item:not-author": "Só quem criou pode alterar.",
  "item:copy-source-not-readable": "Você não tem acesso ao item de origem.",
  "item:reference-item-unknown": "Uma habilidade escolhida não existe na base curricular.",
  "item:invalid-options": "Alternativas inválidas: use letras/números curtos e texto preenchido.",
  "instrument:assignment-not-current": "A regência não está vigente para você hoje.",
  "instrument:item-not-published": "Só itens publicados podem entrar num instrumento.",
  "instrument:item-not-readable": "Um item do instrumento não está acessível a você.",
  "instrument:published-frozen": "Instrumento publicado está congelado. Faça uma cópia para alterar.",
  "instrument:empty": "Inclua ao menos um item antes de publicar.",
  "instrument:results-instrument-mismatch": "O instrumento de resultados não é desta turma.",
  "instrument:invalid-randomization": "Randomização exige uma semente.",
};
export const authoringMessage = (raw: string) => { const k = Object.keys(MESSAGES).find((m) => raw.includes(m)); return k ? MESSAGES[k]! : "Não foi possível concluir. Tente novamente."; };
