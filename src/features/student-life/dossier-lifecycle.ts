/**
 * Etapa 13F — Política transversal de ciclo de vida (retenção).
 *
 * Aplica-se a QUALQUER recurso governado (registros do prontuário, documentos,
 * representações), não apenas a documentos. O fim do prazo NÃO significa
 * expiração: a consequência é declarada por configuração e executada por
 * executor registrado. O motor jamais exclui destrutivamente nada — ele apenas
 * PROPÕE ações.
 */
import type {
  GovernedResourceDescriptor,
  LifecycleConsequenceDeclaration,
  LifecycleEvaluation,
  LifecyclePolicy,
  LifecycleProposedAction,
  LifecycleRule,
} from "./dossier-types";

export const LIFECYCLE_ANCHOR_IDS = {
  effectiveDate: "data-do-fato",
  recordedAt: "data-de-registro",
} as const;

export const LIFECYCLE_EXECUTOR_IDS = {
  propose: "propor-consequencia-declarada",
} as const;

export type LifecycleConsequenceExecutor = (input: {
  resource: GovernedResourceDescriptor;
  rule: LifecycleRule;
  declaration: LifecycleConsequenceDeclaration;
  dueDate: string;
}) => LifecycleProposedAction | { inconclusiveDiagnostic: string };

export type LifecycleConsequenceRegistry = Map<
  string,
  LifecycleConsequenceExecutor
>;

export function createLifecycleConsequenceRegistry(): LifecycleConsequenceRegistry {
  const registry: LifecycleConsequenceRegistry = new Map();
  registry.set(
    LIFECYCLE_EXECUTOR_IDS.propose,
    ({ resource, rule, declaration, dueDate }) => ({
      resourceReference: resource.reference,
      ruleId: rule.ruleId,
      consequenceDefinitionId: declaration.consequenceDefinitionId,
      executorId: declaration.executorId,
      dueDate,
      ...(declaration.parameters ? { parameters: declaration.parameters } : {}),
    }),
  );
  return registry;
}

export function registerLifecycleConsequenceExecutor(
  registry: LifecycleConsequenceRegistry,
  executorId: string,
  executor: LifecycleConsequenceExecutor,
): LifecycleConsequenceRegistry {
  registry.set(executorId, executor);
  return registry;
}

export type LifecycleAnchorResolver = (input: {
  anchorDefinitionId: string;
  resource: GovernedResourceDescriptor;
}) => string | null;

const nativeAnchorResolver: LifecycleAnchorResolver = ({
  anchorDefinitionId,
  resource,
}) => {
  if (anchorDefinitionId === LIFECYCLE_ANCHOR_IDS.effectiveDate) {
    return resource.effectiveDate ?? null;
  }
  if (anchorDefinitionId === LIFECYCLE_ANCHOR_IDS.recordedAt) {
    return resource.recordedAt ? resource.recordedAt.slice(0, 10) : null;
  }
  return null;
};

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  const base = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  const shifted = new Date(base + days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

function ruleApplies(
  rule: LifecycleRule,
  resource: GovernedResourceDescriptor,
): boolean {
  if (
    !rule.resourceKindDefinitionIds.includes(resource.resourceKindDefinitionId)
  ) {
    return false;
  }
  if (
    rule.typeDefinitionIds &&
    !rule.typeDefinitionIds.includes(resource.typeDefinitionId)
  ) {
    return false;
  }
  return true;
}

/** Avalia o ciclo de vida sem aplicar nada: devolve ações devidas e pendências. */
export function evaluateLifecycle(input: {
  policy: LifecyclePolicy;
  resources: readonly GovernedResourceDescriptor[];
  evaluatedAt: string;
  registry?: LifecycleConsequenceRegistry;
  anchorResolver?: LifecycleAnchorResolver;
}): LifecycleEvaluation {
  const registry = input.registry ?? createLifecycleConsequenceRegistry();
  const anchorResolver = input.anchorResolver ?? nativeAnchorResolver;
  const proposedActions: LifecycleProposedAction[] = [];
  const inconclusive: { resourceId: string; diagnostic: string }[] = [];
  const diagnostics: string[] = [];

  if (!input.policy.homologated) {
    diagnostics.push(
      "Política de ciclo de vida não homologada: nenhuma consequência é devida.",
    );
    return {
      policyId: input.policy.policyId,
      policyVersion: input.policy.policyVersion,
      evaluatedAt: input.evaluatedAt,
      proposedActions: [],
      inconclusive: [],
      diagnostics,
    };
  }

  for (const resource of input.resources) {
    for (const rule of input.policy.rules) {
      if (!ruleApplies(rule, resource)) continue;
      const anchor = anchorResolver({
        anchorDefinitionId: rule.anchorDefinitionId,
        resource,
      });
      if (!anchor) {
        inconclusive.push({
          resourceId: resource.reference.entityId,
          diagnostic: `Âncora "${rule.anchorDefinitionId}" não resolvida: prazo indeterminado.`,
        });
        continue;
      }
      const dueDate = addDays(anchor, rule.retentionDurationDays);
      if (dueDate > input.evaluatedAt.slice(0, 10)) continue;

      for (const declaration of rule.consequences) {
        const executor = registry.get(declaration.executorId);
        if (!executor) {
          inconclusive.push({
            resourceId: resource.reference.entityId,
            diagnostic: `Consequência "${declaration.consequenceDefinitionId}" sem executor registrado: nada é aplicado.`,
          });
          continue;
        }
        const result = executor({ resource, rule, declaration, dueDate });
        if ("inconclusiveDiagnostic" in result) {
          inconclusive.push({
            resourceId: resource.reference.entityId,
            diagnostic: result.inconclusiveDiagnostic,
          });
          continue;
        }
        proposedActions.push(result);
      }
    }
  }

  return {
    policyId: input.policy.policyId,
    policyVersion: input.policy.policyVersion,
    evaluatedAt: input.evaluatedAt,
    proposedActions,
    inconclusive,
    diagnostics,
  };
}
