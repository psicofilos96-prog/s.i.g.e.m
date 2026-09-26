/**
 * Etapa 13B — Fatos atômicos da Inscrição Letiva para o CIECE (Capítulo 14).
 *
 * A 13B publica FATOS e DATAS. Ela não publica interpretações: nada de
 * "ingresso tardio", "tem pendência", percentual, taxa, indicador ou gráfico.
 * O consumidor analítico compara `studentValidFrom` com `cycleStartDate` se essa
 * for a definição analítica que ele adotar.
 */
import type {
  AcademicCycleEnrollment,
  CycleParticipation,
  EnrollmentRequirementEvaluation,
} from "./cycle-enrollment-types";

export type EnrollmentFactRow = {
  cycleEnrollmentId: string;
  recordVersion: number;
  studentId: string;
  schoolBondId: string;
  schoolId: string;
  academicCycleId: string;
  educationalOfferId: string;
  academicOrganizationId: string | null;
  curriculumMatrixCount: number;
  admissionProcessKindId: string;
  enrollmentStateDefinitionId: string;
  enrollmentStateReasonDefinitionId: string | null;
  /** Data atômica: início oficial do ciclo, quando informado pela configuração. */
  cycleStartDate: string | null;
  /** Data atômica: início da vigência DESTE aluno no ciclo. */
  studentValidFrom: string;
  studentValidUntil: string | null;
  /** Data atômica: registro administrativo do ato. */
  recordedAt: string;
  originatingRequestId: string | null;
  supersedesEnrollmentId: string | null;
};

export type ParticipationFactRow = {
  participationId: string;
  cycleEnrollmentId: string;
  natureDefinitionId: string;
  participationStateDefinitionId: string;
  validFrom: string;
  validUntil: string | null;
  recordVersion: number;
};

export type RequirementFactRow = {
  cycleEnrollmentId: string;
  requirementDefinitionId: string;
  status: string;
  requirementEffectDefinitionId: string | null;
  deadlineDate: string | null;
  deadlineOriginKindId: string | null;
  hasInstitutionalAct: boolean;
};

export function projectEnrollmentFacts(
  enrollments: readonly AcademicCycleEnrollment[],
  cycleStartDates: Readonly<Record<string, string>> = {},
): EnrollmentFactRow[] {
  return enrollments.map((item) => ({
    cycleEnrollmentId: item.cycleEnrollmentId,
    recordVersion: item.recordVersion,
    studentId: item.studentId,
    schoolBondId: item.schoolBondId,
    schoolId: item.schoolId,
    academicCycleId: item.academicCycleId,
    educationalOfferId: item.educationalOfferId,
    academicOrganizationId: item.academicOrganizationId ?? null,
    curriculumMatrixCount: item.curriculumMatrixIds.length,
    admissionProcessKindId: item.admissionProcessKindId,
    enrollmentStateDefinitionId: item.enrollmentStateDefinitionId,
    enrollmentStateReasonDefinitionId: item.enrollmentStateReasonDefinitionId ?? null,
    cycleStartDate: cycleStartDates[item.academicCycleId] ?? null,
    studentValidFrom: item.validity.validFrom,
    studentValidUntil: item.validity.validUntil,
    recordedAt: item.provenance.recordedAt,
    originatingRequestId: item.originatingRequestId ?? null,
    supersedesEnrollmentId: item.supersedesEnrollmentId ?? null,
  }));
}

export function projectParticipationFacts(
  participations: readonly CycleParticipation[],
): ParticipationFactRow[] {
  return participations.map((item) => ({
    participationId: item.participationId,
    cycleEnrollmentId: item.cycleEnrollmentId,
    natureDefinitionId: item.natureDefinitionId,
    participationStateDefinitionId: item.participationStateDefinitionId,
    validFrom: item.validity.validFrom,
    validUntil: item.validity.validUntil,
    recordVersion: item.recordVersion,
  }));
}

export function projectRequirementFacts(
  cycleEnrollmentId: string,
  evaluations: readonly EnrollmentRequirementEvaluation[],
): RequirementFactRow[] {
  return evaluations.map((item) => ({
    cycleEnrollmentId,
    requirementDefinitionId: item.requirementDefinitionId,
    status: item.status,
    requirementEffectDefinitionId: item.requirementEffectDefinitionId,
    deadlineDate: item.deadline?.date ?? null,
    deadlineOriginKindId: item.deadline?.originKindId ?? null,
    hasInstitutionalAct: Boolean(item.act),
  }));
}
