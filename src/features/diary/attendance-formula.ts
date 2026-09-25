/**
 * Frequência DECLARATIVA (saneamento pós-12I, refinamento 3).
 *
 * A frequência do SIGEM não é `por-unidades | por-minutos`. Uma fórmula de
 * frequência é uma CONFIGURAÇÃO que declara, de forma estruturada:
 *
 *   - universo/denominador (medidas que o compõem);
 *   - medidas que compõem o numerador;
 *   - unidade utilizada (identificador configurável);
 *   - dimensão/escopo de apuração (identificador configurável);
 *   - agregação entre escopos;
 *   - tratamento configurado de ocorrências/justificativas;
 *   - precisão e arredondamento, quando houver regra;
 *   - comportamento diante de dado incompleto.
 *
 * O motor conhece apenas primitivas: somar medidas, dividir, tratar ausência de
 * dado e agregar. Não conhece etapa, modalidade, segmento, patamar mínimo nem
 * efeito de justificativa. Os fatos brutos (presenças, ausências, aplicáveis,
 * minutos) NUNCA são substituídos pela proporção: esta é derivação reproduzível.
 */
import type { AttendancePolicyStatus } from "./attendance-closing-types";

// ------------------------------------------------------------------ Medidas

/**
 * Medidas atômicas disponíveis à fórmula. É um dicionário aberto: novas
 * medidas entram como dados, sem alteração do avaliador.
 */
export type AttendanceMeasures = Record<string, number | null>;

export type AttendanceMeasureTerm = {
  measureId: string;
  /** Sinal do termo na soma. Ausente = soma. */
  sign?: "soma" | "subtracao";
};

/**
 * Tratamento configurado das ocorrências registradas no prontuário. Nenhum
 * efeito é presumido: sem tratamento declarado a ocorrência não altera nada.
 */
export type AttendanceOccurrenceTreatment = {
  /** Tipo de ocorrência alcançado. Ausente = qualquer ocorrência registrada. */
  occurrenceTypeId?: string;
  /** Medida que representa as unidades alcançadas por essas ocorrências. */
  measureId: string;
  effect: "sem-efeito" | "somar-ao-numerador" | "remover-do-denominador";
};

export type AttendanceRounding = {
  decimals: number;
  /** Modo de arredondamento configurado (identificador aberto). */
  mode: string;
};

/** Comportamento diante de medida indisponível. Nunca vira zero. */
export type AttendanceIncompleteDataBehavior =
  | "impede-conclusao"
  | "materializa-com-o-disponivel";

export type AttendanceFrequencyFormula = {
  id: string;
  version: number;
  label: string;
  description?: string;
  status: AttendancePolicyStatus;
  /** Unidade utilizada (ex.: "unidades", "minutos", ou outra cadastrada). */
  unitId: string;
  /** Dimensão de apuração (ex.: "ciclo", "componente-curricular", "turno"). */
  scopeDimensionId: string;
  /** Agregação entre escopos, quando a fórmula é apurada em vários. */
  aggregation: string;
  denominator: readonly AttendanceMeasureTerm[];
  numerator: readonly AttendanceMeasureTerm[];
  occurrenceTreatments?: readonly AttendanceOccurrenceTreatment[];
  precision?: AttendanceRounding | null;
  incompleteData: AttendanceIncompleteDataBehavior;
  /** Fato analítico materializado por esta fórmula. */
  resultFactId: string;
  note?: string;
};

// --------------------------------------------------------------- Avaliação

export type AttendanceTermTrace = {
  measureId: string;
  sign: "soma" | "subtracao";
  value: number | null;
  origin: "declarado" | "tratamento-de-ocorrencia";
};

export type AttendanceFormulaEvaluation = {
  formulaId: string;
  formulaVersion: number;
  scopeDimensionId: string;
  unitId: string;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  unavailableReason?: string;
  algorithm: string;
  numeratorTrace: AttendanceTermTrace[];
  denominatorTrace: AttendanceTermTrace[];
};

const roundings: Record<string, (value: number, decimals: number) => number> = {
  "meio-para-cima": (value, decimals) => {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  },
  truncamento: (value, decimals) => {
    const factor = 10 ** decimals;
    return Math.trunc(value * factor) / factor;
  },
};

const sumTerms = (
  terms: readonly AttendanceMeasureTerm[],
  measures: AttendanceMeasures,
  origin: AttendanceTermTrace["origin"],
): { total: number | null; trace: AttendanceTermTrace[] } => {
  const trace: AttendanceTermTrace[] = [];
  let total: number | null = 0;
  for (const term of terms) {
    const raw = Object.prototype.hasOwnProperty.call(measures, term.measureId)
      ? measures[term.measureId]
      : null;
    const value = raw === undefined ? null : raw;
    const sign = term.sign ?? "soma";
    trace.push({ measureId: term.measureId, sign, value, origin });
    if (value === null) total = null;
    else if (total !== null) total += sign === "subtracao" ? -value : value;
  }
  return { total, trace };
};

/**
 * Avalia UMA fórmula declarada sobre as medidas de UM escopo. Não conhece
 * patamar, nem etapa, nem modalidade.
 */
export function evaluateAttendanceFormula(args: {
  formula: AttendanceFrequencyFormula;
  measures: AttendanceMeasures;
  scopeDimensionId?: string;
}): AttendanceFormulaEvaluation {
  const { formula, measures } = args;

  const numeratorTerms = [...formula.numerator];
  const denominatorTerms = [...formula.denominator];
  const extraNumerator: AttendanceMeasureTerm[] = [];
  const extraDenominator: AttendanceMeasureTerm[] = [];

  for (const treatment of formula.occurrenceTreatments ?? []) {
    if (treatment.effect === "somar-ao-numerador")
      extraNumerator.push({ measureId: treatment.measureId });
    if (treatment.effect === "remover-do-denominador")
      extraDenominator.push({ measureId: treatment.measureId, sign: "subtracao" });
  }

  const numerator = sumTerms(numeratorTerms, measures, "declarado");
  const numeratorExtra = sumTerms(extraNumerator, measures, "tratamento-de-ocorrencia");
  const denominator = sumTerms(denominatorTerms, measures, "declarado");
  const denominatorExtra = sumTerms(extraDenominator, measures, "tratamento-de-ocorrencia");

  const numeratorTrace = [...numerator.trace, ...numeratorExtra.trace];
  const denominatorTrace = [...denominator.trace, ...denominatorExtra.trace];

  const combine = (a: number | null, b: number | null) =>
    a === null || b === null ? null : a + b;
  const numeratorTotal = combine(numerator.total, numeratorExtra.total);
  const denominatorTotal = combine(denominator.total, denominatorExtra.total);

  const algorithm = `fórmula declarada ${formula.id}@${formula.version}: (${numeratorTrace
    .map((t) => `${t.sign === "subtracao" ? "-" : "+"}${t.measureId}`)
    .join(" ")}) / (${denominatorTrace
    .map((t) => `${t.sign === "subtracao" ? "-" : "+"}${t.measureId}`)
    .join(" ")}) em ${formula.unitId}`;

  const base: Omit<AttendanceFormulaEvaluation, "value"> = {
    formulaId: formula.id,
    formulaVersion: formula.version,
    scopeDimensionId: args.scopeDimensionId ?? formula.scopeDimensionId,
    unitId: formula.unitId,
    numerator: numeratorTotal,
    denominator: denominatorTotal,
    algorithm,
    numeratorTrace,
    denominatorTrace,
  };

  const incomplete = numeratorTotal === null || denominatorTotal === null;
  if (incomplete)
    return {
      ...base,
      value: null,
      unavailableReason:
        formula.incompleteData === "impede-conclusao"
          ? "Medida indisponível: a fórmula declara que dado incompleto impede a conclusão. Nada é presumido como zero."
          : "Medida indisponível no escopo. A fórmula não produz valor sem a medida declarada.",
    };

  if (denominatorTotal === 0)
    return {
      ...base,
      value: null,
      unavailableReason: "Universo declarado igual a zero: não há proporção definida.",
    };

  const raw = numeratorTotal / denominatorTotal;
  const precision = formula.precision;
  const rounder = precision ? roundings[precision.mode] : undefined;
  const value = precision && rounder ? rounder(raw, precision.decimals) : raw;
  return { ...base, value };
}

// --------------------------------------------------------------- Agregação

export type AttendanceScopeMeasures = {
  scope: { kind: string; id: string; label?: string };
  measures: AttendanceMeasures;
};

export type AttendanceAggregatedEvaluation = {
  formulaId: string;
  formulaVersion: number;
  aggregation: string;
  value: number | null;
  unavailableReason?: string;
  algorithm: string;
  perScope: AttendanceFormulaEvaluation[];
};

/** Agregações suportadas como PRIMITIVAS. Novas entram como dado registrado. */
export const ATTENDANCE_AGGREGATIONS: Record<
  string,
  (evaluations: readonly AttendanceFormulaEvaluation[]) => number | null
> = {
  "escopo-unico": (evaluations) => evaluations[0]?.value ?? null,
  "soma-das-medidas": (evaluations) => {
    let numerator = 0;
    let denominator = 0;
    for (const evaluation of evaluations) {
      if (evaluation.numerator === null || evaluation.denominator === null) return null;
      numerator += evaluation.numerator;
      denominator += evaluation.denominator;
    }
    return denominator > 0 ? numerator / denominator : null;
  },
  "media-dos-escopos": (evaluations) => {
    const values = evaluations.map((evaluation) => evaluation.value);
    if (!values.length || values.some((value) => value === null)) return null;
    return (values as number[]).reduce((a, b) => a + b, 0) / values.length;
  },
  "menor-dos-escopos": (evaluations) => {
    const values = evaluations.map((evaluation) => evaluation.value);
    if (!values.length || values.some((value) => value === null)) return null;
    return Math.min(...(values as number[]));
  },
};

/**
 * Aplica a fórmula a todos os escopos cuja dimensão a política declarou e
 * agrega pelo modo configurado. Não existe bifurcação global × componente:
 * o escopo aplicável é filtrado por identificador de dimensão.
 */
export function evaluateAttendanceFormulaOverScopes(args: {
  formula: AttendanceFrequencyFormula;
  scopes: readonly AttendanceScopeMeasures[];
}): AttendanceAggregatedEvaluation {
  const { formula } = args;
  const applicable = args.scopes.filter((entry) => entry.scope.kind === formula.scopeDimensionId);
  const perScope = applicable.map((entry) =>
    evaluateAttendanceFormula({
      formula,
      measures: entry.measures,
      scopeDimensionId: entry.scope.kind,
    }),
  );
  const aggregator = ATTENDANCE_AGGREGATIONS[formula.aggregation];
  const algorithm = `${formula.aggregation} sobre ${perScope.length} escopo(s) da dimensão "${formula.scopeDimensionId}"`;

  if (!applicable.length)
    return {
      formulaId: formula.id,
      formulaVersion: formula.version,
      aggregation: formula.aggregation,
      value: null,
      unavailableReason: `Nenhum escopo da dimensão "${formula.scopeDimensionId}" foi materializado para esta fórmula.`,
      algorithm,
      perScope,
    };

  if (!aggregator)
    return {
      formulaId: formula.id,
      formulaVersion: formula.version,
      aggregation: formula.aggregation,
      value: null,
      unavailableReason: `Agregação "${formula.aggregation}" não está registrada como primitiva do motor.`,
      algorithm,
      perScope,
    };

  const value = aggregator(perScope);
  return {
    formulaId: formula.id,
    formulaVersion: formula.version,
    aggregation: formula.aggregation,
    value,
    ...(value === null
      ? {
          unavailableReason:
            "A agregação não produziu valor: há medida indisponível ou universo vazio. Nada é presumido.",
        }
      : {}),
    algorithm,
    perScope,
  };
}

export const ATTENDANCE_FORMULA_NOTE =
  "A frequência é apurada por fórmula declarada: universo, numerador, unidade, escopo, agregação, tratamento de ocorrências, precisão e comportamento diante de dado incompleto são configuração institucional. Unidades e minutos são apenas primitivas atualmente suportadas.";
