/**
 * NDIARY.FINAL.2 — rascunho do registro de aula no servidor (append-only, só o autor lê/grava).
 * Cada salvamento é nova versão (seq). Reenvio da mesma seq (retry após falha de rede) é
 * idempotente: a violação de unicidade significa que a versão já chegou. Concluir/descartar é
 * evento `discarded`, nunca apagar. Rascunho não é registro oficial.
 */
import { supabase } from "@/integrations/supabase/client";
import { latestOpenDrafts, type CloudDraft } from "./infant-draft-cloud";

type Err = { message: string; code?: string } | null;
type Row = { draft_key: string; seq: number; payload: Record<string, unknown>; discarded: boolean; recorded_at: string };
type From = { from: (t: string) => { select: (c: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: Row[] | null; error: Err }> } }; insert: (r: Record<string, unknown>) => PromiseLike<{ error: Err }> } };
const db = supabase as unknown as From;
const TABLE = "lesson_record_drafts";

export async function readOpenLessonDrafts(): Promise<CloudDraft[]> {
  const { data, error } = await db.from(TABLE).select("draft_key,seq,payload,discarded,recorded_at").order("recorded_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return latestOpenDrafts(data ?? []);
}

/** Duplicidade da mesma (draft_key, seq) = a versão já foi gravada antes: sucesso idempotente. */
export function isIdempotentReplay(error: Err): boolean {
  return Boolean(error && error.code === "23505");
}

export async function writeLessonDraft(draftKey: string, seq: number, payload: object, discarded = false): Promise<void> {
  const { error } = await db.from(TABLE).insert({ draft_key: draftKey, seq, payload, discarded });
  if (error && !isIdempotentReplay(error)) throw new Error(error.message);
}

/**
 * Sequenciador: um seq por conteúdo distinto. Reenviar o mesmo conteúdo após falha reutiliza o
 * seq (retry idempotente); conteúdo novo avança.
 */
export function createDraftSequencer(start = 0) {
  let seq = start;
  let lastBody: string | null = null;
  return {
    next(payload: object): number {
      const body = JSON.stringify(payload);
      if (body !== lastBody) { seq += 1; lastBody = body; }
      return seq;
    },
    get current() { return seq; },
  };
}
