import { runReport, type CellValue, type ReportDefinition } from "@/features/reports/report-engine";
import type { LessonRow, MyDiary } from "./diary-w-source";

export const TEACHER_LESSON_REPORT: ReportDefinition = {
  id: "registro-aulas-docente", version: 1, title: "Registro de aulas do professor",
  description: "Cópia de consulta das aulas registradas na regência selecionada, sem homologação ou assinatura.",
  source: "my_diary_lessons", params: [
    { id: "assignment", label: "Regência", type: "text", required: true, maxLength: 200 },
    { id: "substitution", label: "Substituição", type: "text", required: false, maxLength: 200 },
  ],
  columns: [
    { id: "date", label: "Data", kind: "date" },
    { id: "content", label: "Conteúdo ministrado", kind: "text" },
    { id: "observation", label: "Observação", kind: "text" },
    { id: "version", label: "Versão", kind: "number" },
    { id: "versionId", label: "Registro", kind: "text" },
  ], formats: ["pdf"], reproducible: true, syncRowLimit: 20_000,
};

export function lessonReport(diary: MyDiary, lessons: readonly LessonRow[] | null, now = new Date()) {
  if (!lessons) throw new Error("Fonte de aulas não foi lida.");
  if (new Set(lessons.map((lesson) => lesson.logical_record_id)).size !== lessons.length) throw new Error("A fonte contém versões vigentes conflitantes.");
  const rows: Record<string, CellValue>[] = lessons.map((lesson) => ({
    date: lesson.lesson_date, content: lesson.facts.content ?? null, observation: lesson.facts.observation ?? null,
    version: lesson.version_number, versionId: lesson.lesson_version_id,
  }));
  return runReport(TEACHER_LESSON_REPORT, { params: { assignment: diary.assignment_id, substitution: diary.substitution_id }, sort: [{ column: "date", dir: "asc" }, { column: "versionId", dir: "asc" }] }, rows, now);
}