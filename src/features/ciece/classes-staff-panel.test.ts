import { describe, expect, it } from "vitest";
import { classPanel, staffAt, calendarBasis, type ClassRow } from "./classes-staff-panel";

const C = (p: Partial<ClassRow>): ClassRow => ({ classId: "t", schoolId: "A", yearId: "2026", stage: "EF", modality: null, shift: "manha", capacity: 30, occupied: 25, ...p });

describe("turmas e pessoal", () => {
  it("ocupação só com capacidade; oferta ausente = não declarado", () => {
    expect(classPanel([C({}), C({ capacity: null })], "stage")[0]).toMatchObject({ turmas: 2, capacidade: null, vagas: null, semCapacidade: 1 });
    expect(classPanel([C({}), C({ stage: null })], "stage").map((g) => g.key)).toEqual(["EF", "não declarado"]);
    expect(classPanel([C({})], "shift")[0]).toMatchObject({ vagas: 5 });
  });
  it("pessoa ≠ vínculo; sem fonte de lotação/atribuição = null; sem início não vigente", () => {
    const r = staffAt({ links: [{ id: "1", personId: "p", from: "2020-01-01", to: null }, { id: "2", personId: "p", from: "2022-01-01", to: null }, { id: "3", personId: "q", from: null, to: null }], postings: [], exercises: [], assignments: [] }, "2026-03-01");
    expect(r).toMatchObject({ profissionais: 1, vinculos: 2, vinculosSemInicio: 1, lotados: null, comAtribuicao: null, cargaAtribuida: null });
  });
  it("carga atribuída só com todas as cargas lidas", () => {
    const f = { links: [{ id: "1", personId: "p", from: "2020-01-01", to: null }], postings: [], exercises: [], assignments: [{ personId: "p", classId: "t", from: "2026-02-01", to: null, weeklyLessons: 10 }, { personId: "p", classId: "u", from: "2026-02-01", to: null, weeklyLessons: null }] };
    expect(staffAt(f, "2026-03-01")).toMatchObject({ comAtribuicao: 1, cargaAtribuida: null });
  });
  it("calendário só aplicável resolvido", () => {
    expect(calendarBasis("ambiguo").state).toBe("BLOCKED");
    expect(calendarBasis({ calendarId: "c", schoolDays: 200 }).state).toBe("OK");
  });
});
