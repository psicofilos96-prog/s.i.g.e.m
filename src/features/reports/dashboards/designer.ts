/** Designer de painéis: operações puras sobre a ESPECIFICAÇÃO (ordem, tamanho, tema, modelos por setor, comparação).
 * Nada aqui guarda linha de dado; modelos por setor são só consultas sobre o catálogo e são conferidos contra ele ao abrir. */
import type { Dashboard, Widget } from "./dashboard-store";
import type { Catalog, CustomSpec } from "../custom/custom-report";

export type Span = 1 | 2 | 3;
export type Height = "s" | "m" | "l";
export const HEIGHT_PX: Record<Height, number> = { s: 200, m: 280, l: 420 };
export type { Theme } from "./dashboard-store";
import type { Theme } from "./dashboard-store";

/** Arrastar e soltar: move `from` para a posição de `to`. Ids desconhecidos não alteram nada. */
export function moveWidget(ws: readonly Widget[], from: string, to: string): Widget[] {
  const i = ws.findIndex((w) => w.id === from), j = ws.findIndex((w) => w.id === to);
  if (i < 0 || j < 0 || i === j) return [...ws];
  const out = [...ws]; const [x] = out.splice(i, 1); out.splice(j, 0, x!); return out;
}
export const clampSpan = (n: number): Span => (n <= 1 ? 1 : n >= 3 ? 3 : 2) as Span;
export const spanOf = (w: Widget): Span => clampSpan((w as Widget & { span?: number }).span ?? (w.wide ? 2 : 1));

/** Duplicar: novo nome, novos ids de gráfico; o salvamento cria a v1 do novo nome (o original não muda). */
export function duplicateBoard(b: Dashboard, name: string, existing: readonly string[], newId: () => string) {
  let n = `${name} (cópia)`, k = 2; while (existing.includes(n)) n = `${name} (cópia ${k++})`;
  return { name: n.slice(0, 80), board: { ...b, widgets: b.widgets.map((w) => ({ ...w, id: newId() })) } };
}

/** Comparação temporal: mesma consulta em dois períodos, juntando por categoria; categoria ausente num período fica sem valor (não zero). */
export function comparePeriods(a: readonly Record<string, unknown>[], b: readonly Record<string, unknown>[], la: string, lb: string) {
  const m = new Map<string, Record<string, unknown>>();
  const put = (rows: readonly Record<string, unknown>[], key: string) => { for (const r of rows) { if (r["__rollup"]) continue; const c = r["c1"] == null ? "(sem registro)" : String(r["c1"]); const o = m.get(c) ?? { categoria: c }; o[key] = typeof r["c2"] === "number" ? r["c2"] : Number(r["c2"]); m.set(c, o); } };
  put(a, la); put(b, lb);
  return [...m.values()];
}

/** Drill-through: abre as linhas da fonte filtradas pela categoria clicada (colunas não sensíveis do catálogo). */
export function drillThroughSpec(spec: CustomSpec, columns: string[], condition: CustomSpec["filter"]["items"][number]): CustomSpec {
  return { ...spec, groupBy: [], measures: [], columns: columns.slice(0, 8), filter: { op: "and", items: [spec.filter, condition] }, offset: 0, limit: 200 } as CustomSpec;
}

const q = (source: string, joins: string[], groupBy: string[]): CustomSpec =>
  ({ source, joins, includeSensitive: false, columns: [], groupBy, measures: [{ agg: "count" }], subtotals: false, filter: { op: "and", items: [] }, sort: [], limit: 1000, offset: 0, labels: {} }) as unknown as CustomSpec;

export type BoardTemplate = { id: string; sector: string; name: string; board: Dashboard & { theme?: Theme } };
export const TEMPLATES: readonly BoardTemplate[] = [
  { id: "secretaria-matriculas", sector: "Secretaria", name: "Matrículas e turmas da escola", board: { filters: [], theme: { logo: "brasao" }, widgets: [
    { id: "t1", title: "Matrículas por escola", kind: "barh", spec: q("matriculas", ["matricula_escola"], ["escolas.nome"]), span: 2 } as Widget,
    { id: "t2", title: "Turmas por escola", kind: "bar", spec: q("turmas", ["turma_escola"], ["escolas.nome"]) } as Widget,
    { id: "t3", title: "Total de matrículas", kind: "kpi", spec: q("matriculas", [], []) } as Widget ] } },
  { id: "ciece-rede", sector: "Informação e Estatística", name: "Panorama da rede", board: { filters: [], theme: { logo: "brasao", font: "serif" }, widgets: [
    { id: "t1", title: "Enturmações por escola", kind: "treemap", spec: q("vinculos", ["vinculo_escola"], ["escolas.nome"]), span: 2 } as Widget,
    { id: "t2", title: "Turmas por escola e etapa", kind: "pivot", spec: q("turmas", ["turma_escola"], ["escolas.nome", "turmas.etapa"]), span: 3 } as Widget ] } },
  { id: "direcao-escola", sector: "Direção", name: "Minha escola", board: { filters: [], theme: { logo: "educacao" }, widgets: [
    { id: "t1", title: "Total de matrículas", kind: "kpi", spec: q("matriculas", [], []) } as Widget,
    { id: "t2", title: "Turmas por etapa", kind: "donut", spec: q("turmas", [], ["turmas.etapa"]) } as Widget ] } },
];

/** Confere o modelo contra o catálogo real: fonte, joins e campos precisam existir; senão o motivo é dito. */
export function templateProblems(t: BoardTemplate, cat: Catalog): string[] {
  const out: string[] = []; const joins = new Set(cat.joins.map((j) => j.id));
  for (const w of t.board.widgets) {
    if (!cat.sources[w.spec.source]) { out.push(`${w.title}: fonte "${w.spec.source}" não existe no catálogo.`); continue; }
    for (const j of w.spec.joins) if (!joins.has(j)) out.push(`${w.title}: cruzamento "${j}" não existe.`);
    for (const g of w.spec.groupBy) { const [s, f] = g.split("."); if (!cat.sources[s!]?.fields[f!]) out.push(`${w.title}: campo "${g}" não existe.`); }
  }
  return out;
}
