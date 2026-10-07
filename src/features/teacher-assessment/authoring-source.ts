import { guardUpload, safeLabel, assertSafePath } from "@/features/privacy/upload-policy";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { supabase } from "@/integrations/supabase/client";
import type { InstrumentVersion, ItemOption, ItemVersion, Randomization } from "./authoring-model";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any; storage: any };
const must = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => { const r = await p; if (r.error) throw new Error(r.error.message); return r.data; };

export const visibleItems = () => must<ItemVersion[]>(db.from("assessment_item_versions").select("*").order("recorded_at", { ascending: false }).limit(2000));
/** Gabarito é lido à parte e só retorna o que a regra do banco libera (autor ou compartilhamento explícito). */
export const itemKey = (versionId: string) => must<{ answer: unknown; criteria: string | null }[]>(db.from("assessment_item_keys").select("answer, criteria").eq("item_version_id", versionId));
export const visibleInstruments = () => must<InstrumentVersion[]>(db.from("teacher_instrument_versions").select("*").order("recorded_at", { ascending: false }).limit(1000));
export const schoolsOfAssignments = async (classIds: string[]) => classIds.length ? must<{ id: string; school_id: string }[]>(db.from("institutional_classes").select("id, school_id").in("id", classIds)) : [];

export type SaveItem = { itemId: string | null; head: string | null; typeId: string; stem: string; options: ItemOption[]; refIds: string[]; schoolId: string; visibility: "pessoal" | "compartilhado"; status: "rascunho" | "publicado"; keyShared: boolean; answer: unknown; criteria: string | null; copiedFrom: string | null; referenceOn?: string };
export const saveItem = (s: SaveItem) => must<string>(db.rpc("record_assessment_item_version_v2", {
  _reference_on: s.referenceOn ?? new Date().toLocaleDateString("sv-SE"),
  _item_id: s.itemId, _expected_head: s.head, _item_type_id: s.typeId, _stem: s.stem, _options: s.options, _curricular_refs: s.refIds.map((id) => ({ kind: "reference-item", item_id: id })),
  _school_id: s.schoolId, _visibility: s.visibility, _status: s.status, _key_shared: s.keyShared, _answer: s.answer ?? null, _criteria: s.criteria, _copied_from: s.copiedFrom,
}));
export type SaveInstrument = { instrumentId: string | null; head: string | null; assignmentId: string; periodId: string | null; title: string; instructions: string | null; itemVersionIds: string[]; randomization: Randomization | null; status: "rascunho" | "publicado"; resultsInstrumentId: string | null; referenceOn?: string };
export const saveInstrument = (s: SaveInstrument) => must<string>(db.rpc("record_teacher_instrument_version_v2", {
  _reference_on: s.referenceOn ?? new Date().toLocaleDateString("sv-SE"),
  _instrument_id: s.instrumentId, _expected_head: s.head, _assignment_id: s.assignmentId, _period_id: s.periodId, _title: s.title, _instructions: s.instructions,
  _items: s.itemVersionIds.map((id) => ({ item_version_id: id })), _randomization: s.randomization, _status: s.status, _results_instrument_id: s.resultsInstrumentId,
}));

export const MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
export async function uploadItemMedia(userId: string, itemId: string, file: File) {
  if (!(MEDIA_TYPES as readonly string[]).includes(file.type)) throw new Error("media-type");
  if (file.size > 10 * 1024 * 1024) throw new Error("media-size");
  const buf = await file.arrayBuffer();
  const mime = guardUpload("avaliacao-docente", new Uint8Array(buf), file.type);
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const path = assertSafePath(`${userId}/${itemId}/${crypto.randomUUID()}`);
  const up = await db.storage.from("avaliacao-docente").upload(path, buf, { upsert: false, contentType: mime });
  if (up.error) throw new Error("upload");
  return must<string>(db.rpc("record_assessment_item_media", { _item_id: itemId, _object_path: path, _label: safeLabel(file.name), _sha256: hash, _mime: mime }));
}
export const itemMedia = (itemId: string) => must<{ id: string; label: string; object_path: string; mime: string }[]>(db.from("assessment_item_media").select("id, label, object_path, mime").eq("item_id", itemId));
export async function mediaUrl(path: string) { const r = await db.storage.from("avaliacao-docente").createSignedUrl(path, SIGNED_URL_TTL_SECONDS); if (r.error) throw new Error("url"); return r.data.signedUrl as string; }
