import { describe, expect, it } from "vitest";
import { accessEvent, aeeWritable, guidanceForTeacher, linkAdaptation, type NeiGuidance } from "./inclusion-teacher-view";

const g: NeiGuidance[] = [
  { guidanceId: "g1", studentId: "e1", validFrom: "2026-02-01", releasedToTeachers: true, kind: "recurso", text: "Usar letra ampliada", cid: "F84", report: "laudo.pdf", authorId: "nei" },
  { guidanceId: "g2", studentId: "e1", validFrom: "2026-02-01", releasedToTeachers: false, kind: "estrategia", text: "Interno" },
  { guidanceId: "g3", studentId: "e9", validFrom: "2026-02-01", releasedToTeachers: true, kind: "recurso", text: "Outra turma" },
  { guidanceId: "g4", studentId: "e1", validFrom: "2026-02-01", releasedToTeachers: true, kind: "estrategia", text: "Conforme laudo, sentar à frente" },
  { guidanceId: "g5", studentId: "e1", validFrom: "2026-02-01", validUntil: "2026-02-28", releasedToTeachers: true, kind: "recurso", text: "Encerrada" },
];
const ctx = { myStudents: ["e1"], date: "2026-03-10" };

describe("AEE e inclusão para o docente (L14)", () => {
  it("regente vê só liberada, vigente, das próprias turmas e sem campos clínicos", () => {
    const r = guidanceForTeacher(g, ctx);
    expect(r.items.map((i) => i.guidanceId)).toEqual(["g1"]);
    expect(Object.keys(r.items[0]!)).not.toContain("cid");
    expect(JSON.stringify(r.items)).not.toMatch(/F84|laudo|nei"/);
    expect(r.withheld).toBe(1);
  });
  it("adaptação só referencia orientação visível do mesmo estudante", () => {
    const vis = guidanceForTeacher(g, ctx).items;
    expect(linkAdaptation(["e1"], "g1", vis)).toEqual({ ok: true, ref: "nei-guidance:g1" });
    expect(linkAdaptation(["e2"], "g1", vis).ok).toBe(false);
    expect(linkAdaptation(["e1"], "g2", vis).ok).toBe(false);
  });
  it("docente AEE escreve só PAEE/AEE com concessão vigente na escola", () => {
    expect(aeeWritable({ role: "aee", schoolId: "s" }, "s", "2026-03-10")).toContain("paee");
    expect(aeeWritable({ role: "aee", schoolId: "s" }, "s", "2026-03-10")).not.toContain("pei");
    expect(aeeWritable({ role: "aee", schoolId: "s", validUntil: "2026-01-01" }, "s", "2026-03-10")).toEqual([]);
    expect(aeeWritable(null, "s", "2026-03-10")).toEqual([]);
  });
  it("trilha exige finalidade", () => {
    expect(() => accessEvent("p", "e1", "x", "")).toThrow();
    expect(accessEvent("p", "e1", "x", "planejar aula")).toMatchObject({ purpose: "planejar aula" });
  });
});
