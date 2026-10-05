import { afterEach, describe, expect, it } from "vitest";
import { setDiaryPersistenceMode } from "./diary-persistence-mode";
import { reportPeriodsForClass } from "./infant-descriptive-report";
import { infantFixtures } from "./infant-experiences";
import { buildStudentJourney } from "@/features/assessment/assessment-student-journey";
import { demonstrationStudents } from "@/features/students/students-data";

/** Gate E2E do Diário: fora do laboratório nenhuma fixture preenche fatos oficiais. */
describe("Diário oficial nunca recebe fixture", () => {
  afterEach(() => setDiaryPersistenceMode("laboratorio"));

  it.each(["cloud", "pendente"] as const)("modo %s: sem períodos nem vivências demonstrativas", (mode) => {
    setDiaryPersistenceMode(mode);
    for (const s of demonstrationStudents) {
      for (const p of s.placements ?? []) if (p.classId) expect(reportPeriodsForClass(p.classId)).toEqual([]);
    }
    expect(infantFixtures()).toEqual([]);
  });

  it("percurso com estado de sessão ausente permanece ausente (não usa configuração do laboratório)", () => {
    const student = demonstrationStudents[0]!;
    const classId = student.placements?.find((p) => p.classId)?.classId ?? "x";
    const journey = buildStudentJourney({
      student,
      contextClassId: classId,
      referenceDate: "2026-06-01",
      configurationState: { kind: "inexistente", reason: "Sem configuração homologada." },
      configurations: [],
      source: { instruments: [], entries: [], typeLabel: () => "", periodLabel: () => "", infantRecords: [] },
    });
    expect(journey).toEqual({ kind: "sem-configuracao", reason: "Sem configuração homologada." });
  });
});
