import { describe, expect, it } from "vitest";
import { chartProblems, customChartData, customChartSvg } from "./custom-chart";
import { defaultLayout, renderCustomHtml } from "./custom-layout";
import type { ReportResult } from "../report-engine";

const r: ReportResult = {
  definitionId: "personalizado", version: 1, generatedAt: "2026-10-11T00:00:00Z", params: {}, appliedFilters: [], truncated: false,
  columns: [{ id: "c1", label: "Escola", kind: "text" }, { id: "c2", label: "Matrículas", kind: "number" }],
  rows: [["A", 327], ["B", null], ["C", 24], ["TOTAL GERAL", 351]],
} as unknown as ReportResult;
const c = { kind: "barras" as const, category: "c1", measures: ["c2"], title: "", placement: "antes" as const };

describe("gráfico do gerador personalizado", () => {
  it("ausente fica fora (não vira zero) e total não entra", () => {
    const d = customChartData(r, c);
    if ("refused" in d) throw new Error("recusado");
    expect(d.points.map((p) => p.category)).toEqual(["A", "C"]);
    expect(d.notes.join(" ")).toMatch(/1 categoria\(s\) sem valor/);
    expect(d.notes.join(" ")).toMatch(/subtotal\/total/);
  });
  it("categoria numérica e medida de texto são recusadas", () => {
    expect(chartProblems(r, { ...c, category: "c2" }).join()).toMatch(/texto/);
    expect(chartProblems(r, { ...c, measures: ["c1"] }).join()).toMatch(/não numérica/);
  });
  it("PDF leva o mesmo SVG da prévia e a tabela equivalente", () => {
    const d = customChartData(r, c); if ("refused" in d) throw new Error();
    const svg = customChartSvg(d);
    const html = renderCustomHtml(r, { ...defaultLayout(), chart: c, paper: "A3" }, [], "", { svg, table: d.table, notes: d.notes });
    expect(html).toContain(encodeURIComponent(svg));
    expect(html).toContain("A3 portrait");
    expect(html.indexOf("chartimg")).toBeLessThan(html.indexOf("<thead><tr><th>Escola"));
  });
});
