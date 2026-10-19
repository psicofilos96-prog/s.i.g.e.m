import { describe, expect, it } from "vitest";
import { distributionMapRows, distributionTotals } from "./purchase-map";

const ctx = { items: [{ logical_id: "i1", payload: { nome: "Arroz" } }, { logical_id: "i2", payload: { nome: "Feijão" } }], units: [{ logical_id: "u", payload: { simbolo: "kg" } }],
  contracts: [{ logical_id: "c", payload: { natureza: "Ata", numero: "12/2027", fornecedor_ref: "f", precos: { i1: 5.5 } } }], suppliers: [{ logical_id: "f", payload: { nome: "Fornecedor A" } }],
  schools: new Map([["s1", "E.M. Um"], ["s2", "E.M. Dois"]]) };
const cons = [
  { item_ref: "i1", unidade_ref: "u", apresentacao_ref: null, contrato_ref: "c", total: 30, by_school: { s1: 10, s2: 20 } },
  { item_ref: "i2", unidade_ref: "u", apresentacao_ref: null, contrato_ref: "c", total: 4, by_school: { s1: 4 } },
];

describe("Mapa de distribuição por fornecedor", () => {
  const rows = distributionMapRows(cons, ctx);
  it("uma linha por escola × item com valor = preço × quantidade", () => {
    expect(rows.find((r) => r["school"] === "E.M. Dois" && r["item"] === "Arroz")?.["value"]).toBe(110);
  });
  it("item sem preço no contrato fica sem valor, nunca zero", () => {
    expect(rows.find((r) => r["item"] === "Feijão")?.["value"]).toBeNull();
  });
  it("total por fornecedor marca incompleto quando falta preço", () => {
    expect(distributionTotals(rows)).toEqual([{ supplier: "Fornecedor A", total: 165, complete: false }]);
  });
});

describe("preço contratado por item (homologado)", () => {
  it("prevalece e preenche item sem preço", () => {
    const rows = distributionMapRows(cons, { ...ctx, prices: [{ logical_id: "p", payload: { contrato_ref: "c", item_ref: "i2", preco_unitario: 8 } }] });
    expect(rows.find((r) => r["item"] === "Feijão")?.["value"]).toBe(32);
  });
});
