/**
 * Etapa 12K — REGISTRO DE AVALIADORES DE REQUISITO (ajuste 1).
 *
 * requisito configurado → avaliador registrado → resultado do diagnóstico
 *
 * Os avaliadores nativos abaixo são PRIMITIVAS: estado de fonte, cobertura de
 * fontes esperadas, disponibilidade de fato e ausência de pendência. Nenhum
 * deles conhece calendário, avaliação, frequência, colegiado, etapa, modalidade
 * ou segmento — tudo isso vem da configuração, em `sourceKind` e parâmetros.
 *
 * Uma nova exigência institucional registra um novo avaliador; o inspetor da 12K
 * permanece intacto.
 */
import type { StandingValue } from "@/features/assessment/academic-standing-types";
import type {
  ClosingExpectation,
  ClosingObservation,
  ClosingRequirement,
  ClosingSourceReference,
  RequirementDiagnosisStatus,
} from "./cycle-closing-types";

export type ClosingEvaluationContext = {
  classId: string;
  cycleId: string;
  unitId?: string;
  academicYearId?: string;
  studentIds: readonly string[];
  observations: readonly ClosingObservation[];
  expectations: readonly ClosingExpectation[];
  /** Estudante em foco, quando o requisito é apurado por estudante. */
  studentId?: string;
  now: string;
};

export type RequirementEvaluation = {
  status: RequirementDiagnosisStatus;
  reason: string;
  evidence?: readonly ClosingSourceReference[];
};

export type RequirementEvaluator = {
  id: string;
  label: string;
  description: string;
  evaluate: (args: {
    requirement: ClosingRequirement;
    context: ClosingEvaluationContext;
  }) => RequirementEvaluation;
};

// --------------------------------------------------------------- Auxiliares

const text = (value: StandingValue | readonly StandingValue[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

const list = (value: StandingValue | readonly StandingValue[] | undefined): string[] =>
  Array.isArray(value) ? value.map(String) : typeof value === "string" ? [value] : [];

const count = (value: StandingValue | readonly StandingValue[] | undefined): number | undefined =>
  typeof value === "number" ? value : undefined;

/**
 * Casamento genérico por dimensões. Só compara o que ambos os lados declaram:
 * dimensão ausente na fonte significa "não escopada", nunca divergência.
 */
const matchesContext = (
  dimensions: Readonly<Record<string, string | undefined>>,
  context: ClosingEvaluationContext,
) => {
  const known: Record<string, string | undefined> = {
    classId: context.classId,
    cycleId: context.cycleId,
    unitId: context.unitId,
    academicYearId: context.academicYearId,
    studentId: context.studentId,
  };
  for (const [key, value] of Object.entries(dimensions)) {
    if (value === undefined) continue;
    const expected = known[key];
    if (expected === undefined) continue;
    if (expected !== value) return false;
  }
  // Fato individual não pode ser lido como se fosse de outro estudante.
  if (dimensions['studentId'] && context.studentId && dimensions['studentId'] !== context.studentId)
    return false;
  return true;
};

const reference = (observation: ClosingObservation): ClosingSourceReference => ({
  kind: observation.sourceKind,
  id: observation.sourceId,
  ...(observation.version !== undefined ? { version: observation.version } : {}),
  ...(observation.state ? { state: observation.state } : {}),
  ...(observation.materializedAt ? { materializedAt: observation.materializedAt } : {}),
  ...(observation.label ? { label: observation.label } : {}),
});

const observationsOf = (kind: string, context: ClosingEvaluationContext) =>
  context.observations.filter(
    (item) => item.sourceKind === kind && matchesContext(item.dimensions, context),
  );

const expectationsOf = (kind: string, context: ClosingEvaluationContext) =>
  context.expectations.filter(
    (item) => item.sourceKind === kind && matchesContext(item.dimensions, context),
  );

const missingParameter = (name: string, requirement: ClosingRequirement): RequirementEvaluation => ({
  status: "erro-configuracao",
  reason: `O requisito "${requirement.label}" não declarou o parâmetro "${name}". Sem ele o avaliador não pode concluir, e nada é presumido como atendido.`,
});

// --------------------------------------------------------- Avaliadores nativos

/**
 * Estado de fonte: as fontes do tipo declarado precisam estar em um dos estados
 * aceitos pela configuração. Nenhum estado é conhecido pelo motor.
 */
const sourceStateEvaluator: RequirementEvaluator = {
  id: "estado-de-fonte",
  label: "Estado declarado da fonte",
  description:
    "Confere se as fontes do tipo informado estão em um dos estados aceitos pela configuração, na quantidade mínima declarada.",
  evaluate({ requirement, context }) {
    const kind = text(requirement.parameters?.['sourceKind']);
    if (!kind) return missingParameter("sourceKind", requirement);
    const accepted = list(requirement.parameters?.['acceptedStates']);
    if (!accepted.length) return missingParameter("acceptedStates", requirement);
    const minimum = count(requirement.parameters?.['minimumCount']);

    const found = observationsOf(kind, context);
    const expected = expectationsOf(kind, context);

    if (!found.length && !expected.length && minimum === undefined)
      return {
        status: "nao-aplicavel",
        reason: `Nenhuma fonte do tipo "${kind}" é esperada neste percurso: o requisito não se aplica.`,
      };

    if (!found.length)
      return {
        status: "nao-satisfeito",
        reason: `Nenhum registro do tipo "${kind}" foi encontrado, e ${
          expected.length ? `${expected.length} eram esperados` : "a configuração exige ao menos um"
        }.`,
      };

    const unknown = found.filter((item) => !item.state);
    if (unknown.length)
      return {
        status: "inconclusivo",
        reason: `${unknown.length} registro(s) do tipo "${kind}" não informam estado. Sem estado conhecido, o requisito fica inconclusivo — nunca atendido por omissão.`,
        evidence: unknown.map(reference),
      };

    const pending = found.filter((item) => !accepted.includes(item.state!));
    if (pending.length)
      return {
        status: "nao-satisfeito",
        reason: `${pending.length} registro(s) do tipo "${kind}" estão em estado não aceito pela política (${[
          ...new Set(pending.map((item) => item.state)),
        ].join(", ")}).`,
        evidence: pending.map(reference),
      };

    const satisfiedCount = found.length;
    const required = minimum ?? expected.length ?? 0;
    if (required && satisfiedCount < required)
      return {
        status: "nao-satisfeito",
        reason: `Foram encontrados ${satisfiedCount} registro(s) do tipo "${kind}", e a configuração exige ${required}.`,
        evidence: found.map(reference),
      };

    return {
      status: "satisfeito",
      reason: `${satisfiedCount} registro(s) do tipo "${kind}" em estado aceito pela política.`,
      evidence: found.map(reference),
    };
  },
};

/** Cobertura: toda fonte esperada pela cadeia precisa existir de fato. */
const coverageEvaluator: RequirementEvaluator = {
  id: "cobertura-de-fontes",
  label: "Cobertura das fontes esperadas",
  description:
    "Confere se cada fonte esperada pela cadeia (período, componente, estudante ou outra dimensão) possui registro correspondente.",
  evaluate({ requirement, context }) {
    const kind = text(requirement.parameters?.['sourceKind']);
    if (!kind) return missingParameter("sourceKind", requirement);
    const expected = expectationsOf(kind, context);
    if (!expected.length)
      return {
        status: "nao-aplicavel",
        reason: `A cadeia não declara fontes esperadas do tipo "${kind}" neste percurso.`,
      };
    const found = observationsOf(kind, context);
    const missing = expected.filter(
      (expectation) =>
        !found.some((item) =>
          Object.entries(expectation.dimensions).every(
            ([key, value]) => value === undefined || item.dimensions[key] === value,
          ),
        ),
    );
    if (missing.length)
      return {
        status: "nao-satisfeito",
        reason: `Faltam registros do tipo "${kind}" para: ${missing
          .map((item) => item.label)
          .join(", ")}.`,
      };
    return {
      status: "satisfeito",
      reason: `Todas as ${expected.length} fonte(s) esperadas do tipo "${kind}" possuem registro.`,
      evidence: found.map(reference),
    };
  },
};

/** Fato disponível: valor presente e não nulo. Ausência jamais vira zero. */
const factAvailabilityEvaluator: RequirementEvaluator = {
  id: "fato-disponivel",
  label: "Disponibilidade do fato",
  description:
    "Confere se o fato informado existe com valor disponível. Valor ausente torna o requisito inconclusivo, nunca atendido.",
  evaluate({ requirement, context }) {
    const factId = text(requirement.parameters?.['factId']);
    if (!factId) return missingParameter("factId", requirement);
    const kind = text(requirement.parameters?.['sourceKind']);
    const pool = kind ? observationsOf(kind, context) : context.observations.filter((item) => matchesContext(item.dimensions, context));
    const facts = pool.flatMap((item) =>
      (item.facts ?? [])
        .filter((fact) => fact.factId === factId)
        .map((fact) => ({ fact, observation: item })),
    );
    if (!facts.length)
      return {
        status: "nao-satisfeito",
        reason: `O fato "${factId}" não foi produzido por nenhuma fonte aplicável a este percurso.`,
      };
    const unavailable = facts.filter((entry) => entry.fact.value === null);
    if (unavailable.length)
      return {
        status: "inconclusivo",
        reason: `O fato "${factId}" existe, mas está indisponível: ${
          unavailable[0]!.fact.unavailableReason ?? "motivo não registrado"
        }. Dado ausente não é tratado como critério atendido.`,
        evidence: unavailable.map((entry) => reference(entry.observation)),
      };
    return {
      status: "satisfeito",
      reason: `O fato "${factId}" está disponível em ${facts.length} fonte(s), com proveniência preservada.`,
      evidence: facts.map((entry) => reference(entry.observation)),
    };
  },
};

/** Ausência de pendência: nenhuma fonte em estado declarado como pendente. */
const noPendingEvaluator: RequirementEvaluator = {
  id: "ausencia-de-pendencia",
  label: "Ausência de pendência declarada",
  description:
    "Confere se nenhuma fonte do tipo informado permanece em estado declarado como pendente pela configuração.",
  evaluate({ requirement, context }) {
    const kind = text(requirement.parameters?.['sourceKind']);
    if (!kind) return missingParameter("sourceKind", requirement);
    const pendingStates = list(requirement.parameters?.['pendingStates']);
    if (!pendingStates.length) return missingParameter("pendingStates", requirement);
    const found = observationsOf(kind, context);
    if (!found.length)
      return {
        status: "nao-aplicavel",
        reason: `Nenhum registro do tipo "${kind}" existe neste percurso: não há pendência a apurar.`,
      };
    const pending = found.filter((item) => item.state && pendingStates.includes(item.state));
    if (pending.length)
      return {
        status: "nao-satisfeito",
        reason: `${pending.length} registro(s) do tipo "${kind}" permanecem em estado pendente (${[
          ...new Set(pending.map((item) => item.state)),
        ].join(", ")}).`,
        evidence: pending.map(reference),
      };
    return {
      status: "satisfeito",
      reason: `Nenhum registro do tipo "${kind}" em estado pendente.`,
      evidence: found.map(reference),
    };
  },
};

export const nativeRequirementEvaluators: readonly RequirementEvaluator[] = [
  sourceStateEvaluator,
  coverageEvaluator,
  factAvailabilityEvaluator,
  noPendingEvaluator,
];

export function createRequirementEvaluatorRegistry(
  initial: readonly RequirementEvaluator[] = nativeRequirementEvaluators,
) {
  const evaluators = new Map(initial.map((item) => [item.id, item]));
  return {
    register(evaluator: RequirementEvaluator) {
      evaluators.set(evaluator.id, evaluator);
      return evaluator;
    },
    unregister(id: string) {
      evaluators.delete(id);
    },
    get: (id: string) => evaluators.get(id),
    list: () => [...evaluators.values()] as readonly RequirementEvaluator[],
  };
}

export type RequirementEvaluatorRegistry = ReturnType<typeof createRequirementEvaluatorRegistry>;

export const requirementEvaluatorRegistry = createRequirementEvaluatorRegistry();
