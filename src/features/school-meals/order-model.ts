// NAE.2 — modelo puro do pedido: estados, motor explicável de necessidade/teto (só com regra homologada),
// itens zerados, anomalias configuráveis e linhas de relatório. Nenhum número é fabricado.
import { STATE_REGISTRY, labelsOf } from "@/config/state-presentation";
import type { ReportDefinition, CellValue } from "@/features/reports/report-engine";
import { formatRatioPercent, formatNumber } from "@/lib/format-ptbr";

export type OrderStatus = "rascunho" | "submetido" | "em-analise" | "devolvido" | "autorizado-total" | "autorizado-parcial" | "rejeitado" | "cancelado" | "retificado";
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = labelsOf(STATE_REGISTRY.solicitacao);
/** Espelho das transições aceitas por `record_meal_order` (0183); o banco continua sendo a garantia. */
export type OrderAction = "rascunho" | "submissao" | "analise" | "devolucao" | "autorizacao" | "retificacao" | "rejeicao" | "cancelamento";
export const ORDER_ACTIONS_FROM: Record<OrderStatus, readonly OrderAction[]> = {
  rascunho: ["rascunho", "submissao", "cancelamento"], devolvido: ["rascunho", "submissao", "cancelamento"],
  submetido: ["analise", "devolucao", "autorizacao", "rejeicao", "cancelamento"], "em-analise": ["devolucao", "autorizacao", "rejeicao", "cancelamento"],
  "autorizado-total": ["retificacao"], "autorizado-parcial": ["retificacao"], retificado: ["retificacao"], rejeitado: [], cancelado: [],
};
export const orderAllows = (s: OrderStatus, a: OrderAction) => ORDER_ACTIONS_FROM[s].includes(a);
export const AUTHORIZED: OrderStatus[] = ["autorizado-total", "autorizado-parcial", "retificado"];
export const isAuthorized = (s: OrderStatus) => AUTHORIZED.includes(s);
/** Escola só edita rascunho ou devolvido; submissão congela. */
export const schoolCanEdit = (s: OrderStatus) => orderAllows(s, "submissao");

export interface OrderLine {
  item_ref: string; unidade_ref: string; apresentacao_ref?: string; contrato_ref?: string; publico_ref?: string;
  quantidade: number; zero_motivo?: "saldo-suficiente" | "nao-aplicavel" | "outro" | undefined; observacao?: string;
  /** LOTE 9 — declarados pela escola com base escrita; o teto só os usa com per capita homologado. */
  publico_atendido?: number | undefined; publico_base?: string | undefined; dias_letivos?: number | undefined; dias_base?: string | undefined; justificativa_excesso?: string | undefined;
}

// ---- motor de necessidade/teto ----
export type Unknown = { state: "UNKNOWN"; reason: string };
export interface Input<T> { value: T; ref: string; version: number }
export interface QuantityRule {
  ref: string; version: number; homologated: boolean;
  /** primitivas declaradas pela regra; o motor não conhece fórmula oficial. */
  discountStock: boolean; unitRef: string;
}
export interface CalcInputs {
  rule: QuantityRule | null;
  perCapita: Input<{ quantity: number; unitRef: string }> | null;
  population: Input<number> | null;
  schoolDays: Input<number> | null;
  stock: Input<{ quantity: number; unitRef: string; basis: string }> | null;
  conversions: { from: string; to: string; factor: number; ref: string; version: number }[];
}
export interface Manifest { rule: string; inputs: Record<string, { ref: string; version: number; value: unknown }>; unit: string; conversions: string[] }
export type CalcResult = { state: "CALCULATED"; need: number; ceiling: number; manifest: Manifest } | Unknown;

function convert(q: number, from: string, to: string, conv: CalcInputs["conversions"], used: string[]): number | null {
  if (from === to) return q;
  const c = conv.find((x) => x.from === from && x.to === to);
  if (!c) return null;
  used.push(`${c.ref}@v${c.version}`);
  return q * c.factor;
}

export function computeCeiling(i: CalcInputs): CalcResult {
  if (!i.rule || !i.rule.homologated) return { state: "UNKNOWN", reason: "QUANTITY_LIMIT — BLOCKED_BY_HOMOLOGATED_RULE" };
  if (!i.perCapita) return { state: "UNKNOWN", reason: "PER_CAPITA — BLOCKED_BY_HOMOLOGATED_RULE" };
  if (!i.population) return { state: "UNKNOWN", reason: "Público atendido não informado pela fonte canônica" };
  if (!i.schoolDays) return { state: "UNKNOWN", reason: "Dias letivos não resolvidos pelo calendário institucional" };
  if (i.rule.discountStock && !i.stock) return { state: "UNKNOWN", reason: "Saldo elegível sem base declarada" };
  const used: string[] = [];
  const pc = convert(i.perCapita.value.quantity, i.perCapita.value.unitRef, i.rule.unitRef, i.conversions, used);
  if (pc === null) return { state: "UNKNOWN", reason: "UNIT_CONVERSION — BLOCKED_BY_HOMOLOGATED_RULE" };
  const need = pc * i.population.value * i.schoolDays.value;
  let ceiling = need;
  const inputs: Manifest["inputs"] = {
    perCapita: { ...i.perCapita }, population: { ...i.population }, schoolDays: { ...i.schoolDays },
  };
  if (i.rule.discountStock && i.stock) {
    const st = convert(i.stock.value.quantity, i.stock.value.unitRef, i.rule.unitRef, i.conversions, used);
    if (st === null) return { state: "UNKNOWN", reason: "UNIT_CONVERSION — BLOCKED_BY_HOMOLOGATED_RULE" };
    ceiling = Math.max(0, need - st);
    inputs["stock"] = { ...i.stock };
  }
  return { state: "CALCULATED", need, ceiling, manifest: { rule: `${i.rule.ref}@v${i.rule.version}`, inputs, unit: i.rule.unitRef, conversions: used } };
}

/** Nunca afirma "dentro do teto" sem teto calculado. */
export function ceilingVerdict(requested: number, c: CalcResult): "dentro" | "acima" | "nao-calculavel" {
  if (c.state !== "CALCULATED") return "nao-calculavel";
  return requested <= c.ceiling ? "dentro" : "acima";
}

// ---- zeros e anomalias ----
export type ZeroClass = "nao-zero" | "zero-justificado" | "zero-sem-justificativa";
export const classifyZero = (l: OrderLine): ZeroClass => (l.quantidade > 0 ? "nao-zero" : l.zero_motivo ? "zero-justificado" : "zero-sem-justificativa");

export interface AnomalyRule { id: string; kind: "zero-sem-justificativa" | "variacao-historica"; threshold?: number; homologated: boolean }
export interface Anomaly { rule: string; item: string; explanation: string }
export function anomalies(lines: OrderLine[], history: Record<string, number | null>, rules: AnomalyRule[]): Anomaly[] {
  const out: Anomaly[] = [];
  for (const r of rules.filter((x) => x.homologated)) {
    for (const l of lines) {
      if (r.kind === "zero-sem-justificativa" && classifyZero(l) === "zero-sem-justificativa")
        out.push({ rule: r.id, item: l.item_ref, explanation: "Item com quantidade zero e sem justificativa." });
      if (r.kind === "variacao-historica" && r.threshold != null) {
        const h = history[l.item_ref];
        if (h != null && h > 0 && Math.abs(l.quantidade - h) / h > r.threshold)
          out.push({ rule: r.id, item: l.item_ref, explanation: `Diferença de ${formatRatioPercent(Math.abs(l.quantidade - h) / h, 0)} em relação ao histórico (${formatNumber(h)}); limite configurado ${formatRatioPercent(r.threshold, 0)}.` });
      }
    }
  }
  return out;
}

// ---- consolidação (espelho puro do reader, para teste) ----
export function consolidate(orders: { id: string; school: string; status: OrderStatus; lines: OrderLine[] }[]) {
  const m = new Map<string, { key: string; total: number; bySchool: Record<string, number> }>();
  for (const o of orders) {
    if (!isAuthorized(o.status)) continue;
    for (const l of o.lines) {
      if (!(l.quantidade > 0)) continue;
      const key = [l.item_ref, l.unidade_ref, l.apresentacao_ref ?? "", l.contrato_ref ?? ""].join("|");
      const e = m.get(key) ?? { key, total: 0, bySchool: {} };
      e.total += l.quantidade; e.bySchool[o.school] = (e.bySchool[o.school] ?? 0) + l.quantidade; m.set(key, e);
    }
  }
  return [...m.values()];
}

// ---- relatórios (mesmo reader da tela) ----
const comp = { id: "competence", label: "Competência (AAAA-MM)", type: "text" as const, required: true, maxLength: 7 };
export const PEDIDOS_ALIMENTACAO: ReportDefinition = {
  id: "pedidos-alimentacao", version: 1, title: "Pedidos de alimentação por competência",
  description: "Situação, solicitado × autorizado, zeros justificados e tempo de análise por escola.",
  source: "meal_orders_at / meal_order_history", params: [comp],
  columns: [
    { id: "school", label: "Escola", kind: "text" }, { id: "status", label: "Situação", kind: "text" },
    { id: "requested", label: "Total solicitado", kind: "number" }, { id: "authorized", label: "Total autorizado", kind: "number" },
    { id: "zeros", label: "Itens zerados", kind: "number" }, { id: "zerosJustified", label: "Zerados justificados", kind: "number" },
    { id: "analysisHours", label: "Horas até decisão", kind: "number" }, { id: "versions", label: "Versões", kind: "number" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};
export const CONSOLIDADO_ALIMENTACAO: ReportDefinition = {
  id: "consolidado-demanda-alimentacao", version: 1, title: "Consolidação de demanda por item/fornecedor",
  description: "Soma só de versões autorizadas vigentes, com destino por escola. Não é ordem de compra.",
  source: "meal_demand_consolidation_at", params: [comp],
  columns: [
    { id: "item", label: "Item", kind: "text" }, { id: "unit", label: "Unidade", kind: "text" },
    { id: "presentation", label: "Apresentação", kind: "text" }, { id: "contract", label: "Referência contratual", kind: "text" },
    { id: "total", label: "Total autorizado", kind: "number" }, { id: "schools", label: "Destinos", kind: "text" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 5000,
};

export interface HistoryRow { version: number; status: OrderStatus; lines: OrderLine[]; recorded_at: string }
const sum = (ls: OrderLine[]) => ls.reduce((a, l) => a + l.quantidade, 0);
export function orderReportRow(school: string, history: HistoryRow[]): Record<string, CellValue> {
  const head = history[history.length - 1]!;
  const submitted = history.find((h) => h.status === "submetido");
  const lastRequest = [...history].reverse().find((h) => h.status === "submetido");
  const decided = history.find((h) => isAuthorized(h.status) || h.status === "rejeitado");
  return {
    school, status: ORDER_STATUS_LABEL[head.status],
    requested: lastRequest ? sum(lastRequest.lines) : null,
    authorized: isAuthorized(head.status) ? sum(head.lines) : null,
    zeros: head.lines.filter((l) => l.quantidade === 0).length,
    zerosJustified: head.lines.filter((l) => classifyZero(l) === "zero-justificado").length,
    analysisHours: submitted && decided ? Math.round((Date.parse(decided.recorded_at) - Date.parse(submitted.recorded_at)) / 36e5) : null,
    versions: history.length,
  };
}
