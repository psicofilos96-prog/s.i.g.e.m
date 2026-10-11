import { describe, it, expect } from "vitest";
import { summarizeClasses, classRequestRoute, previewAllocation, type Context } from "./class-allocation-flow";

const ctx = (): Context => ({
  enrollments: new Map([["e1", { schoolId: "A", year: "2026", active: true, opened: "2026-02-01" }], ["e2", { schoolId: "A", year: "2026", active: true, opened: null }]]),
  classes: new Map([["t1", { schoolId: "A", year: "2026", capacity: 1, occupancy: 0, validFrom: "2026-01-01", validTo: null }], ["t2", { schoolId: "A", year: "2026", capacity: 30, occupancy: 10, validFrom: "2026-01-01", validTo: null }]]),
  existing: [{ allocationId: "a1", enrollmentId: "e1", classId: "t2", from: "2026-02-01", to: null }],
  coexistenceAllowed: false,
});

describe("turmas", () => {
  it("vaga só com capacidade e ocupação lidas", () => {
    const s = summarizeClasses([{ classId: "x", schoolId: "A", year: "2026", name: "1A", shift: null, capacity: null, occupancy: 3, teachers: null }], "A", "2026");
    expect(s[0]!.vacancies).toBeNull();
    expect(classRequestRoute("abertura", new Set())).toBe("solicitar");
  });
});

describe("enturmação", () => {
  it("nova alocação sobreposta é recusada sem política; troca encerra a anterior na véspera", () => {
    const req = [{ key: "k", enrollmentId: "e1", classId: "t1", from: "2026-05-04", to: null }];
    expect(previewAllocation(req, ctx(), "nova")[0]!.reasons).toContain("sobreposição com outra alocação");
    expect(previewAllocation(req, ctx(), "troca")[0]).toEqual({ key: "k", status: "pronto", reasons: [], endsPrevious: { allocationId: "a1", endOn: "2026-05-03" } });
  });
  it("sem data de início, duplicado e sem vaga no lote", () => {
    const r = previewAllocation([
      { key: "1", enrollmentId: "e2", classId: "t1", from: "2026-03-01", to: null },
      { key: "2", enrollmentId: "e2", classId: "t1", from: "2026-03-01", to: null },
      { key: "3", enrollmentId: "e1", classId: "t1", from: null, to: null },
    ], ctx(), "nova");
    expect(r.map((i) => i.status)).toEqual(["pronto", "duplicado", "recusado"]);
    expect(r[2]!.reasons).toContain("data de início não declarada");
  });
  it("capacidade esgota dentro do lote", () => {
    const c = ctx(); c.enrollments.set("e3", { schoolId: "A", year: "2026", active: true, opened: null });
    const r = previewAllocation([{ key: "1", enrollmentId: "e2", classId: "t1", from: "2026-03-01", to: null }, { key: "2", enrollmentId: "e3", classId: "t1", from: "2026-03-01", to: null }], c, "nova");
    expect(r[1]!.reasons).toEqual(["turma sem vaga"]);
  });
});
