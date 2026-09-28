/**
 * Etapa 6D.3.2.3 — Registro Oficial do Lote.
 *
 * Fronteira entre "preparei N lançamentos" e "N lançamentos passaram a integrar
 * oficialmente o Diário". A superfície NUNCA cria versões: ela entrega o rascunho
 * a `prepareAssessmentEntryBatch`, que revalida tudo contra os FATOS vigentes e
 * devolve um `AssessmentEntryBatchPlan`; só `commitAssessmentEntryBatch` produz
 * `AssessmentEntryVersion`.
 *
 * Invariantes:
 * - Revalidação no registro: o commit reprepara o plano a partir dos fatos
 *   correntes e exige a MESMA impressão digital; estado de interface nunca é fonte.
 * - Concorrência por entrada: cada operação carrega a versão-base esperada
 *   (ausência de versão ou `currentVersionId`); divergência é conflito real.
 * - Atomicidade: qualquer impedimento ⇒ nenhuma versão nova. Sucesso ⇒ todas e
 *   somente as operações do plano, cada uma com proveniência do lote.
 * - Idempotência: reenviar o mesmo plano já registrado não cria versões.
 * - Sem regra de completude homologada, "sem registro" não impede o registro.
 * - Alterar fato oficial é RETIFICAÇÃO: obedece a `resolveAssessmentCorrection`.
 * - Registrar lote ≠ concluir instrumento ≠ fechar período ≠ homologar resultado.
 *   Este módulo não compõe, não fecha, não delibera e não calcula situação.
 */
import {
  rectifyAssessmentEntry,
  resolveAssessmentCorrection,
  type AssessmentCorrectionAgent,
  type AssessmentCorrectionPolicy,
  type AssessmentPeriodClosingFact,
} from "./assessment-correction";
import {
  projectInstrumentEntryRoster,
  scaleIssuesForDraft,
  type ProjectInstrumentEntryRosterInput,
} from "./assessment-entry-projection";
import {
  assessmentLogicalEntryId,
  assessmentValueDelta,
  createFirstAssessmentEntryVersion,
  currentAssessmentEntryVersion,
  type AssessmentChangeAspect,
  type AssessmentEntryVersion,
} from "./assessment-entry-versions";
import { placementOn } from "./assessment-rules";
import type { AssessmentConfiguration, EntryValue } from "./assessment-types";

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

/** Intenção local de um estudante, com a base que o professor tinha em mão. */
export type AssessmentBatchDraftItem = {
  studentId: string;
  value: EntryValue;
  /** `null` = o professor preparou sem existir versão oficial. */
  expectedBaseVersionId: string | null;
  /** Rito da retificação, quando a alteração recai sobre fato oficial. */
  correction?: { justification?: string; satisfiedRequirementCodes?: readonly string[] };
};

/**
 * Regra de completude homologada. Ausente ou não homologada ⇒ nada é exigido:
 * a interface não inventa preenchimento obrigatório.
 */
export type AssessmentBatchCompletenessPolicy = {
  id: string;
  version: number;
  label: string;
  homologated: boolean;
  requiresAllEligibleRecorded: boolean;
};

export type PrepareAssessmentEntryBatchInput = {
  /** Fatos correntes (lidos no momento do preparo/registro, nunca do estado React). */
  roster: ProjectInstrumentEntryRosterInput;
  drafts: readonly AssessmentBatchDraftItem[];
  agent: AssessmentCorrectionAgent;
  recordedByAssignmentId: string;
  correctionPolicies: readonly AssessmentCorrectionPolicy[];
  instrumentStatus: "planejado" | "aplicado";
  periodClosing?: AssessmentPeriodClosingFact;
  completenessPolicy?: AssessmentBatchCompletenessPolicy;
};

// ---------------------------------------------------------------------------
// Plano
// ---------------------------------------------------------------------------

export type AssessmentBatchOperation =
  | {
      kind: "novo-registro";
      studentId: string;
      logicalEntryId: string;
      expectedBaseVersionId: null;
      value: EntryValue;
    }
  | {
      kind: "retificacao";
      studentId: string;
      logicalEntryId: string;
      expectedBaseVersionId: string;
      baseVersion: number;
      value: EntryValue;
      changedAspects: readonly AssessmentChangeAspect[];
      appliedPolicy: { id: string; version: number; label: string };
      correction?: AssessmentBatchDraftItem["correction"];
    };

export type AssessmentBatchBlockerCode =
  | "pauta-indisponivel"
  | "estudante-fora-da-pauta"
  | "estudante-nao-aplicavel"
  | "valor-inadmissivel"
  | "versao-base-divergente"
  | "versao-em-rascunho-preexistente"
  | "retificacao-inadmissivel"
  | "completude-exigida";

export type AssessmentBatchBlocker = {
  code: AssessmentBatchBlockerCode;
  /** Ausente quando o impedimento é da pauta inteira. */
  studentId?: string;
  messages: readonly string[];
};

export type AssessmentBatchSummary = {
  newRecords: number;
  rectifications: number;
  /** Intenções idênticas ao fato vigente: eliminadas, nunca registradas. */
  eliminatedNoOps: number;
  /** Aptos que continuarão sem registro após o lote. */
  remainingUnrecorded: number;
  notApplicable: number;
  /** Frase neutra derivada do plano; a interface não recalcula. */
  label: string;
};

export type AssessmentEntryBatchPlan = {
  /** Impressão digital determinística do conteúdo normativo do plano. */
  planId: string;
  state: "ready" | "blocked";
  instrumentId: string;
  configurationId: string;
  configurationVersion: number;
  operations: readonly AssessmentBatchOperation[];
  blockers: readonly AssessmentBatchBlocker[];
  summary: AssessmentBatchSummary;
  completenessPolicy?: { id: string; version: number; label: string };
};

// ---------------------------------------------------------------------------
// Preparo
// ---------------------------------------------------------------------------

export function prepareAssessmentEntryBatch(
  input: PrepareAssessmentEntryBatchInput,
): AssessmentEntryBatchPlan {
  const { roster } = input;
  const projection = projectInstrumentEntryRoster(roster);
  const operations: AssessmentBatchOperation[] = [];
  const blockers: AssessmentBatchBlocker[] = [];
  let eliminatedNoOps = 0;

  if (projection.state === "entry-unavailable") {
    blockers.push({ code: "pauta-indisponivel", messages: projection.disclosableReasons });
    return finalize(input, operations, blockers, 0, 0, 0);
  }

  const items = new Map(projection.rosterItems.map((item) => [item.studentId, item]));
  const drafts = [...input.drafts].sort((a, b) => a.studentId.localeCompare(b.studentId));

  for (const draft of drafts) {
    const item = items.get(draft.studentId);
    const block = (code: AssessmentBatchBlockerCode, messages: readonly string[]) =>
      blockers.push({ code, studentId: draft.studentId, messages });

    if (!item) {
      block("estudante-fora-da-pauta", ["Estudante não consta na pauta deste instrumento."]);
      continue;
    }
    if (item.entryState === "not-applicable") {
      block("estudante-nao-aplicavel", [
        item.admissibility.blockerReason ?? "Estudante não aplicável a este instrumento.",
      ]);
      continue;
    }

    const kindAdmitted =
      draft.value.kind === "nao-registrado" || draft.value.kind === projection.inputMode.kind;
    const scaleIssues = kindAdmitted
      ? scaleIssuesForDraft(roster.configuration, draft.value)
      : ["Natureza de resultado não admitida por esta pauta."];
    if (scaleIssues.length) {
      block("valor-inadmissivel", scaleIssues);
      continue;
    }

    const logicalEntryId = assessmentLogicalEntryId(roster.instrument.id, draft.studentId);
    const current = currentAssessmentEntryVersion(roster.versions, logicalEntryId);

    if (current && current.status !== "registrado") {
      block("versao-em-rascunho-preexistente", [
        "Existe versão em rascunho registrada fora desta pauta; reconcilie antes de registrar.",
      ]);
      continue;
    }
    if ((current?.id ?? null) !== draft.expectedBaseVersionId) {
      block("versao-base-divergente", [
        current
          ? `O resultado deste estudante mudou desde que a pauta foi aberta (vigente: versão ${current.version}).`
          : "O resultado em que esta alteração se baseava não existe mais como vigente.",
      ]);
      continue;
    }

    if (!current) {
      operations.push({
        kind: "novo-registro",
        studentId: draft.studentId,
        logicalEntryId,
        expectedBaseVersionId: null,
        value: draft.value,
      });
      continue;
    }

    const changedAspects = assessmentValueDelta(
      { value: current.value, ...(current.origin ? { origin: current.origin } : {}) },
      { value: draft.value, ...(current.origin ? { origin: current.origin } : {}) },
    );
    if (!changedAspects.length) {
      eliminatedNoOps += 1;
      continue;
    }

    const correctionProjection = resolveAssessmentCorrection(
      correctionInput(input, current.id),
    );
    if (!correctionProjection.canCorrect || !correctionProjection.appliedPolicy) {
      block(
        "retificacao-inadmissivel",
        correctionProjection.disclosableReasons.length
          ? correctionProjection.disclosableReasons.map((reason) => reason.message)
          : ["Esta alteração depende de autorização institucional que não consta."],
      );
      continue;
    }
    // Ensaio do ato com a regra vigente: rito ausente bloqueia já no preparo.
    const rehearsal = rectifyAssessmentEntry({
      correction: correctionInput(input, current.id),
      submission: submissionOf(draft),
      versionId: "ensaio",
      now: "1970-01-01T00:00:00.000Z",
    });
    if (!rehearsal.registered) {
      block("retificacao-inadmissivel", rehearsal.issues);
      continue;
    }
    operations.push({
      kind: "retificacao",
      studentId: draft.studentId,
      logicalEntryId,
      expectedBaseVersionId: current.id,
      baseVersion: current.version,
      value: draft.value,
      changedAspects,
      appliedPolicy: correctionProjection.appliedPolicy,
      ...(draft.correction ? { correction: draft.correction } : {}),
    });
  }

  const touched = new Set(operations.map((op) => op.studentId));
  const remainingUnrecorded = projection.rosterItems.filter(
    (item) => item.entryState === "unrecorded" && !touched.has(item.studentId),
  ).length;

  const completeness = input.completenessPolicy;
  if (completeness?.homologated && completeness.requiresAllEligibleRecorded && remainingUnrecorded)
    blockers.push({
      code: "completude-exigida",
      messages: [
        `A regra "${completeness.label}" exige registro de todos os estudantes aptos; ${remainingUnrecorded} continuariam sem registro.`,
      ],
    });

  return finalize(
    input,
    operations,
    blockers,
    eliminatedNoOps,
    remainingUnrecorded,
    projection.surfaceBalance.notApplicableCount,
  );
}

function finalize(
  input: PrepareAssessmentEntryBatchInput,
  operations: AssessmentBatchOperation[],
  blockers: AssessmentBatchBlocker[],
  eliminatedNoOps: number,
  remainingUnrecorded: number,
  notApplicable: number,
): AssessmentEntryBatchPlan {
  const newRecords = operations.filter((op) => op.kind === "novo-registro").length;
  const rectifications = operations.length - newRecords;
  const parts = [
    `${newRecords} ${newRecords === 1 ? "novo registro" : "novos registros"}`,
    `${rectifications} ${rectifications === 1 ? "alteração de registro existente" : "alterações de registros existentes"}`,
    `${remainingUnrecorded} ${remainingUnrecorded === 1 ? "estudante continua" : "estudantes continuam"} sem registro`,
  ];
  if (notApplicable) parts.push(`${notApplicable} não se ${notApplicable === 1 ? "aplica" : "aplicam"}`);

  const { configuration, instrument } = input.roster;
  const completeness = input.completenessPolicy?.homologated ? input.completenessPolicy : undefined;
  const fingerprint = JSON.stringify({
    instrumentId: instrument.id,
    configuration: [configuration.id, configuration.version],
    completeness: completeness ? [completeness.id, completeness.version] : null,
    closing: input.periodClosing ? [input.periodClosing.closingId, input.periodClosing.closingVersion] : null,
    agent: input.agent.agentId,
    operations,
    blockers,
  });
  const empty = operations.length === 0;
  return {
    planId: `lote-${instrument.id}-${hash(fingerprint)}`,
    state: blockers.length || empty ? "blocked" : "ready",
    instrumentId: instrument.id,
    configurationId: configuration.id,
    configurationVersion: configuration.version,
    operations,
    blockers,
    summary: {
      newRecords,
      rectifications,
      eliminatedNoOps,
      remainingUnrecorded,
      notApplicable,
      label: parts.join(" · "),
    },
    ...(completeness
      ? { completenessPolicy: { id: completeness.id, version: completeness.version, label: completeness.label } }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Registro atômico
// ---------------------------------------------------------------------------

/** Ato de registro do lote: proveniência comum às versões que ele produziu. */
export type AssessmentEntryBatchAct = {
  planId: string;
  instrumentId: string;
  committedAt: string;
  agentId: string;
  configurationId: string;
  configurationVersion: number;
  versionIds: readonly string[];
};

export type AssessmentBatchCommitResult =
  | { committed: false; reason: "plano-bloqueado" | "fatos-mudaram"; plan: AssessmentEntryBatchPlan }
  | {
      committed: true;
      /** Verdadeiro quando o mesmo plano já havia sido registrado (reenvio). */
      alreadyCommitted: boolean;
      act: AssessmentEntryBatchAct;
      newVersions: readonly AssessmentEntryVersion[];
    };

export function commitAssessmentEntryBatch(input: {
  plan: AssessmentEntryBatchPlan;
  /** Os mesmos drafts, mas com os FATOS relidos agora. */
  current: PrepareAssessmentEntryBatchInput;
  committedActs: readonly AssessmentEntryBatchAct[];
  newVersionId: (op: AssessmentBatchOperation) => string;
  now: string;
}): AssessmentBatchCommitResult {
  const previous = input.committedActs.find((act) => act.planId === input.plan.planId);
  if (previous) return { committed: true, alreadyCommitted: true, act: previous, newVersions: [] };

  const fresh = prepareAssessmentEntryBatch(input.current);
  if (fresh.state !== "ready") return { committed: false, reason: "plano-bloqueado", plan: fresh };
  if (fresh.planId !== input.plan.planId || input.plan.state !== "ready")
    return { committed: false, reason: "fatos-mudaram", plan: fresh };

  const { roster } = input.current;
  const provenance = { batchPlanId: fresh.planId };
  const newVersions: AssessmentEntryVersion[] = [];

  for (const op of fresh.operations) {
    const versionId = input.newVersionId(op);
    if (op.kind === "novo-registro") {
      const student = roster.students.find((item) => item.studentId === op.studentId);
      const placement = student
        ? placementOn([...student.placements], roster.instrument.classId, roster.instrument.appliedOn)
        : null;
      if (!placement) return { committed: false, reason: "fatos-mudaram", plan: fresh };
      newVersions.push(
        createFirstAssessmentEntryVersion({
          versionId,
          instrumentId: roster.instrument.id,
          studentId: op.studentId,
          placement: {
            enrollmentId: placement.enrollmentId,
            academicLinkId: placement.academicLinkId,
            participationId: placement.participationId,
            allocationId: placement.allocationId,
          },
          value: op.value,
          status: "registrado",
          recordedByAssignmentId: input.current.recordedByAssignmentId,
          originMetadata: provenance,
          now: input.now,
        }),
      );
      continue;
    }
    const draft = input.current.drafts.find((item) => item.studentId === op.studentId)!;
    const attempt = rectifyAssessmentEntry({
      correction: correctionInput(input.current, op.expectedBaseVersionId),
      submission: submissionOf(draft),
      versionId,
      now: input.now,
    });
    // Atomicidade: nada do que foi construído até aqui é devolvido.
    if (!attempt.registered) return { committed: false, reason: "fatos-mudaram", plan: fresh };
    newVersions.push(attempt.version);
  }

  return {
    committed: true,
    alreadyCommitted: false,
    newVersions,
    act: Object.freeze({
      planId: fresh.planId,
      instrumentId: roster.instrument.id,
      committedAt: input.now,
      agentId: input.current.agent.agentId,
      configurationId: fresh.configurationId,
      configurationVersion: fresh.configurationVersion,
      versionIds: Object.freeze(newVersions.map((version) => version.id)),
    }),
  };
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

function correctionInput(input: PrepareAssessmentEntryBatchInput, baseVersionId: string) {
  return {
    baseVersionId,
    versions: input.roster.versions,
    agent: input.agent,
    instrument: {
      id: input.roster.instrument.id,
      instrumentTypeId: input.roster.instrument.instrumentTypeId,
      status: input.instrumentStatus,
    },
    configuration: input.roster.configuration as AssessmentConfiguration,
    policies: input.correctionPolicies,
    ...(input.periodClosing ? { periodClosing: input.periodClosing } : {}),
  };
}

function submissionOf(draft: AssessmentBatchDraftItem) {
  return {
    value: draft.value,
    ...(draft.correction?.justification ? { justification: draft.correction.justification } : {}),
    ...(draft.correction?.satisfiedRequirementCodes
      ? { satisfiedRequirementCodes: draft.correction.satisfiedRequirementCodes }
      : {}),
  };
}

/** djb2: impressão digital determinística, sem dependência de relógio. */
function hash(text: string): string {
  let value = 5381;
  for (let index = 0; index < text.length; index += 1)
    value = ((value << 5) + value + text.charCodeAt(index)) | 0;
  return (value >>> 0).toString(36);
}
