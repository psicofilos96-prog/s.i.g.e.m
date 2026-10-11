/**
 * Alimentação Lote 12 — custos, perdas e indicadores (projeção pura).
 * Preço vem com origem explícita: "contrato" (contracts-ledger, valor aceito) ou "referencia"
 * (cotação declarada). Gasto CONTABILIZADO só de fonte contábil real (empenho/liquidação) e nunca
 * é somado ao custo ESTIMADO. Consumo efetivo = baixas confirmadas (daily-production), nunca previsão.
 */
export type PriceOrigin = "contrato" | "referencia";
export interface Price { itemId: string; unitPrice: number; origin: PriceOrigin; ref: string; validOn: string }
export interface Consumption { schoolId: string; date: string; itemId: string; qty: number; preparationId: string | null; source: string }

export function costByItem(cons: Consumption[], prices: Price[], scope: { schools: string[]; from: string; to: string }) {
  const rows = cons.filter((c) => scope.schools.includes(c.schoolId) && c.date >= scope.from && c.date <= scope.to);
  const by = new Map<string, { qty: number; cost: number | null; origins: Set<string>; refs: Consumption[] }>();
  for (const c of rows) {
    const p = prices.filter((x) => x.itemId === c.itemId && x.validOn <= c.date).sort((a, b) => b.validOn.localeCompare(a.validOn))[0];
    const cur = by.get(c.itemId) ?? { qty: 0, cost: 0, origins: new Set<string>(), refs: [] };
    cur.qty += c.qty; cur.refs.push(c);
    if (!p || cur.cost == null) cur.cost = null; else { cur.cost += c.qty * p.unitPrice; cur.origins.add(`${p.origin}:${p.ref}`); }
    by.set(c.itemId, cur);
  }
  return [...by].map(([itemId, v]) => ({
    itemId, qty: r2(v.qty), estimatedCost: v.cost == null ? null : r2(v.cost),
    nature: "custo-estimado" as const, priceOrigins: [...v.origins], drill: v.refs, scope,
  }));
}

/** Custo por porção: custo estimado ÷ porções SERVIDAS registradas; sem servidas ⇒ null. */
export function costPerPortion(estimatedCost: number | null, servedPortions: number | null) {
  return estimatedCost == null || !servedPortions ? null : r2(estimatedCost / servedPortions);
}

/** Gasto contabilizado vive separado; comparar só exibe lado a lado, nunca soma. */
export function estimatedVsBooked(estimated: number | null, booked: { value: number; source: string } | null) {
  return { estimated: { value: estimated, nature: "custo-estimado" }, booked: booked ? { value: booked.value, nature: "gasto-contabilizado", source: booked.source } : { value: null, nature: "gasto-contabilizado", source: "fonte contábil não integrada" } };
}

// ---------- Perdas ----------
export const LOSS_KINDS = ["validade", "transporte", "estoque", "preparo", "descarte"] as const;
export type LossKind = (typeof LOSS_KINDS)[number];
export function lossesByKind(losses: { kind: string; qty: number; itemId: string; ref: string }[]) {
  const out = Object.fromEntries(LOSS_KINDS.map((k) => [k, { qty: 0, refs: [] as string[] }])) as Record<LossKind, { qty: number; refs: string[] }>;
  const unclassified: string[] = [];
  for (const l of losses) if ((LOSS_KINDS as readonly string[]).includes(l.kind)) { out[l.kind as LossKind].qty += l.qty; out[l.kind as LossKind].refs.push(l.ref); } else unclassified.push(l.ref);
  return { byKind: out, unclassified };
}

// ---------- Indicadores ----------
export interface Indicator { key: string; label: string; formula: string; numerator: string; denominator: string; source: string }
export const INDICATORS: Indicator[] = [
  { key: "cobertura", label: "Cobertura de atendimento", formula: "servidas ÷ (atendidos × dias letivos)", numerator: "porções servidas registradas", denominator: "atendidos × dias letivos do calendário aplicável", source: "record_meal_execution + matrícula + calendário" },
  { key: "execucao-cardapio", label: "Execução do cardápio", formula: "dias seguidos ÷ dias com registro", numerator: "dias com preparo = planejado", denominator: "dias com execução registrada", source: "record_meal_execution" },
  { key: "abastecimento", label: "Abastecimento", formula: "entregas aceitas no prazo ÷ entregas programadas", numerator: "remessas recebidas até a data prevista", denominator: "remessas programadas no período", source: "programação × recebimento" },
  { key: "disponibilidade", label: "Disponibilidade", formula: "itens com saldo ≥ mínimo ÷ itens com mínimo configurado", numerator: "itens acima do mínimo", denominator: "itens com mínimo homologado", source: "meal_stock_lines + política" },
  { key: "desperdicio", label: "Desperdício", formula: "resto medido (kg) ÷ produzido medido (kg)", numerator: "resto medido", denominator: "produção medida no mesmo dia", source: "daily-production" },
  { key: "custo", label: "Custo estimado por porção", formula: "custo estimado ÷ porções servidas", numerator: "custo estimado (origem de preço declarada)", denominator: "porções servidas", source: "baixas confirmadas × preço" },
  { key: "conformidade", label: "Conformidade sanitária", formula: "itens conformes ÷ itens respondidos", numerator: "itens conformes", denominator: "itens respondidos de checklist homologado", source: "special-diet-safety" },
  { key: "resolucao", label: "Resolução de solicitações", formula: "solicitações encerradas ÷ abertas no período", numerator: "encerradas", denominator: "abertas no período", source: "demand-center (alimentacao)" },
];

export function compute(key: string, num: number | null, den: number | null, drill: string[], period: string) {
  const def = INDICATORS.find((i) => i.key === key);
  if (!def) return { key, state: "desconhecido" as const };
  if (num == null || den == null) return { ...def, period, state: "nao-informado" as const, value: null, drill };
  if (den === 0) return { ...def, period, state: "sem-denominador" as const, value: null, drill };
  return { ...def, period, state: "calculado" as const, value: r2(num / den), num, den, drill };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
