import { describe, expect, it } from "vitest";
import { applyWriterResult, transferStep, type TActor, type TContext, type TransferCase, type TransferEvent, type TStage } from "./transfer-flow";

const c: TransferCase = { caseId: "t1", kind: "escola", participationId: "part", originAllocationId: "a1", originSchoolId: "E1", destSchoolId: "E2", destClassId: "T9", effectiveOn: "2027-04-01" };
const stages: TStage[] = ["pedido", "verificacao", "analise", "autorizacao", "efetivacao", "indeferido", "desistencia"];
const pol = { capabilityByStage: Object.fromEntries(stages.map((s) => [s, `c-${s}`])) };
const a = (id: string): TActor => ({ personId: id, isHuman: true, capabilities: stages.map((s) => `c-${s}`) });
const ctx: TContext = { reservationRef: "res:9", reservationActive: true, originStillActive: true };
const go = (ev: TransferEvent[], stage: TStage, who = "p1", x: Partial<{ ref: string; reason: string }> = {}, k: TContext = ctx, cc = c) =>
  transferStep(cc, ev, { stage, expectedSeq: ev.length, idempotencyKey: `k-${stage}`, ref: x.ref ?? "", reason: x.reason ?? "", at: "2027-03-20T00:00:00Z" }, k, a(who), pol);
const run = (upTo: TStage[]) => { const ev: TransferEvent[] = []; for (const s of upTo) { const r = go(ev, s, s === "autorizacao" ? "p2" : "p1", { ref: s === "autorizacao" ? "ato-1" : s === "efetivacao" ? "fato:x" : "" }); if (!r.ok) throw new Error(s + r.reason); ev.push(r.event); } return ev; };

describe("Transferências L14", () => {
  it("fluxo completo; autorização gera plano atômico encerrando origem na véspera e mantendo a reserva", () => {
    const ev = run(["pedido", "verificacao", "analise"]);
    const r = go(ev, "autorizacao", "p2", { ref: "ato-1" });
    expect(r.ok && r.plan).toMatchObject({ atomic: true, keepsReservation: "res:9", steps: [{ endOn: "2027-03-31" }, { classId: "T9", from: "2027-04-01" }] });
    if (r.ok) ev.push(r.event);
    expect(go(ev, "efetivacao", "p1", { ref: "fato:x" }).ok).toBe(true);
  });
  it("sem reserva não verifica; autorizador = analista recusado; sem ato recusado", () => {
    const ev = run(["pedido"]);
    expect(go(ev, "verificacao", "p1", {}, { ...ctx, reservationActive: null }).ok).toBe(false);
    const ev2 = run(["pedido", "verificacao", "analise"]);
    expect(go(ev2, "autorizacao", "p1", { ref: "ato" }).ok).toBe(false);
    expect(go(ev2, "autorizacao", "p2").ok).toBe(false);
  });
  it("falha do writer não perde vaga nem origem; nova tentativa é possível", () => {
    expect(applyWriterResult({ ok: false, error: "timeout" })).toMatchObject({ releaseReservation: false, convertReservation: false, retry: true });
    expect(applyWriterResult({ ok: true, factRef: "f1" })).toMatchObject({ effectiveRef: "fato:f1", convertReservation: true });
    const ev = run(["pedido", "verificacao", "analise", "autorizacao"]);
    expect(go(ev, "efetivacao", "p1", { ref: "plano" }).ok).toBe(false);
    expect(go(ev, "efetivacao", "p1", { ref: "fato:y" }, { ...ctx, originStillActive: null }).ok).toBe(false);
  });
  it("tipos: escola exige destino diferente; turma/turno na mesma escola", () => {
    expect(go([], "pedido", "p1", {}, ctx, { ...c, destSchoolId: "E1" }).ok).toBe(false);
    expect(go([], "pedido", "p1", {}, ctx, { ...c, kind: "turno" }).ok).toBe(false);
    expect(go([], "pedido", "p1", {}, ctx, { ...c, kind: "turma", destSchoolId: "E1" }).ok).toBe(true);
  });
  it("indeferimento só na análise com motivo; encerrado não avança; idempotência; executor técnico", () => {
    const ev = run(["pedido", "verificacao", "analise"]);
    expect(go(ev, "indeferido", "p2").ok).toBe(false);
    const r = go(ev, "indeferido", "p2", { reason: "Sem amparo" }); if (!r.ok) throw 0; ev.push(r.event);
    expect(go(ev, "autorizacao", "p2", { ref: "a" }).ok).toBe(false);
    expect((go(ev, "indeferido", "p2", { reason: "x" }) as { replay?: boolean }).replay).toBe(true);
    expect(transferStep(c, [], { stage: "pedido", expectedSeq: 0, idempotencyKey: "z", ref: "", reason: "", at: "t" }, ctx, { ...a("p1"), isTechnicalExecutor: true }, pol).ok).toBe(false);
  });
});
