import { brand } from "@/config/branding";
import { fingerprint, toPdfFile } from "@/features/reports/report-engine";
import { isReportCode, recordEmission } from "@/features/reports/report-emissions";
import { parseBoundary, z } from "@/lib/runtime-shape";
import { lessonReport, TEACHER_LESSON_REPORT } from "./lesson-report";
import { readDiaryWithDeadline } from "./diary-read";
import type { LessonRow, MyDiary } from "./diary-w-source";

async function prepareLessonReport(diary: MyDiary, lessons: readonly LessonRow[]) {
  const result = lessonReport(diary, lessons);
  const snapshotHash = await fingerprint(result);
  const blob = await toPdfFile(result, { headerLines: [brand.fullName], title: TEACHER_LESSON_REPORT.title }, [
    `Escola (identificador): ${diary.school_id} · Turma (identificador): ${diary.class_id}`,
    `Componente: ${diary.component_label ?? diary.item_key ?? "não disponível"}`,
    "Cópia de consulta — não substitui o Diário completo; sem homologação ou assinatura.",
    "Fonte: aulas registradas da regência selecionada. Não inclui notas nem frequência individual.",
    `Versão do modelo: ${result.definitionVersion} · Impressão digital dos registros: ${snapshotHash}`,
    "Uso restrito à finalidade institucional; não redistribuir.",
  ]);
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
  return { result, blob, sha256 };
}

// Keep the preparation private to this mounted selection: uncertain retries must
// register the very same bytes/key, not regenerate a timestamped document.
export function createLessonReportAttempt(diary: MyDiary, lessons: readonly LessonRow[], key: string, isCurrent: () => boolean) {
  let prepared: ReturnType<typeof prepareLessonReport> | undefined;
  let emitted: { verification_code: string } | undefined;
  return async () => {
    if (!isCurrent()) throw new Error("Exportação descartada após mudança de contexto.");
    prepared ??= prepareLessonReport(diary, lessons).catch((error: unknown) => { prepared = undefined; throw error; });
    const { result, blob, sha256 } = await prepared;
    if (!isCurrent()) throw new Error("Exportação descartada após mudança de contexto.");
    if (!emitted) {
      const raw = await readDiaryWithDeadline(() => recordEmission({
    reportId: result.definitionId, version: result.definitionVersion, title: TEACHER_LESSON_REPORT.title, format: "pdf", sector: "docente",
    choice: { sourceId: result.definitionId, from: null, to: null, columns: result.columns.map((c) => c.id), filters: [{ column: "assignment", equals: diary.assignment_id }, { column: "substitution", equals: diary.substitution_id }], sort: [] },
    rows: result.rows.length, sha256, reissueOf: null, key,
  }));
      emitted = parseBoundary(z.object({ verification_code: z.string().refine(isReportCode) }), raw, "teacher-lesson-report-emission");
    }
    if (!isCurrent()) throw new Error("Exportação descartada após mudança de contexto.");
    return { blob, name: `registro-aulas-${emitted.verification_code}.pdf`, code: emitted.verification_code };
  };
}

export async function exportLessonReport(diary: MyDiary, lessons: readonly LessonRow[], key: string, isCurrent: () => boolean) {
  return createLessonReportAttempt(diary, lessons, key, isCurrent)();
}