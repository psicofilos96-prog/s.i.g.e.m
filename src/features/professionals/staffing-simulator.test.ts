import { describe, expect, it } from "vitest";
import { fingerprint, isStale, simulate, type SimBase } from "./staffing-simulator";

const deepFreeze = <T,>(o: T): T => { Object.values(o as object).forEach((v) => v && typeof v === "object" && deepFreeze(v)); return Object.freeze(o); };
const base: SimBase = deepFreeze({
  demands: [{ classId: "T1", componentId: "MAT", lessons: 5, schoolId: "E1" }, { classId: "T1", componentId: "POR", lessons: 5, schoolId: "E1" }],
  assignments: [{ id: "A1", linkId: "V1", classId: "T1", componentId: "MAT", lessons: 5, slots: ["seg1"] }, { id: "A2", linkId: "V2", classId: "T1", componentId: "POR", lessons: 5, slots: ["seg1"] }],
  links: [{ linkId: "V1", capacityLessons: 8, onLeave: false }, { linkId: "V2", capacityLessons: 8, onLeave: false }, { linkId: "V3", capacityLessons: null, onLeave: false }],
});

describe("simulador isolado de pessoal", () => {
  it("nunca altera a base nem grava", () => {
    const fp = fingerprint(base);
    const r = simulate(base, [{ kind: "fechar-turma", classId: "T1" }]);
    expect(r.simulacao).toBe(true); expect(r.writes).toEqual([]);
    expect(fingerprint(base)).toBe(fp); expect(base.assignments).toHaveLength(2);
  });
  it("abrir turma aumenta demanda descoberta", () => {
    const r = simulate(base, [{ kind: "abrir-turma", classId: "T2", schoolId: "E1", demands: [{ componentId: "MAT", lessons: 4 }] }]);
    expect(r.impact).toMatchObject({ demand: 4, uncovered: 4, covered: 0 });
  });
  it("afastamento descobre aulas; substituição as recobre", () => {
    expect(simulate(base, [{ kind: "afastamento", linkId: "V1" }]).impact.uncovered).toBe(5);
    const r = simulate(base, [{ kind: "afastamento", linkId: "V1" }, { kind: "substituicao", fromLinkId: "V1", toLinkId: "V3" }]);
    expect(r.impact.uncovered).toBe(0);
    expect(r.after.unknownCapacity).toEqual(["V3"]);
  });
  it("redistribuição revela conflito e sobrecarga", () => {
    const r = simulate(base, [{ kind: "redistribuir", assignmentId: "A2", toLinkId: "V1" }]);
    expect(r.impact.newConflicts).toEqual(["V1@seg1:A1+A2"]);
    expect(r.impact.newOverloaded).toEqual(["V1"]);
  });
  it("matriz sem carga torna demanda indeterminada, nunca zero", () => {
    const r = simulate(base, [{ kind: "alterar-matriz", classId: "T1", componentId: "MAT", lessons: null }]);
    expect(r.after.demand).toBeNull(); expect(r.impact.uncovered).toBeNull();
  });
  it("alteração inválida é relatada; base alterada torna cenário desatualizado", () => {
    expect(simulate(base, [{ kind: "alterar-jornada", linkId: "X", capacityLessons: 2 }]).problems).toHaveLength(1);
    const fp = fingerprint(base);
    expect(isStale(fp, { ...base, links: [] })).toBe(true);
    expect(isStale(fp, base)).toBe(false);
  });
});
