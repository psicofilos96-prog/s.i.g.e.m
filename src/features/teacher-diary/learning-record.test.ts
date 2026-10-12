import { describe, expect, it } from "vitest";
import { classPanel, learningRecord, reassessment, validateIntervention, type InterventionProposal } from "./learning-record";

const win = { start: "2026-02-01", end: "2026-06-30" };
const results = [
  { studentId: "e1", instrumentId: "i1", date: "2026-03-01", value: 4, skillIds: ["s1"] },
  { studentId: "e1", instrumentId: "i2", date: "2026-05-01", value: 7, skillIds: ["s1"] },
  { studentId: "e1", instrumentId: "i3", date: "2026-05-02", value: "B", skillIds: ["s2"] },
];

describe("ficha de aprendizagem (Docente L11)", () => {
  it("compõe frequência, habilidades e evolução; sem chamada não vira 0%", () => {
    const r = learningRecord("e1", win, { attendance: [{ studentId: "e1", date: "2026-03-01", mark: "Presente" }, { studentId: "e1", date: "2026-03-02", mark: "Ausente" }], results, observations: [] });
    expect(r.attendance.rate).toBe(0.5);
    expect(r.skills.map((s) => s.skillId)).toEqual(["s1", "s2"]);
    expect(r.evolution.map((e) => e.value)).toEqual([4, 7]);
    const empty = learningRecord("e2", win, { attendance: [], results: null, observations: null });
    expect(empty.attendance.rate).toBeNull();
    expect(empty.limitations.join()).toMatch(/Sem chamadas/);
    expect(empty.limitations.join()).toMatch(/Resultados não lidos/);
  });
  it("painel da turma suprime grupos pequenos só com política", () => {
    const r = learningRecord("e1", win, { attendance: [], results, observations: [] });
    expect(classPanel([r], null).skills[0]!.assessedStudents).toBe(1);
    expect(classPanel([r], 5).skills[0]!.assessedStudents).toBeNull();
    expect(classPanel([r], null).attendanceRate).toBeNull();
  });
});

const p: InterventionProposal = { studentIds: ["e1"], objectives: ["Comparar frações"], skillIds: ["s1"], responsibleIds: ["prof"],
  actions: [{ description: "Atividade com material concreto", due: "2026-04-10" }], reassessOn: "2026-04-20", evidenceRefs: ["res:i2"] };

describe("plano de recuperação (Docente L11)", () => {
  it("válido passa; sem capacidade, aluno alheio, texto clínico e sem reavaliação recusam", () => {
    const ctx = { myStudents: ["e1"], hasCapability: true };
    expect(validateIntervention(p, ctx)).toEqual([]);
    expect(validateIntervention(p, { ...ctx, hasCapability: false }).join()).toMatch(/autorização/);
    expect(validateIntervention({ ...p, studentIds: ["e9"] }, ctx).join()).toMatch(/suas turmas/);
    expect(validateIntervention({ ...p, objectives: ["Aluno com TDAH"] }, ctx).join()).toMatch(/diagnóstico/);
    expect(validateIntervention({ ...p, reassessOn: null }, ctx).join()).toMatch(/reavaliação/);
  });
  it("reavaliação compara antes × depois da mesma habilidade", () => {
    expect(reassessment(results, "e1", "s1", "2026-04-01")).toEqual({ before: 4, after: 7, change: "melhorou" });
    expect(reassessment(results, "e1", "s2", "2026-04-01").change).toBe("indeterminado");
  });
});
