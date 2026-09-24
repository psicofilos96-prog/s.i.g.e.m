/**
 * Etapa 12F — Recuperação sobre o motor genérico da 12E.
 *
 * Nenhuma forma de prevalência é privilegiada pelo domínio: a regra
 * institucional escolhe uma entre as que o sistema é capaz de representar.
 *
 * Invariantes:
 * 1. O resultado ORIGINAL nunca é apagado nem sobrescrito;
 * 2. a nota da recuperação vive em campo próprio;
 * 3. o resultado pós-recuperação é uma terceira informação, explícita;
 * 4. nenhuma conclusão de aprovação/reprovação é produzida aqui.
 */
import { aggregate, acceptEntry, roundScore } from "./assessment-composition";
import type {
  CompositionEntryInput,
  CompositionModel,
  NumericStage,
  PeriodComposition,
  RoundingPoint,
} from "./assessment-composition-types";
import type { RecoveryPrevalence, RecoveryRule } from "./assessment-rule-types";

export type RecoveryOutcome = {
  /** Resultado antes da recuperação — preservado sempre. */
  original: NumericStage | null;
  /** Valor da própria recuperação, em campo próprio. */
  recovery: NumericStage | null;
  /** Resultado pós-recuperação segundo a prevalência configurada. */
  afterRecovery: NumericStage | null;
  prevalence: RecoveryPrevalence | null;
  applied: boolean;
  reason: string;
};

/** Prevalência exposta para prévia e simulação. Sem regra privilegiada. */
export function prevailValue(
  prevalence: RecoveryPrevalence,
  original: number | null,
  recovery: number,
): number {
  if (original === null) return recovery;
  switch (prevalence) {
    case "maior-resultado":
      return Math.max(original, recovery);
    case "menor-resultado":
      return Math.min(original, recovery);
    case "substituicao-direta":
    case "ultimo-resultado":
      return recovery;
    case "media-entre-resultados":
      return Number(((original + recovery) / 2).toFixed(10));
  }
}

/**
 * Aplica a recuperação a um valor já fechado (período ou anual). A composição
 * da recuperação vem dos lançamentos admitidos pelos tipos de instrumento que a
 * própria regra declara — nunca de uma taxonomia fixa.
 */
export function applyRecovery(args: {
  recovery: RecoveryRule | undefined;
  model: CompositionModel;
  point: RoundingPoint;
  original: NumericStage | null;
  entries: readonly CompositionEntryInput[];
}): RecoveryOutcome {
  const { recovery, model, point, original } = args;
  const none = (reason: string): RecoveryOutcome => ({
    original,
    recovery: null,
    afterRecovery: original,
    prevalence: recovery?.prevalence ?? null,
    applied: false,
    reason,
  });
  if (!recovery) return none("Nenhuma recuperação configurada nesta regra.");
  if (!recovery.enabled) return none("Recuperação desabilitada nesta regra.");
  // Prevalência ainda não definida pela rede: nada é presumido e nada é aplicado.
  if (!recovery.prevalence) return none("Fórmula da recuperação pendente de definição normativa.");

  const scoped = args.entries.filter((e) =>
    recovery.instrumentTypeIds.includes(e.instrumentTypeId),
  );
  const values = scoped.flatMap((entry) => {
    const accepted = acceptEntry(model, entry);
    return accepted.accepted
      ? [
          {
            value: accepted.value,
            weight: accepted.weight,
            ...(accepted.at ? { at: accepted.at } : {}),
          },
        ]
      : [];
  });
  // Sem forma de consolidação entre registros: um único registro é o próprio
  // valor; com mais de um, nada é presumido (média, soma ou maior nota).
  if (!recovery.aggregation && values.length > 1)
    return none(
      "Consolidação entre múltiplos instrumentos de recuperação pendente de definição normativa.",
    );
  const raw = recovery.aggregation
    ? aggregate(recovery.aggregation, values)
    : (values[0]?.value ?? null);
  if (raw === null) return none("Nenhum registro de recuperação aproveitável.");
  const capped = recovery.maxScore !== undefined ? Math.min(raw, recovery.maxScore) : raw;
  const recoveryStage = roundScore(capped, model.rounding, point);
  const combined = prevailValue(recovery.prevalence, original?.value ?? null, recoveryStage.value);
  return {
    original,
    recovery: recoveryStage,
    afterRecovery: roundScore(combined, model.rounding, point),
    prevalence: recovery.prevalence,
    applied: true,
    reason: "Recuperação aplicada conforme a prevalência configurada.",
  };
}

/**
 * Recuperação periódica: as categorias substituíveis cedem a sua parcela ao
 * resultado da recuperação; as demais permanecem. A composição alternativa
 * concorre com a original segundo a prevalência configurada.
 */
export function applyPeriodicRecovery(args: {
  recovery: RecoveryRule | undefined;
  model: CompositionModel;
  period: PeriodComposition;
  entries: readonly CompositionEntryInput[];
}): RecoveryOutcome {
  const { recovery, model, period } = args;
  if (
    !recovery ||
    !recovery.enabled ||
    !recovery.prevalence ||
    !recovery.aggregation ||
    recovery.replacesCategoryIds.length === 0
  )
    return applyRecovery({
      recovery,
      model,
      point: "periodo",
      original: period.stage,
      entries: args.entries,
    });
  const prevalence = recovery.prevalence;

  const replaced = period.categories.filter((c) =>
    recovery.replacesCategoryIds.includes(c.categoryId),
  );
  const kept = period.categories.filter(
    (c) => !recovery.replacesCategoryIds.includes(c.categoryId),
  );
  const recoveryOnly = applyRecovery({
    recovery: { ...recovery, prevalence: "substituicao-direta" },
    model,
    point: "categoria",
    original: null,
    entries: args.entries,
  });
  if (!recoveryOnly.applied || recoveryOnly.recovery === null)
    return { ...recoveryOnly, original: period.stage, afterRecovery: period.stage };

  const weight = replaced.reduce((s, c) => s + c.weight, 0);
  const values = [
    ...kept
      .filter((c) => c.stage !== null)
      .map((c) => ({ value: c.stage!.value, weight: c.weight })),
    { value: recoveryOnly.recovery.value, weight: weight || 1 },
  ];
  const raw = aggregate(model.periodAggregation, values);
  if (raw === null) return { ...recoveryOnly, original: period.stage, afterRecovery: period.stage };
  const alternative = roundScore(raw, model.rounding, "periodo");
  const combined = prevailValue(prevalence, period.stage?.value ?? null, alternative.value);
  return {
    original: period.stage,
    recovery: recoveryOnly.recovery,
    afterRecovery: roundScore(combined, model.rounding, "periodo"),
    prevalence,
    applied: true,
    reason:
      "Composição alternativa produzida pela recuperação; categorias não substituídas permanecem.",
  };
}
