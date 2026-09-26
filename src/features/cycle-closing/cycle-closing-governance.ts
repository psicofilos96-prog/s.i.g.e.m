/**
 * Etapa 12K — governança do encerramento.
 *
 * Capacidades são dados, nunca cargos do motor. A admissibilidade de cada
 * operação depois do encerramento vem da MATRIZ GOVERNÁVEL declarada pela
 * política (ajuste 6): operationId × institutionalState → admissibilidade.
 * Nenhuma operação é proibida ou permitida por decisão de código.
 */
import type {
  ClosingActor,
  ClosingActorStamp,
  ClosingCapability,
  CycleClosingPolicy,
  InstitutionalState,
  OperationAdmissibility,
  OperationAdmissibilityPolicy,
} from "./cycle-closing-types";

export const closingActorStamp = (actor: ClosingActor, at: string): ClosingActorStamp => ({
  actorId: actor.id,
  actorName: actor.name,
  profileLabel: actor.profileLabel,
  at,
});

export const closingCan = (actor: ClosingActor, capability: ClosingCapability) =>
  actor.capabilities.includes(capability);

export const missingClosingCapabilityReason = (capability: ClosingCapability) =>
  `O perfil em uso não possui a capacidade institucional "${capability}". A operação depende de capacidade cadastrada, não de cargo presumido.`;

/** Capacidades exigidas para lavrar o ato. Ausentes = nada é exigido. */
export function closingCapabilityIssues(policy: CycleClosingPolicy, actor: ClosingActor) {
  return (policy.closingCapabilities ?? [])
    .filter((capability) => !closingCan(actor, capability))
    .map(missingClosingCapabilityReason);
}

export function rectificationIssues(
  policy: CycleClosingPolicy,
  input: { actor: ClosingActor; justification?: string },
) {
  const reasons: string[] = [];
  const rule = policy.rectificationPolicy;
  if (!rule)
    return [
      "Esta política não declara rito de retificação ou reabertura. Sem rito configurado, o encerramento não é alterado.",
    ];
  for (const capability of rule.requiredCapabilities ?? [])
    if (!closingCan(input.actor, capability)) reasons.push(missingClosingCapabilityReason(capability));
  if (rule.requiresJustification && !(input.justification ?? "").trim())
    reasons.push(
      "Informe a justificativa: alterar um encerramento é exceção formal, registrada e auditada.",
    );
  return reasons;
}

export type AdmissibilityDecision = {
  operationId: string;
  institutionalState: InstitutionalState;
  admissibility: OperationAdmissibility;
  reason: string;
  requiredCapabilities?: readonly ClosingCapability[];
  ruleId?: string;
};

/**
 * Consulta da matriz. Módulos futuros participam do regime de encerramento
 * cadastrando operações nesta política, sem alterar o núcleo da 12K.
 */
export function operationAdmissibility(input: {
  policy?: OperationAdmissibilityPolicy;
  operationId: string;
  institutionalState: InstitutionalState;
}): AdmissibilityDecision {
  const base = { operationId: input.operationId, institutionalState: input.institutionalState };
  if (!input.policy)
    return {
      ...base,
      admissibility: "permitida",
      reason:
        "Nenhuma matriz de admissibilidade foi declarada: o encerramento não restringe operações por conta própria.",
    };
  const rule = input.policy.rules.find(
    (item) =>
      item.operationId === input.operationId &&
      item.institutionalStates.includes(input.institutionalState),
  );
  if (!rule)
    return {
      ...base,
      admissibility: input.policy.fallback,
      reason: `A matriz "${input.policy.label}" não cadastra esta operação para o estado "${input.institutionalState}"; vale o comportamento declarado como padrão.`,
    };
  return {
    ...base,
    admissibility: rule.admissibility,
    reason: rule.note ?? `${rule.label}: ${rule.admissibility}.`,
    ...(rule.requiredCapabilities ? { requiredCapabilities: rule.requiredCapabilities } : {}),
    ruleId: rule.operationId,
  };
}

/**
 * Congelamento em memória: DEFESA da implementação atual, não a garantia
 * arquitetural de imutabilidade. A garantia real virá da persistência
 * append-only versionada, com autorização e auditoria.
 */
export function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value as Record<string, unknown>)) freezeDeep(inner);
  }
  return value;
}
