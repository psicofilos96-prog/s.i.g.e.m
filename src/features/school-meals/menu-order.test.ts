import { describe, expect, it } from "vitest";
import { menuIngredientsMissing, menuIngredientsOfMonth } from "./planned-consumption";
import type { CyclePayload } from "./menu-cycle";

const cycle: CyclePayload = { competencia: "2027-03", tipo: "ciclo-4-semanas", modalidade: "Parcial", condicao: "Geral",
  entradas: [{ semana: 1, dia: 0, refeicao: "Almoço", preparacao: "Arroz e feijão", ingredientes: ["Arroz", "Feijão"] }, { semana: 2, dia: 0, refeicao: "Almoço", preparacao: "Macarrão", ingredientes: ["Macarrão"] }],
  cronograma: [{ semana: 1, de: "2027-03-01", ate: "2027-03-05" }, { semana: 2, de: "2027-04-05", ate: "2027-04-09" }] };

describe("Cardápio × pedido", () => {
  it("lista só ingredientes das semanas do mês e da modalidade", () => {
    expect(menuIngredientsOfMonth([cycle], "Parcial", "2027-03")).toEqual(["Arroz", "Feijão"]);
    expect(menuIngredientsOfMonth([cycle], "EJA", "2027-03")).toEqual([]);
  });
  it("aponta ingrediente sem item no pedido", () => {
    expect(menuIngredientsMissing(["Arroz", "Feijão"], ["Arroz tipo 1"])).toEqual(["Feijão"]);
  });
});
