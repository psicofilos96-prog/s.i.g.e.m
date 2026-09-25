/**
 * Etapa 12F — Validador estrutural da regra avaliativa.
 *
 * Erros impedem envio para revisão e homologação. Avisos informam sem bloquear.
 * O validador NUNCA corrige decisão pedagógica e NUNCA presume valor ausente
 * (quantidade mínima indefinida permanece indefinida).
 */
import type { NetworkCalendar } from "@/features/calendar/calendar-types";
import { pendingRuleDefinitions, type RulePendingDefinition } from "./assessment-rule-pending";
import type { InstitutionalAssessmentRule, RecoveryRule } from "./assessment-rule-types";

export type RuleIssue = {
  code: string;
  message: string;
  area:
    | "identificacao"
    | "estrategia"
    | "categorias"
    | "periodo"
    | "anual"
    | "recuperacao"
    | "arredondamento";
  categoryId?: string;
};

export type RuleValidation = {
  errors: RuleIssue[];
  warnings: RuleIssue[];
  /** Definições normativas ainda ausentes; as obrigatórias bloqueiam o avanço. */
  pending: RulePendingDefinition[];
  requiredPending: RulePendingDefinition[];
  /** Sem erros bloqueantes E sem pendência obrigatória. Não significa homologada. */
  ok: boolean;
};

export type RuleValidationContext = {
  calendar?: NetworkCalendar | undefined;
  instrumentTypeIds: readonly string[];
};

export function validateRule(
  rule: InstitutionalAssessmentRule,
  ctx: RuleValidationContext,
): RuleValidation {
  const errors: RuleIssue[] = [];
  const warnings: RuleIssue[] = [];
  const error = (code: string, area: RuleIssue["area"], message: string, categoryId?: string) =>
    errors.push({ code, area, message, ...(categoryId ? { categoryId } : {}) });
  const warn = (code: string, area: RuleIssue["area"], message: string) =>
    warnings.push({ code, area, message });

  // ------------------------------------------------- Identificação e contexto
  if (!rule.name.trim()) error("nome-vazio", "identificacao", "A regra precisa de um nome.");
  if (!rule.scope.academicYearId)
    error("sem-ano", "identificacao", "A regra precisa declarar o ano letivo de aplicação.");
  if (!rule.scope.calendarId)
    error(
      "sem-calendario",
      "identificacao",
      "A regra precisa referenciar o calendário escolar da rede que define os períodos.",
    );
  if (rule.scope.stageIds.length === 0 && (rule.scope.classIds ?? []).length === 0)
    error(
      "sem-contexto",
      "identificacao",
      "A regra precisa declarar a quais etapas/modalidades ou turmas se aplica.",
    );
  if (ctx.calendar && ctx.calendar.academicYearId !== rule.scope.academicYearId)
    error(
      "calendario-outro-ano",
      "identificacao",
      "O calendário referenciado pertence a outro ano letivo.",
    );
  if (rule.validFrom && rule.validUntil && rule.validFrom > rule.validUntil)
    error("vigencia-invertida", "identificacao", "O início da vigência é posterior ao término.");
  if (!rule.validFrom || !rule.validUntil)
    warn("vigencia-indefinida", "identificacao", "Vigência ainda não delimitada.");

  // -------------------------------------------------------------- Estratégia
  const numeric = rule.allowsGrades && !rule.usesPedagogicalRecords;
  if (rule.allowsGrades && rule.scales.length === 0)
    error("sem-escala", "estrategia", "Estratégia com nota exige ao menos uma escala definida.");
  if (!numeric) {
    if (rule.categories.length > 0)
      error(
        "acompanhamento-com-categorias",
        "estrategia",
        "Estratégia de acompanhamento pedagógico não admite categorias numéricas.",
      );
    if (rule.periodicRecovery?.enabled || rule.finalRecovery?.enabled)
      error(
        "acompanhamento-com-recuperacao",
        "estrategia",
        "Estratégia de acompanhamento pedagógico não admite recuperação numérica.",
      );
    if (rule.periodMaxScore !== undefined)
      error(
        "acompanhamento-com-teto",
        "estrategia",
        "Estratégia de acompanhamento pedagógico não admite teto de pontuação.",
      );
    if (rule.allowsPromotionDecision)
      warn(
        "acompanhamento-com-promocao",
        "estrategia",
        "Acompanhamento pedagógico normalmente não decide promoção; confirme a intenção.",
      );
  }

  // -------------------------------------------------------------- Categorias
  const ids = new Set<string>();
  for (const category of rule.categories) {
    if (!category.label.trim())
      error("categoria-sem-nome", "categorias", "Categoria sem nome.", category.id);
    if (ids.has(category.id))
      error(
        "categoria-id-duplicado",
        "categorias",
        `Identificador de categoria duplicado: ${category.id}.`,
        category.id,
      );
    ids.add(category.id);
    if (category.weight < 0)
      error("peso-negativo", "categorias", `Peso inválido em "${category.label}".`, category.id);
    const unknown = category.instrumentTypeIds.filter((id) => !ctx.instrumentTypeIds.includes(id));
    if (unknown.length)
      error(
        "tipo-instrumento-inexistente",
        "categorias",
        `Tipo de instrumento inexistente em "${category.label}": ${unknown.join(", ")}.`,
        category.id,
      );
    // Só é erro quando a própria regra declarou que exige tipos específicos.
    if (
      numeric &&
      category.instrumentTypePolicy === "tipos-declarados" &&
      category.instrumentTypeIds.length === 0
    )
      error(
        "categoria-sem-instrumento",
        "categorias",
        `A categoria "${category.label}" exige tipos declarados, mas nenhum tipo foi vinculado.`,
        category.id,
      );
    if (category.minimumEntries !== undefined && category.minimumEntries <= 0)
      error(
        "quantidade-minima-invalida",
        "categorias",
        `Quantidade mínima inválida em "${category.label}".`,
        category.id,
      );
  }
  if (numeric && rule.categories.length === 0)
    error("sem-categorias", "categorias", "Regra numérica sem nenhuma categoria de composição.");

  // ------------------------------------------------- Período e consolidação
  if (rule.periodMaxScore !== undefined && rule.periodMaxScore <= 0)
    error("teto-invalido", "periodo", "O teto do período precisa ser maior que zero.");
  if (rule.periodAggregation.kind === "media-ponderada" && numeric) {
    const total = rule.categories.reduce((s, c) => s + c.weight, 0);
    if (total <= 0)
      error("pesos-inconsistentes", "periodo", "Composição ponderada sem pesos definidos.");
  }
  const calendarPeriodIds = (ctx.calendar?.periods ?? []).map((p) => p.id);
  for (const weight of rule.cyclePeriodWeights ?? []) {
    if (ctx.calendar && !calendarPeriodIds.includes(weight.calendarPeriodId))
      error(
        "periodo-de-outro-calendario",
        "anual",
        `O período ${weight.calendarPeriodId} não pertence ao calendário referenciado.`,
      );
    if (weight.weight < 0) error("peso-periodo-negativo", "anual", "Peso de período inválido.");
  }
  if (
    rule.cycleAggregation?.kind === "media-ponderada" &&
    (rule.cyclePeriodWeights ?? []).length === 0
  )
    error(
      "anual-ponderada-sem-pesos",
      "anual",
      "Consolidação anual ponderada exige pesos por período.",
    );
  if (numeric && ctx.calendar && ctx.calendar.periods.length === 0)
    error("calendario-sem-periodos", "anual", "O calendário referenciado não possui períodos.");

  // ------------------------------------------------------------ Recuperação
  const checkRecovery = (recovery: RecoveryRule | undefined, label: string) => {
    if (!recovery) {
      warn(
        "recuperacao-ausente",
        "recuperacao",
        `${label} não configurada. Nenhuma recuperação é presumida.`,
      );
      return;
    }
    if (!recovery.enabled) {
      warn("recuperacao-desabilitada", "recuperacao", `${label} desabilitada nesta regra.`);
      return;
    }
    const unknownCategories = recovery.replacesCategoryIds.filter((id) => !ids.has(id));
    if (unknownCategories.length)
      error(
        "recuperacao-categoria-inexistente",
        "recuperacao",
        `${label} referencia categoria inexistente: ${unknownCategories.join(", ")}.`,
      );
    const unknownTypes = recovery.instrumentTypeIds.filter(
      (id) => !ctx.instrumentTypeIds.includes(id),
    );
    if (unknownTypes.length)
      error(
        "recuperacao-tipo-inexistente",
        "recuperacao",
        `${label} referencia tipo de instrumento inexistente: ${unknownTypes.join(", ")}.`,
      );
    // Sem tipo vinculado a recuperação permanece PENDENTE, não inválida:
    // nenhum instrumento é presumido enquanto a rede não definir.
    if (recovery.instrumentTypeIds.length === 0)
      warn(
        "recuperacao-sem-instrumento",
        "recuperacao",
        `${label} habilitada sem tipo de instrumento definido. Nenhum tipo é presumido.`,
      );
    if (recovery.maxScore !== undefined && recovery.maxScore <= 0)
      error("recuperacao-teto-invalido", "recuperacao", `Teto inválido em ${label}.`);
  };
  if (numeric) {
    checkRecovery(rule.periodicRecovery, "Recuperação periódica");
    checkRecovery(rule.finalRecovery, "Recuperação final");
  }

  // ---------------------------------------------------------- Arredondamento
  const points = rule.rounding.applyAt;
  if (rule.rounding.mode !== "sem-arredondamento" && points.length === 0)
    warn(
      "arredondamento-sem-momento",
      "arredondamento",
      "Regra de arredondamento definida sem momento de aplicação: nada será arredondado.",
    );
  if (points.includes("categoria") && rule.categories.length === 0)
    error(
      "arredondamento-etapa-inexistente",
      "arredondamento",
      "O arredondamento aponta para o fechamento de categorias, mas a regra não tem categorias.",
    );
  if (points.length > 0 && !numeric)
    error(
      "arredondamento-sem-nota",
      "arredondamento",
      "Regra sem nota não pode declarar momentos de arredondamento.",
    );
  if (rule.rounding.mode === "passo" && !rule.rounding.step)
    error("arredondamento-sem-passo", "arredondamento", "Arredondamento por passo exige o passo.");

  // --------------------------------------------------------------- Parâmetros
  for (const parameter of rule.parameters)
    if (parameter.value === undefined)
      warn(
        "parametro-sem-valor",
        "identificacao",
        `Parâmetro institucional "${parameter.label}" ainda não preenchido.`,
      );

  const pending = pendingRuleDefinitions(rule);
  const requiredPending = pending.filter((item) => item.required);
  return {
    errors,
    warnings,
    pending,
    requiredPending,
    ok: errors.length === 0 && requiredPending.length === 0,
  };
}
