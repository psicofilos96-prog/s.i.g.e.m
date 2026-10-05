import { supabase } from "@/integrations/supabase/client";
import type { Catalog, SourceFile } from "./reference-engine";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);
type From = (t: string) => { select: (c: string) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> };
const from = supabase.from as unknown as From;

/** Catálogo inteiro lido com a sessão. Falha de leitura ⇒ erro, nunca catálogo vazio. */
export async function readCatalog(): Promise<Catalog> {
  const [e, i, b, r, s] = await Promise.all([
    from("curricular_reference_editions").select("*"), from("curricular_reference_items").select("*"),
    from("curricular_reference_item_bindings").select("*"), from("curricular_reference_relations").select("*"),
    from("curricular_reference_simplifications").select("*"),
  ]);
  for (const x of [e, i, b, r, s]) if (x.error) throw new Error(x.error.message);
  return { editions: e.data as never, items: i.data as never, bindings: b.data as never, relations: r.data as never, simplifications: s.data as never };
}

export async function recordEdition(f: SourceFile, sha256: string, sourceRef: string | null, expectedHead: string | null) {
  const { data, error } = await rpc("record_curricular_reference_edition", {
    _source_id: f.source.id, _source_label: f.source.label, _authority: f.source.authority, _edition_label: f.edition.label,
    _published_on: f.edition.published_on ?? null, _valid_from: f.edition.valid_from ?? null, _source_sha256: sha256,
    _source_ref: sourceRef, _expected_head: expectedHead, _items: f.items,
  });
  if (error) throw new Error(error.message);
  return data as { id: string };
}

export async function recordSimplification(itemId: string, expectedHead: string | null, text: string, reason: string | null) {
  const { error } = await rpc("record_curricular_reference_simplification", { _item: itemId, _expected_head: expectedHead, _text: text, _reason: reason });
  if (error) throw new Error(error.message);
}

export async function recordRelation(a: { from: string; to: string; nature: string; confidence: string; provenance: string; revokes?: string | null; reason?: string | null }) {
  const { error } = await rpc("record_curricular_reference_relation", {
    _from: a.from, _to: a.to, _nature: a.nature, _confidence: a.confidence, _provenance: a.provenance, _revokes: a.revokes ?? null, _reason: a.reason ?? null,
  });
  if (error) throw new Error(error.message);
}
