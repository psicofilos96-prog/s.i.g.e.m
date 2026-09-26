/**
 * Etapa 13C — Capacidade como POLÍTICA declarativa.
 *
 * A cadeia é sempre: FATO → REQUISITO → AVALIADOR → EFEITO INSTITUCIONAL.
 *   ocupação factual = 25 · limite de referência = 25 · tentativa levaria a 26
 *   requisito avaliado = "excede o limite de referência"
 *   efeito configurado = bloquear / exigir ato / permitir / encaminhar / outro.
 *
 * Não existe `allowsExceeding`, `maxExceedingLimit` nem `exceedingRequiresAct`:
 * uma quarta política institucional entra como efeito configurado, sem tocar o
 * motor. O motor também não conhece reserva, cota, prioridade ou sala.
 */
import { diagnostic } from "./student-life-diagnostics";
import type { StudentLifeDiagnostic, StudentLifeEventScope } from "./student-life-types";
import type { InstitutionalActReference } from "./student-life-types";
import type { RequirementEffectDefinition, RequirementEvaluationStatus } from "./cycle-enrollment-types";
import {
  CLASS_ALLOCATION_DIAGNOSTIC_CODES as CODES,
  CLASS_ALLOCATION_DIAGNOSTIC_TYPES as TYPES,
} from "./class-allocation-diagnostics";
import type {
  AllocationRequirementDefinition,
  AllocationRequirementPolicy,
} from "./class-allocation-types";

/**
 * Fatos BRUTOS entregues aos avaliadores. Nenhum deles é interpretação: não há
 * "excedeu", "está cheia" nem "tem vaga".
 */
export type AllocationRequirementFacts = {
  /** Ocupação factual: alocações vigentes na data de referência. */
  factualOccupancy?: number;
  /** Limite de referência da capacidade aplicável na data; ausente = desconhecido. */
  referenceLimit?: number | null;
  /** Soma das reservas de vaga vigentes na data. */
  reservedQuantity?: number;
  /** Quantidade de alocações que a operação pretende acrescentar. */
  intendedIncrement?: number;
  /** Atos institucionais associados, por requisito. */
  acts?: Readonly<Record<string, InstitutionalActReference>>;
  /** Declarações estruturadas de atendimento, por requisito. */
  satisfiedRequirementDefinitionIds?: readonly string[];
  unsatisfiedRequirementDefinitionIds?: readonly string[];
  notApplicableRequirementDefinitionIds?: readonly string[];
  /** Fatos adicionais estruturados consumidos por avaliadores registrados. */
  attributes?: Readonly<Record<string, string | number | boolean | null>>;
};

export type AllocationRequirementEvaluator = (input: {
  definition: AllocationRequirementDefinition;
  facts: AllocationRequirementFacts;
}) => { status: RequirementEvaluationStatus; detail?: string };

/**
 * Avaliador nativo GENÉRICO de comparação numérica entre ocupação e limite.
 * Parâmetros configurados:
 *   `subtractReservedFromLimit` — as reservas reduzem o limite comparado?
 *   `comparison` — "excede" (padrão) ou "alcanca".
 * Dado ausente NUNCA satisfaz: sem limite conhecido o resultado é inconclusivo.
 */
const occupancyAgainstLimitEvaluator: AllocationRequirementEvaluator = ({ definition, facts }) => {
  const limit = facts.referenceLimit;
  if (limit === undefined || limit === null) {
    return {
      status: "inconclusivo",
      detail: "Nenhuma capacidade de referência vigente foi informada para a data.",
    };
  }
  const occupancy = facts.factualOccupancy;
  if (occupancy === undefined) {
    return { status: "inconclusivo", detail: "Ocupação factual não informada." };
  }
  const increment = facts.intendedIncrement ?? 0;
  const reserved = definition.parameters?.["subtractReservedFromLimit"] === true
    ? (facts.reservedQuantity ?? 0)
    : 0;
  const comparableLimit = limit - reserved;
  const prospective = occupancy + increment;
  const comparison = definition.parameters?.["comparison"];
  const triggered = comparison === "alcanca" ? prospective >= comparableLimit : prospective > comparableLimit;
  return {
    status: triggered ? "nao-satisfeito" : "satisfeito",
    detail: `ocupação ${occupancy} + ${increment} comparada a ${comparableLimit}`,
  };
};

/** Avaliador nativo GENÉRICO: lê apenas declarações estruturadas. */
const declaredStatusEvaluator: AllocationRequirementEvaluator = ({ definition, facts }) => {
  const id = definition.requirementDefinitionId;
  if (facts.notApplicableRequirementDefinitionIds?.includes(id)) return { status: "nao-aplicavel" };
  if (facts.satisfiedRequirementDefinitionIds?.includes(id)) return { status: "satisfeito" };
  if (facts.unsatisfiedRequirementDefinitionIds?.includes(id)) return { status: "nao-satisfeito" };
  return { status: "inconclusivo", detail: "Nenhum fato declarado para este requisito." };
};

/** Avaliador nativo GENÉRICO de presença de atributo estruturado. */
const attributePresenceEvaluator: AllocationRequirementEvaluator = ({ definition, facts }) => {
  const key = definition.parameters?.["attributeKey"];
  if (typeof key !== "string") {
    return { status: "erro-de-configuracao", detail: "Parâmetro `attributeKey` não declarado." };
  }
  const value = facts.attributes?.[key];
  if (value === undefined) return { status: "inconclusivo" };
  if (value === null || value === "" || value === false) return { status: "nao-satisfeito" };
  return { status: "satisfeito" };
};

export const NATIVE_ALLOCATION_EVALUATORS: Readonly<
  Record<string, AllocationRequirementEvaluator>
> = {
  "comparacao-ocupacao-limite": occupancyAgainstLimitEvaluator,
  "declaracao-estruturada": declaredStatusEvaluator,
  "presenca-de-atributo": attributePresenceEvaluator,
};

export type AllocationRequirementEvaluation = {
  requirementDefinitionId: string;
  labelSnapshot: string;
  status: RequirementEvaluationStatus;
  requirementEffectDefinitionId: string | null;
  act?: InstitutionalActReference;
  detail?: string;
};

export type AllocationRequirementAssessment = {
  evaluations: readonly AllocationRequirementEvaluation[];
  diagnostics: readonly StudentLifeDiagnostic[];
  /** `false` quando algum efeito configurado impede a operação. */
  allowed: boolean;
  /** `true` quando algum resultado ficou inconclusivo por falta de dado/definição. */
  inconclusive: boolean;
};

function findEffect(
  policy: AllocationRequirementPolicy,
  effectDefinitionId: string | null,
): RequirementEffectDefinition | undefined {
  if (!effectDefinitionId) return undefined;
  return policy.effects.find((effect) => effect.effectDefinitionId === effectDefinitionId);
}

/** Avalia os requisitos aplicáveis ao processo originador e resolve os efeitos. */
export function assessAllocationRequirements(
  policy: AllocationRequirementPolicy,
  originatingProcessKindId: string,
  facts: AllocationRequirementFacts,
  scope: StudentLifeEventScope,
  evaluators: Readonly<Record<string, AllocationRequirementEvaluator>> = NATIVE_ALLOCATION_EVALUATORS,
): AllocationRequirementAssessment {
  const evaluations: AllocationRequirementEvaluation[] = [];
  const diagnostics: StudentLifeDiagnostic[] = [];
  let allowed = true;
  let inconclusive = false;

  const applicable = policy.requirements.filter((requirement) => {
    const processScope = requirement.appliesToProcessKindIds;
    return !processScope || processScope.length === 0 || processScope.includes(originatingProcessKindId);
  });

  for (const definition of applicable) {
    const evaluator = evaluators[definition.evaluatorId];
    if (!evaluator) {
      diagnostics.push(
        diagnostic(CODES.capacityRequirementEffect, TYPES.capacity, "blocker", scope, {
          parameters: {
            requirementDefinitionId: definition.requirementDefinitionId,
            evaluatorId: definition.evaluatorId,
          },
          message: "Avaliador de requisito de alocação não registrado.",
        }),
      );
      allowed = false;
      evaluations.push({
        requirementDefinitionId: definition.requirementDefinitionId,
        labelSnapshot: definition.labelSnapshot,
        status: "erro-de-configuracao",
        requirementEffectDefinitionId: null,
      });
      continue;
    }

    const { status, detail } = evaluator({ definition, facts });
    const effectId = definition.effectByStatus[status] ?? definition.defaultEffectDefinitionId ?? null;
    const effect = findEffect(policy, effectId);
    const act = facts.acts?.[definition.requirementDefinitionId];

    evaluations.push({
      requirementDefinitionId: definition.requirementDefinitionId,
      labelSnapshot: definition.labelSnapshot,
      status,
      requirementEffectDefinitionId: effectId,
      ...(act ? { act } : {}),
      ...(detail ? { detail } : {}),
    });

    if (status === "inconclusivo") inconclusive = true;

    if (effectId && !effect) {
      diagnostics.push(
        diagnostic(CODES.capacityRequirementEffect, TYPES.capacity, "blocker", scope, {
          parameters: {
            requirementDefinitionId: definition.requirementDefinitionId,
            effectDefinitionId: effectId,
          },
          message: "Efeito institucional referenciado não está declarado na política.",
        }),
      );
      allowed = false;
      continue;
    }

    if (!effect) {
      if (status !== "satisfeito" && status !== "nao-aplicavel") {
        diagnostics.push(
          diagnostic(CODES.capacityRequirementEffect, TYPES.capacity, "blocker", scope, {
            parameters: { requirementDefinitionId: definition.requirementDefinitionId, status },
            message: "A política não declarou efeito institucional para este resultado.",
          }),
        );
        allowed = false;
      }
      continue;
    }

    if (effect.preventsTransition) {
      diagnostics.push(
        diagnostic(CODES.capacityRequirementEffect, TYPES.capacity, effect.severity, scope, {
          parameters: {
            requirementDefinitionId: definition.requirementDefinitionId,
            effectDefinitionId: effect.effectDefinitionId,
            status,
          },
          message: "Efeito configurado impede a alocação.",
        }),
      );
      allowed = false;
    }

    if (effect.requiresInstitutionalAct && !act) {
      diagnostics.push(
        diagnostic(CODES.actMissing, TYPES.capacity, effect.severity, scope, {
          parameters: {
            requirementDefinitionId: definition.requirementDefinitionId,
            effectDefinitionId: effect.effectDefinitionId,
          },
          message: "Efeito configurado exige ato institucional para prosseguir.",
        }),
      );
      if (effect.severity === "blocker" || effect.severity === "requirement") allowed = false;
    }
  }

  return { evaluations, diagnostics, allowed, inconclusive };
}
