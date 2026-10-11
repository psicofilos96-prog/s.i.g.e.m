/**
 * CIECE Lote 14 — Gerador avançado (núcleo puro). Reaproveita: fontes = biblioteca CIECE (L13) sobre
 * o motor comum; gráficos = `dashboards/chart-model.ts` (23 tipos com compatibilidade por forma);
 * logos = `INSTITUTIONAL_LOGOS`/`isAllowedLogo`. Modelo salvo guarda só ESCOLHAS validadas — nunca
 * SQL, linhas, valores ou HTML — e a prévia é o mesmo `runReport` da exportação (prévia fiel).
 */
import type { CellValue, ReportResult } from "@/features/reports/report-engine";
import { runReport } from "@/features/reports/report-engine";
import { CHARTS, incompatibility, type ChartKind } from "@/features/reports/dashboards/chart-model";
import { INSTITUTIONAL_LOGOS } from "@/features/reports/report-analytics";
import { CIECE_LIBRARY, type LibraryEntry } from "./official-report-library";

export const FONTS = ["serif", "sans-serif", "times", "helvetica"] as const;
export type Position = "topo-esquerda" | "topo-centro" | "topo-direita" | "rodape-esquerda" | "rodape-centro" | "rodape-direita";
export type Aggregation = "contagem" | "soma" | "media" | "minimo" | "maximo" | "contagem-distinta";

export type BuilderSpec = {
  sourceId: string;
  fields: string[];
  filters: { column: string; equals: CellValue }[];
  groupBy: string[];
  measures: { column: string; agg: Aggregation }[];
  sort: { column: string; dir: "asc" | "desc" }[];
  chart: ChartKind | null;
  layout: { title: string; logoId: string | null; header: string[]; footer: string[]; font: (typeof FONTS)[number]; logoPosition: Position; orientation: "retrato" | "paisagem" };
};

/** Fontes autorizadas: só da biblioteca e só com a capacidade de consulta. */
export const authorizedSources = (caps: ReadonlySet<string>): LibraryEntry[] => CIECE_LIBRARY.filter((e) => !e.def.dependency && caps.has(e.printAuthorizedBy));
const visibleCols = (e: LibraryEntry) => e.def.columns.filter((c) => !c.sensitive);

const FORBIDDEN_KEYS = /^(sql|query|rows|data|values|html|script|where|expression|formula)$/i;
function hasForbidden(o: unknown): string | null {
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (FORBIDDEN_KEYS.test(k)) return k; const r = hasForbidden(v); if (r) return r; }
  if (typeof o === "string" && /<\s*script|javascript:|data:text\/html/i.test(o)) return "conteudo-ativo";
  return null;
}

export function validateSpec(spec: BuilderSpec, caps: ReadonlySet<string>): string[] {
  const errs: string[] = [];
  const bad = hasForbidden(spec); if (bad) errs.push(`campo-proibido:${bad}`);
  const src = authorizedSources(caps).find((e) => e.def.id === spec.sourceId);
  if (!src) return [...errs, "fonte-nao-autorizada"];
  const cols = new Set(visibleCols(src).map((c) => c.id));
  const all = [...spec.fields, ...spec.filters.map((f) => f.column), ...spec.groupBy, ...spec.measures.map((m) => m.column), ...spec.sort.map((s) => s.column)];
  for (const c of all) if (!cols.has(c)) errs.push(src.def.columns.some((x) => x.id === c) ? `coluna-sensivel:${c}` : `coluna-desconhecida:${c}`);
  for (const m of spec.measures) {
    const k = src.def.columns.find((x) => x.id === m.column)?.kind;
    if (["soma", "media", "minimo", "maximo"].includes(m.agg) && k !== "number") errs.push(`agregacao-exige-numero:${m.column}`);
  }
  if (spec.layout.logoId && !INSTITUTIONAL_LOGOS.some((l) => l.id === spec.layout.logoId)) errs.push("logo-fora-do-catalogo");
  if (!FONTS.includes(spec.layout.font)) errs.push("fonte-tipografica-fora-da-lista");
  if (spec.layout.title.length > 160) errs.push("titulo-longo");
  return errs;
}

/** Gráfico: compatível pela forma; senão degrada para tabela com motivo por extenso (nunca desenha errado). */
export function resolveChart(spec: BuilderSpec): { kind: ChartKind; degradedFrom: ChartKind | null; reason: string | null } {
  if (!spec.chart) return { kind: "table", degradedFrom: null, reason: null };
  const raw = spec.groupBy.length === 0 && spec.measures.length === 0;
  const why = incompatibility(spec.chart, { dims: spec.groupBy.length, measures: spec.measures.length, numericColumns: spec.measures.length, raw, geo: false });
  return why ? { kind: "table", degradedFrom: spec.chart, reason: why } : { kind: spec.chart, degradedFrom: null, reason: null };
}
export const SUPPORTED_CHARTS = Object.keys(CHARTS) as ChartKind[];

/** Agrega sobre as linhas JÁ lidas; ausente fica de fora e é contado. */
export function aggregate(rows: Record<string, CellValue>[], spec: BuilderSpec) {
  if (!spec.groupBy.length && !spec.measures.length) return { rows, excluded: 0 };
  const groups = new Map<string, Record<string, CellValue>[]>();
  for (const r of rows) { const k = JSON.stringify(spec.groupBy.map((g) => r[g] ?? null)); (groups.get(k) ?? groups.set(k, []).get(k)!).push(r); }
  let excluded = 0;
  const out = [...groups.entries()].map(([k, rs]) => {
    const keyVals = JSON.parse(k) as CellValue[]; const o: Record<string, CellValue> = {};
    spec.groupBy.forEach((g, i) => (o[g] = keyVals[i] ?? null));
    for (const m of spec.measures) {
      const vals = rs.map((r) => r[m.column] ?? null);
      const present = vals.filter((v) => v !== null); excluded += vals.length - present.length;
      const nums = present.filter((v): v is number => typeof v === "number");
      const id = `${m.agg}:${m.column}`;
      o[id] = m.agg === "contagem" ? present.length : m.agg === "contagem-distinta" ? new Set(present.map(String)).size
        : nums.length === 0 ? null : m.agg === "soma" ? nums.reduce((a, b) => a + b, 0) : m.agg === "media" ? nums.reduce((a, b) => a + b, 0) / nums.length
        : m.agg === "minimo" ? Math.min(...nums) : Math.max(...nums);
    }
    return o;
  });
  return { rows: out, excluded };
}

/** Prévia e exportação usam a MESMA função; prévia só corta linhas exibidas. */
export function render(spec: BuilderSpec, caps: ReadonlySet<string>, sourceRows: Record<string, CellValue>[], params: Record<string, unknown>, now = new Date(), previewLimit?: number):
  { result: ReportResult; chart: ReturnType<typeof resolveChart>; excluded: number; meta: string[] } {
  const errs = validateSpec(spec, caps); if (errs.length) throw new Error(`builder:${errs.join(",")}`);
  const src = authorizedSources(caps).find((e) => e.def.id === spec.sourceId)!;
  const base = runReport(src.def, { params, filters: spec.filters, columns: spec.fields.length ? spec.fields : undefined, sort: spec.sort }, sourceRows, now);
  const asRecords = base.rows.map((r) => Object.fromEntries(base.columns.map((c, i) => [c.id, r[i] ?? null])));
  // filtros/colunas aplicados pelo motor; para agregar precisamos das colunas de grupo/medida mesmo fora de "fields"
  const full = spec.groupBy.length || spec.measures.length ? runReport(src.def, { params, filters: spec.filters }, sourceRows, now) : base;
  const fullRecs = full.rows.map((r) => Object.fromEntries(full.columns.map((c, i) => [c.id, r[i] ?? null])));
  const agg = aggregate(spec.groupBy.length || spec.measures.length ? fullRecs : asRecords, spec);
  const cols = spec.groupBy.length || spec.measures.length
    ? [...spec.groupBy.map((g) => src.def.columns.find((c) => c.id === g)!), ...spec.measures.map((m) => ({ id: `${m.agg}:${m.column}`, label: `${m.agg} de ${src.def.columns.find((c) => c.id === m.column)!.label}`, kind: "number" as const }))]
    : base.columns;
  const rows = agg.rows.map((r) => cols.map((c) => r[c.id] ?? null));
  const result: ReportResult = { ...base, columns: cols, rows: previewLimit ? rows.slice(0, previewLimit) : rows };
  const chart = resolveChart(spec);
  const meta = [`Fonte: ${src.def.title} (${src.def.id}@${src.def.version})`, ...src.methodology.map((m) => `Metodologia: ${m}`), `Ausentes fora do cálculo: ${agg.excluded}`, ...(chart.reason ? [`Gráfico ${CHARTS[chart.degradedFrom!].label} indisponível: ${chart.reason} Exibido como tabela.`] : [])];
  return { result, chart, excluded: agg.excluded, meta };
}

/** Modelo salvo: só escolhas; reaberto, é revalidado contra a fonte e a capacidade de quem abre. */
export type SavedModel = { name: string; owner: string; spec: BuilderSpec; savedAt: string };
export function saveModel(name: string, owner: string, spec: BuilderSpec, caps: ReadonlySet<string>, at: string): SavedModel {
  const e = validateSpec(spec, caps); if (e.length) throw new Error(`builder:${e.join(",")}`);
  return { name, owner, spec: JSON.parse(JSON.stringify(spec)) as BuilderSpec, savedAt: at };
}
export const openModel = (m: SavedModel, caps: ReadonlySet<string>) => ({ spec: m.spec, errors: validateSpec(m.spec, caps) });
