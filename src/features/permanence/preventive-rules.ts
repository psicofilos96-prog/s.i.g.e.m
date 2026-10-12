/**
 * L03 Permanência — motor de regras preventivas (migration 0394).
 * Regras são DADO versionado (`permanence_rule_versions`) com fonte, vigência e
 * aprovação por pessoa ≠ autor (`permanence_rule_approvals`). O motor só conhece
 * primitivas sobre a projeção L02; etapa/modalidade/período são eixos abertos.
 * Saída é HIPÓTESE para verificação humana: nunca diagnóstico nem rótulo de evasão.
 */
import type { Monitoring, Trend } from "./attendance-monitoring";

export type Condition =
  | { primitive: "taxa-faltas-acima"; value: number; minMarked: number }
  | { primitive: "faltas-consecutivas-min"; value: number }
  | { primitive: "faltas-acumuladas-min"; value: number }
  | { primitive: "tendencia-piora"; minMarked: number; tolerance: number };

export type ScopeAxis = "etapa" | "modalidade" | "periodo";
export interface RuleVersion {
  id: string; ruleKey: string; version: number; title: string;
  scope: Partial<Record<ScopeAxis, string>>; conditions: readonly Condition[];
  combine: "todas" | "qualquer"; sourceRef: string; validFrom: string; validTo: string | null;
  authorPerson: string;
}
export interface Approval { ruleVersionId: string; verdict: "aprovada" | "recusada"; decisionRef: string; approverPerson: string }
export type Context = Partial<Record<ScopeAxis, string>>;

export const validCondition = (c: Condition): boolean => {
  switch (c.primitive) {
    case "taxa-faltas-acima": return c.value > 0 && c.value < 1 && Number.isInteger(c.minMarked) && c.minMarked >= 1;
    case "faltas-consecutivas-min": case "faltas-acumuladas-min": return Number.isInteger(c.value) && c.value >= 1;
    case "tendencia-piora": return Number.isInteger(c.minMarked) && c.minMarked >= 1 && c.tolerance >= 0;
    default: return false;
  }
};

const approvedOk = (r: RuleVersion, a: Approval | undefined) =>
  !!a && a.verdict === "aprovada" && a.approverPerson !== r.authorPerson && a.decisionRef.trim().length >= 3;

/** Aplica-se se vigente na data e cada eixo declarado coincide; contexto ausente nunca corresponde. */
const matches = (r: RuleVersion, ctx: Context, on: string) =>
  r.validFrom <= on && (r.validTo === null || on <= r.validTo) &&
  (Object.entries(r.scope) as [ScopeAxis, string][]).every(([k, v]) => ctx[k] !== undefined && ctx[k] === v);

export type Resolution =
  | { kind: "aplicavel"; rule: RuleVersion; approval: Approval }
  | { kind: "sem-regra" }
  | { kind: "ambigua"; candidates: string[] };

/** Por chave, só a última versão aprovada vigente; duas chaves com o mesmo escopo mais específico ⇒ ambígua. */
export function resolveRules(rules: readonly RuleVersion[], approvals: readonly Approval[], ctx: Context, on: string): Resolution[] {
  const appr = new Map(approvals.map((a) => [a.ruleVersionId, a]));
  const byKey = new Map<string, RuleVersion>();
  for (const r of rules) {
    if (!approvedOk(r, appr.get(r.id)) || !matches(r, ctx, on) || !r.conditions.every(validCondition)) continue;
    const cur = byKey.get(r.ruleKey);
    if (!cur || r.version > cur.version) byKey.set(r.ruleKey, r);
  }
  if (byKey.size === 0) return [{ kind: "sem-regra" }];
  // conflito: mesma combinação de primitivas com escopos de mesma especificidade em chaves distintas
  const sig = (r: RuleVersion) => r.conditions.map((c) => c.primitive).sort().join("+") + "|" + Object.keys(r.scope).length;
  const groups = new Map<string, RuleVersion[]>();
  for (const r of byKey.values()) groups.set(sig(r), [...(groups.get(sig(r)) ?? []), r]);
  return [...groups.values()].map((g) => g.length > 1
    ? { kind: "ambigua", candidates: g.map((r) => `${r.ruleKey}@v${r.version}`).sort() }
    : { kind: "aplicavel", rule: g[0]!, approval: appr.get(g[0]!.id)! });
}

export type Outcome = "atende" | "nao-atende" | "indeterminado";
export interface ConditionResult { primitive: Condition["primitive"]; outcome: Outcome; observed: number | null; reason: string }

function evalCondition(c: Condition, m: Monitoring, trend: Trend | null): ConditionResult {
  if (m.status !== "ok") return { primitive: c.primitive, outcome: "indeterminado", observed: null, reason: "Calendário ou vigência não lidos." };
  switch (c.primitive) {
    case "taxa-faltas-acima":
      if (m.rate === null || m.marked < c.minMarked) return { primitive: c.primitive, outcome: "indeterminado", observed: m.rate, reason: "Lançamentos abaixo da base mínima da regra." };
      return { primitive: c.primitive, outcome: m.rate > c.value ? "atende" : "nao-atende", observed: m.rate, reason: "Faltas sobre aulas com lançamento." };
    case "faltas-consecutivas-min":
      return { primitive: c.primitive, outcome: m.consecutiveAbsences >= c.value ? "atende" : (m.streakInterruptedByMissingRecord ? "indeterminado" : "nao-atende"),
        observed: m.consecutiveAbsences, reason: m.streakInterruptedByMissingRecord ? "Sequência interrompida por aula sem lançamento." : "Sequência atual de faltas lançadas." };
    case "faltas-acumuladas-min":
      return { primitive: c.primitive, outcome: m.absent >= c.value ? "atende" : (m.unmarked > 0 && m.absent + m.unmarked >= c.value ? "indeterminado" : "nao-atende"),
        observed: m.absent, reason: "Faltas lançadas; aula sem lançamento não conta." };
    case "tendencia-piora":
      if (!trend || trend.kind === "indeterminada") return { primitive: c.primitive, outcome: "indeterminado", observed: null, reason: trend?.kind === "indeterminada" ? trend.reason : "Tendência não calculada." };
      return { primitive: c.primitive, outcome: trend.kind === "piora" && trend.delta > c.tolerance ? "atende" : "nao-atende", observed: trend.delta, reason: "Variação entre janelas." };
  }
}

export interface Hypothesis {
  kind: "hipotese-para-verificacao"; ruleKey: string; version: number; sourceRef: string; decisionRef: string;
  conditions: ConditionResult[]; statement: string; idempotencyKey: string;
}
export type Evaluation =
  | { kind: "hipotese"; hypothesis: Hypothesis }
  | { kind: "sem-alerta"; ruleKey: string }
  | { kind: "indeterminado"; ruleKey: string; conditions: ConditionResult[] }
  | { kind: "bloqueado"; reason: string };

const FORBIDDEN = /\b(evad|evas|abandon|diagn[oó]stic|infrequente cr[oô]nico)/i;
export const assertNoLabel = (s: string) => { if (FORBIDDEN.test(s)) throw new Error("preventive-rules:label-forbidden"); return s; };

export function evaluatePreventive(
  subjectRef: string, m: Monitoring, trend: Trend | null,
  rules: readonly RuleVersion[], approvals: readonly Approval[], ctx: Context, on: string,
): Evaluation[] {
  return resolveRules(rules, approvals, ctx, on).map((res): Evaluation => {
    if (res.kind === "sem-regra") return { kind: "bloqueado", reason: "Nenhuma regra preventiva aprovada vigente para este contexto." };
    if (res.kind === "ambigua") return { kind: "bloqueado", reason: `Regras concorrentes: ${res.candidates.join(", ")}.` };
    const { rule, approval } = res;
    const results = rule.conditions.map((c) => evalCondition(c, m, trend));
    const anyInd = results.some((r) => r.outcome === "indeterminado");
    const hit = rule.combine === "todas" ? results.every((r) => r.outcome === "atende") : results.some((r) => r.outcome === "atende");
    if (!hit) return (anyInd && (rule.combine === "todas" ? !results.some((r) => r.outcome === "nao-atende") : true))
      ? { kind: "indeterminado", ruleKey: rule.ruleKey, conditions: results } : { kind: "sem-alerta", ruleKey: rule.ruleKey };
    return { kind: "hipotese", hypothesis: {
      kind: "hipotese-para-verificacao", ruleKey: rule.ruleKey, version: rule.version, sourceRef: rule.sourceRef, decisionRef: approval.decisionRef,
      conditions: results, idempotencyKey: `perm-rule|${rule.ruleKey}|v${rule.version}|${subjectRef}|${on}`,
      statement: assertNoLabel(`Hipótese para verificação pela escola segundo "${rule.title}" (v${rule.version}). Não constitui conclusão nem classificação do estudante.`),
    } };
  });
}

export const RULE_ERRORS: Record<string, string> = {
  "permrule:no-person": "Sessão sem pessoa institucional.",
  "permrule:forbidden": "Sem capacidade para configurar regras de permanência.",
  "permrule:approve-forbidden": "Sem capacidade para aprovar regras de permanência.",
  "permrule:invalid-conditions": "Condição fora das primitivas ou parâmetros inválidos.",
  "permrule:invalid-scope": "Escopo aceita só etapa, modalidade e período.",
  "permrule:stale-base": "A regra mudou desde a leitura; recarregue.",
  "permrule:invalid-version": "Versão inválida (nova versão exige motivo; vigência coerente).",
  "permrule:self-approval": "O autor não pode aprovar a própria regra.",
  "permrule:already-decided": "Esta versão já foi decidida.",
  "permrule:decision-required": "Informe a decisão institucional.",
  "permrule:not-found": "Versão não encontrada.",
};
