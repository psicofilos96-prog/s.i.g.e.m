/**
 * Alimentação Lote 08 — estoques escolares, remessas e logística (modelo puro).
 * Estoque escolar é o MESMO livro (meal_inventory_movements) com depósito = escola; transferência
 * gravada só por record_meal_stock_transfer. Remessa liga UMA saída → trânsito → UM recebimento
 * (aceito/parcial/recusado), de modo que a quantidade nunca existe em dois depósitos ao mesmo tempo.
 * Veículo só se cadastrado (transport-fleet); nada é inventado.
 */
export type ShipState = "programada" | "em-transito" | "recebida" | "recebida-parcial" | "recusada" | "cancelada";
export interface ShipLine { itemId: string; lot: string; qty: number; needsCold: boolean }
export interface Shipment {
  id: string; origin: string; destination: string; responsibleId: string; vehicleId: string | null;
  plannedOn: string; state: ShipState; lines: ShipLine[]; dispatchProof: string | null;
}
export interface CheckLine { itemId: string; lot: string; receivedQty: number; packagingOk: boolean | null; tempC: number | null; refused: boolean; note: string }
export interface Receipt { at: string; checkerId: string; checkerIsPerson: boolean; lines: CheckLine[] }

export function programProblems(s: Shipment, knownVehicles: string[]): string[] {
  const p: string[] = [];
  if (s.origin === s.destination) p.push("origem e destino iguais");
  if (!s.responsibleId) p.push("responsável obrigatório");
  if (s.vehicleId && !knownVehicles.includes(s.vehicleId)) p.push("veículo não cadastrado");
  if (!s.lines.length) p.push("remessa sem itens");
  for (const l of s.lines) if (!(l.qty > 0)) p.push(`${l.itemId}/${l.lot}: quantidade inválida`);
  return p;
}

const NEXT: Record<ShipState, ShipState[]> = { programada: ["em-transito", "cancelada"], "em-transito": ["recebida", "recebida-parcial", "recusada"], recebida: [], "recebida-parcial": [], recusada: [], cancelada: [] };

export function dispatch(s: Shipment, proof: string | null): Shipment | { error: string } {
  if (!NEXT[s.state].includes("em-transito")) return { error: `não sai de ${s.state}` };
  if (!proof) return { error: "saída exige comprovante (guia/romaneio)" };
  return { ...s, state: "em-transito", dispatchProof: proof };
}

/** Conferência: limites de temperatura só de parâmetro configurado; sem ele, temperatura é só registrada. */
export function receive(s: Shipment, r: Receipt, cold: { maxC: number } | null) {
  if (s.state !== "em-transito") return { error: "só remessa em trânsito pode ser conferida" } as const;
  if (!r.checkerIsPerson) return { error: "conferência exige pessoa natural" } as const;
  const lines = s.lines.map((l) => {
    const c = r.lines.find((x) => x.itemId === l.itemId && x.lot === l.lot);
    if (!c) return { ...l, accepted: 0, returned: l.qty, quarantine: 0, divergence: "item não conferido" };
    const notes: string[] = [];
    if (c.receivedQty > l.qty) notes.push(`recebido ${c.receivedQty} acima do enviado ${l.qty}`);
    let quarantine = 0;
    if (l.needsCold) {
      if (c.tempC == null) notes.push("temperatura não aferida");
      else if (cold && c.tempC > cold.maxC) { notes.push(`temperatura ${c.tempC}°C acima de ${cold.maxC}°C`); quarantine = Math.min(c.receivedQty, l.qty); }
      else if (!cold) notes.push("limite de temperatura não configurado (só registrado)");
    }
    if (c.packagingOk === false && !quarantine) { notes.push("embalagem danificada"); quarantine = Math.min(c.receivedQty, l.qty); }
    if (c.refused && !c.note.trim()) notes.push("recusa sem motivo (exigido)");
    const got = Math.min(c.receivedQty, l.qty);
    const accepted = c.refused ? 0 : got - quarantine;
    const returned = l.qty - accepted - quarantine;
    if (got < l.qty) notes.push(`falta ${l.qty - got}`);
    return { ...l, accepted, returned, quarantine, divergence: notes.join("; ") || null };
  });
  if (r.lines.some((c) => c.refused && !c.note.trim())) return { error: "recusa exige motivo" } as const;
  const total = lines.reduce((a, l) => a + l.accepted, 0);
  const state: ShipState = total === 0 ? "recusada" : lines.every((l) => l.accepted === l.qty) ? "recebida" : "recebida-parcial";
  // Conservação: enviado = aceito + quarentena + devolvido (nada duplica, nada some).
  const conserved = lines.every((l) => l.accepted + l.quarantine + l.returned === l.qty);
  return { state, lines, conserved, at: r.at, checkerId: r.checkerId };
}

/** Movimentos derivados para o writer: saída na origem, entrada no destino só do aceito; devolução volta à origem. */
export function ledgerMoves(s: Shipment, rec: Exclude<ReturnType<typeof receive>, { error: string }>) {
  return rec.lines.flatMap((l) => [
    { depot: s.origin, itemId: l.itemId, lot: l.lot, delta: -l.qty, ref: `${s.id}:saida` },
    l.accepted ? { depot: s.destination, itemId: l.itemId, lot: l.lot, delta: l.accepted, ref: `${s.id}:recebimento` } : null,
    l.quarantine ? { depot: `${s.destination}#quarentena`, itemId: l.itemId, lot: l.lot, delta: l.quarantine, ref: `${s.id}:quarentena` } : null,
    l.returned ? { depot: s.origin, itemId: l.itemId, lot: l.lot, delta: l.returned, ref: `${s.id}:devolucao` } : null,
  ].filter(Boolean));
}

/** Visão rápida da equipe escolar: o que chega, o que está em quarentena, divergências abertas. */
export function schoolQuickView(schoolId: string, ships: Shipment[], quarantine: { itemId: string; qty: number }[]) {
  const mine = ships.filter((s) => s.destination === schoolId);
  return {
    arriving: mine.filter((s) => s.state === "programada" || s.state === "em-transito").map((s) => ({ id: s.id, plannedOn: s.plannedOn, state: s.state, items: s.lines.length })),
    partial: mine.filter((s) => s.state === "recebida-parcial" || s.state === "recusada").map((s) => s.id),
    quarantine,
  };
}
