/**
 * N10.2.3 — rascunho da experiência EI no servidor (tabela append-only, só o autor lê/grava).
 * Cada salvamento é nova versão (seq); descartar/concluir é um evento `discarded`, nunca apagar.
 */
import { supabase } from "@/integrations/supabase/client";

export type CloudDraft = { draftKey: string; seq: number; payload: Record<string, unknown>; recordedAt: string };

type Row = { draft_key: string; seq: number; payload: Record<string, unknown>; discarded: boolean; recorded_at: string };
type From = { from: (t: string) => { select: (c: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }> } }; insert: (r: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> } };
const db = supabase as unknown as From;

/** Última versão de cada rascunho ainda aberto (não descartado). */
export function latestOpenDrafts(rows: readonly Row[]): CloudDraft[] {
  const head = new Map<string, Row>();
  for (const r of rows) { const h = head.get(r.draft_key); if (!h || r.seq > h.seq) head.set(r.draft_key, r); }
  return [...head.values()].filter((r) => !r.discarded)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .map((r) => ({ draftKey: r.draft_key, seq: r.seq, payload: r.payload, recordedAt: r.recorded_at }));
}

export async function readOpenDrafts(): Promise<CloudDraft[]> {
  const { data, error } = await db.from("infant_experience_drafts").select("draft_key,seq,payload,discarded,recorded_at").order("recorded_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return latestOpenDrafts(data ?? []);
}

export async function writeDraft(draftKey: string, seq: number, payload: object, discarded = false): Promise<void> {
  const { error } = await db.from("infant_experience_drafts").insert({ draft_key: draftKey, seq, payload, discarded });
  if (error) throw new Error(error.message);
}
