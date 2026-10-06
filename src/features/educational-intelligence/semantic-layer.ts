/**
 * BM.1 — Camada semântica da Inteligência Educacional (pura).
 * Um dataset declara dimensões, medidas (com unidade e natureza), granularidade, joins permitidos e
 * escopo. Uma consulta produz UM resultado semântico; tabela, pivot, KPI, gráfico e exportação são
 * projeções desse mesmo resultado. Linhas de entrada são as que o reader canônico já devolveu à sessão.
 * Nunca mistura unidades, nunca compara sem comparabilidade declarada, ausência nunca vira zero.
 */
import type { ReportDefinition, ReportResult, CellValue } from "@/features/reports/report-engine";

export type DataNature = "observado" | "oficial" | "derivado" | "projecao";
export type Comparability = "comparable" | "not_comparable" | "unknown";
export type Aggregation = "media" | "contagem" | "soma" | "proporcao";

export type Dimension = Readonly<{ id: string; label: string; sensitive?: boolean }>;
export type Measure = Readonly<{
  id: string; label: string; /** unidade declarada pela fonte; null = não declarada */ unit: string | null;
  scaleKind: "numerico" | "categorico"; nature: DataNature; aggregations: readonly Aggregation[];
  /** chave da métrica/escala; medidas com chaves diferentes nunca se agregam juntas */ scaleKey: string;
}>;
export type Dataset = Readonly<{
  id: string; version: number; label: string; source: string; grain: string;
  dimensions: readonly Dimension[]; measures: readonly Measure[];
  joins: readonly { to: string; on: string; note: string }[];
  /** capability que o reader exige; a camada nunca amplia */ readCapability: string;
}>;

export type SemanticQuery = Readonly<{
  datasetId: string; measureId: string; aggregation: Aggregation;
  groupBy: readonly string[]; filters?: Readonly<Record<string, CellValue>>;
  includeSensitive?: boolean; knownAt: string; asOf: string | null;
}>;
export type CellState = "AVAILABLE" | "ZERO" | "UNKNOWN";
export type SemanticCell = Readonly<{ key: readonly CellValue[]; value: number | null; state: CellState; n: number; observed: number }>;
export type SemanticResult = Readonly<{
  datasetId: string; datasetVersion: number; measure: Measure; aggregation: Aggregation;
  groupBy: readonly Dimension[]; cells: readonly SemanticCell[];
  provenance: Readonly<{ source: string; knownAt: string; asOf: string | null; nature: DataNature; unit: string | null }>;
}>;

export class SemanticError extends Error { constructor(public code: string, message: string) { super(message); } }

export function runSemanticQuery(ds: Dataset, q: SemanticQuery, rows: readonly Record<string, CellValue>[]): SemanticResult {
  if (q.datasetId !== ds.id) throw new SemanticError("dataset:mismatch", "Consulta e dataset não correspondem.");
  const m = ds.measures.find((x) => x.id === q.measureId);
  if (!m) throw new SemanticError("measure:unknown", `Medida não prevista: ${q.measureId}.`);
  if (!m.aggregations.includes(q.aggregation)) throw new SemanticError("aggregation:not-allowed", `${m.label} não admite ${q.aggregation}.`);
  if (m.scaleKind === "categorico" && q.aggregation !== "contagem") throw new SemanticError("aggregation:categorical", "Escala categórica só admite contagem.");
  const dims = q.groupBy.map((id) => {
    const d = ds.dimensions.find((x) => x.id === id);
    if (!d) throw new SemanticError("dimension:unknown", `Dimensão não prevista: ${id}.`);
    if (d.sensitive && !q.includeSensitive) throw new SemanticError("dimension:sensitive", `${d.label} é dado pessoal e não entra por padrão.`);
    return d;
  });
  for (const k of Object.keys(q.filters ?? {})) if (!ds.dimensions.some((d) => d.id === k)) throw new SemanticError("filter:unknown", `Filtro não previsto: ${k}.`);
  const scales = new Set(rows.map((r) => r["scale_key"]).filter((x) => x != null));
  if (scales.size > 1) throw new SemanticError("scale:mixed", "As linhas têm escalas/métricas diferentes; não são agregadas juntas.");
  if (scales.size === 1 && !scales.has(m.scaleKey)) throw new SemanticError("scale:mismatch", "Linhas de outra escala para esta medida.");
  const kept = rows.filter((r) => Object.entries(q.filters ?? {}).every(([k, v]) => (r[k] ?? null) === v));
  const groups = new Map<string, { key: CellValue[]; vals: (number | null)[] }>();
  for (const r of kept) {
    const key = dims.map((d) => r[d.id] ?? null);
    const id = JSON.stringify(key);
    const g = groups.get(id) ?? { key, vals: [] };
    const v = r[m.id];
    g.vals.push(typeof v === "number" ? v : v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
    groups.set(id, g);
  }
  const cells: SemanticCell[] = [...groups.values()].map(({ key, vals }) => {
    const obs = vals.filter((x): x is number => x !== null);
    let value: number | null = null;
    if (q.aggregation === "contagem") value = obs.length;
    else if (obs.length > 0) {
      const sum = obs.reduce((a, b) => a + b, 0);
      value = q.aggregation === "soma" ? sum : q.aggregation === "media" ? sum / obs.length : obs.filter((x) => x > 0).length / obs.length;
    }
    const state: CellState = value === null ? "UNKNOWN" : value === 0 ? "ZERO" : "AVAILABLE";
    return { key, value, state, n: vals.length, observed: obs.length };
  });
  return { datasetId: ds.id, datasetVersion: ds.version, measure: m, aggregation: q.aggregation, groupBy: dims, cells,
    provenance: { source: ds.source, knownAt: q.knownAt, asOf: q.asOf, nature: m.nature === "observado" && q.aggregation !== "contagem" ? "derivado" : m.nature, unit: m.unit } };
}

// Projeções visuais — todas do mesmo SemanticResult -----------------------------------------
export const toTable = (r: SemanticResult) => ({
  columns: [...r.groupBy.map((d) => d.label), r.measure.label, "Estado", "Base (n)"],
  rows: r.cells.map((c) => [...c.key, c.value, c.state, c.n] as CellValue[]),
});
export function toPivot(r: SemanticResult) {
  if (r.groupBy.length !== 2) throw new SemanticError("pivot:needs-two", "Pivot exige exatamente duas dimensões.");
  const rowsK = [...new Set(r.cells.map((c) => JSON.stringify(c.key[0])))];
  const colsK = [...new Set(r.cells.map((c) => JSON.stringify(c.key[1])))];
  const at = (a: string, b: string) => r.cells.find((c) => JSON.stringify(c.key[0]) === a && JSON.stringify(c.key[1]) === b) ?? null;
  return { rowKeys: rowsK.map((k) => JSON.parse(k) as CellValue), colKeys: colsK.map((k) => JSON.parse(k) as CellValue),
    values: rowsK.map((a) => colsK.map((b) => at(a, b)?.value ?? null)) };
}
export function toKpi(r: SemanticResult) {
  if (r.groupBy.length !== 0) throw new SemanticError("kpi:needs-total", "KPI exige consulta sem agrupamento.");
  const c = r.cells[0] ?? null;
  return { value: c?.value ?? null, state: c?.state ?? ("UNKNOWN" as CellState), n: c?.n ?? 0, unit: r.measure.unit, nature: r.provenance.nature };
}
export const toChartSeries = (r: SemanticResult) =>
  r.cells.map((c) => ({ label: c.key.map((k) => (k === null ? "não disponível" : String(k))).join(" · "), value: c.value, state: c.state }));

/** Ponte para o motor de relatórios: exportação usa o MESMO resultado. */
export function toReportResult(r: SemanticResult, now = new Date()): { def: ReportDefinition; result: ReportResult } {
  const t = toTable(r);
  const columns = t.columns.map((label, i) => ({ id: `c${i}`, label, kind: (i === r.groupBy.length || i === t.columns.length - 1 ? "number" : "text") as "number" | "text" }));
  const def: ReportDefinition = { id: `ei:${r.datasetId}:${r.measure.id}`, version: r.datasetVersion, title: r.measure.label,
    description: `${r.aggregation} de ${r.measure.label}`, source: r.provenance.source, params: [], columns, formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 20000 };
  return { def, result: { definitionId: def.id, definitionVersion: def.version, params: {}, columns, rows: t.rows, groups: null, generatedAt: now.toISOString(), mode: "sync" } };
}
export const methodologyNotes = (r: SemanticResult): string[] => [
  `Fonte: ${r.provenance.source}`, `Conhecido até: ${r.provenance.knownAt}`, `Vigente em: ${r.provenance.asOf ?? "não informado"}`,
  `Natureza: ${r.provenance.nature}`, `Unidade: ${r.provenance.unit ?? "não declarada pela fonte"}`,
  "Ausência de dado aparece como não disponível, nunca como zero.", "Cruzamento entre dados não indica causa.",
];

// Comparabilidade entre métricas: só declaração registrada vale; nome nunca decide -----------
export function comparabilityOf(a: string, b: string, declared: readonly { metric_a: string; metric_b: string; status: Comparability }[]): Comparability {
  if (a === b) return "comparable";
  const [x, y] = a < b ? [a, b] : [b, a];
  return declared.find((d) => d.metric_a === x && d.metric_b === y)?.status ?? "unknown";
}
