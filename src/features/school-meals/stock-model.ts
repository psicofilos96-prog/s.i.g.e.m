// NAE.4 — modelo puro do estoque: saldo derivado do ledger (nunca armazenado), carry-forward mensal,
// conversão só por fator homologado, consumo teórico como análise (nunca movimento), PVPS só como sugestão.
import type { ReportDefinition } from "@/features/reports/report-engine";

export const UNKNOWN = "UNKNOWN" as const;
export type Known<T> = T | typeof UNKNOWN;
export const STOCK_BASIS_BLOCK = "STOCK_BASIS_POLICY — BLOCKED_BY_HOMOLOGATED_RULE";
export const UNIT_CONVERSION_BLOCK = "UNIT_CONVERSIONS — BLOCKED_BY_HOMOLOGATED_RULE";
export const MINIMUM_STOCK_STATE = "MINIMUM_STOCK — NOT_CONFIGURED";

export interface Movement {
  id: string; event_kind: "registro" | "retificacao" | "anulacao"; movement_class: string; sign: -1 | 0 | 1 | null;
  item_value_id: string; unit_value_id: string; lot: string | null; expires_on: string | null; quantity: number; moved_on: string; superseded: boolean;
}

/** Saldo = soma de movimentos vigentes até a data. Sinal desconhecido ⇒ UNKNOWN; sem movimento ⇒ zero real (nenhum fato o altera). */
export function balanceOn(ms: Movement[], item: string, unit: string, on: string, lot?: string | null): Known<number> {
  let total = 0;
  for (const m of ms) {
    if (m.superseded || m.item_value_id !== item || m.unit_value_id !== unit || m.moved_on > on) continue;
    if (lot !== undefined && m.lot !== lot) continue;
    if (m.sign === null) return UNKNOWN;
    total += m.sign * m.quantity;
  }
  return total;
}

export interface MonthCard { competence: string; opening: Known<number>; entries: number; exits: number; adjustments: number; closing: Known<number> }
const lastDay = (c: string) => { const [y, m] = c.split("-").map(Number); return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10); };
const prevMonthEnd = (c: string) => { const [y, m] = c.split("-").map(Number); return new Date(Date.UTC(y!, m! - 1, 0)).toISOString().slice(0, 10); };
/** Ficha mensal: saldo inicial derivado do fim do mês anterior (carry-forward), nunca digitado. */
export function monthCard(ms: Movement[], item: string, unit: string, competence: string): MonthCard {
  const from = `${competence}-01`, to = lastDay(competence);
  let entries = 0, exits = 0, adjustments = 0;
  for (const m of ms) {
    if (m.superseded || m.item_value_id !== item || m.unit_value_id !== unit || m.moved_on < from || m.moved_on > to || m.sign === 0) continue;
    if (m.movement_class === "ajuste-inventario" || m.sign === null) adjustments += (m.sign ?? 0) * m.quantity;
    else if (m.sign > 0) entries += m.quantity; else exits += m.quantity;
  }
  return { competence, opening: balanceOn(ms, item, unit, prevMonthEnd(competence)), entries, exits, adjustments, closing: balanceOn(ms, item, unit, to) };
}

/** Conversão só com fator homologado; ausente ⇒ UNKNOWN (nunca conversão implícita). */
export function convert(quantity: number, factor: number | null | undefined): Known<number> {
  return factor == null || !(factor > 0) ? UNKNOWN : quantity * factor;
}

/** Consumo teórico = refeições × per capita (homologado). É análise: nunca gera movimento. */
export function theoreticalConsumption(meals: number | null, perCapita: number | null): Known<number> {
  return meals == null || perCapita == null ? UNKNOWN : meals * perCapita;
}
export function observedVsTheoretical(observed: number | null, theoretical: Known<number>): Known<number> {
  return observed == null || theoretical === UNKNOWN ? UNKNOWN : observed - theoretical;
}

/** PVPS: ordena lotes com saldo pelo vencimento (sem data por último). Sugestão; nunca consome sozinho. */
export function suggestLotsByExpiry<T extends { lot: string | null; expires_on: string | null; balance: number | null }>(lines: T[]): T[] {
  return lines.filter((l) => (l.balance ?? 0) > 0).sort((a, b) => (a.expires_on ?? "9999") < (b.expires_on ?? "9999") ? -1 : 1);
}

export const ALERT_LABEL: Record<string, string> = {
  "saldo-negativo": "Saldo calculado negativo", "sinal-desconhecido": "Movimento sem direção (saldo desconhecido)", "validade-proxima": "Validade próxima",
  "aceite-sem-lote": "Entrega aceita sem lote (lote exigido)", "inventario-divergente": "Inventário divergente sem ajuste", "movimento-possivelmente-duplicado": "Movimento possivelmente duplicado",
};

export function stockMessage(raw: string): string {
  if (raw.includes("unit-incompatible")) return "Unidade diferente da já usada para este item. Sem fator homologado não há conversão.";
  if (raw.includes("negative-balance-blocked")) return "A política homologada bloqueia saldo negativo.";
  if (raw.includes("negative-balance-requires-reason")) return "O saldo ficaria negativo: informe o motivo.";
  if (raw.includes("count-not-approved")) return "Ajuste exige contagem conferida (ou aprovada, se a política exigir).";
  if (raw.includes("divergence-requires-justification")) return "Justifique cada diferença entre saldo calculado e físico.";
  if (raw.includes("approver-must-differ")) return "A aprovação deve ser de outra pessoa.";
  if (raw.includes("use-receipt-rectification")) return "Entrada de aceite só se corrige retificando o recebimento.";
  if (raw.includes("transfer-policy-pending")) return "Transferência não permitida sem política homologada.";
  if (raw.includes("inventory-catalog-pending")) return "Item ou unidade sem catálogo homologado.";
  if (raw.includes("stale")) return "Registro atualizado por outra pessoa. Recarregue.";
  if (raw.includes("capability:")) return "Sua atuação não tem permissão para esta ação nesta escola.";
  return "Não foi possível concluir. Tente novamente.";
}

const p = (id: string, label: string) => ({ id, label, type: "date" as const, required: true });
export const FICHA_ESTOQUE_ALIMENTACAO: ReportDefinition = {
  id: "ficha-estoque-alimentacao", version: 1, title: "Ficha de estoque por item e período",
  description: "Movimentos vigentes com classe, lote, validade, origem e trilha aceite→entrada; saldo derivado, nunca digitado.",
  source: "meal_stock_ledger_at", params: [p("from", "De"), p("to", "Até")],
  columns: [
    { id: "date", label: "Data", kind: "date" }, { id: "item", label: "Item", kind: "text" }, { id: "unit", label: "Unidade", kind: "text" },
    { id: "class", label: "Classe", kind: "text" }, { id: "quantity", label: "Quantidade (com sinal)", kind: "number" }, { id: "lot", label: "Lote", kind: "text" },
    { id: "expires", label: "Validade", kind: "date" }, { id: "origin", label: "Origem", kind: "text" }, { id: "event", label: "Evento", kind: "text" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};
export const SALDO_ESTOQUE_ALIMENTACAO: ReportDefinition = {
  id: "saldo-estoque-alimentacao", version: 1, title: "Saldo de estoque por data (lote/validade)",
  description: "Saldo derivado na data informada; sinal desconhecido aparece como não disponível, nunca zero. Sem estoque mínimo configurado.",
  source: "meal_stock_balance_at", params: [p("on", "Em")],
  columns: [
    { id: "item", label: "Item", kind: "text" }, { id: "unit", label: "Unidade", kind: "text" }, { id: "lot", label: "Lote", kind: "text" },
    { id: "expires", label: "Validade", kind: "date" }, { id: "balance", label: "Saldo", kind: "number" }, { id: "movements", label: "Movimentos", kind: "number" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};
