import { describe, expect, it } from "vitest";
import { aggregate, chartData, chartIssues, derive, flatten, layoutIssues, organize, pivot, previewNotice, validateOrganization, DEFAULT_LAYOUT, type Organization, type Row } from "./report-analytics";
import type { ColumnDef } from "./report-engine";

const cols: ColumnDef[] = [{ id: "school", label: "Escola", kind: "text" }, { id: "stage", label: "Etapa", kind: "text" }, { id: "n", label: "Alunos", kind: "number" }, { id: "cpf", label: "CPF", kind: "text", sensitive: true }];
const rows: Row[] = [
  { school: "A", stage: "EF", n: 10 }, { school: "A", stage: "EI", n: 5 }, { school: "B", stage: "EF", n: null }, { school: "B", stage: "EI", n: 7 },
];
const org: Organization = { groupBy: ["school", "stage"], measures: [{ id: "c", label: "Linhas", agg: "count", column: null }, { id: "s", label: "Soma", agg: "sum", column: "n" }],
  derived: [{ id: "p", label: "%", op: "percentual", a: "s", b: "c" }], sort: [{ key: "s", dir: "desc" }], subtotals: true, grandTotal: true };

describe("cálculos seguros", () => {
  it("ausente nunca vira zero", () => {
    expect(aggregate([{ n: null }], { id: "s", label: "", agg: "sum", column: "n" })).toEqual({ value: null, absent: 1 });
    expect(aggregate(rows, { id: "s", label: "", agg: "sum", column: "n" })).toEqual({ value: 22, absent: 1 });
  });
  it("divisão por zero é ausente", () => { expect(derive("razao", 5, 0)).toBeNull(); expect(derive("variacao", 12, 10)).toBe(20); });
  it("recusa cálculo fora da whitelist e coluna sensível", () => {
    const bad = { ...org, measures: [{ id: "x", label: "", agg: "exec" as never, column: "n" }, { id: "y", label: "", agg: "distinct" as const, column: "cpf" }] , derived: [], sort: [] };
    const e = validateOrganization(cols, bad);
    expect(e.some((m) => m.includes("não permitido"))).toBe(true);
    expect(e.some((m) => m.includes("sensível"))).toBe(true);
  });
  it("sum exige coluna numérica", () => {
    expect(validateOrganization(cols, { ...org, measures: [{ id: "s", label: "", agg: "sum", column: "school" }], derived: [], sort: [] })[0]).toContain("numérica");
  });
});

describe("agrupamento", () => {
  it("multinível com subtotais e total geral", () => {
    const o = organize(rows, org);
    expect(o.total?.values["s"]).toBe(22);
    expect(o.groups.map((g) => g.keys["school"])).toEqual(["A", "B"]);
    const flat = flatten(o, org);
    expect(flat.filter((r) => r._kind === "subtotal")).toHaveLength(2);
    expect(flat.at(-1)?._kind).toBe("total");
    const b = o.groups.find((g) => g.keys["school"] === "B")!;
    expect(b.values["s"]).toBe(7); expect(b.absent["s"]).toBe(1);
  });
  it("pivot", () => {
    const p = pivot(rows, "school", "stage", { id: "s", label: "", agg: "sum", column: "n" });
    expect("rows" in p && p.rows[1]!.cells).toEqual([null, 7]);
  });
  it("grande volume", () => {
    const big: Row[] = Array.from({ length: 50_000 }, (_, i) => ({ school: `E${i % 55}`, stage: i % 2 ? "EF" : "EI", n: 1 }));
    const o = organize(big, org);
    expect(o.groups).toHaveLength(55); expect(o.total?.values["s"]).toBe(50_000);
  });
});

describe("gráficos", () => {
  const one: Organization = { ...org, groupBy: ["school"] };
  it("tabela acessível equivalente e ausência explícita", () => {
    const o = organize(rows, one);
    const d = chartData({ kind: "barras", category: "school", measures: ["s"], title: "t" }, one, o, "turmas");
    expect(d.table.rows).toEqual([["A", "15"], ["B", "7"]]);
    expect(d.methodology).toContain("Fonte: turmas");
  });
  it("pizza recusada fora de composição e linha só temporal", () => {
    const o = organize(rows, one);
    expect(chartIssues({ kind: "donut", category: "school", measures: ["p"], title: "" }, one, o).length).toBeGreaterThan(0);
    expect(chartIssues({ kind: "linha", category: "school", measures: ["s"], title: "" }, one, o)[0]).toContain("temporal");
  });
  it("ranking é descritivo", () => {
    const o = organize(rows, one);
    expect(chartData({ kind: "ranking", category: "school", measures: ["s"], title: "" }, one, o, "x").notes.join(" ")).toContain("não é avaliação");
  });
});

describe("layout e prévia", () => {
  it("QR aceito com endpoint de verificação; muitas colunas exigem paisagem", () => {
    const e = layoutIssues({ ...DEFAULT_LAYOUT, title: "R", verificationQr: true }, 12);
    expect(e.some((m) => m.includes("QR"))).toBe(false);
    expect(e.some((m) => m.includes("paisagem"))).toBe(true);
  });
  it("prévia declara amostra", () => {
    expect(previewNotice(20, 900, false)).toContain("amostra de 20 de 900");
  });
});
