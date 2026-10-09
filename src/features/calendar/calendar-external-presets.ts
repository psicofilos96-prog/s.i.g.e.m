/**
 * CAL.PRESET.1 — Presets visuais PESSOAIS dos modelos externos (0252, append-only por dono).
 * Preset guarda só o perfil de aparência já sanitizado; aplicar = trocar o rascunho da tela.
 * Nunca toca versão, dias, homologação nem o perfil institucional: gravar para o município
 * continua sendo o "Salvar personalização" (writer 0201, capacidade já existente).
 * Compartilhar preset com a rede exigiria capacidade nova não decidida ⇒ indisponível.
 */
import { supabase } from "@/integrations/supabase/client";
import { UserFacingError } from "@/lib/observability/governed-errors";
import { sanitizeProfile, type ExternalProfile, type ExternalTemplateCode } from "./calendar-external-model";

export const INSTITUTIONAL_PRESET_CAPABILITY: string | null = null;
export const INSTITUTIONAL_PRESET_DISABLED =
  "Preset compartilhado com a rede ainda não existe: não há permissão definida. Para o município, use \"Salvar personalização\".";

export type PresetRow = Readonly<{ preset_key: string; template_code: string; name: string; version: number; archived: boolean; profile: unknown; recorded_at: string }>;
export type Preset = Readonly<{ key: string; name: string; version: number; profile: ExternalProfile; savedAt: string }>;

/** Última versão de cada preset do modelo; arquivado some; perfil sempre re-sanitizado (só aparência). */
export function latestPresets(rows: readonly PresetRow[], template: ExternalTemplateCode, presentation?: Record<string, unknown> | null): Preset[] {
  const head = new Map<string, PresetRow>();
  for (const r of rows) {
    if (r.template_code !== template) continue;
    const cur = head.get(r.preset_key);
    if (!cur || cur.version < r.version) head.set(r.preset_key, r);
  }
  return [...head.values()].filter((r) => !r.archived)
    .map((r) => ({ key: r.preset_key, name: r.name, version: r.version, profile: sanitizeProfile(template, r.profile, presentation), savedAt: r.recorded_at }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function presetName(raw: string): string {
  const n = raw.trim();
  if (!n) throw new UserFacingError("Dê um nome ao preset antes de salvar.");
  if (n.length > 80) throw new UserFacingError("Nome com mais de 80 caracteres.");
  return n;
}

/** Nome livre para cópia: "X (cópia)", "X (cópia 2)"… */
export function copyName(name: string, taken: readonly string[]): string {
  const base = `${name} (cópia)`.slice(0, 80);
  if (!taken.includes(base)) return base;
  for (let i = 2; ; i++) { const n = `${name} (cópia ${i})`.slice(0, 80); if (!taken.includes(n)) return n; }
}

/** Grupos do perfil que diferem do padrão do modelo (comparação legível). */
const GROUPS: Record<string, readonly (keyof ExternalProfile)[]> = {
  "Cores": ["primary", "secondary", "headerColor", "borderColor", "gridColor", "cardColor", "pageColor", "accent", "lightColor", "holidayColor", "textColor", "symbolOverrides"],
  "Fontes e tamanhos": ["titleFont", "bodyFont", "scriptFont", "titlePt", "subtitlePt", "textScale", "minFitPt", "typeScale", "lineGap"],
  "Imagens": ["coverImage", "coverFocusY", "coverFocusX", "coverZoom", "coverOpacity", "coverOverlay", "footerImage", "pageImage", "pageFocusX", "pageFocusY", "pageZoom", "pageOpacity", "coverFit", "logos"],
  "Textos visuais": ["visualTitle", "subtitle", "slogan", "footerText", "footerPhrase", "qrText", "feriasText", "pillars", "qrUrl"],
  "Blocos visíveis": ["show"],
  "Disposição e espaçamento": ["blockOrder", "boxPad", "periods", "infoWidths", "bands", "gapMm", "gridWidth", "cardRadius", "cardShadow", "borderWidth", "density"],
  "Layout livre": ["free"],
};
export function diffFromDefault(p: ExternalProfile, d: ExternalProfile): string[] {
  const eq = (k: keyof ExternalProfile) => JSON.stringify(p[k]) === JSON.stringify(d[k]);
  return Object.entries(GROUPS).filter(([, ks]) => ks.some((k) => !eq(k))).map(([g]) => g);
}

const newKey = () => `pr-${crypto.randomUUID()}`;
const idem = () => crypto.randomUUID();

type Db = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const db = (): Db => supabase as unknown as Db;

export async function listPresets(template: ExternalTemplateCode, presentation?: Record<string, unknown> | null, c: Db = db()): Promise<Preset[]> {
  const { data, error } = await c.from("calendar_external_preset_versions")
    .select("preset_key,template_code,name,version,archived,profile,recorded_at").eq("template_code", template);
  if (error) throw new Error("Não foi possível ler seus presets.");
  return latestPresets((data ?? []) as PresetRow[], template, presentation);
}

async function put(c: Db, row: { preset_key: string; template_code: string; name: string; archived: boolean; profile: ExternalProfile }) {
  const { error } = await c.from("calendar_external_preset_versions").insert({ ...row, idempotency_key: idem() });
  if (error) throw new Error(/asset/.test(error.message ?? "") ? "Imagem recusada no preset." : "O preset não foi gravado.");
}

export const savePresetAs = (template: ExternalTemplateCode, name: string, profile: ExternalProfile, c: Db = db()) =>
  put(c, { preset_key: newKey(), template_code: template, name: presetName(name), archived: false, profile: sanitizeProfile(template, profile) });
export const updatePreset = (template: ExternalTemplateCode, p: Preset, patch: { name?: string; profile?: ExternalProfile }, c: Db = db()) =>
  put(c, { preset_key: p.key, template_code: template, name: presetName(patch.name ?? p.name), archived: false, profile: sanitizeProfile(template, patch.profile ?? p.profile) });
export const duplicatePreset = (template: ExternalTemplateCode, p: Preset, taken: readonly string[], c: Db = db()) =>
  savePresetAs(template, copyName(p.name, taken), p.profile, c);
export const archivePreset = (template: ExternalTemplateCode, p: Preset, c: Db = db()) =>
  put(c, { preset_key: p.key, template_code: template, name: p.name, archived: true, profile: p.profile });
