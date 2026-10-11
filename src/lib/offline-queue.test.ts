import { describe, expect, it } from "vitest";
import { applyRetention, enqueue, minimize, onSessionEnd, reconcile, type QueuedAction } from "./offline-queue";

const a = (k: string, extra: Partial<QueuedAction> = {}): QueuedAction => ({ idempotencyKey: k, kind: "registrar-chamada", entityId: "aula1", expectedVersion: 1, payload: {}, createdAt: "2026-10-11T10:00:00Z", official: false, ...extra });
describe("fila móvel", () => {
  it("ato oficial offline recusado", () => {
    expect(enqueue([], a("1", { kind: "aprovar-diario" }), false).ok).toBe(false);
    expect(enqueue([], a("1", { official: true }), false).ok).toBe(false);
  });
  it("duplicidade por chave idempotente", () => {
    const q = enqueue([], a("1"), false).queue;
    const r = enqueue(q, a("1"), false);
    expect(r.ok && r.duplicate).toBe(true);
    expect(r.queue).toHaveLength(1);
  });
  it("reconexão: rede mantém, conflito e negado explícitos, aplicado sai", () => {
    const r = reconcile([a("1"), a("2"), a("3"), a("4")], new Map([["1", { status: "aplicado" }], ["2", { status: "conflito", serverVersion: 3 }], ["3", { status: "negado" }], ["4", { status: "rede" }]] as const));
    expect([r.remaining.map((x) => x.idempotencyKey), r.conflicts.length, r.denied.length]).toEqual([["4"], 1, 1]);
  });
  it("retenção", () => expect(applyRetention([a("1")], "2026-10-12T12:00:00Z", 24).expired).toHaveLength(1));
  it("perda de sessão apaga", () => expect(onSessionEnd([a("1")])).toEqual({ queue: [], discardedCount: 1 }));
  it("minimização", () => expect(minimize({ presenca: "P", nome: "Ana" }, ["presenca"])).toEqual({ presenca: "P" }));
});
