/**
 * L12 Permanência — plano individual de acompanhamento (migration 0400).
 * Versões append-only por caso canônico (base esperada, motivo a partir da v2): objetivos,
 * barreiras (só refs de barreiras do próprio caso, L09), ações com chave, responsável
 * (rótulo de atuação) e prazo opcional, recursos. Intervenção pedagógica da Orientação
 * entra só por REFERÊNCIA ao `aa_intervention_versions.logical_id` da mesma escola —
 * nunca copiada. Resultados e reavaliações são eventos sobre a versão vigente.
 */
export interface PlanAction { key: string; description: string; responsible: string; due: string | null }
export interface PlanVersion { caseId: string; version: number; objectives: string[]; barrierRefs: string[]; actions: PlanAction[]; resources: string[]; pedagogicalInterventionRef: string | null; reason: string | null; authorPerson: string }
export type ReviewOutcome = "realizada" | "parcial" | "nao-realizada" | "manter" | "ajustar" | "concluir";
export interface PlanReview { caseId: string; seq: number; planVersion: number; kind: "resultado-de-acao" | "reavaliacao"; actionKey: string | null; outcome: ReviewOutcome; evidence: string }

const FORBIDDEN = /(cpf|laudo|\bcid\b|diagn[oó]stic|neglig)/i;

export function validatePlanDraft(prev: PlanVersion | null, d: Omit<PlanVersion, "caseId" | "version" | "authorPerson">, caseBarrierRefs: ReadonlySet<string>, openedOn: string): string | null {
  if (d.objectives.length === 0 || d.objectives.some((o) => o.trim().length < 5)) return "Informe ao menos um objetivo.";
  if (d.actions.length === 0) return "Informe ao menos uma ação.";
  const keys = new Set<string>();
  for (const a of d.actions) {
    if (!/^[a-z0-9-]{2,40}$/.test(a.key) || keys.has(a.key)) return "Chave de ação inválida ou repetida.";
    keys.add(a.key);
    if (a.description.trim().length < 5 || a.responsible.trim().length < 3) return "Ação exige descrição e responsável.";
    if (a.due !== null && a.due < openedOn) return "Prazo anterior à abertura do caso.";
  }
  if (d.barrierRefs.some((b) => !caseBarrierRefs.has(b))) return "Barreira não pertence a este caso.";
  if (FORBIDDEN.test(JSON.stringify([d.objectives, d.actions, d.resources]))) return "Conteúdo clínico, documento ou julgamento não é aceito.";
  if (prev && (d.reason ?? "").trim().length < 10) return "Nova versão exige motivo.";
  return null;
}

export type ActionState = "sem-resultado" | "realizada" | "parcial" | "nao-realizada";
export interface PlanView { current: PlanVersion; actions: { action: PlanAction; state: ActionState; overdue: boolean }[]; lastReassessment: ReviewOutcome | null; concluded: boolean; needsReassessment: boolean; versions: number }

/** Projeção: só eventos da versão vigente valem para as ações; versões antigas ficam no histórico. */
export function projectPlan(versions: readonly PlanVersion[], reviews: readonly PlanReview[], today: string): PlanView | null {
  if (versions.length === 0) return null;
  const v = [...versions].sort((a, b) => a.version - b.version);
  if (v.some((x, i) => x.version !== i + 1)) throw new Error("individual-plan:broken-chain");
  const cur = v.at(-1)!;
  const rs = reviews.filter((r) => r.planVersion === cur.version).sort((a, b) => a.seq - b.seq);
  const actions = cur.actions.map((action) => {
    const last = [...rs].reverse().find((r) => r.kind === "resultado-de-acao" && r.actionKey === action.key);
    const state = (last?.outcome ?? "sem-resultado") as ActionState;
    return { action, state, overdue: action.due !== null && today > action.due && state !== "realizada" };
  });
  const lastRe = [...rs].reverse().find((r) => r.kind === "reavaliacao")?.outcome ?? null;
  const allDue = actions.every((a) => a.state !== "sem-resultado" || a.overdue);
  return { current: cur, actions, lastReassessment: lastRe, concluded: lastRe === "concluir",
    needsReassessment: lastRe !== "concluir" && allDue && actions.length > 0 && (lastRe === null || lastRe === "ajustar"), versions: v.length };
}

export const PLAN_ERRORS: Record<string, string> = {
  "permplan:no-person": "Sessão sem pessoa institucional.", "permplan:unavailable": "Caso indisponível ou sem capacidade.",
  "permplan:invalid-action": "Ação inválida.", "permplan:duplicate-action": "Ação repetida.", "permplan:barrier-mismatch": "Barreira de outro caso.",
  "permplan:intervention-mismatch": "Intervenção pedagógica de outra escola ou inexistente.", "permplan:forbidden-content": "Conteúdo não aceito.",
  "permplan:stale-base": "O plano mudou desde a leitura; recarregue.", "permplan:not-current-version": "Registre sobre a versão vigente.",
  "permplan:unknown-action": "Ação não existe na versão vigente.", "permplan:invalid": "Registro inválido.",
};
