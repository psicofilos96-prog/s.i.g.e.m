import { describe, expect, it } from "vitest";
import { checkRequest, convert, explainCeiling } from "./ceiling-explain";

const full = { perCapitaGrams: 50, perCapitaHomologated: true, servedPublic: 100, schoolDays: 20, eligibleStockGrams: 10000, pendingDeliveriesGrams: 5000 };

describe("ALIM-03 teto explicado", () => {
  it("conversão exata só com fator homologado", () => {
    expect(convert(3, { from: "pacote", to: "g", numerator: 5000, denominator: 1, homologated: true })).toBe(15000);
    expect(convert(3, { from: "pacote", to: "g", numerator: 5000, denominator: 1, homologated: false })).toBeNull();
  });
  it("teto = per capita × público × dias − estoque − pendências", () => {
    const c = explainCeiling(full);
    expect(c).toMatchObject({ state: "calculado", grossGrams: 100000, netGrams: 85000 });
  });
  it("per capita não homologado deixa pendente, não zero", () => {
    expect(explainCeiling({ ...full, perCapitaHomologated: false })).toEqual({ state: "pendente", missing: ["per capita não homologado"] });
  });
  it("teto pendente não bloqueia envio, mas impede autorização definitiva", () => {
    const r = checkRequest(1000, explainCeiling({ ...full, schoolDays: null }), false, null);
    expect(r.canAuthorize).toBe(false);
    expect(r.warnings[0]).toMatch(/dias letivos/);
  });
  it("item essencial zerado exige justificativa, sem forçar quantidade", () => {
    const c = explainCeiling(full);
    expect(checkRequest(0, c, true, null).canAuthorize).toBe(false);
    expect(checkRequest(0, c, true, "saldo suficiente conferido").canAuthorize).toBe(true);
  });
  it("acima do teto é sinalizado", () => {
    expect(checkRequest(90000, explainCeiling(full), false, null).warnings[0]).toMatch(/excede/);
  });
});
