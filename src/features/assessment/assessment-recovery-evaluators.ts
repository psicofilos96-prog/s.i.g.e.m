/**
 * 6D.3.5.1 — Avaliadores canônicos de recuperação (prevalência + elegibilidade).
 *
 * A regra homologada REFERENCIA uma semântica registrada (`evaluatorId` +
 * parâmetros declarativos); o código implementa os avaliadores conhecidos. Não
 * existe fórmula executável dentro da regra, nem fallback: identificador
 * desconhecido, parâmetro obrigatório ausente ou fato indisponível produzem
 * resultado indeterminado — nunca "maior resultado" presumido.
 *
 * Elegibilidade ≠ autorização: nenhum avaliador recebe agente ou capacidade.
 */
import type {
  RecoveryEligibility,
  RecoveryEligibilityBasis,
  RecoveryRule,
  RuleParameter,
} from "./assessment-rule-types";

/** Referência declarativa a um avaliador registrado. */
export type RecoveryEvaluatorRef = {
  evaluatorId: string;
  parameters?: Readonly<Record<string, unknown>>;
};

// ------------------------------------------------------------- Prevalência

export type RecoveryEffectResult =
  | { status: "produced"; evaluatorId: string; value: number }
  | { status: "indeterminate"; evaluatorId: string | null; reason: string };

type EffectEvaluator = (original: number, recovery: number) => number;

/**
 * Registro de avaliadores de efeito. Os IDs coincidem com os valores legados de
 * `RecoveryPrevalence`, então o adaptador legado é a identidade.
 *
 * "media-entre-resultados": semântica canônica = média aritmética entre o
 * resultado original e o resultado da recuperação (exatamente dois termos,
 * pesos iguais). Não há evidência de agregação mais geral; não é média ponderada.
 */
const EFFECT_EVALUATORS: Readonly<Record<string, EffectEvaluator>> = {
  "maior-resultado": (o, r) => Math.max(o, r),
  "menor-resultado": (o, r) => Math.min(o, r),
  "substituicao-direta": (_o, r) => r,
  "ultimo-resultado": (_o, r) => r,
  "media-entre-resultados": (o, r) => Number(((o + r) / 2).toFixed(10)),
};

export const RECOVERY_EFFECT_EVALUATOR_IDS = Object.keys(EFFECT_EVALUATORS);

/** Adaptador explícito legado → canônico. Sem declaração, nada é presumido. */
export function recoveryEffectRef(rule: RecoveryRule | undefined): RecoveryEvaluatorRef | null {
  if (!rule) return null;
  if (rule.effect) return rule.effect;
  return rule.prevalence ? { evaluatorId: rule.prevalence } : null;
}

/** Sem resultado original, a recuperação é o próprio valor (comportamento 12F). */
export function evaluateRecoveryEffect(
  ref: RecoveryEvaluatorRef | null,
  original: number | null,
  recovery: number,
): RecoveryEffectResult {
  if (!ref)
    return { status: "indeterminate", evaluatorId: null, reason: "Efeito da recuperação pendente de definição normativa." };
  const evaluator = EFFECT_EVALUATORS[ref.evaluatorId];
  if (!evaluator)
    return {
      status: "indeterminate",
      evaluatorId: ref.evaluatorId,
      reason: "A regra referencia um avaliador de efeito não registrado. Nenhum efeito é presumido.",
    };
  return {
    status: "produced",
    evaluatorId: ref.evaluatorId,
    value: original === null ? recovery : evaluator(original, recovery),
  };
}

// ------------------------------------------------------------ Elegibilidade

/** Fatos que os avaliadores de elegibilidade podem consultar. Ausente = indisponível. */
export type RecoveryEligibilityFacts = {
  periodResult?: number | null;
  replaceableSubtotal?: number | null;
  cycleResult?: number | null;
  parameters?: readonly RuleParameter[];
};

export type RecoveryEligibilityProjection = {
  eligible: boolean | "indeterminate";
  evaluatorId: string | null;
  evaluatedFacts: Record<string, number | string>;
  reason: string;
};

type EligibilityEvaluator = (
  parameters: Readonly<Record<string, unknown>>,
  facts: RecoveryEligibilityFacts,
) => Omit<RecoveryEligibilityProjection, "evaluatorId">;

const BASIS_FACT: Record<RecoveryEligibilityBasis, keyof RecoveryEligibilityFacts> = {
  "resultado-do-periodo": "periodResult",
  "subtotal-substituivel": "replaceableSubtotal",
  "resultado-anual": "cycleResult",
};

const BASIS_TEXT: Record<RecoveryEligibilityBasis, string> = {
  "resultado-do-periodo": "Resultado do período",
  "subtotal-substituivel": "Subtotal substituível",
  "resultado-anual": "Resultado do ciclo",
};

const indeterminate = (reason: string, evaluatedFacts: Record<string, number | string> = {}) => ({
  eligible: "indeterminate" as const,
  evaluatedFacts,
  reason,
});

function belowThreshold(value: number, threshold: number, label: string, facts: Record<string, number | string>) {
  return value < threshold
    ? { eligible: true, evaluatedFacts: facts, reason: `${label} abaixo do patamar configurado.` }
    : { eligible: false, evaluatedFacts: facts, reason: `${label} igual ou acima do patamar configurado.` };
}

const ELIGIBILITY_EVALUATORS: Readonly<Record<string, EligibilityEvaluator>> = {
  "sem-restricao": () => ({
    eligible: true,
    evaluatedFacts: {},
    reason: "A regra homologada não restringe o acesso.",
  }),
  "limite-de-pontuacao": (p, facts) => {
    const threshold = p["threshold"];
    const basis = p["basis"] as RecoveryEligibilityBasis | undefined;
    if (typeof threshold !== "number")
      return indeterminate("Patamar de acesso à recuperação pendente de definição normativa.");
    if (!basis || !(basis in BASIS_FACT))
      return indeterminate("A regra não declara sobre qual valor o patamar de acesso é comparado.");
    const key = BASIS_FACT[basis];
    const value = facts[key];
    const evaluated: Record<string, number | string> = { threshold, basis };
    if (typeof value !== "number")
      return indeterminate(`${BASIS_TEXT[basis]} indisponível: a elegibilidade não é inferida.`, evaluated);
    return belowThreshold(value, threshold, BASIS_TEXT[basis], { ...evaluated, [key]: value });
  },
  "abaixo-do-minimo-anual": (p, facts) => {
    const parameterId = p["minimumParameterId"];
    const minimum =
      typeof parameterId === "string"
        ? facts.parameters?.find((x) => x.id === parameterId)?.value
        : undefined;
    if (typeof minimum !== "number")
      return indeterminate(
        "O direito deriva de um mínimo institucional que ainda não foi cadastrado. Nenhum número é presumido.",
      );
    const evaluated = { minimumParameterId: parameterId as string, minimum };
    if (typeof facts.cycleResult !== "number")
      return indeterminate("Resultado do ciclo indisponível: a elegibilidade não é inferida.", evaluated);
    const cycleResult = facts.cycleResult;
    return cycleResult < minimum
      ? { eligible: true, evaluatedFacts: { ...evaluated, cycleResult }, reason: "Resultado do ciclo abaixo do mínimo institucional." }
      : { eligible: false, evaluatedFacts: { ...evaluated, cycleResult }, reason: "Resultado do ciclo igual ou acima do mínimo institucional." };
  },
};

export const RECOVERY_ELIGIBILITY_EVALUATOR_IDS = Object.keys(ELIGIBILITY_EVALUATORS);

/** Adaptador explícito legado (`kind` + campos) → referência canônica. */
export function recoveryEligibilityRef(
  eligibility: RecoveryEligibility | RecoveryEvaluatorRef | undefined,
): RecoveryEvaluatorRef | null {
  if (!eligibility) return null;
  if ("evaluatorId" in eligibility) return eligibility;
  const { kind, ...parameters } = eligibility;
  return { evaluatorId: kind, parameters };
}

export function evaluateRecoveryEligibility(
  ref: RecoveryEvaluatorRef | null,
  facts: RecoveryEligibilityFacts,
): RecoveryEligibilityProjection {
  if (!ref)
    return {
      eligible: "indeterminate",
      evaluatorId: null,
      evaluatedFacts: {},
      reason: "Critério de acesso à recuperação pendente de definição normativa.",
    };
  const evaluator = ELIGIBILITY_EVALUATORS[ref.evaluatorId];
  if (!evaluator)
    return {
      eligible: "indeterminate",
      evaluatorId: ref.evaluatorId,
      evaluatedFacts: {},
      reason: "A regra referencia um avaliador de elegibilidade não registrado. Nada é presumido.",
    };
  return { evaluatorId: ref.evaluatorId, ...evaluator(ref.parameters ?? {}, facts) };
}
