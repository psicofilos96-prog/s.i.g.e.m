/**
 * Etapa 13C — Adaptadores de compatibilidade da Turma.
 *
 * As telas atuais e o Diário Inteligente continuam consumindo
 * `DemonstrationClass` e `classId`. Estes adaptadores traduzem o protótipo para
 * o contrato canônico `AcademicClass` + `ClassGroupingDefinition` SEM reescrever
 * consumidores e sem transformar o protótipo em fonte de verdade.
 *
 * Saneamentos realizados na tradução:
 * - `academicPeriod`/`academicYearId` → `academicCycleId` único (12B/12H/13B);
 * - `shift`/`journey` textuais → `shiftDefinitionId`/`journeyDefinitionId`;
 * - `academicOrganization` livre → `academicOrganizationId` estável;
 * - `demonstrativeHeadcount` NÃO é traduzido: ocupação é projeção das alocações;
 * - capacidade não vira campo da turma: é registro temporal próprio.
 */
import type { DemonstrationClass } from "@/features/classes/classes-data";
import type { StudentLifeProvenance } from "./student-life-types";
import type { AcademicClass, ClassGroupingDefinition } from "./class-allocation-types";

/** Normaliza rótulo livre em identificador estável, sem perder o rótulo original. */
export function stableIdFromLabel(prefix: string, label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${prefix}-${slug}`;
}

const ADAPTER_PROVENANCE: StudentLifeProvenance = {
  originTypeId: "adaptador-prototipo-turmas",
  recordedAt: "2026-01-01T00:00:00.000Z",
};

/** Traduz a turma demonstrativa para o contrato canônico, preservando o `classId`. */
export function academicClassFromDemonstration(klass: DemonstrationClass): AcademicClass {
  return {
    classId: klass.id,
    institutionalIdentifier: { value: klass.code },
    schoolId: klass.unitId,
    academicCycleId: klass.academicYearId,
    educationalOfferId: klass.offerId,
    ...(klass.academicOrganization
      ? { academicOrganizationId: stableIdFromLabel("org", klass.academicOrganization) }
      : {}),
    shiftDefinitionId: stableIdFromLabel("turno", klass.shift),
    journeyDefinitionId: stableIdFromLabel("jornada", klass.journey),
    curriculumMatrixIds: klass.matrixId ? [klass.matrixId] : [],
    classStateDefinitionId: stableIdFromLabel("estado-turma", klass.situation),
    validity: { validFrom: `${klass.academicPeriod.order}-01-01`, validUntil: null },
    recordVersion: 1,
    supersedesClassId: null,
    sourceEventIds: [],
    provenance: ADAPTER_PROVENANCE,
  };
}

/**
 * Traduz os agrupamentos atendidos pela turma. Turma multietapa permanece UMA
 * turma com vários agrupamentos internos — nunca turmas fictícias distintas.
 */
export function groupingsFromDemonstration(
  klass: DemonstrationClass,
): ClassGroupingDefinition[] {
  return klass.groupings.map((grouping) => ({
    groupingId: grouping.id,
    classId: klass.id,
    labelSnapshot: grouping.label,
    academicOrganizationId: stableIdFromLabel("org", grouping.label),
    validity: { validFrom: `${klass.academicPeriod.order}-01-01`, validUntil: null },
    provenance: ADAPTER_PROVENANCE,
  }));
}

export function academicClassesFromDemonstration(
  classes: readonly DemonstrationClass[],
): { classes: AcademicClass[]; groupings: ClassGroupingDefinition[] } {
  return {
    classes: classes.map(academicClassFromDemonstration),
    groupings: classes.flatMap(groupingsFromDemonstration),
  };
}
