/**
 * Etapa 12F — Governança da regra avaliativa institucional.
 *
 * Supervisão configura → revisa → homologa → o sistema utiliza → o histórico
 * preserva. Toda mutação passa por `mutateRule`, único ponto de escrita: estado
 * e capacidade são validados no domínio, nunca apenas escondendo botões.
 *
 * HOMOLOGADA é snapshot imutável: não volta a rascunho, não é sobrescrita.
 * Alterar uma regra homologada significa duplicar como nova versão.
 */
import type {
  AssessmentRuleStatus,
  InstitutionalAssessmentRule,
  RecoveryRule,
  RuleActor,
  RuleAuditAction,
  RuleParameter,
  RuleScope,
} from "./assessment-rule-types";
import type {
  AdministrativeEntryPolicy,
  AggregationRule,
  CompositionCategory,
  RoundingPolicy,
} from "./assessment-composition-types";

export const RULE_STATUS_LABEL: Record<AssessmentRuleStatus, string> = {
  rascunho: "Rascunho",
  "em-revisao": "Em revisão",
  homologada: "Homologada",
  arquivada: "Arquivada",
};

const FROZEN: AssessmentRuleStatus[] = ["homologada", "arquivada"];
export const isRuleImmutable = (rule: InstitutionalAssessmentRule) => FROZEN.includes(rule.status);

export type RuleCapabilities = {
  view: boolean;
  edit: boolean;
  submitForReview: boolean;
  returnToDraft: boolean;
  homologate: boolean;
  archive: boolean;
  duplicate: boolean;
  remove: boolean;
  /** Prévia e simulação são leitura: disponíveis em qualquer estado. */
  preview: boolean;
};

/**
 * RBAC: substituir por autorização do backend quando houver autenticação real.
 * `used` indica que a regra já foi referenciada por lançamentos/turmas.
 */
export function ruleCapabilities(
  actor: RuleActor,
  rule: InstitutionalAssessmentRule | null,
  opts: { used?: boolean } = {},
): RuleCapabilities {
  const sup = actor.role === "supervisao";
  const status = rule?.status;
  const used = opts.used ?? false;
  return {
    view: sup || status === "homologada" || status === "arquivada",
    edit: sup && status === "rascunho",
    submitForReview: sup && status === "rascunho",
    returnToDraft: sup && status === "em-revisao",
    homologate: sup && status === "em-revisao",
    archive: sup && status === "homologada",
    duplicate: sup && rule !== null,
    remove: sup && status === "rascunho" && !used,
    preview: sup || status === "homologada" || status === "arquivada",
  };
}

/** `null` significa LIMPAR o campo; `undefined` significa não alterar. */
export type Clearable<T> = { [K in keyof T]?: T[K] | null };

export type RuleMutation =
  | {
      kind: "identificacao";
      patch: { name?: string; validFrom?: string | null; validUntil?: string | null };
    }
  | { kind: "escopo"; patch: Partial<RuleScope> }
  | {
      kind: "estrategia";
      patch: Partial<
        Pick<
          InstitutionalAssessmentRule,
          | "strategy"
          | "scaleSemantics"
          | "scales"
          | "allowsGrades"
          | "usesPedagogicalRecords"
          | "allowsPromotionDecision"
        >
      >;
    }
  | { kind: "adicionar-categoria"; label: string; id?: string }
  | { kind: "remover-categoria"; categoryId: string }
  | { kind: "atualizar-categoria"; categoryId: string; patch: Clearable<CompositionCategory> }
  | { kind: "mover-categoria"; categoryId: string; direction: -1 | 1 }
  | {
      kind: "composicao-periodo";
      patch: { periodAggregation?: AggregationRule; periodMaxScore?: number | null };
    }
  | {
      kind: "consolidacao-anual";
      patch: Partial<
        Pick<
          InstitutionalAssessmentRule,
          "annualAggregation" | "requiresAllPeriods" | "annualPeriodWeights"
        >
      >;
    }
  | { kind: "recuperacao-periodica"; recovery: RecoveryRule | null }
  | { kind: "recuperacao-final"; recovery: RecoveryRule | null }
  | { kind: "arredondamento"; patch: Clearable<RoundingPolicy> }
  | { kind: "valores-administrativos"; patch: Partial<AdministrativeEntryPolicy> }
  | { kind: "parametro"; parameter: RuleParameter }
  | { kind: "remover-parametro"; parameterId: string };

export type RuleMutationResult =
  { ok: true; rule: InstitutionalAssessmentRule } | { ok: false; reason: string };

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj as object)) deepFreeze(v);
  }
  return obj;
}

const now = () => new Date().toISOString();

function registerEvent(
  rule: InstitutionalAssessmentRule,
  actor: RuleActor,
  action: RuleAuditAction,
  detail: string,
) {
  return [
    ...rule.audit.events,
    { at: now(), actorId: actor.id, actorName: actor.name, action, detail },
  ];
}

function describe(m: RuleMutation): string {
  switch (m.kind) {
    case "identificacao":
      return "Identificação da regra alterada.";
    case "escopo":
      return "Contexto de aplicação alterado.";
    case "estrategia":
      return "Estratégia avaliativa alterada.";
    case "adicionar-categoria":
      return `Categoria "${m.label}" adicionada.`;
    case "remover-categoria":
      return "Categoria removida.";
    case "atualizar-categoria":
      return "Categoria alterada (identificador preservado).";
    case "mover-categoria":
      return "Ordem das categorias alterada (identificadores preservados).";
    case "composicao-periodo":
      return "Composição do período alterada.";
    case "consolidacao-anual":
      return "Consolidação anual alterada.";
    case "recuperacao-periodica":
      return m.recovery ? "Recuperação periódica configurada." : "Recuperação periódica removida.";
    case "recuperacao-final":
      return m.recovery ? "Recuperação final configurada." : "Recuperação final removida.";
    case "arredondamento":
      return "Regra ou momento de arredondamento alterado.";
    case "valores-administrativos":
      return "Política de valores administrativos alterada.";
    case "parametro":
      return `Parâmetro institucional "${m.parameter.label}" definido.`;
    case "remover-parametro":
      return "Parâmetro institucional removido.";
  }
}

/** Aplica a mutação estrutural, já validado o estado e a capacidade. */
function apply(
  rule: InstitutionalAssessmentRule,
  m: RuleMutation,
): InstitutionalAssessmentRule | { error: string } {
  switch (m.kind) {
    case "identificacao":
      return merge(rule, m.patch);
    case "escopo":
      return { ...rule, scope: merge(rule.scope, m.patch) };
    case "estrategia":
      return merge(rule, m.patch);
    case "adicionar-categoria": {
      const label = m.label.trim();
      const id = m.id ?? `cat-${crypto.randomUUID().slice(0, 8)}`;
      if (rule.categories.some((c) => c.id === id))
        return { error: "Identificador de categoria duplicado." };
      const category: CompositionCategory = {
        id,
        label,
        instrumentTypeIds: [],
        weight: 1,
        aggregation: { kind: "soma" },
      };
      return { ...rule, categories: [...rule.categories, category] };
    }
    case "remover-categoria": {
      if (!rule.categories.some((c) => c.id === m.categoryId))
        return { error: "Categoria inexistente." };
      const categories = rule.categories.filter((c) => c.id !== m.categoryId);
      // Referências de recuperação seguem por ID: a remoção limpa a referência.
      const clean = (r?: RecoveryRule) =>
        r
          ? {
              ...r,
              replacesCategoryIds: r.replacesCategoryIds.filter((id) => id !== m.categoryId),
            }
          : undefined;
      return {
        ...rule,
        categories,
        ...optional("periodicRecovery", clean(rule.periodicRecovery)),
        ...optional("finalRecovery", clean(rule.finalRecovery)),
      };
    }
    case "atualizar-categoria": {
      if (!rule.categories.some((c) => c.id === m.categoryId))
        return { error: "Categoria inexistente." };
      // O identificador NUNCA muda ao renomear ou ajustar parâmetros.
      const { id: _ignored, ...patch } = m.patch;
      return {
        ...rule,
        categories: rule.categories.map((c) => (c.id === m.categoryId ? merge(c, patch) : c)),
      };
    }
    case "mover-categoria": {
      const index = rule.categories.findIndex((c) => c.id === m.categoryId);
      if (index < 0) return { error: "Categoria inexistente." };
      const target = index + m.direction;
      if (target < 0 || target >= rule.categories.length) return { error: "Já está no limite." };
      const categories = [...rule.categories];
      const [moved] = categories.splice(index, 1);
      categories.splice(target, 0, moved!);
      return { ...rule, categories };
    }
    case "composicao-periodo":
      return merge(rule, m.patch);
    case "consolidacao-anual":
      return merge(rule, m.patch);
    case "recuperacao-periodica":
      return { ...rule, ...optional("periodicRecovery", m.recovery ?? undefined) };
    case "recuperacao-final":
      return { ...rule, ...optional("finalRecovery", m.recovery ?? undefined) };
    case "arredondamento":
      return { ...rule, rounding: merge(rule.rounding, m.patch) };
    case "valores-administrativos":
      return {
        ...rule,
        administrativeEntries: merge(rule.administrativeEntries, m.patch),
      };
    case "parametro": {
      const exists = rule.parameters.some((p) => p.id === m.parameter.id);
      return {
        ...rule,
        parameters: exists
          ? rule.parameters.map((p) => (p.id === m.parameter.id ? { ...p, ...m.parameter } : p))
          : [...rule.parameters, m.parameter],
      };
    }
    case "remover-parametro":
      return { ...rule, parameters: rule.parameters.filter((p) => p.id !== m.parameterId) };
  }
}

/**
 * Aplica o patch: `undefined` não altera, `null` limpa o campo (a ausência é
 * preservada como ausência — nada é preenchido por conta do sistema).
 */
function merge<T extends object>(base: T, patch: object): T {
  const next = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next as T;
}

function optional<K extends string, V>(key: K, value: V | undefined) {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };
}

export function mutateRule(
  rule: InstitutionalAssessmentRule,
  actor: RuleActor,
  m: RuleMutation,
): RuleMutationResult {
  if (actor.role !== "supervisao")
    return {
      ok: false,
      reason: "Somente a Supervisão de Ensino configura regras avaliativas da rede.",
    };
  if (rule.status === "homologada")
    return {
      ok: false,
      reason: "Regra homologada é imutável. Para alterar, duplique como nova versão em rascunho.",
    };
  if (rule.status === "arquivada")
    return { ok: false, reason: "Regra arquivada é somente leitura." };
  if (rule.status === "em-revisao")
    return {
      ok: false,
      reason: "Regra em revisão está bloqueada para edição. Devolva ao rascunho para alterar.",
    };
  const applied = apply(rule, m);
  if ("error" in applied) return { ok: false, reason: applied.error };
  return {
    ok: true,
    rule: deepFreeze({
      ...applied,
      audit: {
        ...applied.audit,
        updatedBy: actor.id,
        updatedByName: actor.name,
        updatedAt: now(),
        events: registerEvent(rule, actor, "alterada", describe(m)),
      },
    }),
  };
}

export type RuleTransition = "enviar-revisao" | "devolver-rascunho" | "homologar" | "arquivar";

export function transitionRule(
  rule: InstitutionalAssessmentRule,
  actor: RuleActor,
  t: RuleTransition,
  opts: { blockingErrors?: number } = {},
): RuleMutationResult {
  const caps = ruleCapabilities(actor, rule);
  const at = now();
  const blocking = opts.blockingErrors ?? 0;
  switch (t) {
    case "enviar-revisao": {
      if (!caps.submitForReview)
        return { ok: false, reason: "Só um rascunho da Supervisão pode ir para revisão." };
      if (blocking > 0)
        return {
          ok: false,
          reason: "Existem inconsistências que impedem o envio para revisão.",
        };
      return commit(rule, actor, "em-revisao", "enviada-revisao", "Regra enviada para revisão.", {
        submittedBy: actor.id,
        submittedByName: actor.name,
        submittedAt: at,
      });
    }
    case "devolver-rascunho": {
      if (rule.status === "homologada")
        return {
          ok: false,
          reason: "Regra homologada não retorna a rascunho. Duplique como nova versão.",
        };
      if (!caps.returnToDraft)
        return { ok: false, reason: "Apenas uma regra em revisão pode voltar ao rascunho." };
      return commit(
        rule,
        actor,
        "rascunho",
        "devolvida-rascunho",
        "Regra devolvida ao rascunho para ajustes.",
        {},
      );
    }
    case "homologar": {
      if (!caps.homologate)
        return {
          ok: false,
          reason: "A homologação exige uma regra em revisão e capacidade de Supervisão.",
        };
      if (blocking > 0)
        return { ok: false, reason: "Existem inconsistências que impedem a homologação." };
      return commit(rule, actor, "homologada", "homologada", "Regra homologada para a rede.", {
        homologatedBy: actor.id,
        homologatedByName: actor.name,
        homologatedAt: at,
      });
    }
    case "arquivar": {
      if (!caps.archive)
        return { ok: false, reason: "Somente uma regra homologada pode ser arquivada." };
      return commit(rule, actor, "arquivada", "arquivada", "Regra arquivada para consulta.", {
        archivedBy: actor.id,
        archivedByName: actor.name,
        archivedAt: at,
      });
    }
  }
}

function commit(
  rule: InstitutionalAssessmentRule,
  actor: RuleActor,
  status: AssessmentRuleStatus,
  action: RuleAuditAction,
  detail: string,
  audit: Partial<InstitutionalAssessmentRule["audit"]>,
): RuleMutationResult {
  return {
    ok: true,
    rule: deepFreeze({
      ...rule,
      status,
      audit: { ...rule.audit, ...audit, events: registerEvent(rule, actor, action, detail) },
    }),
  };
}

/**
 * Duplicação: gera SEMPRE novo identificador e novo rascunho, preservando o
 * original intacto. É o único caminho para alterar uma regra homologada.
 */
export function duplicateRule(
  rule: InstitutionalAssessmentRule,
  actor: RuleActor,
  opts: { academicYearId?: string; calendarId?: string; name?: string; id?: string } = {},
): RuleMutationResult {
  if (actor.role !== "supervisao")
    return { ok: false, reason: "Somente a Supervisão de Ensino duplica regras avaliativas." };
  const at = now();
  const id = opts.id ?? `rav-${crypto.randomUUID().slice(0, 8)}`;
  const scope: RuleScope = {
    ...rule.scope,
    ...(opts.academicYearId ? { academicYearId: opts.academicYearId } : {}),
    ...(opts.calendarId ? { calendarId: opts.calendarId } : {}),
  };
  // Trocar de calendário invalida pesos por período: exigem decisão humana.
  const keepWeights = scope.calendarId === rule.scope.calendarId;
  const copy: InstitutionalAssessmentRule = {
    ...structuredClone(rule),
    id,
    name: opts.name ?? `${rule.name} (nova versão)`,
    version: rule.version + 1,
    status: "rascunho",
    scope,
    ...(keepWeights ? {} : { annualPeriodWeights: [] }),
    originRuleId: rule.id,
    originVersion: rule.version,
    audit: {
      createdBy: actor.id,
      createdByName: actor.name,
      createdAt: at,
      events: [
        {
          at,
          actorId: actor.id,
          actorName: actor.name,
          action: "duplicada" as RuleAuditAction,
          detail: `Duplicada de "${rule.name}" (versão ${rule.version}).`,
        },
      ],
      demonstrative: true,
    },
  };
  return { ok: true, rule: deepFreeze(copy) };
}

/** Exclusão: apenas rascunho nunca utilizado. */
export function canRemoveRule(rule: InstitutionalAssessmentRule, used: boolean) {
  if (rule.status !== "rascunho")
    return { allowed: false, reason: "Apenas um rascunho pode ser excluído." };
  if (used)
    return { allowed: false, reason: "A regra já foi utilizada e permanece para o histórico." };
  return { allowed: true, reason: "" };
}

/**
 * Criação de um rascunho vazio. Nenhum parâmetro avaliativo é presumido:
 * a regra nasce sem categorias, sem recuperação e sem arredondamento.
 */
export function createRule(
  actor: RuleActor,
  input: {
    id?: string;
    name: string;
    academicYearId: string;
    calendarId: string;
    stageIds?: string[];
    strategy?: InstitutionalAssessmentRule["strategy"];
  },
): RuleMutationResult {
  if (actor.role !== "supervisao")
    return { ok: false, reason: "Somente a Supervisão de Ensino cria regras avaliativas." };
  const at = now();
  const numeric = (input.strategy ?? "quantitativa") !== "acompanhamento";
  const rule: InstitutionalAssessmentRule = {
    id: input.id ?? `rav-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name,
    version: 1,
    status: "rascunho",
    scope: {
      academicYearId: input.academicYearId,
      calendarId: input.calendarId,
      stageIds: input.stageIds ?? [],
    },
    strategy: input.strategy ?? "quantitativa",
    scaleSemantics: numeric ? "quantitativa" : "descritiva",
    scales: numeric ? [] : [{ kind: "descritiva" }],
    allowsGrades: numeric,
    usesPedagogicalRecords: !numeric,
    allowsPromotionDecision: false,
    categories: [],
    periodAggregation: { kind: "soma" },
    annualAggregation: { kind: "soma" },
    requiresAllPeriods: true,
    annualPeriodWeights: [],
    rounding: {
      id: `arr-${crypto.randomUUID().slice(0, 6)}`,
      mode: "sem-arredondamento",
      applyAt: [],
      normativeStatus: "pendente",
    },
    administrativeEntries: { accepted: false, acceptedOrigins: [], normativeStatus: "pendente" },
    parameters: [],
    audit: {
      createdBy: actor.id,
      createdByName: actor.name,
      createdAt: at,
      events: [
        {
          at,
          actorId: actor.id,
          actorName: actor.name,
          action: "criada",
          detail: "Rascunho criado pela Supervisão de Ensino.",
        },
      ],
      demonstrative: true,
    },
  };
  return { ok: true, rule: deepFreeze(rule) };
}
