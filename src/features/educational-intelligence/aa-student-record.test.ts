import { describe, it, expect } from "vitest";
import { buildStudentRecord, guardText, type ResultFact, type Viewer } from "./aa-student-record";

const allocations = [{ schoolId: "e1", classId: "t1", from: "2025-02-01", to: "2025-06-30" }, { schoolId: "e2", classId: "t9", from: "2025-07-01", to: null }];
const res = (id: string, date: string, extra: Partial<ResultFact> = {}): ResultFact => ({ id, version: 1, supersedes: null, date, editionId: "ed", instrumentVersion: "iv1", matrixRef: "m1", curriculumRef: "c1", skill: "H1", rate: 0.5, recordedAt: date, reason: null, ...extra });
const results = [res("r1", "2025-04-01"), res("r2", "2025-08-01", { matrixRef: "m2" }), res("r2b", "2025-08-01", { version: 2, supersedes: "r2", matrixRef: "m2", rate: 0.6, reason: "erro de lançamento" })];
const viewer: Viewer = { capability: true, purpose: "planejar intervenção", schools: new Set(), network: true };

describe("A&A L11 ficha individual", () => {
  it("exige capability e finalidade", () => {
    expect(buildStudentRecord({ viewer: { ...viewer, purpose: " " }, allocations, results, interventions: [] })).toHaveProperty("refused");
  });
  it("linha do tempo com mudança de escola, matriz e correção auditada", () => {
    const r = buildStudentRecord({ viewer, allocations, results, interventions: [] });
    if ("refused" in r) throw new Error();
    const types = r.timeline.map(t => t.type);
    expect(types).toContain("mudanca-escola");
    expect(types).toContain("mudanca-matriz");
    expect(r.timeline.filter(t => t.type === "resultado")).toHaveLength(2);
    expect(r.corrections).toEqual([{ id: "r2b", version: 2, reason: "erro de lançamento" }]);
    expect(r.timeline.find(t => t.ref === "r2b@v2")?.schoolId).toBe("e2");
  });
  it("escola fora do alcance omite fatos de outra escola", () => {
    const r = buildStudentRecord({ viewer: { ...viewer, network: false, schools: new Set(["e1"]) }, allocations, results, interventions: [] });
    if ("refused" in r) throw new Error();
    expect(r.timeline.every(t => t.schoolId === "e1" || t.schoolId === null)).toBe(true);
  });
  it("rótulo e dado clínico são recusados", () => {
    expect(guardText("aluno com TDAH").ok).toBe(false);
    expect(guardText("leu 40 palavras por minuto").ok).toBe(true);
    const r = buildStudentRecord({ viewer, allocations, results: [], interventions: [{ id: "i1", date: "2025-05-01", kind: "intervencao", skill: "H1", text: "aluno fraco", schoolId: "e1" }] });
    if ("refused" in r) throw new Error();
    expect(r.timeline[0]!.detail).toMatch(/retido/);
  });
});
