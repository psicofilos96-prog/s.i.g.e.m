import { describe, expect, it } from "vitest";
import { isPlannedItem, plannedFirst } from "./planned-consumption";

describe("baixa a partir do cardápio previsto", () => {
  it("reconhece item citado ignorando acento e caixa", () => {
    expect(isPlannedItem("Feijão", "Arroz, FEIJAO carioca")).toBe(true);
    expect(isPlannedItem("Leite", "Arroz, feijão")).toBe(false);
  });
  it("sem cardápio previsto nada é marcado", () => {
    expect(isPlannedItem("Arroz", null)).toBe(false);
  });
  it("previstos vêm primeiro mantendo a ordem PVPS e o índice original", () => {
    const r = plannedFirst([{ item: "Leite" }, { item: "Arroz" }, { item: "Óleo" }, { item: "Feijão" }], "arroz e feijão");
    expect(r.map((x) => [x.line.item, x.index])).toEqual([["Arroz", 1], ["Feijão", 3], ["Leite", 0], ["Óleo", 2]]);
  });
});
