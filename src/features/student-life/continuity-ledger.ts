/**
 * Etapa 13E — Ledger e projeções temporais das obrigações de continuidade.
 *
 * A obrigação NÃO possui campo de estado. O estado vigente e o estado em
 * qualquer data histórica são PROJEÇÕES do ledger de eventos institucionais.
 * Assim o sistema responde "quais obrigações existiam em 01/03?" sem depender
 * de snapshot atual e sem reescrever o passado.
 */
import { diagnostic } from "./student-life-diagnostics";
import type {
  InternalId,
  StudentLifeDiagnostic,
  StudentLifeEventScope,
} from "./student-life-types";
import {
  CONTINUITY_DIAGNOSTIC_CODES as CODES,
  CONTINUITY_DIAGNOSTIC_TYPES as TYPES,
} from "./continuity-diagnostics";
import type {
  AcademicContinuityObligation,
  AcademicContinuityPolicy,
  ContinuityGovernanceConfiguration,
  ObligationLedgerEntry,
} from "./continuity-types";

/** Retificações substituem entradas anteriores; nada é apagado do ledger. */
export function currentObligationEntries(
  entries: readonly ObligationLedgerEntry[],
  obligationId: InternalId,
): readonly ObligationLedgerEntry[] {
  const superseded = new Set(
    entries
      .filter((entry) => entry.isCorrection && entry.precedingEntryId)
      .map((entry) => entry.precedingEntryId as string),
  );
  return entries
    .filter((entry) => entry.obligationId === obligationId && !superseded.has(entry.entryId))
    .slice()
    .sort((a, b) =>
      a.effectiveDate === b.effectiveDate
        ? a.provenance.recordedAt.localeCompare(b.provenance.recordedAt)
        : a.effectiveDate.localeCompare(b.effectiveDate),
    );
}

/** Estado vigente: último evento aplicável do ledger. */
export function currentObligationStatus(
  entries: readonly ObligationLedgerEntry[],
  obligationId: InternalId,
): string | null {
  const chain = currentObligationEntries(entries, obligationId);
  return chain.length === 0 ? null : chain[chain.length - 1]!.toStatusDefinitionId;
}

/**
 * Reconstrução histórica: estado da obrigação conforme os fatos com eficácia
 * até `effectiveDate`. Duas datas distintas devem poder devolver estados
 * distintos, sem qualquer campo persistido.
 */
export function obligationStatusAsOf(
  entries: readonly ObligationLedgerEntry[],
  obligationId: InternalId,
  effectiveDate: string,
): string | null {
  const applicable = currentObligationEntries(entries, obligationId).filter(
    (entry) => entry.effectiveDate <= effectiveDate,
  );
  return applicable.length === 0 ? null : applicable[applicable.length - 1]!.toStatusDefinitionId;
}

/** Obrigações existentes (com evento eficaz) em determinada data. */
export function obligationsAsOf(
  obligations: readonly AcademicContinuityObligation[],
  entries: readonly ObligationLedgerEntry[],
  effectiveDate: string,
): readonly { obligation: AcademicContinuityObligation; statusDefinitionId: string }[] {
  const rows: { obligation: AcademicContinuityObligation; statusDefinitionId: string }[] = [];
  for (const obligation of obligations) {
    const status = obligationStatusAsOf(entries, obligation.obligationId, effectiveDate);
    if (status === null) continue;
    rows.push({ obligation, statusDefinitionId: status });
  }
  return rows;
}

export type ObligationEventValidation = {
  /** `null` = inconclusivo: faltou definição configurada para decidir. */
  allowed: boolean | null;
  diagnostics: readonly StudentLifeDiagnostic[];
};

/**
 * Valida um evento de obrigação: tipo de evento e estado de destino precisam
 * ser definições cadastradas, e a cadeia de estados precisa ser coerente.
 * Cumprimento nunca é "só trocar o status": exige evento com fato institucional.
 */
export function validateObligationEvent(
  policy: AcademicContinuityPolicy,
  governance: ContinuityGovernanceConfiguration,
  entries: readonly ObligationLedgerEntry[],
  entry: ObligationLedgerEntry,
  scope: StudentLifeEventScope,
): ObligationEventValidation {
  const diagnostics: StudentLifeDiagnostic[] = [];
  if (!governance.obligationEventTypeDefinitionIds.includes(entry.eventTypeDefinitionId)) {
    diagnostics.push(
      diagnostic(CODES.obligationEventTypeUndeclared, TYPES.obligation, "blocker", scope, {
        parameters: { eventTypeDefinitionId: entry.eventTypeDefinitionId },
      }),
    );
  }
  if (!policy.obligationStatusDefinitionIds.includes(entry.toStatusDefinitionId)) {
    diagnostics.push(
      diagnostic(CODES.obligationStatusUndeclared, TYPES.obligation, "blocker", scope, {
        parameters: { statusDefinitionId: entry.toStatusDefinitionId },
      }),
    );
  }
  const previous = currentObligationStatus(entries, entry.obligationId);
  if (previous !== entry.fromStatusDefinitionId) {
    diagnostics.push(
      diagnostic(CODES.obligationStatusChainBroken, TYPES.integrity, "blocker", scope, {
        parameters: {
          expectedFrom: previous,
          declaredFrom: entry.fromStatusDefinitionId,
        },
      }),
    );
  }
  if (entry.isCorrection && !entry.provenance.correctionReasonDefinitionId) {
    diagnostics.push(
      diagnostic(CODES.correctionReasonMissing, TYPES.integrity, "blocker", scope),
    );
  }
  return {
    allowed: diagnostics.some((item) => item.severity === "blocker") ? false : true,
    diagnostics,
  };
}

// ------------------------------------------------- Constituição da obrigação

export type ObligationConstitutionInput = {
  obligationId: InternalId;
  studentId: InternalId;
  draft: {
    obligationNatureDefinitionId: string;
    curriculumReference: AcademicContinuityObligation["curriculumReference"];
    initialStatusDefinitionId: string;
    validFrom: string;
    validUntil?: string | null;
    reasonDefinitionId?: string;
  };
  originReference: AcademicContinuityObligation["originReference"];
  eventTypeDefinitionId: string;
  entryId: InternalId;
  provenance: AcademicContinuityObligation["provenance"];
};

/**
 * Constitui a obrigação E o fato institucional que a originou, em um único
 * resultado atômico: não existe obrigação sem evento que a explique.
 */
export function constituteObligation(input: ObligationConstitutionInput): {
  obligation: AcademicContinuityObligation;
  entry: ObligationLedgerEntry;
} {
  const obligation: AcademicContinuityObligation = {
    obligationId: input.obligationId,
    studentId: input.studentId,
    obligationNatureDefinitionId: input.draft.obligationNatureDefinitionId,
    curriculumReference: input.draft.curriculumReference,
    originReference: input.originReference,
    validity: {
      validFrom: input.draft.validFrom,
      ...(input.draft.validUntil !== undefined ? { validUntil: input.draft.validUntil } : {}),
    },
    provenance: input.provenance,
  };
  const entry: ObligationLedgerEntry = {
    entryId: input.entryId,
    obligationId: input.obligationId,
    eventTypeDefinitionId: input.eventTypeDefinitionId,
    fromStatusDefinitionId: null,
    toStatusDefinitionId: input.draft.initialStatusDefinitionId,
    effectiveDate: input.draft.validFrom,
    ...(input.draft.reasonDefinitionId
      ? { reasonDefinitionId: input.draft.reasonDefinitionId }
      : {}),
    isCorrection: false,
    precedingEntryId: null,
    provenance: input.provenance,
  };
  return { obligation, entry };
}
