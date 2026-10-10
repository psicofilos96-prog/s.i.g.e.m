import { operationalToday } from "@/lib/academic-date";
import { readPages } from "@/lib/list-paging";
import { guardUpload, safeLabel, assertSafePath } from "@/features/privacy/upload-policy";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { supabase } from "@/integrations/supabase/client";
import type { InstrumentVersion, ItemOption, ItemVersion, Randomization } from "./authoring-model";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any; storage: any };
const must = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => { const r = await p; if (r.error) throw new Error(r.error.message); return r.data; };

/** NFINAL.7 — leitura paginada; acima do limite falha em vez de devolver lista cortada em silêncio. */
const allPages = async <T,>(build: (f: number, t: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, max = 20000): Promise<T[]> => {
  const r = await readPages<T>(build, max);
  if (r.error) throw new Error(r.error.message);
  if (r.truncated) throw new Error("list:truncated — há mais registros do que o limite de leitura desta tela.");
  return r.data ?? [];
};

export const visibleItems = () => allPages<ItemVersion>((f, t) => db.from("assessment_item_versions").select("*").order("recorded_at", { ascending: false }).order("id").range(f, t));
/** Gabarito é lido à parte e só retorna o que a regra do banco libera (autor ou compartilhamento explícito). */
export const itemKey = (versionId: string) => must<{ answer: unknown; criteria: string | null }[]>(db.from("assessment_item_keys").select("answer, criteria").eq("item_version_id", versionId));
export const visibleInstruments = () => allPages<InstrumentVersion>((f, t) => db.from("teacher_instrument_versions").select("*").order("recorded_at", { ascending: false }).order("id").range(f, t));
export const schoolsOfAssignments = async (classIds: string[]) => classIds.length ? must<{ id: string; school_id: string }[]>(db.from("institutional_classes").select("id, school_id").in("id", classIds)) : [];

export type SaveItem = { itemId: string | null; head: string | null; typeId: string; stem: string; options: ItemOption[]; refIds: string[]; schoolId: string; visibility: "pessoal" | "compartilhado"; status: "rascunho" | "publicado"; keyShared: boolean; answer: unknown; criteria: string | null; copiedFrom: string | null; referenceOn?: string };
export const saveItem = (s: SaveItem) => must<string>(db.rpc("record_assessment_item_version_v2", {
  _reference_on: s.referenceOn ?? operationalToday(),
  _item_id: s.itemId, _expected_head: s.head, _item_type_id: s.typeId, _stem: s.stem, _options: s.options, _curricular_refs: s.refIds.map((id) => ({ kind: "reference-item", item_id: id })),
  _school_id: s.schoolId, _visibility: s.visibility, _status: s.status, _key_shared: s.keyShared, _answer: s.answer ?? null, _criteria: s.criteria, _copied_from: s.copiedFrom,
}));
export type SaveInstrument = { instrumentId: string | null; head: string | null; assignmentId: string; periodId: string | null; title: string; instructions: string | null; itemVersionIds: string[]; randomization: Randomization | null; status: "rascunho" | "publicado"; resultsInstrumentId: string | null; referenceOn?: string };
export const saveInstrument = (s: SaveInstrument) => must<string>(db.rpc("record_teacher_instrument_version_v2", {
  _reference_on: s.referenceOn ?? operationalToday(),
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

/** LOTE 8 — imagem do cartão vai ao bucket privado sob o prefixo do próprio usuário; o hash acompanha a correção. */
export async function uploadCardImage(userId: string, instrumentVersionId: string, file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("media-type");
  if (file.size > 10 * 1024 * 1024) throw new Error("media-size");
  const buf = await file.arrayBuffer();
  const mime = guardUpload("avaliacao-docente", new Uint8Array(buf), file.type);
  const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const path = assertSafePath(`${userId}/cartoes/${instrumentVersionId}/${crypto.randomUUID()}`);
  const up = await db.storage.from("avaliacao-docente").upload(path, buf, { upsert: false, contentType: mime });
  if (up.error) throw new Error("upload");
  return { path, sha };
}
export type CorrectionRow = { id: string; instrument_version_id: string; student_id: string; variant: string; hits: number; total: number; supersedes_id: string | null; diary_batch_act_id: string | null; image_path: string; recorded_at: string };
export const correctionsOf = (instrumentVersionId: string) => must<CorrectionRow[]>(db.from("sia_card_corrections").select("id, instrument_version_id, student_id, variant, hits, total, supersedes_id, diary_batch_act_id, image_path, recorded_at").eq("instrument_version_id", instrumentVersionId).order("recorded_at"));
export const classStudents = (classId: string) => must<{ student_id: string }[]>(db.from("class_enrollment_episodes").select("student_id").eq("class_id", classId));
export type RecordCorrection = { instrumentVersionId: string; variant: string; studentId: string; cardCode: string; imagePath: string; imageSha: string; fingerprint: string; lines: { number: number; itemVersionId: string; answered: string | null; correct: boolean }[]; expectedHead: string | null; reason: string | null; launch: boolean };
export const recordCorrection = (c: RecordCorrection) => must<string>(db.rpc("record_sia_card_correction", {
  _instrument_version: c.instrumentVersionId, _variant: c.variant, _student: c.studentId, _card_code: c.cardCode, _image_path: c.imagePath, _image_sha256: c.imageSha,
  _print_fingerprint: c.fingerprint, _lines: c.lines, _human_confirmed: true, _expected_head: c.expectedHead, _reason: c.reason, _launch_to_diary: c.launch,
}));
export const SIA_CORRECTION_ERROR: Record<string, string> = {
  "sia:human-review-required": "A correção só é gravada depois da sua conferência.",
  "sia:only-author-corrects": "Só o autor da prova grava a correção.",
  "sia:instrument-not-published": "A prova precisa estar publicada.",
  "sia:not-approved-by-op": "A OP ainda não aprovou esta versão exata da prova.",
  "sia:unresolved-lines": "Há questões sem decisão (certa/errada).",
  "sia:head-changed": "Outra correção foi gravada para este estudante; recarregue.",
  "sia:reason-required": "Corrigir uma correção já gravada exige motivo.",
  "sia:no-diary-instrument": "A prova não está ligada a uma avaliação do Diário.",
  "sia:image-required": "Envie a imagem do cartão.",
  "capability-missing": "Sua conta não tem permissão para lançar notas nesta turma.",
  "aa:instrument-not-applied": "A avaliação do Diário ainda não foi marcada como aplicada.",
};
export const siaCorrectionMessage = (raw: string) => { const k = Object.keys(SIA_CORRECTION_ERROR).find((x) => raw.includes(x)); return k ? SIA_CORRECTION_ERROR[k]! : `Não gravado: ${raw}`; };
