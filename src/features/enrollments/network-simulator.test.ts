import { describe, expect, it } from "vitest";
import { fingerprint, simulate, type SimBase } from "./network-simulator";

const base: SimBase = {
  classes: [
    { classId: "A", schoolId: "E1", shift: "manha", positionKey: "ano-1", capacity: 25, occupants: 28 },
    { classId: "B", schoolId: "E2", shift: "manha", positionKey: "ano-1", capacity: 25, occupants: 10 },
  ],
  roomsBySchoolShift: { "E1|manha": 1, "E1|tarde": 0, "E2|manha": null },
  lessonsByPosition: { "ano-1": 25 },
};
const fp = fingerprint(base);

describe("Simulador da rede L22", () => {
  it("redistribuição entre escolas: vagas, transporte e base intacta", () => {
    const snapshot = JSON.stringify(base);
    const r = simulate(base, fp, fp, [{ kind: "redistribuir", fromClassId: "A", toClassId: "B", students: 3 }]);
    expect(r.after.vacancies.map((v) => v.available)).toEqual([0, 12]);
    expect(r.transport).toEqual([{ schoolId: "E2", studentsArriving: 3 }]);
    expect([r.simulacao, r.writes.length, r.stale]).toEqual([true, 0, false]);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
  it("abrir turma em turno sem sala ⇒ déficit; aulas pela matriz; sala não informada ⇒ null", () => {
    const r = simulate(base, fp, fp, [{ kind: "abrir", cls: { classId: "C", schoolId: "E1", shift: "tarde", positionKey: "ano-1", capacity: 25, occupants: 0 } }]);
    expect(r.after.rooms.find((x) => x.key === "E1|tarde")?.deficit).toBe(1);
    expect(r.after.rooms.find((x) => x.key === "E2|manha")?.deficit).toBeNull();
    expect(r.deltaWeeklyLessons).toBe(25);
    expect(simulate({ ...base, lessonsByPosition: {} }, fp, fp, []).after.weeklyLessons).toBeNull();
  });
  it("fechar com estudantes exige destino; turno e capacidade alteram só a cópia", () => {
    expect(simulate(base, fp, fp, [{ kind: "fechar", classId: "A", moveTo: null }]).errors.length).toBe(1);
    const r = simulate(base, fp, fp, [{ kind: "capacidade", classId: "A", capacity: 30 }, { kind: "turno", classId: "B", shift: "tarde" }]);
    expect(r.after.vacancies[0]?.available).toBe(2);
    expect(base.classes[0]?.capacity).toBe(25);
    expect(r.before.vacancies[0]?.overCapacity).toBe(true);
  });
  it("base mudou ⇒ desatualizado", () => {
    expect(simulate(base, fp, fingerprint({ ...base, roomsBySchoolShift: {} }), []).stale).toBe(true);
  });
});
