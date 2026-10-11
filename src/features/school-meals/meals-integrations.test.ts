import { describe, expect, it } from "vitest";
import { MEALS_INTEGRATIONS, offeredIntegrations } from "./meals-integrations";

describe("integrações da alimentação", () => {
  it("cobre os 7 setores pedidos", () => {
    expect(MEALS_INTEGRATIONS.map((i) => i.id)).toEqual(["secretaria", "direcao", "nei", "supervisao", "orientacao", "estatistica", "familia"]);
  });
  it("NEI nunca expõe dado clínico", () => {
    expect(MEALS_INTEGRATIONS.find((i) => i.id === "nei")!.forbiddenFields).toEqual(expect.arrayContaining(["cid", "laudo", "diagnostico"]));
  });
  it("só oferece integração cuja tela é permitida", () => {
    expect(offeredIntegrations((p) => p === "/familia").map((i) => i.id)).toEqual(["familia"]);
    expect(offeredIntegrations(() => false)).toEqual([]);
  });
});
