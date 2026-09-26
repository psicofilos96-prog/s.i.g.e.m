/**
 * Etapa 13G — Motor do Workspace Projection Framework.
 *
 * O motor conhece apenas primitivas: autorizar antes de projetar, classificar
 * por predicado registrado, comparar datas, separar admissibilidade do processo
 * da autorização do agente e agregar diagnósticos alheios.
 *
 * Ele NÃO conhece Secretaria, Orientação, Direção, Supervisão, matrícula,
 * turma, transferência nem documento. Tudo isso entra por configuração e por
 * registro de executores/adaptadores.
 */
import {
  redactPayload,
  selectAuthorizedResources,
  type AccessEffectRegistry,
} from "@/features/student-life/dossier-access";
import type {
  AccessDecision,
  AccessRequestFacts,
  DossierAccessPolicy,
  GovernedResourceDescriptor,
} from "@/features/student-life/dossier-types";
import {
  WORKSPACE_ADMISSIBILITY,
  WORKSPACE_AUTHORIZATION,
  WORKSPACE_PROJECTION_SCHEMA_VERSION,
  type OperationalQueueItem,
  type ProfileSectionProvider,
  type ProfileSectionResult,
  type WorkspaceAccessContext,
  type WorkspaceActionDescriptor,
  type WorkspaceAuthorization,
  type WorkspaceConsultedSource,
  type WorkspaceOperationDeclaration,
  type WorkspaceOperationalFact,
  type WorkspaceProjection,
  type WorkspaceQueueDefinition,
  type WorkspaceQueueProjection,
  type WorkspaceRequirementDiagnostic,
  type WorkspaceTemporalWindowDefinition,
} from "./workspace-types";

// ------------------------------------------------- Registro de tipos de processo

/**
 * Adaptador de processo: traduz entidades de um domínio em fatos operacionais.
 * Um novo processo entra por registro — nunca alterando o núcleo do portal.
 */
export type WorkspaceProcessProjectionAdapter = (
  entity: unknown,
) => WorkspaceOperationalFact | null;

export type WorkspaceProcessTypeRegistration = {
  processTypeDefinitionId: string;
  labelSnapshot: string;
  executingDomainId: string;
  projectionAdapter: WorkspaceProcessProjectionAdapter;
};

export type WorkspaceProcessRegistry = Map<string, WorkspaceProcessTypeRegistration>;

export function createProcessRegistry(): WorkspaceProcessRegistry {
  return new Map();
}

export function registerProcessType(
  registry: WorkspaceProcessRegistry,
  registration: WorkspaceProcessTypeRegistration,
): WorkspaceProcessRegistry {
  registry.set(registration.processTypeDefinitionId, registration);
  return registry;
}

export type WorkspaceProcessSourceInput = {
  processTypeDefinitionId: string;
  entities: readonly unknown[];
};

export function projectProcessFacts(input: {
  sources: readonly WorkspaceProcessSourceInput[];
  registry: WorkspaceProcessRegistry;
}): { facts: readonly WorkspaceOperationalFact[]; diagnostics: readonly string[] } {
  const facts: WorkspaceOperationalFact[] = [];
  const diagnostics: string[] = [];
  for (const source of input.sources) {
    const registration = input.registry.get(source.processTypeDefinitionId);
    if (!registration) {
      diagnostics.push(
        `Tipo de processo "${source.processTypeDefinitionId}" sem adaptador registrado: nada é projetado a partir dele.`,
      );
      continue;
    }
    for (const entity of source.entities) {
      const fact = registration.projectionAdapter(entity);
      if (fact) facts.push(fact);
    }
  }
  return { facts, diagnostics };
}

// ------------------------------------------------ Predicados de fila (abertos)

export type WorkspaceQueuePredicateExecutor = (input: {
  fact: WorkspaceOperationalFact;
  parameters: Readonly<Record<string, unknown>>;
  referenceDate: string;
  windows: ReadonlyMap<string, WorkspaceTemporalWindowDefinition>;
}) => boolean;

export type WorkspaceQueuePredicateRegistry = Map<
  string,
  WorkspaceQueuePredicateExecutor
>;

/** Executores nativos: primitivas genéricas de comparação. */
export const WORKSPACE_PREDICATE_EXECUTOR_IDS = {
  awaitingParty: "aguardando-parte-declarada",
  processTypeIn: "tipo-de-processo-em",
  stateIn: "estado-em",
  hasOpenRequirement: "possui-requisito-em-aberto",
  deadlineWithinWindow: "prazo-dentro-da-janela",
  concludedWithinWindow: "concluido-dentro-da-janela",
  notConcluded: "nao-concluido",
} as const;

function stringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item) => typeof item === "string")
    ? (value as readonly string[])
    : null;
}

function daysApart(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00.000Z`);
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.NaN;
  return Math.round((to - from) / 86_400_000);
}

function resolveWindowDays(input: {
  parameters: Readonly<Record<string, unknown>>;
  windows: ReadonlyMap<string, WorkspaceTemporalWindowDefinition>;
}): number | null {
  const windowId = input.parameters["windowDefinitionId"];
  if (typeof windowId !== "string") return null;
  const definition = input.windows.get(windowId);
  return definition ? definition.days : null;
}

export function createQueuePredicateRegistry(): WorkspaceQueuePredicateRegistry {
  const registry: WorkspaceQueuePredicateRegistry = new Map();

  registry.set(
    WORKSPACE_PREDICATE_EXECUTOR_IDS.awaitingParty,
    ({ fact, parameters }) => {
      const declared = stringArray(parameters["awaitingPartyDefinitionIds"]);
      if (!declared) return false;
      return (
        fact.awaitingPartyDefinitionId !== undefined &&
        declared.includes(fact.awaitingPartyDefinitionId)
      );
    },
  );

  registry.set(WORKSPACE_PREDICATE_EXECUTOR_IDS.processTypeIn, ({ fact, parameters }) => {
    const declared = stringArray(parameters["processTypeDefinitionIds"]);
    return declared ? declared.includes(fact.processTypeDefinitionId) : false;
  });

  registry.set(WORKSPACE_PREDICATE_EXECUTOR_IDS.stateIn, ({ fact, parameters }) => {
    const declared = stringArray(parameters["stateDefinitionIds"]);
    return declared ? declared.includes(fact.processStateDefinitionId) : false;
  });

  registry.set(WORKSPACE_PREDICATE_EXECUTOR_IDS.hasOpenRequirement, ({ fact }) =>
    (fact.requirementDiagnostics ?? []).length > 0,
  );

  registry.set(WORKSPACE_PREDICATE_EXECUTOR_IDS.notConcluded, ({ fact }) =>
    fact.concludedAt === undefined,
  );

  registry.set(
    WORKSPACE_PREDICATE_EXECUTOR_IDS.deadlineWithinWindow,
    ({ fact, parameters, referenceDate, windows }) => {
      if (!fact.deadline) return false;
      const days = resolveWindowDays({ parameters, windows });
      if (days === null) return false;
      const distance = daysApart(referenceDate, fact.deadline.dueDate);
      if (Number.isNaN(distance)) return false;
      return distance <= days;
    },
  );

  registry.set(
    WORKSPACE_PREDICATE_EXECUTOR_IDS.concludedWithinWindow,
    ({ fact, parameters, referenceDate, windows }) => {
      if (!fact.concludedAt) return false;
      const days = resolveWindowDays({ parameters, windows });
      if (days === null) return false;
      const distance = daysApart(fact.concludedAt, referenceDate);
      if (Number.isNaN(distance)) return false;
      return distance >= 0 && distance <= days;
    },
  );

  return registry;
}

export function registerQueuePredicateExecutor(
  registry: WorkspaceQueuePredicateRegistry,
  predicateExecutorId: string,
  executor: WorkspaceQueuePredicateExecutor,
): WorkspaceQueuePredicateRegistry {
  registry.set(predicateExecutorId, executor);
  return registry;
}

// ------------------------------------------------- Ações: disponível x autorizada

/**
 * Separa ADMISSIBILIDADE do processo (declarada pelo domínio) da AUTORIZAÇÃO do
 * agente (capacidades efetivas). Falha FECHADA: inconclusivo nunca vira "pode".
 */
export function describeAction(input: {
  factKey: string;
  declaration: WorkspaceOperationDeclaration;
  context: WorkspaceAccessContext;
}): WorkspaceActionDescriptor {
  const { declaration, context } = input;
  const missing = declaration.requiredCapacityDefinitionIds.filter(
    (capacity) => !context.capacityDefinitionIds.includes(capacity),
  );

  let authorization: WorkspaceAuthorization = WORKSPACE_AUTHORIZATION.authorized;
  if (declaration.requiredCapacityDefinitionIds.length === 0) {
    authorization = WORKSPACE_AUTHORIZATION.inconclusive;
  } else if (missing.length > 0) {
    authorization = WORKSPACE_AUTHORIZATION.notAuthorized;
  }

  const impediments = declaration.impedimentMessages ?? [];
  let explanation: string;
  if (authorization === WORKSPACE_AUTHORIZATION.inconclusive) {
    explanation =
      "Não é possível determinar a autorização: a operação não declara capacidades exigidas na configuração.";
  } else if (authorization === WORKSPACE_AUTHORIZATION.notAuthorized) {
    explanation = `Operação existe no processo, mas o agente não possui a capacidade exigida (${missing.join(", ")}).`;
  } else if (declaration.admissibility === WORKSPACE_ADMISSIBILITY.inadmissible) {
    explanation =
      impediments.length > 0
        ? `Agente autorizado, porém o processo não admite a operação agora: ${impediments.join(" ")}`
        : "Agente autorizado, porém o domínio declarou a operação inadmissível neste processo.";
  } else if (declaration.admissibility === WORKSPACE_ADMISSIBILITY.inconclusive) {
    explanation =
      "Agente autorizado, mas a admissibilidade do processo está inconclusiva: nenhuma execução é presumida.";
  } else {
    explanation = "Operação admissível no processo e autorizada para o agente.";
  }

  return {
    actionKey: `${input.factKey}::${declaration.operationDefinitionId}`,
    operationDefinitionId: declaration.operationDefinitionId,
    labelSnapshot: declaration.labelSnapshot,
    executingDomainId: declaration.executingDomainId,
    processAdmissibility: declaration.admissibility,
    actorAuthorization: authorization,
    requiredCapacityDefinitionIds: declaration.requiredCapacityDefinitionIds,
    missingCapacityDefinitionIds: missing,
    impedimentMessages: impediments,
    explanation,
    ...(declaration.deepLink ? { deepLink: declaration.deepLink } : {}),
  };
}

/** Só executa quando processo admite E agente está autorizado. */
export function isActionExecutable(action: WorkspaceActionDescriptor): boolean {
  return (
    action.processAdmissibility === WORKSPACE_ADMISSIBILITY.admissible &&
    action.actorAuthorization === WORKSPACE_AUTHORIZATION.authorized
  );
}

// ------------------------------------------------------- Projeção autorizada

function toResourceDescriptor(
  fact: WorkspaceOperationalFact,
): GovernedResourceDescriptor {
  return {
    reference: {
      entityKindDefinitionId: fact.source.sourceTypeDefinitionId,
      entityId: fact.source.entityId,
      ...(fact.source.entityVersion !== undefined
        ? { entityVersion: fact.source.entityVersion }
        : {}),
      labelSnapshot: fact.titleSnapshot,
    },
    resourceKindDefinitionId: fact.resourceKindDefinitionId,
    typeDefinitionId: fact.typeDefinitionId,
    sensitivityLevelDefinitionId: fact.sensitivityLevelDefinitionId,
    subjectReferences: fact.subjectReferences,
    scopeEntities: fact.scopeEntities,
    projectableFieldPaths: fact.projectableFieldPaths,
    effectiveDate: fact.effectiveDate,
    recordedAt: fact.recordedAt,
  };
}

function toAccessFacts(context: WorkspaceAccessContext): AccessRequestFacts {
  return {
    actorId: context.actorId,
    capacityDefinitionIds: context.capacityDefinitionIds,
    processingPurposeDefinitionId: context.processingPurposeDefinitionId,
    operationDefinitionId: context.readOperationDefinitionId,
    scopeEntities: context.institutionalScopes,
    requestedAt: context.requestedAt,
    ...(context.satisfiedRequirementDefinitionIds
      ? {
          satisfiedRequirementDefinitionIds:
            context.satisfiedRequirementDefinitionIds,
        }
      : {}),
  };
}

/**
 * AUTORIZA ANTES DE PROJETAR. Fatos não autorizados não entram em fila, item,
 * contagem, matriz de pendências, seção da ficha nem resultado de busca.
 */
export function selectAuthorizedWorkspaceItems(input: {
  facts: readonly WorkspaceOperationalFact[];
  context: WorkspaceAccessContext;
  accessPolicy: DossierAccessPolicy;
  accessRegistry?: AccessEffectRegistry;
}): {
  items: readonly OperationalQueueItem[];
  diagnostics: readonly string[];
} {
  const selection = selectAuthorizedResources({
    policy: input.accessPolicy,
    facts: toAccessFacts(input.context),
    resources: input.facts.map(toResourceDescriptor),
    ...(input.accessRegistry ? { registry: input.accessRegistry } : {}),
  });

  const decisionByEntityId = new Map<string, AccessDecision>();
  for (const entry of selection.authorized) {
    decisionByEntityId.set(entry.resource.reference.entityId, entry.decision);
  }

  const items: OperationalQueueItem[] = [];
  for (const fact of input.facts) {
    const decision = decisionByEntityId.get(fact.source.entityId);
    if (!decision) continue;
    const resource = toResourceDescriptor(fact);
    const { authorizedPayload, redactedFieldPaths } = redactPayload({
      payload: fact.payload,
      resource,
      decision,
    });
    items.push({
      queueItemKey: fact.factKey,
      queueDefinitionId: "",
      source: fact.source,
      producedByDomainId: fact.producedByDomainId,
      processTypeDefinitionId: fact.processTypeDefinitionId,
      processStateDefinitionId: fact.processStateDefinitionId,
      titleSnapshot: fact.titleSnapshot,
      ...(fact.summary ? { summary: fact.summary } : {}),
      subjectReferences: fact.subjectReferences,
      effectiveDate: fact.effectiveDate,
      recordedAt: fact.recordedAt,
      ...(fact.concludedAt ? { concludedAt: fact.concludedAt } : {}),
      ...(fact.awaitingPartyDefinitionId
        ? { awaitingPartyDefinitionId: fact.awaitingPartyDefinitionId }
        : {}),
      ...(fact.deadline ? { deadline: fact.deadline } : {}),
      actions: (fact.availableOperations ?? []).map((declaration) =>
        describeAction({
          factKey: fact.factKey,
          declaration,
          context: input.context,
        }),
      ),
      requirementDiagnostics: fact.requirementDiagnostics ?? [],
      ...(fact.deepLink ? { deepLink: fact.deepLink } : {}),
      authorizedPayload,
      redactedFieldPaths: [
        ...new Set([
          ...redactedFieldPaths,
          ...(decision.outcome.redactedFieldPaths ?? []),
        ]),
      ],
      ...(fact.policyId ? { policyId: fact.policyId } : {}),
      ...(fact.policyVersion !== undefined
        ? { policyVersion: fact.policyVersion }
        : {}),
    });
  }

  return { items, diagnostics: selection.diagnostics };
}

function consultedSourcesOf(
  facts: readonly WorkspaceOperationalFact[],
): readonly WorkspaceConsultedSource[] {
  const grouped = new Map<string, WorkspaceConsultedSource>();
  for (const fact of facts) {
    const key = `${fact.source.sourceTypeDefinitionId}::${fact.producedByDomainId}`;
    const existing = grouped.get(key);
    const version = fact.source.sourceProjectionSchemaVersion;
    if (existing) {
      grouped.set(key, {
        ...existing,
        entityCount: existing.entityCount + 1,
        sourceProjectionSchemaVersions:
          version !== undefined &&
          !existing.sourceProjectionSchemaVersions.includes(version)
            ? [...existing.sourceProjectionSchemaVersions, version]
            : existing.sourceProjectionSchemaVersions,
      });
      continue;
    }
    grouped.set(key, {
      sourceTypeDefinitionId: fact.source.sourceTypeDefinitionId,
      producedByDomainId: fact.producedByDomainId,
      entityCount: 1,
      sourceProjectionSchemaVersions: version !== undefined ? [version] : [],
    });
  }
  return [...grouped.values()];
}

/**
 * Projeção operacional completa de uma perspectiva de workspace.
 *
 * A perspectiva é apenas um identificador: nada no motor muda por ela. O que
 * muda são capacidades, escopo, finalidade, filas configuradas e fontes.
 */
export function projectWorkspace(input: {
  workspacePerspectiveDefinitionId: string;
  context: WorkspaceAccessContext;
  accessPolicy: DossierAccessPolicy;
  facts: readonly WorkspaceOperationalFact[];
  queueDefinitions: readonly WorkspaceQueueDefinition[];
  temporalWindows: readonly WorkspaceTemporalWindowDefinition[];
  predicateRegistry?: WorkspaceQueuePredicateRegistry;
  accessRegistry?: AccessEffectRegistry;
  producedAt: string;
  upstreamDiagnostics?: readonly string[];
}): WorkspaceProjection {
  const diagnostics: string[] = [...(input.upstreamDiagnostics ?? [])];
  const predicateRegistry = input.predicateRegistry ?? createQueuePredicateRegistry();
  const windows = new Map(
    input.temporalWindows.map((window) => [window.windowDefinitionId, window]),
  );

  const authorized = selectAuthorizedWorkspaceItems({
    facts: input.facts,
    context: input.context,
    accessPolicy: input.accessPolicy,
    ...(input.accessRegistry ? { accessRegistry: input.accessRegistry } : {}),
  });
  diagnostics.push(...authorized.diagnostics);

  const factByKey = new Map(input.facts.map((fact) => [fact.factKey, fact]));

  const queues: WorkspaceQueueProjection[] = [];
  for (const definition of [...input.queueDefinitions].sort(
    (left, right) => left.order - right.order,
  )) {
    const items: OperationalQueueItem[] = [];
    for (const item of authorized.items) {
      const fact = factByKey.get(item.queueItemKey);
      if (!fact) continue;
      let matched = definition.predicates.length > 0;
      for (const predicate of definition.predicates) {
        const executor = predicateRegistry.get(predicate.predicateExecutorId);
        if (!executor) {
          diagnostics.push(
            `Predicado "${predicate.predicateExecutorId}" da fila "${definition.queueDefinitionId}" não possui executor registrado: a fila não classifica por ele.`,
          );
          matched = false;
          break;
        }
        if (
          !executor({
            fact,
            parameters: predicate.parameters ?? {},
            referenceDate: input.context.requestedAt,
            windows,
          })
        ) {
          matched = false;
          break;
        }
      }
      if (!matched) continue;
      items.push({
        ...item,
        queueDefinitionId: definition.queueDefinitionId,
        queueItemKey: `${definition.queueDefinitionId}::${item.source.sourceTypeDefinitionId}::${item.source.entityId}`,
      });
    }
    queues.push({ definition, items, itemCount: items.length });
  }

  const requirementMatrix: WorkspaceRequirementDiagnostic[] = [];
  for (const item of authorized.items) {
    requirementMatrix.push(...item.requirementDiagnostics);
  }

  return {
    workspaceProjectionSchemaVersion: WORKSPACE_PROJECTION_SCHEMA_VERSION,
    producedAt: input.producedAt,
    workspacePerspectiveDefinitionId: input.workspacePerspectiveDefinitionId,
    actorId: input.context.actorId,
    institutionalScopes: input.context.institutionalScopes,
    processingPurposeDefinitionId: input.context.processingPurposeDefinitionId,
    queues,
    requirementMatrix,
    authorizedItems: authorized.items,
    consultedSources: consultedSourcesOf(
      input.facts.filter((fact) =>
        authorized.items.some((item) => item.queueItemKey === fact.factKey),
      ),
    ),
    accessPolicyId: input.accessPolicy.policyId,
    accessPolicyVersion: input.accessPolicy.policyVersion,
    diagnostics,
  };
}

// ------------------------------------------- Ficha integrada composicional

export type ProfileSectionRegistration = {
  sectionDefinitionId: string;
  provider: ProfileSectionProvider;
};

export type ProfileSectionRegistry = Map<string, ProfileSectionProvider>;

export function createProfileSectionRegistry(): ProfileSectionRegistry {
  return new Map();
}

export function registerProfileSection(
  registry: ProfileSectionRegistry,
  registration: ProfileSectionRegistration,
): ProfileSectionRegistry {
  registry.set(registration.sectionDefinitionId, registration.provider);
  return registry;
}

/**
 * Monta a ficha a partir das seções REGISTRADAS. O portal não conhece 13A–13F:
 * cada domínio (e, futuramente, Educação Especial, Transporte, Alimentação…)
 * fornece seu próprio provedor.
 */
export function projectIntegratedProfile(input: {
  subjectEntityId: string;
  context: WorkspaceAccessContext;
  projection: WorkspaceProjection;
  registry: ProfileSectionRegistry;
}): {
  sections: readonly ProfileSectionResult[];
  diagnostics: readonly string[];
} {
  const authorizedItems = input.projection.authorizedItems.filter((item) =>
    item.subjectReferences.some(
      (subject) => subject.reference.entityId === input.subjectEntityId,
    ),
  );
  const sections: ProfileSectionResult[] = [];
  const diagnostics: string[] = [];

  for (const provider of input.registry.values()) {
    const section = provider({
      subjectEntityId: input.subjectEntityId,
      context: input.context,
      authorizedItems,
    });
    if (!section) continue;
    sections.push(section);
    diagnostics.push(...section.diagnostics);
  }

  sections.sort((left, right) =>
    left.order === right.order
      ? left.sectionDefinitionId.localeCompare(right.sectionDefinitionId)
      : left.order - right.order,
  );
  return { sections, diagnostics };
}
