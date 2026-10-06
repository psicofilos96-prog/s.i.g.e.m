import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");
describe("Frente W.2 — contrato das telas", () => {
  it("acompanhamento administrativo nunca grava nem oferece autoria docente", () => {
    const s = read("src/features/teacher-diary/diary-overview-page.tsx");
    expect(s).not.toMatch(/record(Lesson|Attendance)|record_lesson|record_attendance|Registrar aula|Fazer chamada/);
  });
  it("Meus diários usa só writers v2 e leitores da própria regência", () => {
    const s = read("src/features/teacher-diary/diary-w-source.ts");
    expect(s).not.toMatch(/"record_lesson_version"|"record_attendance_version"|from\("lesson_record_versions"\)/);
    expect(s).toMatch(/my_diary_lessons/);
  });
  it("planejamento nunca cria aula nem chamada", () => {
    const s = read("src/features/teaching-planning/planning-source.ts");
    expect(s).not.toMatch(/record_lesson_version|record_attendance_version/);
  });
});
