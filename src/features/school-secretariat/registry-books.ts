// SIGEM 2.0 — Lote 2/4: escrituração escolar (núcleo puro).
// Livro = projeção ordenada de fatos canônicos (matrícula, resultado final, ata, transferência).
// Lançamento nunca é digitado: referencia o fato de origem. Fechado ⇒ imutável; correção só por retificação anexada.

export type BookKind = "matricula" | "resultados-finais" | "atas" | "transferencias";
export interface SourceFact { ref: string; kind: BookKind; schoolId: string; effectiveOn: string | null; fields: Record<string, string | number | null> }
export interface BookEntry { seq: number; factRef: string; effectiveOn: string; fields: Record<string, string | number>; rectifies?: number; reason?: string; actorPrincipalId: string }
export interface Book { id: string; kind: BookKind; schoolId: string; year: number; requiredFields: string[]; entries: BookEntry[]; closedAt: string | null; closedBy: string | null; closingHash: string | null }

export type Res<T> = { ok: true; value: T } | { ok: false; code: string; missing?: string[] };

/** Lança fato: mesma escola e tipo, data efetiva e todos os campos exigidos presentes (ausente nunca vira zero). */
export function appendEntry(book: Book, fact: SourceFact, actorPrincipalId: string): Res<Book> {
  if (book.closedAt) return { ok: false, code: "book:closed" };
  if (fact.kind !== book.kind) return { ok: false, code: "book:wrong-kind" };
  if (fact.schoolId !== book.schoolId) return { ok: false, code: "book:other-school" };
  if (!fact.effectiveOn) return { ok: false, code: "book:date-missing" };
  if (book.entries.some((e) => e.factRef === fact.ref && e.rectifies == null)) return { ok: false, code: "book:duplicate-fact" };
  const missing = book.requiredFields.filter((f) => fact.fields[f] == null || fact.fields[f] === "");
  if (missing.length) return { ok: false, code: "book:fields-missing", missing };
  const fields = Object.fromEntries(book.requiredFields.map((f) => [f, fact.fields[f] as string | number]));
  return { ok: true, value: { ...book, entries: [...book.entries, { seq: book.entries.length + 1, factRef: fact.ref, effectiveOn: fact.effectiveOn, fields, actorPrincipalId }] } };
}

/** Fecha o livro com termo: autor registrado e hash dos lançamentos. */
export function closeBook(book: Book, at: string, actorPrincipalId: string, hash: (s: string) => string): Res<Book> {
  if (book.closedAt) return { ok: false, code: "book:closed" };
  if (!actorPrincipalId) return { ok: false, code: "book:actor-required" };
  return { ok: true, value: { ...book, closedAt: at, closedBy: actorPrincipalId, closingHash: hash(canonical(book.entries)) } };
}

/** Retificação após fechamento: novo lançamento que aponta o original, com motivo e a partir de fato corrigido. */
export function rectify(book: Book, originalSeq: number, corrected: SourceFact, reason: string, actorPrincipalId: string): Res<Book> {
  const orig = book.entries.find((e) => e.seq === originalSeq);
  if (!orig) return { ok: false, code: "book:entry-unknown" };
  if (!reason.trim()) return { ok: false, code: "book:reason-required" };
  if (corrected.ref !== orig.factRef) return { ok: false, code: "book:fact-mismatch" };
  const missing = book.requiredFields.filter((f) => corrected.fields[f] == null || corrected.fields[f] === "");
  if (missing.length || !corrected.effectiveOn) return { ok: false, code: "book:fields-missing", missing };
  const fields = Object.fromEntries(book.requiredFields.map((f) => [f, corrected.fields[f] as string | number]));
  return { ok: true, value: { ...book, entries: [...book.entries, { seq: book.entries.length + 1, factRef: orig.factRef, effectiveOn: corrected.effectiveOn, fields, rectifies: originalSeq, reason, actorPrincipalId }] } };
}

/** Integridade: lançamentos originais (até o fechamento) continuam com o mesmo hash. */
export function verifyClosing(book: Book, hash: (s: string) => string): boolean | null {
  if (!book.closedAt || !book.closingHash) return null;
  const upTo = book.entries.filter((e) => e.rectifies == null || e.seq <= countAtClose(book));
  return hash(canonical(upTo.slice(0, countAtClose(book)))) === book.closingHash;
}
function countAtClose(book: Book) { return book.entries.findIndex((e) => e.rectifies != null && e.seq > 0) === -1 ? book.entries.length : book.entries.findIndex((e) => e.rectifies != null); }

/** Visão vigente: última retificação de cada lançamento prevalece; original continua no livro. */
export function currentView(book: Book): BookEntry[] {
  const latest = new Map<number, BookEntry>();
  for (const e of book.entries) latest.set(e.rectifies ?? e.seq, e);
  return [...latest.entries()].sort((a, b) => a[0] - b[0]).map(([, e]) => e);
}

const canonical = (entries: BookEntry[]) => JSON.stringify(entries.map((e) => [e.seq, e.factRef, e.effectiveOn, Object.entries(e.fields).sort(), e.rectifies ?? null, e.reason ?? null]));
