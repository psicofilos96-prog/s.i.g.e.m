import { describe, expect, it } from "vitest";
import { personLoads, projectClass, reconciles, scenarioTeachersNeeded, totals, type Assignment, type Block, type ClassInput } from "./staffing-model";

const b = (k: string, comp: string | null, eng: string[] = [], min = 50): Block => ({ blockKey: k, componentId: comp, minutes: min, engagementIds: eng, usable: true });
const a = (id: string, comp: string, eng: string, person: string | null = "p1", vigente = true): Assignment => ({ assignmentId: id, componentId: comp, engagementId: eng, personId: person, vigente });
const cls = (id: string, blocks: Block[] | null, assignments: Assignment[] | null): ClassInput => ({ classId: id, label: id, blocks, assignments });

describe("quadro docente", () => {
  it("demanda sem cobertura: tudo descoberto, com motivo e composição", () => {
    const r = projectClass(cls("t1", [b("x1", "mat"), b("x2", "mat")], []));
    expect(r.cells[0]).toMatchObject({ lessons: 2, demandMinutes: 100, coveredMinutes: 0, uncoveredMinutes: 100 });
    expect(r.cells[0]!.refs.map((x) => x.id)).toEqual(["x1", "x2"]); expect(r.cells[0]!.reasons.length).toBeGreaterThan(0);
  });
  it("cobertura parcial", () => {
    const r = projectClass(cls("t1", [b("x1", "mat", ["e1"]), b("x2", "mat", ["e9"])], [a("r1", "mat", "e1")]));
    expect(r.cells[0]).toMatchObject({ coveredMinutes: 50, uncoveredMinutes: 50 });
  });
  it("professor com dois vínculos soma numa só pessoa", () => {
    const c1 = cls("t1", [b("x1", "mat", ["e1"])], [a("r1", "mat", "e1", "p1")]);
    const c2 = cls("t2", [b("y1", "por", ["e2"])], [a("r2", "por", "e2", "p1")]);
    const l = personLoads([c1, c2], null);
    expect(l).toHaveLength(1); expect(l[0]).toMatchObject({ assignedMinutes: 100, availableMinutes: null, balanceMinutes: null });
    expect([...l[0]!.engagementIds].sort()).toEqual(["e1", "e2"]);
    expect(personLoads([c1, c2], new Map([["p1", 60]]))[0]!.balanceMinutes).toBe(-40);
  });
  it("afastamento: regência com atuação não vigente não cobre", () => {
    const r = projectClass(cls("t1", [b("x1", "mat", ["e1"])], [a("r1", "mat", "e1", "p1", false)]));
    expect(r.cells[0]!.uncoveredMinutes).toBe(50); expect(r.cells[0]!.reasons.join(" ")).toMatch(/não vigente/);
  });
  it("grade alterada muda a demanda; bloco não utilizável não conta", () => {
    const before = projectClass(cls("t1", [b("x1", "mat")], []));
    const after = projectClass(cls("t1", [b("x1", "mat"), { ...b("x2", "mat"), usable: false }, b("x3", "mat", [], 100)], []));
    expect(before.cells[0]!.demandMinutes).toBe(50); expect(after.cells[0]!.demandMinutes).toBe(150);
  });
  it("ausência de carga/fonte ≠ zero", () => {
    expect(projectClass(cls("t1", null, [])).state).toBe("grade-ilegivel");
    const reg = projectClass(cls("t1", [b("x1", "mat")], null));
    expect(reg.cells[0]!.coveredMinutes).toBeNull(); expect(reg.cells[0]!.uncoveredMinutes).toBeNull();
    const t = totals([projectClass(cls("t1", null, [])), projectClass(cls("t2", [b("x", "m")], []))]);
    expect(t).toMatchObject({ complete: false, lessons: null, demandMinutes: null, uncoveredMinutes: null });
    expect(totals([reg]).uncoveredMinutes).toBeNull();
    expect(scenarioTeachersNeeded(100, null)).toBeNull(); expect(scenarioTeachersNeeded(null, { minutesPerTeacher: 60 })).toBeNull();
    expect(scenarioTeachersNeeded(130, { minutesPerTeacher: 60 })).toBe(3);
  });
  it("knownAt: projeção é pura sobre a leitura feita com um único instante (mesma entrada ⇒ mesmo resultado)", () => {
    const i = cls("t1", [b("x1", "mat", ["e1"])], [a("r1", "mat", "e1")]);
    expect(projectClass(i)).toEqual(projectClass(i));
  });
  it("reconciliação: total = soma das células e demanda = coberta + descoberta", () => {
    const rs = [projectClass(cls("t1", [b("x1", "mat", ["e1"]), b("x2", "por")], [a("r1", "mat", "e1")])), projectClass(cls("t2", [b("y", "mat", [], 30)], []))];
    expect(reconciles(rs)).toBe(true);
    expect(totals(rs)).toMatchObject({ lessons: 3, demandMinutes: 130, uncoveredMinutes: 80, complete: true });
  });
});
