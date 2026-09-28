/**
 * 6D.3.5.3 — Fronteira canônica do resultado avaliativo do PERÍODO.
 *
 *   versões oficiais vigentes → composição normal → fatos de elegibilidade
 *   → recuperação periódica (se configurada) → resultado projetado + recibo.
 *
 * Única função consumida pela Avaliação do período e pelo Fechamento, para que
 * as duas superfícies nunca divirjam. Não há matemática nova aqui: a composição
 * é `composePeriod`, a recuperação é `applyPeriodicRecovery` (motor homologado)
 * e a única comparação é de identidade entre o antes e o depois.
 *
 * Invariantes:
 * - o instrumento de recuperação é identificado SOMENTE por
 *   `RecoveryRule.instrumentTypeIds` — nunca pelo título;
 * - o resultado anterior à recuperação é preservado (`composition`);
 * - ausência de recuperação nunca vira zero, e "elegível sem resultado" não
 *   bloqueia nada por si: completude é da política de fechamento;
 * - ausência de critério de elegibilidade = recuperação sem restrição, o que
 *   NÃO é insuficiência normativa (interpretação congelada na 6D.3.5.2b).
 */
import {
  compositionInputFromVersion,
  type OfficialEntryUse,
} from "./assessment-canonical-inputs";
import { acceptEntry, composePeriod, type ReplaceableSubtotalFact } from "./assessment-composition";
import type {
  CompositionEntryInput,
  CompositionModel,
  NumericStage,
  PeriodComposition,
} from "./assessment-composition-types";
import { applyPeriodicRecovery, type RecoveryProvenance } from "./assessment-recovery";
import type { RecoveryEligibilityProjection } from "./assessment-recovery-evaluators";
import type { RecoveryRule } from "./assessment-rule-types";

export type PeriodRecoveryState =
  | "not-configured"
  | "not-eligible"
  | "eligibility-indeterminate"
  | "eligible-without-result"
  | "applied-without-effect"
  | "applied-with-effect"
  | "normative-insufficiency"
  /** Resultado do período ainda parcial: a recuperação não é considerada. */
  | "period-incomplete";

export type RecoveryEntryReference = {
  versionId: string;
  logicalEntryId: string;
  version: number;
  instrumentId: string;
  valueKind: string;
  /** Aproveitado pelo motor (registro oficial com valor admitido). */
  accepted: boolean;
};

export type PeriodRecoveryReceipt = {
  state: PeriodRecoveryState;
  reason: string;
  /** Identidade normativa versionada que regeu a projeção. */
  rule?: {
    ruleId: string;
    ruleVersion: number;
    configurationId: string;
    configurationVersion?: number;
    recoveryRuleId: string;
  };
  originalStage: NumericStage | null;
  eligibility?:
    | { kind: "unrestricted" }
    | { kind: "evaluated"; projection: RecoveryEligibilityProjection };
  replaceableSubtotal?: ReplaceableSubtotalFact;
  recoveryEntries: readonly RecoveryEntryReference[];
  recoveryStage: NumericStage | null;
  effect?: RecoveryProvenance;
  replacedCategoryIds: readonly string[];
  finalStage: NumericStage | null;
};

export type CanonicalPeriodResult = {
  /** Resultado do período ANTES da recuperação — nunca destruído. */
  composition: PeriodComposition;
  recovery: PeriodRecoveryReceipt;
  /** Resultado projetado do período (pós-recuperação quando houver efeito). */
  finalStage: NumericStage | null;
  inputs: readonly CompositionEntryInput[];
  uses: readonly OfficialEntryUse[];
};

export type PeriodResultRuleReference = {
  id: string;
  version: number;
  periodicRecovery?: RecoveryRule;
};

export function projectCanonicalPeriodResult(args: {
  model: CompositionModel;
  periodId: string;
  uses: readonly OfficialEntryUse[];
  configuration: { id: string; version: number };
  official: boolean;
  /** Regra que rege o cálculo (histórica, no fechamento). */
  rule?: PeriodResultRuleReference;
}): CanonicalPeriodResult {
  const uses = args.uses.filter((u) => u.instrument.periodId === args.periodId);
  const inputs = uses.map((u) => compositionInputFromVersion(u, args.configuration));
  const composition = composePeriod({
    model: args.model,
    period: { id: args.periodId },
    entries: inputs,
    official: args.official,
  });
  const recovery = args.rule?.periodicRecovery;
  const base = {
    originalStage: composition.stage,
    recoveryStage: null,
    replacedCategoryIds: recovery ? [...recovery.replacesCategoryIds] : [],
    finalStage: composition.stage,
  };
  const done = (receipt: PeriodRecoveryReceipt): CanonicalPeriodResult => ({
    composition,
    recovery: receipt,
    finalStage: receipt.finalStage,
    inputs,
    uses,
  });

  if (!recovery || !recovery.enabled)
    return done({
      ...base,
      state: "not-configured",
      reason: "Nenhuma recuperação periódica configurada nesta regra.",
      recoveryEntries: [],
    });

  const ruleRef = {
    ruleId: args.rule!.id,
    ruleVersion: args.rule!.version,
    configurationId: args.configuration.id,
    configurationVersion: args.configuration.version,
    recoveryRuleId: recovery.id,
  };
  const recoveryTypes = new Set(recovery.instrumentTypeIds);
  const byVersion = new Map(uses.map((u) => [u.version.id, u]));
  const scoped = inputs.filter((i) => recoveryTypes.has(i.instrumentTypeId));
  const recoveryEntries: RecoveryEntryReference[] = scoped.map((i) => {
    const v = byVersion.get(i.entryId)!.version;
    return {
      versionId: v.id,
      logicalEntryId: v.logicalEntryId,
      version: v.version,
      instrumentId: i.instrumentId,
      valueKind: v.value.kind,
      accepted: acceptEntry(args.model, i).accepted,
    };
  });
  const insufficient = (reason: string) =>
    done({ ...base, rule: ruleRef, state: "normative-insufficiency", reason, recoveryEntries });

  if (recovery.scope !== "periodo")
    return insufficient("A recuperação declarada nesta posição não tem escopo de período.");
  if (recovery.normativeStatus !== "homologado")
    return insufficient("A recuperação periódica ainda não foi homologada.");
  if (recovery.instrumentTypeIds.length === 0)
    return insufficient("A regra não declara qual tipo de instrumento registra a recuperação.");
  if (args.model.categories.some((c) => c.instrumentTypeIds.some((t) => recoveryTypes.has(t))))
    return insufficient(
      "O mesmo tipo de instrumento é declarado como recuperação e como parte da composição normal.",
    );
  if (!composition.complete)
    return done({
      ...base,
      rule: ruleRef,
      state: "period-incomplete",
      reason: "O resultado do período ainda está incompleto; a recuperação não é considerada.",
      recoveryEntries,
    });

  const outcome = applyPeriodicRecovery({
    recovery,
    model: args.model,
    period: composition,
    entries: scoped,
    context: ruleRef,
  });
  const eligibility: PeriodRecoveryReceipt["eligibility"] = outcome.eligibility
    ? { kind: "evaluated", projection: outcome.eligibility }
    : { kind: "unrestricted" };
  const common = {
    ...base,
    rule: ruleRef,
    eligibility,
    ...(outcome.replaceableSubtotal ? { replaceableSubtotal: outcome.replaceableSubtotal } : {}),
    recoveryEntries,
  };
  if (outcome.eligibility?.eligible === false)
    return done({ ...common, state: "not-eligible", reason: outcome.reason });
  if (outcome.eligibility?.eligible === "indeterminate")
    return done({ ...common, state: "eligibility-indeterminate", reason: outcome.reason });
  if (!recoveryEntries.some((e) => e.accepted))
    return done({
      ...common,
      state: "eligible-without-result",
      reason: "Não há resultado de recuperação registrado para este período.",
    });
  if (!outcome.applied)
    return done({ ...common, state: "normative-insufficiency", reason: outcome.reason });
  const changed = outcome.afterRecovery?.value !== composition.stage?.value;
  return done({
    ...common,
    state: changed ? "applied-with-effect" : "applied-without-effect",
    reason: changed
      ? "A recuperação alterou o resultado do período conforme a regra homologada."
      : "A recuperação foi considerada e o resultado do período foi mantido.",
    recoveryStage: outcome.recovery,
    ...(outcome.provenance ? { effect: outcome.provenance } : {}),
    finalStage: outcome.afterRecovery,
  });
}
