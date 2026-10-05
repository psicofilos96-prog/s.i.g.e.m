import { supabase } from "@/integrations/supabase/client";
import { isValidSlug, toPublicDetail, type PublicDetail, type PublicItem, type PublishableKind, type PublicationState } from "./portal-model";

/** Leitura pública: só funções do portal; nenhuma tabela é lida diretamente. */
export async function listPublic(kind: PublishableKind | null): Promise<PublicItem[]> {
  const { data, error } = await supabase.rpc("public_portal_list", { _kind: kind as string });
  if (error) throw new Error("Não foi possível carregar as publicações.");
  return (data ?? []) as PublicItem[];
}

export async function getPublic(slug: string): Promise<PublicDetail> {
  if (!isValidSlug(slug)) return { status: "indisponivel" };
  const { data, error } = await supabase.rpc("public_portal_get", { _slug: slug });
  if (error) throw new Error("Não foi possível carregar a publicação.");
  return toPublicDetail(data);
}

export type PublicationVersionRow = {
  id: string; publication_id: string; version: number; state: PublicationState; title: string;
  summary: string | null; body: string; reason: string | null; recorded_at: string;
};

/** Leitura interna (RLS exige `publicar-conteudo-publico`). */
export async function listPublicationsInternal() {
  const [p, v] = await Promise.all([
    supabase.from("public_publications").select("id, kind, slug, created_at"),
    supabase.from("public_publication_versions").select("id, publication_id, version, state, title, summary, body, reason, recorded_at").order("version", { ascending: false }),
  ]);
  if (p.error || v.error) throw new Error("Não foi possível ler as publicações.");
  return { publications: p.data ?? [], versions: (v.data ?? []) as PublicationVersionRow[] };
}

export async function recordPublication(a: {
  kind: PublishableKind; slug: string; state: PublicationState; title: string; summary: string | null;
  body: string; reason: string | null; expectedVersion: number;
}) {
  const { data, error } = await supabase.rpc("record_public_publication", {
    _kind: a.kind, _slug: a.slug, _state: a.state, _title: a.title, _summary: a.summary as string,
    _body: a.body, _reason: a.reason as string, _expected_version: a.expectedVersion,
  });
  if (error) throw new Error(error.message.includes("conflito") ? "conflito" : error.message);
  return data as { publication_id: string; version: number };
}
