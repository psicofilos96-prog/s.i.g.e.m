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
