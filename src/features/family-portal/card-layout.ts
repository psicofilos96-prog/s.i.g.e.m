/**
 * NCARD.1 — layout frente/verso da carteirinha (escolhas versionadas por escola; nunca dados de estudante).
 * Espelho puro de `student_card_layout_problem` (o banco revalida tudo).
 */
export type CardLogo = "brasao" | "sigem" | "educacao";
export type CardLayout = {
  format: "card-v1"; accent: 0 | 1 | 2 | 3 | 4; title: string; backText: string;
  logos: CardLogo[]; showClass: boolean; showShift: boolean; showInternalId: boolean;
};
export const CARD_LOGOS: readonly CardLogo[] = ["brasao", "sigem", "educacao"];
export const CARD_LOGO_LABEL: Record<CardLogo, string> = { brasao: "Brasão de Itaperuna", sigem: "SIGEM", educacao: "Secretaria de Educação" };
/** Cores vêm dos tokens do tema (nunca hex no componente). */
export const CARD_ACCENTS = ["bg-primary text-primary-foreground", "bg-secondary text-secondary-foreground", "bg-accent text-accent-foreground",
  "bg-foreground text-background", "bg-muted text-foreground"] as const;
export const CARD_ACCENT_LABEL = ["Principal", "Secundária", "Destaque", "Escura", "Neutra"] as const;

export const DEFAULT_CARD_LAYOUT: CardLayout = {
  format: "card-v1", accent: 0, title: "Carteirinha do Estudante",
  backText: "Documento de identificação escolar. Confira a validade pelo QR.", logos: ["brasao", "sigem"],
  showClass: true, showShift: false, showInternalId: true,
};
const KEYS = new Set(["format", "accent", "title", "backText", "logos", "showClass", "showShift", "showInternalId"]);

export function cardLayoutProblem(c: unknown): string | null {
  if (!c || typeof c !== "object" || Array.isArray(c)) return "layout:not-object";
  const o = c as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KEYS.has(k)) return `layout:key:${k}`;
  if (o["format"] !== "card-v1") return "layout:format";
  if (![0, 1, 2, 3, 4].includes(o["accent"] as number)) return "layout:accent";
  if (typeof o["title"] !== "string" || o["title"].length < 1 || o["title"].length > 60) return "layout:title";
  if (typeof o["backText"] !== "string" || o["backText"].length > 200) return "layout:backText";
  if (!Array.isArray(o["logos"]) || o["logos"].length > 3) return "layout:logos";
  for (const l of o["logos"]) if (!CARD_LOGOS.includes(l as CardLogo)) return `layout:logo:${String(l)}`;
  for (const k of ["showClass", "showShift", "showInternalId"]) if (typeof o[k] !== "boolean") return `layout:${k}`;
  return null;
}

/** Layout salvo ilegível nunca quebra a impressão: cai no padrão (sinalizado por `fromDefault`). */
export function readCardLayout(c: unknown): { layout: CardLayout; fromDefault: boolean } {
  return cardLayoutProblem(c) ? { layout: DEFAULT_CARD_LAYOUT, fromDefault: true } : { layout: c as CardLayout, fromDefault: false };
}
