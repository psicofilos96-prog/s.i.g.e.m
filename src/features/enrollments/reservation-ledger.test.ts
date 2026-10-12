import { describe, expect, it } from "vitest";
import { activeHolds, memoryStore, reservationOp, statusOf } from "./reservation-ledger";

const actor = { personId: "p-sec", isHuman: true, capabilities: ["reservar-vaga"] };
const pol = { requiredCapability: "reservar-vaga", holdDays: 5 };
const op = (i: number, x: Record<string, unknown> = {}) => ({ kind: "criar" as const, cellKey: "K", reservationId: `r${i}`, studentRef: `s${i}`, idempotencyKey: `k${i}`, reason: "m", on: "2027-01-10", at: "2027-01-10T10:00:00Z", readCeiling: async () => 3, ...x });

describe("Reservas concorrentes L10", () => {
  it("corrida: 40 pedidos simultâneos para 3 vagas ⇒ exatamente 3 reservas", async () => {
    const s = memoryStore();
    const res = await Promise.all(Array.from({ length: 40 }, (_, i) => reservationOp(s, op(i), actor, pol, 100)));
    expect(res.filter((r) => r.ok).length).toBe(3);
    expect(activeHolds(s.all("K"), "2027-01-10").length).toBe(3);
  });
  it("idempotência: mesma chave repetida em paralelo grava uma vez", async () => {
    const s = memoryStore();
    const res = await Promise.all(Array.from({ length: 10 }, () => reservationOp(s, op(1), actor, pol, 100)));
    expect(res.every((r) => r.ok)).toBe(true);
    expect(s.all("K").length).toBe(1);
    expect(res.filter((r) => r.ok && r.replay).length).toBe(9);
  });
  it("confirmação e cancelamento concorrentes: só um vence", async () => {
    const s = memoryStore(); await reservationOp(s, op(1), actor, pol);
    const [a, b] = await Promise.all([
      reservationOp(s, op(1, { kind: "confirmar", idempotencyKey: "c1" }), actor, pol, 100),
      reservationOp(s, op(1, { kind: "cancelar", idempotencyKey: "x1" }), actor, pol, 100),
    ]);
    expect([a.ok, b.ok].filter(Boolean).length).toBe(1);
    expect(s.all("K").length).toBe(2);
  });
  it("vencimento libera vaga sem apagar evento; vencida não confirma", async () => {
    const s = memoryStore();
    for (let i = 0; i < 3; i++) await reservationOp(s, op(i), actor, pol);
    expect((await reservationOp(s, op(9), actor, pol)).ok).toBe(false);
    expect(statusOf(s.all("K"), "r0", "2027-01-16")).toBe("vencida");
    expect((await reservationOp(s, op(9, { on: "2027-01-16" }), actor, pol)).ok).toBe(true);
    expect((await reservationOp(s, op(0, { kind: "confirmar", idempotencyKey: "c0", on: "2027-01-16" }), actor, pol)).ok).toBe(false);
  });
  it("recusas: sem prazo homologado, competência, teto não lido, executor técnico, estudante duplicado", async () => {
    const s = memoryStore();
    expect((await reservationOp(s, op(1), actor, { ...pol, holdDays: null })).ok).toBe(false);
    expect((await reservationOp(s, op(1), actor, { ...pol, requiredCapability: null })).ok).toBe(false);
    expect((await reservationOp(s, op(1, { readCeiling: async () => null }), actor, pol)).ok).toBe(false);
    expect((await reservationOp(s, op(1), { ...actor, isTechnicalExecutor: true }, pol)).ok).toBe(false);
    await reservationOp(s, op(1), actor, pol);
    expect((await reservationOp(s, op(2, { studentRef: "s1" }), actor, pol)).ok).toBe(false);
    expect((await reservationOp(s, op(3, { idempotencyKey: "k1" }), actor, pol)).ok).toBe(false);
  });
});
