/**
 * Etapa 13B — Adaptadores dos protótipos legados (8C/8D) para a Inscrição Letiva.
 *
 * Os protótipos permanecem funcionando; esta tradução apenas os faz alimentar a
 * fundação canônica. O rótulo legado de período (`periodLabel`) é preservado
 * como `labelSnapshot`, nunca como identificador de ciclo — o identificador é
 * derivado de forma estável e substituível por configuração futura.
 */
import type { AcademicLink, SchoolEnrollment } from "@/features/students/students-data";
import { demonstrationStudents } from "@/features/students/students-data";
import { CYCLE_ENROLLMENT_SCHEMA_VERSION } from "./cycle-enrollment-types";
import type {
  AcademicCycleEnrollment,
  CycleParticipation,
} from "./cycle-enrollment-types";
import {
  DEMO_ENROLLMENT_STATES,
  DEMO_PROCESS_KINDS,
  demonstrationEnrollmentConfiguration,
} from "./cycle-enrollment-fixtures";
import { DEMO_PARTICIPATION_NATURES } from "./student-life-fixtures";
import type { StudentLifeProvenance } from "./student-life-types";

/** Identificador estável derivado do rótulo legado; a identidade não é o rótulo. */
export function legacyCycleIdFromLabel(periodLabel: string): string {
  return `ciclo-legado-${periodLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

function legacyProvenance(recordedAt: string): StudentLifeProvenance {
  return {
    originTypeId: "adaptacao-prototipo-legado",
    recordedAt,
  };
}

function legacyOfferId(link: AcademicLink): string {
  return `oferta-legada-${link.offerLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

/** Traduz um vínculo letivo legado em inscrição letiva canônica. */
export function adaptCycleEnrollment(input: {
  studentId: string;
  enrollment: SchoolEnrollment;
  link: AcademicLink;
  /** Primeiro vínculo do aluno naquela unidade indica rito de ingresso. */
  isFirstLinkOfBond: boolean;
}): AcademicCycleEnrollment {
  const { studentId, enrollment, link } = input;
  const academicCycleId = legacyCycleIdFromLabel(link.periodLabel);

  return {
    cycleEnrollmentId: `insc-${link.id}`,
    studentId,
    schoolBondId: enrollment.id,
    schoolId: link.unitId,
    academicCycleId,
    educationalOfferId: legacyOfferId(link),

    curriculumMatrixIds: [],
    admissionProcessKindId: input.isFirstLinkOfBond
      ? DEMO_PROCESS_KINDS.initialAdmission
      : DEMO_PROCESS_KINDS.renewal,
    originatingRequestId: null,
    enrollmentStateDefinitionId: DEMO_ENROLLMENT_STATES.constituted,
    validity: { validFrom: enrollment.openedAt, validUntil: enrollment.closedAt },
    definitionSnapshot: {
      academicCycle: { definitionId: academicCycleId, labelSnapshot: link.periodLabel },
      educationalOffer: { definitionId: legacyOfferId(link), labelSnapshot: link.offerLabel },
      ...(link.academicOrganization
        ? {
            academicOrganization: {
              definitionId: `organizacao-legada-${link.id}`,
              labelSnapshot: link.academicOrganization,
            },
          }
        : {}),
      curriculumMatrices: [],
      governanceConfiguration: {
        definitionId: demonstrationEnrollmentConfiguration.configurationId,
        definitionVersion: demonstrationEnrollmentConfiguration.configurationVersion,
      },
    },
    recordVersion: CYCLE_ENROLLMENT_SCHEMA_VERSION,
    supersedesEnrollmentId: null,
    supersededByEnrollmentId: null,
    sourceEventIds: [],
    provenance: legacyProvenance(enrollment.openedAt),
  };
}

/** Traduz participações legadas em entidades temporais próprias. */
export function adaptCycleParticipations(input: {
  cycleEnrollmentId: string;
  link: AcademicLink;
  enrollment: SchoolEnrollment;
}): CycleParticipation[] {
  return input.link.participations.map((participation) => ({
    participationId: `part-${participation.id}`,
    cycleEnrollmentId: input.cycleEnrollmentId,
    natureDefinitionId:
      participation.nature === "Regular"
        ? DEMO_PARTICIPATION_NATURES.principalSchooling
        : DEMO_PARTICIPATION_NATURES.specializedSupport,
    participationStateDefinitionId:
      participation.situation === "Encerrada"
        ? DEMO_ENROLLMENT_STATES.concluded
        : DEMO_ENROLLMENT_STATES.inProgress,
    validity: {
      validFrom: input.enrollment.openedAt,
      validUntil: participation.situation === "Encerrada" ? input.enrollment.closedAt : null,
    },
    labelSnapshot: participation.label,
    recordVersion: CYCLE_ENROLLMENT_SCHEMA_VERSION,
    supersedesParticipationId: null,
    supersededByParticipationId: null,
    sourceEventIds: [],
    provenance: legacyProvenance(input.enrollment.openedAt),
  }));
}

/** Adapta todas as fixtures demonstrativas legadas para a fundação da 13B. */
export function adaptDemonstrationCycleEnrollments(): {
  enrollments: AcademicCycleEnrollment[];
  participations: CycleParticipation[];
} {
  const enrollments: AcademicCycleEnrollment[] = [];
  const participations: CycleParticipation[] = [];

  for (const student of demonstrationStudents) {
    for (const enrollment of student.enrollments) {
      enrollment.academicLinks.forEach((link, index) => {
        const canonical = adaptCycleEnrollment({
          studentId: student.id,
          enrollment,
          link,
          isFirstLinkOfBond: index === 0,
        });
        enrollments.push(canonical);
        participations.push(
          ...adaptCycleParticipations({
            cycleEnrollmentId: canonical.cycleEnrollmentId,
            link,
            enrollment,
          }),
        );
      });
    }
  }

  return { enrollments, participations };
}
