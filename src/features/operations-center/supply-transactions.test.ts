import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { balance, type Movement } from "./supply-stock";
import { canDecideAdjustment, idempotent, isFoodCategory, serialize, SUPPLY_TX_WRITERS } from "./supply-transactions";

const SQL = readFileSync("drizzle/migrations/0421_ops14_supply_transactions.sql", "utf8");
const E: Movement = { id: "e1", itemKey: "papel", kind: "entrada", quantity: 10, lot: null, expiresOn: null, occurredOn: "2026-10-01", reversesId: null };

describe("Centro de Operações L14 — transações do almoxarifado", () => {
  it("concorrência: pedidos em série nunca deixam saldo negativo", () => {
    const ms = [E];
    expect(serialize(ms, "papel", [{ id: "a", quantity: 6 }, { id: "b", quantity: 6 }, { id: "c", quantity: 4 }])).toEqual([{ id: "a", ok: true }, { id: "b", ok: false }, { id: "c", ok: true }]);
    expect(balance(ms, "papel")).toBe(0);
  });
  it("idempotência estrita", () => {
    const r = { key: "k", warehouseId: "w", itemKey: "papel", kind: "saida", quantity: 2, actor: "p" };
    expect(idempotent(undefined, r)).toBe("novo");
    expect(idempotent(r, { ...r })).toBe("repetido");
    expect(idempotent(r, { ...r, quantity: 3 })).toBe("conflito");
  });
  it("ajuste: outra pessoa, decisão, saldo inalterado", () => {
    const a = { requesterPerson: "req", balanceAtRequest: 10, direction: "saida" as const, quantity: 3 };
    expect(canDecideAdjustment(a, "req", 10, "aprovado", "Despacho 1").ok).toBe(false);
    expect(canDecideAdjustment(a, "dir", 9, "aprovado", "Despacho 1").ok).toBe(false);
    expect(canDecideAdjustment(a, "dir", 10, "recusado", "Despacho 1").ok).toBe(false);
    expect(canDecideAdjustment(a, "dir", 10, "aprovado", "Despacho 1").ok).toBe(true);
  });
  it("transferência preserva a soma; gênero alimentício fica fora", () => {
    const ms: Movement[] = [{ ...E, id: "w1e" }, { ...E, id: "t-out", kind: "transferencia-saida", quantity: 4 }];
    const dest: Movement[] = [{ ...E, id: "t-in", kind: "transferencia-entrada", quantity: 4 }];
    expect(balance(ms, "papel") + balance(dest, "papel")).toBe(10);
    expect(isFoodCategory("Gêneros alimentícios")).toBe(true);
    expect(isFoodCategory("Limpeza")).toBe(false);
  });
  it("banco: writers, locks, recusas e nenhum vínculo ao livro do NAE", () => {
    for (const r of ["opssm:idempotency-mismatch", "opssm:kind-requires-own-flow", "opssadj:self-authorization", "opssadj:stale-balance", "opssm:negative-balance", "ops_supply_not_food", "least(_from,_to)"]) expect(SQL).toContain(r);
    expect(SQL).toMatch(/REVOKE ALL ON FUNCTION public\.ops_supply_insert[^;]*authenticated/);
    expect(SQL).not.toMatch(/meal_inventory_movements|meal_stock/);
    for (const w of SUPPLY_TX_WRITERS) expect(SQL).toMatch(new RegExp(`FUNCTION public\\.${w}\\(`));
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
