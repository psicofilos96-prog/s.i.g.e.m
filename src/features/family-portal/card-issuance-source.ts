import { supabase } from "@/integrations/supabase/client";
import { guardUpload, assertSafePath } from "@/features/privacy/upload-policy";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import type { CardChainRow, IssuedCard } from "./card-issuance";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);
async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type CardCandidate = { student_id: string; name: string; name_kind: "civil" | "social"; internal_id: string | null; class_label: string | null; has_photo: boolean; open_card: string | null;
  birth_date?: string | null; homonyms?: number };

export const readCardChain = (school: string) => call<CardChainRow[]>("student_card_chain_v2", { _school: school });
export const readFamilyCards = (student: string) => call<IssuedCard[]>("family_student_cards_v2", { _student: student });
export const findCardCandidates = (school: string, query: string, birth?: string | null) => call<CardCandidate[]>("student_card_candidates_v2", { _school: school, _query: query, _birth: birth || null });
export const readCardLayouts = (school: string) => call<{ version: number; config: unknown; recorded_at: string }[]>("student_card_layouts", { _school: school });
export const recordCardLayout = (school: string, expected: number | null, config: unknown) =>
  call<number>("record_student_card_layout", { _school: school, _expected: expected, _config: config });

/** Nome, escola, turma e identificador vêm do banco; a tela só informa estudante, ano, validade e motivo. */
export const recordCard = (a: { publicId: string | null; expected: number | null; kind: "emissao" | "reemissao" | "cancelamento"; student: string | null; school: string | null;
  year: string | null; validUntil: string | null; reason: string | null }) =>
  call<string>("record_student_card_v2", { _public_id: a.publicId, _expected_version: a.expected, _kind: a.kind, _student: a.student, _school: a.school, _year: a.year,
    _valid_until: a.validUntil || null, _reason: a.reason || null });

const BUCKET = "fotos-estudantes";
async function sha256Hex(buf: Uint8Array) {
  const d = await crypto.subtle.digest("SHA-256", buf as unknown as ArrayBuffer);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Envia o JPEG já enquadrado e registra a foto; caminho só de segmentos gerados. */
export async function saveCardPhoto(school: string, student: string, jpeg: Blob, origin: "camera" | "arquivo") {
  const buf = new Uint8Array(await jpeg.arrayBuffer());
  const mime = guardUpload("fotos-estudantes", buf, "image/jpeg");
  const path = assertSafePath(`${school}/carteirinha/${student}/${crypto.randomUUID()}.jpg`);
  const up = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: false });
  if (up.error) throw new Error(up.error.message);
  await call<string>("record_student_card_photo", { _school: school, _student: student, _path: path, _sha256: await sha256Hex(buf), _origin: origin });
  return path;
}
/** URL assinada curta; leitura governada pela política (emissor da escola ou família autorizada). */
export async function cardPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
