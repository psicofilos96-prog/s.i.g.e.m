import { describe, expect, it } from "vitest";
import { budgetView, comparableSeries, deviation, expectedOn, goalIssue, publicCell } from "./strategic-plan";

const g = { id: "m1", source: "Lei do PME", homologated: true, baseline: { year: 2015, value: 4 }, target: { year: 2025, value: 6 }, direction: "maior-melhor" as const };
describe("PME e metas", () => {
  it("meta sem fonte ou homologação não existe", () => {
    expect(goalIssue({ ...g, source: null })).toBe("sem-fonte-documental");
    expect(goalIssue({ ...g, homologated: false })).toBe("nao-homologada");
    expect(expectedOn({ ...g, homologated: false }, 2020)).toBeNull();
  });
  it("trajetória esperada", () => expect(expectedOn(g, 2020)).toBe(5));
  it("desvio exige comparável e tolerância", () => {
    expect(deviation(g, { year: 2020, value: 4.5, comparable: false }, 0.2).state).toBe("nao-comparavel");
    expect(deviation(g, { year: 2020, value: 4.5, comparable: true }, null).state).toBe("sem-tolerancia");
    expect(deviation(g, { year: 2020, value: 4.5, comparable: true }, 0.2)).toEqual({ state: "desvio", gap: -0.5 });
  });
  it("série só mesma escala", () =>
    expect(comparableSeries([{ scaleKey: "ideb", year: 2019, value: 5 }, { scaleKey: "saeb", year: 2021, value: 200 }, { scaleKey: "ideb", year: 2021, value: null }], "ideb").excluded).toBe(2));
  it("orçamento sem fonte contábil nunca é zero", () => expect(budgetView(1000, null)).toEqual({ state: "sem-fonte-contabil", planned: 1000 }));
  it("público só autorizado e acima do limiar", () => {
    expect(publicCell(10, 50, null, true).publish).toBe(false);
    expect(publicCell(10, 3, 5, true)).toEqual({ publish: false, reason: "grupo-pequeno" });
  });
});
