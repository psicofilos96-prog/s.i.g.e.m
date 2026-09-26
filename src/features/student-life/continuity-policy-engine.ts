/**
 * Etapa 13E — Motor de continuidade: primitivas + registros abertos.
 *
 *   FATOS NORMALIZADOS + CONTEXTO PRETENDIDO
 *     → CONDIÇÕES (avaliadores registrados)
 *     → CONSEQUÊNCIAS (executores registrados)
 *     → RESOLUÇÃO | OBRIGAÇÃO | EQUIVALÊNCIA | PENDÊNCIA
 *
 * O motor conhece apenas primitivas: comparar valor, combinar condições, contar
 * dimensões que satisfazem um seletor e delegar a execução da consequência.
 * Ele não conhece etapa, componente, nota mínima, percentual de frequência,
 * quantidade máxima de dependências, modalidade, ano ou nome de situação.
 *
 * Nenhuma consequência é aplicada diretamente sobre inscrição, participação ou
 * turma: o motor PRODUZ fatos, resoluções, obrigações e pendências.
 */
import { diagnostic } from "./student-life-diagnostics";
import type {
  InternalId,
  StudentLifeDiagnostic,
  StudentLifeEventScope,
  StudentLifeProvenance,
} from "./student-life-types";
import {
  CONTINUITY_DIAGNOSTIC_CODES as CODES,
  CONTINUITY_DIAGNOSTIC_TYPES as TYPES,
} from "./continuity-diagnostics";
import type {
  AcademicContinuationResolution,
  AcademicContinuityPolicy,
  ContinuityCondition,
  ContinuityConsequenceDeclaration,
  ContinuityEvaluation,
  ContinuityFactValue,
  ContinuityObligationDraft,
  ContinuityPendingIssue,
  ContinuityRule,
  ContinuityTargetContext,
  CurriculumReference,
  EquivalenceAnalysisRequest,
  NormalizedAcademicDimension,
  NormalizedAcademicOrigin,
} from "./continuity-types";

// ------------------------------------------------------------ Comparadores

export const CONTINUITY_COMPARATOR_IDS = {
  equals: "igual",
  notEquals: "diferente",
  exists: "existe",
  absent: "ausente",
  greaterThan: "maior",
  greaterOrEqual: "maiorOuIgual",
  lessThan: "menor",
  lessOrEqual: "menorOuIgual",
  containsText: "contemTexto",
} as const;

export type ContinuityComparator = (
  actual: ContinuityFactValue | undefined,
  expected: ContinuityFactValue | undefined,
) => boolean;

function numeric(value: ContinuityFactValue | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const NATIVE_COMPARATORS: ReadonlyMap<string, ContinuityComparator> = new Map<
  string,
  ContinuityComparator
>([
  [CONTINUITY_COMPARATOR_IDS.equals, (a, b) => a === b],
  [CONTINUITY_COMPARATOR_IDS.notEquals, (a, b) => a !== b],
  [CONTINUITY_COMPARATOR_IDS.exists, (a) => a !== undefined && a !== null],
  [CONTINUITY_COMPARATOR_IDS.absent, (a) => a === undefined || a === null],
  [
    CONTINUITY_COMPARATOR_IDS.greaterThan,
    (a, b) => {
      const x = numeric(a);
      const y = numeric(b);
      return x !== null && y !== null && x > y;
    },
  ],
  [
    CONTINUITY_COMPARATOR_IDS.greaterOrEqual,
    (a, b) => {
      const x = numeric(a);
      const y = numeric(b);
      return x !== null && y !== null && x >= y;
    },
  ],
  [
    CONTINUITY_COMPARATOR_IDS.lessThan,
    (a, b) => {
      const x = numeric(a);
      const y = numeric(b);
      return x !== null && y !== null && x < y;
    },
  ],
  [
    CONTINUITY_COMPARATOR_IDS.lessOrEqual,
    (a, b) => {
      const x = numeric(a);
      const y = numeric(b);
      return x !== null && y !== null && x <= y;
    },
  ],
  [
    CONTINUITY_COMPARATOR_IDS.containsText,
    (a, b) =>
      typeof a === "string" && typeof b === "string" && a.toLowerCase().includes(b.toLowerCase()),
  ],
]);

export function createContinuityComparatorRegistry(): Map<string, ContinuityComparator> {
  return new Map(NATIVE_COMPARATORS);
}

// ---------------------------------------------------------- Mapa de fatos

/**
 * Projeta os fatos consultáveis pelas condições. Chaves são planas e abertas;
 * nenhuma delas é normativa.
 */
export function continuityFactMap(
  origin: NormalizedAcademicOrigin,
  target: ContinuityTargetContext,
): Readonly<Record<string, ContinuityFactValue>> {
  const map: Record<string, ContinuityFactValue> = {};
  map["origem.tipoFonte"] = origin.sourceTypeDefinitionId;
  map["origem.schemaVersao"] = origin.sourceSchemaVersion;
  map["origem.referencia.tipo"] = origin.sourceReference.kind;
  map["origem.resolucao.presente"] = origin.resolutionReference !== undefined;
  if (origin.resolutionReference) {
    map["origem.resolucao.definicao"] = origin.resolutionReference.definitionId;
  }
  for (const fact of origin.facts) {
    map[`fato.${fact.factKey}`] = fact.value;
  }
  for (const [key, value] of Object.entries(target.attributes)) {
    map[`destino.${key}`] = value;
  }
  if (target.targetCurriculumReference) {
    map["destino.matriz.definicao"] = target.targetCurriculumReference.definitionId;
    if (target.targetCurriculumReference.definitionVersion !== undefined) {
      map["destino.matriz.versao"] = target.targetCurriculumReference.definitionVersion;
    }
  }
  return map;
}

/** Seletor declarativo de dimensões: natureza e/ou comparação sobre um fato. */
export function selectDimensions(
  dimensions: readonly NormalizedAcademicDimension[],
  parameters: Readonly<Record<string, ContinuityFactValue>>,
  comparators: ReadonlyMap<string, ContinuityComparator>,
): { selected: readonly NormalizedAcademicDimension[]; comparatorMissing: string | null } {
  const kind = parameters["dimensionKindId"];
  const factKey = parameters["factKey"];
  const comparatorId = parameters["comparatorId"];
  const expected = parameters["value"];
  let comparator: ContinuityComparator | undefined;
  if (typeof comparatorId === "string") {
    comparator = comparators.get(comparatorId);
    if (!comparator) return { selected: [], comparatorMissing: comparatorId };
  }
  const selected = dimensions.filter((dimension) => {
    if (typeof kind === "string" && dimension.dimensionKindId !== kind) return false;
    if (typeof factKey !== "string") return true;
    const fact = dimension.facts.find((item) => item.factKey === factKey);
    if (!comparator) return fact !== undefined;
    return comparator(fact?.value, expected ?? undefined);
  });
  return { selected, comparatorMissing: null };
}

// ------------------------------------------------------ Avaliadores de condição

export const CONTINUITY_CONDITION_KIND_IDS = {
  fact: "comparacao-de-fato",
  dimensionCount: "contagem-de-dimensoes",
} as const;

export type ContinuityConditionContext = {
  origin: NormalizedAcademicOrigin;
  target: ContinuityTargetContext;
  facts: Readonly<Record<string, ContinuityFactValue>>;
  comparators: ReadonlyMap<string, ContinuityComparator>;
  scope: StudentLifeEventScope;
};

export type ContinuityConditionEvaluation = {
  /** `null` = inconclusivo: faltou definição para decidir. */
  satisfied: boolean | null;
  diagnostics: readonly StudentLifeDiagnostic[];
};

export type ContinuityConditionEvaluator = (
  context: ContinuityConditionContext,
  condition: ContinuityCondition,
) => ContinuityConditionEvaluation;

const factEvaluator: ContinuityConditionEvaluator = (context, condition) => {
  const factKey = condition.parameters["factKey"];
  const comparatorId = condition.parameters["comparatorId"];
  if (typeof factKey !== "string" || typeof comparatorId !== "string") {
    return {
      satisfied: null,
      diagnostics: [
        diagnostic(CODES.conditionEvaluatorMissing, TYPES.policy, "blocker", context.scope, {
          parameters: { conditionKindId: condition.conditionKindId },
        }),
      ],
    };
  }
  const comparator = context.comparators.get(comparatorId);
  if (!comparator) {
    return {
      satisfied: null,
      diagnostics: [
        diagnostic(CODES.comparatorMissing, TYPES.policy, "blocker", context.scope, {
          parameters: { comparatorId },
        }),
      ],
    };
  }
  const actual = context.facts[factKey];
  const expected = condition.parameters["value"];
  const diagnostics: StudentLifeDiagnostic[] = [];
  if (
    (actual === undefined || actual === null) &&
    comparatorId !== CONTINUITY_COMPARATOR_IDS.absent &&
    comparatorId !== CONTINUITY_COMPARATOR_IDS.exists
  ) {
    // Ausência permanece ausência: nunca satisfaz por presunção.
    diagnostics.push(
      diagnostic(CODES.factUnavailable, TYPES.origin, "info", context.scope, {
        parameters: { factKey },
      }),
    );
    return { satisfied: false, diagnostics };
  }
  return { satisfied: comparator(actual, expected ?? undefined), diagnostics };
};

const dimensionCountEvaluator: ContinuityConditionEvaluator = (context, condition) => {
  const countComparatorId = condition.parameters["countComparatorId"];
  if (typeof countComparatorId !== "string") {
    return {
      satisfied: null,
      diagnostics: [
        diagnostic(CODES.conditionEvaluatorMissing, TYPES.policy, "blocker", context.scope, {
          parameters: { conditionKindId: condition.conditionKindId },
        }),
      ],
    };
  }
  const countComparator = context.comparators.get(countComparatorId);
  if (!countComparator) {
    return {
      satisfied: null,
      diagnostics: [
        diagnostic(CODES.comparatorMissing, TYPES.policy, "blocker", context.scope, {
          parameters: { comparatorId: countComparatorId },
        }),
      ],
    };
  }
  const selection = selectDimensions(
    context.origin.dimensions,
    condition.parameters,
    context.comparators,
  );
  if (selection.comparatorMissing) {
    return {
      satisfied: null,
      diagnostics: [
        diagnostic(CODES.comparatorMissing, TYPES.policy, "blocker", context.scope, {
          parameters: { comparatorId: selection.comparatorMissing },
        }),
      ],
    };
  }
  const expected = condition.parameters["countValue"];
  return { satisfied: countComparator(selection.selected.length, expected ?? undefined), diagnostics: [] };
};

export function createContinuityConditionRegistry(): Map<string, ContinuityConditionEvaluator> {
  return new Map<string, ContinuityConditionEvaluator>([
    [CONTINUITY_CONDITION_KIND_IDS.fact, factEvaluator],
    [CONTINUITY_CONDITION_KIND_IDS.dimensionCount, dimensionCountEvaluator],
  ]);
}

export function registerContinuityConditionEvaluator(
  registry: Map<string, ContinuityConditionEvaluator>,
  conditionKindId: string,
  evaluator: ContinuityConditionEvaluator,
): void {
  registry.set(conditionKindId, evaluator);
}

// ---------------------------------------------------------- Combinadores

export const CONTINUITY_COMBINATOR_IDS = { all: "todas", any: "qualquer" } as const;

export type ContinuityCombinator = (results: readonly (boolean | null)[]) => boolean | null;

export function createContinuityCombinatorRegistry(): Map<string, ContinuityCombinator> {
  return new Map<string, ContinuityCombinator>([
    [
      CONTINUITY_COMBINATOR_IDS.all,
      (results) => {
        if (results.some((item) => item === false)) return false;
        if (results.some((item) => item === null)) return null;
        return true;
      },
    ],
    [
      CONTINUITY_COMBINATOR_IDS.any,
      (results) => {
        if (results.some((item) => item === true)) return true;
        if (results.some((item) => item === null)) return null;
        return false;
      },
    ],
  ]);
}

// -------------------------------------------------- Executores de consequência

export const CONTINUITY_CONSEQUENCE_EXECUTOR_IDS = {
  publishResolution: "publicar-resolucao-de-continuidade",
  constituteObligation: "constituir-obrigacao-de-continuidade",
  requireEquivalence: "exigir-analise-de-equivalencia",
  registerIssue: "registrar-pendencia-de-continuidade",
} as const;

export type ContinuityConsequenceContext = {
  evaluationId: InternalId;
  origin: NormalizedAcademicOrigin;
  target: ContinuityTargetContext;
  policy: AcademicContinuityPolicy;
  effectiveDate: string;
  facts: Readonly<Record<string, ContinuityFactValue>>;
  comparators: ReadonlyMap<string, ContinuityComparator>;
  scope: StudentLifeEventScope;
  /** Sequência para identificadores determinísticos dos produtos. */
  sequence: () => number;
};

export type ContinuityConsequenceOutcome = {
  consequenceDefinitionId: string;
  executorId: string;
  status: "aplicado" | "inconclusivo" | "erro-de-configuracao";
  resolution?: AcademicContinuationResolution;
  obligationDrafts: readonly ContinuityObligationDraft[];
  equivalenceRequests: readonly EquivalenceAnalysisRequest[];
  issues: readonly ContinuityPendingIssue[];
  diagnostics: readonly StudentLifeDiagnostic[];
};

export type ContinuityConsequenceExecutor = (
  context: ContinuityConsequenceContext,
  declaration: ContinuityConsequenceDeclaration,
) => ContinuityConsequenceOutcome;

function emptyOutcome(
  declaration: ContinuityConsequenceDeclaration,
  status: ContinuityConsequenceOutcome["status"],
  diagnostics: readonly StudentLifeDiagnostic[] = [],
  extra: Partial<ContinuityConsequenceOutcome> = {},
): ContinuityConsequenceOutcome {
  return {
    consequenceDefinitionId: declaration.consequenceDefinitionId,
    executorId: declaration.executorId,
    status,
    obligationDrafts: [],
    equivalenceRequests: [],
    issues: [],
    diagnostics,
    ...extra,
  };
}

function textParam(
  declaration: ContinuityConsequenceDeclaration,
  key: string,
): string | undefined {
  const value = declaration.parameters?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function listParam(
  declaration: ContinuityConsequenceDeclaration,
  key: string,
): readonly string[] | undefined {
  const raw = textParam(declaration, key);
  if (!raw) return undefined;
  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : undefined;
}

const publishResolutionExecutor: ContinuityConsequenceExecutor = (context, declaration) => {
  const stateId = textParam(declaration, "resolutionStateDefinitionId");
  if (!stateId) {
    return emptyOutcome(declaration, "erro-de-configuracao", [
      diagnostic(CODES.resolutionUndeclared, TYPES.consequence, "blocker", context.scope, {
        parameters: { consequenceDefinitionId: declaration.consequenceDefinitionId },
      }),
    ]);
  }
  if (!context.policy.resolutionStateDefinitionIds.includes(stateId)) {
    return emptyOutcome(declaration, "erro-de-configuracao", [
      diagnostic(CODES.resolutionStateUndeclared, TYPES.consequence, "blocker", context.scope, {
        parameters: { resolutionStateDefinitionId: stateId },
      }),
    ]);
  }
  const conditionIds = listParam(declaration, "conditionDefinitionIds");
  const note = textParam(declaration, "note");
  const resolution: AcademicContinuationResolution = {
    resolutionId: `${context.evaluationId}-res-${context.sequence()}`,
    targetContext: context.target,
    resolutionStateDefinitionId: stateId,
    ...(conditionIds ? { conditionDefinitionIds: conditionIds } : {}),
    ...(note ? { note } : {}),
  };
  return emptyOutcome(declaration, "aplicado", [], { resolution });
};

const constituteObligationExecutor: ContinuityConsequenceExecutor = (context, declaration) => {
  const natureId = textParam(declaration, "obligationNatureDefinitionId");
  const statusId = textParam(declaration, "initialStatusDefinitionId");
  const diagnostics: StudentLifeDiagnostic[] = [];
  if (!natureId || !context.policy.obligationNatureDefinitionIds.includes(natureId)) {
    diagnostics.push(
      diagnostic(CODES.obligationNatureUndeclared, TYPES.obligation, "blocker", context.scope, {
        parameters: { obligationNatureDefinitionId: natureId ?? null },
      }),
    );
  }
  if (!statusId || !context.policy.obligationStatusDefinitionIds.includes(statusId)) {
    diagnostics.push(
      diagnostic(CODES.obligationStatusUndeclared, TYPES.obligation, "blocker", context.scope, {
        parameters: { statusDefinitionId: statusId ?? null },
      }),
    );
  }
  if (!natureId || !statusId || diagnostics.length > 0) {
    return emptyOutcome(declaration, "erro-de-configuracao", diagnostics);
  }
  const validFrom = textParam(declaration, "validFrom") ?? context.effectiveDate;
  const reasonDefinitionId = textParam(declaration, "reasonDefinitionId");
  const explicitReferenceId = textParam(declaration, "curriculumReferenceId");
  const explicitReferenceKind = textParam(declaration, "curriculumReferenceKindId");

  const references: CurriculumReference[] = [];
  if (explicitReferenceId && explicitReferenceKind) {
    references.push({ referenceKindId: explicitReferenceKind, referenceId: explicitReferenceId });
  } else {
    const selection = selectDimensions(
      context.origin.dimensions,
      declaration.parameters ?? {},
      context.comparators,
    );
    if (selection.comparatorMissing) {
      return emptyOutcome(declaration, "erro-de-configuracao", [
        diagnostic(CODES.comparatorMissing, TYPES.consequence, "blocker", context.scope, {
          parameters: { comparatorId: selection.comparatorMissing },
        }),
      ]);
    }
    for (const dimension of selection.selected) {
      references.push(
        dimension.curriculumReference ?? {
          referenceKindId: dimension.dimensionKindId,
          referenceId: dimension.dimensionId,
          ...(dimension.labelSnapshot ? { labelSnapshot: dimension.labelSnapshot } : {}),
        },
      );
    }
  }
  if (references.length === 0) {
    return emptyOutcome(declaration, "inconclusivo", [
      diagnostic(CODES.consequenceInconclusive, TYPES.consequence, "warning", context.scope, {
        parameters: { consequenceDefinitionId: declaration.consequenceDefinitionId },
      }),
    ]);
  }
  const drafts: ContinuityObligationDraft[] = references.map((reference) => ({
    obligationNatureDefinitionId: natureId,
    curriculumReference: reference,
    initialStatusDefinitionId: statusId,
    validFrom,
    ...(reasonDefinitionId ? { reasonDefinitionId } : {}),
  }));
  return emptyOutcome(declaration, "aplicado", [], { obligationDrafts: drafts });
};

const requireEquivalenceExecutor: ContinuityConsequenceExecutor = (context, declaration) => {
  const request: EquivalenceAnalysisRequest = {
    requestId: `${context.evaluationId}-eqv-${context.sequence()}`,
    originId: context.origin.originId,
    ...(context.target.targetCurriculumReference
      ? { targetCurriculumReference: context.target.targetCurriculumReference }
      : {}),
    ...(textParam(declaration, "requiredCapacityDefinitionId")
      ? { requiredCapacityDefinitionId: textParam(declaration, "requiredCapacityDefinitionId")! }
      : {}),
    ...(textParam(declaration, "note") ? { note: textParam(declaration, "note")! } : {}),
  };
  return emptyOutcome(declaration, "aplicado", [], { equivalenceRequests: [request] });
};

const registerIssueExecutor: ContinuityConsequenceExecutor = (context, declaration) => {
  const issueTypeId = textParam(declaration, "issueTypeDefinitionId");
  if (!issueTypeId || !context.policy.issueTypeDefinitionIds.includes(issueTypeId)) {
    return emptyOutcome(declaration, "erro-de-configuracao", [
      diagnostic(CODES.issueTypeUndeclared, TYPES.consequence, "blocker", context.scope, {
        parameters: { issueTypeDefinitionId: issueTypeId ?? null },
      }),
    ]);
  }
  const deadline = textParam(declaration, "deadlineDate");
  const issue: ContinuityPendingIssue = {
    issueId: `${context.evaluationId}-pend-${context.sequence()}`,
    issueTypeDefinitionId: issueTypeId,
    ...(listParam(declaration, "missingFactKeys")
      ? { missingFactKeys: listParam(declaration, "missingFactKeys")! }
      : {}),
    ...(listParam(declaration, "requiredDocumentTypeDefinitionIds")
      ? {
          requiredDocumentTypeDefinitionIds: listParam(
            declaration,
            "requiredDocumentTypeDefinitionIds",
          )!,
        }
      : {}),
    ...(textParam(declaration, "responsibleCapacityDefinitionId")
      ? {
          responsibleCapacityDefinitionId: textParam(
            declaration,
            "responsibleCapacityDefinitionId",
          )!,
        }
      : {}),
    ...(deadline ? { deadlineDate: deadline } : {}),
    ...(textParam(declaration, "note") ? { note: textParam(declaration, "note")! } : {}),
  };
  return emptyOutcome(declaration, "aplicado", [], { issues: [issue] });
};

export function createContinuityConsequenceRegistry(): Map<string, ContinuityConsequenceExecutor> {
  return new Map<string, ContinuityConsequenceExecutor>([
    [CONTINUITY_CONSEQUENCE_EXECUTOR_IDS.publishResolution, publishResolutionExecutor],
    [CONTINUITY_CONSEQUENCE_EXECUTOR_IDS.constituteObligation, constituteObligationExecutor],
    [CONTINUITY_CONSEQUENCE_EXECUTOR_IDS.requireEquivalence, requireEquivalenceExecutor],
    [CONTINUITY_CONSEQUENCE_EXECUTOR_IDS.registerIssue, registerIssueExecutor],
  ]);
}

export function registerContinuityConsequenceExecutor(
  registry: Map<string, ContinuityConsequenceExecutor>,
  executorId: string,
  executor: ContinuityConsequenceExecutor,
): void {
  registry.set(executorId, executor);
}

// ------------------------------------------------------------- Avaliação

export type ContinuityEvaluationInput = {
  evaluationId: InternalId;
  origin: NormalizedAcademicOrigin;
  target: ContinuityTargetContext;
  policy: AcademicContinuityPolicy;
  effectiveDate: string;
  provenance: StudentLifeProvenance;
  supersedesEvaluationId?: InternalId;
  comparators?: ReadonlyMap<string, ContinuityComparator>;
  conditionEvaluators?: ReadonlyMap<string, ContinuityConditionEvaluator>;
  combinators?: ReadonlyMap<string, ContinuityCombinator>;
  consequenceExecutors?: ReadonlyMap<string, ContinuityConsequenceExecutor>;
};

function orderedRules(policy: AcademicContinuityPolicy): readonly ContinuityRule[] {
  return [...policy.rules].sort((a, b) => a.order - b.order);
}

/**
 * Avalia a continuidade do percurso. NÃO cria matrícula, participação ou
 * enturmação: devolve resolução, obrigações propostas, pedidos de equivalência,
 * pendências e diagnósticos, sempre com a política e a versão que os produziram.
 */
export function evaluateContinuity(input: ContinuityEvaluationInput): ContinuityEvaluation {
  const comparators = input.comparators ?? createContinuityComparatorRegistry();
  const conditionEvaluators = input.conditionEvaluators ?? createContinuityConditionRegistry();
  const combinators = input.combinators ?? createContinuityCombinatorRegistry();
  const executors = input.consequenceExecutors ?? createContinuityConsequenceRegistry();

  const scope: StudentLifeEventScope = { studentId: input.origin.studentId };
  const facts = continuityFactMap(input.origin, input.target);
  const diagnostics: StudentLifeDiagnostic[] = [];

  if (!input.policy.homologated) {
    diagnostics.push(
      diagnostic(CODES.policyNotHomologated, TYPES.policy, "blocker", scope, {
        parameters: { policyId: input.policy.policyId, policyVersion: input.policy.policyVersion },
      }),
    );
  }
  if (
    input.effectiveDate < input.policy.validFrom ||
    (input.policy.validUntil != null && input.effectiveDate > input.policy.validUntil)
  ) {
    diagnostics.push(
      diagnostic(CODES.policyOutOfValidity, TYPES.policy, "blocker", scope, {
        parameters: { effectiveDate: input.effectiveDate },
      }),
    );
  }
  if (!input.origin.resolutionReference) {
    diagnostics.push(
      diagnostic(CODES.originResolutionAbsent, TYPES.origin, "info", scope, {
        parameters: { originId: input.origin.originId },
      }),
    );
  }

  let counter = 0;
  const sequence = () => {
    counter += 1;
    return counter;
  };
  const consequenceContext: ContinuityConsequenceContext = {
    evaluationId: input.evaluationId,
    origin: input.origin,
    target: input.target,
    policy: input.policy,
    effectiveDate: input.effectiveDate,
    facts,
    comparators,
    scope,
    sequence,
  };
  const conditionContext: ContinuityConditionContext = {
    origin: input.origin,
    target: input.target,
    facts,
    comparators,
    scope,
  };

  const appliedRuleIds: string[] = [];
  const obligationDrafts: ContinuityObligationDraft[] = [];
  const equivalenceRequests: EquivalenceAnalysisRequest[] = [];
  const issues: ContinuityPendingIssue[] = [];
  let resolution: AcademicContinuationResolution | null = null;

  for (const rule of orderedRules(input.policy)) {
    const combinator = combinators.get(rule.conditionCombinatorId);
    if (!combinator) {
      diagnostics.push(
        diagnostic(CODES.combinatorMissing, TYPES.policy, "blocker", scope, {
          parameters: { combinatorId: rule.conditionCombinatorId, ruleId: rule.ruleId },
        }),
      );
      continue;
    }
    const results: (boolean | null)[] = [];
    for (const condition of rule.conditions) {
      const evaluator = conditionEvaluators.get(condition.conditionKindId);
      if (!evaluator) {
        diagnostics.push(
          diagnostic(CODES.conditionEvaluatorMissing, TYPES.policy, "blocker", scope, {
            parameters: { conditionKindId: condition.conditionKindId, ruleId: rule.ruleId },
          }),
        );
        results.push(null);
        continue;
      }
      const evaluation = evaluator(conditionContext, condition);
      diagnostics.push(...evaluation.diagnostics);
      results.push(evaluation.satisfied);
    }
    const matched = rule.conditions.length === 0 ? true : combinator(results);
    if (matched !== true) continue;

    appliedRuleIds.push(rule.ruleId);
    for (const declaration of rule.consequences) {
      const executor = executors.get(declaration.executorId);
      if (!executor) {
        diagnostics.push(
          diagnostic(CODES.consequenceExecutorMissing, TYPES.consequence, "blocker", scope, {
            parameters: { executorId: declaration.executorId, ruleId: rule.ruleId },
          }),
        );
        continue;
      }
      const outcome = executor(consequenceContext, declaration);
      diagnostics.push(...outcome.diagnostics);
      if (outcome.resolution && resolution === null) resolution = outcome.resolution;
      obligationDrafts.push(...outcome.obligationDrafts);
      equivalenceRequests.push(...outcome.equivalenceRequests);
      issues.push(...outcome.issues);
    }
    if (rule.stopOnMatch) break;
  }

  if (appliedRuleIds.length === 0) {
    diagnostics.push(
      diagnostic(CODES.noRuleMatched, TYPES.policy, "warning", scope, {
        parameters: { policyId: input.policy.policyId, policyVersion: input.policy.policyVersion },
      }),
    );
  }
  if (resolution === null) {
    diagnostics.push(
      diagnostic(CODES.resolutionUndeclared, TYPES.policy, "warning", scope, {
        parameters: { targetContextId: input.target.targetContextId },
      }),
    );
  }

  return {
    evaluationId: input.evaluationId,
    studentId: input.origin.studentId,
    effectiveDate: input.effectiveDate,
    originReference: {
      originId: input.origin.originId,
      sourceTypeDefinitionId: input.origin.sourceTypeDefinitionId,
      sourceSchemaVersion: input.origin.sourceSchemaVersion,
      sourceReference: input.origin.sourceReference,
      ...(input.origin.resolutionReference
        ? { resolutionReference: input.origin.resolutionReference }
        : {}),
    },
    targetContext: input.target,
    policyReference: { policyId: input.policy.policyId, policyVersion: input.policy.policyVersion },
    appliedRuleIds,
    resolution,
    obligationDrafts,
    equivalenceRequests,
    issues,
    diagnostics,
    ...(input.supersedesEvaluationId ? { supersedesEvaluationId: input.supersedesEvaluationId } : {}),
    provenance: input.provenance,
  };
}
