/**
 * OP por escola — LOTE 06 (fluxo de planejamento docente).
 * Integra o MESMO plano do Docente (cadeia `record_teaching_plan_version_v2`), o MESMO ledger de envio
 * (`teacher_work_review_events`, via reviewState) e o MESMO ledger de devolutivas (appendFeedback).
 * Fluxo: elabora → submete (se exigido) → OP analisa → comenta/pede ajuste → professor revisa →
 * validação (só se política homologada exigir) → execução. A OP nunca reescreve o plano.
 */
import { reviewState, canSubmit, type ReviewEvent, type ReviewState } from "@/features/teacher-review/teacher-work-review";
import { validationStep, type FeedbackEvent, type ValidationPolicy } from "@/features/teaching-planning/plan-editor-model";
import { decideOpAccess, type OpAccessRequest } from "./op-designations";

export interface PlanVersionRef { versionId: string; seq: number; authorPersonId: string; recordedAt: string; contentHash: string }
export type FlowStage = "elaboracao" | "em-analise" | "ajuste-solicitado" | "em-revisao" | "aguardando-validacao" | "validado" | "em-execucao";

export interface FlowInput {
  planId: string; authorPersonId: string; versions: PlanVersionRef[];
  reviews: ReviewEvent[]; feedback: FeedbackEvent[];
  /** null = não há regra homologada exigindo submissão/validação ⇒ OP acompanha sem portão */
  submissionRequired: boolean | null; validation: ValidationPolicy;
  validations: { seq: number; versionId: string; validatorPersonId: string; at: string; decision: "validado" | "devolvido"; reason: string }[];
  executionStartedOn: string | null;
}

/** Integridade: toda versão do plano é do autor; OP nunca aparece como autora de conteúdo. */
export function checkAuthorship(i: FlowInput): string[] {
  const e: string[] = [];
  const v = [...i.versions].sort((a, b) => a.seq - b.seq);
  if (!v.every((x, k) => x.seq === k + 1)) e.push("Versões do plano com sequência descontínua.");
  if (v.some((x) => x.authorPersonId !== i.authorPersonId)) e.push("Versão gravada por pessoa diferente do autor: sobrescrita recusada.");
  for (let k = 1; k < v.length; k++) if (v[k]!.recordedAt < v[k - 1]!.recordedAt) e.push("Versão anterior à predecessora.");
  if (i.feedback.some((f) => f.kind !== "devolutiva" && f.authorId !== i.authorPersonId)) e.push("Resposta/ciência só pelo professor autor.");
  if (i.feedback.some((f) => f.kind === "devolutiva" && f.authorId === i.authorPersonId)) e.push("Autor não registra devolutiva sobre o próprio plano.");
  if (i.validations.some((x) => x.validatorPersonId === i.authorPersonId)) e.push("Autor não valida o próprio plano.");
  if (i.validations.some((x) => !x.reason.trim())) e.push("Decisão de validação sem fundamentação.");
  return e;
}

export function projectFlow(i: FlowInput): { stage: FlowStage | "inconsistente"; review: ReviewState; current: PlanVersionRef | null; problems: string[]; nextActor: "professor" | "orientador" | "validador" | "nenhum"; note: string } {
  const problems = checkAuthorship(i);
  const current = [...i.versions].sort((a, b) => b.seq - a.seq)[0] ?? null;
  const review = reviewState(i.reviews, current?.versionId ?? null);
  if (problems.length) return { stage: "inconsistente", review, current, problems, nextActor: "nenhum", note: problems.join(" ") };
  if (!current) return { stage: "elaboracao", review, current, problems, nextActor: "professor", note: "Plano ainda sem versão gravada." };
  const lastVal = [...i.validations].sort((a, b) => b.seq - a.seq)[0];
  const valCurrent = lastVal && lastVal.versionId === current.versionId ? lastVal : null;
  const exec = i.executionStartedOn;
  if (i.validation?.required) {
    if (valCurrent?.decision === "validado") return { stage: exec ? "em-execucao" : "validado", review, current, problems, nextActor: exec ? "nenhum" : "professor", note: "" };
    if (valCurrent?.decision === "devolvido") return { stage: "em-revisao", review, current, problems, nextActor: "professor", note: valCurrent.reason };
    if (review === "aprovado") return { stage: "aguardando-validacao", review, current, problems, nextActor: "validador", note: "" };
  }
  if (review === "em-analise") return { stage: "em-analise", review, current, problems, nextActor: "orientador", note: "" };
  if (review === "ajuste-solicitado") {
    const askedAt = [...i.reviews].reverse().find((r) => r.event === "ajuste-solicitado")!.recorded_at;
    const revised = current.recordedAt > askedAt;
    return { stage: revised ? "em-revisao" : "ajuste-solicitado", review, current, problems, nextActor: "professor", note: revised ? "Nova versão aguardando reenvio." : "" };
  }
  if (i.submissionRequired === true && review !== "aprovado") return { stage: "elaboracao", review, current, problems, nextActor: "professor", note: "Envio à orientação exigido antes da execução." };
  if (i.submissionRequired === null && review === "nao-enviado") return { stage: exec ? "em-execucao" : "elaboracao", review, current, problems, nextActor: "professor", note: "Nenhuma regra homologada exige envio; a orientação acompanha." };
  return { stage: exec ? "em-execucao" : "elaboracao", review, current, problems, nextActor: "professor", note: "" };
}

export type OpPlanAction =
  | { kind: "comentar"; text: string } | { kind: "solicitar-ajuste"; text: string } | { kind: "aprovar-analise" }
  | { kind: "validar" | "devolver"; reason: string } | { kind: "editar-conteudo" };

/** Executor do orientador: só eventos próprios; editar conteúdo do professor é sempre recusado. */
export function planOpAction(a: {
  flow: FlowInput; action: OpPlanAction; actorPersonId: string; actorCapabilities: string[];
  access: Omit<OpAccessRequest, "action" | "granularity" | "personId">; expectedSeq: number; idempotencyKey: string; seenKeys: string[];
}): { ok: true; duplicate: boolean; ledger: "teacher_work_review_events" | "plan_feedback" | "plan_validation" } | { ok: false; reason: string } {
  const { flow, action, actorPersonId } = a;
  if (action.kind === "editar-conteudo") return { ok: false, reason: "Orientação não altera o conteúdo do professor; registre um comentário ou peça ajuste." };
  if (actorPersonId === flow.authorPersonId) return { ok: false, reason: "Quem escreveu o plano não analisa o próprio plano." };
  const ledger = action.kind === "comentar" ? "plan_feedback" : action.kind === "validar" || action.kind === "devolver" ? "plan_validation" : "teacher_work_review_events";
  if (a.seenKeys.includes(a.idempotencyKey)) return { ok: true, duplicate: true, ledger };
  const acc = decideOpAccess({ ...a.access, personId: actorPersonId, action: "registrar", granularity: "individual" });
  if (!acc.ok) return { ok: false, reason: acc.reason };
  const p = projectFlow(flow);
  if (p.stage === "inconsistente") return { ok: false, reason: p.note };
  if (!p.current) return { ok: false, reason: "Plano sem versão gravada." };
  const head = (xs: { seq: number }[]) => xs.reduce((m, x) => Math.max(m, x.seq), 0);
  switch (action.kind) {
    case "comentar":
      if (!action.text.trim()) return { ok: false, reason: "Comentário sem texto." };
      if (a.expectedSeq !== head(flow.feedback)) return { ok: false, reason: "Outra pessoa registrou antes; recarregue." };
      return { ok: true, duplicate: false, ledger };
    case "solicitar-ajuste": case "aprovar-analise":
      if (p.review !== "em-analise") return { ok: false, reason: "Não há envio aguardando análise." };
      if (action.kind === "solicitar-ajuste" && !action.text.trim()) return { ok: false, reason: "Pedido de ajuste exige comentário." };
      if (a.expectedSeq !== head(flow.reviews)) return { ok: false, reason: "Outra pessoa registrou antes; recarregue." };
      return { ok: true, duplicate: false, ledger };
    case "validar": case "devolver": {
      const v = validationStep(flow.validation, { authorId: flow.authorPersonId, state: p.stage === "aguardando-validacao" ? "aguardando-validacao" : "rascunho" }, { id: actorPersonId, capabilities: a.actorCapabilities });
      if (!v.available) return { ok: false, reason: v.reason! };
      if (!action.reason.trim()) return { ok: false, reason: "Decisão exige fundamentação." };
      if (a.expectedSeq !== head(flow.validations)) return { ok: false, reason: "Outra pessoa registrou antes; recarregue." };
      return { ok: true, duplicate: false, ledger };
    }
  }
}

/** Professor: pode reenviar só a versão atual quando o estado permite (mesma regra do Docente). */
export const teacherMaySubmit = (i: FlowInput, actor: string) => actor === i.authorPersonId && canSubmit(reviewState(i.reviews, i.versions.at(-1)?.versionId ?? null));

/** Histórico unificado, ordenado no tempo; nada é reescrito, cada item cita a versão a que se refere. */
export function flowTimeline(i: FlowInput) {
  return [
    ...i.versions.map((v) => ({ at: v.recordedAt, who: v.authorPersonId, what: `Versão ${v.seq} do plano`, versionId: v.versionId })),
    ...i.reviews.map((r) => ({ at: r.recorded_at, who: r.by_author ? i.authorPersonId : "orientacao", what: `Análise: ${r.event}`, versionId: r.subject_version_id })),
    ...i.feedback.map((f) => ({ at: f.at, who: f.authorId, what: f.kind, versionId: f.planVersionId })),
    ...i.validations.map((x) => ({ at: x.at, who: x.validatorPersonId, what: `Decisão: ${x.decision}`, versionId: x.versionId })),
  ].sort((a, b) => a.at.localeCompare(b.at));
}
