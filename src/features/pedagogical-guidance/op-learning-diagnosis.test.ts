import { describe, it, expect } from "vitest";
import { analyzeLearning, evolution, centralLearning, guardLearningText, type ResultFact, type Sources } from "./op-learning-diagnosis";
import type { OpDesignation } from "./op-designations";

const d: OpDesignation = { logicalId: "d", role: "orientador-da-unidade", personId: "op", schoolIds: ["s1"], classIds: null, from: "2026-01-01", to: null, substituteOf: null, history: [] };
const access = { personNatural: true, personId: "op", date: "2026-10-12", schoolId: "s1", classId: null, purpose: "acompanhamento", designations: [d], capabilities: [{ id: "consultar-acompanhamento-pedagogico", scope: "escola" as const, schoolId: "s1" }] };
const all: Sources = { results: true, aa: true, enrollment: true, attendance: true, interventions: true, readAt: "2026-10-12" };
const r = (studentId: string, o: Partial<ResultFact> = {}): ResultFact => ({ studentId, classId: "c1", schoolId: "s1", stageId: "ef1", componentId: "mat", skillItemId: "H1", origin: "docente", programEditionId: null, scaleKey: "0-10", value: 7, periodId: "b3", recordedAt: "2026-10-01", ...o });
const enr = ["a", "b", "c", "d"].map((s) => ({ studentId: s, classId: "c1", schoolId: "s1", stageId: "ef1" }));
const run = (o: any = {}) => analyzeLearning({ level: "turma", filters: { schoolId: "s1", periodId: "b3" }, results: [r("a"), r("b")], enrollments: enr, attendance: [{ studentId: "a", classId: "c1", periodId: "b3", present: 9, marked: 10 }], interventions: [{ studentId: "a", classId: "c1", skillItemId: "H1", openedAt: "2026-09-01", reassessedAt: "2026-10-01", status: "aberta" }], sources: all, access, ...o });

describe("Lote 09 — aprendizagem e diagnóstico", () => {
  it("participação com denominador de enturmação; frequência e intervenções integradas", () => {
    const c = run().cells[0]!;
    expect(c).toMatchObject({ eligible: 4, assessed: 2, participation: 0.5, attendanceRate: 0.9, interventionsOpen: 1, reassessed: 1 });
    expect(c.values).toEqual([7, 7]);
  });
  it("escalas e origens nunca se agregam", () => {
    const cells = run({ results: [r("a"), r("b", { origin: "aa", scaleKey: "saeb", programEditionId: "e1", value: 210 })] }).cells;
    expect(cells).toHaveLength(2);
    expect(evolution(cells[0]!, cells[1]!, []).comparable).toBe("desconhecido");
    expect(evolution(cells[0]!, cells[1]!, [{ a: "0-10", b: "saeb", comparable: false }]).comparable).toBe(false);
  });
  it("fonte não lida: sem denominador, sem frequência, limitação declarada", () => {
    const x = run({ sources: { ...all, enrollment: false, attendance: false, aa: false } });
    expect(x.cells[0]).toMatchObject({ eligible: null, participation: null, attendanceRate: null });
    expect(x.limitations.join()).toMatch(/sem denominador/);
    expect(run({ sources: { ...all, readAt: null } }).blocked).toBeTruthy();
  });
  it("níveis turma→escola→etapa→componente→habilidade", () => {
    for (const level of ["escola", "etapa", "componente", "habilidade"]) expect(run({ level }).cells).toHaveLength(1);
    expect(run({ level: "habilidade" }).cells[0]!.key).toBe("H1");
  });
  it("estudante só autorizado e com capacidade; executor técnico recusado", () => {
    expect(run({ level: "estudante" }).blocked).toMatch(/estudante autorizado/);
    expect(run({ level: "estudante", filters: { schoolId: "s1", periodId: "b3", studentId: "a" } }).cells).toHaveLength(1);
    expect(run({ access: { ...access, capabilities: [] } }).blocked).toBeTruthy();
    expect(run({ access: { ...access, personNatural: false } }).blocked).toBeTruthy();
    const central = { ...access, designations: [{ ...d, role: "coordenacao-central-op", schoolIds: "rede" }] };
    expect(run({ level: "estudante", filters: { schoolId: "s1", periodId: "b3", studentId: "a" }, access: central }).blocked).toBeTruthy();
  });
  it("não cria nota nem diagnóstico clínico", () => {
    expect(guardLearningText("suspeita de TDAH")).toBeTruthy();
    expect(guardLearningText("média final 6")).toBeTruthy();
    expect(guardLearningText("avançar em frações")).toBeNull();
    expect(Object.keys(run().cells[0]!)).not.toContain("average");
  });
  it("central: agregado sem valores, 1–4 suprimido", () => {
    const c = centralLearning(run().cells)[0]!;
    expect(c).toMatchObject({ assessed: "suprimido", participation: "suprimido" });
    expect(c).not.toHaveProperty("values");
  });
});
