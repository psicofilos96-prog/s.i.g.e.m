/**
 * Etapa 13F — Motor de acesso ao dossiê.
 *
 * CADEIA: fatos do acesso → política configurada → efeito de acesso declarado
 *         → executor registrado → resultado primitivo.
 *
 * O motor NÃO conhece "permitido", "negado" nem "sigiloso": conhece apenas
 * primitivas (entra na projeção? quais campos? exige auditoria? há requisito
 * pendente?). Efeito sem executor registrado é INCONCLUSIVO e, por segurança,
 * não entra em nenhuma projeção (falha fechada).
 */
import type {
  AccessAuditRecord,
  AccessDecision,
  AccessEffectDeclaration,
  AccessEffectOutcome,
  AccessPolicyRule,
  AccessRequestFacts,
  DossierAccessPolicy,
  GovernedResourceDescriptor,
} from "./dossier-types";

/** Executor de efeito de acesso: traduz um efeito CONFIGURADO em primitivas. */
export type AccessEffectExecutor = (input: {
  facts: AccessRequestFacts;
  resource: GovernedResourceDescriptor;
  declaration: AccessEffectDeclaration;
  rule: AccessPolicyRule | null;
}) => AccessEffectOutcome;

export type AccessEffectRegistry = Map<string, AccessEffectExecutor>;

/** Executores nativos: primitivas genéricas, não taxonomia institucional. */
export const DOSSIER_ACCESS_EXECUTOR_IDS = {
  /** Autoriza todos os campos projetáveis declarados. */
  grantAll: "conceder-integralmente",
  /** Não inclui o recurso em nenhuma projeção, busca ou contagem. */
  withhold: "nao-disponibilizar",
  /** Autoriza e exige registro de auditoria de acesso. */
  grantWithAudit: "conceder-com-auditoria",
  /** Autoriza apenas os campos declarados em `parameters.fieldPaths`. */
  grantFields: "conceder-campos-declarados",
  /** Suprime os campos declarados em `parameters.redactedFieldPaths`. */
  grantRedacted: "conceder-com-supressao-de-campos",
  /** Condiciona a liberação a requisitos declarados (justificativa etc.). */
  requireSatisfaction: "condicionar-a-requisitos",
} as const;

function asStringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item) => typeof item === "string")
    ? (value as readonly string[])
    : null;
}

export function createAccessEffectRegistry(): AccessEffectRegistry {
  const registry: AccessEffectRegistry = new Map();

  registry.set(DOSSIER_ACCESS_EXECUTOR_IDS.grantAll, ({ resource }) => ({
    includeInProjection: true,
    grantedFieldPaths: resource.projectableFieldPaths,
    redactedFieldPaths: [],
    requiresAuditRecord: false,
  }));

  registry.set(DOSSIER_ACCESS_EXECUTOR_IDS.withhold, () => ({
    includeInProjection: false,
    grantedFieldPaths: [],
    redactedFieldPaths: [],
    requiresAuditRecord: false,
  }));

  registry.set(DOSSIER_ACCESS_EXECUTOR_IDS.grantWithAudit, ({ resource }) => ({
    includeInProjection: true,
    grantedFieldPaths: resource.projectableFieldPaths,
    redactedFieldPaths: [],
    requiresAuditRecord: true,
  }));

  registry.set(
    DOSSIER_ACCESS_EXECUTOR_IDS.grantFields,
    ({ resource, declaration }) => {
      const declared = asStringArray(declaration.parameters?.["fieldPaths"]);
      if (!declared) {
        return {
          includeInProjection: false,
          requiresAuditRecord: false,
          inconclusive: true,
          diagnostics: [
            "Efeito de campos declarados sem parâmetro `fieldPaths` configurado.",
          ],
        };
      }
      const granted = resource.projectableFieldPaths.filter((path) =>
        declared.includes(path),
      );
      return {
        includeInProjection: true,
        grantedFieldPaths: granted,
        redactedFieldPaths: resource.projectableFieldPaths.filter(
          (path) => !granted.includes(path),
        ),
        requiresAuditRecord:
          declaration.parameters?.["requiresAuditRecord"] === true,
      };
    },
  );

  registry.set(
    DOSSIER_ACCESS_EXECUTOR_IDS.grantRedacted,
    ({ resource, declaration }) => {
      const redacted =
        asStringArray(declaration.parameters?.["redactedFieldPaths"]) ?? null;
      if (!redacted) {
        return {
          includeInProjection: false,
          requiresAuditRecord: false,
          inconclusive: true,
          diagnostics: [
            "Efeito de supressão sem parâmetro `redactedFieldPaths` configurado.",
          ],
        };
      }
      return {
        includeInProjection: true,
        grantedFieldPaths: resource.projectableFieldPaths.filter(
          (path) => !redacted.includes(path),
        ),
        redactedFieldPaths: resource.projectableFieldPaths.filter((path) =>
          redacted.includes(path),
        ),
        requiresAuditRecord:
          declaration.parameters?.["requiresAuditRecord"] === true,
      };
    },
  );

  registry.set(
    DOSSIER_ACCESS_EXECUTOR_IDS.requireSatisfaction,
    ({ facts, resource, declaration }) => {
      const required =
        asStringArray(declaration.parameters?.["requirementDefinitionIds"]) ??
        null;
      if (!required) {
        return {
          includeInProjection: false,
          requiresAuditRecord: false,
          inconclusive: true,
          diagnostics: [
            "Efeito condicionado sem `requirementDefinitionIds` configurado.",
          ],
        };
      }
      const satisfied = facts.satisfiedRequirementDefinitionIds ?? [];
      const unmet = required.filter((id) => !satisfied.includes(id));
      if (unmet.length > 0) {
        return {
          includeInProjection: false,
          grantedFieldPaths: [],
          redactedFieldPaths: resource.projectableFieldPaths,
          requiresAuditRecord: false,
          unmetRequirementDefinitionIds: unmet,
        };
      }
      return {
        includeInProjection: true,
        grantedFieldPaths: resource.projectableFieldPaths,
        redactedFieldPaths: [],
        requiresAuditRecord: true,
      };
    },
  );

  return registry;
}

/** Registro aberto: efeito inédito entra por executor, nunca por `switch`. */
export function registerAccessEffectExecutor(
  registry: AccessEffectRegistry,
  executorId: string,
  executor: AccessEffectExecutor,
): AccessEffectRegistry {
  registry.set(executorId, executor);
  return registry;
}

function intersects(
  left: readonly { entityId: string }[],
  right: readonly { entityId: string }[],
): boolean {
  return left.some((item) => right.some((other) => other.entityId === item.entityId));
}

function matchesRule(
  rule: AccessPolicyRule,
  facts: AccessRequestFacts,
  resource: GovernedResourceDescriptor,
): boolean {
  const { match } = rule;
  if (
    match.capacityDefinitionIds &&
    !match.capacityDefinitionIds.some((id) =>
      facts.capacityDefinitionIds.includes(id),
    )
  ) {
    return false;
  }
  if (
    match.resourceKindDefinitionIds &&
    !match.resourceKindDefinitionIds.includes(resource.resourceKindDefinitionId)
  ) {
    return false;
  }
  if (
    match.typeDefinitionIds &&
    !match.typeDefinitionIds.includes(resource.typeDefinitionId)
  ) {
    return false;
  }
  if (
    match.sensitivityLevelDefinitionIds &&
    !match.sensitivityLevelDefinitionIds.includes(
      resource.sensitivityLevelDefinitionId,
    )
  ) {
    return false;
  }
  if (
    match.operationDefinitionIds &&
    !match.operationDefinitionIds.includes(facts.operationDefinitionId)
  ) {
    return false;
  }
  if (
    match.processingPurposeDefinitionIds &&
    !match.processingPurposeDefinitionIds.includes(
      facts.processingPurposeDefinitionId,
    )
  ) {
    return false;
  }
  if (
    match.requiresScopeIntersection === true &&
    !intersects(facts.scopeEntities, resource.scopeEntities)
  ) {
    return false;
  }
  return true;
}

/** Decide o acesso a UM recurso. Sem regra aplicável usa o efeito padrão. */
export function decideAccess(input: {
  policy: DossierAccessPolicy;
  facts: AccessRequestFacts;
  resource: GovernedResourceDescriptor;
  registry?: AccessEffectRegistry;
}): AccessDecision {
  const { policy, facts, resource } = input;
  const registry = input.registry ?? createAccessEffectRegistry();
  const diagnostics: string[] = [];

  if (!policy.homologated) {
    diagnostics.push(
      "Política de acesso não homologada: nenhuma disponibilização é produzida.",
    );
    return {
      resourceReference: resource.reference,
      appliedRuleId: null,
      accessEffectDefinitionId: null,
      executorId: null,
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      outcome: {
        includeInProjection: false,
        requiresAuditRecord: false,
        inconclusive: true,
      },
      diagnostics,
    };
  }

  const ordered = [...policy.rules].sort((a, b) => a.priority - b.priority);
  const rule = ordered.find((candidate) =>
    matchesRule(candidate, facts, resource),
  );
  const declaration = rule ? rule.effect : policy.defaultEffect;
  if (!rule) {
    diagnostics.push(
      "Nenhuma regra correspondeu: aplicado o efeito padrão configurado.",
    );
  }

  const executor = registry.get(declaration.executorId);
  if (!executor) {
    diagnostics.push(
      `Efeito de acesso "${declaration.accessEffectDefinitionId}" sem executor registrado ("${declaration.executorId}"): inconclusivo.`,
    );
    return {
      resourceReference: resource.reference,
      appliedRuleId: rule?.ruleId ?? null,
      accessEffectDefinitionId: declaration.accessEffectDefinitionId,
      executorId: declaration.executorId,
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      outcome: {
        includeInProjection: false,
        requiresAuditRecord: false,
        inconclusive: true,
      },
      diagnostics,
    };
  }

  const outcome = executor({
    facts,
    resource,
    declaration,
    rule: rule ?? null,
  });
  if (outcome.diagnostics) diagnostics.push(...outcome.diagnostics);

  return {
    resourceReference: resource.reference,
    appliedRuleId: rule?.ruleId ?? null,
    accessEffectDefinitionId: declaration.accessEffectDefinitionId,
    executorId: declaration.executorId,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    outcome,
    diagnostics,
  };
}

/**
 * Seleciona o CONJUNTO AUTORIZADO antes de qualquer projeção, busca, contagem
 * ou snippet. Recursos não incluídos não são revelados por nenhuma via.
 */
export function selectAuthorizedResources(input: {
  policy: DossierAccessPolicy;
  facts: AccessRequestFacts;
  resources: readonly GovernedResourceDescriptor[];
  registry?: AccessEffectRegistry;
}): {
  authorized: readonly {
    resource: GovernedResourceDescriptor;
    decision: AccessDecision;
  }[];
  withheldCount: number;
  diagnostics: readonly string[];
} {
  const registry = input.registry ?? createAccessEffectRegistry();
  const authorized: {
    resource: GovernedResourceDescriptor;
    decision: AccessDecision;
  }[] = [];
  const diagnostics: string[] = [];
  let withheldCount = 0;

  for (const resource of input.resources) {
    const decision = decideAccess({
      policy: input.policy,
      facts: input.facts,
      resource,
      ...(input.registry ? { registry } : { registry }),
    });
    if (decision.outcome.includeInProjection) {
      authorized.push({ resource, decision });
    } else {
      withheldCount += 1;
      if (decision.outcome.inconclusive) {
        diagnostics.push(
          `Acesso inconclusivo a recurso do tipo "${resource.typeDefinitionId}": não disponibilizado.`,
        );
      }
    }
  }

  return { authorized, withheldCount, diagnostics };
}

/** Minimiza o conteúdo do recurso conforme os campos autorizados. */
export function redactPayload(input: {
  payload: Readonly<Record<string, unknown>>;
  resource: GovernedResourceDescriptor;
  decision: AccessDecision;
}): {
  authorizedPayload: Readonly<Record<string, unknown>>;
  redactedFieldPaths: readonly string[];
} {
  const granted =
    input.decision.outcome.grantedFieldPaths ??
    input.resource.projectableFieldPaths;
  const authorizedPayload: Record<string, unknown> = {};
  const redactedFieldPaths: string[] = [];

  for (const [key, value] of Object.entries(input.payload)) {
    if (granted.includes(key)) {
      authorizedPayload[key] = value;
    } else {
      redactedFieldPaths.push(key);
    }
  }

  return { authorizedPayload, redactedFieldPaths };
}

/** Constrói a trilha de auditoria quando a POLÍTICA a exigir. */
export function buildAccessAuditRecords(input: {
  facts: AccessRequestFacts;
  decisions: readonly AccessDecision[];
  auditIdFactory: (index: number) => string;
  policyRulesById?: ReadonlyMap<string, AccessPolicyRule>;
}): readonly AccessAuditRecord[] {
  const records: AccessAuditRecord[] = [];
  input.decisions.forEach((decision) => {
    if (!decision.outcome.requiresAuditRecord) return;
    const rule = decision.appliedRuleId
      ? input.policyRulesById?.get(decision.appliedRuleId)
      : undefined;
    const basis = rule?.legalOrInstitutionalBasisReference;
    records.push({
      auditId: input.auditIdFactory(records.length),
      resourceReference: decision.resourceReference,
      actorId: input.facts.actorId,
      capacityDefinitionIds: input.facts.capacityDefinitionIds,
      operationDefinitionId: input.facts.operationDefinitionId,
      processingPurposeDefinitionId: input.facts.processingPurposeDefinitionId,
      accessEffectDefinitionId: decision.accessEffectDefinitionId,
      appliedRuleId: decision.appliedRuleId,
      policyId: decision.policyId,
      policyVersion: decision.policyVersion,
      occurredAt: input.facts.requestedAt,
      scopeEntities: input.facts.scopeEntities,
      ...(basis ? { legalOrInstitutionalBasisReference: basis } : {}),
    });
  });
  return records;
}
