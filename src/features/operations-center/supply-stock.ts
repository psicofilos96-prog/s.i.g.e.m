/**
 * Centro de Operações — L13: almoxarifado de consumo (migration 0420).
 * Material de consumo (catálogo `ops_supply_item_versions`, aprovado por pessoa ≠ autor, unidade imutável entre versões)
 * é separado de bem permanente (L09) e do estoque de alimentação do NAE (não duplicado). Depósito por escola.
 * Movimentos append-only: entrada (com documento de origem), saída (com destino), ajustes/descarte/estorno (motivo).
 * Lote/validade só quando o item exige; saída de lote vencido recusada (vencido sai por descarte).
 * Saldo = projeção de movimentos válidos (estorno anula o original, nunca apaga) e nunca negativo.
 */
export type MovementKind = "entrada" | "saida" | "ajuste-entrada" | "ajuste-saida" | "descarte" | "estorno" | "transferencia-saida" | "transferencia-entrada";
export interface Movement { id: string; itemKey: string; kind: MovementKind; quantity: number; lot: string | null; expiresOn: string | null; occurredOn: string; reversesId: string | null }

const sign = (k: MovementKind) => (k === "entrada" || k === "ajuste-entrada" || k === "transferencia-entrada" ? 1 : -1);
export function validMovements(ms: readonly Movement[]): Movement[] {
  const reversed = new Set(ms.filter((m) => m.kind === "estorno" && m.reversesId).map((m) => m.reversesId!));
  return ms.filter((m) => m.kind !== "estorno" && !reversed.has(m.id));
}
export function balance(ms: readonly Movement[], itemKey: string, opts: { lot?: string | null; asOf?: string } = {}): number {
  return validMovements(ms).filter((m) => m.itemKey === itemKey && (opts.lot === undefined || m.lot === opts.lot) && (!opts.asOf || m.occurredOn <= opts.asOf))
    .reduce((s, m) => s + sign(m.kind) * m.quantity, 0);
}
export function lotBalances(ms: readonly Movement[], itemKey: string, today: string) {
  const lots = new Map<string, string | null>();
  for (const m of validMovements(ms)) if (m.itemKey === itemKey && m.lot) lots.set(m.lot, m.expiresOn ?? lots.get(m.lot) ?? null);
  return [...lots].map(([lot, expiresOn]) => ({ lot, expiresOn, quantity: balance(ms, itemKey, { lot }), expired: expiresOn !== null && expiresOn < today }))
    .filter((l) => l.quantity !== 0).sort((a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"));
}

export interface ItemPolicy { tracksLot: boolean; tracksExpiry: boolean; approved: boolean; active: boolean }
/** Espelha `record_ops_supply_movement`; o banco é a garantia. */
export function canMove(item: ItemPolicy, ms: readonly Movement[], d: { itemKey: string; kind: Exclude<MovementKind, "estorno">; quantity: number; lot: string | null; expiresOn: string | null; on: string; hasDoc?: boolean; destination?: string; reason?: string }) {
  if (!item.approved || !item.active) return { ok: false as const, reason: "Material não aprovado ou inativo." };
  if (!(d.quantity > 0)) return { ok: false as const, reason: "Quantidade inválida." };
  if (item.tracksLot !== (d.lot !== null)) return { ok: false as const, reason: item.tracksLot ? "Lote obrigatório." : "Material não controla lote." };
  if (d.kind === "entrada" && !d.hasDoc) return { ok: false as const, reason: "Entrada exige documento de origem." };
  if (d.kind === "saida" && (d.destination ?? "").trim().length < 3) return { ok: false as const, reason: "Saída exige destino." };
  if (d.kind !== "entrada" && d.kind !== "saida" && (d.reason ?? "").trim().length < 10) return { ok: false as const, reason: "Motivo obrigatório." };
  if (d.kind === "entrada" || d.kind === "ajuste-entrada") {
    if (item.tracksExpiry && !d.expiresOn) return { ok: false as const, reason: "Validade obrigatória." };
    return { ok: true as const };
  }
  const exp = d.lot ? ms.find((m) => m.lot === d.lot && m.expiresOn)?.expiresOn ?? null : null;
  if (d.kind === "saida" && exp && exp < d.on) return { ok: false as const, reason: "Lote vencido só sai por descarte." };
  if (balance(ms, d.itemKey, d.lot ? { lot: d.lot } : {}) - d.quantity < 0) return { ok: false as const, reason: "Saldo insuficiente." };
  return { ok: true as const };
}
export const SUPPLY_WRITERS = ["register_ops_supply_item", "approve_ops_supply_item", "register_ops_warehouse", "record_ops_supply_movement"] as const;
