// Centro de Operações L16 — solicitação, elegibilidade e autorização de transporte (migration 0423).
// Critério de elegibilidade é DADO de regra aprovada; o código nunca calcula distância, idade ou turno.
// Mudança acadêmica gera reavaliação pendente; a autorização vigente só cai por decisão humana.

export type Criterion = { key: string; label: string };
export type Answers = Record<string, { atende: boolean; evidencia: string }>;
export type DecisionKind = "autorizacao" | "indeferimento" | "reavaliacao-mantida" | "revogacao" | "encerramento";
export type Decision = { seq: number; kind: DecisionKind; episodeId?: string; classId?: string; shiftValueId?: string | null; stopId?: string; validUntil?: string | null };
export type Check = { ok: true } | { ok: false; reason: string };

const CLOSED: DecisionKind[] = ["indeferimento", "revogacao", "encerramento"];

export function evaluateAnswers(criteria: Criterion[], answers: Answers): { complete: boolean; allMet: boolean; missing: string[] } {
  const missing = criteria.filter((c) => typeof answers[c.key]?.atende !== "boolean" || (answers[c.key]?.evidencia ?? "").trim().length < 3).map((c) => c.key);
  return { complete: missing.length === 0, allMet: missing.length === 0 && criteria.every((c) => answers[c.key]!.atende), missing };
}

export function canDecide(input: {
  kind: DecisionKind; deciderPerson: string; requesterPerson: string; history: Decision[];
  ruleApprovedAndCurrent: boolean; criteria: Criterion[]; answers?: Answers; justification: string;
}): Check {
  const last = input.history.at(-1)?.kind;
  if (input.deciderPerson === input.requesterPerson) return { ok: false, reason: "self-decision" };
  if (input.justification.trim().length < 10) return { ok: false, reason: "justification-required" };
  if (last && CLOSED.includes(last)) return { ok: false, reason: "closed" };
  const first = input.kind === "autorizacao" || input.kind === "indeferimento";
  if (first ? last !== undefined : last === undefined) return { ok: false, reason: "invalid-transition" };
  if (input.kind === "revogacao" || input.kind === "encerramento") return { ok: true };
  if (!input.ruleApprovedAndCurrent) return { ok: false, reason: "rule-not-approved" };
  const ev = evaluateAnswers(input.criteria, input.answers ?? {});
  if (!ev.complete) return { ok: false, reason: "criteria-incomplete" };
  if (input.kind !== "indeferimento" && !ev.allMet) return { ok: false, reason: "criteria-not-met" };
  return { ok: true };
}

export type AcademicNow = { episodeActive: boolean; shiftValueId: string | null; stopActive: boolean };

/** Motivos de reavaliação; nunca altera a decisão vigente (espelha `ops_transport_reevaluation_queue`). */
export function reevaluationReasons(current: Decision, now: AcademicNow, on: string): string[] {
  if (current.kind !== "autorizacao" && current.kind !== "reavaliacao-mantida") return [];
  const r: string[] = [];
  if (!now.episodeActive) r.push("matricula-ou-enturmacao-alterada");
  if ((current.shiftValueId ?? null) !== now.shiftValueId) r.push("turno-alterado");
  if (!now.stopActive) r.push("ponto-alterado");
  if (current.validUntil && current.validUntil < on) r.push("vigencia-expirada");
  return r;
}

export function authorizationState(history: Decision[]): "solicitada" | "autorizada" | "indeferida" | "revogada" | "encerrada" {
  const k = history.at(-1)?.kind;
  if (!k) return "solicitada";
  return k === "indeferimento" ? "indeferida" : k === "revogacao" ? "revogada" : k === "encerramento" ? "encerrada" : "autorizada";
}

export const REEVALUATION_WRITES: readonly string[] = [];
