import { describe, expect, it } from "vitest";
import { boxplot, categorySeries, compatibleKinds, drillCondition, heatmap, histogram, incompatibility, waterfall } from "./chart-model";

describe("painéis — compatibilidade", () => {
  it("pizza exige 1 agrupamento e 1 cálculo", () => {
    expect(incompatibility("pie", { dims: 1, measures: 1, numericColumns: 0, raw: false })).toBeNull();
    expect(incompatibility("pie", { dims: 2, measures: 1, numericColumns: 0, raw: false })).toMatch(/1 agrupamento/);
  });
  it("histograma e boxplot só sobre linhas com coluna numérica", () => {
    expect(incompatibility("histogram", { dims: 1, measures: 1, numericColumns: 0, raw: false })).toMatch(/valores individuais/);
    expect(incompatibility("histogram", { dims: 0, measures: 0, numericColumns: 1, raw: true })).toBeNull();
    expect(incompatibility("boxplot", { dims: 0, measures: 0, numericColumns: 0, raw: true })).toMatch(/numérica/);
  });
  it("dispersão exige 2 cálculos e bolhas 3", () => {
    const k = compatibleKinds({ dims: 1, measures: 2, numericColumns: 0, raw: false });
    expect(k).toContain("scatter"); expect(k).not.toContain("bubble"); expect(k).not.toContain("pie");
  });
  it("mapa de calor exige 2 agrupamentos", () => {
    expect(compatibleKinds({ dims: 2, measures: 1, numericColumns: 0, raw: false })).toContain("heatmap");
  });
});

describe("painéis — dados sem invenção", () => {
  it("valor ausente fica fora e é contado, nunca zero", () => {
    const r = categorySeries([{ e: "A", n: 3 }, { e: "B", n: null }, { e: null, n: 2 }], "e", ["n"]);
    expect(r.data).toEqual([{ categoria: "A", n: 3 }, { categoria: "B" }, { categoria: "(sem registro)", n: 2 }]);
    expect(r.excluded).toBe(1);
  });
  it("linhas de subtotal do servidor não entram no gráfico", () => {
    expect(categorySeries([{ e: "A", n: 3 }, { e: null, n: 3, __rollup: true }], "e", ["n"]).data).toHaveLength(1);
  });
  it("histograma conta por faixa e exclui não numéricos", () => {
    const h = histogram([0, 5, 10, "x", null], 2);
    expect(h.data.map((d) => d.quantidade)).toEqual([1, 2]); expect(h.excluded).toBe(2);
  });
  it("boxplot com quartis tipo 7", () => {
    const b = boxplot([1, 2, 3, 4, 5].map((v) => ({ v })), "v").data[0]!;
    expect([b.min, b.q1, b.mediana, b.q3, b.max]).toEqual([1, 2, 3, 4, 5]);
  });
  it("cascata acumula e fecha com total", () => {
    const w = waterfall([{ categoria: "a", v: 10 }, { categoria: "b", v: -4 }], "v");
    expect(w.map((x) => x.acumulado)).toEqual([10, 6, 6]); expect(w[1]).toMatchObject({ base: 6, valor: 4, sinal: -1 });
  });
  it("mapa de calor: célula sem dado é null", () => {
    const h = heatmap([{ x: "a", y: "1", m: 2 }, { x: "b", y: "2", m: 5 }], "x", "y", "m");
    expect(h.cell("a", "1")).toBe(2); expect(h.cell("a", "2")).toBeNull(); expect(h.max).toBe(5);
  });
  it("drill-down de categoria sem registro filtra por ausência", () => {
    expect(drillCondition("escolas.nome", "(sem registro)")).toEqual({ field: "escolas.nome", operator: "is_null" });
    expect(drillCondition("escolas.nome", "X")).toEqual({ field: "escolas.nome", operator: "eq", value: "X" });
  });
});
