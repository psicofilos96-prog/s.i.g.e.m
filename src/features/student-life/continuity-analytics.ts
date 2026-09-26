/**
 * Etapa 13E — Fatos atômicos da Continuidade do Percurso para o CIECE (Cap. 14).
 *
 * Publica FATOS e EVENTOS, nunca indicadores: não existe "taxa de dependência",
 * "percentual de aproveitamento" nem "alunos em risco". O ledger de eventos é a
 * matéria-prima analítica; o estado atual existe apenas como projeção derivada.
 */
import type { InstitutionalActReference } from "./student-life-types";
import {
  currentObligationStatus,
  obligationStatusAsOf,
} from "./continuity-ledger";
import type {
  AcademicContinuityObligation,
  AcademicEquivalenceProcess,
  ContinuityEvaluation,
  ObligationLedgerEntry,
} from "./continuity-types";

/** FATO da avaliação de continuidade, com política e versão responsáveis. */
export type ContinuityEvaluationFactRow = {
  evaluationId: string;
  studentId: string;
  effectiveDate: string;
  sourceTypeDefinitionId: string;
  sourceReferenceId: string;
  sourceReferenceVersion: number | null;
  originResolutionDefinitionId: string | null;
  targetContextId: string;
  policyId: string;
  policyVersion: number;
  appliedRuleIds: readonly string[];
  resolutionStateDefinitionId: string | null;
  obligationDraftCount: number;
  equivalenceRequestCount: number;
  issueCount: number;
  supersedesEvaluationId: string | null;
  recordedAt: string;
};

/** FATO da obrigação: identidade, origem e vigência. Sem estado gravado. */
export type ContinuityObligationFactRow = {
  obligationId: string;
  studentId: string;
  obligationNatureDefinitionId: string;
  curriculumReferenceKindId: string;
  curriculumReferenceId: string;
  originId: string;
  sourceTypeDefinitionId: string;
  evaluationId: string;
  policyId: string;
  policyVersion: number;
  validFrom: string;
  validUntil: string | null;
  recordedAt: string;
};

/** EVENTO ATÔMICO do ciclo de vida da obrigação: a matéria-prima analítica. */
export type ContinuityObligationEventFactRow = {
  entryId: string;
  obligationId: string;
  studentId: string | null;
  eventTypeDefinitionId: string;
  fromStatusDefinitionId: string | null;
  toStatusDefinitionId: string;
  effectiveDate: string;
  reasonDefinitionId: string | null;
  isCorrection: boolean;
  precedingEntryId: string | null;
  institutionalActReference: InstitutionalActReference | null;
  recordedAt: string;
};

/** PROJEÇÃO DERIVADA do estado vigente; nunca substitui o ledger. */
export type ContinuityObligationStateProjectionRow = {
  obligationId: string;
  studentId: string;
  statusDefinitionId: string | null;
  asOfDate: string | null;
};

export type ContinuityEquivalenceFactRow = {
  equivalenceProcessId: string;
  studentId: string;
  originId: string;
  targetCurriculumDefinitionId: string;
  targetCurriculumDefinitionVersion: number | null;
  groupId: string;
  originReferenceCount: number;
  targetReferenceCount: number;
  decisionKindDefinitionId: string | null;
  decidedByActorId: string | null;
  capacityDefinitionId: string | null;
  decidedAt: string | null;
  institutionalActReference: InstitutionalActReference | null;
};

export type ContinuityIssueFactRow = {
  issueId: string;
  evaluationId: string;
  studentId: string;
  issueTypeDefinitionId: string;
  missingFactKeys: readonly string[];
  requiredDocumentTypeDefinitionIds: readonly string[];
  responsibleCapacityDefinitionId: string | null;
  deadlineDate: string | null;
  recordedAt: string;
};

export function continuityEvaluationFactRows(
  evaluations: readonly ContinuityEvaluation[],
): ContinuityEvaluationFactRow[] {
  return evaluations.map((evaluation) => ({
    evaluationId: evaluation.evaluationId,
    studentId: evaluation.studentId,
    effectiveDate: evaluation.effectiveDate,
    sourceTypeDefinitionId: evaluation.originReference.sourceTypeDefinitionId,
    sourceReferenceId: evaluation.originReference.sourceReference.id,
    sourceReferenceVersion: evaluation.originReference.sourceReference.version ?? null,
    originResolutionDefinitionId: evaluation.originReference.resolutionReference?.definitionId ?? null,
    targetContextId: evaluation.targetContext.targetContextId,
    policyId: evaluation.policyReference.policyId,
    policyVersion: evaluation.policyReference.policyVersion,
    appliedRuleIds: evaluation.appliedRuleIds,
    resolutionStateDefinitionId: evaluation.resolution?.resolutionStateDefinitionId ?? null,
    obligationDraftCount: evaluation.obligationDrafts.length,
    equivalenceRequestCount: evaluation.equivalenceRequests.length,
    issueCount: evaluation.issues.length,
    supersedesEvaluationId: evaluation.supersedesEvaluationId ?? null,
    recordedAt: evaluation.provenance.recordedAt,
  }));
}

export function continuityObligationFactRows(
  obligations: readonly AcademicContinuityObligation[],
): ContinuityObligationFactRow[] {
  return obligations.map((obligation) => ({
    obligationId: obligation.obligationId,
    studentId: obligation.studentId,
    obligationNatureDefinitionId: obligation.obligationNatureDefinitionId,
    curriculumReferenceKindId: obligation.curriculumReference.referenceKindId,
    curriculumReferenceId: obligation.curriculumReference.referenceId,
    originId: obligation.originReference.originId,
    sourceTypeDefinitionId: obligation.originReference.sourceTypeDefinitionId,
    evaluationId: obligation.originReference.evaluationId,
    policyId: obligation.originReference.policyId,
    policyVersion: obligation.originReference.policyVersion,
    validFrom: obligation.validity.validFrom,
    validUntil: obligation.validity.validUntil ?? null,
    recordedAt: obligation.provenance.recordedAt,
  }));
}

export function continuityObligationEventFactRows(
  entries: readonly ObligationLedgerEntry[],
  obligations: readonly AcademicContinuityObligation[] = [],
): ContinuityObligationEventFactRow[] {
  const studentByObligation = new Map(
    obligations.map((item) => [item.obligationId, item.studentId]),
  );
  return entries.map((entry) => ({
    entryId: entry.entryId,
    obligationId: entry.obligationId,
    studentId: studentByObligation.get(entry.obligationId) ?? null,
    eventTypeDefinitionId: entry.eventTypeDefinitionId,
    fromStatusDefinitionId: entry.fromStatusDefinitionId,
    toStatusDefinitionId: entry.toStatusDefinitionId,
    effectiveDate: entry.effectiveDate,
    reasonDefinitionId: entry.reasonDefinitionId ?? null,
    isCorrection: entry.isCorrection,
    precedingEntryId: entry.precedingEntryId,
    institutionalActReference: entry.institutionalActReference ?? null,
    recordedAt: entry.provenance.recordedAt,
  }));
}

/** Projeção derivada do estado; `asOfDate` ausente = estado vigente. */
export function continuityObligationStateProjectionRows(
  obligations: readonly AcademicContinuityObligation[],
  entries: readonly ObligationLedgerEntry[],
  asOfDate?: string,
): ContinuityObligationStateProjectionRow[] {
  return obligations.map((obligation) => ({
    obligationId: obligation.obligationId,
    studentId: obligation.studentId,
    statusDefinitionId:
      asOfDate === undefined
        ? currentObligationStatus(entries, obligation.obligationId)
        : obligationStatusAsOf(entries, obligation.obligationId, asOfDate),
    asOfDate: asOfDate ?? null,
  }));
}

export function continuityEquivalenceFactRows(
  processes: readonly AcademicEquivalenceProcess[],
): ContinuityEquivalenceFactRow[] {
  const rows: ContinuityEquivalenceFactRow[] = [];
  for (const process of processes) {
    for (const group of process.groups) {
      rows.push({
        equivalenceProcessId: process.equivalenceProcessId,
        studentId: process.studentId,
        originId: process.originId,
        targetCurriculumDefinitionId: process.targetCurriculumVersion.definitionId,
        targetCurriculumDefinitionVersion:
          process.targetCurriculumVersion.definitionVersion ?? null,
        groupId: group.groupId,
        originReferenceCount: group.originReferences.length,
        targetReferenceCount: group.targetReferences.length,
        decisionKindDefinitionId: group.decision?.decisionKindDefinitionId ?? null,
        decidedByActorId: group.decision?.actorReference.actorId ?? null,
        capacityDefinitionId: group.decision?.capacityDefinitionId ?? null,
        decidedAt: group.decision?.decidedAt ?? null,
        institutionalActReference: group.decision?.institutionalActReference ?? null,
      });
    }
  }
  return rows;
}

export function continuityIssueFactRows(
  evaluations: readonly ContinuityEvaluation[],
): ContinuityIssueFactRow[] {
  const rows: ContinuityIssueFactRow[] = [];
  for (const evaluation of evaluations) {
    for (const issue of evaluation.issues) {
      rows.push({
        issueId: issue.issueId,
        evaluationId: evaluation.evaluationId,
        studentId: evaluation.studentId,
        issueTypeDefinitionId: issue.issueTypeDefinitionId,
        missingFactKeys: issue.missingFactKeys ?? [],
        requiredDocumentTypeDefinitionIds: issue.requiredDocumentTypeDefinitionIds ?? [],
        responsibleCapacityDefinitionId: issue.responsibleCapacityDefinitionId ?? null,
        deadlineDate: issue.deadlineDate ?? null,
        recordedAt: evaluation.provenance.recordedAt,
      });
    }
  }
  return rows;
}
