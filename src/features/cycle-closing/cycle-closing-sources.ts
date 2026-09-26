/**
 * Etapa 12K — ADAPTADORES de fontes oficiais.
 *
 * Cada módulo traduz os seus registros para observações genéricas
 * (`sourceKind`, `state`, dimensões abertas, fatos materializados). O inspetor e
 * os avaliadores nunca importam módulo algum: recebem observações e expectativas.
 *
 * Aqui não há regra normativa: nenhuma exigência, nenhum patamar, nenhuma
 * situação. Apenas tradução de fato e proveniência, com versão preservada.
 */
import type { AcademicStandingRecord } from "@/features/assessment/academic-standing-types";
import type { PeriodClosingRecord } from "@/features/assessment/period-closing-types";
import type { PeriodAttendanceClosingRecord } from "@/features/diary/attendance-closing-types";
import type { StructuredMinute } from "@/features/collegial/collegial-types";
import type { ClosingExpectation, ClosingObservation } from "./cycle-closing-types";

export const SOURCE_KIND = {
  calendar: "calendario",
  assessmentPeriodClosing: "fechamento-avaliativo-periodo",
  attendancePeriodClosing: "fechamento-frequencia-periodo",
  cycleConsolidation: "consolidacao-ciclo",
  academicStanding: "situacao-academica",
  deliberation: "deliberacao",
  journeyRecord: "registro-de-percurso",
} as const;

export const calendarObservations = (
  calendars: readonly { id: string; year: number; status: string; label?: string }[],
  academicYearId?: string,
): ClosingObservation[] =>
  calendars.map((calendar) => ({
    sourceKind: SOURCE_KIND.calendar,
    sourceId: calendar.id,
    state: calendar.status,
    dimensions: { academicYearId: academicYearId ?? String(calendar.year) },
    ...(calendar.label ? { label: calendar.label } : {}),
  }));

export const assessmentClosingObservations = (
  records: readonly PeriodClosingRecord[],
  classId: string,
): ClosingObservation[] =>
  records
    .filter((record) => record.scope.classId === classId)
    .map((record) => ({
      sourceKind: SOURCE_KIND.assessmentPeriodClosing,
      sourceId: record.id,
      version: record.version,
      state: "lavrado",
      dimensions: {
        classId: record.scope.classId,
        academicYearId: record.scope.academicYearId,
        periodId: record.scope.periodId,
      },
      materializedAt: record.closedAt,
      label: `Fechamento avaliativo do período ${record.scope.periodId}`,
    }));

export const attendanceClosingObservations = (
  records: readonly PeriodAttendanceClosingRecord[],
  classId: string,
): ClosingObservation[] =>
  records
    .filter((record) => record.scope.classId === classId)
    .map((record) => ({
      sourceKind: SOURCE_KIND.attendancePeriodClosing,
      sourceId: record.id,
      version: record.version,
      state: "lavrado",
      dimensions: {
        classId: record.scope.classId,
        academicYearId: record.scope.academicYearId,
        periodId: record.scope.periodId,
      },
      materializedAt: record.closedAt,
      label: `Fechamento de frequência do período ${record.scope.periodId}`,
    }));

export const standingObservations = (
  records: readonly AcademicStandingRecord[],
  scope: { classId: string; cycleId: string },
): ClosingObservation[] =>
  records
    .filter((record) => record.cycleId === scope.cycleId)
    .map((record) => ({
      sourceKind: SOURCE_KIND.academicStanding,
      sourceId: record.id,
      version: record.version,
      /** Situação determinada ou estado operacional preservado como está. */
      state: record.standingId ? "determinada" : record.operationalState,
      dimensions: {
        classId: scope.classId,
        cycleId: record.cycleId,
        studentId: record.studentId,
        academicYearId: record.academicYearId,
      },
      materializedAt: record.determinedAt,
      label: `Situação acadêmica do percurso ${record.studentId}`,
    }));

export const deliberationObservations = (
  minutes: readonly StructuredMinute[],
  scope: { classId: string; cycleId: string },
): ClosingObservation[] =>
  minutes.flatMap((minute) =>
    minute.deliberations.map((deliberation) => ({
      sourceKind: SOURCE_KIND.deliberation,
      sourceId: deliberation.id,
      version: minute.version,
      state: "ata-encerrada",
      dimensions: {
        classId: scope.classId,
        cycleId: deliberation.cycleId ?? scope.cycleId,
        ...(deliberation.studentId ? { studentId: deliberation.studentId } : {}),
      },
      materializedAt: minute.closedAt,
      label: `Deliberação registrada em ata ${minute.id}`,
    })),
  );

/** Expectativas declaradas pela própria cadeia (períodos e percursos). */
export const periodExpectations = (input: {
  sourceKind: string;
  classId: string;
  academicYearId: string;
  periods: readonly { id: string; label: string }[];
}): ClosingExpectation[] =>
  input.periods.map((period) => ({
    sourceKind: input.sourceKind,
    dimensions: {
      classId: input.classId,
      academicYearId: input.academicYearId,
      periodId: period.id,
    },
    label: period.label,
  }));

export const studentExpectations = (input: {
  sourceKind: string;
  classId: string;
  cycleId: string;
  students: readonly { id: string; name: string }[];
}): ClosingExpectation[] =>
  input.students.map((student) => ({
    sourceKind: input.sourceKind,
    dimensions: { classId: input.classId, cycleId: input.cycleId, studentId: student.id },
    label: student.name,
  }));
