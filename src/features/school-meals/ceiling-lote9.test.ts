import { describe, expect, it } from "vitest";
import { authorizationNeeds, explainServerLine, type ServerCeilingLine } from "./ceiling-explain";

const base: ServerCeilingLine = { linha: 1, item_ref: "i", estado: "calculado", faltas: [], solicitado: 80, per_capita: 0.1, per_capita_registro: "p", per_capita_versao: 3,
  publico_atendido: 10, dias_letivos: 20, estoque: 54, bruto: 20, teto: 0, excede: true, justificativa_excesso: null, formula: "" };

describe("teto do pedido avaliado no banco", () => {
  it("excesso calculado exige justificativa por linha", () => {
    expect(authorizationNeeds([base]).exceeding).toEqual([1]);
    expect(authorizationNeeds([{ ...base, justificativa_excesso: "Reposição de entrega" }]).exceeding).toEqual([]);
  });
  it("teto pendente exige ciência, nunca vira zero", () => {
    const p = { ...base, estado: "pendente" as const, faltas: ["estoque sem registro no livro (desconhecido, não zero)"], teto: null, bruto: null, excede: null };
    expect(authorizationNeeds([p])).toEqual({ ackRequired: true, exceeding: [], blocked: null });
    expect(explainServerLine(p)).toContain("estoque sem registro");
  });
  it("explica a conta com os números do banco", () => {
    expect(explainServerLine(base)).toBe("0.1 × 10 × 20 = 20 − estoque 54 ⇒ teto 0 · pedido 80 excede.");
  });
});
