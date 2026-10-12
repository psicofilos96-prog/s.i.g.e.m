import { describe, expect, it } from "vitest";
import { lessonFocus, validStudents, PREVISTA_NOTE, type CentralBlock } from "./lesson-central";

const b = (id: string, start: string, end: string): CentralBlock => ({ blockId: id, date: "2026-10-13", start, end, classLabel: id, componentLabel: "MAT", classId: id, component: "MAT" });
const day = [b("t2", "09:00", "09:50"), b("t1", "08:00", "08:50")];

describe("Central da Aula", () => {
  it("aula em andamento tem prioridade sobre a próxima", () => {
    expect(lessonFocus(day, "2026-10-13T08:20")).toMatchObject({ kind: "agora", block: { classId: "t1" } });
    expect(lessonFocus(day, "2026-10-13T08:55")).toMatchObject({ kind: "proxima", block: { classId: "t2" } });
    expect(lessonFocus(day, "2026-10-13T10:00")).toMatchObject({ kind: "encerradas" });
    expect(lessonFocus([], "2026-10-13T10:00")).toEqual({ kind: "sem-grade" });
  });
  it("prevista não é ministrada; alunos só com alocação vigente única", () => {
    expect(PREVISTA_NOTE).toMatch(/prevista/);
    expect(validStudents([{ id: "a", currentClassId: "t1" }, { id: "b", currentClassId: null }, { id: "c", currentClassId: "t2" }], "t1").map((s) => s.id)).toEqual(["a"]);
  });
});
