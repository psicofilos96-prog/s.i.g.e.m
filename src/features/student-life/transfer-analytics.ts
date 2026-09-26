/**
 * Etapa 13D — Fatos atômicos da Mobilidade Institucional para o CIECE (Cap. 14).
 *
 * A 13D publica FATOS, DATAS, ATOS e REFERÊNCIAS. Ela NÃO publica interpretação:
 * nada de "evasão", "transferência irregular", "prazo excedido", "destino
 * desconhecido" como flag, taxa ou indicador.
 *
 * Duas naturezas distintas e rotuladas:
 *   FATO ATÔMICO          — existe independentemente de qualquer política.
 *   PROJEÇÃO REPRODUZÍVEL — resultado de uma política, versão e data explícitas.
 */
import type { InstitutionalActReference } from "./student-life-types";
import { currentProcessVersion, currentTransitions, processVersionCount } from "./transfer-ledger";
import type {
  InstitutionalTransferProcess,
  TransferDocumentRecord,
  TransferProcessVersionRecord,
  TransferStageTransitionRecord,
} from "./transfer-types";

/** FATO ATÔMICO do processo, com identidade permanente e versão vigente. */
export type TransferProcessFactRow = {
  transferProcessId: string;
  studentId: string;
  processKindDefinitionId: string;
  institutionalIdentifier: string | null;
  /** Projeções da cadeia; nenhuma delas é campo gravado na entidade. */
  currentVersionId: string | null;
  versionCount: number;
  currentStageDefinitionId: string | null;
  originContextTypeDefinitionId: string | null;
  originAbsenceReasonDefinitionId: string | null;
  destinationContextTypeDefinitionId: string | null;
  destinationAbsenceReasonDefinitionId: string | null;
  recordedAt: string;
};

/** FATO ATÔMICO da transição registrada no ledger. */
export type TransferTransitionFactRow = {
  transitionId: string;
  transferProcessId: string;
  transitionDefinitionId: string;
  sequenceNumber: number;
  fromStageDefinitionId: string | null;
  toStageDefinitionId: string;
  reasonDefinitionId: string | null;
  effectiveDate: string;
  recordedAt: string;
  recordedInVersionId: string | null;
  isCorrection: boolean;
  precedingTransitionId: string | null;
  /** Efeitos configurados aplicados, por identificador; nunca booleanos. */
  appliedEffectDefinitionIds: readonly string[];
  institutionalActReference: InstitutionalActReference | null;
};

/** FATO ATÔMICO do documento, com estados cadastrados por identificador. */
export type TransferDocumentFactRow = {
  documentRecordId: string;
  transferProcessId: string;
  documentTypeDefinitionId: string;
  documentIdentifier: string | null;
  issuingAuthority: string | null;
  issuanceDate: string | null;
  documentStatusDefinitionId: string;
  verificationStatusDefinitionId: string | null;
  recordedAt: string;
  institutionalActReference: InstitutionalActReference | null;
};

/** FATO ATÔMICO do intervalo institucional de transição. */
export type TransitionIntervalFactRow = {
  transitionIntervalId: string;
  transferProcessId: string;
  transitionKindDefinitionId: string;
  startDate: string;
  deadlineDate: string | null;
  concludedDate: string | null;
  recordedAt: string;
  institutionalActReference: InstitutionalActReference | null;
};

/**
 * FATO ATÔMICO de mobilidade do aluno: é este fato — e somente ele — que a
 * política de projeção de vida escolar consome para produzir situações.
 */
export type StudentMobilityAtomicFactRow = {
  mobilityFactTypeId: string;
  transferProcessId: string;
  studentId: string;
  processKindDefinitionId: string;
  transitionId: string;
  effectiveDate: string;
  originContextTypeDefinitionId: string | null;
  destinationContextTypeDefinitionId: string | null;
  destinationAbsenceReasonDefinitionId: string | null;
  recordedAt: string;
};

export function transferProcessFactRows(
  processes: readonly InstitutionalTransferProcess[],
  versions: readonly TransferProcessVersionRecord[],
  transitions: readonly TransferStageTransitionRecord[],
): TransferProcessFactRow[] {
  return processes.map((process) => {
    const version = currentProcessVersion(versions, process.transferProcessId);
    const chain = currentTransitions(transitions, process.transferProcessId);
    const last = chain[chain.length - 1];
    return {
      transferProcessId: process.transferProcessId,
      studentId: process.studentId,
      processKindDefinitionId: process.processKindDefinitionId,
      institutionalIdentifier: process.institutionalIdentifier?.value ?? null,
      currentVersionId: version?.transferProcessVersionId ?? null,
      versionCount: processVersionCount(versions, process.transferProcessId),
      currentStageDefinitionId: last?.toStageDefinitionId ?? null,
      originContextTypeDefinitionId:
        version?.originPole.reference?.contextReferenceTypeDefinitionId ?? null,
      originAbsenceReasonDefinitionId:
        version?.originPole.absence?.absenceReasonDefinitionId ?? null,
      destinationContextTypeDefinitionId:
        version?.destinationPole.reference?.contextReferenceTypeDefinitionId ?? null,
      destinationAbsenceReasonDefinitionId:
        version?.destinationPole.absence?.absenceReasonDefinitionId ?? null,
      recordedAt: process.provenance.recordedAt,
    };
  });
}

export function transferTransitionFactRows(
  transitions: readonly TransferStageTransitionRecord[],
): TransferTransitionFactRow[] {
  return transitions.map((item) => ({
    transitionId: item.transitionId,
    transferProcessId: item.transferProcessId,
    transitionDefinitionId: item.transitionDefinitionId,
    sequenceNumber: item.sequenceNumber,
    fromStageDefinitionId: item.fromStageDefinitionId,
    toStageDefinitionId: item.toStageDefinitionId,
    reasonDefinitionId: item.reasonDefinitionId ?? null,
    effectiveDate: item.effectiveDate,
    recordedAt: item.provenance.recordedAt,
    recordedInVersionId: item.recordedInVersionId ?? null,
    isCorrection: item.isCorrection,
    precedingTransitionId: item.precedingTransitionId ?? null,
    appliedEffectDefinitionIds: (item.appliedEffects ?? []).map(
      (effect) => effect.effectDefinitionId,
    ),
    institutionalActReference: item.originatingAct ?? null,
  }));
}

export function transferDocumentFactRows(
  documents: readonly TransferDocumentRecord[],
): TransferDocumentFactRow[] {
  return documents.map((item) => ({
    documentRecordId: item.documentRecordId,
    transferProcessId: item.transferProcessId,
    documentTypeDefinitionId: item.documentTypeDefinitionId,
    documentIdentifier: item.documentIdentifier ?? null,
    issuingAuthority: item.issuingAuthority ?? null,
    issuanceDate: item.issuanceDate ?? null,
    documentStatusDefinitionId: item.documentStatusDefinitionId,
    verificationStatusDefinitionId: item.verificationStatusDefinitionId ?? null,
    recordedAt: item.provenance.recordedAt,
    institutionalActReference: item.act ?? null,
  }));
}

export function transitionIntervalFactRows(
  versions: readonly TransferProcessVersionRecord[],
): TransitionIntervalFactRow[] {
  const rows: TransitionIntervalFactRow[] = [];
  for (const version of versions) {
    const interval = version.transitionInterval;
    if (!interval) continue;
    rows.push({
      transitionIntervalId: interval.transitionIntervalId,
      transferProcessId: interval.transferProcessId,
      transitionKindDefinitionId: interval.transitionKindDefinitionId,
      startDate: interval.startDate,
      deadlineDate: interval.deadlineDate ?? null,
      concludedDate: interval.concludedDate ?? null,
      recordedAt: interval.provenance.recordedAt,
      institutionalActReference: interval.act ?? null,
    });
  }
  return rows;
}

/**
 * Extrai os FATOS DE MOBILIDADE publicados pelas transições. O tipo do fato vem
 * dos parâmetros do efeito configurado; o motor não conhece nenhum tipo.
 */
export function studentMobilityAtomicFactRows(
  processes: readonly InstitutionalTransferProcess[],
  versions: readonly TransferProcessVersionRecord[],
  transitions: readonly TransferStageTransitionRecord[],
): StudentMobilityAtomicFactRow[] {
  const processById = new Map(processes.map((item) => [item.transferProcessId, item]));
  const rows: StudentMobilityAtomicFactRow[] = [];
  for (const process of processes) {
    const version = currentProcessVersion(versions, process.transferProcessId);
    for (const transition of currentTransitions(transitions, process.transferProcessId)) {
      for (const effect of transition.appliedEffects ?? []) {
        const factTypeId = effect.parameters?.["mobilityFactTypeId"];
        if (typeof factTypeId !== "string" || factTypeId.length === 0) continue;
        const owner = processById.get(transition.transferProcessId);
        if (!owner) continue;
        rows.push({
          mobilityFactTypeId: factTypeId,
          transferProcessId: owner.transferProcessId,
          studentId: owner.studentId,
          processKindDefinitionId: owner.processKindDefinitionId,
          transitionId: transition.transitionId,
          effectiveDate: transition.effectiveDate,
          originContextTypeDefinitionId:
            version?.originPole.reference?.contextReferenceTypeDefinitionId ?? null,
          destinationContextTypeDefinitionId:
            version?.destinationPole.reference?.contextReferenceTypeDefinitionId ?? null,
          destinationAbsenceReasonDefinitionId:
            version?.destinationPole.absence?.absenceReasonDefinitionId ?? null,
          recordedAt: transition.provenance.recordedAt,
        });
      }
    }
  }
  return rows;
}
