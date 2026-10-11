import { describe, it, expect } from "vitest";
import { planExit, reserve, block, inventoryAdjustment, rectify, auditTrail, idempotencyKey, lossEntry, type Lot, type Entry } from "./stock-lots";

const L = (lot: string, expiresOn: string | null, balance: number, extra: Partial<Lot> = {}): Lot => ({ depot: "D", itemId: "arroz", lot, expiresOn, balance, blocked: null, reserved: 0, ...extra });
const lots = [L("b", "2026-06-01", 10), L("a", "2026-04-01", 5), L("v", "2026-02-01", 50), L("x", "2026-03-15", 50, { blocked: { reason: "vistoria" } })];

describe("estoque por lote", () => {
  it("FEFO pula vencido e bloqueado; insuficiente recusa sem saldo negativo", () => {
    expect(planExit(lots, { depot: "D", itemId: "arroz", qty: 8, on: "2026-03-01", fefo: true })).toEqual({ ok: true, picks: [{ lot: "a", qty: 5 }, { lot: "b", qty: 3 }] });
    const r = planExit(lots, { depot: "D", itemId: "arroz", qty: 16, on: "2026-03-01", fefo: true });
    expect(r.ok === false && r.reason).toContain("saldo negativo");
    expect(planExit(lots, { depot: "D", itemId: "arroz", qty: 1, on: "2026-03-01", fefo: false, lot: "v" })).toEqual({ ok: false, reason: "lote vencido não pode ser consumido" });
    expect(planExit(lots, { depot: "D", itemId: "arroz", qty: 1, on: "2026-03-01", fefo: false, lot: "x" }).ok).toBe(false);
  });
  it("reserva reduz disponível; bloqueio e perda exigem motivo", () => {
    const r = reserve(L("a", null, 5), 4, "2026-03-01") as Lot;
    expect(planExit([r], { depot: "D", itemId: "arroz", qty: 2, on: "2026-03-01", fefo: true }).ok).toBe(false);
    expect(block(r, " ")).toEqual({ error: "bloqueio sanitário exige motivo" });
    expect(lossEntry(r, 1, "")).toEqual({ error: "perda exige justificativa" });
  });
  it("inventário gera ajuste justificado por pessoa distinta", () => {
    expect(inventoryAdjustment(L("a", null, 5), 5, { reason: "", counterId: "c", approverId: "c" })).toBeNull();
    expect(inventoryAdjustment(L("a", null, 5), 3, { reason: "quebra", counterId: "c", approverId: "c" })).toEqual({ error: "aprovador deve ser distinto de quem contou" });
    expect(inventoryAdjustment(L("a", null, 5), 3, { reason: "quebra", counterId: "c", approverId: "d" })).toMatchObject({ kind: "ajuste", qty: -2 });
  });
  it("retificação por estorno, sem duplo estorno; trilha confere seq e saldo; chave idempotente estável", () => {
    const led: Entry[] = [{ id: "1", seq: 1, kind: "entrada", depot: "D", itemId: "arroz", lot: "a", qty: 5, reason: null, reverses: null }];
    const e = rectify(led, "1", "nota errada");
    expect(e).toMatchObject({ kind: "estorno", qty: -5, reverses: "1" });
    expect(rectify([...led, { ...(e as Entry), id: "2", seq: 2 }], "1", "x")).toEqual({ error: "lançamento já estornado" });
    expect(auditTrail([{ ...led[0]!, kind: "saida" }])).toEqual(["saldo negativo em D|arroz|a após seq 1"]);
    expect(idempotencyKey("saida", "D", "arroz", "a", "r1")).toBe(idempotencyKey("saida", "D", "arroz", "a", "r1"));
  });
});
