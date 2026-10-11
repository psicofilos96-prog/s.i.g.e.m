/**
 * Alimentação Lote 07 — estoque central e inventários (planejamento puro sobre o livro único).
 * Gravação continua SÓ nos writers NAE.4 (record_meal_stock_movement / _transfer / _count / _closing),
 * que já garantem transação, lock, base esperada e idempotência no banco. Este módulo monta o
 * movimento antes de enviar: FEFO, bloqueio sanitário, reservas, saldo não negativo, retificação.
 * Primitivas são genéricas (depósito/item/lote) para reuso por outro setor, sem migrar estoque alheio.
 */
export interface Lot { depot: string; itemId: string; lot: string; expiresOn: string | null; balance: number; blocked: { reason: string } | null; reserved: number }
export interface Entry { id: string; seq: number; kind: "entrada" | "saida" | "perda" | "ajuste" | "estorno"; depot: string; itemId: string; lot: string; qty: number; reason: string | null; reverses: string | null }

/** Disponível = saldo − reservado; vencido ou bloqueado nunca é disponível. */
export function available(l: Lot, on: string): number {
  if (l.blocked || (l.expiresOn != null && l.expiresOn < on)) return 0;
  return Math.max(0, l.balance - l.reserved);
}

/** Saída: FEFO (vence primeiro sai primeiro); lote sem validade vai ao fim. Insuficiente ⇒ recusa inteira. */
export function planExit(lots: Lot[], req: { depot: string; itemId: string; qty: number; on: string; fefo: boolean; lot?: string }):
  { ok: true; picks: { lot: string; qty: number }[] } | { ok: false; reason: string } {
  if (!(req.qty > 0)) return { ok: false, reason: "quantidade inválida" };
  let pool = lots.filter((l) => l.depot === req.depot && l.itemId === req.itemId);
  if (req.lot) {
    const l = pool.find((x) => x.lot === req.lot);
    if (!l) return { ok: false, reason: "lote inexistente no depósito" };
    if (l.blocked) return { ok: false, reason: `lote bloqueado: ${l.blocked.reason}` };
    if (l.expiresOn && l.expiresOn < req.on) return { ok: false, reason: "lote vencido não pode ser consumido" };
    pool = [l];
  } else if (req.fefo) {
    pool = [...pool].sort((a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999") || a.lot.localeCompare(b.lot));
  } else return { ok: false, reason: "sem FEFO, lote deve ser indicado" };
  let rest = req.qty; const picks: { lot: string; qty: number }[] = [];
  for (const l of pool) { const q = Math.min(rest, available(l, req.on)); if (q > 0) { picks.push({ lot: l.lot, qty: q }); rest -= q; } if (!rest) break; }
  if (rest > 0) return { ok: false, reason: `saldo disponível insuficiente (faltam ${rest}); saldo negativo não é permitido` };
  return { ok: true, picks };
}

export function reserve(l: Lot, qty: number, on: string): Lot | { error: string } {
  if (qty > available(l, on)) return { error: "reserva acima do disponível" };
  return { ...l, reserved: l.reserved + qty };
}

export function block(l: Lot, reason: string): Lot | { error: string } {
  if (!reason.trim()) return { error: "bloqueio sanitário exige motivo" };
  return { ...l, blocked: { reason } };
}

export function lossEntry(l: Lot, qty: number, reason: string): Omit<Entry, "id" | "seq"> | { error: string } {
  if (!reason.trim()) return { error: "perda exige justificativa" };
  if (qty > l.balance) return { error: "perda acima do saldo" };
  return { kind: "perda", depot: l.depot, itemId: l.itemId, lot: l.lot, qty, reason, reverses: null };
}

/** Inventário: diferença contada × calculado vira ajuste justificado; aprovador ≠ contador. */
export function inventoryAdjustment(l: Lot, counted: number, a: { reason: string; counterId: string; approverId: string }): Omit<Entry, "id" | "seq"> | null | { error: string } {
  if (!(counted >= 0)) return { error: "contagem inválida" };
  const diff = counted - l.balance;
  if (diff === 0) return null;
  if (!a.reason.trim()) return { error: "ajuste exige justificativa" };
  if (a.counterId === a.approverId) return { error: "aprovador deve ser distinto de quem contou" };
  return { kind: "ajuste", depot: l.depot, itemId: l.itemId, lot: l.lot, qty: diff, reason: a.reason, reverses: null };
}

/** Retificação nunca edita: gera estorno da entrada original; estorno duplo é recusado. */
export function rectify(ledger: Entry[], id: string, reason: string): Omit<Entry, "id" | "seq"> | { error: string } {
  const e = ledger.find((x) => x.id === id);
  if (!e) return { error: "lançamento inexistente" };
  if (e.kind === "estorno") return { error: "estorno não se estorna; lance novo movimento" };
  if (ledger.some((x) => x.reverses === id)) return { error: "lançamento já estornado" };
  if (!reason.trim()) return { error: "retificação exige motivo" };
  return { kind: "estorno", depot: e.depot, itemId: e.itemId, lot: e.lot, qty: -signed(e), reason, reverses: id };
}

export const signed = (e: Pick<Entry, "kind" | "qty">) => (e.kind === "saida" || e.kind === "perda" ? -e.qty : e.qty);

/** Chave determinística: retry da tela não duplica movimento no writer. */
export const idempotencyKey = (op: string, depot: string, itemId: string, lot: string, requestId: string) => `${op}:${depot}:${itemId}:${lot}:${requestId}`;

/** Trilha: seq contínuo e saldo nunca negativo ao reaplicar. */
export function auditTrail(ledger: Entry[]): string[] {
  const p: string[] = []; const bal = new Map<string, number>();
  [...ledger].sort((a, b) => a.seq - b.seq).forEach((e, i) => {
    if (e.seq !== i + 1) p.push(`seq ${e.seq} fora de ordem (esperado ${i + 1})`);
    const k = `${e.depot}|${e.itemId}|${e.lot}`; const v = (bal.get(k) ?? 0) + signed(e);
    if (v < 0) p.push(`saldo negativo em ${k} após seq ${e.seq}`);
    bal.set(k, v);
  });
  return p;
}
