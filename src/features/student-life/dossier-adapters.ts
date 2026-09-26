/**
 * Etapa 13F — Adaptadores de fonte para a projeção longitudinal.
 *
 * Cada adaptador traduz entidades de um domínio em candidatos da timeline SEM
 * copiá-las para o dossiê: a verdade permanece no domínio de origem. Nenhum
 * adaptador conhece capítulos do plano de desenvolvimento; a origem é sempre
 * um `sourceTypeDefinitionId` configurado.
 */
import {
  describeDocumentRecord,
  describeDossierRecord,
  DOSSIER_ENTITY_KIND_IDS,
  referencesEntity,
} from "./dossier-records";
import type { TimelineCandidate, TimelineSourceAdapter } from "./dossier-projection";
import type { DocumentRecord, DossierRecord } from "./dossier-types";

/** Naturezas de fonte demonstrativas: identificadores abertos, nunca enum. */
export const DOSSIER_SOURCE_TYPE_DEFINITION_IDS = {
  dossierRecord: "registro-de-prontuario",
  documentRecord: "registro-documental",
  institutionalFact: "fato-institucional-referenciado",
} as const;

const studentIdsOf = (
  subjects: readonly { reference: { entityKindDefinitionId: string; entityId: string } }[],
): readonly string[] =>
  subjects
    .filter(
      (subject) =>
        subject.reference.entityKindDefinitionId ===
        DOSSIER_ENTITY_KIND_IDS.student,
    )
    .map((subject) => subject.reference.entityId);

export const DOSSIER_RECORD_PROJECTABLE_FIELDS = [
  "resumo",
  "detalhe",
  "conteudoSensivel",
] as const;

export const DOCUMENT_PROJECTABLE_FIELDS = [
  "tipo",
  "identificacao",
  "estado",
] as const;

/** Adaptador de registros próprios do prontuário. */
export function createDossierRecordAdapter(options?: {
  projectableFieldPaths?: readonly string[];
}): TimelineSourceAdapter {
  const fields =
    options?.projectableFieldPaths ?? DOSSIER_RECORD_PROJECTABLE_FIELDS;
  return (entity) => {
    const record = entity as DossierRecord;
    if (!record?.recordId) return null;
    const payload: Record<string, unknown> = { ...record.structuredPayload };
    if (record.supplementaryText) {
      payload["textoComplementar"] = record.supplementaryText;
    }
    const candidate: TimelineCandidate = {
      sourceTypeDefinitionId:
        DOSSIER_SOURCE_TYPE_DEFINITION_IDS.dossierRecord,
      resource: describeDossierRecord(record, [
        ...fields,
        ...(record.supplementaryText ? ["textoComplementar"] : []),
      ]),
      payload,
      effectiveDate: record.effectiveDate,
      recordedAt: record.provenance.recordedAt,
      subjectStudentIds: studentIdsOf(record.subjectReferences),
      ...(record.supersedesRecordId
        ? { supersedesEntityId: record.supersedesRecordId }
        : {}),
    };
    return candidate;
  };
}

/** Adaptador de objetos documentais: metadados, nunca o arquivo. */
export function createDocumentRecordAdapter(options?: {
  projectableFieldPaths?: readonly string[];
}): TimelineSourceAdapter {
  const fields = options?.projectableFieldPaths ?? DOCUMENT_PROJECTABLE_FIELDS;
  return (entity) => {
    const document = entity as DocumentRecord;
    if (!document?.documentRecordId) return null;
    const candidate: TimelineCandidate = {
      sourceTypeDefinitionId:
        DOSSIER_SOURCE_TYPE_DEFINITION_IDS.documentRecord,
      resource: describeDocumentRecord(document, fields),
      payload: {
        tipo: document.documentTypeDefinitionId,
        identificacao: document.documentIdentifier ?? null,
        estado: document.documentStatusDefinitionId,
      },
      effectiveDate:
        document.issuanceDate ?? document.provenance.recordedAt.slice(0, 10),
      recordedAt: document.provenance.recordedAt,
      subjectStudentIds: studentIdsOf(document.subjectReferences),
      ...(document.supersedesDocumentRecordId
        ? { supersedesEntityId: document.supersedesDocumentRecordId }
        : {}),
    };
    return candidate;
  };
}

/**
 * Adaptador genérico para fatos de OUTROS domínios (inscrição, alocação,
 * mobilidade, continuidade, resultado publicado). Recebe uma função de
 * tradução declarada pelo chamador: o dossiê não conhece esses domínios.
 */
export function createInstitutionalFactAdapter<TEntity>(
  translate: (entity: TEntity) => TimelineCandidate | null,
): TimelineSourceAdapter {
  return (entity) => translate(entity as TEntity);
}

/** Verifica se um documento se refere ao aluno (titularidade plural). */
export function documentRefersToStudent(
  document: DocumentRecord,
  studentId: string,
): boolean {
  return referencesEntity(
    document.subjectReferences,
    DOSSIER_ENTITY_KIND_IDS.student,
    studentId,
  );
}
