/**
 * Etapa 12F — prévia em linguagem natural, comparação entre versões e
 * simulador matemático da Supervisão.
 *
 * Nada aqui usa dados de aluno: a simulação recebe apenas valores digitados.
 * A comparação identifica diferenças por IDENTIDADE (IDs), nunca por nome.
 */
import { aggregate, roundScore } from "./assessment-composition";
import { prevailValue } from "./assessment-recovery";
import { compositionModelFromRule } from "./assessment-rule-model";
import {
  RECOVERY_PREVALENCE_LABEL,
  ROUNDING_POINT_LABEL,
  type InstitutionalAssessmentRule,
  type RecoveryRule,
} from "./assessment-rule-types";
import type { AggregationRule, NumericStage } from "./assessment-composition-types";
import type { NetworkCalendar } from "@/features/calendar/calendar-types";
import type { InstrumentType } from "./assessment-types";

const AGGREGATION_LABEL: Record<AggregationRule["kind"], string> = {
  "media-simples": "média simples dos valores",
  "media-ponderada": "média ponderada pelos pesos",
  soma: "soma dos valores",
  "maior-valor": "maior valor registrado",
  "ultimo-valor": "valor mais recente",
};

export const aggregationLabel = (rule: AggregationRule) => AGGREGATION_LABEL[rule.kind];

export type PreviewSection = { title: string; lines: string[] };

/** Tradução humana completa da regra, para validação pedagógica. */
export function describeRule(
  rule: InstitutionalAssessmentRule,
  ctx: {
    calendar?: NetworkCalendar | undefined;
    instrumentTypes: readonly InstrumentType[];
    /** Rótulos humanos opcionais; sem eles a prévia mostra o identificador. */
    yearLabel?: string;
    stageLabels?: readonly string[];
  },
): PreviewSection[] {
  const typeLabel = (id: string) =>
    ctx.instrumentTypes.find((t) => t.id === id)?.label ?? `tipo ${id}`;
  const sections: PreviewSection[] = [];

  sections.push({
    title: "Aplicação",
    lines: [
      `Ano letivo: ${ctx.yearLabel ?? rule.scope.academicYearId}.`,
      ctx.calendar
        ? `Períodos vêm do calendário "${ctx.calendar.title}" (${ctx.calendar.periods.length} período(s)).`
        : "Calendário referenciado não localizado: os períodos não podem ser resolvidos.",
      rule.scope.stageIds.length
        ? `Etapas/modalidades: ${(ctx.stageLabels ?? rule.scope.stageIds).join(", ")}.`
        : "Nenhuma etapa/modalidade declarada.",
      rule.validFrom || rule.validUntil
        ? `Vigência: ${rule.validFrom ?? "início não definido"} a ${rule.validUntil ?? "término não definido"}.`
        : "Vigência ainda não delimitada.",
    ],
  });

  sections.push({
    title: "Estratégia",
    lines: [
      rule.allowsGrades
        ? `Registros ${rule.scaleSemantics} com escala definida na regra.`
        : "Sem nota: o desenvolvimento é acompanhado por registros pedagógicos.",
      rule.usesPedagogicalRecords
        ? "Utiliza os registros pedagógicos já feitos no Diário."
        : "Utiliza instrumentos avaliativos lançados no Diário.",
    ],
  });

  if (rule.categories.length)
    sections.push({
      title: "Composição do período",
      lines: [
        ...rule.categories.map(
          (c) =>
            `${c.label}: ${c.instrumentTypeIds.map(typeLabel).join(", ") || "nenhum tipo admitido"} — peso ${c.weight}, ${AGGREGATION_LABEL[c.aggregation.kind]}${
              c.minimumEntries === undefined
                ? ", quantidade mínima não definida"
                : `, mínimo de ${c.minimumEntries} registro(s)`
            }.`,
        ),
        `O período é fechado pela ${AGGREGATION_LABEL[rule.periodAggregation.kind]} das categorias${
          rule.periodMaxScore !== undefined ? `, com teto de ${rule.periodMaxScore}` : ""
        }.`,
      ],
    });

  const recoveryLines = (recovery: RecoveryRule | undefined, label: string) => {
    if (!recovery || !recovery.enabled) return [`${label}: não prevista nesta regra.`];
    return [
      `${label}: registrada por ${recovery.instrumentTypeIds.map(typeLabel).join(", ") || "nenhum tipo definido"}${
        recovery.maxScore !== undefined ? `, teto de ${recovery.maxScore}` : ""
      }.`,
      recovery.replacesCategoryIds.length
        ? `Substitui a parcela das categorias: ${recovery.replacesCategoryIds
            .map((id) => rule.categories.find((c) => c.id === id)?.label ?? id)
            .join(", ")}.`
        : "Concorre com o resultado do conjunto, sem substituir categoria específica.",
      `${RECOVERY_PREVALENCE_LABEL[recovery.prevalence]} — forma configurada, não imposta pelo sistema.`,
      "O resultado anterior é preservado em campo próprio e nunca é apagado.",
    ];
  };

  sections.push({
    title: "Recuperação periódica",
    lines: recoveryLines(rule.periodicRecovery, "Recuperação periódica"),
  });

  sections.push({
    title: "Consolidação anual",
    lines: [
      `O ano é consolidado pela ${AGGREGATION_LABEL[rule.annualAggregation.kind]} dos períodos.`,
      rule.requiresAllPeriods
        ? "O resultado anual original só existe com todos os períodos completos."
        : "Períodos incompletos não impedem o fechamento, conforme a regra.",
      ...(rule.annualPeriodWeights ?? []).map(
        (w) => `Peso do período ${w.calendarPeriodId}: ${w.weight}.`,
      ),
      ...rule.parameters.map(
        (p) =>
          `Parâmetro "${p.label}": ${p.value === undefined ? "ainda não informado" : p.value}${
            p.kind === "percentual" ? "%" : ""
          }. É número de referência, não decisão acadêmica.`,
      ),
    ],
  });

  sections.push({
    title: "Recuperação final",
    lines: recoveryLines(rule.finalRecovery, "Recuperação final"),
  });

  sections.push({
    title: "Arredondamento",
    lines: [
      rule.rounding.mode === "sem-arredondamento"
        ? "Nenhum arredondamento é aplicado."
        : `Modo ${rule.rounding.mode}${rule.rounding.decimals !== undefined ? ` com ${rule.rounding.decimals} casa(s)` : ""}${rule.rounding.step ? ` em passos de ${rule.rounding.step}` : ""}.`,
      rule.rounding.applyAt.length
        ? `Aplicado somente em: ${rule.rounding.applyAt.map((p) => ROUNDING_POINT_LABEL[p]).join("; ")}.`
        : "Nenhum momento de aplicação definido: as etapas preservam a precisão integral.",
      "Fora dos momentos declarados, categorias, subtotais e acumulados preservam a precisão.",
    ],
  });

  sections.push({
    title: "Situação normativa",
    lines: [
      rule.status === "homologada"
        ? "Regra homologada: imutável e apta a alimentar o cálculo institucional."
        : "Regra ainda não homologada: alimenta apenas a prévia e a simulação, nunca resultados de alunos.",
      "Situação acadêmica, frequência normativa e Conselho de Classe permanecem fora desta regra.",
    ],
  });

  return sections;
}

// ------------------------------------------------------------- Comparação

export type RuleDifference = {
  area: string;
  label: string;
  kind: "adicionada" | "removida" | "alterada";
  before?: string;
  after?: string;
};

const fmt = (v: unknown) => (v === undefined ? "não definido" : String(v));

/** Comparação estrutural por ID. Renomear não some com a categoria. */
export function compareRules(
  a: InstitutionalAssessmentRule,
  b: InstitutionalAssessmentRule,
): RuleDifference[] {
  const diffs: RuleDifference[] = [];
  const scalar = (area: string, label: string, before: unknown, after: unknown) => {
    if (JSON.stringify(before) !== JSON.stringify(after))
      diffs.push({ area, label, kind: "alterada", before: fmt(before), after: fmt(after) });
  };
  scalar("Identificação", "Nome", a.name, b.name);
  scalar("Identificação", "Ano letivo", a.scope.academicYearId, b.scope.academicYearId);
  scalar("Identificação", "Calendário", a.scope.calendarId, b.scope.calendarId);
  scalar(
    "Identificação",
    "Etapas/modalidades",
    a.scope.stageIds.join(", "),
    b.scope.stageIds.join(", "),
  );
  scalar("Identificação", "Vigência inicial", a.validFrom, b.validFrom);
  scalar("Identificação", "Vigência final", a.validUntil, b.validUntil);
  scalar("Estratégia", "Estratégia", a.strategy, b.strategy);
  scalar("Estratégia", "Admite nota", a.allowsGrades, b.allowsGrades);

  const ids = new Set([...a.categories.map((c) => c.id), ...b.categories.map((c) => c.id)]);
  for (const id of ids) {
    const before = a.categories.find((c) => c.id === id);
    const after = b.categories.find((c) => c.id === id);
    if (before && !after)
      diffs.push({
        area: "Categorias",
        label: before.label,
        kind: "removida",
        before: before.label,
      });
    else if (!before && after)
      diffs.push({
        area: "Categorias",
        label: after.label,
        kind: "adicionada",
        after: after.label,
      });
    else if (before && after) {
      scalar("Categorias", `${after.label} — nome`, before.label, after.label);
      scalar("Categorias", `${after.label} — peso`, before.weight, after.weight);
      scalar(
        "Categorias",
        `${after.label} — tipos de instrumento`,
        before.instrumentTypeIds.join(", "),
        after.instrumentTypeIds.join(", "),
      );
      scalar(
        "Categorias",
        `${after.label} — quantidade mínima`,
        before.minimumEntries,
        after.minimumEntries,
      );
      scalar(
        "Categorias",
        `${after.label} — forma de cálculo`,
        before.aggregation.kind,
        after.aggregation.kind,
      );
      const indexBefore = a.categories.findIndex((c) => c.id === id);
      const indexAfter = b.categories.findIndex((c) => c.id === id);
      scalar("Categorias", `${after.label} — posição`, indexBefore + 1, indexAfter + 1);
    }
  }

  scalar("Período", "Fechamento do período", a.periodAggregation.kind, b.periodAggregation.kind);
  scalar("Período", "Teto do período", a.periodMaxScore, b.periodMaxScore);
  scalar("Anual", "Consolidação anual", a.annualAggregation.kind, b.annualAggregation.kind);
  scalar("Anual", "Exige todos os períodos", a.requiresAllPeriods, b.requiresAllPeriods);
  scalar(
    "Anual",
    "Pesos por período",
    (a.annualPeriodWeights ?? []).map((w) => `${w.calendarPeriodId}:${w.weight}`).join(", "),
    (b.annualPeriodWeights ?? []).map((w) => `${w.calendarPeriodId}:${w.weight}`).join(", "),
  );
  for (const [label, before, after] of [
    ["Recuperação periódica", a.periodicRecovery, b.periodicRecovery],
    ["Recuperação final", a.finalRecovery, b.finalRecovery],
  ] as const) {
    scalar(
      "Recuperação",
      `${label} — habilitada`,
      before?.enabled ?? false,
      after?.enabled ?? false,
    );
    scalar("Recuperação", `${label} — prevalência`, before?.prevalence, after?.prevalence);
    scalar("Recuperação", `${label} — teto`, before?.maxScore, after?.maxScore);
    scalar(
      "Recuperação",
      `${label} — categorias substituídas`,
      (before?.replacesCategoryIds ?? []).join(", "),
      (after?.replacesCategoryIds ?? []).join(", "),
    );
  }
  scalar("Arredondamento", "Modo", a.rounding.mode, b.rounding.mode);
  scalar("Arredondamento", "Casas", a.rounding.decimals, b.rounding.decimals);
  scalar(
    "Arredondamento",
    "Momentos",
    a.rounding.applyAt.join(", "),
    b.rounding.applyAt.join(", "),
  );
  return diffs;
}

// -------------------------------------------------------------- Simulação

export type SandboxInput = {
  /** Valores fictícios por categoria, digitados pela Supervisão. */
  categoryValues: Record<string, number | undefined>;
  /** Valor fictício de recuperação periódica, quando informado. */
  recoveryValue?: number;
};

export type SandboxResult = {
  categories: Array<{ categoryId: string; label: string; stage: NumericStage | null }>;
  period: NumericStage | null;
  recovery: NumericStage | null;
  afterRecovery: NumericStage | null;
  prevalenceLabel: string | null;
  notice: "Simulação — nenhum dado de aluno é utilizado ou alterado.";
  blocked: string | null;
};

/** Simulador puro: recebe números, devolve números. Nunca toca em lançamentos. */
export function simulateRule(
  rule: InstitutionalAssessmentRule,
  input: SandboxInput,
): SandboxResult {
  const notice = "Simulação — nenhum dado de aluno é utilizado ou alterado." as const;
  const model = compositionModelFromRule(rule);
  if (!rule.allowsGrades || rule.usesPedagogicalRecords)
    return {
      categories: [],
      period: null,
      recovery: null,
      afterRecovery: null,
      prevalenceLabel: null,
      notice,
      blocked: "Esta regra não utiliza notas: não há simulação numérica.",
    };
  const categories = rule.categories.map((c) => {
    const value = input.categoryValues[c.id];
    return {
      categoryId: c.id,
      label: c.label,
      stage: value === undefined ? null : roundScore(value, model.rounding, "categoria"),
    };
  });
  const values = categories
    .filter((c) => c.stage !== null)
    .map((c, index) => ({ value: c.stage!.value, weight: rule.categories[index]?.weight ?? 1 }));
  const raw = aggregate(rule.periodAggregation, values);
  const capped =
    raw !== null && rule.periodMaxScore !== undefined ? Math.min(raw, rule.periodMaxScore) : raw;
  const period = capped === null ? null : roundScore(capped, model.rounding, "periodo");
  const recoveryRule = rule.periodicRecovery;
  if (!recoveryRule?.enabled || input.recoveryValue === undefined)
    return {
      categories,
      period,
      recovery: null,
      afterRecovery: period,
      prevalenceLabel: recoveryRule ? RECOVERY_PREVALENCE_LABEL[recoveryRule.prevalence] : null,
      notice,
      blocked: null,
    };
  const cappedRecovery =
    recoveryRule.maxScore !== undefined
      ? Math.min(input.recoveryValue, recoveryRule.maxScore)
      : input.recoveryValue;
  const recovery = roundScore(cappedRecovery, model.rounding, "periodo");
  const combined = prevailValue(recoveryRule.prevalence, period?.value ?? null, recovery.value);
  return {
    categories,
    period,
    recovery,
    afterRecovery: roundScore(combined, model.rounding, "periodo"),
    prevalenceLabel: RECOVERY_PREVALENCE_LABEL[recoveryRule.prevalence],
    notice,
    blocked: null,
  };
}
