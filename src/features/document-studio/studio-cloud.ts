/**
 * DOCS.PRO.3 — Persistência do Document Studio no banco.
 * Versões append-only (`studio_template_versions`), ciclo por eventos (`studio_template_events`),
 * emissões congeladas (`studio_emissions`) e verificação pública mínima (`verify_studio_document`).
 * Toda gravação é RPC SECURITY DEFINER que revalida capability; a tela nunca é garantia.
 */
import qrcode from "qrcode-generator";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { renderStudio, type Facts, type PageSetup, type StudioBlock, type TemplateState } from "./studio-engine";

export type StudioVersion = Readonly<{ id: string; template_id: string; version_no: number; supersedes_id: string | null; sector: string; title: string; blocks: StudioBlock[]; page: PageSetup; base_template_id: string | null; content_sha256: string; author_id: string; created_at: string }>;
export type StudioEvent = Readonly<{ id: string; version_id: string; kind: "enviar-revisao" | "devolver" | "homologar" | "arquivar"; actor_id: string; note: string | null; at: string }>;
export type EmissionSnapshot = Readonly<{ template_id: string; version_id: string; version_no: number; title: string; blocks: StudioBlock[]; page: PageSetup; facts: Facts; content_sha256: string }>;
export type StudioEmission = Readonly<{ id: string; verification_code: string; template_version_id: string; school_id: string | null; title: string; issuer_label: string; snapshot: EmissionSnapshot; snapshot_sha256: string; actor_id: string; issued_at: string }>;
export type EmissionEvent = Readonly<{ emission_id: string; kind: "cancelamento" | "substituicao"; replaced_by: string | null; reason: string; at: string }>;
export type EmissionStatus = "valido" | "cancelado" | "substituido";
export type PublicVerification = Readonly<{ status: EmissionStatus | "nao-encontrado"; title?: string; issuer?: string; issued_at?: string; version_no?: number; snapshot_sha256?: string }>;

/* ---------- Projeções puras (espelham o banco; o banco decide) ---------- */
/** Mesmo algoritmo de `studio_version_state`: arquivar vence; homologado vira substituído se versão mais nova foi homologada. */
export function versionStates(versions: readonly StudioVersion[], events: readonly StudioEvent[]): Record<string, TemplateState> {
  const out: Record<string, TemplateState> = {};
  const by = (v: string) => events.filter((e) => e.version_id === v);
  const homologated = new Set(events.filter((e) => e.kind === "homologar").map((e) => e.version_id));
  for (const v of versions) {
    const ev = by(v.id);
    if (ev.some((e) => e.kind === "arquivar")) out[v.id] = "arquivado";
    else if (homologated.has(v.id)) out[v.id] = versions.some((n) => n.template_id === v.template_id && n.version_no > v.version_no && homologated.has(n.id)) ? "substituido" : "homologado";
    else { const last = ev.filter((e) => e.kind === "enviar-revisao" || e.kind === "devolver").sort((a, b) => a.at.localeCompare(b.at)).pop(); out[v.id] = last?.kind === "enviar-revisao" ? "em-revisao" : "rascunho"; }
  }
  return out;
}

export type LibraryEntry = Readonly<{ templateId: string; sector: string; title: string; latest: StudioVersion; current: StudioVersion | null; versions: StudioVersion[] }>;
/** Biblioteca: por modelo, a última versão (para editar) e a homologada vigente (para emitir). */
export function library(versions: readonly StudioVersion[], states: Record<string, TemplateState>): LibraryEntry[] {
  const g = new Map<string, StudioVersion[]>();
  for (const v of versions) (g.get(v.template_id) ?? g.set(v.template_id, []).get(v.template_id)!).push(v);
  return [...g.entries()].map(([templateId, vs]) => {
    const sorted = [...vs].sort((a, b) => b.version_no - a.version_no);
    return { templateId, sector: sorted[0]!.sector, title: sorted[0]!.title, latest: sorted[0]!, current: sorted.find((v) => states[v.id] === "homologado") ?? null, versions: sorted };
  }).sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

export function emissionStatus(e: StudioEmission, events: readonly EmissionEvent[]): EmissionStatus {
  const x = events.find((v) => v.emission_id === e.id);
  return x?.kind === "cancelamento" ? "cancelado" : x?.kind === "substituicao" ? "substituido" : "valido";
}

export type BlockDiff = Readonly<{ index: number; change: "igual" | "alterado" | "incluido" | "removido"; before: string | null; after: string | null }>;
const blockText = (b: StudioBlock | undefined) => (b ? JSON.stringify(b) : null);
export function diffVersions(a: readonly StudioBlock[], b: readonly StudioBlock[]): BlockDiff[] {
  const n = Math.max(a.length, b.length); const out: BlockDiff[] = [];
  for (let i = 0; i < n; i++) {
    const x = blockText(a[i]), y = blockText(b[i]);
    out.push({ index: i, change: x === y ? "igual" : x === null ? "incluido" : y === null ? "removido" : "alterado", before: x, after: y });
  }
  return out;
}

/* ---------- QR (gerado localmente, sem serviço externo) ---------- */
export const VERIFY_PATH = "/verificar/documento/";
export const isStudioCode = (c: unknown): c is string => typeof c === "string" && /^[0-9A-F]{20}$/.test(c.trim().toUpperCase());
export function verifyUrl(code: string, origin: string): string {
  if (!isStudioCode(code)) throw new Error("Código de verificação inválido.");
  if (!/^https?:\/\/[^/\s]+$/.test(origin)) throw new Error("Origem inválida.");
  return `${origin}${VERIFY_PATH}${code.toUpperCase()}`;
}
/** Matriz de módulos (para teste de leitura e para desenho). */
export function qrMatrix(text: string): boolean[][] {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}
export function qrDataUrl(text: string, cell = 4): string {
  const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createDataURL(cell, cell * 2);
}
/** Extrai o código de uma URL lida pelo QR; qualquer outra coisa é recusada. */
export function parseVerifyUrl(url: string): string | null {
  const m = /\/verificar\/documento\/([0-9A-Fa-f]{20})\/?$/.exec(url.trim());
  return m ? m[1]!.toUpperCase() : null;
}

/* ---------- Reprodução exata ---------- */
/** Reabre um documento emitido só a partir do snapshot congelado (nunca da versão atual do modelo). */
export function reproduce(e: Pick<StudioEmission, "snapshot" | "verification_code">, origin: string, status: EmissionStatus = "valido") {
  const s = e.snapshot;
  const facts: Facts = { ...s.facts, "documento.codigo_verificacao": e.verification_code };
  const qr = qrDataUrl(verifyUrl(e.verification_code, origin));
  const label = status === "cancelado" ? "DOCUMENTO CANCELADO" : status === "substituido" ? "DOCUMENTO SUBSTITUÍDO" : null;
  return renderStudio({ title: s.title, blocks: s.blocks, page: s.page, facts, draftLabel: label, qrImage: qr });
}

/* ---------- Banco ---------- */
export async function loadStudio(): Promise<{ versions: StudioVersion[]; events: StudioEvent[] }> {
  const [v, e] = await Promise.all([
    supabase.from("studio_template_versions").select("*").order("template_id").order("version_no", { ascending: false }).limit(1000),
    supabase.from("studio_template_events").select("*").order("at").limit(1000),
  ]);
  if (v.error) throw v.error; if (e.error) throw e.error;
  return { versions: (v.data ?? []) as unknown as StudioVersion[], events: (e.data ?? []) as unknown as StudioEvent[] };
}
export async function loadEmissions(): Promise<{ emissions: StudioEmission[]; events: EmissionEvent[] }> {
  const [a, b] = await Promise.all([
    supabase.from("studio_emissions").select("*").order("issued_at", { ascending: false }).limit(200),
    supabase.from("studio_emission_events").select("emission_id,kind,replaced_by,reason,at").limit(1000),
  ]);
  if (a.error) throw a.error; if (b.error) throw b.error;
  return { emissions: (a.data ?? []) as unknown as StudioEmission[], events: (b.data ?? []) as EmissionEvent[] };
}
export async function studioPermissions(): Promise<{ editar: boolean; homologar: boolean; emitir: boolean }> {
  const [editar, homologar, emitir] = await Promise.all(["editar", "homologar", "emitir"].map((w) => callRpc<boolean>("studio_can", { _what: w }).catch(() => false)));
  return { editar: !!editar, homologar: !!homologar, emitir: !!emitir };
}
export const saveVersion = (a: { templateId: string; expectedVersion: number; sector: string; title: string; blocks: StudioBlock[]; page: PageSetup; baseTemplateId?: string | null }) =>
  callRpc<string>("studio_save_version", { _template_id: a.templateId, _expected_version: a.expectedVersion, _sector: a.sector, _title: a.title, _blocks: a.blocks, _page: a.page, _base_template_id: a.baseTemplateId ?? null });
export const transition = (version: string, kind: StudioEvent["kind"], note?: string) => callRpc<string>("studio_transition", { _version: version, _kind: kind, _note: note ?? null });
export async function emit(version: string, facts: Facts, schoolId: string | null) {
  const r = await callRpc<{ emission_id: string; verification_code: string; snapshot_sha256: string }[]>("studio_emit", { _version: version, _facts: facts, _school_id: schoolId });
  if (!r[0]) throw new Error("Emissão não confirmada pelo banco.");
  return r[0];
}
export const voidEmission = (id: string, kind: "cancelamento" | "substituicao", reason: string, replacedBy?: string | null) =>
  callRpc<void>("studio_void_emission", { _emission: id, _kind: kind, _reason: reason, _replaced_by: replacedBy ?? null });
export async function verifyStudioDocument(code: string): Promise<PublicVerification> {
  if (!isStudioCode(code)) return { status: "nao-encontrado" };
  return callRpc<PublicVerification>("verify_studio_document", { _code: code.toUpperCase() });
}

export const STUDIO_ERRORS: Record<string, string> = {
  "studio:capability-missing": "Sua conta não tem permissão para esta ação (Admin ou permissão específica de modelos/documentos).",
  "studio:stale-version": "Outra pessoa gravou uma versão nova deste modelo. Recarregue antes de salvar.",
  "studio:not-homologated": "Só versão homologada vigente pode ser emitida.",
  "studio:newer-homologated": "Já existe versão mais nova homologada; esta não pode ser homologada.",
  "studio:markup-rejected": "O modelo contém marcação não permitida.",
  "studio:replacement-invalid": "O documento substituto precisa ser outra emissão, posterior a esta.",
  "studio:append-only": "Registros emitidos e versões não podem ser alterados.",
};
export function studioMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  const k = Object.keys(STUDIO_ERRORS).find((x) => m.includes(x));
  if (k) return STUDIO_ERRORS[k]!;
  if (m.includes("studio:invalid-transition")) return "Essa mudança de estado não é permitida a partir do estado atual.";
  return "Não foi possível concluir. Tente novamente.";
}
