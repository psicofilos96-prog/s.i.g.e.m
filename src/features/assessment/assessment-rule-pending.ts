/**
 * Etapa 12F.1 — Definições normativas PENDENTES de uma regra avaliativa.
 *
 * Três planos permanecem distintos:
 * 1. CAPACIDADE — o que o domínio é capaz de representar;
 * 2. CONFIGURADO — o que a Supervisão já decidiu e cadastrou;
 * 3. PENDENTE DE DEFINIÇÃO — o que a rede ainda não decidiu.
 *
 * Ausência de informação NUNCA é convertida em configuração provisória: os
 * campos permanecem indefinidos e são listados aqui para a Supervisão. Nenhuma
 * pendência é resolvida pelo sistema.
 *
 * Pendência `required` impede envio para revisão e homologação.
 */
import type { InstitutionalAssessmentRule, RecoveryRule } from "./assessment-rule-types";

export type RulePendingArea =
  | "vigencia"
  | "categorias"
  | "anual"
  | "recuperacao-periodica"
  | "recuperacao-final"
  | "arredondamento";

export type RulePendingDefinition = {
  code: string;
  area: RulePendingArea;
  label: string;
  detail: string;
  /** Impede revisão e homologação enquanto não for definida. */
  required: boolean;
};

const recoveryPending = (
  recovery: RecoveryRule | undefined,
  area: "recuperacao-periodica" | "recuperacao-final",
  label: string,
): RulePendingDefinition[] => {
  if (!recovery || !recovery.enabled) return [];
  const items: RulePendingDefinition[] = [];
  if (!recovery.prevalence)
    items.push({
      code: `${area}-prevalencia`,
      area,
      label: `${label}: forma de prevalência`,
      detail:
        "A rede ainda não definiu como o resultado da recuperação se relaciona com o resultado anterior.",
      required: true,
    });
  if (!recovery.aggregation)
    items.push({
      code: `${area}-formula`,
      area,
      label: `${label}: consolidação entre múltiplos instrumentos`,
      detail:
        "Um único registro de recuperação é usado como está; com mais de um, a forma de consolidação ainda não foi definida e nada é presumido.",
      required: true,
    });
  if (!recovery.eligibility)
    items.push({
      code: `${area}-gatilho`,
      area,
      label: `${label}: critério de acesso`,
      detail:
        "Ainda não foi informado quem tem direito à recuperação nem se existe patamar de corte.",
      required: true,
    });
  else if (recovery.eligibility.kind === "limite-de-pontuacao" && !recovery.eligibility.threshold)
    items.push({
      code: `${area}-patamar`,
      area,
      label: `${label}: patamar de corte`,
      detail: "O critério é por pontuação, mas o valor de corte ainda não foi informado.",
      required: true,
    });
  else if (recovery.eligibility.kind === "limite-de-pontuacao" && !recovery.eligibility.basis)
    items.push({
      code: `${area}-base`,
      area,
      label: `${label}: valor comparado ao patamar`,
      detail: "Ainda não foi informado qual resultado é comparado ao patamar de corte.",
      required: true,
    });
  else if (
    recovery.eligibility.kind === "abaixo-do-minimo-anual" &&
    !recovery.eligibility.minimumParameterId
  )
    items.push({
      code: `${area}-minimo-anual`,
      area,
      label: `${label}: mínimo anual exigido`,
      detail:
        "O direito deriva do mínimo anual da regra de situação acadêmica, que ainda não foi cadastrada. Nenhum número é presumido.",
      required: true,
    });
  if (recovery.scope === "anual" && recovery.maxScore === undefined)
    items.push({
      code: `${area}-teto`,
      area,
      label: `${label}: teto ou escala`,
      detail: "O teto da recuperação ainda não foi confirmado normativamente.",
      required: true,
    });
  if (recovery.instrumentTypeIds.length === 0)
    items.push({
      code: `${area}-instrumentos`,
      area,
      label: `${label}: tipos de instrumento que a registram`,
      detail: "Nenhum tipo foi vinculado; o sistema não presume qual instrumento a registra.",
      required: false,
    });
  return items;
};

/** Lista as definições normativas ainda ausentes. Não altera nem presume nada. */
export function pendingRuleDefinitions(rule: InstitutionalAssessmentRule): RulePendingDefinition[] {
  const numeric = rule.allowsGrades && !rule.usesPedagogicalRecords;
  const items: RulePendingDefinition[] = [];

  if (!rule.validFrom)
    items.push({
      code: "vigencia-inicio",
      area: "vigencia",
      label: "Ano letivo de início da vigência",
      detail: "Ainda não foi decidido a partir de qual ciclo letivo esta regra vigora.",
      required: true,
    });

  if (numeric && !rule.annualAggregation)
    items.push({
      code: "anual-consolidacao",
      area: "anual",
      label: "Forma de consolidação anual",
      detail:
        "Pendente de definição normativa. Enquanto isso, qualquer cálculo anual permanece bloqueado.",
      required: true,
    });

  if (numeric && rule.rounding.mode !== "sem-arredondamento" && rule.rounding.applyAt.length === 0)
    items.push({
      code: "arredondamento-momento",
      area: "arredondamento",
      label: "Momento institucional do arredondamento",
      detail:
        "A regra matemática está definida; os fechamentos em que ela se aplica ainda não foram decididos.",
      required: true,
    });

  items.push(
    ...recoveryPending(rule.periodicRecovery, "recuperacao-periodica", "Recuperação periódica"),
  );
  items.push(...recoveryPending(rule.finalRecovery, "recuperacao-final", "Recuperação final"));

  for (const category of rule.categories) {
    if (category.instrumentTypePolicy === undefined)
      items.push({
        code: `categoria-tipos-${category.id}`,
        area: "categorias",
        label: `${category.label}: restrição de tipos de instrumento`,
        detail:
          "Ainda não foi definido se a categoria aceita qualquer tipo ou apenas tipos declarados.",
        required: false,
      });
    if (category.minimumEntries === undefined)
      items.push({
        code: `categoria-minimo-${category.id}`,
        area: "categorias",
        label: `${category.label}: quantidade mínima de registros, caso exista`,
        detail: "Nenhum número é presumido: a categoria não exige quantidade alguma hoje.",
        required: false,
      });
  }

  return items;
}

export const requiredPendingDefinitions = (rule: InstitutionalAssessmentRule) =>
  pendingRuleDefinitions(rule).filter((item) => item.required);

/** Rascunho incompleto: existe, é válido como rascunho, e não avança. */
export const isRuleIncomplete = (rule: InstitutionalAssessmentRule) =>
  requiredPendingDefinitions(rule).length > 0;

export const RULE_INCOMPLETE_NOTICE =
  "Regra em elaboração — possui definições normativas pendentes.";
