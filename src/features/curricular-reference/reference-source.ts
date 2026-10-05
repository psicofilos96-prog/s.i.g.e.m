/**
 * Frente Y — única porta TS do repositório curricular. Leitura por readers estáveis (INVOKER, knownAt explícito)
 * ou pelo catálogo legível; gravação só pelos writers v2 (sessão → pessoa → capacidade de rede na data declarada).
 * Consumidores futuros (Planejamento, Diário, Avaliação) usam este módulo, nunca as tabelas.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Catalog, SourceFile, RelationOrigin } from "./reference-engine";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);
type From = (t: string) => { select: (c: string) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> };
const from = supabase.from as unknown as From;
async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

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

export type HomologationState = "homologada" | "revogada" | "nao-homologada";
export type HomologationRow = { id: string; target_kind: string; target_id: string; sequence: number; decision: "homologada" | "revogada"; recorded_by_person_id: string; recorded_at: string };
export type KeywordVersion = { id: string; item_id: string; version_no: number; terms: string[]; recorded_by_person_id: string; recorded_at: string };
export type NoCorrespondence = { id: string; item_id: string; target_source_id: string; version_no: number; withdrawn: boolean; justification: string; criteria: Record<string, string>; recorded_at: string };
export type GlossaryVersion = { id: string; term_key: string; version_no: number; term: string; definition: string; definition_origin: "oficial-da-fonte" | "explicacao-sigem"; edition_id: string; item_id: string | null; source_locator: string | null; recorded_at: string };
export type EditorialLayers = { homologations: HomologationRow[]; keywords: KeywordVersion[]; noCorrespondence: NoCorrespondence[]; glossary: GlossaryVersion[] };

export async function readEditorialLayers(): Promise<EditorialLayers> {
  const [h, k, n, g] = await Promise.all([
    from("curricular_reference_homologations").select("*"), from("curricular_reference_keyword_versions").select("*"),
    from("curricular_reference_correspondence_assessments").select("*"), from("curricular_reference_glossary_versions").select("*"),
  ]);
  for (const x of [h, k, n, g]) if (x.error) throw new Error(x.error.message);
  return { homologations: h.data as never, keywords: k.data as never, noCorrespondence: n.data as never, glossary: g.data as never };
}

/** Estado vigente de homologação de um alvo (última decisão da cadeia); sem decisão ⇒ não homologado. */
export function homologationState(rows: readonly HomologationRow[], kind: string, id: string): { state: HomologationState; head: HomologationRow | null } {
  const own = rows.filter((r) => r.target_kind === kind && r.target_id === id).sort((a, b) => b.sequence - a.sequence);
  return { state: own[0]?.decision ?? "nao-homologada", head: own[0] ?? null };
}

// ===== Readers estáveis para consumidores (knownAt obrigatório) =====
export type ItemAt = {
  result_kind: "item" | "absent"; item_id: string; code: string | null; item_kind: string | null; official_text: string | null; parent_item_id: string | null;
  source_labels: Record<string, string> | null; source_locator: string | null; edition_id: string | null; source_id: string | null; source_label: string | null;
  authority: string | null; edition_label: string | null; published_on: string | null; valid_from: string | null; source_sha256: string | null; source_ref: string | null;
  edition_state: "vigente" | "substituida" | null; edition_homologation: HomologationState | null; simplification_id: string | null; simplification_version: number | null;
  simplified_text: string | null; simplification_homologation: HomologationState | null; keyword_version_id: string | null; keyword_terms: string[] | null; keywords_homologation: HomologationState | null;
};
export async function readItemAt(itemId: string, knownAt: string): Promise<ItemAt> {
  const rows = await call<ItemAt[]>("curricular_reference_item_at", { _item: itemId, _known_at: knownAt });
  if (!rows?.length) throw new Error("reference:reader-empty");
  return rows[0]!;
}

export type SearchRow = { item_id: string; code: string; item_kind: string; official_text: string; source_locator: string | null; edition_id: string; source_id: string;
  source_label: string; edition_label: string; simplified_text: string | null; simplification_homologation: HomologationState | null; keyword_terms: string[] | null;
  matched_in: ("codigo" | "texto-oficial" | "simplificacao" | "palavra-chave")[]; has_active_relation: boolean };
export type SearchArgs = { text?: string; sourceId?: string | null; editionId?: string | null; itemKind?: string | null;
  bindings?: { scheme_id: string; value_id: string }[] | null; onlyCurrent?: boolean; knownAt: string; limit?: number };
export const searchReferences = (a: SearchArgs) => call<SearchRow[]>("curricular_reference_search", {
  _text: a.text ?? null, _source_id: a.sourceId ?? null, _edition_id: a.editionId ?? null, _item_kind: a.itemKind ?? null,
  _bindings: a.bindings?.length ? a.bindings : null, _only_current: a.onlyCurrent ?? true, _known_at: a.knownAt, _limit: a.limit ?? 50 });

/** Itens aplicáveis a posição + elemento curricular: todos os vínculos canônicos exigidos, sem casar por nome. */
export const itemsForBindings = (bindings: { scheme_id: string; value_id: string }[], knownAt: string) =>
  searchReferences({ bindings, knownAt, limit: 500 });

export type RelationAt = { relation_id: string; direction: "saida" | "entrada"; other_item_id: string; other_code: string; other_source_id: string; other_edition_label: string;
  origin: RelationOrigin | null; nature: string; relation_direction: string | null; justification: string | null; criteria: Record<string, string> | null;
  official_locator: string | null; homologation: HomologationState; recorded_at: string };
export const readRelationsAt = (itemId: string, knownAt: string) => call<RelationAt[]>("curricular_reference_relations_at", { _item: itemId, _known_at: knownAt });

export type NoCorrespondenceAt = { assessment_id: string; target_source_id: string; version_no: number; justification: string; criteria: Record<string, string>; homologation: HomologationState; recorded_at: string };
export const readNoCorrespondenceAt = (itemId: string, knownAt: string) => call<NoCorrespondenceAt[]>("curricular_reference_no_correspondence_at", { _item: itemId, _known_at: knownAt });

export type ChildRow = { item_id: string; code: string; item_kind: string; official_text: string; source_labels: Record<string, string>; source_locator: string | null; has_children: boolean };
export const readChildren = (editionId: string, parentItemId: string | null) => call<ChildRow[]>("curricular_reference_children", { _edition: editionId, _parent: parentItemId });

export type GlossaryAt = { term_key: string; version_no: number; term: string; definition: string; definition_origin: "oficial-da-fonte" | "explicacao-sigem"; edition_id: string;
  edition_label: string; source_id: string; item_id: string | null; source_locator: string | null; homologation: HomologationState };
export const readGlossaryAt = (text: string, knownAt: string) => call<GlossaryAt[]>("curricular_reference_glossary_at", { _text: text, _known_at: knownAt });

// ===== Writers v2 =====
export async function recordEdition(f: SourceFile, sha256: string, sourceRef: string | null, expectedHead: string | null) {
  return call<{ id: string; idempotent: boolean }>("record_curricular_reference_edition_v2", {
    _source_id: f.source.id, _source_label: f.source.label, _authority: f.source.authority, _edition_label: f.edition.label,
    _published_on: f.edition.published_on ?? null, _valid_from: f.edition.valid_from ?? null, _source_sha256: sha256,
    _source_ref: sourceRef, _expected_head: expectedHead, _declared_item_count: f.edition.item_count ?? null, _items: f.items,
  });
}
export const recordSimplification = (itemId: string, expectedHead: string | null, text: string, reason: string | null, effectiveOn: string) =>
  call<string>("record_curricular_reference_simplification_v2", { _item: itemId, _expected_head: expectedHead, _text: text, _reason: reason, _effective_on: effectiveOn });
export const recordKeywords = (itemId: string, expectedHead: string | null, terms: string[], reason: string | null, effectiveOn: string) =>
  call<string>("record_curricular_reference_keywords", { _item: itemId, _expected_head: expectedHead, _terms: terms, _reason: reason, _effective_on: effectiveOn });
export const recordRelation = (a: { from: string; to: string; origin: RelationOrigin; nature: string; direction: "de-para" | "bidirecional"; justification: string;
  criteria: Record<string, string> | null; officialLocator: string | null; effectiveOn: string }) =>
  call<string>("record_curricular_reference_relation_v2", { _from: a.from, _to: a.to, _origin: a.origin, _nature: a.nature, _direction: a.direction,
    _justification: a.justification, _criteria: a.criteria, _official_locator: a.officialLocator, _effective_on: a.effectiveOn });
export const revokeRelation = (relationId: string, reason: string, effectiveOn: string) =>
  call<string>("revoke_curricular_reference_relation", { _relation: relationId, _reason: reason, _effective_on: effectiveOn });
export const recordNoCorrespondence = (a: { itemId: string; targetSourceId: string; expectedHead: string | null; justification: string; criteria: Record<string, string> | null;
  withdrawn: boolean; reason: string | null; effectiveOn: string }) =>
  call<string>("record_curricular_reference_no_correspondence", { _item: a.itemId, _target_source_id: a.targetSourceId, _expected_head: a.expectedHead,
    _justification: a.justification, _criteria: a.criteria, _withdrawn: a.withdrawn, _reason: a.reason, _effective_on: a.effectiveOn });
export const recordGlossaryTerm = (a: { termKey: string; expectedHead: string | null; term: string; definition: string; origin: "oficial-da-fonte" | "explicacao-sigem";
  editionId: string; itemId: string | null; locator: string | null; reason: string | null; effectiveOn: string }) =>
  call<string>("record_curricular_reference_glossary_term", { _term_key: a.termKey, _expected_head: a.expectedHead, _term: a.term, _definition: a.definition,
    _origin: a.origin, _edition: a.editionId, _item: a.itemId, _locator: a.locator, _reason: a.reason, _effective_on: a.effectiveOn });
export const homologate = (kind: string, targetId: string, decision: "homologada" | "revogada", expectedHead: string | null, reason: string | null, effectiveOn: string) =>
  call<string>("homologate_curricular_reference", { _target_kind: kind, _target_id: targetId, _decision: decision, _expected_head: expectedHead, _reason: reason, _effective_on: effectiveOn });
