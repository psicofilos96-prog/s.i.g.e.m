/**
 * CAL.EXT.3.1 — seções do editor externo e validação de imagem. Só APARÊNCIA:
 * nada aqui lê ou altera dias, tipos, efeitos, totais ou o modelo interno.
 */
import type { ExternalProfile } from "./calendar-external-model";

export const EDITOR_SECTIONS = {
  identidade: ["visualTitle", "subtitle", "slogan", "footerText", "footerPhrase", "qrText", "feriasText", "logos"],
  fundo: ["coverImage", "footerImage", "pageImage"],
  posicaoFundo: ["coverFit", "coverFocusX", "coverFocusY", "coverZoom", "coverOpacity", "coverOverlay", "pageFocusX", "pageFocusY", "pageZoom", "pageOpacity"],
  cores: ["primary", "secondary", "accent", "headerColor", "textColor", "cardColor", "borderColor", "gridColor", "gridWidth", "lightColor", "pageColor", "holidayColor", "symbolOverrides", "cardRadius", "cardShadow", "borderWidth"],
  tipografia: ["titleFont", "bodyFont", "scriptFont", "titlePt", "subtitlePt", "textScale", "typeScale", "boxPad", "lineGap", "density"],
  estrutura: ["blockOrder", "show", "infoWidths", "bands", "gapMm", "periods", "pillars", "qrUrl"],
  impressao: ["minFitPt"],
  layoutLivre: ["free"],
} as const satisfies Record<string, readonly (keyof ExternalProfile)[]>;
export type EditorSection = keyof typeof EDITOR_SECTIONS;

/** Volta só os campos da seção ao padrão do modelo; o resto do perfil fica intacto. */
export function resetSection(profile: ExternalProfile, def: ExternalProfile, section: EditorSection): ExternalProfile {
  const next = { ...profile } as Record<string, unknown>;
  for (const k of EDITOR_SECTIONS[section]) next[k] = structuredClone(def[k]);
  return next as ExternalProfile;
}

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 1_100_000;

/** Confere assinatura real do arquivo (não só a extensão/MIME declarado). */
export function sniffImage(bytes: Uint8Array): (typeof IMAGE_TYPES)[number] | null {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return "image/webp";
  return null;
}

/** `ignoreSize`: a tela reduz a imagem sozinha antes de gravar (calendar-image-shrink). */
export function validateImage(declared: string, bytes: Uint8Array, opts: { ignoreSize?: boolean } = {}): { ok: true } | { error: string } {
  if (bytes.length === 0) return { error: "Arquivo vazio." };
  if (!(IMAGE_TYPES as readonly string[]).includes(declared)) return { error: "Use PNG, JPEG ou WEBP." };
  const real = sniffImage(bytes);
  if (!real) return { error: "O conteúdo do arquivo não é uma imagem PNG, JPEG ou WEBP válida." };
  if (real !== declared) return { error: "O tipo do arquivo não corresponde ao conteúdo. Salve a imagem de novo e tente outra vez." };
  if (!opts.ignoreSize && bytes.length > IMAGE_MAX_BYTES) return { error: "Imagem maior que o limite (≈1,1 MB)." };
  return { ok: true };
}
