import { describe, it, expect } from "vitest";
import { costByItem, costPerPortion, estimatedVsBooked, lossesByKind, compute, INDICATORS } from "./costs-indicators";

const scope = { schools: ["E1"], from: "2026-03-01", to: "2026-03-31" };
const cons = [
  { schoolId: "E1", date: "2026-03-02", itemId: "arroz", qty: 10, preparationId: "p", source: "baixa:1" },
  { schoolId: "E2", date: "2026-03-02", itemId: "arroz", qty: 99, preparationId: "p", source: "baixa:2" },
  { schoolId: "E1", date: "2026-03-02", itemId: "feijao", qty: 5, preparationId: "p", source: "baixa:3" },
];

describe("custos e indicadores", () => {
  it("custo só no escopo, com origem de preço; sem preço ⇒ null", () => {
    const r = costByItem(cons, [{ itemId: "arroz", unitPrice: 5, origin: "contrato", ref: "c1", validOn: "2026-01-01" }], scope);
    const a = r.find((x) => x.itemId === "arroz")!;
    expect([a.qty, a.estimatedCost, a.priceOrigins]).toEqual([10, 50, ["contrato:c1"]]);
    expect(r.find((x) => x.itemId === "feijao")!.estimatedCost).toBeNull();
    expect(costPerPortion(50, null)).toBeNull();
    expect(costPerPortion(50, 20)).toBe(2.5);
  });
  it("estimado e contabilizado nunca se somam", () => {
    const v = estimatedVsBooked(50, null);
    expect(v.booked.value).toBeNull();
    expect(v.estimated.nature).not.toBe(v.booked.nature);
  });
  it("perdas por tipo, não classificada listada", () => {
    const l = lossesByKind([{ kind: "validade", qty: 2, itemId: "a", ref: "m1" }, { kind: "outro", qty: 1, itemId: "a", ref: "m2" }]);
    expect(l.byKind.validade.qty).toBe(2);
    expect(l.unclassified).toEqual(["m2"]);
  });
  it("indicador declara fórmula e distingue não informado, sem denominador e calculado", () => {
    expect(INDICATORS).toHaveLength(8);
    expect(compute("cobertura", null, 10, [], "2026-03").state).toBe("nao-informado");
    expect(compute("cobertura", 0, 0, [], "2026-03").state).toBe("sem-denominador");
    const c = compute("cobertura", 90, 100, ["x"], "2026-03");
    expect(c).toMatchObject({ state: "calculado", value: 0.9, drill: ["x"] });
  });
});
