/**
 * Etapa 13D — Efeitos institucionais e REGISTRO DE EXECUTORES.
 *
 * A 13D não possui flags de estágio. A cadeia é:
 *
 *   TRANSIÇÃO → EFEITOS CONFIGURADOS → EXECUTORES REGISTRADOS → AÇÕES
 *
 * Os executores nativos são PRIMITIVAS genéricas: encerrar vigência de alocação,
 * resolver a política de participações, avaliar o efeito sobre o vínculo,
 * encerrar a vigência da inscrição, registrar o intervalo institucional e
 * publicar um fato de mobilidade. Nenhum deles conhece AEE, turno, etapa,
 * modalidade, prazo legal ou nome de situação.
 *
 * Um efeito inédito entra por `registerTransferEffectExecutor` — sem alterar
 * contratos, sem `switch` e sem novo booleano no domínio.
 */
import { diagnostic } from "./student-life-diagnostics";
import type { StudentLifeDiagnostic, StudentLifeEventScope } from "./student-life-types";
import type { AcademicCycleEnrollment, CycleParticipation } from "./cycle-enrollment-types";
import type { ClassAllocation } from "./class-allocation-types";
import {
  TRANSFER_DIAGNOSTIC_CODES as CODES,
  TRANSFER_DIAGNOSTIC_TYPES as TYPES,
} from "./transfer-diagnostics";
import type {
  InstitutionalEffectApplication,
  InstitutionalTransferProcess,
  NumericComparatorId,
  SchoolBondEffectPolicy,
  TransferParticipationEffectPolicy,
  TransferProcessVersionRecord,
} from "./transfer-types";

/** Ação institucional proposta pelo executor. Natureza e alvo são abertos. */
export type TransferEffectAction = {
  /** Natureza da ação (aberta, declarada por configuração). */
  actionKindDefinitionId: string;
  /** Natureza do alvo (aberta): alocação, participação, inscrição, vínculo… */
  targetKindId: string;
  targetId: string;
  parameters?: Readonly<Record<string, string | number | boolean | null>>;
};

export type TransferEffectStatus =
  | "aplicado"
  | "inconclusivo"
  | "nao-aplicavel"
  | "erro-de-configuracao";

export type TransferEffectOutcome = {
  effectDefinitionId: string;
  effectExecutorId: string;
  status: TransferEffectStatus;
  actions: readonly TransferEffectAction[];
  diagnostics: readonly StudentLifeDiagnostic[];
};

/**
 * FATOS publicados pelo motor para que as políticas decidam. São números e
 * referências — nunca conclusões. "Existem 0 inscrições vigentes" é fato;
 * "portanto encerre o vínculo" é política.
 */
export type TransferMobilityFacts = {
  numericFacts: Readonly<Record<string, number>>;
  /** Vínculos escolares (13A) impactados, quando identificados. */
  impactedBondIds: readonly string[];
  /** Inscrições letivas (13B) impactadas. */
  impactedEnrollmentIds: readonly string[];
};

export type TransferEffectExecutionContext = {
  process: InstitutionalTransferProcess;
  version: TransferProcessVersionRecord;
  transitionDefinitionId: string;
  effectiveDate: string;
  scope: StudentLifeEventScope;
  /** Participações impactadas pela mobilidade. */
  impactedParticipations: readonly CycleParticipation[];
  /** Alocações (13C) vigentes das participações impactadas. */
  impactedAllocations: readonly ClassAllocation[];
  /** Inscrições letivas (13B) das participações impactadas. */
  impactedEnrollments: readonly AcademicCycleEnrollment[];
  facts: TransferMobilityFacts;
  participationEffectPolicy: TransferParticipationEffectPolicy;
  schoolBondEffectPolicy: SchoolBondEffectPolicy;
  /**
   * Data de encerramento da vigência na origem, JÁ resolvida pela política
   * temporal da 13C. `null` = política não resolvida; o motor não presume
   * "um dia antes" nem qualquer outra semântica.
   */
  originClosureDate: string | null;
};

export type TransferEffectExecutor = (
  context: TransferEffectExecutionContext,
  application: InstitutionalEffectApplication,
) => TransferEffectOutcome;

export type TransferEffectRegistry = ReadonlyMap<string, TransferEffectExecutor>;

function outcome(
  application: InstitutionalEffectApplication,
  status: TransferEffectStatus,
  actions: readonly TransferEffectAction[] = [],
  diagnostics: readonly StudentLifeDiagnostic[] = [],
): TransferEffectOutcome {
  return {
    effectDefinitionId: application.effectDefinitionId,
    effectExecutorId: application.effectExecutorId,
    status,
    actions,
    diagnostics,
  };
}

function textParameter(
  application: InstitutionalEffectApplication,
  key: string,
  fallback: string,
): string {
  const value = application.parameters?.[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function compare(left: number, comparator: NumericComparatorId, right: number): boolean {
  switch (comparator) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "lte":
      return left <= right;
    case "lt":
      return left < right;
    case "gte":
      return left >= right;
    case "gt":
      return left > right;
    default:
      return false;
  }
}

// --------------------------------------------------------- Executores nativos

export const TRANSFER_EFFECT_EXECUTOR_IDS = {
  closeAllocationValidity: "exec-encerrar-vigencia-de-alocacao",
  applyParticipationEffectPolicy: "exec-resolver-politica-de-participacoes",
  evaluateSchoolBondEffect: "exec-avaliar-efeito-sobre-vinculo",
  closeEnrollmentValidity: "exec-encerrar-vigencia-de-inscricao",
  recordTransitionInterval: "exec-registrar-intervalo-de-transicao",
  publishMobilityFact: "exec-publicar-fato-de-mobilidade",
} as const;

/**
 * PRIMITIVA: encerra a vigência das alocações impactadas na data resolvida pela
 * política temporal da 13C. Sem política resolvida, o resultado é INCONCLUSIVO —
 * jamais um encerramento presumido.
 */
const closeAllocationValidity: TransferEffectExecutor = (context, application) => {
  if (context.impactedAllocations.length === 0) {
    return outcome(application, "nao-aplicavel");
  }
  if (context.originClosureDate === null) {
    return outcome(application, "inconclusivo", [], [
      diagnostic(CODES.timingBoundaryUndeclared, TYPES.temporality, "requirement", context.scope, {
        parameters: { effectDefinitionId: application.effectDefinitionId },
        message: "Política temporal da alocação não resolvida; nenhuma vigência foi encerrada.",
      }),
    ]);
  }
  const actionKind = textParameter(application, "actionKindDefinitionId", "encerrar-vigencia");
  return outcome(
    application,
    "aplicado",
    context.impactedAllocations.map((allocation) => ({
      actionKindDefinitionId: actionKind,
      targetKindId: "class-allocation",
      targetId: allocation.allocationId,
      parameters: { validUntil: context.originClosureDate },
    })),
  );
};

/**
 * PRIMITIVA: submete CADA participação impactada à política configurada.
 * A 13D não sabe se a conduta será manter, encerrar, exigir decisão ou
 * encaminhar: apenas resolve a regra e devolve o efeito declarado.
 */
const applyParticipationEffectPolicy: TransferEffectExecutor = (context, application) => {
  if (context.impactedParticipations.length === 0) {
    return outcome(application, "nao-aplicavel");
  }
  const policy = context.participationEffectPolicy;
  const offerByEnrollment = new Map(
    context.impactedEnrollments.map((item) => [item.cycleEnrollmentId, item.educationalOfferId]),
  );
  const actions: TransferEffectAction[] = [];
  const diagnostics: StudentLifeDiagnostic[] = [];

  for (const participation of context.impactedParticipations) {
    const offerId = offerByEnrollment.get(participation.cycleEnrollmentId) ?? null;
    const rule = policy.rules.find((candidate) => {
      const natures = candidate.appliesToNatureDefinitionIds ?? [];
      const offers = candidate.appliesToEducationalOfferIds ?? [];
      const natureOk =
        natures.length === 0 || natures.includes(participation.natureDefinitionId);
      const offerOk = offers.length === 0 || (offerId !== null && offers.includes(offerId));
      return natureOk && offerOk;
    });
    const resolved = rule?.effect ?? policy.undeclaredParticipationEffect;
    if (!resolved) {
      diagnostics.push(
        diagnostic(
          CODES.participationEffectUndeclared,
          TYPES.effect,
          "requirement",
          { ...context.scope, participationId: participation.participationId },
          {
            parameters: {
              participationId: participation.participationId,
              natureDefinitionId: participation.natureDefinitionId,
              policyId: policy.policyId,
              policyVersion: policy.policyVersion,
            },
            message: "A política não declarou efeito para esta participação.",
          },
        ),
      );
      continue;
    }
    actions.push({
      actionKindDefinitionId: resolved.effectDefinitionId,
      targetKindId: "cycle-participation",
      targetId: participation.participationId,
      parameters: {
        effectExecutorId: resolved.effectExecutorId,
        ruleId: rule?.ruleId ?? null,
        policyId: policy.policyId,
        policyVersion: policy.policyVersion,
        effectiveDate: context.effectiveDate,
      },
    });
  }

  if (diagnostics.length > 0) {
    return outcome(application, "inconclusivo", actions, diagnostics);
  }
  return outcome(application, "aplicado", actions);
};

/**
 * PRIMITIVA: compara os FATOS publicados com as regras da política do vínculo.
 * "Encerra se não houver outras inscrições vigentes" é REGRA CADASTRADA.
 */
const evaluateSchoolBondEffect: TransferEffectExecutor = (context, application) => {
  const policy = context.schoolBondEffectPolicy;
  const bondIds = context.facts.impactedBondIds;
  if (bondIds.length === 0) {
    return outcome(application, "nao-aplicavel");
  }
  const matched = policy.rules.find((rule) => {
    const fact = context.facts.numericFacts[rule.factKeyId];
    return fact !== undefined && compare(fact, rule.comparator, rule.value);
  });
  const resolved = matched?.effect ?? policy.undeclaredEffect;
  if (!resolved) {
    return outcome(application, "inconclusivo", [], [
      diagnostic(CODES.bondEffectUndeclared, TYPES.effect, "requirement", context.scope, {
        parameters: { policyId: policy.policyId, policyVersion: policy.policyVersion },
        message: "A política não declarou efeito do fato publicado sobre o vínculo escolar.",
      }),
    ]);
  }
  return outcome(
    application,
    "aplicado",
    bondIds.map((bondId) => ({
      actionKindDefinitionId: resolved.effectDefinitionId,
      targetKindId: "school-institutional-bond",
      targetId: bondId,
      parameters: {
        effectExecutorId: resolved.effectExecutorId,
        ruleId: matched?.ruleId ?? null,
        policyId: policy.policyId,
        policyVersion: policy.policyVersion,
        effectiveDate: context.effectiveDate,
      },
    })),
  );
};

/** PRIMITIVA: preenche o fim de vigência das inscrições letivas impactadas. */
const closeEnrollmentValidity: TransferEffectExecutor = (context, application) => {
  if (context.impactedEnrollments.length === 0) {
    return outcome(application, "nao-aplicavel");
  }
  const actionKind = textParameter(application, "actionKindDefinitionId", "encerrar-vigencia");
  return outcome(
    application,
    "aplicado",
    context.impactedEnrollments.map((enrollment) => ({
      actionKindDefinitionId: actionKind,
      targetKindId: "academic-cycle-enrollment",
      targetId: enrollment.cycleEnrollmentId,
      parameters: { validUntil: context.effectiveDate },
    })),
  );
};

/**
 * PRIMITIVA: registra o intervalo institucional de transição declarado na versão
 * do processo. A NATUREZA do intervalo é dado configurado; o motor não a conhece.
 */
const recordTransitionInterval: TransferEffectExecutor = (context, application) => {
  const interval = context.version.transitionInterval;
  if (!interval) {
    return outcome(application, "nao-aplicavel");
  }
  return outcome(application, "aplicado", [
    {
      actionKindDefinitionId: textParameter(
        application,
        "actionKindDefinitionId",
        "registrar-intervalo-institucional",
      ),
      targetKindId: "institutional-transition-interval",
      targetId: interval.transitionIntervalId,
      parameters: {
        transitionKindDefinitionId: interval.transitionKindDefinitionId,
        startDate: interval.startDate,
        deadlineDate: interval.deadlineDate ?? null,
        concludedDate: interval.concludedDate ?? null,
      },
    },
  ]);
};

/**
 * PRIMITIVA: publica um FATO de mobilidade, cujo tipo vem dos parâmetros.
 * É esse fato que a política de projeção de vida escolar consome depois.
 */
const publishMobilityFact: TransferEffectExecutor = (context, application) => {
  const factTypeId = textParameter(application, "mobilityFactTypeId", "");
  if (factTypeId.length === 0) {
    return outcome(application, "erro-de-configuracao", [], [
      diagnostic(CODES.effectInconclusive, TYPES.effect, "blocker", context.scope, {
        parameters: { effectDefinitionId: application.effectDefinitionId },
        message: "O efeito de publicação não declarou o tipo do fato de mobilidade.",
      }),
    ]);
  }
  return outcome(application, "aplicado", [
    {
      actionKindDefinitionId: "publicar-fato-de-mobilidade",
      targetKindId: "mobility-fact",
      targetId: `${context.process.transferProcessId}:${factTypeId}`,
      parameters: {
        mobilityFactTypeId: factTypeId,
        transferProcessId: context.process.transferProcessId,
        studentId: context.process.studentId,
        effectiveDate: context.effectiveDate,
      },
    },
  ]);
};

export const NATIVE_TRANSFER_EFFECT_EXECUTORS: Readonly<
  Record<string, TransferEffectExecutor>
> = {
  [TRANSFER_EFFECT_EXECUTOR_IDS.closeAllocationValidity]: closeAllocationValidity,
  [TRANSFER_EFFECT_EXECUTOR_IDS.applyParticipationEffectPolicy]: applyParticipationEffectPolicy,
  [TRANSFER_EFFECT_EXECUTOR_IDS.evaluateSchoolBondEffect]: evaluateSchoolBondEffect,
  [TRANSFER_EFFECT_EXECUTOR_IDS.closeEnrollmentValidity]: closeEnrollmentValidity,
  [TRANSFER_EFFECT_EXECUTOR_IDS.recordTransitionInterval]: recordTransitionInterval,
  [TRANSFER_EFFECT_EXECUTOR_IDS.publishMobilityFact]: publishMobilityFact,
};

/** Cria o registro de executores: nativos + executores registrados pela rede. */
export function createTransferEffectRegistry(
  extra?: Readonly<Record<string, TransferEffectExecutor>>,
): Map<string, TransferEffectExecutor> {
  return new Map(Object.entries({ ...NATIVE_TRANSFER_EFFECT_EXECUTORS, ...(extra ?? {}) }));
}

/** Registra um executor inédito; nenhum contrato do domínio é alterado. */
export function registerTransferEffectExecutor(
  registry: Map<string, TransferEffectExecutor>,
  executorId: string,
  executor: TransferEffectExecutor,
): Map<string, TransferEffectExecutor> {
  registry.set(executorId, executor);
  return registry;
}

/** Executa os efeitos configurados da transição, em ordem declarada. */
export function applyConfiguredEffects(
  registry: TransferEffectRegistry,
  applications: readonly InstitutionalEffectApplication[],
  context: TransferEffectExecutionContext,
): TransferEffectOutcome[] {
  return applications.map((application) => {
    const executor = registry.get(application.effectExecutorId);
    if (!executor) {
      return outcome(application, "erro-de-configuracao", [], [
        diagnostic(CODES.effectExecutorMissing, TYPES.effect, "blocker", context.scope, {
          parameters: {
            effectDefinitionId: application.effectDefinitionId,
            effectExecutorId: application.effectExecutorId,
          },
          message: "Efeito configurado sem executor registrado.",
        }),
      ]);
    }
    return executor(context, application);
  });
}
