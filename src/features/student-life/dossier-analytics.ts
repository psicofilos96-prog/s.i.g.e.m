/**
 * Etapa 13F — Exposição analítica ao CIECE (Cap. 14).
 *
 * Publica FATOS ATÔMICOS AUTORIZADOS, nunca agregações: não existe
 * "quantidade de documentos", "pendências por turma" nem "ocorrências por mês".
 * Quem conta é o CIECE.
 *
 * Além disso, a EXISTÊNCIA de um fato só é analiticamente disponível quando a
 * política de exposição a autoriza: `fato analiticamente disponível` ≠
 * `conteúdo autorizado para determinado consumidor`.
 */
import type {
  DocumentRecord,
  DocumentRepresentation,
  DossierEntityReference,
  DossierRecord,
  DossierRelation,
  StudentResponsibilityAssignment,
} from "./dossier-types";

/** Política de exposição analítica: decide o que sequer existe para o cubo. */
export type AnalyticalExposurePolicy = {
  policyId: string;
  policyVersion: number;
  homologated: boolean;
  rules: readonly {
    ruleId: string;
    resourceKindDefinitionIds: readonly string[];
    typeDefinitionIds?: readonly string[];
    sensitivityLevelDefinitionIds?: readonly string[];
    /** Expor a existência do fato ao cubo analítico. */
    exposeExistence: boolean;
    /** Atributos estruturados liberados; ausente = nenhum. */
    exposedFieldPaths?: readonly string[];
  }[];
};

function exposureFor(
  policy: AnalyticalExposurePolicy,
  resourceKindDefinitionId: string,
  typeDefinitionId: string,
  sensitivityLevelDefinitionId: string,
) {
  if (!policy.homologated) return null;
  return (
    policy.rules.find((rule) => {
      if (!rule.resourceKindDefinitionIds.includes(resourceKindDefinitionId))
        return false;
      if (
        rule.typeDefinitionIds &&
        !rule.typeDefinitionIds.includes(typeDefinitionId)
      )
        return false;
      if (
        rule.sensitivityLevelDefinitionIds &&
        !rule.sensitivityLevelDefinitionIds.includes(
          sensitivityLevelDefinitionId,
        )
      )
        return false;
      return true;
    }) ?? null
  );
}

export type DossierRecordFactRow = {
  recordId: string;
  recordTypeDefinitionId: string;
  recordClassificationDefinitionId: string | null;
  sensitivityLevelDefinitionId: string;
  subjectEntityKindDefinitionId: string;
  subjectEntityId: string;
  subjectRoleDefinitionId: string;
  institutionalScopeEntityId: string | null;
  effectiveDate: string;
  recordedAt: string;
  supersedesRecordId: string | null;
  originTypeId: string;
  /** Atributos liberados pela política de exposição; nunca o payload inteiro. */
  exposedAttributes: Readonly<Record<string, unknown>>;
};

export type DocumentFactRow = {
  documentRecordId: string;
  documentTypeDefinitionId: string;
  documentStatusDefinitionId: string;
  verificationStatusDefinitionId: string | null;
  sensitivityLevelDefinitionId: string;
  subjectEntityKindDefinitionId: string;
  subjectEntityId: string;
  subjectRoleDefinitionId: string;
  institutionalScopeEntityId: string | null;
  relevantDate: string | null;
  recordedAt: string;
  supersedesDocumentRecordId: string | null;
  originTypeId: string;
};

export type DocumentRepresentationFactRow = {
  representationId: string;
  documentRecordId: string;
  representationKindDefinitionId: string;
  assetId: string;
  recordedAt: string;
};

export type DossierRelationFactRow = {
  relationId: string;
  relationTypeDefinitionId: string;
  sourceEntityKindDefinitionId: string;
  sourceEntityId: string;
  targetEntityKindDefinitionId: string;
  targetEntityId: string;
  recordedAt: string;
};

export type ResponsibilityFactRow = {
  assignmentId: string;
  personId: string;
  subjectEntityId: string;
  responsibilityCapacityDefinitionId: string;
  basisDefinitionId: string | null;
  validFrom: string;
  validUntil: string | null;
  recordedAt: string;
};

const firstScopeId = (
  scopeEntities: readonly DossierEntityReference[],
): string | null => scopeEntities[0]?.entityId ?? null;

export function dossierRecordFactRows(input: {
  records: readonly DossierRecord[];
  exposurePolicy: AnalyticalExposurePolicy;
  resourceKindDefinitionId: string;
}): readonly DossierRecordFactRow[] {
  const rows: DossierRecordFactRow[] = [];
  for (const record of input.records) {
    const exposure = exposureFor(
      input.exposurePolicy,
      input.resourceKindDefinitionId,
      record.recordTypeDefinitionId,
      record.sensitivityLevelDefinitionId,
    );
    if (!exposure || !exposure.exposeExistence) continue;
    const exposedAttributes: Record<string, unknown> = {};
    for (const path of exposure.exposedFieldPaths ?? []) {
      if (path in record.structuredPayload) {
        exposedAttributes[path] = record.structuredPayload[path];
      }
    }
    for (const subject of record.subjectReferences) {
      rows.push({
        recordId: record.recordId,
        recordTypeDefinitionId: record.recordTypeDefinitionId,
        recordClassificationDefinitionId:
          record.recordClassificationDefinitionId ?? null,
        sensitivityLevelDefinitionId: record.sensitivityLevelDefinitionId,
        subjectEntityKindDefinitionId:
          subject.reference.entityKindDefinitionId,
        subjectEntityId: subject.reference.entityId,
        subjectRoleDefinitionId: subject.subjectRoleDefinitionId,
        institutionalScopeEntityId: firstScopeId(record.scopeEntities),
        effectiveDate: record.effectiveDate,
        recordedAt: record.provenance.recordedAt,
        supersedesRecordId: record.supersedesRecordId ?? null,
        originTypeId: record.provenance.originTypeId,
        exposedAttributes,
      });
    }
  }
  return rows;
}

export function documentFactRows(input: {
  documents: readonly DocumentRecord[];
  exposurePolicy: AnalyticalExposurePolicy;
  resourceKindDefinitionId: string;
}): readonly DocumentFactRow[] {
  const rows: DocumentFactRow[] = [];
  for (const document of input.documents) {
    const exposure = exposureFor(
      input.exposurePolicy,
      input.resourceKindDefinitionId,
      document.documentTypeDefinitionId,
      document.sensitivityLevelDefinitionId,
    );
    if (!exposure || !exposure.exposeExistence) continue;
    for (const subject of document.subjectReferences) {
      rows.push({
        documentRecordId: document.documentRecordId,
        documentTypeDefinitionId: document.documentTypeDefinitionId,
        documentStatusDefinitionId: document.documentStatusDefinitionId,
        verificationStatusDefinitionId:
          document.verificationStatusDefinitionId ?? null,
        sensitivityLevelDefinitionId: document.sensitivityLevelDefinitionId,
        subjectEntityKindDefinitionId:
          subject.reference.entityKindDefinitionId,
        subjectEntityId: subject.reference.entityId,
        subjectRoleDefinitionId: subject.subjectRoleDefinitionId,
        institutionalScopeEntityId: firstScopeId(document.scopeEntities),
        relevantDate: document.issuanceDate ?? null,
        recordedAt: document.provenance.recordedAt,
        supersedesDocumentRecordId:
          document.supersedesDocumentRecordId ?? null,
        originTypeId: document.provenance.originTypeId,
      });
    }
  }
  return rows;
}

export function documentRepresentationFactRows(
  representations: readonly DocumentRepresentation[],
): readonly DocumentRepresentationFactRow[] {
  return representations.map((representation) => ({
    representationId: representation.representationId,
    documentRecordId: representation.documentRecordId,
    representationKindDefinitionId:
      representation.representationKindDefinitionId,
    assetId: representation.assetId,
    recordedAt: representation.provenance.recordedAt,
  }));
}

export function dossierRelationFactRows(
  relations: readonly DossierRelation[],
): readonly DossierRelationFactRow[] {
  return relations.map((relation) => ({
    relationId: relation.relationId,
    relationTypeDefinitionId: relation.relationTypeDefinitionId,
    sourceEntityKindDefinitionId:
      relation.sourceReference.entityKindDefinitionId,
    sourceEntityId: relation.sourceReference.entityId,
    targetEntityKindDefinitionId:
      relation.targetReference.entityKindDefinitionId,
    targetEntityId: relation.targetReference.entityId,
    recordedAt: relation.provenance.recordedAt,
  }));
}

export function responsibilityFactRows(
  assignments: readonly StudentResponsibilityAssignment[],
): readonly ResponsibilityFactRow[] {
  const rows: ResponsibilityFactRow[] = [];
  for (const assignment of assignments) {
    for (const capacityId of assignment.responsibilityCapacityDefinitionIds) {
      rows.push({
        assignmentId: assignment.assignmentId,
        personId: assignment.personId,
        subjectEntityId: assignment.subjectReference.entityId,
        responsibilityCapacityDefinitionId: capacityId,
        basisDefinitionId: assignment.basisDefinitionId ?? null,
        validFrom: assignment.validFrom,
        validUntil: assignment.validUntil,
        recordedAt: assignment.provenance.recordedAt,
      });
    }
  }
  return rows;
}
