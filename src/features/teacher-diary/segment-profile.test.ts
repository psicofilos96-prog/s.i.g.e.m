import { describe, expect, it } from "vitest";
import { arrangementByClass, attendanceUnits, closablePeriods, currentPeriod, cycleWindow, homeLayout, type PeriodOrganization } from "./segment-profile";

const d = "2026-03-10";
describe("perfis por segmento (Docente L13)", () => {
  it("generalista: vários componentes na mesma turma ⇒ tela por turma", () => {
    const a = ["LP", "MA", "CI"].map((c) => ({ assignmentId: c, classId: "1A", componentId: c, start: "2026-02-01" }));
    const arr = arrangementByClass(a, d);
    expect(arr.get("1A")).toBe("unidocente");
    expect(homeLayout(arr)).toBe("por-turma");
  });
  it("especialista: um componente em várias turmas ⇒ tela por componente×turma; atribuição encerrada sai", () => {
    const a = [
      { assignmentId: "a", classId: "6A", componentId: "MA", start: "2026-02-01" },
      { assignmentId: "b", classId: "7B", componentId: "MA", start: "2026-02-01" },
      { assignmentId: "c", classId: "8C", componentId: "MA", start: "2026-02-01", end: "2026-03-01" },
    ];
    const arr = arrangementByClass(a, d);
    expect([...arr.keys()].sort()).toEqual(["6A", "7B"]);
    expect(homeLayout(arr)).toBe("por-componente-turma");
  });
  const eja: PeriodOrganization = { classId: "EJA1", cycleKind: "semestral", periods: [
    { periodId: "b1", label: "1º bimestre", start: "2026-02-02", end: "2026-04-10" },
    { periodId: "b2", label: "2º bimestre", start: "2026-04-13", end: "2026-06-30" }] };
  it("EJA semestral: ciclo é o semestre declarado, nunca o ano civil", () => {
    expect(cycleWindow(eja)).toEqual({ start: "2026-02-02", end: "2026-06-30" });
    expect(currentPeriod(eja, "2026-05-01")).toMatchObject({ periodId: "b2", cycleKind: "semestral" });
    expect(currentPeriod(eja, "2026-08-01")).toHaveProperty("error");
    expect(currentPeriod(null, d)).toHaveProperty("error");
  });
  it("chamada por aula ou por dia só com regra homologada", () => {
    expect(attendanceUnits(null, ["b1"])).toHaveProperty("error");
    expect(attendanceUnits({ granularity: "por-aula", ruleId: "r", version: 1 }, ["b1", "b2"])).toEqual({ units: ["b1", "b2"] });
    expect(attendanceUnits({ granularity: "por-dia", ruleId: "r", version: 1 }, ["b1", "b2"])).toEqual({ units: ["dia"] });
  });
  it("fechamento só de períodos encerrados", () => {
    expect(closablePeriods(eja, "2026-05-01")).toEqual(["b1"]);
  });
});
