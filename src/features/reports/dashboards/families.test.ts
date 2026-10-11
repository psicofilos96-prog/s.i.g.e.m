import { describe, expect, it } from "vitest";
import { CHARTS, incompatibility, compatibleKinds, percentStack, pivot, geoPoints, waterfall, type ChartKind } from "./chart-model";
// Linhas sintéticas de teste (não são dados da base)
const grouped1 = { dims: 1, measures: 1, numericColumns: 0, raw: false };
const grouped2 = { dims: 2, measures: 1, numericColumns: 0, raw: false };
describe("famílias de gráficos", () => {
  it("todas as famílias pedidas existem", () => {
    const want: ChartKind[] = ["bar","barh","stacked","stacked100","line","area","pie","donut","scatter","bubble","histogram","heatmap","treemap","radar","funnel","waterfall","boxplot","gauge","combo","pivot","map","table","kpi"];
    for (const k of want) expect(CHARTS[k]).toBeDefined();
  });
  it("compatibilidade: 1 agrupamento + 1 cálculo", () => {
    const k = compatibleKinds(grouped1);
    for (const x of ["bar","barh","line","area","pie","donut","treemap","funnel","radar","waterfall","table"]) expect(k).toContain(x);
    for (const x of ["stacked","pivot","heatmap","scatter","combo","histogram","map"]) expect(k).not.toContain(x);
  });
  it("2 agrupamentos: empilhado, 100%, pivot e calor; pizza recusa", () => {
    const k = compatibleKinds(grouped2);
    for (const x of ["stacked","stacked100","pivot","heatmap"]) expect(k).toContain(x);
    expect(incompatibility("pie", grouped2)).toMatch(/agrupamento/);
  });
  it("misto exige exatamente 2 cálculos", () => {
    expect(incompatibility("combo", { dims: 1, measures: 2, numericColumns: 0, raw: false })).toBeNull();
    expect(incompatibility("combo", grouped1)).toMatch(/2 cálculo/);
  });
  it("mapa recusa sem coordenadas e explica", () => {
    expect(incompatibility("map", { dims: 0, measures: 0, numericColumns: 2, raw: true })).toMatch(/latitude/);
    expect(incompatibility("map", { dims: 0, measures: 0, numericColumns: 2, raw: true, geo: true })).toBeNull();
  });
  it("100% soma 100 e categoria vazia some em vez de 0%", () => {
    const r = percentStack([{ categoria: "A", x: 1, y: 3 }, { categoria: "B" }], ["x", "y"]);
    expect(r).toEqual([{ categoria: "A", x: 25, y: 75 }]);
  });
  it("pivot só totaliza linha completa", () => {
    const p = pivot([{ a: "E1", b: "M", v: 2 }, { a: "E1", b: "T", v: 3 }, { a: "E2", b: "M", v: 4 }], "a", "b", "v");
    expect(p.rowTotal("E1")).toBe(5); expect(p.rowTotal("E2")).toBeNull(); expect(p.cell("E2", "T")).toBeNull();
  });
  it("geocodificação inválida é excluída e contada", () => {
    const g = geoPoints([{ la: -21.2, lo: -41.9 }, { la: 200, lo: 0 }, { la: null, lo: 1 }], "la", "lo");
    expect(g.pts.length).toBe(1); expect(g.excluded).toBe(2);
  });
  it("cascata ignora ausente (não soma zero inventado)", () => {
    const w = waterfall([{ categoria: "a", v: 5 }, { categoria: "b", v: null }, { categoria: "c", v: -2 }], "v");
    expect(w.map((s) => s.categoria)).toEqual(["a", "c", "Total"]); expect(w.at(-1)!.acumulado).toBe(3);
  });
});
