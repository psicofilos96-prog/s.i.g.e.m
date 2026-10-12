/**
 * Centro de Operações — L14: transações do almoxarifado (migration 0421).
 * - Idempotência estrita: mesma chave com conteúdo diferente ⇒ `opssm:idempotency-mismatch` (nunca devolve outro fato).
 * - Concorrência: lock por depósito+item no núcleo `ops_supply_insert`; transferência trava os dois depósitos em ordem fixa.
 * - Saldo negativo recusado no banco; ajuste só por solicitação + autorização de pessoa ≠ solicitante, sobre o saldo
 *   observado na solicitação (mudou ⇒ `stale-balance`), gerando UM movimento ligado ao ajuste.
 * - Transferência = par atômico saída/entrada com o mesmo grupo; a soma da rede não muda.
 * - Alimentação: categorias de gênero alimentício são recusadas no catálogo; o saldo oficial delas é só o livro do NAE.
 */
import { balance, type Movement } from "./supply-stock";

export interface AdjustmentRequest { requesterPerson: string; balanceAtRequest: number; direction: "entrada" | "saida"; quantity: number }
export function canDecideAdjustment(a: AdjustmentRequest, approver: string, currentBalance: number, decision: "aprovado" | "recusado", decisionRef: string, note = "") {
  if (approver === a.requesterPerson) return { ok: false as const, reason: "Solicitante não autoriza o próprio ajuste." };
  if (decisionRef.trim().length < 3) return { ok: false as const, reason: "Exige referência da decisão." };
  if (decision === "recusado") return note.trim().length >= 10 ? { ok: true as const } : { ok: false as const, reason: "Recusa exige justificativa." };
  if (currentBalance !== a.balanceAtRequest) return { ok: false as const, reason: "Saldo mudou desde a solicitação; refaça a contagem." };
  if (a.direction === "saida" && currentBalance - a.quantity < 0) return { ok: false as const, reason: "Ajuste deixaria saldo negativo." };
  return { ok: true as const };
}

export interface IdemRecord { key: string; warehouseId: string; itemKey: string; kind: string; quantity: number; actor: string }
/** Mesmo pedido ⇒ mesmo fato; conteúdo diferente com a mesma chave ⇒ recusa. */
export function idempotent(existing: IdemRecord | undefined, req: IdemRecord): "novo" | "repetido" | "conflito" {
  if (!existing) return "novo";
  const same = existing.warehouseId === req.warehouseId && existing.itemKey === req.itemKey && existing.kind === req.kind && existing.quantity === req.quantity && existing.actor === req.actor;
  return same ? "repetido" : "conflito";
}

/** Aplica pedidos concorrentes em série (como o lock do banco): o que excede o saldo é recusado. */
export function serialize(ms: Movement[], itemKey: string, requests: readonly { id: string; quantity: number }[]) {
  const out: { id: string; ok: boolean }[] = [];
  for (const r of requests) {
    const ok = balance(ms, itemKey) - r.quantity >= 0;
    if (ok) ms.push({ id: r.id, itemKey, kind: "saida", quantity: r.quantity, lot: null, expiresOn: null, occurredOn: "2026-10-12", reversesId: null });
    out.push({ id: r.id, ok });
  }
  return out;
}

export const isFoodCategory = (c: string) => /(aliment|g[eê]nero|merenda)/i.test(c);
export const SUPPLY_TX_WRITERS = ["record_ops_supply_movement", "request_ops_supply_adjustment", "decide_ops_supply_adjustment", "transfer_ops_supply"] as const;
