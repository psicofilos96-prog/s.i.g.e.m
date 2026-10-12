import { describe, expect, it } from "vitest";
import { FORBIDDEN_INFERRED_LABELS, createTechnicalExecutor, permanenceSignals } from "./permanence-executor";

const row = (present: number, absent: number, unmarked = 0) => ({ school_id: "e1", class_id: "t1", student_id: "s1", enrollment_id: "m1", period_id: "p1", period_start: "2026-02-01", present, absent, unmarked });
const th = { policyId: "pol", version: 1, maxAbsenceRate: 0.25, minMarkedLessons: 10, decisionRef: "dec-1" };

describe("Permanência L01 sinais e executor", () => {
  it("sem limiar homologado nada vira alerta", () => {
    expect(permanenceSignals([row(1, 9)], null)[0]?.kind).toBe("sem-limiar");
    expect(permanenceSignals([row(1, 9)], { ...th, decisionRef: "" })[0]?.kind).toBe("sem-limiar");
  });
  it("aula sem marcação fica fora do denominador; base mínima exigida", () => {
    expect(permanenceSignals([row(2, 2, 50)], th)[0]).toMatchObject({ kind: "base-insuficiente", marked: 4 });
    expect(permanenceSignals([row(6, 4)], th)[0]).toMatchObject({ kind: "acima-do-limiar", rate: 0.4 });
    expect(permanenceSignals([row(8, 2)], th)[0]?.kind).toBe("dentro-do-limiar");
  });
  it("nunca rotula evasão", () => {
    const out = JSON.stringify(permanenceSignals([row(0, 40)], th));
    for (const l of FORBIDDEN_INFERRED_LABELS) expect(out).not.toContain(l);
  });
  it("executor: só detectar/propor, escopo, idempotência, trilha de recusas", () => {
    const ex = createTechnicalExecutor(() => "t");
    const base = { idempotencyKey: "job:2026-10-12", actor: { kind: "executor-tecnico" as const, id: "cron" }, scopeSchoolIds: ["e1"], targetSchoolId: "e1" };
    expect(ex.run({ ...base, action: "detectar-sinais" })).toEqual({ ok: true, repeated: false, writes: [] });
    expect(ex.run({ ...base, action: "detectar-sinais" })).toMatchObject({ repeated: true });
    expect(ex.run({ ...base, action: "abrir-caso" })).toEqual({ ok: false, reason: "executor:action-requires-human" });
    expect(ex.run({ ...base, action: "consultar-bae-nacional" })).toEqual({ ok: false, reason: "executor:bae-nao-consultado" });
    expect(ex.run({ ...base, action: "detectar-sinais", targetSchoolId: "e2" })).toEqual({ ok: false, reason: "executor:out-of-scope" });
    expect(ex.run({ ...base, action: "detectar-sinais", actor: { kind: "pessoa-natural", id: "p" } })).toMatchObject({ ok: false });
    expect(ex.trail().filter((t) => t.outcome === "recusado")).toHaveLength(4);
  });
});
