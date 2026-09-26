/**
 * Etapa 13F — Derivações do prontuário e do repositório documental.
 *
 * Nada derivável é persistido: versão vigente, superação histórica, pertinência
 * a um aluno e atendimento de exigência documental são SEMPRE calculados aqui,
 * a partir das entidades e das definições configuradas.
 */
import type {
  DocumentRecord,
  DocumentRepresentation,
  DossierEntityReference,
  DossierRecord,
  DossierRelation,
  GovernedResourceDescriptor,
  PersonalRelationshipRecord,
  StudentResponsibilityAssignment,
} from "./dossier-types";

export const DOSSIER_RESOURCE_KIND_IDS = {
  dossierRecord: "registro-de-prontuario",
  documentRecord: "registro-documental",
  documentRepresentation: "representacao-documental",
  personalRelationship: "relacao-pessoal",
  responsibilityAssignment: "atribuicao-de-responsabilidade",
} as const;

export const DOSSIER_ENTITY_KIND_IDS = {
  student: "aluno",
  person: "pessoa",
  unit: "unidade-escolar",
  process: "processo-institucional",
  externalEntity: "entidade-externa",
} as const;

// ------------------------------------------------- Superação / versão vigente

/** Mapa DERIVADO `recordId → recordId que o superou`. */
export function supersessionIndex(
  items: readonly { id: string; supersedesId?: string | undefined }[],
): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const item of items) {
    if (item.supersedesId) index.set(item.supersedesId, item.id);
  }
  return index;
}

export function dossierRecordSupersessionIndex(
  records: readonly DossierRecord[],
): ReadonlyMap<string, string> {
  return supersessionIndex(
    records.map((record) => ({
      id: record.recordId,
      supersedesId: record.supersedesRecordId,
    })),
  );
}

export function documentSupersessionIndex(
  documents: readonly DocumentRecord[],
): ReadonlyMap<string, string> {
  return supersessionIndex(
    documents.map((document) => ({
      id: document.documentRecordId,
      supersedesId: document.supersedesDocumentRecordId,
    })),
  );
}

/** Registros ainda vigentes: os que nenhuma retificação posterior superou. */
export function currentDossierRecords(
  records: readonly DossierRecord[],
): readonly DossierRecord[] {
  const index = dossierRecordSupersessionIndex(records);
  return records.filter((record) => !index.has(record.recordId));
}

export function currentDocumentRecords(
  documents: readonly DocumentRecord[],
): readonly DocumentRecord[] {
  const index = documentSupersessionIndex(documents);
  return documents.filter(
    (document) => !index.has(document.documentRecordId),
  );
}

// ------------------------------------------------------------- Pertinência

export function referencesEntity(
  subjectReferences: readonly { reference: DossierEntityReference }[],
  entityKindDefinitionId: string,
  entityId: string,
): boolean {
  return subjectReferences.some(
    (subject) =>
      subject.reference.entityKindDefinitionId === entityKindDefinitionId &&
      subject.reference.entityId === entityId,
  );
}

/** Registros que REFEREM o aluno — inclusive registros multi-aluno. */
export function dossierRecordsForStudent(
  records: readonly DossierRecord[],
  studentId: string,
): readonly DossierRecord[] {
  return records.filter((record) =>
    referencesEntity(
      record.subjectReferences,
      DOSSIER_ENTITY_KIND_IDS.student,
      studentId,
    ),
  );
}

/**
 * Documentos RELACIONADOS ao aluno. O dossiê encontra documentos; não é dono
 * deles: o mesmo documento pode referir-se a várias pessoas e processos.
 */
export function documentsForStudent(
  documents: readonly DocumentRecord[],
  studentId: string,
): readonly DocumentRecord[] {
  return documents.filter((document) =>
    referencesEntity(
      document.subjectReferences,
      DOSSIER_ENTITY_KIND_IDS.student,
      studentId,
    ),
  );
}

export function representationsOfDocument(
  representations: readonly DocumentRepresentation[],
  documentRecordId: string,
): readonly DocumentRepresentation[] {
  return representations.filter(
    (representation) => representation.documentRecordId === documentRecordId,
  );
}

export function relationsTouching(
  relations: readonly DossierRelation[],
  entityId: string,
): readonly DossierRelation[] {
  return relations.filter(
    (relation) =>
      relation.sourceReference.entityId === entityId ||
      relation.targetReference.entityId === entityId,
  );
}

// ------------------------------------------ Relação ≠ responsabilidade

function withinValidity(
  item: { validFrom: string; validUntil: string | null },
  isoDate: string,
): boolean {
  if (isoDate < item.validFrom) return false;
  return item.validUntil === null || isoDate <= item.validUntil;
}

export function relationshipsAsOf(
  relationships: readonly PersonalRelationshipRecord[],
  studentId: string,
  isoDate: string,
): readonly PersonalRelationshipRecord[] {
  return relationships.filter(
    (relationship) =>
      relationship.relatedReference.entityId === studentId &&
      withinValidity(relationship, isoDate),
  );
}

/**
 * Responsabilidades vigentes. Não são inferidas de parentesco: quem representa
 * o aluno é quem possui ATRIBUIÇÃO vigente com fundamento declarado.
 */
export function responsibilityAssignmentsAsOf(
  assignments: readonly StudentResponsibilityAssignment[],
  studentId: string,
  isoDate: string,
): readonly StudentResponsibilityAssignment[] {
  return assignments.filter(
    (assignment) =>
      assignment.subjectReference.entityId === studentId &&
      withinValidity(assignment, isoDate),
  );
}

/** Quem detém determinada capacidade institucional na data informada. */
export function personsHoldingCapacity(input: {
  assignments: readonly StudentResponsibilityAssignment[];
  studentId: string;
  capacityDefinitionId: string;
  isoDate: string;
}): readonly string[] {
  return responsibilityAssignmentsAsOf(
    input.assignments,
    input.studentId,
    input.isoDate,
  )
    .filter((assignment) =>
      assignment.responsibilityCapacityDefinitionIds.includes(
        input.capacityDefinitionId,
      ),
    )
    .map((assignment) => assignment.personId);
}

// ---------------------------------------- Exigências documentais (13B ↔ 13F)

export type DocumentRequirementDeclaration = {
  requirementDefinitionId: string;
  /** Tipos documentais que satisfazem a exigência (configurado). */
  acceptedDocumentTypeDefinitionIds: readonly string[];
  /** Estados documentais que a satisfazem (configurado). */
  acceptedDocumentStatusDefinitionIds: readonly string[];
  /** Dispensa declarada por ato, quando houver. */
  waiverDefinitionId?: string;
};

export type DocumentRequirementResolution = {
  requirementDefinitionId: string;
  /** Aberto: satisfeito, dispensado, pendente, inconclusivo… configurado. */
  resolutionDefinitionId: string;
  satisfiedByDocumentRecordIds: readonly string[];
  diagnostics: readonly string[];
};

export const DOCUMENT_REQUIREMENT_RESOLUTION_IDS = {
  satisfied: "satisfeito",
  waived: "dispensado",
  pending: "pendente",
  inconclusive: "inconclusivo",
} as const;

/**
 * Resolve exigências documentais da inscrição (13B) CONTRA o repositório da 13F,
 * sem duplicar documento algum e sem publicar flag `hasPendingDocuments`.
 * Catálogo ausente ⇒ inconclusivo; ausência nunca satisfaz exigência.
 */
export function resolveDocumentRequirements(input: {
  requirements: readonly DocumentRequirementDeclaration[];
  documents: readonly DocumentRecord[];
  studentId: string;
  waivedRequirementDefinitionIds?: readonly string[];
}): readonly DocumentRequirementResolution[] {
  const available = currentDocumentRecords(
    documentsForStudent(input.documents, input.studentId),
  );
  const waived = input.waivedRequirementDefinitionIds ?? [];

  return input.requirements.map((requirement) => {
    if (waived.includes(requirement.requirementDefinitionId)) {
      return {
        requirementDefinitionId: requirement.requirementDefinitionId,
        resolutionDefinitionId: DOCUMENT_REQUIREMENT_RESOLUTION_IDS.waived,
        satisfiedByDocumentRecordIds: [],
        diagnostics: [],
      };
    }
    if (
      requirement.acceptedDocumentTypeDefinitionIds.length === 0 ||
      requirement.acceptedDocumentStatusDefinitionIds.length === 0
    ) {
      return {
        requirementDefinitionId: requirement.requirementDefinitionId,
        resolutionDefinitionId: DOCUMENT_REQUIREMENT_RESOLUTION_IDS.inconclusive,
        satisfiedByDocumentRecordIds: [],
        diagnostics: [
          "Exigência sem catálogo de tipos ou estados aceitos: inconclusiva.",
        ],
      };
    }
    const matching = available.filter(
      (document) =>
        requirement.acceptedDocumentTypeDefinitionIds.includes(
          document.documentTypeDefinitionId,
        ) &&
        requirement.acceptedDocumentStatusDefinitionIds.includes(
          document.documentStatusDefinitionId,
        ),
    );
    return {
      requirementDefinitionId: requirement.requirementDefinitionId,
      resolutionDefinitionId:
        matching.length > 0
          ? DOCUMENT_REQUIREMENT_RESOLUTION_IDS.satisfied
          : DOCUMENT_REQUIREMENT_RESOLUTION_IDS.pending,
      satisfiedByDocumentRecordIds: matching.map(
        (document) => document.documentRecordId,
      ),
      diagnostics: [],
    };
  });
}

// ------------------------------------------------- Descritores governados

export function describeDossierRecord(
  record: DossierRecord,
  projectableFieldPaths: readonly string[],
): GovernedResourceDescriptor {
  return {
    reference: {
      entityKindDefinitionId: DOSSIER_RESOURCE_KIND_IDS.dossierRecord,
      entityId: record.recordId,
    },
    resourceKindDefinitionId: DOSSIER_RESOURCE_KIND_IDS.dossierRecord,
    typeDefinitionId: record.recordTypeDefinitionId,
    sensitivityLevelDefinitionId: record.sensitivityLevelDefinitionId,
    subjectReferences: record.subjectReferences,
    scopeEntities: record.scopeEntities,
    projectableFieldPaths,
    effectiveDate: record.effectiveDate,
    recordedAt: record.provenance.recordedAt,
  };
}

export function describeDocumentRecord(
  document: DocumentRecord,
  projectableFieldPaths: readonly string[],
): GovernedResourceDescriptor {
  return {
    reference: {
      entityKindDefinitionId: DOSSIER_RESOURCE_KIND_IDS.documentRecord,
      entityId: document.documentRecordId,
    },
    resourceKindDefinitionId: DOSSIER_RESOURCE_KIND_IDS.documentRecord,
    typeDefinitionId: document.documentTypeDefinitionId,
    sensitivityLevelDefinitionId: document.sensitivityLevelDefinitionId,
    subjectReferences: document.subjectReferences,
    scopeEntities: document.scopeEntities,
    projectableFieldPaths,
    ...(document.issuanceDate ? { effectiveDate: document.issuanceDate } : {}),
    recordedAt: document.provenance.recordedAt,
  };
}
