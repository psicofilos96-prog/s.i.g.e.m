/**
 * Etapa 13H — Motor declarativo de sinais de atenção.
 *
 *   fato + escopo + operador + parâmetro + composição → sinal configurado
 *
 * O motor conhece apenas primitivas: comparar um fato, contar fatos que
 * satisfazem outra condição e compor logicamente. Ele NÃO conhece frequência,
 * nota, componente, turma, ocorrência, transferência ou qualquer conceito da
 * rede — tudo entra por configuração e por avaliadores/comparadores registrados.
 *
 * Fato ausente, comparador desconhecido, escopo não avaliável ou definição não
 * homologada produzem resultado INCONCLUSIVO. Ausência nunca satisfaz condição.
 */
import {
  SIGNAL_OUTCOME,
  type GuidanceCondition,
  type GuidanceDiagnostic,
  type GuidanceFact,
  type GuidanceFactValue,
  type PedagogicalSignalOccurrence,
  type PedagogicalSubjectReference,
  type SignalDefinition,
  type SignalEvaluation,
  type SignalLifecycleEvent,
  type SignalOutcome,
} from "./guidance-types";

// ----------------------------------------------------------- Comparadores

export type GuidanceComparator = (input: {
  value: GuidanceFactValue;
  parameter: GuidanceFactValue | readonly GuidanceFactValue[] | undefined;
}) => boolean;

export type GuidanceComparatorRegistry = Map<string, GuidanceComparator>;

export const GUIDANCE_COMPARATOR_IDS = {
  lessThan: "menor-que",
  lessOrEqual: "menor-ou-igual-a",
  greaterThan: "maior-que",
  greaterOrEqual: "maior-ou-igual-a",
  equals: "igual-a",
  differs: "diferente-de",
  inSet: "pertence-ao-conjunto",
  isTrue: "e-verdadeiro",
  exists: "esta-disponivel",
} as const;

const asNumber = (value: GuidanceFactValue): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function createComparatorRegistry(): GuidanceComparatorRegistry {
  const registry: GuidanceComparatorRegistry = new Map();
  const numeric =
    (compare: (left: number, right: number) => boolean): GuidanceComparator =>
    ({ value, parameter }) => {
      const left = asNumber(value);
      const right = asNumber(
        Array.isArray(parameter) ? null : (parameter as GuidanceFactValue),
      );
      if (left === null || right === null) return false;
      return compare(left, right);
    };

  registry.set(GUIDANCE_COMPARATOR_IDS.lessThan, numeric((a, b) => a < b));
  registry.set(GUIDANCE_COMPARATOR_IDS.lessOrEqual, numeric((a, b) => a <= b));
  registry.set(GUIDANCE_COMPARATOR_IDS.greaterThan, numeric((a, b) => a > b));
  registry.set(GUIDANCE_COMPARATOR_IDS.greaterOrEqual, numeric((a, b) => a >= b));
  registry.set(GUIDANCE_COMPARATOR_IDS.equals, ({ value, parameter }) => value === parameter);
  registry.set(GUIDANCE_COMPARATOR_IDS.differs, ({ value, parameter }) => value !== parameter);
  registry.set(GUIDANCE_COMPARATOR_IDS.inSet, ({ value, parameter }) =>
    Array.isArray(parameter) ? parameter.includes(value) : false,
  );
  registry.set(GUIDANCE_COMPARATOR_IDS.isTrue, ({ value }) => value === true);
  registry.set(GUIDANCE_COMPARATOR_IDS.exists, ({ value }) => value !== null);
  return registry;
}

export function registerComparator(
  registry: GuidanceComparatorRegistry,
  comparatorId: string,
  comparator: GuidanceComparator,
): GuidanceComparatorRegistry {
  registry.set(comparatorId, comparator);
  return registry;
}

// -------------------------------------------------- Avaliadores de condição

/** Resultado tri-estado: o motor nunca converte inconclusivo em atendido. */
export type ConditionResult = {
  outcome: SignalOutcome;
  consideredFacts: readonly GuidanceFact[];
  diagnostics: readonly GuidanceDiagnostic[];
};

export type ConditionEvaluatorInput = {
  condition: GuidanceCondition;
  facts: readonly GuidanceFact[];
  comparators: GuidanceComparatorRegistry;
  evaluate: (condition: GuidanceCondition) => ConditionResult;
};

export type ConditionEvaluator = (input: ConditionEvaluatorInput) => ConditionResult;

export type ConditionEvaluatorRegistry = Map<string, ConditionEvaluator>;

export const GUIDANCE_CONDITION_KIND_IDS = {
  compareFact: "comparar-fato",
  countFactsSatisfying: "contar-fatos-que-satisfazem",
} as const;

export const GUIDANCE_COMBINATOR_IDS = {
  all: "todas-as-condicoes",
  any: "qualquer-condicao",
} as const;

const textParameter = (
  condition: GuidanceCondition,
  key: string,
): string | null => {
  const raw = condition.parameters[key];
  return typeof raw === "string" ? raw : null;
};

function compareFactEvaluator(input: ConditionEvaluatorInput): ConditionResult {
  const factKey = textParameter(input.condition, "factKey");
  const comparatorId = textParameter(input.condition, "comparatorId");
  const scopeKey = textParameter(input.condition, "scopeKey");
  if (!factKey || !comparatorId) {
    return {
      outcome: SIGNAL_OUTCOME.inconclusive,
      consideredFacts: [],
      diagnostics: [
        {
          diagnosticCode: "CONDICAO-INCOMPLETA",
          messageSnapshot:
            "A condição não declara o fato ou o comparador exigidos pela configuração.",
        },
      ],
    };
  }
  const comparator = input.comparators.get(comparatorId);
  if (!comparator) {
    return {
      outcome: SIGNAL_OUTCOME.inconclusive,
      consideredFacts: [],
      diagnostics: [
        {
          diagnosticCode: "COMPARADOR-NAO-REGISTRADO",
          messageSnapshot: `O comparador "${comparatorId}" não possui executor registrado: a condição permanece inconclusiva.`,
        },
      ],
    };
  }
  const matching = input.facts.filter(
    (fact) => fact.factKey === factKey && (!scopeKey || fact.scopeKey === scopeKey),
  );
  if (matching.length === 0) {
    return {
      outcome: SIGNAL_OUTCOME.inconclusive,
      consideredFacts: [],
      diagnostics: [
        {
          diagnosticCode: "FATO-AUSENTE",
          messageSnapshot: `O fato "${factKey}" não está disponível no escopo avaliado: nada é presumido.`,
        },
      ],
    };
  }
  const unavailable = matching.filter((fact) => fact.value === null);
  if (unavailable.length > 0) {
    return {
      outcome: SIGNAL_OUTCOME.inconclusive,
      consideredFacts: matching,
      diagnostics: unavailable.map((fact) => ({
        diagnosticCode: "FATO-INDISPONIVEL",
        messageSnapshot:
          fact.unavailableReason ??
          `O fato "${fact.factKey}" existe no catálogo, porém está indisponível no escopo avaliado.`,
      })),
    };
  }
  const parameter = input.condition.parameters["parameter"];
  const satisfied = matching.some((fact) => comparator({ value: fact.value, parameter }));
  return {
    outcome: satisfied ? SIGNAL_OUTCOME.satisfied : SIGNAL_OUTCOME.notSatisfied,
    consideredFacts: matching,
    diagnostics: [],
  };
}

function countFactsEvaluator(input: ConditionEvaluatorInput): ConditionResult {
  const factKey = textParameter(input.condition, "factKey");
  const innerComparatorId = textParameter(input.condition, "itemComparatorId");
  const countComparatorId = textParameter(input.condition, "countComparatorId");
  if (!factKey || !innerComparatorId || !countComparatorId) {
    return {
      outcome: SIGNAL_OUTCOME.inconclusive,
      consideredFacts: [],
      diagnostics: [
        {
          diagnosticCode: "CONDICAO-INCOMPLETA",
          messageSnapshot:
            "A condição de contagem não declara o fato ou os comparadores exigidos.",
        },
      ],
    };
  }
  const itemComparator = input.comparators.get(innerComparatorId);
  const countComparator = input.comparators.get(countComparatorId);
  if (!itemComparator || !countComparator) {
    return {
      outcome: SIGNAL_OUTCOME.inconclusive,
      consideredFacts: [],
      diagnostics: [
        {
          diagnosticCode: "COMPARADOR-NAO-REGISTRADO",
          messageSnapshot:
            "Um dos comparadores declarados pela condição de contagem não possui executor registrado.",
        },
      ],
    };
  }
  const matching = input.facts.filter((fact) => fact.factKey === factKey);
  if (matching.length === 0) {
    return {
      outcome: SIGNAL_OUTCOME.inconclusive,
      consideredFacts: [],
      diagnostics: [
        {
          diagnosticCode: "FATO-AUSENTE",
          messageSnapshot: `Nenhum fato "${factKey}" disponível para contagem: escopo não avaliável.`,
        },
      ],
    };
  }
  if (matching.some((fact) => fact.value === null)) {
    return {
      outcome: SIGNAL_OUTCOME.inconclusive,
      consideredFacts: matching,
      diagnostics: [
        {
          diagnosticCode: "FATO-INDISPONIVEL",
          messageSnapshot:
            "Há fato indisponível no conjunto contado: a contagem seria incompleta e permanece inconclusiva.",
        },
      ],
    };
  }
  const itemParameter = input.condition.parameters["itemParameter"];
  const count = matching.filter((fact) =>
    itemComparator({ value: fact.value, parameter: itemParameter }),
  ).length;
  const satisfied = countComparator({
    value: count,
    parameter: input.condition.parameters["countParameter"],
  });
  return {
    outcome: satisfied ? SIGNAL_OUTCOME.satisfied : SIGNAL_OUTCOME.notSatisfied,
    consideredFacts: matching,
    diagnostics: [],
  };
}

export function createConditionEvaluatorRegistry(): ConditionEvaluatorRegistry {
  const registry: ConditionEvaluatorRegistry = new Map();
  registry.set(GUIDANCE_CONDITION_KIND_IDS.compareFact, compareFactEvaluator);
  registry.set(GUIDANCE_CONDITION_KIND_IDS.countFactsSatisfying, countFactsEvaluator);
  return registry;
}

export function registerConditionEvaluator(
  registry: ConditionEvaluatorRegistry,
  conditionKindId: string,
  evaluator: ConditionEvaluator,
): ConditionEvaluatorRegistry {
  registry.set(conditionKindId, evaluator);
  return registry;
}

// --------------------------------------------------------------- Avaliação

function combine(
  combinatorId: string,
  results: readonly ConditionResult[],
): { outcome: SignalOutcome; diagnostics: readonly GuidanceDiagnostic[] } {
  const diagnostics = results.flatMap((result) => result.diagnostics);
  if (combinatorId === GUIDANCE_COMBINATOR_IDS.all) {
    if (results.some((result) => result.outcome === SIGNAL_OUTCOME.notSatisfied)) {
      return { outcome: SIGNAL_OUTCOME.notSatisfied, diagnostics };
    }
    if (results.some((result) => result.outcome === SIGNAL_OUTCOME.inconclusive)) {
      return { outcome: SIGNAL_OUTCOME.inconclusive, diagnostics };
    }
    return { outcome: SIGNAL_OUTCOME.satisfied, diagnostics };
  }
  if (combinatorId === GUIDANCE_COMBINATOR_IDS.any) {
    if (results.some((result) => result.outcome === SIGNAL_OUTCOME.satisfied)) {
      return { outcome: SIGNAL_OUTCOME.satisfied, diagnostics };
    }
    if (results.some((result) => result.outcome === SIGNAL_OUTCOME.inconclusive)) {
      return { outcome: SIGNAL_OUTCOME.inconclusive, diagnostics };
    }
    return { outcome: SIGNAL_OUTCOME.notSatisfied, diagnostics };
  }
  return {
    outcome: SIGNAL_OUTCOME.inconclusive,
    diagnostics: [
      ...diagnostics,
      {
        diagnosticCode: "COMBINADOR-NAO-REGISTRADO",
        messageSnapshot: `O combinador "${combinatorId}" não é reconhecido: a avaliação permanece inconclusiva.`,
      },
    ],
  };
}

/** DETECÇÃO. Não cria ocorrência, caso, rótulo nem consequência institucional. */
export function evaluateSignal(input: {
  definition: SignalDefinition;
  subjects: readonly PedagogicalSubjectReference[];
  evaluationContext: Readonly<Record<string, string>>;
  facts: readonly GuidanceFact[];
  evaluatedAt: string;
  evaluationId: string;
  comparators?: GuidanceComparatorRegistry;
  evaluators?: ConditionEvaluatorRegistry;
}): SignalEvaluation {
  const comparators = input.comparators ?? createComparatorRegistry();
  const evaluators = input.evaluators ?? createConditionEvaluatorRegistry();
  const diagnostics: GuidanceDiagnostic[] = [];

  const base = {
    evaluationId: input.evaluationId,
    signalDefinitionId: input.definition.signalDefinitionId,
    definitionVersion: input.definition.definitionVersion,
    subjects: input.subjects,
    evaluationContext: input.evaluationContext,
    evaluatedAt: input.evaluatedAt,
  };

  if (!input.definition.homologated) {
    diagnostics.push({
      diagnosticCode: "DEFINICAO-NAO-HOMOLOGADA",
      messageSnapshot:
        "A definição de sinal não está homologada: a condição pode ser apurada, mas não produz sinal institucional.",
    });
  }
  if (input.definition.conditions.length === 0) {
    return {
      ...base,
      outcome: SIGNAL_OUTCOME.inconclusive,
      consideredFacts: [],
      diagnostics: [
        ...diagnostics,
        {
          diagnosticCode: "DEFINICAO-SEM-CONDICAO",
          messageSnapshot: "A definição não declara condição alguma a apurar.",
        },
      ],
    };
  }

  const evaluate = (condition: GuidanceCondition): ConditionResult => {
    const evaluator = evaluators.get(condition.conditionKindId);
    if (!evaluator) {
      return {
        outcome: SIGNAL_OUTCOME.inconclusive,
        consideredFacts: [],
        diagnostics: [
          {
            diagnosticCode: "AVALIADOR-NAO-REGISTRADO",
            messageSnapshot: `A natureza de condição "${condition.conditionKindId}" não possui avaliador registrado.`,
          },
        ],
      };
    }
    return evaluator({ condition, facts: input.facts, comparators, evaluate });
  };

  const results = input.definition.conditions.map(evaluate);
  const combined = combine(input.definition.conditionCombinatorId, results);
  const consideredFacts = results.flatMap((result) => result.consideredFacts);

  let outcome = combined.outcome;
  if (
    !input.definition.homologated &&
    outcome === SIGNAL_OUTCOME.satisfied
  ) {
    // Condição apurada, porém sem norma homologada: não vira sinal institucional.
    outcome = SIGNAL_OUTCOME.inconclusive;
  }

  return {
    ...base,
    outcome,
    consideredFacts,
    diagnostics: [...diagnostics, ...combined.diagnostics],
  };
}

/**
 * MATERIALIZAÇÃO. Só a condição satisfeita por definição homologada produz
 * ocorrência histórica — e a ocorrência congela os fatos e a versão usada.
 */
export function materializeOccurrence(input: {
  evaluation: SignalEvaluation;
  definition: SignalDefinition;
  occurrenceId: string;
  materializedAt: string;
  scopeEntities: PedagogicalSignalOccurrence["scopeEntities"];
  provenance: PedagogicalSignalOccurrence["provenance"];
}): PedagogicalSignalOccurrence | null {
  if (input.evaluation.outcome !== SIGNAL_OUTCOME.satisfied) return null;
  return {
    occurrenceId: input.occurrenceId,
    signalDefinitionId: input.evaluation.signalDefinitionId,
    definitionVersion: input.evaluation.definitionVersion,
    evaluationId: input.evaluation.evaluationId,
    subjects: input.evaluation.subjects,
    evaluationContext: input.evaluation.evaluationContext,
    materializedAt: input.materializedAt,
    factSnapshot: input.evaluation.consideredFacts,
    sensitivityLevelDefinitionId: input.definition.sensitivityLevelDefinitionId,
    scopeEntities: input.scopeEntities,
    provenance: input.provenance,
  };
}

/** Estado vigente do sinal: PROJEÇÃO do ledger, nunca campo persistido. */
export function projectSignalLifecycleState(input: {
  occurrence: PedagogicalSignalOccurrence;
  definition: SignalDefinition;
  events: readonly SignalLifecycleEvent[];
  asOf: string;
}): {
  stateDefinitionId: string;
  relatedCaseIds: readonly string[];
  diagnostics: readonly GuidanceDiagnostic[];
} {
  const relevant = input.events
    .filter(
      (event) =>
        event.occurrenceId === input.occurrence.occurrenceId &&
        event.effectiveDate <= input.asOf,
    )
    .slice()
    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));

  const diagnostics: GuidanceDiagnostic[] = [];
  let state = input.definition.initialLifecycleStateDefinitionId;
  const relatedCaseIds: string[] = [];
  for (const event of relevant) {
    if (!input.definition.lifecycleStateDefinitionIds.includes(event.toStateDefinitionId)) {
      diagnostics.push({
        diagnosticCode: "ESTADO-NAO-CADASTRADO",
        messageSnapshot: `O estado "${event.toStateDefinitionId}" não consta na configuração da definição do sinal.`,
      });
      continue;
    }
    state = event.toStateDefinitionId;
    if (event.relatedCaseId && !relatedCaseIds.includes(event.relatedCaseId)) {
      relatedCaseIds.push(event.relatedCaseId);
    }
  }
  return { stateDefinitionId: state, relatedCaseIds, diagnostics };
}
