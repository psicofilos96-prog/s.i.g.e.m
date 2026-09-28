/**
 * 6D.3.5.5 — "Como a recuperação alterou — ou não alterou — este resultado?"
 *
 * Apresentação pura do `ExplainedRecovery` (derivado do recibo canônico da
 * recuperação). Nada é recalculado nem comparado: valores, teto, subtotal e
 * arredondamento vêm prontos do recibo. Divulgação progressiva:
 * Nível 1 — resultado após / antes; Nível 2 — o que foi considerado e o
 * efeito; Nível 3 — proveniência normativa e IDs técnicos.
 * A proteção de valores acontece ANTES (explicação inteira `protected`).
 */
import type { ExplainedRecovery } from "./composition-explanation-projection";

export type RecoveryExplanationLevels = {
  level1: { after: string; before: string } | null;
  level2: string[];
  level3: string[];
};

const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const formed = (n: number | null) => (n === null ? "não formado" : num(n));

export const RECOVERY_STATE_LINE: Record<ExplainedRecovery["state"], string | null> = {
  "not-configured": null,
  "not-eligible": "O estudante não se enquadra na recuperação deste período.",
  "eligibility-indeterminate": "Ainda não é possível saber se a recuperação se aplica a este estudante.",
  "eligible-without-result": "Ainda não há resultado de recuperação registrado.",
  "applied-without-effect": "A recuperação foi considerada e o resultado do período foi mantido.",
  "applied-with-effect": "A recuperação alterou o resultado do período.",
  "normative-insufficiency": "A recuperação não pode ser considerada: a regra ainda não define tudo o que é necessário.",
  "period-incomplete": "A recuperação só é considerada quando o resultado do período estiver completo.",
};

const isApplied = (s: ExplainedRecovery["state"]) =>
  s === "applied-with-effect" || s === "applied-without-effect";

export function presentRecoveryExplanation(r: ExplainedRecovery): RecoveryExplanationLevels | null {
  const line = RECOVERY_STATE_LINE[r.state];
  if (!line) return null;
  const applied = isApplied(r.state);
  const level2: string[] = [line];
  if (r.eligibility?.kind === "unrestricted") level2.push("A regra não restringe quem pode fazer a recuperação.");
  if (r.eligibility?.kind === "evaluated") level2.push(`Enquadramento: ${r.eligibility.reason}`);
  const titles = r.entries.flatMap((e) => (e.resolved ? [e.instrumentTitle] : []));
  if (titles.length) level2.push(`Registro de recuperação considerado: ${titles.join(", ")}.`);
  if (applied && r.recoveryValue !== null) level2.push(`Resultado da recuperação: ${num(r.recoveryValue)}.`);
  if (r.replaceableSubtotal)
    level2.push(`Parte do período alcançada pela recuperação: ${num(r.replaceableSubtotal.value)}.`);
  if (r.cap !== null) level2.push(`A recuperação respeita o limite de ${num(r.cap)}.`);

  const level3: string[] = [r.reason];
  const p = r.provenance;
  if (p.ruleId) level3.push(`Regra ${p.ruleId} v${p.ruleVersion} · recuperação ${p.recoveryRuleId}`);
  if (p.configurationId)
    level3.push(
      `Configuração ${p.configurationId}${p.configurationVersion !== undefined ? ` v${p.configurationVersion}` : ""}`,
    );
  if (p.effectEvaluatorId) level3.push(`Efeito declarado: ${p.effectEvaluatorId}`);
  if (p.eligibilityEvaluatorId) level3.push(`Avaliador de enquadramento: ${p.eligibilityEvaluatorId}`);
  if (r.replaceableSubtotal) {
    const s = r.replaceableSubtotal;
    level3.push(
      `Subtotal (${s.aggregationKind}${s.rounded ? ", arredondado" : ""}): ${s.categoryResults
        .map((c) => `${c.categoryId} = ${num(c.value)} (peso ${num(c.weight)})`)
        .join("; ")}`,
    );
  }
  if (p.replacedCategoryIds.length) level3.push(`Categorias substituídas: ${p.replacedCategoryIds.join(", ")}`);
  if (p.roundingPolicyId) level3.push(`Arredondamento consultado: ${p.roundingPolicyId}`);
  for (const e of r.entries)
    if (e.resolved) level3.push(`${e.instrumentTitle}: versão ${e.provenance.version} (${e.provenance.entryVersionId})`);

  return {
    level1: applied ? { after: formed(r.finalValue), before: formed(r.originalValue) } : null,
    level2,
    level3,
  };
}
