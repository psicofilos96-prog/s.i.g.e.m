/**
 * 6D.3.3.3b — Projeção de Explicabilidade da Composição.
 *
 * O motor responde "o que matematicamente aconteceu?"; esta projeção responde
 * "o que deste acontecimento pode ser mostrado a esta pessoa e como esses
 * fatos se organizam semanticamente?".
 *
 * Invariantes:
 * 1. Nenhuma matemática: não soma, não pondera, não aplica teto, não arredonda,
 *    não compara números nem refaz filtros do modelo. Tudo vem do resultado
 *    canônico (`PeriodComposition`) e do seu recibo (6D.3.3.3a).
 * 2. O que não está no recibo nem nos fatos referenciados é "não sabido"
 *    (`resolved: false`), nunca reconstruído.
 * 3. Divulgação é tudo-ou-nada por agrupamento: se QUALQUER entrada envolvida
 *    não puder ser divulgada, o resultado é `protected` sem nenhum valor,
 *    peso, estágio ou referência — "uma explicação não pode revelar
 *    indiretamente aquilo que a política impede revelar diretamente".
 * 4. IDs técnicos ficam apenas em `provenance` (disclosure técnico).
 */
import type { PeriodRecoveryReceipt, PeriodRecoveryState } from "./assessment-period-result";
import type {
  CapReceipt,
  CompositionModel,
  MissingRequirement,
  NumericStage,
  PeriodComposition,
  RoundingPoint,
} from "./assessment-composition-types";
import type { AssessmentEntryVersion } from "./assessment-entry-versions";
import type { AssessmentInstrument } from "./assessment-types";

// ---------------------------------------------------------------- Entrada

export type CompositionExplanationSource =
  | { kind: "blocked"; reasons: readonly string[]; pendingRuleIds: readonly string[] }
  | { kind: "composed"; composition: PeriodComposition; recovery?: PeriodRecoveryReceipt };

/** 6D.3.5.3 — recuperação explicada a partir do recibo canônico; nada é recalculado. */
export type ExplainedRecovery = {
  state: PeriodRecoveryState;
  reason: string;
  originalValue: number | null;
  recoveryValue: number | null;
  finalValue: number | null;
  entries: readonly ExplainedEntryReference[];
  eligibility:
    | { kind: "unrestricted" }
    | { kind: "evaluated"; eligible: boolean | "indeterminate"; reason: string }
    | null;
  replaceableSubtotal: { value: number } | null;
  cap: number | null;
  provenance: {
    ruleId?: string;
    ruleVersion?: number;
    recoveryRuleId?: string;
    effectEvaluatorId?: string;
    eligibilityEvaluatorId?: string | null;
    roundingPolicyId?: string;
    replacedCategoryIds: readonly string[];
  };
};

export type CompositionExplanationInput = {
  source: CompositionExplanationSource;
  model: CompositionModel | undefined;
  configuration: { id: string; version: number };
  instruments: readonly AssessmentInstrument[];
  /** Todas as versões conhecidas (para resolver `entryId` e a cadeia). */
  versions: readonly AssessmentEntryVersion[];
  /** Instrumentos em "Não se aplica" segundo a projeção avaliativa externa ao motor. */
  notApplicableInstrumentIds: readonly string[];
  /** Regra atual, tudo-ou-nada. */
  valuesDisclosed: boolean;
  /**
   * Gancho para autorização granular futura. Se presente e negar QUALQUER
   * entrada envolvida, toda a explicação fica protegida (nunca parcial).
   */
  isEntryDisclosed?: (entryId: string) => boolean;
};

// ---------------------------------------------------------------- Saída

export type ExplainedEntryReference =
  | {
      resolved: true;
      instrumentTitle: string;
      appliedOn: string;
      /** Factual: a versão consumida substituiu outra na cadeia oficial. */
      corrected: boolean;
      provenance: { entryVersionId: string; instrumentId: string; version: number };
    }
  /** O `entryId` não corresponde a nenhuma versão conhecida: não sabemos. */
  | { resolved: false; provenance: { entryVersionId: string } };

export type ExplainedUsedEntry = ExplainedEntryReference & {
  effectiveValue: number;
  effectiveWeight: number;
};

export type ExplainedStage = {
  point: RoundingPoint;
  valueBeforeRounding: number;
  value: number;
  /** A política foi consultada neste ponto (pode não ter alterado o valor). */
  roundingPolicyConsulted: boolean;
  /** O próprio motor declarou que arredondou neste ponto. */
  roundingApplied: boolean;
  roundingPolicy: ExplainedRoundingPolicy | null;
};

export type ExplainedRoundingPolicy =
  | {
      known: true;
      mode: CompositionModel["rounding"]["mode"];
      decimals?: number;
      step?: number;
      provenance: { roundingPolicyId: string; modelId: string; modelVersion: number };
    }
  | { known: false; provenance: { roundingPolicyId: string } };

export type ExplainedCap = CapReceipt;

/** A. Selecionada pela categoria, mas não utilizada — razão canônica preservada. */
export type ExplainedMissingEntry = {
  nature: "selected-not-used";
  reasonKind: Extract<MissingRequirement, { entryId: string }>["kind"];
  /** Presente apenas quando a razão canônica traz texto próprio. */
  canonicalReason?: string;
  entry: ExplainedEntryReference;
};

/** Requisito de categoria não atendido (não ligado a entrada específica). */
export type ExplainedCategoryRequirement = Exclude<MissingRequirement, { entryId: string }>;

export type ExplainedCategory = {
  label: string;
  weight: number;
  usedEntries: readonly ExplainedUsedEntry[];
  notUsed: readonly ExplainedMissingEntry[];
  unmetRequirements: readonly ExplainedCategoryRequirement[];
  /** Ausente quando o modelo não declara teto. */
  cap?: ExplainedCap;
  stage: ExplainedStage | null;
  provenance: { categoryId: string };
};

export type CompositionExplanationProjection =
  | {
      state: "available";
      compositionKind: PeriodComposition["kind"];
      complete: boolean;
      period: ExplainedStage | null;
      categories: readonly ExplainedCategory[];
      /** 6D.3.5.3 — ausente quando nenhuma recuperação está configurada. */
      recovery?: ExplainedRecovery;
      /** B. Entregues ao motor, sem categoria correspondente. */
      unmatched: readonly ExplainedEntryReference[];
      /** C. Fora do motor: "Não se aplica". */
      notApplicable: readonly { instrumentTitle: string; provenance: { instrumentId: string } }[];
      provenance: {
        modelId: string;
        modelVersion: number;
        configurationId: string;
        configurationVersion: number;
      };
    }
  | {
      state: "unavailable";
      reasons: readonly string[];
      pendingRuleIds: readonly string[];
    }
  | { state: "protected"; explanation: "values-not-disclosed" };

const PROTECTED: CompositionExplanationProjection = {
  state: "protected",
  explanation: "values-not-disclosed",
};

// ---------------------------------------------------------------- Projeção

export function projectCompositionExplanation(
  input: CompositionExplanationInput,
): CompositionExplanationProjection {
  const { source, model } = input;
  if (source.kind === "blocked")
    return {
      state: "unavailable",
      reasons: [...source.reasons],
      pendingRuleIds: [...source.pendingRuleIds],
    };
  if (!model)
    return {
      state: "unavailable",
      reasons: ["Nenhum modelo de composição disponível para explicar o resultado."],
      pendingRuleIds: [],
    };

  const composition = source.composition;
  if (!input.valuesDisclosed) return PROTECTED;
  const involved = [
    ...composition.categories.flatMap((c) => c.usedEntries.map((u) => u.entryId)),
    ...composition.missing.flatMap((m) => ("entryId" in m ? [m.entryId] : [])),
    ...composition.unmatchedEntryIds,
  ];
  if (input.isEntryDisclosed && involved.some((id) => !input.isEntryDisclosed!(id)))
    return PROTECTED;

  const versionsById = new Map(input.versions.map((v) => [v.id, v]));
  const instrumentsById = new Map(input.instruments.map((i) => [i.id, i]));

  const reference = (entryVersionId: string): ExplainedEntryReference => {
    const v = versionsById.get(entryVersionId);
    const instrument = v ? instrumentsById.get(v.instrumentId) : undefined;
    if (!v || !instrument) return { resolved: false, provenance: { entryVersionId } };
    return {
      resolved: true,
      instrumentTitle: instrument.title,
      appliedOn: instrument.appliedOn,
      corrected: v.supersedesVersionId !== undefined,
      provenance: { entryVersionId, instrumentId: instrument.id, version: v.version },
    };
  };

  const policy = (stage: NumericStage): ExplainedRoundingPolicy | null => {
    if (stage.roundingPolicyId === undefined) return null;
    if (stage.roundingPolicyId !== model.rounding.id)
      return { known: false, provenance: { roundingPolicyId: stage.roundingPolicyId } };
    const p = model.rounding;
    return {
      known: true,
      mode: p.mode,
      ...(p.decimals === undefined ? {} : { decimals: p.decimals }),
      ...(p.step === undefined ? {} : { step: p.step }),
      provenance: { roundingPolicyId: p.id, modelId: model.id, modelVersion: model.version },
    };
  };

  const stage = (s: NumericStage | null): ExplainedStage | null =>
    s === null
      ? null
      : {
          point: s.point,
          valueBeforeRounding: s.raw,
          value: s.value,
          roundingPolicyConsulted: s.roundingPolicyId !== undefined,
          roundingApplied: s.rounded,
          roundingPolicy: policy(s),
        };

  const categories: ExplainedCategory[] = composition.categories.map((c) => {
    const notUsed: ExplainedMissingEntry[] = [];
    const unmetRequirements: ExplainedCategoryRequirement[] = [];
    for (const m of c.missing) {
      if ("entryId" in m)
        notUsed.push({
          nature: "selected-not-used",
          reasonKind: m.kind,
          ...("reason" in m ? { canonicalReason: m.reason } : {}),
          entry: reference(m.entryId),
        });
      else unmetRequirements.push(m);
    }
    return {
      label: c.label,
      weight: c.weight,
      usedEntries: c.usedEntries.map((u) => ({
        ...reference(u.entryId),
        effectiveValue: u.effectiveValue,
        effectiveWeight: u.effectiveWeight,
      })),
      notUsed,
      unmetRequirements,
      ...(c.cap ? { cap: { ...c.cap } } : {}),
      stage: stage(c.stage),
      provenance: { categoryId: c.categoryId },
    };
  });

  const rec = source.recovery;
  const recoveryIds = new Set(rec?.recoveryEntries.map((e) => e.versionId) ?? []);
  const explainedRecovery: ExplainedRecovery | undefined =
    rec && rec.state !== "not-configured"
      ? {
          state: rec.state,
          reason: rec.reason,
          originalValue: rec.originalStage?.value ?? null,
          recoveryValue: rec.recoveryStage?.value ?? null,
          finalValue: rec.finalStage?.value ?? null,
          entries: rec.recoveryEntries.map((e) => reference(e.versionId)),
          eligibility: !rec.eligibility
            ? null
            : rec.eligibility.kind === "unrestricted"
              ? { kind: "unrestricted" }
              : {
                  kind: "evaluated",
                  eligible: rec.eligibility.projection.eligible,
                  reason: rec.eligibility.projection.reason,
                },
          replaceableSubtotal:
            rec.replaceableSubtotal?.status === "produced"
              ? { value: rec.replaceableSubtotal.receipt.value }
              : null,
          cap: rec.effect?.cap ?? null,
          provenance: {
            ...(rec.rule
              ? { ruleId: rec.rule.ruleId, ruleVersion: rec.rule.ruleVersion, recoveryRuleId: rec.rule.recoveryRuleId }
              : {}),
            ...(rec.effect ? { effectEvaluatorId: rec.effect.effectEvaluatorId } : {}),
            ...(rec.eligibility?.kind === "evaluated"
              ? { eligibilityEvaluatorId: rec.eligibility.projection.evaluatorId }
              : {}),
            ...(rec.effect?.roundingPolicyId ? { roundingPolicyId: rec.effect.roundingPolicyId } : {}),
            replacedCategoryIds: [...rec.replacedCategoryIds],
          },
        }
      : undefined;

  return {
    state: "available",
    compositionKind: composition.kind,
    complete: composition.complete,
    period: stage(composition.stage),
    categories,
    unmatched: composition.unmatchedEntryIds.filter((id) => !recoveryIds.has(id)).map(reference),
    ...(explainedRecovery ? { recovery: explainedRecovery } : {}),
    notApplicable: input.notApplicableInstrumentIds.flatMap((id) => {
      const i = instrumentsById.get(id);
      return i ? [{ instrumentTitle: i.title, provenance: { instrumentId: id } }] : [];
    }),
    provenance: {
      modelId: model.id,
      modelVersion: model.version,
      configurationId: input.configuration.id,
      configurationVersion: input.configuration.version,
    },
  };
}
