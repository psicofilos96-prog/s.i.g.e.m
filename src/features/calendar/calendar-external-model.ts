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
import { defaultFreeLayout, sanitizeFree, type FreeLayout } from "./calendar-external-free";
import { MONTH_NAMES } from "@/lib/format-ptbr";

export const PRESENTATION_TEMPLATES = [
  { code: "interno", label: "Interno — Modelo técnico/oficial" },
  { code: "externo-livre", label: "Externo — Layout livre" },
] as const;
/** Todo modelo externo usa o layout livre (blocos posicionados em mm), com o mesmo conteúdo do interno. */
export const isFreeTemplate = (t: PresentationTemplateCode): t is ExternalTemplateCode => t !== "interno";
export type PresentationTemplateCode = (typeof PRESENTATION_TEMPLATES)[number]["code"];
export type ExternalTemplateCode = Exclude<PresentationTemplateCode, "interno">;
export const DEFAULT_TEMPLATE: PresentationTemplateCode = "interno";
export const isExternal = (c: PresentationTemplateCode): c is ExternalTemplateCode => c !== "interno";

export { MONTH_NAMES };
export const WEEK_HEAD = ["D", "S", "T", "Q", "Q", "S", "S"];

// ---------------- perfil visual (só aparência) ----------------
/**
 * Logo do EXTERNO. `ref` = id da logo herdada do snapshot institucional (`presentation.document.layout.logos`,
 * resolvida pelo mesmo `logosOf`/`LogoItem` do interno); `src` = imagem própria do externo (substitui a herdada).
 * Nunca o nome de arquivo como identidade.
 */
export type ExternalLogo = { id: string; ref: string | null; src: string | null; alt: string; hidden: boolean; heightMm: number; position: "esquerda" | "direita" };
export type ExternalPillar = { title: string; subtitle: string; icon: "estudantes" | "escolas" | "cidade"; hidden: boolean };
/** N2 — proporções verticais (% da área útil). Panorâmico: banner/grade/info/rodapé; Mosaico: banner/centro/inferior/rodapé. */
export type ExternalBands = { banner: number; body: number; info: number; footer: number };
/** CAL.EXT.2 — arranjo do bloco "Períodos letivos" (só aparência; legibilidade vence estética). */
export type PeriodLayout = {
  cols: "auto" | 1 | 2 | 3 | 4; layout: "horizontal" | "grade" | "empilhado"; align: "centro" | "esquerda";
  density: "confortavel" | "media" | "compacta"; minHmm: number; wrap: boolean; autoScale: boolean;
};
export type CoverFit = "cobrir" | "conter" | "manual";
/** Larguras relativas da faixa de informações (fr). */
export type InfoWidths = { legenda: number; periodos: number; feriados: number; extra: number };
/** CAL.EXT.2.1 — blocos reordenáveis da faixa informativa. */
export const INFO_BLOCKS = ["legenda", "periodos", "feriados", "conselhos", "assinaturas"] as const;
export type InfoBlock = (typeof INFO_BLOCKS)[number];
/** Tamanhos por bloco: multiplicador (×) sobre o tamanho do modelo; faixa segura 0,7–1,4. */
export const TYPE_KEYS = ["blockTitle", "periodName", "periodText", "periodNumber", "legend", "holidays", "councils", "signatures", "footer", "months", "days"] as const;
/** Faixa segura dos tamanhos por bloco (50%–200%). */
export const TYPE_MIN = 0.5, TYPE_MAX = 2;
/** Espaço interno (mm) de cada caixa. */
export type BoxPad = Record<InfoBlock, number>;
export const PAD_MIN = 0.3, PAD_MAX = 5;
/** Espaçamento entre linhas por bloco (multiplicador da altura da linha). */
export const LINE_MIN = 0.9, LINE_MAX = 2.5;
export type TypeKey = (typeof TYPE_KEYS)[number];
export type ExternalProfile = {
  blockOrder: InfoBlock[]; typeScale: Record<TypeKey, number>; boxPad: BoxPad; lineGap: BoxPad;
  coverFit: CoverFit; periods: PeriodLayout; infoWidths: InfoWidths;
  coverImage: string | null; coverFocusY: number; coverFocusX: number; coverZoom: number; coverOpacity: number; coverOverlay: number; footerImage: string | null;
  pageImage: string | null; pageFocusX: number; pageFocusY: number; pageZoom: number; pageOpacity: number;
  primary: string; secondary: string; headerColor: string; borderColor: string; gridColor: string; gridWidth: number; cardColor: string; pageColor: string;
  accent: string; lightColor: string; holidayColor: string; textColor: string;
  titleFont: string; bodyFont: string; scriptFont: string;
  titlePt: number; subtitlePt: number; textScale: number; minFitPt: number;
  bands: ExternalBands; gapMm: number;
  visualTitle: string | null; subtitle: string | null; slogan: string | null; footerText: string | null;
  footerPhrase: string; qrText: string; feriasText: string; pillars: ExternalPillar[];
  logos: ExternalLogo[];
  show: { cabecalho: boolean; legenda: boolean; feriados: boolean; periodos: boolean; conselhos: boolean; assinaturas: boolean; branding: boolean; totaisMensais: boolean;
    imagemTopo: boolean; slogan: boolean; numeroMes: boolean; pilares: boolean; qr: boolean; ilustracao: boolean; totaisColuna: boolean };
  qrUrl: string | null;
  cardRadius: number; cardShadow: number; borderWidth: number; density: number;
  symbolOverrides: Record<string, { background?: string; foreground?: string }>;
  /** CAL.EXT.3 — layout livre (usado só pelos modelos Fotográfico e Quadro anual). */
  free: FreeLayout;
};

const BASE: ExternalProfile = {
  blockOrder: [...INFO_BLOCKS],
  typeScale: { blockTitle: 1, periodName: 1, months: 1, days: 1, periodText: 1, periodNumber: 1, legend: 1, holidays: 1, councils: 1, signatures: 1, footer: 1 },
  boxPad: { legenda: 2, periodos: 1.5, feriados: 2, conselhos: 2, assinaturas: 2 },
  lineGap: { legenda: 1.1, periodos: 1.1, feriados: 1.15, conselhos: 1.15, assinaturas: 1.15 },
  coverFit: "manual",
  periods: { cols: "auto", layout: "grade", align: "centro", density: "media", minHmm: 0, wrap: true, autoScale: true },
  infoWidths: { legenda: 27, periodos: 33, feriados: 40, extra: 24 },
  coverImage: null, coverFocusY: 45, coverFocusX: 70, coverZoom: 100, coverOpacity: 90, coverOverlay: 55, footerImage: null, pageImage: null, pageFocusX: 50, pageFocusY: 50, pageZoom: 100, pageOpacity: 100,
  primary: "#0B3D7A", secondary: "#1565C0", headerColor: "#0A2F63", borderColor: "#BBD7F0", gridColor: "#8FB3D9", gridWidth: 0.2, cardColor: "#FFFFFF", pageColor: "#F5FAFF",
  accent: "#1565C0", lightColor: "#DCEEFB", holidayColor: "#E8453C", textColor: "#1F2937",
  titleFont: "'Barlow Condensed', 'Arial Narrow', sans-serif", bodyFont: "'Barlow', 'Segoe UI', sans-serif", scriptFont: "'Caveat', cursive",
  titlePt: 30, subtitlePt: 9, textScale: 1, minFitPt: 5,
  bands: { banner: 17, body: 59, info: 15, footer: 9 }, gapMm: 2,
  visualTitle: null, subtitle: null, slogan: "Itaperuna mais educação, para um futuro ainda melhor.", footerText: null,
  footerPhrase: "Educação que constrói o futuro da nossa cidade.", qrText: "Acesse a versão digital atualizada no SIGEM", feriasText: "FÉRIAS",
  pillars: [
    { title: "Estudantes", subtitle: "MAIS OPORTUNIDADES", icon: "estudantes", hidden: false },
    { title: "Escolas", subtitle: "MAIS QUALIDADE", icon: "escolas", hidden: false },
    { title: "Itaperuna", subtitle: "MAIS EDUCAÇÃO", icon: "cidade", hidden: false },
  ],
  logos: [],
  show: { cabecalho: true, legenda: true, feriados: true, periodos: true, conselhos: true, assinaturas: true, branding: true, totaisMensais: true,
    imagemTopo: true, slogan: true, numeroMes: true, pilares: true, qr: true, ilustracao: true, totaisColuna: true },
  qrUrl: null, cardRadius: 2, cardShadow: 1, borderWidth: 0.3, density: 1, symbolOverrides: {},
  free: defaultFreeLayout("quadro"),
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
/** Padrão do modelo = padrão artístico do prompt-guia do modelo + identidade institucional herdada do snapshot. */
export function defaultProfile(t: ExternalTemplateCode, presentation?: Record<string, unknown> | null): ExternalProfile {
  const b = structuredClone(BASE); b.logos = inheritedLogos(presentation);
  void t; // único modelo externo: layout livre com imagem opcional só no topo (nunca de página inteira)
  b.free = defaultFreeLayout("fotografico");
  b.free.photo = { ...b.free.photo, page: null, bottom: null, bottomHmm: 0, veilStrength: 0 };
  return b;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const ASSET_MAX_CHARS = 1_572_864; // mesmo limite do writer (0201)
const clamp = (n: unknown, lo: number, hi: number, d: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
const img = (v: unknown) => (typeof v === "string" && IMG.test(v) && v.length <= ASSET_MAX_CHARS ? v : null);
const col = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
const FONTS = ["'Barlow Condensed', 'Arial Narrow', sans-serif", "'Oswald', 'Arial Narrow', sans-serif", "'Barlow', 'Segoe UI', sans-serif",
  "'Montserrat', 'Segoe UI', sans-serif", "'Source Sans 3', 'Segoe UI', sans-serif", "'Playfair Display', Georgia, serif", "'Merriweather', Georgia, serif"];
export const FONT_OPTIONS = FONTS;
export const SCRIPT_FONT_OPTIONS = ["'Caveat', cursive", "'Kalam', cursive"];
const font = (v: unknown, d: string, list = FONTS) => (typeof v === "string" && list.includes(v) ? v : d);
export function safeQrUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try { const u = new URL(v.trim()); return u.protocol === "https:" ? u.toString() : null; } catch { return null; }
}
/** Soma travada em 100: cada faixa dentro do limite e o corpo absorve a diferença. */
export function sanitizeBands(raw: unknown, d: ExternalBands): ExternalBands {
  const r = isObj(raw) ? raw : {};
  const banner = clamp(r["banner"], 10, 25, d.banner), info = clamp(r["info"], 8, 28, d.info), footer = clamp(r["footer"], 0, 14, d.footer);
  return { banner, info, footer, body: Math.round((100 - banner - info - footer) * 10) / 10 };
}

/** Aceita qualquer objeto e devolve um perfil válido; campo inválido volta ao padrão do modelo (nunca quebra a folha). */
export function sanitizeProfile(t: ExternalTemplateCode, raw: unknown, presentation?: Record<string, unknown> | null): ExternalProfile {
  const d = defaultProfile(t, presentation);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  const r = raw as Record<string, unknown>;
  const show = (r["show"] && typeof r["show"] === "object" ? r["show"] : {}) as Record<string, unknown>;
  const rawLogos = Array.isArray(r["logos"]) ? (r["logos"] as unknown[]) : null;
  const ov = r["symbolOverrides"] && typeof r["symbolOverrides"] === "object" ? (r["symbolOverrides"] as Record<string, Record<string, unknown>>) : {};
  const rawPillars = Array.isArray(r["pillars"]) ? (r["pillars"] as unknown[]) : null;
  const text = (k: string, dv: string) => typeof r[k] === "string" ? String(r[k]).slice(0, 200) : dv;
  const pr = isObj(r["periods"]) ? r["periods"] : {};
  const iw = isObj(r["infoWidths"]) ? r["infoWidths"] : {};
  const pick = <T,>(v: unknown, list: readonly T[], dv: T): T => (list.includes(v as T) ? (v as T) : dv);
  const ord = Array.isArray(r["blockOrder"]) ? (r["blockOrder"] as unknown[]).filter((x): x is InfoBlock => INFO_BLOCKS.includes(x as InfoBlock)) : [];
  const ts = isObj(r["typeScale"]) ? r["typeScale"] : {};
  return {
    blockOrder: [...new Set([...ord, ...d.blockOrder])],
    typeScale: Object.fromEntries(TYPE_KEYS.map((k) => [k, clamp(ts[k], TYPE_MIN, TYPE_MAX, d.typeScale[k])])) as Record<TypeKey, number>,
    boxPad: Object.fromEntries(INFO_BLOCKS.map((k) => [k, clamp((isObj(r["boxPad"]) ? r["boxPad"] : {})[k], PAD_MIN, PAD_MAX, d.boxPad[k])])) as BoxPad,
    lineGap: Object.fromEntries(INFO_BLOCKS.map((k) => [k, clamp((isObj(r["lineGap"]) ? r["lineGap"] : {})[k], LINE_MIN, LINE_MAX, d.lineGap[k])])) as BoxPad,
    coverFit: pick(r["coverFit"], ["cobrir", "conter", "manual"] as const, d.coverFit),
    periods: {
      cols: pick(pr["cols"], ["auto", 1, 2, 3, 4] as const, d.periods.cols), layout: pick(pr["layout"], ["horizontal", "grade", "empilhado"] as const, d.periods.layout),
      align: pick(pr["align"], ["centro", "esquerda"] as const, d.periods.align), density: pick(pr["density"], ["confortavel", "media", "compacta"] as const, d.periods.density),
      minHmm: clamp(pr["minHmm"], 0, 30, d.periods.minHmm), wrap: typeof pr["wrap"] === "boolean" ? pr["wrap"] : d.periods.wrap,
      autoScale: typeof pr["autoScale"] === "boolean" ? pr["autoScale"] : d.periods.autoScale,
    },
    infoWidths: { legenda: clamp(iw["legenda"], 10, 60, d.infoWidths.legenda || 27), periodos: clamp(iw["periodos"], 10, 60, d.infoWidths.periodos),
      feriados: clamp(iw["feriados"], 10, 60, d.infoWidths.feriados || 40), extra: clamp(iw["extra"], 10, 60, d.infoWidths.extra) },
    coverImage: img(r["coverImage"]), coverFocusY: clamp(r["coverFocusY"], 0, 100, d.coverFocusY), coverFocusX: clamp(r["coverFocusX"], 0, 100, d.coverFocusX),
    coverZoom: clamp(r["coverZoom"], 100, 250, d.coverZoom), coverOpacity: clamp(r["coverOpacity"], 0, 100, d.coverOpacity),
    coverOverlay: clamp(r["coverOverlay"], 0, 90, d.coverOverlay),
    footerImage: img(r["footerImage"]), pageImage: img(r["pageImage"]),
    pageFocusX: clamp(r["pageFocusX"], 0, 100, d.pageFocusX), pageFocusY: clamp(r["pageFocusY"], 0, 100, d.pageFocusY),
    pageZoom: clamp(r["pageZoom"], 100, 250, d.pageZoom), pageOpacity: clamp(r["pageOpacity"], 0, 100, d.pageOpacity),
    primary: col(r["primary"], d.primary), secondary: col(r["secondary"], d.secondary), headerColor: col(r["headerColor"], d.headerColor),
    borderColor: col(r["borderColor"], d.borderColor), gridColor: col(r["gridColor"], d.gridColor), gridWidth: clamp(r["gridWidth"], 0.1, 0.6, d.gridWidth), cardColor: col(r["cardColor"], d.cardColor), pageColor: col(r["pageColor"], d.pageColor),
    accent: col(r["accent"], d.accent), lightColor: col(r["lightColor"], d.lightColor), holidayColor: col(r["holidayColor"], d.holidayColor), textColor: col(r["textColor"], d.textColor),
    titleFont: font(r["titleFont"], d.titleFont), bodyFont: font(r["bodyFont"], d.bodyFont), scriptFont: font(r["scriptFont"], d.scriptFont, SCRIPT_FONT_OPTIONS),
    titlePt: clamp(r["titlePt"], 16, 40, d.titlePt), subtitlePt: clamp(r["subtitlePt"], 6, 14, d.subtitlePt),
    textScale: clamp(r["textScale"], 0.8, 1.25, d.textScale), minFitPt: clamp(r["minFitPt"], 4, 7, d.minFitPt),
    bands: sanitizeBands(r["bands"], d.bands), gapMm: clamp(r["gapMm"], 0.5, 5, d.gapMm),
    visualTitle: str(r["visualTitle"]), subtitle: str(r["subtitle"]), slogan: "slogan" in r ? str(r["slogan"]) : d.slogan, footerText: str(r["footerText"]),
    footerPhrase: text("footerPhrase", d.footerPhrase), qrText: text("qrText", d.qrText), feriasText: text("feriasText", d.feriasText),
    pillars: rawPillars === null ? d.pillars : rawPillars.slice(0, 4).flatMap((x, i) => {
      if (!isObj(x)) return [];
      const icon = x["icon"] === "escolas" || x["icon"] === "cidade" || x["icon"] === "estudantes" ? x["icon"] : (d.pillars[i]?.icon ?? "estudantes");
      return [{ title: typeof x["title"] === "string" ? x["title"].slice(0, 40) : "", subtitle: typeof x["subtitle"] === "string" ? x["subtitle"].slice(0, 40) : "", icon, hidden: x["hidden"] === true }];
    }),
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
    free: sanitizeFree(r["free"], d.free, FONTS, ASSET_MAX_CHARS),
  };
}

// ---------------- view-model de apresentação ----------------
export type ExternalMonth = Readonly<{
  key: string; index: number; name: string; daysInMonth: number; firstWeekday: number;
  /** Mapa 1..31 → dia lido (undefined = data não lida/inexistente; nunca inventado). */
  byDay: ReadonlyMap<number, PrintDay>; total: PrintCount;
  /** Mês com passagem de período (um termina e outro começa nele): letivos de cada lado, como no interno. */
  split?: readonly [number, number];
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
      byDay: new Map(m.days.map((d) => [Number(d.on.slice(8, 10)), d])), total: m.total, weeks, ...splitOf(m.key, m.days, model.periods) };
  });
  const days = model.months.flatMap((m) => m.days);
  const councils = councilsOf(council);
  return { year, title: model.title, months, periods: model.periods, total: model.total, holidays: model.holidays,
    legendCodes: model.legendCodes, unmappedTypes: model.unmappedTypes, mismatches: model.mismatches, signatures: model.signatures, councils, days };
}

function splitOf(key: string, days: readonly PrintDay[], periods: readonly PrintPeriod[]): { split?: readonly [number, number] } {
  const ps = [...periods].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  for (let i = 0; i + 1 < ps.length; i++) {
    const end = ps[i]!.endsOn, next = ps[i + 1]!.startsOn;
    if (end.slice(0, 7) !== key || next.slice(0, 7) !== key) continue;
    const inAny = (on: string) => ps.some((p) => p.startsOn <= on && p.endsOn >= on);
    let a = 0, b = 0;
    for (const d of days) if (d.effect === "letivo" && inAny(d.on)) { if (d.on <= end) a++; else b++; }
    return { split: [a, b] };
  }
  return {};
}

export const countText = (c: PrintCount) => (c.schoolDays === null ? "indeterminado" : String(c.schoolDays));
export const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * N2 — Legenda externa gerada da MESMA tabela de estilos das células: todo código que aparece pintado em
 * alguma célula (símbolo ou extra) entra, na ordem da legenda do catálogo; só o tipo sem cor e sem sigla
 * (dia comum em branco) fica fora, porque não há nada a explicar.
 */
export function externalLegendCodes(vm: Pick<ExternalViewModel, "days" | "legendCodes">, visual: (code: string) => { mark: string; bg: string }): string[] {
  const used: string[] = [];
  for (const d of vm.days) for (const c of [d.symbolCode, ...d.extraCodes]) if (c && !used.includes(c)) used.push(c);
  const rank = (c: string) => { const i = vm.legendCodes.indexOf(c); return i < 0 ? 1000 : i; };
  return used.filter((c) => { const v = visual(c); return !!v.mark || !/^#?f{6}$/i.test((v.bg ?? "#ffffff").replace("#", "")); })
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * N2 — Total por coluna (dia 1..31) do Mosaico: só soma efeitos já resolvidos pelo PrintModel; se qualquer data
 * existente da coluna não estiver determinada (letivo/não letivo), a coluna é indeterminada (null ≠ 0).
 */
export function columnTotals(months: readonly ExternalMonth[]): (number | null)[] {
  return Array.from({ length: 31 }, (_, i) => {
    let n = 0;
    for (const m of months) {
      if (i + 1 > m.daysInMonth) continue;
      const d = m.byDay.get(i + 1);
      if (!d || (d.effect !== "letivo" && d.effect !== "nao-letivo" && d.effect !== "sem-declaracao")) return null;
      if (d.effect === "letivo") n++;
    }
    return n;
  });
}

/**
 * CAL.EXT.2 — Colunas do bloco "Períodos letivos": empilhado = 1; número fixo nunca excede a quantidade de
 * períodos; automático em grade usa uma linha até 4 períodos e 3 colunas a partir de 5, para que nome e
 * datas nunca disputem a mesma linha estreita.
 */
export function periodColumns(n: number, cfg: Pick<PeriodLayout, "cols" | "layout">): number {
  const count = Math.max(1, n);
  if (cfg.layout === "empilhado") return 1;
  if (cfg.cols !== "auto") return Math.min(cfg.cols, count);
  if (cfg.layout === "horizontal") return count;
  return count <= 4 ? count : 3;
}
/** Os 9 pontos de ancoragem viram foco X/Y (%) da imagem de fundo. */
export const ANCHORS = [
  { label: "Superior esquerdo", x: 0, y: 0 }, { label: "Topo centro", x: 50, y: 0 }, { label: "Superior direito", x: 100, y: 0 },
  { label: "Centro esquerdo", x: 0, y: 50 }, { label: "Centro", x: 50, y: 50 }, { label: "Centro direito", x: 100, y: 50 },
  { label: "Inferior esquerdo", x: 0, y: 100 }, { label: "Inferior centro", x: 50, y: 100 }, { label: "Inferior direito", x: 100, y: 100 },
] as const;

/** Move um bloco na ordem (±1); ocultos continuam na lista e não quebram a ordem dos visíveis. */
export function moveBlock(order: readonly InfoBlock[], b: InfoBlock, dir: -1 | 1): InfoBlock[] {
  const a = [...order]; const i = a.indexOf(b); const j = i + dir;
  if (i < 0 || j < 0 || j >= a.length) return a;
  [a[i], a[j]] = [a[j]!, a[i]!]; return a;
}

/**
 * "Ajustar para caber" (ação explícita do usuário, nunca automática): um passo de ajuste por vez,
 * só em espaço (altura da faixa) e, esgotado o espaço, no piso da fonte (mínimo legível 4 pt).
 * Devolve null quando não há mais o que ajustar sem esconder ou cortar conteúdo.
 */
export function nextFitStep(p: ExternalProfile, issues: readonly string[]): ExternalProfile | null {
  if (!issues.length) return null;
  const info = issues.some((i) => (INFO_BLOCKS as readonly string[]).includes(i));
  let bands = { ...p.bands }; let minFitPt = p.minFitPt; let changed = false;
  if (issues.includes("cabecalho") && bands.banner < 25) { bands.banner += 1; changed = true; }
  if (issues.includes("branding") && bands.footer < 14) { bands.footer += 1; changed = true; }
  if (info) {
    if (bands.info < 28 && bands.body > 50) { bands.info += 1; changed = true; }
    else if (minFitPt > 4) { minFitPt = Math.max(4, minFitPt - 0.5); changed = true; }
  }
  if (!changed) return null;
  bands = sanitizeBands(bands, p.bands);
  return { ...p, bands, minFitPt };
}
