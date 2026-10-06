/**
 * CAL.EXT.1 — Uma verdade, três apresentações. Registry dos modelos de apresentação do calendário e
 * view-model SOMENTE de apresentação derivado de `PrintModel` (que é a única fonte de dias/efeitos/totais).
 * Nada aqui calcula dia letivo, conta dias ou consulta o motor do laboratório: os números vêm prontos de
 * `buildPrintModel` e indeterminado continua indeterminado (null ≠ 0).
 */
import type { PrintCount, PrintDay, PrintModel, PrintPeriod } from "./institutional-calendar-presentation";
import type { CalendarDayRead } from "./institutional-calendar-readers";
import type { CouncilConfiguration } from "./institutional-calendar-councils";
import { logosOf, type CalendarLogo } from "./calendar-logos";

export const PRESENTATION_TEMPLATES = [
  { code: "interno", label: "Interno — Modelo técnico/oficial" },
  { code: "externo-panoramico", label: "Externo — Panorâmico" },
  { code: "externo-mosaico", label: "Externo — Mosaico" },
] as const;
export type PresentationTemplateCode = (typeof PRESENTATION_TEMPLATES)[number]["code"];
export type ExternalTemplateCode = Exclude<PresentationTemplateCode, "interno">;
export const DEFAULT_TEMPLATE: PresentationTemplateCode = "interno";
export const isExternal = (c: PresentationTemplateCode): c is ExternalTemplateCode => c !== "interno";

export const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const WEEK_HEAD = ["D", "S", "T", "Q", "Q", "S", "S"];

// ---------------- perfil visual (só aparência) ----------------
/**
 * Logo do EXTERNO. `ref` = id da logo herdada do snapshot institucional (`presentation.document.layout.logos`,
 * resolvida pelo mesmo `logosOf`/`LogoItem` do interno); `src` = imagem própria do externo (substitui a herdada).
 * Nunca o nome de arquivo como identidade.
 */
export type ExternalLogo = { id: string; ref: string | null; src: string | null; alt: string; hidden: boolean; heightMm: number; position: "esquerda" | "direita" };
export type ExternalProfile = {
  coverImage: string | null; coverFocusY: number; coverOverlay: number; footerImage: string | null;
  primary: string; secondary: string; headerColor: string; borderColor: string; cardColor: string; pageColor: string;
  titleFont: string; bodyFont: string;
  visualTitle: string | null; subtitle: string | null; slogan: string | null; footerText: string | null;
  logos: ExternalLogo[];
  show: { cabecalho: boolean; legenda: boolean; feriados: boolean; periodos: boolean; conselhos: boolean; assinaturas: boolean; branding: boolean; totaisMensais: boolean };
  qrUrl: string | null;
  cardRadius: number; cardShadow: number; borderWidth: number; density: number;
  symbolOverrides: Record<string, { background?: string; foreground?: string }>;
};

const BASE: ExternalProfile = {
  coverImage: null, coverFocusY: 50, coverOverlay: 35, footerImage: null,
  primary: "#0B4A8B", secondary: "#2F80D1", headerColor: "#0B4A8B", borderColor: "#B9CCE4", cardColor: "#FFFFFF", pageColor: "#F4F8FD",
  titleFont: "'Montserrat', 'Segoe UI', sans-serif", bodyFont: "'Source Sans 3', 'Segoe UI', sans-serif",
  visualTitle: null, subtitle: null, slogan: null, footerText: null, logos: [],
  show: { cabecalho: true, legenda: true, feriados: true, periodos: true, conselhos: true, assinaturas: true, branding: true, totaisMensais: true },
  qrUrl: null, cardRadius: 3, cardShadow: 1, borderWidth: 0.3, density: 1, symbolOverrides: {},
};
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
/** Identidade visual institucional do snapshot (somente leitura; o externo nunca a altera). */
export function institutionalIdentity(presentation: Record<string, unknown> | null | undefined): { headerLines: string[]; logos: CalendarLogo[] } {
  const doc = presentation && isObj(presentation["document"]) ? presentation["document"] : {};
  const headerLines = Array.isArray(doc["headerLines"]) ? (doc["headerLines"] as unknown[]).filter((h): h is string => typeof h === "string") : [];
  const layout = isObj(doc["layout"]) ? (doc["layout"] as { logos?: CalendarLogo[] }) : undefined;
  return { headerLines, logos: logosOf(layout) };
}
export const inheritedLogos = (presentation: Record<string, unknown> | null | undefined): ExternalLogo[] =>
  institutionalIdentity(presentation).logos.map((l) => ({ id: `herdada:${l.id}`, ref: l.id, src: null, alt: l.label, hidden: !l.visible,
    heightMm: 16, position: l.position === "direita" ? "direita" : "esquerda" }));
/** Padrão do modelo = padrão artístico + identidade institucional herdada do snapshot. */
export function defaultProfile(t: ExternalTemplateCode, presentation?: Record<string, unknown> | null): ExternalProfile {
  const b = structuredClone(BASE); b.logos = inheritedLogos(presentation);
  void t; return b;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const ASSET_MAX_CHARS = 1_572_864; // mesmo limite do writer (0201)
const clamp = (n: unknown, lo: number, hi: number, d: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
const img = (v: unknown) => (typeof v === "string" && IMG.test(v) && v.length <= ASSET_MAX_CHARS ? v : null);
const col = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
const FONTS = ["'Montserrat', 'Segoe UI', sans-serif", "'Source Sans 3', 'Segoe UI', sans-serif", "'Playfair Display', Georgia, serif", "'Merriweather', Georgia, serif", "'Oswald', 'Arial Narrow', sans-serif"];
export const FONT_OPTIONS = FONTS;
const font = (v: unknown, d: string) => (typeof v === "string" && FONTS.includes(v) ? v : d);
export function safeQrUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try { const u = new URL(v.trim()); return u.protocol === "https:" ? u.toString() : null; } catch { return null; }
}

/** Aceita qualquer objeto e devolve um perfil válido; campo inválido volta ao padrão do modelo (nunca quebra a folha). */
export function sanitizeProfile(t: ExternalTemplateCode, raw: unknown, presentation?: Record<string, unknown> | null): ExternalProfile {
  const d = defaultProfile(t, presentation);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  const r = raw as Record<string, unknown>;
  const show = (r["show"] && typeof r["show"] === "object" ? r["show"] : {}) as Record<string, unknown>;
  const rawLogos = Array.isArray(r["logos"]) ? (r["logos"] as unknown[]) : null;
  const ov = r["symbolOverrides"] && typeof r["symbolOverrides"] === "object" ? (r["symbolOverrides"] as Record<string, Record<string, unknown>>) : {};
  return {
    coverImage: img(r["coverImage"]), coverFocusY: clamp(r["coverFocusY"], 0, 100, d.coverFocusY), coverOverlay: clamp(r["coverOverlay"], 0, 90, d.coverOverlay),
    footerImage: img(r["footerImage"]),
    primary: col(r["primary"], d.primary), secondary: col(r["secondary"], d.secondary), headerColor: col(r["headerColor"], d.headerColor),
    borderColor: col(r["borderColor"], d.borderColor), cardColor: col(r["cardColor"], d.cardColor), pageColor: col(r["pageColor"], d.pageColor),
    titleFont: font(r["titleFont"], d.titleFont), bodyFont: font(r["bodyFont"], d.bodyFont),
    visualTitle: str(r["visualTitle"]), subtitle: str(r["subtitle"]), slogan: str(r["slogan"]), footerText: str(r["footerText"]),
    logos: rawLogos === null ? d.logos : rawLogos.flatMap((l, i) => {
      if (!l || typeof l !== "object") return [];
      const o = l as Record<string, unknown>; const src = img(o["src"]);
      const ref = typeof o["ref"] === "string" && o["ref"] ? o["ref"].slice(0, 100) : null;
      if (!src && !ref) return [];
      return [{ id: typeof o["id"] === "string" ? o["id"] : `logo-${i}`, ref, src, alt: str(o["alt"]) ?? "Logo institucional", hidden: o["hidden"] === true,
        heightMm: clamp(o["heightMm"], 6, 30, 16), position: o["position"] === "direita" ? "direita" : "esquerda" } as ExternalLogo];
    }).slice(0, 8),
    show: Object.fromEntries(Object.entries(d.show).map(([k, v]) => [k, typeof show[k] === "boolean" ? show[k] : v])) as ExternalProfile["show"],
    qrUrl: safeQrUrl(r["qrUrl"]),
    cardRadius: clamp(r["cardRadius"], 0, 8, d.cardRadius), cardShadow: clamp(r["cardShadow"], 0, 3, d.cardShadow),
    borderWidth: clamp(r["borderWidth"], 0, 1, d.borderWidth), density: clamp(r["density"], 0.85, 1.1, d.density),
    symbolOverrides: Object.fromEntries(Object.entries(ov).flatMap(([k, v]) => v && typeof v === "object"
      ? [[k, { ...(HEX.test(String(v["background"])) ? { background: String(v["background"]) } : {}), ...(HEX.test(String(v["foreground"])) ? { foreground: String(v["foreground"]) } : {}) }]] : [])),
  };
}

// ---------------- view-model de apresentação ----------------
export type ExternalMonth = Readonly<{
  key: string; index: number; name: string; daysInMonth: number; firstWeekday: number;
  /** Mapa 1..31 → dia lido (undefined = data não lida/inexistente; nunca inventado). */
  byDay: ReadonlyMap<number, PrintDay>; total: PrintCount;
  /** Grade semanal D..S: null = célula vazia antes/depois do mês. */
  weeks: readonly (readonly (number | null)[])[];
}>;
export type ExternalViewModel = Readonly<{
  year: number | null; title: string | null; months: readonly ExternalMonth[];
  periods: readonly PrintPeriod[]; total: PrintCount; holidays: PrintModel["holidays"];
  legendCodes: readonly string[]; unmappedTypes: readonly string[]; mismatches: readonly string[]; signatures: readonly string[];
  councils: ExternalCouncils;
  /** Todos os dias canônicos (mesma ordem/identidade de `PrintModel`). */
  days: readonly PrintDay[];
}>;

/**
 * Conselhos da versão impressa: SÓ pela configuração explícita da versão (`calendar_council_configuration_at`)
 * cruzada com as declarações reais de `calendar_days_at` daquela versão. Catálogo, sigla, nome e `councilRole`
 * da fonte nunca decidem. Não configurada ≠ nenhum declarado; negado/malformado são estados explícitos.
 */
export type ExternalCouncils =
  | { state: "nao-lida" } | { state: "acesso-negado" } | { state: "malformada"; reason: string }
  | { state: "nao-configurada" } | { state: "nenhum-declarado" }
  | { state: "configurada"; items: readonly { on: string; name: string; role: string }[] };
export type CouncilInput = { versionId: string; config: CouncilConfiguration | null; days: readonly CalendarDayRead[] };

export function councilsOf(input: CouncilInput | null | undefined): ExternalCouncils {
  const c = input?.config;
  if (!input || !c) return { state: "nao-lida" };
  if (c.kind === "acesso-negado") return { state: "acesso-negado" };
  if (c.kind === "malformada") return { state: "malformada", reason: c.reason };
  if (c.kind === "nao-configurada") return { state: "nao-configurada" };
  if (c.declaresNone) return { state: "nenhum-declarado" };
  const roles = new Map(c.roles.map((r) => [r.dayTypeId, r.role]));
  const items: { on: string; name: string; role: string }[] = [];
  for (const d of input.days) for (const row of d.rows ?? []) {
    if (row.versionId !== input.versionId || row.declarationId === null || row.dayTypeId === null) continue;
    const role = roles.get(row.dayTypeId); if (!role) continue;
    if (items.some((i) => i.on === d.on && i.role === role)) continue;
    items.push({ on: d.on, name: row.eventLabel ?? row.dayTypeLabel ?? role, role });
  }
  items.sort((a, b) => a.on.localeCompare(b.on));
  return { state: "configurada", items };
}

export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export const weekdayOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).getUTCDay();

export function buildExternalViewModel(model: PrintModel, presentation: Record<string, unknown>, council?: CouncilInput | null): ExternalViewModel {
  const year = typeof presentation["year"] === "number" ? presentation["year"] : model.months[0] ? Number(model.months[0].key.slice(0, 4)) : null;
  const months: ExternalMonth[] = model.months.map((m) => {
    const y = Number(m.key.slice(0, 4)); const mi = Number(m.key.slice(5, 7)) - 1;
    const dim = daysInMonth(y, mi); const first = weekdayOf(y, mi, 1);
    const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
    while (cells.length % 7) cells.push(null);
    const weeks: (number | null)[][] = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { key: m.key, index: mi, name: MONTH_NAMES[mi]!, daysInMonth: dim, firstWeekday: first,
      byDay: new Map(m.days.map((d) => [Number(d.on.slice(8, 10)), d])), total: m.total, weeks };
  });
  const days = model.months.flatMap((m) => m.days);
  const councils = councilsOf(council);
  return { year, title: model.title, months, periods: model.periods, total: model.total, holidays: model.holidays,
    legendCodes: model.legendCodes, unmappedTypes: model.unmappedTypes, mismatches: model.mismatches, signatures: model.signatures, councils, days };
}

export const countText = (c: PrintCount) => (c.schoolDays === null ? "indeterminado" : String(c.schoolDays));
export const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
