/**
 * L05 Permanência — central de alertas (migration 0395).
 * Alerta = `permanence_alerts` (chave idempotente única: mesmo evento nunca repete)
 * + eventos append-only com seq esperado (`record_permanence_alert_event`).
 * Caso é sempre o canônico do AA (`aa_outreach_cases`): abrir usa `aa_open_outreach_case`
 * e depois associa; índice único garante UM caso por alerta. Encerrar exige justificativa.
 */
export type AlertEventKind = "conferido" | "caso-aberto" | "caso-associado" | "encerrado";
export interface AlertRow { id: string; idempotencyKey: string; schoolId: string; studentId: string; ruleVersionId: string; observedOn: string; observation: Record<string, unknown>; origin: "executor-tecnico" | "pessoa" }
export interface AlertEvent { alertId: string; seq: number; kind: AlertEventKind; caseId: string | null; justification: string | null; authorPerson: string }

export type AlertState = "a-conferir" | "conferido" | "com-caso" | "encerrado";
export interface AlertView { alert: AlertRow; state: AlertState; seq: number; caseId: string | null; actions: AlertEventKind[]; history: AlertEvent[] }

export function projectAlert(alert: AlertRow, events: readonly AlertEvent[]): AlertView {
  const h = events.filter((e) => e.alertId === alert.id).sort((a, b) => a.seq - b.seq);
  h.forEach((e, i) => { if (e.seq !== i + 1) throw new Error("alert-center:broken-chain"); });
  const caseId = h.find((e) => e.caseId)?.caseId ?? null;
  const last = h.at(-1)?.kind;
  const state: AlertState = last === "encerrado" ? "encerrado" : caseId ? "com-caso" : h.some((e) => e.kind === "conferido") ? "conferido" : "a-conferir";
  const actions: AlertEventKind[] = state === "a-conferir" ? ["conferido"] : state === "conferido" ? ["caso-aberto", "caso-associado", "encerrado"] : state === "com-caso" ? ["encerrado"] : [];
  return { alert, state, seq: h.length, caseId, actions, history: h };
}

/** Chave por evento: repetir o clique devolve o mesmo seq no banco. */
export const alertEventKey = (alertId: string, kind: AlertEventKind, base: number) => `perm-alert-ev|${alertId}|${kind}|${base}`;

export function validateEventDraft(v: AlertView, kind: AlertEventKind, input: { caseId?: string | null; caseStudentId?: string | null; justification?: string | null }): string | null {
  if (!v.actions.includes(kind)) return "Ação não permitida no estado atual.";
  if ((kind === "caso-aberto" || kind === "caso-associado") && (!input.caseId || input.caseStudentId !== v.alert.studentId)) return "Caso deve ser do mesmo estudante.";
  if (kind === "encerrado" && (input.justification ?? "").trim().length < 10) return "Encerramento exige justificativa.";
  return null;
}

/** Conferência mostra origem, frequência observada e regra; nunca rótulo de evasão. */
export function reviewSummary(v: AlertView): { origin: string; rule: string; observation: [string, string][] } {
  return { origin: v.alert.origin === "executor-tecnico" ? "Detectado pelo executor técnico (sem efeito sem pessoa)" : "Registrado por pessoa",
    rule: v.alert.ruleVersionId,
    observation: Object.entries(v.alert.observation).map(([k, x]) => [k, x === null ? "não apurado" : String(x)]) };
}

export const ALERT_ERRORS: Record<string, string> = {
  "permalert:forbidden": "Sem capacidade para registrar alertas nesta escola.",
  "permalert:no-person": "Sessão sem pessoa institucional.",
  "permalert:rule-not-approved": "Regra não aprovada ou fora da vigência.",
  "permalert:label-forbidden": "Observação com rótulo proibido.",
  "permalert:key-conflict": "Chave já usada por outro evento.",
  "permalert:unavailable": "Alerta indisponível.",
  "permalert:stale-base": "O alerta mudou desde a leitura; recarregue.",
  "permalert:closed": "Alerta já encerrado.",
  "permalert:not-reviewed": "Confira origem, frequência e regra antes.",
  "permalert:case-forbidden": "Sem capacidade para abrir/associar caso.",
  "permalert:case-mismatch": "Caso de outro estudante ou escola.",
  "permalert:already-linked": "Este alerta já tem caso associado.",
  "permalert:invalid-event": "Evento inválido (encerramento exige justificativa).",
};
