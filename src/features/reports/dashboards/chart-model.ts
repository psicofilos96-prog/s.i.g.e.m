/**
 * Painéis: modelo puro dos gráficos. Cada gráfico consome as linhas JÁ devolvidas por `report_custom_query`
 * (mesma consulta, mesma RLS de quem vê). Nada é calculado sobre dado ausente: valor nulo/não numérico fica de fora
 * e é contado em `excluded`, nunca vira zero.
 */
export type ChartKind =
  | "bar" | "line" | "area" | "pie" | "donut" | "scatter" | "bubble" | "histogram" | "heatmap" | "treemap"
  | "funnel" | "radar" | "waterfall" | "boxplot" | "gauge" | "table" | "kpi";

/** Forma da consulta exigida por tipo: dimensões (agrupamentos) e medidas (agregações) ou linhas brutas numéricas. */
type Need = { label: string; dims: [number, number]; measures: [number, number]; raw?: "numeric1" | "numeric2" | "numeric3" };
export const CHARTS: Readonly<Record<ChartKind, Need>> = {
  bar: { label: "Barras", dims: [1, 2], measures: [1, 3] },
  line: { label: "Linhas", dims: [1, 2], measures: [1, 3] },
  area: { label: "Áreas", dims: [1, 2], measures: [1, 3] },
  pie: { label: "Pizza", dims: [1, 1], measures: [1, 1] },
  donut: { label: "Rosca", dims: [1, 1], measures: [1, 1] },
  scatter: { label: "Dispersão", dims: [1, 1], measures: [2, 2] },
  bubble: { label: "Bolhas", dims: [1, 1], measures: [3, 3] },
  histogram: { label: "Histograma", dims: [0, 0], measures: [0, 0], raw: "numeric1" },
  heatmap: { label: "Mapa de calor", dims: [2, 2], measures: [1, 1] },
  treemap: { label: "Treemap", dims: [1, 1], measures: [1, 1] },
  funnel: { label: "Funil", dims: [1, 1], measures: [1, 1] },
  radar: { label: "Radar", dims: [1, 1], measures: [1, 3] },
  waterfall: { label: "Cascata (waterfall)", dims: [1, 1], measures: [1, 1] },
  boxplot: { label: "Boxplot", dims: [0, 1], measures: [0, 0], raw: "numeric1" },
  gauge: { label: "Medidor (gauge)", dims: [0, 0], measures: [1, 1] },
  table: { label: "Tabela", dims: [0, 4], measures: [0, 6] },
  kpi: { label: "Indicador", dims: [0, 0], measures: [1, 1] },
};

export type Shape = { dims: number; measures: number; numericColumns: number; raw: boolean };
/** Motivo por extenso quando a consulta não serve ao gráfico; null = compatível. */
export function incompatibility(kind: ChartKind, s: Shape): string | null {
  const n = CHARTS[kind];
  if (n.raw) {
    if (s.raw) return s.numericColumns >= 1 ? null : `${n.label} precisa de uma coluna numérica nas linhas (sem agrupamento).`;
    return `${n.label} usa os valores individuais: tire os agrupamentos e escolha uma coluna numérica.`;
  }
  if (kind === "table") return null;
  if (s.raw) return `${n.label} precisa de agrupamento e cálculo (ex.: contar por escola).`;
  if (s.dims < n.dims[0] || s.dims > n.dims[1]) return `${n.label} precisa de ${n.dims[0] === n.dims[1] ? n.dims[0] : `${n.dims[0]} a ${n.dims[1]}`} agrupamento(s); a consulta tem ${s.dims}.`;
  if (s.measures < n.measures[0] || s.measures > n.measures[1]) return `${n.label} precisa de ${n.measures[0] === n.measures[1] ? n.measures[0] : `${n.measures[0]} a ${n.measures[1]}`} cálculo(s); a consulta tem ${s.measures}.`;
  return null;
}
export const compatibleKinds = (s: Shape) => (Object.keys(CHARTS) as ChartKind[]).filter((k) => incompatibility(k, s) === null);

export const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};
export const label = (v: unknown): string => (v === null || v === undefined || v === "" ? "(sem registro)" : String(v));

export type Row = Record<string, unknown>;
export type Series = { key: string; name: string };
/** Linhas de rollup (subtotal/total do servidor) vêm com dimensão nula e são excluídas do gráfico. */
export function categorySeries(rows: readonly Row[], dim: string, measures: readonly string[], dim2?: string) {
  let excluded = 0; const out = new Map<string, Row>(); const series = new Set<string>();
  for (const r of rows) {
    if (r["__rollup"]) continue;
    const cat = label(r[dim]);
    const o = out.get(cat) ?? { categoria: cat }; out.set(cat, o);
    for (const m of measures) {
      const v = num(r[m]); if (v === null) { excluded++; continue; }
      const key = dim2 ? `${label(r[dim2])}${measures.length > 1 ? ` · ${m}` : ""}` : m;
      series.add(key); o[key] = ((o[key] as number | undefined) ?? 0) + v;
    }
  }
  return { data: [...out.values()], series: [...series], excluded };
}

export function histogram(values: readonly unknown[], bins = 10) {
  const xs = values.map(num).filter((v): v is number => v !== null); const excluded = values.length - xs.length;
  if (xs.length === 0) return { data: [] as { faixa: string; quantidade: number }[], excluded };
  const min = Math.min(...xs), max = Math.max(...xs); const k = min === max ? 1 : Math.max(1, Math.min(50, Math.round(bins)));
  const w = min === max ? 1 : (max - min) / k;
  const data = Array.from({ length: k }, (_, i) => ({ faixa: `${fmt(min + i * w)}–${fmt(min + (i + 1) * w)}`, quantidade: 0 }));
  for (const x of xs) data[Math.min(k - 1, Math.floor((x - min) / w))]!.quantidade++;
  return { data, excluded };
}
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("pt-BR");

/** Quartis pelo método de interpolação linear (tipo 7). */
export function quantile(sorted: readonly number[], q: number) {
  const p = (sorted.length - 1) * q; const lo = Math.floor(p), hi = Math.ceil(p);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (p - lo);
}
export function boxplot(rows: readonly Row[], value: string, group?: string) {
  const g = new Map<string, number[]>(); let excluded = 0;
  for (const r of rows) { const v = num(r[value]); if (v === null) { excluded++; continue; } const k = group ? label(r[group]) : "Todos"; (g.get(k) ?? g.set(k, []).get(k)!).push(v); }
  const data = [...g.entries()].map(([grupo, xs]) => {
    const s = [...xs].sort((a, b) => a - b);
    return { grupo, n: s.length, min: s[0]!, q1: quantile(s, 0.25), mediana: quantile(s, 0.5), q3: quantile(s, 0.75), max: s[s.length - 1]! };
  });
  return { data, excluded };
}

export function waterfall(data: readonly Row[], key: string) {
  let acc = 0;
  const steps = data.map((d) => { const v = num(d[key]) ?? 0; const base = v >= 0 ? acc : acc + v; acc += v; return { categoria: String(d["categoria"]), base, valor: Math.abs(v), sinal: v >= 0 ? 1 : -1, acumulado: acc }; });
  return [...steps, { categoria: "Total", base: Math.min(0, acc), valor: Math.abs(acc), sinal: acc >= 0 ? 1 : -1, acumulado: acc }];
}

export function heatmap(rows: readonly Row[], dx: string, dy: string, m: string) {
  const xs = new Set<string>(), ys = new Set<string>(); const cells = new Map<string, number>(); let excluded = 0;
  for (const r of rows) { if (r["__rollup"]) continue; const v = num(r[m]); if (v === null) { excluded++; continue; }
    const x = label(r[dx]), y = label(r[dy]); xs.add(x); ys.add(y); cells.set(`${x}\u0000${y}`, (cells.get(`${x}\u0000${y}`) ?? 0) + v); }
  const vals = [...cells.values()];
  return { xs: [...xs], ys: [...ys], cell: (x: string, y: string) => cells.get(`${x}\u0000${y}`) ?? null,
    min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 0, excluded };
}

/** Drill-down: clicar numa categoria vira filtro "igual a" no campo da dimensão; "(sem registro)" vira "sem valor". */
export function drillCondition(field: string, category: string) {
  return category === "(sem registro)" ? { field, operator: "is_null" as const } : { field, operator: "eq" as const, value: category };
}
