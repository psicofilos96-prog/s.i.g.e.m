/**
 * N10.2.3 — Envio à OP de plano (SIPE) e prova (SIA). Projeção pura sobre os eventos
 * append-only de `teacher_work_review_events`; o banco decide autor, revisor e cabeça.
 */
import { supabase } from "@/integrations/supabase/client";

export type ReviewSubject = "plano" | "instrumento";
export type ReviewEvent = { seq: number; event: "enviado" | "ajuste-solicitado" | "aprovado"; subject_version_id: string; comment: string | null; by_author: boolean; recorded_at: string };
export type ReviewState = "nao-enviado" | "em-analise" | "ajuste-solicitado" | "aprovado" | "aprovado-versao-anterior";

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  "nao-enviado": "Ainda não enviado à Orientação Pedagógica",
  "em-analise": "Enviado — em análise pela Orientação Pedagógica",
  "ajuste-solicitado": "Ajuste solicitado — corrija e reenvie",
  aprovado: "Aprovado pela Orientação Pedagógica",
  "aprovado-versao-anterior": "Versão anterior aprovada — esta versão ainda não foi enviada",
};

export function reviewState(events: readonly ReviewEvent[], currentVersionId: string | null): ReviewState {
  const head = events.at(-1);
  if (!head) return "nao-enviado";
  if (head.event === "enviado") return "em-analise";
  if (head.event === "ajuste-solicitado") return "ajuste-solicitado";
  return currentVersionId && head.subject_version_id !== currentVersionId ? "aprovado-versao-anterior" : "aprovado";
}

/** Autor pode enviar quando não há análise pendente e a versão atual ainda não foi aprovada. */
export function canSubmit(state: ReviewState): boolean {
  return state === "nao-enviado" || state === "ajuste-solicitado" || state === "aprovado-versao-anterior";
}

export const REVIEW_ERROR: Record<string, string> = {
  "review:head-changed": "Outra pessoa registrou uma ação antes de você. Recarregue e tente de novo.",
  "review:only-author-submits": "Só quem escreveu pode enviar.",
  "review:version-superseded": "Existe uma versão mais nova. Abra a versão atual para enviar.",
  "review:already-submitted": "Já está em análise.",
  "review:already-approved": "Esta versão já foi aprovada.",
  "review:not-awaiting": "Não há envio aguardando análise.",
  "review:self-review": "Quem escreveu não pode aprovar o próprio trabalho.",
  "review:capability-missing": "Sua conta não tem autorização para analisar trabalhos docentes nesta escola.",
  "review:access-denied": "Sua conta não pode ver esta análise.",
};
export function reviewMessage(raw: string): string {
  const key = Object.keys(REVIEW_ERROR).find((k) => raw.includes(k));
  return key ? REVIEW_ERROR[key]! : "Não foi possível registrar. Tente de novo.";
}

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc = (fn: string, a: Record<string, unknown>) => (supabase.rpc as unknown as Rpc)(fn, a);

export async function reviewsOf(kind: ReviewSubject, subjectId: string): Promise<ReviewEvent[]> {
  const { data, error } = await rpc("teacher_work_reviews_of", { _kind: kind, _subject: subjectId });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReviewEvent[];
}

export async function recordReview(a: { kind: ReviewSubject; subjectId: string; versionId: string; expectedSeq: number; event: ReviewEvent["event"]; comment?: string | null }) {
  const { error } = await rpc("record_teacher_work_review", { _kind: a.kind, _subject: a.subjectId, _version: a.versionId, _expected_seq: a.expectedSeq, _event: a.event, _comment: a.comment ?? null });
  if (error) throw new Error(reviewMessage(error.message));
}

export type QueueRow = { subject_kind: ReviewSubject; subject_id: string; subject_version_id: string; title: string | null; seq: number; submitted_at: string };
export async function reviewQueue(school: string): Promise<{ kind: "ok"; rows: QueueRow[] } | { kind: "negado" }> {
  const { data, error } = await rpc("teacher_work_review_queue", { _school: school });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<QueueRow & { result_kind: string }>;
  if (rows.some((r) => r.result_kind === "access-denied" || r.result_kind === "invalid")) return { kind: "negado" };
  return { kind: "ok", rows: rows.filter((r) => r.result_kind === "item") };
}
