import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { UNKNOWN, balanceOn, convert, monthCard, observedVsTheoretical, suggestLotsByExpiry, theoreticalConsumption, type Movement } from "./stock-model";

const sql = readFileSync("drizzle/migrations/0185_nae4_meal_stock_operational.sql", "utf8");
let n = 0;
const mv = (o: Partial<Movement>): Movement => ({ id: String(n++), event_kind: "registro", movement_class: "entrada-aceite", sign: 1, item_value_id: "arroz", unit_value_id: "kg",
  lot: null, expires_on: null, quantity: 10, moved_on: "2027-03-05", superseded: false, ...o });

describe("NAE.4 saldo derivado", () => {
  it("aceite 7 entra 7; consumo observado baixa", () => {
    expect(balanceOn([mv({ quantity: 7 }), mv({ movement_class: "consumo-observado", sign: -1, quantity: 2 })], "arroz", "kg", "2027-03-31")).toBe(5);
  });
  it("carry-forward: saldo inicial de abril = fim de março", () => {
    const ms = [mv({ quantity: 10 }), mv({ movement_class: "consumo-observado", sign: -1, quantity: 3, moved_on: "2027-03-20" }), mv({ quantity: 4, moved_on: "2027-04-02" })];
    expect(monthCard(ms, "arroz", "kg", "2027-04")).toMatchObject({ opening: 7, entries: 4, exits: 0, closing: 11 });
  });
  it("retificação substitui sem apagar: versão superada não conta", () => {
    expect(balanceOn([mv({ quantity: 10, superseded: true }), mv({ quantity: 8, event_kind: "retificacao" })], "arroz", "kg", "2027-12-31")).toBe(8);
  });
  it("ajuste posterior não altera saldo passado", () => {
    const ms = [mv({ quantity: 10 }), mv({ movement_class: "ajuste-inventario", sign: -1, quantity: 1, moved_on: "2027-04-10" })];
    expect(balanceOn(ms, "arroz", "kg", "2027-03-31")).toBe(10);
    expect(balanceOn(ms, "arroz", "kg", "2027-04-30")).toBe(9);
  });
  it("sinal desconhecido ⇒ UNKNOWN; sem movimento ⇒ zero real", () => {
    expect(balanceOn([mv({ sign: null, movement_class: "ajuste-legado" })], "arroz", "kg", "2027-12-31")).toBe(UNKNOWN);
    expect(balanceOn([], "arroz", "kg", "2027-12-31")).toBe(0);
  });
  it("unidade diferente não é somada", () => expect(balanceOn([mv({ unit_value_id: "pacote-5kg" })], "arroz", "kg", "2027-12-31")).toBe(0));
  it("lote/validade e PVPS só sugere", () => {
    const s = suggestLotsByExpiry([{ lot: "B", expires_on: "2027-06-01", balance: 2 }, { lot: "A", expires_on: "2027-05-01", balance: 1 }, { lot: "C", expires_on: null, balance: 0 }]);
    expect(s.map((x) => x.lot)).toEqual(["A", "B"]);
  });
  it("conversão ausente ⇒ UNKNOWN; sintética homologada aplica", () => {
    expect(convert(2, null)).toBe(UNKNOWN);
    expect(convert(2, 5)).toBe(10);
  });
  it("teórico é análise e não depende de movimento", () => {
    expect(theoreticalConsumption(100, null)).toBe(UNKNOWN);
    expect(observedVsTheoretical(12, theoreticalConsumption(100, 0.1))).toBeCloseTo(2);
  });
});

describe("NAE.4 invariantes do banco", () => {
  it("saldo não é coluna: nenhuma tabela com balance editável", () => expect(sql).not.toMatch(/ADD COLUMN balance/));
  it("writer não aceita entrada-aceite (só pelo recebimento, idempotente)", () => expect(sql).toMatch(/_class NOT IN \('consumo-observado','perda','devolucao','ajuste-inventario'\)/));
  it("ajuste exige contagem e motivo", () => { expect(sql).toMatch(/meal:count-required/); expect(sql).toMatch(/meal:count-not-approved/); });
  it("unidade incompatível recusada", () => expect(sql).toMatch(/meal:unit-incompatible/));
  it("negativo nunca silencioso", () => { expect(sql).toMatch(/negative-balance-blocked/); expect(sql).toMatch(/negative-balance-requires-reason/); });
  it("base de estoque não é escolhida pelo sistema", () => expect(sql).toMatch(/STOCK_BASIS_POLICY_PENDING/));
  it("sem estoque mínimo", () => expect(sql).not.toMatch(/estoque-minimo|minimum_stock/));
  it("fechamento guarda manifesto com hash", () => expect(sql).toMatch(/manifest_sha256/));
  it("data do movimento não usa CURRENT_DATE", () => {
    const w = sql.slice(sql.indexOf("FUNCTION public.record_meal_stock_movement"), sql.indexOf("FUNCTION public.record_meal_stock_transfer"));
    expect(w).not.toMatch(/CURRENT_DATE/);
  });
});
