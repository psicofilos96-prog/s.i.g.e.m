/**
 * Diagramação e aparência do documento do Calendário Escolar — DADO.
 *
 * Separação: dados do calendário ≠ regras ≠ conteúdo ≠ aparência. Este módulo
 * só conhece aparência; nada aqui participa de contagem, regra ou semântica.
 * Persistido em `NetworkCalendar.document.layout` pelo mesmo caminho de
 * gravação do documento (`configurar-documento`) — não há segunda configuração.
 *
 * Hierarquia: padrão do modelo (CSS) → padrão do calendário (`global`) →
 * bloco (`blocks[id]`) → elemento (título/conteúdo/linhas/colunas). Só o que
 * foi configurado gera regra; o resto continua sendo o modelo.
 *
 * Os blocos são REGISTRADOS (`LAYOUT_BLOCKS`): novo bloco do documento entra
 * por registro com seus seletores e passa a usar todo o editor.
 */
import type { CalendarLogo } from "./calendar-logos";
import type { CalendarDocumentConfig, CalendarTextRole } from "./calendar-types";

export type LayoutAlign = "left" | "center" | "right" | "justify";
export type LayoutTransform = "none" | "uppercase" | "lowercase" | "capitalize";
export type LayoutSelfAlign = "start" | "center" | "end" | "stretch";

export type LayoutText = {
  family?: string | undefined;
  sizePt?: number | undefined;
  weight?: 400 | 700 | undefined;
  italic?: boolean | undefined;
  underline?: boolean | undefined;
  color?: string | undefined;
  /** Multiplicador (ex.: 1,2). */
  lineHeight?: number | undefined;
  letterSpacingPt?: number | undefined;
  align?: LayoutAlign | undefined;
  transform?: LayoutTransform | undefined;
};

export type LayoutRows = {
  /** Distância entre uma linha e a seguinte. */
  gapPt?: number | undefined;
  /** Altura da própria linha. */
  heightPt?: number | undefined;
  padTopPt?: number | undefined;
  padBottomPt?: number | undefined;
  padLeftPt?: number | undefined;
  padRightPt?: number | undefined;
  /** Distância entre as colunas internas (ex.: data ↔ descrição, marcador ↔ texto). */
  columnGapPt?: number | undefined;
  /** Largura de cada coluna registrada do bloco, em pt. */
  columnsPt?: Record<string, number | undefined> | undefined;
};

export type LayoutBox = {
  marginTopPt?: number | undefined;
  marginBottomPt?: number | undefined;
  marginLeftPt?: number | undefined;
  marginRightPt?: number | undefined;
  paddingPt?: number | undefined;
  widthPt?: number | undefined;
  minWidthPt?: number | undefined;
  maxWidthPt?: number | undefined;
  heightPt?: number | undefined;
  alignH?: LayoutSelfAlign | undefined;
  alignV?: LayoutSelfAlign | undefined;
};

export type BlockLayout = {
  title?: LayoutText | undefined;
  content?: LayoutText | undefined;
  rows?: LayoutRows | undefined;
  box?: LayoutBox | undefined;
};

export type LayoutLayer = {
  global?:
    | {
        text?: LayoutText | undefined;
        rows?: Pick<LayoutRows, "gapPt" | "heightPt"> | undefined;
        /** Margens da folha A4, em mm. */
        pageMarginMm?: { top?: number; right?: number; bottom?: number; left?: number } | undefined;
        /** Distância entre a grade e os blocos do rodapé. */
        footerTopPt?: number | undefined;
        /** Distância entre as colunas do rodapé. */
        footerGapPt?: number | undefined;
        /** Largura das três colunas do rodapé, em pt (ausente = automático do modelo). */
        footerColumnsPt?: [number | undefined, number | undefined, number | undefined] | undefined;
        footerAlignV?: LayoutSelfAlign | undefined;
      }
    | undefined;
  blocks?: Record<string, BlockLayout | undefined> | undefined;
};

/**
 * Camada geral (tela e impressão) + sobrescritas opcionais do contexto de
 * impressão/A4. Com `print.separate` desligado, A4 herda a camada geral; com
 * ele ligado, só os valores presentes em `print` sobrescrevem — nada é copiado.
 */
export type DocumentLayout = LayoutLayer & {
  /** Logos/imagens do documento (lista aberta, ordenada); ausente = composição do modelo. */
  logos?: CalendarLogo[] | undefined;
  print?:
    | (LayoutLayer & {
        separate?: boolean | undefined;
        /** Delta de impressão por logo (identificador da logo). */
        logos?: Record<string, Partial<CalendarLogo> | undefined> | undefined;
      })
    | undefined;
};

export type LayoutColumn = { id: string; label: string };

export type LayoutBlockDefinition = {
  id: string;
  label: string;
  /** Grupo de apresentação no editor. */
  group: "Cabeçalho" | "Grade" | "Rodapé" | "Assinaturas";
  root: string;
  title?: string[];
  content: string[];
  row?: string;
  columns?: LayoutColumn[];
  /** Papel da formatação antiga (`document.typography`) lido como herança. */
  legacy?: { role: CalendarTextRole; target: "content" | "title" }[];
  box?: boolean;
};

const B = (id: string) => `[data-cd-bloco="${id}"]`;

/** Registro de blocos do documento. Seletores espelham as classes do modelo. */
export const LAYOUT_BLOCKS: LayoutBlockDefinition[] = [
  {
    id: "cabecalho",
    label: "Linhas institucionais",
    group: "Cabeçalho",
    root: ".cd-titulos",
    content: [".cd-linha1", ".cd-linha2", ".cd-linha3"],
    legacy: [{ role: "cabecalho", target: "content" }],
  },
  {
    id: "titulo",
    label: "Título do calendário",
    group: "Cabeçalho",
    root: ".cd-linha4",
    content: [".cd-linha4"],
    legacy: [{ role: "titulo", target: "content" }],
    box: true,
  },
  {
    id: "grade",
    label: "Grade (cabeçalho, meses, dias e totais)",
    group: "Grade",
    root: ".cd-grade",
    title: [".cd-grade thead th"],
    content: [".cd-grade td.cd-mes", ".cd-grade td.cd-dia", ".cd-grade td.cd-ferias", ".cd-grade td.cd-total", ".cd-grade tr.cd-faixa td"],
    row: ".cd-grade tbody td",
    legacy: [
      { role: "gradeCabecalho", target: "title" },
      { role: "dias", target: "content" },
    ],
  },
  {
    id: "legenda",
    label: "Legenda",
    group: "Rodapé",
    root: B("legenda"),
    title: [`${B("legenda")} .cd-titulo-bloco`],
    content: [`${B("legenda")} .cd-legenda-linha > :last-child`],
    row: `${B("legenda")} .cd-legenda-linha`,
    columns: [{ id: "marcador", label: "Marcador" }],
    legacy: [{ role: "legenda", target: "content" }],
    box: true,
  },
  {
    id: "feriados",
    label: "Feriados",
    group: "Rodapé",
    root: B("feriados"),
    title: [`${B("feriados")} .cd-titulo-bloco`],
    content: [`${B("feriados")} .cd-feriado-linha`, `${B("feriados")} .cd-feriado-nome`],
    row: `${B("feriados")} .cd-feriado-linha`,
    columns: [{ id: "data", label: "Data" }],
    legacy: [{ role: "feriados", target: "content" }],
    box: true,
  },
  {
    id: "periodos",
    label: "Períodos letivos",
    group: "Rodapé",
    root: B("periodos"),
    title: [`${B("periodos")} .cd-bloco`],
    content: [`${B("periodos")} .cd-periodo-linha`],
    row: `${B("periodos")} .cd-periodo-linha`,
    columns: [
      { id: "nome", label: "Período" },
      { id: "sep", label: "Separadores" },
      { id: "intervalo", label: "Intervalo" },
      { id: "dias", label: "Dias" },
    ],
    legacy: [{ role: "periodos", target: "content" }],
    box: true,
  },
  {
    id: "total",
    label: "Total de dias letivos",
    group: "Rodapé",
    root: B("total"),
    content: [`${B("total")} .cd-periodo-linha`],
    row: `${B("total")} .cd-periodo-linha`,
    columns: [
      { id: "sep", label: "Separadores" },
      { id: "dias", label: "Dias" },
    ],
    legacy: [{ role: "periodos", target: "content" }],
    box: true,
  },
  {
    id: "conselhos",
    label: "Conselhos de Classe",
    group: "Rodapé",
    root: B("conselhos"),
    content: [`${B("conselhos")} .cd-conselho-linha`, `${B("conselhos")} .cd-conselho-linha b`],
    row: `${B("conselhos")} .cd-conselho-linha`,
    columns: [
      { id: "data", label: "Data" },
      { id: "sep", label: "Separador" },
    ],
    legacy: [{ role: "conselhos", target: "content" }],
    box: true,
  },
  {
    id: "informacoes",
    label: "Informações adicionais",
    group: "Rodapé",
    root: B("informacoes"),
    content: [`${B("informacoes")} .cd-info-linha`, `${B("informacoes")} .cd-info-linha span`],
    row: `${B("informacoes")} .cd-info-linha`,
    legacy: [{ role: "informacoes", target: "content" }],
    box: true,
  },
  {
    id: "assinaturas",
    label: "Assinaturas",
    group: "Assinaturas",
    root: ".cd-assinaturas",
    content: [".cd-assinatura-rotulo"],
    legacy: [{ role: "assinaturas", target: "content" }],
    box: true,
  },
];

export const layoutBlock = (id: string) => LAYOUT_BLOCKS.find((b) => b.id === id);

/** Limites de segurança; valor fora do limite é apontado, nunca ajustado. */
export const LAYOUT_LIMITS = {
  sizePt: { min: 4, max: 40 },
  lineHeight: { min: 0.6, max: 3 },
  letterSpacingPt: { min: -2, max: 10 },
  gapPt: { min: 0, max: 30 },
  heightPt: { min: 4, max: 60 },
  padPt: { min: 0, max: 30 },
  columnPt: { min: 0, max: 300 },
  marginPt: { min: -30, max: 80 },
  widthPt: { min: 10, max: 900 },
  pageMarginMm: { min: 0, max: 30 },
} as const;

export type LayoutLimitKey = keyof typeof LAYOUT_LIMITS;

const inLimit = (v: number | undefined, k: LayoutLimitKey): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= LAYOUT_LIMITS[k].min && v <= LAYOUT_LIMITS[k].max;

export type LayoutIssue = { path: string; message: string };

const COLOR = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

/** Aponta valores fora dos limites (o CSS não os aplica). */
export function validateLayout(layout: DocumentLayout | undefined): LayoutIssue[] {
  const out = validateLayer(layout, "");
  if (layout?.print) out.push(...validateLayer(layout.print, "print."));
  return out;
}

function validateLayer(layout: LayoutLayer | undefined, pre: string): LayoutIssue[] {
  const out: LayoutIssue[] = [];
  const num = (path: string, v: number | undefined, k: LayoutLimitKey) => {
    if (v !== undefined && !inLimit(v, k))
      out.push({ path: pre + path, message: `Valor ${v} fora do limite (${LAYOUT_LIMITS[k].min} a ${LAYOUT_LIMITS[k].max}).` });
  };
  const text = (p: string, t: LayoutText | undefined) => {
    if (!t) return;
    num(`${p}.sizePt`, t.sizePt, "sizePt");
    num(`${p}.lineHeight`, t.lineHeight, "lineHeight");
    num(`${p}.letterSpacingPt`, t.letterSpacingPt, "letterSpacingPt");
    if (t.color !== undefined && !COLOR.test(t.color)) out.push({ path: `${pre}${p}.color`, message: `Cor inválida: ${t.color}` });
  };
  const rows = (p: string, r: LayoutRows | undefined) => {
    if (!r) return;
    num(`${p}.gapPt`, r.gapPt, "gapPt");
    num(`${p}.heightPt`, r.heightPt, "heightPt");
    for (const k of ["padTopPt", "padBottomPt", "padLeftPt", "padRightPt", "columnGapPt"] as const) num(`${p}.${k}`, r[k], "padPt");
    for (const [c, v] of Object.entries(r.columnsPt ?? {})) num(`${p}.columnsPt.${c}`, v, "columnPt");
  };
  const g = layout?.global;
  text("global.text", g?.text);
  rows("global.rows", g?.rows);
  for (const [k, v] of Object.entries(g?.pageMarginMm ?? {})) num(`global.pageMarginMm.${k}`, v, "pageMarginMm");
  num("global.footerTopPt", g?.footerTopPt, "marginPt");
  num("global.footerGapPt", g?.footerGapPt, "gapPt");
  (g?.footerColumnsPt ?? []).forEach((v, i) => num(`global.footerColumnsPt.${i}`, v, "widthPt"));
  for (const [id, b] of Object.entries(layout?.blocks ?? {})) {
    if (!b) continue;
    text(`blocks.${id}.title`, b.title);
    text(`blocks.${id}.content`, b.content);
    rows(`blocks.${id}.rows`, b.rows);
    const x = b.box;
    if (x) {
      for (const k of ["marginTopPt", "marginBottomPt", "marginLeftPt", "marginRightPt"] as const) num(`blocks.${id}.box.${k}`, x[k], "marginPt");
      num(`blocks.${id}.box.paddingPt`, x.paddingPt, "padPt");
      for (const k of ["widthPt", "minWidthPt", "maxWidthPt", "heightPt"] as const) num(`blocks.${id}.box.${k}`, x[k], "widthPt");
    }
  }
  return out;
}

// ------------------------------------------------------------- herança

const defined = <T extends object>(o: T | undefined): Partial<T> =>
  Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;

/** Formatação antiga (`document.typography`) lida como camada de herança. */
function legacyText(doc: CalendarDocumentConfig, def: LayoutBlockDefinition, target: "content" | "title"): LayoutText {
  const roles = (def.legacy ?? []).filter((l) => l.target === target);
  const out: LayoutText = {};
  for (const { role } of roles) {
    const s = doc.typography?.[role];
    if (!s) continue;
    if (s.family) out.family = s.family;
    if (s.sizePt) out.sizePt = s.sizePt;
    if (s.bold !== undefined) out.weight = s.bold ? 700 : 400;
  }
  return out;
}

/**
 * Adapta a configuração gravada ao formato atual: a formatação antiga passa a
 * ser o conteúdo inicial dos blocos. Usado ao abrir o editor; ao salvar, a
 * formatação antiga deixa de existir (uma única fonte).
 */
export function adoptLegacyTypography(doc: CalendarDocumentConfig): DocumentLayout {
  const base: DocumentLayout = structuredCloneSafe(doc.layout ?? {});
  if (!doc.typography) return base;
  const blocks = { ...(base.blocks ?? {}) };
  for (const def of LAYOUT_BLOCKS) {
    for (const target of ["content", "title"] as const) {
      const legacy = legacyText(doc, def, target);
      if (Object.keys(legacy).length === 0) continue;
      const cur = blocks[def.id] ?? {};
      blocks[def.id] = { ...cur, [target]: { ...legacy, ...defined(cur[target]) } };
    }
  }
  return { ...base, blocks };
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export type ResolvedBlock = { title: LayoutText; content: LayoutText; rows: LayoutRows; box: LayoutBox };

/** padrão do calendário → formatação antiga → bloco → elemento. */
export function resolveBlock(doc: CalendarDocumentConfig, id: string): ResolvedBlock {
  const def = layoutBlock(id);
  const g = doc.layout?.global;
  const b = doc.layout?.blocks?.[id];
  const gt = defined(g?.text);
  const inheritedTitle: LayoutText = defined({ family: gt.family, color: gt.color, transform: gt.transform });
  return {
    content: { ...gt, ...(def ? legacyText(doc, def, "content") : {}), ...defined(b?.content) },
    title: { ...inheritedTitle, ...(def ? legacyText(doc, def, "title") : {}), ...defined(b?.title) },
    rows: { ...defined(g?.rows), ...defined(b?.rows) },
    box: { ...defined(b?.box) },
  };
}

/** Camada geral + sobrescritas de impressão (só as definidas). */
export function printLayout(layout: DocumentLayout | undefined): LayoutLayer {
  const { print, ...base } = layout ?? {};
  if (!print?.separate) return base;
  return deepMerge(base, { global: print.global, blocks: print.blocks }) as LayoutLayer;
}

function deepMerge(a: unknown, b: unknown): unknown {
  if (b === undefined || b === null || b === "") return a;
  if (Array.isArray(b)) {
    const aa = Array.isArray(a) ? a : [];
    return b.map((x, i) => (x === undefined || x === null ? aa[i] : x));
  }
  if (typeof b === "object") {
    const ao = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
    const out: Record<string, unknown> = { ...ao };
    for (const [k, v] of Object.entries(b as Record<string, unknown>)) out[k] = deepMerge(ao[k], v);
    return out;
  }
  return b;
}

/** Existe sobrescrita efetiva de impressão? */
export const hasPrintOverrides = (layout: DocumentLayout | undefined) =>
  !!layout?.print?.separate && !!cleanLayout({ global: layout.print.global, blocks: layout.print.blocks });

// ------------------------------------------------------------- presets

export const SPACING_PRESETS = {
  compacto: { label: "Compacto", rows: { gapPt: 0, heightPt: 9 } },
  padrao: { label: "Padrão", rows: { gapPt: undefined, heightPt: undefined } },
  confortavel: { label: "Confortável", rows: { gapPt: 2, heightPt: 12.5 } },
} as const;
export type SpacingPreset = keyof typeof SPACING_PRESETS;

/** Preset só PREENCHE os mesmos campos do modo personalizado. */
export function applySpacingPreset<R extends Pick<LayoutRows, "gapPt" | "heightPt">>(rows: R | undefined, preset: SpacingPreset): R {
  return defined({ ...(rows ?? {}), ...SPACING_PRESETS[preset].rows }) as R;
}

/** Qual preset os valores atuais correspondem (ou "personalizado"). */
export function presetOf(rows: Pick<LayoutRows, "gapPt" | "heightPt"> | undefined): SpacingPreset | "personalizado" {
  for (const [k, p] of Object.entries(SPACING_PRESETS) as [SpacingPreset, (typeof SPACING_PRESETS)[SpacingPreset]][])
    if ((rows?.gapPt ?? undefined) === p.rows.gapPt && (rows?.heightPt ?? undefined) === p.rows.heightPt) return k;
  return "personalizado";
}

// ------------------------------------------------------------- CSS

const pt = (v: number) => `${Number(v.toFixed(2))}pt`;
const safeFamily = (f: string) => f.replace(/[;{}<>]/g, "");

function textDecl(t: LayoutText): string {
  const d: string[] = [];
  if (t.family) d.push(`font-family:${safeFamily(t.family)}`);
  if (inLimit(t.sizePt, "sizePt")) d.push(`font-size:${pt(t.sizePt)}`);
  if (t.weight) d.push(`font-weight:${t.weight}`);
  if (t.italic !== undefined) d.push(`font-style:${t.italic ? "italic" : "normal"}`);
  if (t.underline !== undefined) d.push(`text-decoration:${t.underline ? "underline" : "none"}`);
  if (t.color && COLOR.test(t.color)) d.push(`color:${t.color}`);
  if (inLimit(t.lineHeight, "lineHeight")) d.push(`line-height:${t.lineHeight}`);
  if (inLimit(t.letterSpacingPt, "letterSpacingPt")) d.push(`letter-spacing:${pt(t.letterSpacingPt)}`);
  if (t.align) d.push(`text-align:${t.align}`);
  if (t.transform) d.push(`text-transform:${t.transform}`);
  return d.join(";");
}

const SELF: Record<LayoutSelfAlign, string> = { start: "start", center: "center", end: "end", stretch: "stretch" };

/**
 * CSS escopado a UM documento, gerado apenas do que foi configurado. Consumido
 * pelo documento em tela, pela folha A4 e pela impressão/PDF.
 */
export function layoutCss(calendarId: string, doc: CalendarDocumentConfig): string {
  const scope = `.cd-folha[data-calendar-id="${calendarId.replace(/["\\]/g, "")}"]`;
  const { print, ...base } = doc.layout ?? {};
  const out = [layerCss(scope, { ...doc, layout: base })];
  // Contexto de impressão/A4: mesma geração, escopo mais específico, só se separado.
  if (print?.separate) out.push(layerCss(`.cd-a4 ${scope}`, { ...doc, layout: printLayout(doc.layout) }, scope));
  return out.filter(Boolean).join("\n");
}

function layerCss(scope: string, doc: CalendarDocumentConfig, pageScope = scope): string {
  const rules: string[] = [];
  const rule = (sels: string[], decl: string) => {
    if (decl && sels.length) rules.push(`${sels.map((s) => `${scope} ${s}`).join(",")}{${decl}}`);
  };
  for (const def of LAYOUT_BLOCKS) {
    const r = resolveBlock(doc, def.id);
    rule(def.content, textDecl(r.content));
    if (def.title) rule(def.title, textDecl(r.title));
    if (def.row) {
      const d: string[] = [];
      // min-height: a linha nunca fica menor que o texto (altura fixa sobrepunha linhas).
      if (inLimit(r.rows.heightPt, "heightPt")) d.push(`height:auto`, `min-height:${pt(r.rows.heightPt)}`, "box-sizing:content-box");
      const pads = [
        ["padding-top", r.rows.padTopPt],
        ["padding-bottom", r.rows.padBottomPt],
        ["padding-left", r.rows.padLeftPt],
        ["padding-right", r.rows.padRightPt],
      ] as const;
      for (const [p, v] of pads) if (inLimit(v, "padPt")) d.push(`${p}:${pt(v)}`);
      if (inLimit(r.rows.columnGapPt, "padPt")) d.push(`column-gap:${pt(r.rows.columnGapPt)}`);
      for (const c of def.columns ?? []) {
        const v = r.rows.columnsPt?.[c.id];
        if (inLimit(v, "columnPt")) d.push(`--cd-col-${c.id}:${pt(v)}`);
      }
      rule([def.row], d.join(";"));
      if (inLimit(r.rows.gapPt, "gapPt")) rule([`${def.row} + ${def.row.split(" ").pop()}`], `margin-top:${pt(r.rows.gapPt)}`);
    }
    if (def.box) {
      const x = r.box;
      const d: string[] = [];
      const m = [
        ["margin-top", x.marginTopPt],
        ["margin-bottom", x.marginBottomPt],
        ["margin-left", x.marginLeftPt],
        ["margin-right", x.marginRightPt],
      ] as const;
      for (const [p, v] of m) if (inLimit(v, "marginPt")) d.push(`${p}:${pt(v)}`);
      if (inLimit(x.paddingPt, "padPt")) d.push(`padding:${pt(x.paddingPt)}`);
      if (inLimit(x.widthPt, "widthPt")) d.push(`width:${pt(x.widthPt)}`);
      if (inLimit(x.minWidthPt, "widthPt")) d.push(`min-width:${pt(x.minWidthPt)}`);
      if (inLimit(x.maxWidthPt, "widthPt")) d.push(`max-width:${pt(x.maxWidthPt)}`);
      if (inLimit(x.heightPt, "widthPt")) d.push(`min-height:${pt(x.heightPt)}`);
      if (x.alignH) d.push(`justify-self:${SELF[x.alignH]}`);
      if (x.alignV) d.push(`align-self:${SELF[x.alignV]}`);
      rule([def.root], d.join(";"));
    }
  }
  const g = doc.layout?.global;
  if (g) {
    const f: string[] = [];
    if (inLimit(g.footerTopPt, "marginPt")) f.push(`margin-top:${pt(g.footerTopPt)}`);
    if (inLimit(g.footerGapPt, "gapPt")) f.push(`column-gap:${pt(g.footerGapPt)}`);
    if (g.footerColumnsPt?.some((v) => inLimit(v, "widthPt")))
      f.push(`grid-template-columns:${g.footerColumnsPt.map((v, i) => (inLimit(v, "widthPt") ? pt(v) : i === 2 ? "1fr" : "auto")).join(" ")}`);
    if (g.footerAlignV) f.push(`align-items:${SELF[g.footerAlignV]}`);
    rule([".cd-rodape"], f.join(";"));
    const pm = g.pageMarginMm;
    if (pm && Object.values(pm).some((v) => inLimit(v, "pageMarginMm"))) {
      const side = (v: number | undefined) => (inLimit(v, "pageMarginMm") ? `${v}mm` : "6mm");
      rules.push(`.cd-a4:has(> ${pageScope}){padding:${side(pm.top)} ${side(pm.right)} ${side(pm.bottom)} ${side(pm.left)}}`);
    }
  }
  return rules.join("\n");
}

/** Remove chaves vazias antes de gravar (aparência padrão = ausência). */
export function cleanLayout(layout: DocumentLayout | undefined): DocumentLayout | undefined {
  const prune = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.some((x) => x !== undefined && x !== null) ? v.map((x) => (x === undefined ? null : x)) : undefined;
    if (v && typeof v === "object") {
      const o = Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, prune(x)]).filter(([, x]) => x !== undefined && x !== ""),
      );
      return Object.keys(o).length ? o : undefined;
    }
    return v;
  };
  return prune(layout) as DocumentLayout | undefined;
}
