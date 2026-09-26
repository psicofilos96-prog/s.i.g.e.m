/**
 * Etapa 13E — Adaptadores tipados de fontes acadêmicas.
 *
 * O motor nunca conhece a fonte: cada fonte entra por um adaptador que traduz
 * para `NormalizedAcademicOrigin`, preservando referência, versão e proveniência.
 * `sourceTypeDefinitionId` é aberto — uma terceira fonte (sistema legado,
 * integração estadual, base de outra rede) entra por novo adaptador, sem tocar
 * no domínio nem no motor.
 *
 * A normalização NÃO reinterpreta a verdade acadêmica: ela referencia a
 * resolução declarada pela fonte e admite legitimamente sua ausência.
 */
import type { StudentAcademicCycleProjection } from "@/features/academic-projections/academic-projection-types";
import type { InternalId, StudentLifeProvenance } from "./student-life-types";
import type {
  ExternalAcademicRecord,
  NormalizedAcademicDimension,
  NormalizedAcademicFact,
  NormalizedAcademicOrigin,
} from "./continuity-types";

/** Naturezas de fonte já conhecidas; a lista NÃO fecha o contrato. */
export const CONTINUITY_SOURCE_TYPE_DEFINITION_IDS = {
  canonicalProjection: "projecao-canonica-do-encerramento",
  externalAcademicRecord: "registro-academico-externo",
} as const;

export const CONTINUITY_ABSENCE_REASONS = {
  collectionNotNormalized: "valor-coletivo-nao-normalizado",
} as const;

function normalizeProjectionFact(fact: {
  factId: string;
  value: unknown;
  unit?: string;
  unavailableReason?: string;
  labelSnapshot?: string;
}): NormalizedAcademicFact {
  const isScalar =
    typeof fact.value === "number" || typeof fact.value === "string" || typeof fact.value === "boolean";
  return {
    factKey: fact.factId,
    value: isScalar ? (fact.value as string | number | boolean) : null,
    ...(fact.unit ? { unit: fact.unit } : {}),
    ...(fact.unavailableReason
      ? { unavailableReason: fact.unavailableReason }
      : Array.isArray(fact.value)
        ? { unavailableReason: CONTINUITY_ABSENCE_REASONS.collectionNotNormalized }
        : {}),
    ...(fact.labelSnapshot ? { labelSnapshot: fact.labelSnapshot } : {}),
  };
}

/** Fonte interna: projeção canônica da 12L, com versão e proveniência. */
export function normalizeFromCanonicalProjection(
  projection: StudentAcademicCycleProjection,
  options: { originId: InternalId; provenance: StudentLifeProvenance },
): NormalizedAcademicOrigin {
  const dimensions: NormalizedAcademicDimension[] = projection.dimensions.map((dimension) => ({
    dimensionId: dimension.dimensionId,
    dimensionKindId: dimension.dimensionKindId,
    ...(dimension.labelSnapshot ? { labelSnapshot: dimension.labelSnapshot } : {}),
    curriculumReference: {
      referenceKindId: dimension.dimensionKindId,
      referenceId: dimension.dimensionId,
      ...(dimension.labelSnapshot ? { labelSnapshot: dimension.labelSnapshot } : {}),
    },
    facts: dimension.facts.map(normalizeProjectionFact),
  }));
  const attendanceDimensions: NormalizedAcademicDimension[] = projection.attendance.dimensions.map(
    (dimension) => ({
      dimensionId: dimension.dimensionId,
      dimensionKindId: dimension.dimensionKindId,
      ...(dimension.labelSnapshot ? { labelSnapshot: dimension.labelSnapshot } : {}),
      facts: dimension.facts.map(normalizeProjectionFact),
    }),
  );
  const facts: NormalizedAcademicFact[] = [
    ...projection.facts.map(normalizeProjectionFact),
    ...projection.attendance.facts.map(normalizeProjectionFact),
  ];
  return {
    originId: options.originId,
    studentId: projection.studentId,
    sourceTypeDefinitionId: CONTINUITY_SOURCE_TYPE_DEFINITION_IDS.canonicalProjection,
    sourceSchemaVersion: projection.projectionSchemaVersion,
    sourceReference: {
      kind: "encerramento-de-ciclo",
      id: projection.closingSnapshotId,
      version: projection.closingVersion,
      state: projection.institutionalState,
      materializedAt: projection.provenance.materializedAt,
    },
    ...(projection.resolution.standingId
      ? {
          resolutionReference: {
            definitionId: projection.resolution.standingId,
            sourceRecordId: projection.closingSnapshotId,
            sourceVersion: projection.closingVersion,
          },
        }
      : {}),
    facts,
    dimensions: [...dimensions, ...attendanceDimensions],
    provenance: options.provenance,
  };
}

/** Fonte externa: histórico, declaração, certidão ou documentação parcial. */
export function normalizeFromExternalRecord(
  record: ExternalAcademicRecord,
  options: { originId: InternalId },
): NormalizedAcademicOrigin {
  return {
    originId: options.originId,
    studentId: record.studentId,
    sourceTypeDefinitionId: CONTINUITY_SOURCE_TYPE_DEFINITION_IDS.externalAcademicRecord,
    sourceSchemaVersion: record.sourceSchemaVersion,
    sourceReference: {
      kind: record.documentTypeDefinitionId,
      id: record.externalRecordId,
      ...(record.verificationStatusDefinitionId
        ? { state: record.verificationStatusDefinitionId }
        : {}),
      ...(record.issuingEntityName ? { labelSnapshot: record.issuingEntityName } : {}),
      ...(record.issuanceDate ? { materializedAt: record.issuanceDate } : {}),
    },
    ...(record.resolutionReference ? { resolutionReference: record.resolutionReference } : {}),
    facts: record.facts,
    dimensions: record.dimensions,
    provenance: record.provenance,
  };
}
