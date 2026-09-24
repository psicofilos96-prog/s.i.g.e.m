/**
 * Etapa 12E — Motor configurável de composição e consolidação avaliativa.
 *
 * Função pura: Configuração × Períodos oficiais × Lançamentos → Composição.
 * O motor não conhece bimestres, escala 0–10, média 6, recuperação, frequência
 * mínima, conselho, dependência, etapas ou componentes. Sem modelo homologado,
 * nada é calculado: o retorno é bloqueio informativo.
 *
 * Invariantes:
 * 1. Acumulado parcial nunca adquire semântica de resultado anual ou final.
 * 2. Arredondamento só ocorre nos pontos de fechamento declarados pela
 *    configuração; entre eles a precisão interna é preservada.
 * 3. "Não registrado" nunca vira zero; é dado ausente com motivo.
 * 4. Valores administrativos (ex.: transferência externa) participam apenas se
 *    a configuração os admitir, preservando origem e metadados, sem conversão.
 */
import type { AssessmentConfiguration, AssessmentPeriod } from "./assessment-types";
import type {
  AggregationRule,
  AnnualComposition,
  CategoryComposition,
  CompositionCategory,
  CompositionEntryInput,
  CompositionModel,
  EntryOrigin,
  MissingRequirement,
  NumericStage,
  PeriodComposition,
  RoundingPoint,
  RoundingPolicy,
} from "./assessment-composition-types";

// ------------------------------------------------------------ Arredondamento

/**
 * Função centralizada de arredondamento. É o ÚNICO lugar do domínio que
 * arredonda. Nunca é chamada implicitamente: o chamador informa o ponto de
 * fechamento, e a política decide se aquele ponto arredonda.
 */
export function roundScore(
  value: number,
  policy: RoundingPolicy,
  point: RoundingPoint,
): NumericStage {
  const applies = policy.mode !== "sem-arredondamento" && policy.applyAt.includes(point);
  if (!applies) return { point, raw: value, value, rounded: false };
  return { point, raw: value, value: applyRounding(value, policy), rounded: true };
}

function applyRounding(value: number, policy: RoundingPolicy): number {
  switch (policy.mode) {
    case "passo": {
      const step = policy.step;
      if (!step || step <= 0) return value;
      return normalize(Math.round(value / step) * step);
    }
    case "truncar": {
      const f = factor(policy.decimals);
      return normalize(Math.trunc(value * f) / f);
    }
    case "meio-par": {
      const f = factor(policy.decimals);
      const scaled = value * f;
      const floor = Math.floor(scaled);
      const diff = scaled - floor;
      const half = Math.abs(diff - 0.5) < Number.EPSILON;
      const chosen = half ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(scaled);
      return normalize(chosen / f);
    }
    case "meio-acima": {
      const f = factor(policy.decimals);
      const scaled = value * f;
      const sign = scaled < 0 ? -1 : 1;
      return normalize((sign * Math.round(Math.abs(scaled) + Number.EPSILON)) / f);
    }
    default:
      return value;
  }
}

const factor = (decimals: number | undefined) => 10 ** Math.max(0, decimals ?? 0);
/** Remove ruído binário sem alterar a precisão significativa. */
const normalize = (n: number) => Number(n.toFixed(10));

// ---------------------------------------------------------------- Agregação

type Weighted = { value: number; weight: number; at?: string };

export function aggregate(rule: AggregationRule, values: Weighted[]): number | null {
  if (values.length === 0) return null;
  switch (rule.kind) {
    case "media-simples":
      return normalize(values.reduce((s, v) => s + v.value, 0) / values.length);
    case "media-ponderada": {
      const total = values.reduce((s, v) => s + v.weight, 0);
      if (total === 0) return null;
      return normalize(values.reduce((s, v) => s + v.value * v.weight, 0) / total);
    }
    case "soma":
      return normalize(values.reduce((s, v) => s + v.value, 0));
    case "maior-valor":
      return values.reduce((m, v) => (v.value > m ? v.value : m), values[0]!.value);
    case "ultimo-valor": {
      const sorted = [...values].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
      return sorted[sorted.length - 1]!.value;
    }
  }
}

// ------------------------------------------------------- Aceitação de valores

type Acceptance =
  | { accepted: true; value: number; weight: number; origin: EntryOrigin; at?: string }
  | { accepted: false; missing: MissingRequirement };

/** Um lançamento só entra na composição se a configuração o admitir. */
export function acceptEntry(model: CompositionModel, entry: CompositionEntryInput): Acceptance {
  const origin: EntryOrigin = entry.origin ?? "diario";
  if (origin !== "diario") {
    const ok =
      model.administrativeEntries.accepted &&
      model.administrativeEntries.acceptedOrigins.includes(origin);
    if (!ok)
      return {
        accepted: false,
        missing: { kind: "origem-nao-admitida", entryId: entry.entryId, origin },
      };
  }
  if (entry.status !== "registrado")
    return {
      accepted: false,
      missing: {
        kind: "lancamento-em-aberto",
        instrumentId: entry.instrumentId,
        entryId: entry.entryId,
      },
    };
  if (entry.value.kind === "nao-registrado")
    return {
      accepted: false,
      missing: {
        kind: "nao-registrado-sem-regra",
        entryId: entry.entryId,
        reason: entry.value.reason,
      },
    };
  if (entry.value.kind !== "numerica")
    return {
      accepted: false,
      missing: {
        kind: "lancamento-em-aberto",
        instrumentId: entry.instrumentId,
        entryId: entry.entryId,
      },
    };
  return {
    accepted: true,
    value: entry.value.value,
    weight: entry.weight ?? 1,
    origin,
    ...(entry.at ? { at: entry.at } : {}),
  };
}

// ------------------------------------------------------------ Bloqueios

export type CompositionBlock = { reasons: string[]; pendingRuleIds: string[] };

/** Toda ausência de regra homologada resulta em bloqueio informativo. */
export function compositionBlocks(input: {
  configuration: AssessmentConfiguration;
  model: CompositionModel | undefined;
  entries: readonly CompositionEntryInput[];
}): CompositionBlock | null {
  const reasons: string[] = [];
  const pendingRuleIds = new Set<string>();
  const { configuration, model, entries } = input;

  if (!model) {
    reasons.push("Nenhum modelo de composição definido para esta configuração.");
    pendingRuleIds.add("pn-consolidacao");
  } else {
    if (model.configurationId !== configuration.id)
      reasons.push("O modelo de composição pertence a outra configuração avaliativa.");
    if (model.normativeStatus !== "homologado") {
      reasons.push("Regra de consolidação não homologada pela rede.");
      pendingRuleIds.add("pn-consolidacao");
    }
    if (model.rounding.applyAt.length > 0 && model.rounding.normativeStatus !== "homologado") {
      reasons.push("Política de arredondamento não homologada.");
      pendingRuleIds.add("pn-arredondamento");
    }
    if (model.categories.length === 0) {
      reasons.push("Modelo sem categorias de composição.");
      pendingRuleIds.add("pn-consolidacao");
    }
    if (
      model.periodAggregation.kind === "media-ponderada" &&
      model.categories.reduce((s, c) => s + c.weight, 0) === 0
    )
      reasons.push("Composição ponderada sem pesos definidos.");
    if (
      model.configurationVersion !== undefined &&
      model.configurationVersion !== configuration.version
    )
      reasons.push(
        "O modelo foi definido para outra versão da configuração; consolidação requer definição administrativa/pedagógica.",
      );
  }

  const configurations = new Set(
    entries.map((e) => `${e.configurationId}@${e.configurationVersion ?? "?"}`),
  );
  if (configurations.size > 1) {
    reasons.push(
      "O percurso reúne registros de configurações diferentes: consolidação requer definição administrativa/pedagógica. Nenhuma equivalência é presumida.",
    );
    pendingRuleIds.add("pn-movimentacao");
  }
  if (configuration.pendingRuleIds.includes("pn-consolidacao")) {
    reasons.push("A configuração avaliativa tem consolidação pendente de homologação.");
    pendingRuleIds.add("pn-consolidacao");
  }
  return reasons.length ? { reasons, pendingRuleIds: [...pendingRuleIds] } : null;
}

// -------------------------------------------------------- Composição por período

function composeCategory(
  model: CompositionModel,
  category: CompositionCategory,
  entries: readonly CompositionEntryInput[],
): CategoryComposition {
  const scoped = entries.filter((e) => category.instrumentTypeIds.includes(e.instrumentTypeId));
  const missing: MissingRequirement[] = [];
  const accepted: Weighted[] = [];
  const usedEntryIds: string[] = [];
  const origins = new Set<EntryOrigin>();
  for (const entry of scoped) {
    const result = acceptEntry(model, entry);
    if (!result.accepted) {
      missing.push(result.missing);
      continue;
    }
    accepted.push({
      value: result.value,
      weight: result.weight,
      ...(result.at ? { at: result.at } : {}),
    });
    usedEntryIds.push(entry.entryId);
    origins.add(result.origin);
  }
  if (accepted.length === 0)
    missing.push({ kind: "categoria-sem-lancamento", categoryId: category.id });
  else if (category.minimumEntries && accepted.length < category.minimumEntries)
    missing.push({
      kind: "quantidade-minima",
      categoryId: category.id,
      required: category.minimumEntries,
      present: accepted.length,
    });

  const raw = aggregate(category.aggregation, accepted);
  return {
    categoryId: category.id,
    label: category.label,
    weight: category.weight,
    usedEntryIds,
    origins: [...origins],
    // A precisão interna só é fechada se a configuração arredondar em "categoria".
    stage: raw === null ? null : roundScore(raw, model.rounding, "categoria"),
    missing,
  };
}

/**
 * Compõe um período. Enquanto faltarem dados exigidos pela configuração, o
 * retorno é explicitamente "acumulado-parcial".
 */
export function composePeriod(input: {
  model: CompositionModel;
  period: Pick<AssessmentPeriod, "id">;
  entries: readonly CompositionEntryInput[];
  official: boolean;
}): PeriodComposition {
  const { model, period } = input;
  const entries = input.entries.filter((e) => e.periodId === period.id);
  const categories = model.categories.map((c) => composeCategory(model, c, entries));
  const missing = categories.flatMap((c) => c.missing);
  const values: Weighted[] = categories
    .filter((c) => c.stage !== null)
    .map((c) => ({ value: c.stage!.value, weight: c.weight }));
  const complete = missing.length === 0 && values.length === model.categories.length;
  const raw = aggregate(model.periodAggregation, values);
  return {
    periodId: period.id,
    kind: complete ? "fechamento-do-periodo" : "acumulado-parcial",
    categories,
    // Só o fechamento do período é ponto de arredondamento; o parcial permanece cru.
    stage:
      raw === null
        ? null
        : complete
          ? roundScore(raw, model.rounding, "periodo")
          : { point: "periodo", raw, value: raw, rounded: false },
    complete,
    missing,
    official: input.official && complete,
  };
}

// ----------------------------------------------------- Consolidação anual

/**
 * Consolida o ano. O "resultado anual original" só é produzido quando todos os
 * dados exigidos pela configuração estão completos; caso contrário devolve
 * acumulado parcial, que nunca é resultado nem situação acadêmica.
 */
export function consolidateAnnual(input: {
  configuration: AssessmentConfiguration;
  model: CompositionModel | undefined;
  periods: ReadonlyArray<Pick<AssessmentPeriod, "id">>;
  entries: readonly CompositionEntryInput[];
  /** Todos os períodos vêm de calendário homologado? */
  official?: boolean;
}): AnnualComposition {
  const { configuration, model } = input;
  if (!configuration.allowsGrades || configuration.usesPedagogicalRecords)
    return {
      kind: "nao-aplicavel",
      reason:
        "Esta configuração não utiliza notas: o desenvolvimento é acompanhado por registros pedagógicos, sem consolidação numérica.",
      official: false,
      final: false,
    };
  const block = compositionBlocks({ configuration, model, entries: input.entries });
  if (block || !model)
    return {
      kind: "bloqueado",
      reasons: block?.reasons ?? ["Nenhum modelo de composição definido."],
      pendingRuleIds: block?.pendingRuleIds ?? ["pn-consolidacao"],
      official: false,
      final: false,
    };
  if (model.scaleSemantics !== "quantitativa")
    return {
      kind: "nao-aplicavel",
      reason:
        "Escala não quantitativa: nenhuma equivalência numérica foi homologada, e o motor não converte conceitos nem descrições.",
      official: false,
      final: false,
    };

  const official = input.official ?? false;
  const periods = input.periods.map((p) =>
    composePeriod({ model, period: p, entries: input.entries, official }),
  );
  const incomplete = periods.filter((p) => !p.complete);
  const missing: MissingRequirement[] = [
    ...periods.flatMap((p) => p.missing),
    ...incomplete.map((p) => ({ kind: "periodo-incompleto" as const, periodId: p.periodId })),
  ];
  const values: Weighted[] = periods
    .filter((p) => p.stage !== null)
    .map((p) => ({ value: p.stage!.value, weight: 1, at: p.periodId }));
  const raw = aggregate(model.annualAggregation, values);
  const dataComplete =
    periods.length > 0 &&
    (model.requiresAllPeriods ? incomplete.length === 0 : periods.some((p) => p.complete)) &&
    incomplete.length === 0;

  if (!dataComplete || raw === null)
    return {
      kind: "acumulado-parcial",
      label: "Acumulado parcial — não é resultado anual",
      periods,
      stage: raw === null ? null : { point: "anual", raw, value: raw, rounded: false },
      missing,
      official: false,
      final: false,
    };
  return {
    kind: "resultado-anual-original",
    periods,
    stage: roundScore(raw, model.rounding, "anual"),
    modelId: model.id,
    official: official && model.normativeStatus === "homologado",
    final: true,
  };
}

/** Rótulo neutro para a interface. Nunca "aprovado", "atrasado" ou "final". */
export function compositionHeadline(outcome: AnnualComposition): string {
  switch (outcome.kind) {
    case "bloqueado":
      return "Consolidação bloqueada — regra não homologada";
    case "nao-aplicavel":
      return "Consolidação numérica não aplicável";
    case "acumulado-parcial":
      return "Acumulado parcial — não é resultado anual";
    case "resultado-anual-original":
      return "Resultado anual original (conforme modelo homologado)";
  }
}
