/**
 * Etapa 13B — Avaliação declarativa de requisitos da inscrição letiva.
 *
 * O motor conhece apenas PRIMITIVAS: localizar o avaliador registrado, executá-lo,
 * traduzir o resultado em efeito institucional CONFIGURADO e verificar as
 * capacidades declaradas desse efeito (impede? exige prazo? exige ato?).
 *
 * O motor NÃO conhece documento, prazo, autorização, etapa, modalidade, escola
 * nem qualquer nome de requisito. Requisito novo entra como avaliador registrado.
 */
import { diagnostic } from "./student-life-diagnostics";
import type { StudentLifeDiagnostic, StudentLifeEventScope } from "./student-life-types";
import {
  CYCLE_ENROLLMENT_DIAGNOSTIC_CODES as CODES,
  CYCLE_ENROLLMENT_DIAGNOSTIC_TYPES as TYPES,
} from "./cycle-enrollment-diagnostics";
import type {
  EnrollmentRequirementDefinition,
  EnrollmentRequirementEvaluation,
  EnrollmentRequirementPolicy,
  RequirementDeadline,
  RequirementEffectDefinition,
  RequirementEvaluationStatus,
} from "./cycle-enrollment-types";
import type { InstitutionalActReference } from "./student-life-types";

/** Fatos brutos oferecidos aos avaliadores; nenhuma interpretação embutida. */
export type RequirementEvaluationFacts = {
  /** Requisitos declarados como atendidos, por definição configurada. */
  satisfiedRequirementDefinitionIds?: readonly string[];
  /** Requisitos declarados como não atendidos. */
  unsatisfiedRequirementDefinitionIds?: readonly string[];
  /** Requisitos declarados inaplicáveis ao caso concreto. */
  notApplicableRequirementDefinitionIds?: readonly string[];
  /** Prazos de regularização registrados, por requisito. */
  deadlines?: Readonly<Record<string, RequirementDeadline>>;
  /** Atos institucionais associados, por requisito. */
  acts?: Readonly<Record<string, InstitutionalActReference>>;
  /** Fatos adicionais estruturados, consumidos por avaliadores registrados. */
  attributes?: Readonly<Record<string, string | number | boolean | null>>;
};

export type RequirementEvaluator = (input: {
  definition: EnrollmentRequirementDefinition;
  facts: RequirementEvaluationFacts;
}) => { status: RequirementEvaluationStatus; detail?: string };

/**
 * Avaliador nativo GENÉRICO: lê apenas declarações estruturadas de atendimento.
 * Não conhece nome, natureza ou consequência de nenhum requisito concreto.
 */
const declaredStatusEvaluator: RequirementEvaluator = ({ definition, facts }) => {
  const id = definition.requirementDefinitionId;
  if (facts.notApplicableRequirementDefinitionIds?.includes(id)) {
    return { status: "nao-aplicavel" };
  }
  if (facts.satisfiedRequirementDefinitionIds?.includes(id)) {
    return { status: "satisfeito" };
  }
  if (facts.unsatisfiedRequirementDefinitionIds?.includes(id)) {
    return { status: "nao-satisfeito" };
  }
  return { status: "inconclusivo", detail: "Nenhum fato declarado para este requisito." };
};

/**
 * Avaliador nativo GENÉRICO de presença de atributo estruturado: a política
 * declara em `parameters.attributeKey` qual fato deve existir.
 */
const attributePresenceEvaluator: RequirementEvaluator = ({ definition, facts }) => {
  const key = definition.parameters?.["attributeKey"];
  if (typeof key !== "string") {
    return { status: "erro-de-configuracao", detail: "Parâmetro `attributeKey` não declarado." };
  }
  const value = facts.attributes?.[key];
  if (value === undefined) return { status: "inconclusivo" };
  if (value === null || value === "" || value === false) return { status: "nao-satisfeito" };
  return { status: "satisfeito" };
};

export const NATIVE_REQUIREMENT_EVALUATORS: Readonly<Record<string, RequirementEvaluator>> = {
  "declaracao-estruturada": declaredStatusEvaluator,
  "presenca-de-atributo": attributePresenceEvaluator,
};

export function findEffect(
  policy: EnrollmentRequirementPolicy,
  effectDefinitionId: string | null,
): RequirementEffectDefinition | undefined {
  if (!effectDefinitionId) return undefined;
  return policy.effects.find((effect) => effect.effectDefinitionId === effectDefinitionId);
}

/** Requisitos aplicáveis ao rito: quando a definição nada declara, aplica-se a todos. */
export function requirementsForProcess(
  policy: EnrollmentRequirementPolicy,
  processKindId: string,
): EnrollmentRequirementDefinition[] {
  return policy.requirements.filter((requirement) => {
    const scope = requirement.appliesToProcessKindIds;
    return !scope || scope.length === 0 || scope.includes(processKindId);
  });
}

export type RequirementAssessment = {
  evaluations: readonly EnrollmentRequirementEvaluation[];
  diagnostics: readonly StudentLifeDiagnostic[];
  /** `false` quando algum efeito configurado impede a transição. */
  allowed: boolean;
};

/** Avalia todos os requisitos aplicáveis e resolve seus efeitos configurados. */
export function assessRequirements(
  policy: EnrollmentRequirementPolicy,
  processKindId: string,
  facts: RequirementEvaluationFacts,
  scope: StudentLifeEventScope,
  evaluators: Readonly<Record<string, RequirementEvaluator>> = NATIVE_REQUIREMENT_EVALUATORS,
): RequirementAssessment {
  const evaluations: EnrollmentRequirementEvaluation[] = [];
  const diagnostics: StudentLifeDiagnostic[] = [];
  let allowed = true;

  for (const definition of requirementsForProcess(policy, processKindId)) {
    const evaluator = evaluators[definition.evaluatorId];
    if (!evaluator) {
      diagnostics.push(
        diagnostic(CODES.requirementEvaluatorUnknown, TYPES.requirement, "blocker", scope, {
          parameters: {
            requirementDefinitionId: definition.requirementDefinitionId,
            evaluatorId: definition.evaluatorId,
          },
          message: "Avaliador de requisito não registrado.",
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
    const effectId =
      definition.effectByStatus[status] ?? definition.defaultEffectDefinitionId ?? null;
    const effect = findEffect(policy, effectId);
    const deadline = facts.deadlines?.[definition.requirementDefinitionId] ?? null;
    const act = facts.acts?.[definition.requirementDefinitionId];

    const evaluation: EnrollmentRequirementEvaluation = {
      requirementDefinitionId: definition.requirementDefinitionId,
      labelSnapshot: definition.labelSnapshot,
      status,
      requirementEffectDefinitionId: effectId,
      deadline,
      ...(act ? { act } : {}),
      ...(detail ? { detail } : {}),
    };
    evaluations.push(evaluation);

    if (effectId && !effect) {
      diagnostics.push(
        diagnostic(CODES.requirementEffectUndeclared, TYPES.requirement, "blocker", scope, {
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
      // Nenhum efeito declarado para este resultado: não se presume permissão.
      if (status !== "satisfeito" && status !== "nao-aplicavel") {
        diagnostics.push(
          diagnostic(CODES.requirementEffectUndeclared, TYPES.requirement, "blocker", scope, {
            parameters: {
              requirementDefinitionId: definition.requirementDefinitionId,
              status,
            },
            message: "A política não declarou efeito institucional para este resultado.",
          }),
        );
        allowed = false;
      }
      continue;
    }

    if (effect.preventsTransition) {
      diagnostics.push(
        diagnostic(CODES.requirementEffectPrevents, TYPES.requirement, effect.severity, scope, {
          parameters: {
            requirementDefinitionId: definition.requirementDefinitionId,
            effectDefinitionId: effect.effectDefinitionId,
            status,
          },
          message: "Efeito configurado impede a constituição da inscrição.",
        }),
      );
      allowed = false;
    }

    if (effect.requiresRegularizationDeadline && !deadline) {
      diagnostics.push(
        diagnostic(CODES.requirementDeadlineMissing, TYPES.requirement, effect.severity, scope, {
          parameters: {
            requirementDefinitionId: definition.requirementDefinitionId,
            effectDefinitionId: effect.effectDefinitionId,
          },
          message: "Efeito configurado exige prazo de regularização declarado.",
        }),
      );
      if (effect.severity === "blocker" || effect.severity === "requirement") allowed = false;
    }

    if (effect.requiresInstitutionalAct && !act) {
      diagnostics.push(
        diagnostic(CODES.requirementActMissing, TYPES.requirement, effect.severity, scope, {
          parameters: {
            requirementDefinitionId: definition.requirementDefinitionId,
            effectDefinitionId: effect.effectDefinitionId,
          },
          message: "Efeito configurado exige ato institucional.",
        }),
      );
      if (effect.severity === "blocker" || effect.severity === "requirement") allowed = false;
    }
  }

  return { evaluations, diagnostics, allowed };
}
