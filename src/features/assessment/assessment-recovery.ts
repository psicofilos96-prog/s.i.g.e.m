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
import { evaluateRecoveryEffect, recoveryEffectRef } from "./assessment-recovery-evaluators";

/** 6D.3.5.1 — Fatos preservados da aplicação; nada é descartado no cálculo. */
export type RecoveryProvenance = {
  recoveryRuleId: string;
  effectEvaluatorId: string;
  effectParameters?: Readonly<Record<string, unknown>>;
  originalValue: number | null;
  recoveryValue: number;
  producedValue: number;
  cap?: number;
  roundingPolicyId?: string;
};

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
  provenance?: RecoveryProvenance;
};

/**
 * Prevalência exposta para prévia e simulação. Delegada ao registro canônico
 * (6D.3.5.1); a assinatura legada é preservada para a prévia (6D.3.5.2).
 */
export function prevailValue(
  prevalence: RecoveryPrevalence,
  original: number | null,
  recovery: number,
): number {
  const result = evaluateRecoveryEffect({ evaluatorId: prevalence }, original, recovery);
  if (result.status !== "produced") throw new Error(result.reason);
  return result.value;
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
  const effectRef = recoveryEffectRef(recovery);
  if (!effectRef) return none("Fórmula da recuperação pendente de definição normativa.");

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
  const effect = evaluateRecoveryEffect(effectRef, original?.value ?? null, recoveryStage.value);
  if (effect.status !== "produced") return none(effect.reason);
  const after = roundScore(effect.value, model.rounding, point);
  return {
    original,
    recovery: recoveryStage,
    afterRecovery: after,
    prevalence: recovery.prevalence ?? null,
    applied: true,
    reason: "Recuperação aplicada conforme a prevalência configurada.",
    provenance: provenanceOf(recovery, effectRef, original?.value ?? null, recoveryStage.value, after),
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
    !recoveryEffectRef(recovery) ||
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
  const effectRef = recoveryEffectRef(recovery)!;

  const replaced = period.categories.filter((c) =>
    recovery.replacesCategoryIds.includes(c.categoryId),
  );
  const kept = period.categories.filter(
    (c) => !recovery.replacesCategoryIds.includes(c.categoryId),
  );
  const recoveryOnly = applyRecovery({
    recovery: { ...recovery, prevalence: "substituicao-direta", effect: { evaluatorId: "substituicao-direta" } },
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
  const effect = evaluateRecoveryEffect(effectRef, period.stage?.value ?? null, alternative.value);
  if (effect.status !== "produced")
    return { ...recoveryOnly, original: period.stage, afterRecovery: period.stage, applied: false, reason: effect.reason };
  const after = roundScore(effect.value, model.rounding, "periodo");
  return {
    original: period.stage,
    recovery: recoveryOnly.recovery,
    afterRecovery: after,
    prevalence: recovery.prevalence ?? null,
    provenance: provenanceOf(recovery, effectRef, period.stage?.value ?? null, alternative.value, after),
    applied: true,
    reason:
      "Composição alternativa produzida pela recuperação; categorias não substituídas permanecem.",
  };
}

function provenanceOf(
  recovery: RecoveryRule,
  ref: { evaluatorId: string; parameters?: Readonly<Record<string, unknown>> },
  originalValue: number | null,
  recoveryValue: number,
  after: NumericStage,
): RecoveryProvenance {
  return {
    recoveryRuleId: recovery.id,
    effectEvaluatorId: ref.evaluatorId,
    ...(ref.parameters ? { effectParameters: ref.parameters } : {}),
    originalValue,
    recoveryValue,
    producedValue: after.value,
    ...(recovery.maxScore !== undefined ? { cap: recovery.maxScore } : {}),
    ...(after.roundingPolicyId ? { roundingPolicyId: after.roundingPolicyId } : {}),
  };
}
