import { describe, expect, it } from "vitest";
import { loadByComponent, openCoverage, resolveCoverage, scheduleBoard, staffPanel, NECESSIDADE_PROFESSOR, type StaffFact } from "./staff-schedule";

const base: StaffFact = { personId: "p1", schoolId: "A", positionLabel: "Professor", exercise: { from: "2026-02-01", to: null }, source: "funcional",
  journeyHours: 20, journeySourced: false, shifts: ["manhã"], leaves: [], communicatedAbsences: [] };

describe("Direção — pessoal e horários", () => {
  it("histórico não vira lotação; afastado e futuro distintos; jornada sem fonte é null; escola B não aparece", () => {
    const p = staffPanel([base, { ...base, personId: "p2", source: "planilha-historica" }, { ...base, personId: "p3", leaves: [{ from: "2026-10-01", to: null, kind: "licença" }] },
      { ...base, personId: "p4", exercise: { from: "2027-01-01", to: null } }, { ...base, personId: "p5", schoolId: "B" }], "A", "2026-10-11");
    expect(p.map((x) => x.status)).toEqual(["em exercício", "histórico (não é lotação atual)", "afastado", "futuro"]);
    expect(p[0]).toMatchObject({ jornada: null });
  });
  it("descoberta só com exigida e atribuída lidas", () => {
    expect(loadByComponent({ mat: 10, por: null }, { mat: 6 })).toEqual([
      { component: "mat", exigida: 10, atribuida: 6, descoberta: 4 }, { component: "por", exigida: null, atribuida: null, descoberta: null }]);
    expect(NECESSIDADE_PROFESSOR).toBeDefined();
  });
  it("quadro aponta conflito de pessoa e lacuna só de bloco registrado", () => {
    const b = scheduleBoard([
      { blockId: "b1", classId: "c1", day: "mon", start: "07:00", end: "08:00", personIds: ["x"] },
      { blockId: "b2", classId: "c2", day: "mon", start: "07:30", end: "08:30", personIds: ["x"] },
      { blockId: "b3", classId: "c1", day: "tue", start: "07:00", end: "08:00", personIds: [] }]);
    expect(b.conflicts.map((c) => c.kind)).toEqual(["pessoa"]);
    expect(b.gaps).toEqual(["b3"]);
  });
  it("cobertura: protocolo idempotente, DP decide, atendido exige ato", () => {
    const o = openCoverage({ protocol: "P1", schoolId: "A", requestedBy: "dir", isNaturalPerson: true, reason: "licença", blockIds: ["b3"] }, []);
    if (!o.ok) throw 0;
    expect(openCoverage({ protocol: "P1", schoolId: "A", requestedBy: "dir", isNaturalPerson: true, reason: "x", blockIds: ["b3"] }, [o.request])).toMatchObject({ idempotent: true });
    expect(resolveCoverage(o.request, "dir", ["manter-vida-funcional"], "atendido", "ato1", "")).toMatchObject({ code: "cobertura:autodecisao" });
    expect(resolveCoverage(o.request, "rh", [], "atendido", "ato1", "")).toMatchObject({ code: "cobertura:setor-nao-competente" });
    expect(resolveCoverage(o.request, "rh", ["manter-vida-funcional"], "atendido", null, "")).toMatchObject({ code: "cobertura:sem-ato-funcional" });
    expect(resolveCoverage(o.request, "rh", ["manter-vida-funcional"], "atendido", "ato1", "").ok).toBe(true);
  });
});
