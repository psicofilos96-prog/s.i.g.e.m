import { describe, expect, it } from "vitest";
import { deliveryWaveRows } from "./purchase-map";

const ctx = { items: [{ logical_id: "i", payload: { nome: "Arroz" } }], units: [{ logical_id: "u", payload: { simbolo: "kg" } }], contracts: [], suppliers: [], schools: new Map([["s", "E.M. Um"]]) };
const d = (on: string, q: number, action = "programacao") => ({ school_id: "s", item_ref: "i", unidade_ref: "u", contrato_ref: null, quantity: q, expected_on: on, action });

describe("Mapa por entrega", () => {
  it("numera 1ª e 2ª entrega pela data prevista", () => {
    const r = deliveryWaveRows([d("2027-03-20", 6), d("2027-03-05", 4)], ctx);
    expect(r.map((x) => [x["wave"], x["quantity"]])).toEqual([["1ª entrega", 4], ["2ª entrega", 6]]);
  });
  it("ignora programação cancelada e não inventa fornecedor", () => {
    const r = deliveryWaveRows([d("2027-03-05", 4), d("2027-03-06", 9, "cancelamento")], ctx);
    expect(r).toHaveLength(1);
    expect(r[0]?.["supplier"]).toBe("não informado");
  });
});

import { contractBalanceRows } from "./purchase-map";
describe("Saldo dos contratos", () => {
  const c = { items: [], contracts: [], suppliers: [] };
  const sd = (q: number, action = "programacao") => ({ school_id: "s", item_ref: "i", unidade_ref: "u", contrato_ref: "c", quantity: q, expected_on: "2027-03-01", action });
  it("saldo = contratado − programado não cancelado", () => {
    const r = contractBalanceRows([{ logical_id: "p", payload: { contrato_ref: "c", item_ref: "i", quantidade_contratada: 100 } }], [sd(30), sd(50, "cancelamento")], c);
    expect(r[0]?.["balance"]).toBe(70);
  });
  it("sem quantidade contratada o saldo não vira zero", () => {
    const r = contractBalanceRows([{ logical_id: "p", payload: { contrato_ref: "c", item_ref: "i" } }], [sd(30)], c);
    expect(r[0]?.["balance"]).toBeNull();
  });
  it("marca programado acima do contratado", () => {
    const r = contractBalanceRows([{ logical_id: "p", payload: { contrato_ref: "c", item_ref: "i", quantidade_contratada: 10 } }], [sd(30)], c);
    expect(r[0]?.["status"]).toBe("programado acima do contratado");
  });
});
