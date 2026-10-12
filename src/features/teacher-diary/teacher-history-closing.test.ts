import { describe, it, expect } from "vitest";
import { myHistory, preClosing, applyClosingAct, closingState, type ClosingEvent, type AuthoredFact } from "./teacher-history-closing";

const facts: AuthoredFact[] = [
  { id: "a", kind: "aula", authorPersonId: "p1", schoolId: "s1", classId: "c1", componentId: "mat", periodId: "b1", date: "2026-03-02" },
  { id: "b", kind: "chamada", authorPersonId: "p1", schoolId: "s2", classId: "c9", componentId: null, periodId: "b1", date: "2026-03-01" },
  { id: "c", kind: "aula", authorPersonId: "p2", schoolId: "s1", classId: "c1", componentId: "mat", periodId: "b1", date: "2026-03-03" },
];
const ready = preClosing({ expectedLessons: ["x"], recordedLessons: ["x"], expectedAttendance: [], concludedAttendance: [], pendingGrades: 0, pendingRecovery: 0, pendingDocuments: 0 });
const policy = { closeCapability: "encerrar-diario", reopenCapability: "reabrir-diario" };
const base = { ownerPersonId: "p1", actorCapabilities: [] as string[], policy, preClosing: ready };

describe("L17 histórico e fechamento", () => {
  it("histórico só do autor, filtrável, e independe de vínculo vigente", () => {
    expect(myHistory("p1", facts).map((f) => f.id)).toEqual(["b", "a"]);
    expect(myHistory("p1", facts, { schoolId: "s1", componentId: "mat" }).map((f) => f.id)).toEqual(["a"]);
  });
  it("pré-fechamento lista pendências e fonte não lida bloqueia, nunca zero", () => {
    const r = preClosing({ expectedLessons: ["l1", "l2"], recordedLessons: ["l1"], expectedAttendance: null, concludedAttendance: [], pendingGrades: 2, pendingRecovery: 0, pendingDocuments: null });
    expect(r.ready).toBe(false);
    expect(r.pendings.map((p) => p.kind)).toEqual(["aula", "nota"]);
    expect(r.blockers).toHaveLength(2);
  });
  it("submissão só pelo autor com pré-fechamento pronto", () => {
    expect(applyClosingAct([], { ...base, act: "submeter", actorPersonId: "p2", expectedSeq: 0, idempotencyKey: "k" }).ok).toBe(false);
    expect(applyClosingAct([], { ...base, preClosing: preClosing({ ...{ expectedLessons: null, recordedLessons: [], expectedAttendance: [], concludedAttendance: [], pendingGrades: 0, pendingRecovery: 0, pendingDocuments: 0 } }), act: "submeter", actorPersonId: "p1", expectedSeq: 0, idempotencyKey: "k" }).ok).toBe(false);
    expect(applyClosingAct([], { ...base, act: "submeter", actorPersonId: "p1", expectedSeq: 0, idempotencyKey: "k" }).ok).toBe(true);
  });
  it("encerramento exige política e capacidade; sem elas falha fechado", () => {
    const ev: ClosingEvent[] = [{ seq: 1, act: "submeter", actorPersonId: "p1", reason: null, version: 1, key: "k1" }];
    expect(applyClosingAct(ev, { ...base, policy: null, act: "encerrar", actorPersonId: "d", actorCapabilities: ["encerrar-diario"], expectedSeq: 1, idempotencyKey: "k2" }).ok).toBe(false);
    expect(applyClosingAct(ev, { ...base, act: "encerrar", actorPersonId: "d", expectedSeq: 1, idempotencyKey: "k2" }).ok).toBe(false);
    expect(applyClosingAct(ev, { ...base, act: "encerrar", actorPersonId: "p1", actorCapabilities: ["encerrar-diario"], expectedSeq: 1, idempotencyKey: "k2" }).ok).toBe(false);
    expect(applyClosingAct(ev, { ...base, act: "encerrar", actorPersonId: "d", actorCapabilities: ["encerrar-diario"], expectedSeq: 0, idempotencyKey: "k2" }).ok).toBe(false);
    expect(applyClosingAct(ev, { ...base, act: "encerrar", actorPersonId: "d", actorCapabilities: ["encerrar-diario"], expectedSeq: 1, idempotencyKey: "k2" }).ok).toBe(true);
  });
  it("reabertura justificada cria nova versão e é idempotente", () => {
    const ev: ClosingEvent[] = [
      { seq: 1, act: "submeter", actorPersonId: "p1", reason: null, version: 1, key: "k1" },
      { seq: 2, act: "encerrar", actorPersonId: "d", reason: null, version: 1, key: "k2" },
    ];
    const req = { ...base, act: "reabrir" as const, actorPersonId: "d", actorCapabilities: ["reabrir-diario"], expectedSeq: 2, idempotencyKey: "k3" };
    expect(applyClosingAct(ev, req).ok).toBe(false);
    const r = applyClosingAct(ev, { ...req, reason: "Nota lançada em turma errada" });
    expect(r.ok && r.event.version).toBe(2);
    if (!r.ok) throw new Error();
    const after = [...ev, r.event];
    expect(closingState(after)).toEqual({ state: "aberto", version: 2 });
    const again = applyClosingAct(after, { ...req, reason: "x" });
    expect(again.ok && again.replay).toBe(true);
  });
});
