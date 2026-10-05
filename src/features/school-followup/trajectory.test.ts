import { describe, expect, it } from "vitest";
import { attendanceIndicator, buildTrajectory, countIndicator, evaluateAlerts, type AlertRule } from "./trajectory";

const ev = (kind: any, on: string, ref: string, schoolId = "e1") => ({ kind, on, label: kind, sourceRef: ref, schoolId });

describe("trajetória", () => {
  it("transferência preserva as duas escolas e ordena", () => {
    const t = buildTrajectory([{ kind: "matricula", events: [ev("matricula", "2027-02-01", "m1"), ev("matricula", "2027-06-01", "m2", "e2")] },
      { kind: "movimentacao", events: [ev("movimentacao", "2027-05-31", "t1")] }, { kind: "frequencia", events: null }]);
    expect(t.events.map((e) => e.sourceRef)).toEqual(["m1", "t1", "m2"]);
    expect(new Set(t.events.map((e) => e.schoolId))).toEqual(new Set(["e1", "e2"]));
    expect(t.gaps).toEqual(["frequencia"]);
  });
});

describe("indicadores", () => {
  it("sem chamada ⇒ desconhecido, não zero", () => {
    expect(attendanceIndicator([{ lessonId: "a", mark: null }]).value).toBeNull();
    expect(attendanceIndicator(null).value).toBeNull();
  });
  it("denominador = aulas com marcação", () => {
    const i = attendanceIndicator([{ lessonId: "a", mark: "Presente" }, { lessonId: "b", mark: "Ausente" }, { lessonId: "c", mark: null }]);
    expect(i.value).toBe(0.5); expect(i.sources).toEqual(["a", "b"]);
  });
  it("zero real ≠ ilegível", () => {
    expect(countIndicator("avaliacoes", [], "x").value).toBe(0);
    expect(countIndicator("avaliacoes", null, "x").value).toBeNull();
  });
});

describe("alertas", () => {
  const rule: AlertRule = { id: "r", version: 1, homologated: false, indicatorId: "frequencia", op: "lt", threshold: 0.75, label: "Frequência abaixo do patamar" };
  it("regra não homologada não dispara", () => {
    const r = evaluateAlerts([{ id: "frequencia", value: 0.1, reason: null, sources: [] }], [rule]);
    expect(r.mode).toBe("indicadores"); expect(r.alerts).toHaveLength(0);
  });
  it("desconhecido nunca dispara", () => {
    expect(evaluateAlerts([{ id: "frequencia", value: null, reason: "x", sources: [] }], [{ ...rule, homologated: true }]).alerts).toHaveLength(0);
  });
  it("homologada dispara com regra e fonte", () => {
    const a = evaluateAlerts([{ id: "frequencia", value: 0.5, reason: null, sources: ["a"] }], [{ ...rule, homologated: true }]).alerts[0]!;
    expect(a.ruleId).toBe("r"); expect(a.indicator.sources).toEqual(["a"]);
  });
});
