/**
 * 6D.3.5.6 — Situação da Recuperação Final (apresentação pura).
 *
 * Lê SOMENTE o recibo da consolidação do ciclo (`FinalRecoveryProjection`).
 * Nada é recalculado: maior resultado, média, teto, arredondamento e
 * prevalência vêm do motor. A única distinção adicional é entre "aplicada com
 * efeito" e "aplicada sem efeito", já registrada no recibo (`changedResult`).
 *
 * Privacidade: usar um valor no cálculo ≠ poder mostrá-lo. Sem divulgação de
 * valores, a explicação inteira é protegida — nem parcelas, nem teto, nem
 * antes/depois, nem instrumento (evita reconstrução inversa).
 */
import type { CycleConsolidation } from "./cycle-consolidation-types";

export type FinalRecoveryStatusId =
  | "not-configured"
  | "disabled"
  | "not-eligible"
  | "eligibility-indeterminate"
  | "eligible-without-result"
  | "applied-without-effect"
  | "applied-with-effect"
  | "normative-insufficiency"
  /** Consolidação do ciclo ainda sem resultado: recuperação não considerada. */
  | "cycle-not-consolidated";

export const FINAL_RECOVERY_STATUS_TEXT: Record<FinalRecoveryStatusId, string> = {
  "not-configured": "Recuperação final não configurada",
  disabled: "Recuperação final desabilitada pela regra",
  "not-eligible": "Não se enquadra na recuperação final",
  "eligibility-indeterminate": "Enquadramento ainda indeterminado",
  "eligible-without-result": "Enquadrado, sem resultado registrado",
  "applied-without-effect": "Recuperação considerada, resultado mantido",
  "applied-with-effect": "Recuperação considerada, resultado alterado",
  "normative-insufficiency": "A regra ainda não define tudo o que é necessário",
  "cycle-not-consolidated": "Resultado do ciclo ainda não formado",
};

/** Estados em que o lançamento na Pauta faz sentido para o estudante. */
export const FINAL_RECOVERY_ENTRY_STATES: ReadonlySet<FinalRecoveryStatusId> = new Set([
  "eligible-without-result",
  "applied-without-effect",
  "applied-with-effect",
]);

export type FinalRecoveryPresentation = {
  status: FinalRecoveryStatusId;
  label: string;
  reason: string;
  /** Recuperação final aplicada e explicável (com valores divulgáveis). */
  explanation:
    | { state: "none" }
    | { state: "protected" }
    | {
        state: "available";
        level1: { before: string; after: string };
        level2: string[];
        level3: string[];
      };
  /** Valores apresentáveis na linha — `null` quando protegidos ou inexistentes. */
  values: { cycle: string | null; recovery: string | null; after: string | null };
};

const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const opt = (n: number | null | undefined) => (typeof n === "number" ? num(n) : null);

/**
 * Estados indeterminados e insuficiências compartilham `pendente-de-definicao`
 * no motor; a distinção vem do recibo (motivo de identificação x elegibilidade).
 */
function statusOf(result: CycleConsolidation): FinalRecoveryStatusId {
  if (result.kind !== "consolidado") return "cycle-not-consolidated";
  const r = result.finalRecovery;
  switch (r.state) {
    case "nao-configurada":
      return "not-configured";
    case "desabilitada":
      return "disabled";
    case "nao-elegivel":
      return "not-eligible";
    case "elegivel-sem-registro":
      return "eligible-without-result";
    case "aplicada":
      return r.changedResult ? "applied-with-effect" : "applied-without-effect";
    case "pendente-de-definicao": {
      const p = r.provenance;
      if (!p || p.identificationReason) return "normative-insufficiency";
      // O avaliador de elegibilidade não decidiu ⇒ indeterminado; decidiu
      // (ou é sem restrição) mas o efeito não pôde ser produzido ⇒ insuficiência.
      return p.eligibilityEvaluatorId === null || !p.effect && isIndeterminateEligibility(p.eligibilityReason, r.reason)
        ? "eligibility-indeterminate"
        : "normative-insufficiency";
    }
  }
}

const isIndeterminateEligibility = (eligibilityReason: string, reason: string) => eligibilityReason === reason;

export function presentFinalRecovery(
  result: CycleConsolidation,
  options: { valuesDisclosed: boolean },
): FinalRecoveryPresentation {
  const status = statusOf(result);
  const label = FINAL_RECOVERY_STATUS_TEXT[status];
  if (result.kind !== "consolidado")
    return {
      status,
      label,
      reason: "A recuperação final só é considerada depois que o resultado do ciclo estiver formado.",
      explanation: { state: "none" },
      values: { cycle: null, recovery: null, after: null },
    };
  const r = result.finalRecovery;
  const applied = status === "applied-with-effect" || status === "applied-without-effect";
  if (!options.valuesDisclosed)
    return {
      status,
      label,
      reason: r.reason,
      explanation: applied ? { state: "protected" } : { state: "none" },
      values: { cycle: null, recovery: null, after: null },
    };
  const values = {
    cycle: opt(result.cycleScore),
    recovery: opt(r.recoveryScore),
    after: opt(result.postRecoveryScore),
  };
  if (!applied) return { status, label, reason: r.reason, explanation: { state: "none" }, values };

  const p = r.provenance;
  const e = p?.effect;
  const level2: string[] = [
    status === "applied-with-effect"
      ? "A recuperação final alterou o resultado do ciclo conforme a regra homologada."
      : "A recuperação foi considerada, mas não alterou o resultado final.",
  ];
  if (p?.eligibilityEvaluatorId === "sem-restricao") level2.push("A regra não restringe quem pode fazer a recuperação final.");
  else if (p) level2.push(`Enquadramento: ${p.eligibilityReason}`);
  for (const u of r.usedVersions ?? [])
    level2.push(
      `Registro considerado: ${u.instrumentTitle ?? "instrumento de recuperação final"}${u.isCorrection ? " (versão corrigida)" : ""}.`,
    );
  if (r.recoveryScore !== null) level2.push(`Resultado da recuperação: ${num(r.recoveryScore)}.`);
  if (e?.cap !== undefined && e.cap !== null) level2.push(`A recuperação respeita o limite de ${num(e.cap)}.`);

  const level3: string[] = [r.reason];
  if (p) {
    level3.push(`Regra ${p.ruleId} v${p.ruleVersion} · recuperação ${p.recoveryRuleId}`);
    level3.push(`Configuração ${p.configurationId}${p.configurationVersion !== undefined ? ` v${p.configurationVersion}` : ""}`);
    if (p.eligibilityEvaluatorId) level3.push(`Avaliador de enquadramento: ${p.eligibilityEvaluatorId}`);
  }
  if (e?.effectEvaluatorId) level3.push(`Efeito declarado: ${e.effectEvaluatorId}`);
  if (e?.roundingPolicyId) level3.push(`Arredondamento consultado: ${e.roundingPolicyId}`);
  for (const u of r.usedVersions ?? [])
    level3.push(`Versão utilizada: ${u.version} (${u.versionId})${u.isCorrection ? " — correção" : ""}`);

  return {
    status,
    label,
    reason: r.reason,
    explanation: {
      state: "available",
      level1: { before: values.cycle ?? "não formado", after: values.after ?? "não formado" },
      level2,
      level3,
    },
    values,
  };
}
