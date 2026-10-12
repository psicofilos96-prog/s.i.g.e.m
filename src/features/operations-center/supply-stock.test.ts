import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { balance, canMove, lotBalances, SUPPLY_WRITERS, type Movement } from "./supply-stock";

const SQL = readFileSync("drizzle/migrations/0420_ops13_supply_stock.sql", "utf8");
const M = (x: Partial<Movement>): Movement => ({ id: "m", itemKey: "papel-a4", kind: "entrada", quantity: 10, lot: null, expiresOn: null, occurredOn: "2026-10-01", reversesId: null, ...x });
const LOT = { tracksLot: true, tracksExpiry: true, approved: true, active: true };

describe("Centro de Operações L13 — almoxarifado", () => {
  it("saldo deriva de movimentos válidos; estorno anula sem apagar", () => {
    const ms = [M({ id: "e1" }), M({ id: "s1", kind: "saida", quantity: 4 }), M({ id: "x1", kind: "estorno", quantity: 4, reversesId: "s1" })];
    expect(balance(ms, "papel-a4")).toBe(10);
    expect(balance(ms.slice(0, 2), "papel-a4")).toBe(6);
  });
  it("lote/validade: obrigatório quando exigido; vencido não sai; nunca negativo", () => {
    const ms = [M({ id: "e1", itemKey: "alcool", lot: "L1", expiresOn: "2026-09-30" }), M({ id: "e2", itemKey: "alcool", lot: "L2", expiresOn: "2027-01-01", quantity: 3 })];
    expect(lotBalances(ms, "alcool", "2026-10-12")).toEqual([{ lot: "L1", expiresOn: "2026-09-30", quantity: 10, expired: true }, { lot: "L2", expiresOn: "2027-01-01", quantity: 3, expired: false }]);
    expect(canMove(LOT, ms, { itemKey: "alcool", kind: "entrada", quantity: 1, lot: "L3", expiresOn: null, on: "2026-10-12", hasDoc: true }).ok).toBe(false);
    expect(canMove(LOT, ms, { itemKey: "alcool", kind: "saida", quantity: 1, lot: "L1", expiresOn: null, on: "2026-10-12", destination: "Sala 3" }).ok).toBe(false);
    expect(canMove(LOT, ms, { itemKey: "alcool", kind: "descarte", quantity: 10, lot: "L1", expiresOn: null, on: "2026-10-12", reason: "Lote vencido em 30/09" }).ok).toBe(true);
    expect(canMove(LOT, ms, { itemKey: "alcool", kind: "saida", quantity: 4, lot: "L2", expiresOn: null, on: "2026-10-12", destination: "Sala 3" }).ok).toBe(false);
    expect(canMove({ ...LOT, approved: false }, ms, { itemKey: "alcool", kind: "entrada", quantity: 1, lot: "L2", expiresOn: "2027-01-01", on: "2026-10-12", hasDoc: true }).ok).toBe(false);
  });
  it("banco: entrada com documento, saldo sob lock, sem saldo gravado, sem DML direto", () => {
    expect(SQL).toMatch(/kind <> 'entrada' OR source_doc_ref IS NOT NULL/);
    expect(SQL).toMatch(/pg_advisory_xact_lock/);
    for (const r of ["opssm:negative-balance", "opssm:expired-lot", "opssm:item-not-approved", "opssi:self-approval", "opssi:unit-change"]) expect(SQL).toContain(r);
    expect(SQL).not.toMatch(/CREATE TABLE public\.\w*balance/);
    expect(SQL).not.toMatch(/meal_stock/);
    for (const w of SUPPLY_WRITERS) expect(SQL).toMatch(new RegExp(`FUNCTION public\\.${w}\\(`));
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
