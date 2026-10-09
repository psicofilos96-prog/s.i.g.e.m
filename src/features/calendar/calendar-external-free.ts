/**
 * CAL.EXT.3 — Layout livre dos modelos externos 4 (Matriz com fundo fotográfico) e 5 (Quadro anual).
 * Só APARÊNCIA: posição/tamanho de cada bloco em mm sobre a área útil A4 paisagem, tipografia por bloco e
 * dimensionamento da tabela. Datas, tipos, efeitos e totais continuam vindo do calendário interno
 * (`PrintModel` → `ExternalViewModel`); nada aqui conta ou decide dia letivo.
 */
import { sanitizeLayers, type Layer } from "./calendar-external-layers";
export const SHEET_W = 285, SHEET_H = 197; // área útil A4 paisagem (mm), a mesma dos demais externos
export const FREE_BLOCKS = ["cabecalho", "matriz", "periodos", "legenda", "feriados", "conselhos", "assinaturas", "rodape"] as const;
export type FreeBlockId = (typeof FREE_BLOCKS)[number];
export const FREE_BLOCK_LABEL: Record<FreeBlockId, string> = {
  cabecalho: "Cabeçalho", matriz: "Tabela do calendário", periodos: "Períodos letivos", legenda: "Legenda",
  feriados: "Feriados", conselhos: "Conselhos de Classe", assinaturas: "Assinaturas", rodape: "Rodapé",
};
export type Align = "esquerda" | "centro" | "direita";
export type BlockStyle = { font: string | null; pt: number; titlePt: number; lh: number; padMm: number; bold: boolean; align: Align; fill: boolean; cols: number; orientation: "vertical" | "horizontal" | "lista";
  /** Personalização máxima (só aparência): espaçamento entre letras (em), cores, borda e cantos. */
  tracking: number; italic: boolean; color: string | null; bg: string | null; borderMm: number; borderColor: string | null; radiusMm: number };
export type BlockBox = { x: number; y: number; w: number; h: number; visible: boolean; locked: boolean; z: number; style: BlockStyle };
export type TableCfg = {
  mode: "ajustar" | "manual"; cellWmm: number; cellHmm: number; monthColMm: number; totalColMm: number;
  headPt: number; dayPt: number; monthPt: number; dividerMm: number; showDayNumbers: boolean; semesters: boolean;
};
/** Ajuste de imagem: foco (%), zoom (%) e opacidade (%). */
export type ImgAdjust = { fx: number; fy: number; zoom: number; opacity: number };
export type PhotoCfg = { top: string | null; bottom: string | null; topHmm: number; bottomHmm: number; veil: string; veilStrength: number; useDefaultTop: boolean;
  topAdj: ImgAdjust; bottomAdj: ImgAdjust; page: string | null; pageAdj: ImgAdjust };
/** Imagem avulsa (PNG com ou sem transparência) sobre a folha: não altera a estrutura nem os dados. */
export type Sticker = { id: string; src: string; x: number; y: number; w: number; h: number; rot: number; opacity: number; z: number; front: boolean; locked: boolean };
export const MAX_STICKERS = 12;
export type FreeLayout = { snap: boolean; stepMm: number; allowOverlap: boolean; blocks: Record<FreeBlockId, BlockBox>; table: TableCfg; photo: PhotoCfg; stickers: Sticker[];
  /** CAL.EXT.4 — camadas visuais independentes (fotos, logos, ondas, textos); ausência = []. */
  layers: Layer[] };

export const LIMITS = {
  pt: [3, 40], titlePt: [3, 30], lh: [0.8, 2.5], padMm: [0, 8], cols: [1, 4], stepMm: [0.5, 10],
  cellWmm: [3, 14], cellHmm: [3, 16], monthColMm: [8, 45], totalColMm: [0, 25], headPt: [3, 16], dayPt: [3, 16], monthPt: [3, 16], dividerMm: [0, 1],
  topHmm: [0, 110], bottomHmm: [0, 90], veilStrength: [0, 100],
  tracking: [-0.1, 0.5], borderMm: [0, 2], radiusMm: [0, 10], focus: [0, 100], zoom: [100, 400], opacity: [0, 100], rot: [-180, 180],
} as const;

const st = (o: Partial<BlockStyle> = {}): BlockStyle => ({ font: null, pt: 7, titlePt: 7.5, lh: 1.2, padMm: 1.5, bold: false, align: "esquerda", fill: true, cols: 1, orientation: "vertical", tracking: 0, italic: false, color: null, bg: null, borderMm: 0.2, borderColor: null, radiusMm: 1, ...o });
const ADJ: ImgAdjust = { fx: 50, fy: 50, zoom: 100, opacity: 100 };
const box = (x: number, y: number, w: number, h: number, z: number, s: Partial<BlockStyle> = {}): BlockBox => ({ x, y, w, h, visible: true, locked: false, z, style: st(s) });

/** Padrão "Quadro anual": Períodos na coluna direita (cartões empilhados, mesma altura da tabela); faixa inferior Legenda → Feriados → Conselhos → Assinaturas (≈27/27/26/20%). */
export function defaultFreeLayout(kind: "quadro" | "fotografico"): FreeLayout {
  const foto = kind === "fotografico";
  const top = foto ? 36 : 24, tableH = foto ? 108 : 126, rowY = top + tableH + 3, rowH = foto ? 38 : 35;
  const W = SHEET_W, gap = 2, rowW = W - 3 * gap;
  const lw = Math.round(rowW * 0.27), fw = Math.round(rowW * 0.27), cw = Math.round(rowW * 0.26), aw = rowW - lw - fw - cw;
  return {
    snap: true, stepMm: 1, allowOverlap: false,
    blocks: {
      cabecalho: box(0, 0, W, top - 2, 2, { pt: 9, titlePt: foto ? 26 : 22, align: "centro", fill: false, bold: true }),
      matriz: box(0, top, 226, tableH, 1, { fill: !foto }),
      periodos: box(228, top, W - 228, tableH, 1, { pt: 7, titlePt: 8, orientation: "vertical" }),
      legenda: box(0, rowY, lw, rowH, 1, { pt: 6.5, cols: 2 }),
      feriados: box(lw + gap, rowY, fw, rowH, 1, { pt: 6.5, cols: 2 }),
      conselhos: box(lw + fw + 2 * gap, rowY, cw, rowH, 1, { pt: 6.5, cols: 1 }),
      assinaturas: box(lw + fw + cw + 3 * gap, rowY, aw, rowH, 1, { pt: 6, cols: 1 }),
      rodape: box(0, rowY + rowH + 2, W, SHEET_H - (rowY + rowH + 2), 1, { pt: 6.5, align: "centro", fill: false }),
    },
    table: { mode: "ajustar", cellWmm: 6, cellHmm: 7, monthColMm: 18, totalColMm: 10, headPt: 6, dayPt: 6, monthPt: 6.5, dividerMm: 0.2, showDayNumbers: false, semesters: false },
    photo: { top: null, bottom: null, topHmm: foto ? 52 : 0, bottomHmm: foto ? 38 : 0, veil: "#FBF8F2", veilStrength: foto ? 90 : 0, useDefaultTop: foto,
      topAdj: ADJ, bottomAdj: ADJ, page: null, pageAdj: { ...ADJ, opacity: 35 } },
    stickers: [],
    layers: [],
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const num = (v: unknown, [lo, hi]: readonly [number, number], d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const HEX = /^#[0-9a-fA-F]{6}$/;
const IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const hex = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v : null);
export const adj = (v: unknown, d: ImgAdjust): ImgAdjust => { const a = isObj(v) ? v : {}; return { fx: num(a["fx"], LIMITS.focus, d.fx), fy: num(a["fy"], LIMITS.focus, d.fy), zoom: num(a["zoom"], LIMITS.zoom, d.zoom), opacity: num(a["opacity"], LIMITS.opacity, d.opacity) }; };
const img = (v: unknown, max: number) => (typeof v === "string" && IMG.test(v) && v.length <= max ? v : null);

/** Mantém o bloco dentro da área útil: nunca sai da folha (largura/altura mínima 4 mm). */
export function clampBox(b: Pick<BlockBox, "x" | "y" | "w" | "h">) {
  const w = Math.min(SHEET_W, Math.max(4, b.w)), h = Math.min(SHEET_H, Math.max(4, b.h));
  return { w, h, x: Math.min(SHEET_W - w, Math.max(0, b.x)), y: Math.min(SHEET_H - h, Math.max(0, b.y)) };
}
export const snapTo = (v: number, step: number, on: boolean) => (on ? Math.round(v / step) * step : Math.round(v * 10) / 10);

export function sanitizeFree(raw: unknown, d: FreeLayout, fonts: readonly string[], maxImg: number): FreeLayout {
  const r = isObj(raw) ? raw : {};
  const rb = isObj(r["blocks"]) ? r["blocks"] : {};
  const blocks = Object.fromEntries(FREE_BLOCKS.map((id) => {
    const db = d.blocks[id]; const b = isObj(rb[id]) ? rb[id] : {}; const s = isObj(b["style"]) ? b["style"] : {};
    const pos = clampBox({ x: num(b["x"], [0, SHEET_W], db.x), y: num(b["y"], [0, SHEET_H], db.y), w: num(b["w"], [4, SHEET_W], db.w), h: num(b["h"], [4, SHEET_H], db.h) });
    const style: BlockStyle = {
      font: typeof s["font"] === "string" && fonts.includes(s["font"]) ? s["font"] : null,
      pt: num(s["pt"], LIMITS.pt, db.style.pt), titlePt: num(s["titlePt"], LIMITS.titlePt, db.style.titlePt), lh: num(s["lh"], LIMITS.lh, db.style.lh),
      padMm: num(s["padMm"], LIMITS.padMm, db.style.padMm), bold: bool(s["bold"], db.style.bold),
      align: s["align"] === "centro" || s["align"] === "direita" || s["align"] === "esquerda" ? s["align"] : db.style.align,
      fill: bool(s["fill"], db.style.fill), cols: Math.round(num(s["cols"], LIMITS.cols, db.style.cols)),
      orientation: s["orientation"] === "horizontal" || s["orientation"] === "vertical" || s["orientation"] === "lista" ? s["orientation"] : db.style.orientation,
      tracking: num(s["tracking"], LIMITS.tracking, db.style.tracking), italic: bool(s["italic"], db.style.italic),
      color: hex(s["color"]), bg: hex(s["bg"]), borderMm: num(s["borderMm"], LIMITS.borderMm, db.style.borderMm),
      borderColor: hex(s["borderColor"]), radiusMm: num(s["radiusMm"], LIMITS.radiusMm, db.style.radiusMm),
    };
    return [id, { ...pos, visible: bool(b["visible"], db.visible), locked: bool(b["locked"], db.locked), z: Math.round(num(b["z"], [0, 50], db.z)), style }];
  })) as Record<FreeBlockId, BlockBox>;
  const t = isObj(r["table"]) ? r["table"] : {}; const dt = d.table;
  const p = isObj(r["photo"]) ? r["photo"] : {}; const dp = d.photo;
  return {
    snap: bool(r["snap"], d.snap), stepMm: num(r["stepMm"], LIMITS.stepMm, d.stepMm), allowOverlap: bool(r["allowOverlap"], d.allowOverlap), blocks,
    table: {
      mode: t["mode"] === "manual" ? "manual" : t["mode"] === "ajustar" ? "ajustar" : dt.mode,
      cellWmm: num(t["cellWmm"], LIMITS.cellWmm, dt.cellWmm), cellHmm: num(t["cellHmm"], LIMITS.cellHmm, dt.cellHmm),
      monthColMm: num(t["monthColMm"], LIMITS.monthColMm, dt.monthColMm), totalColMm: num(t["totalColMm"], LIMITS.totalColMm, dt.totalColMm),
      headPt: num(t["headPt"], LIMITS.headPt, dt.headPt), dayPt: num(t["dayPt"], LIMITS.dayPt, dt.dayPt), monthPt: num(t["monthPt"], LIMITS.monthPt, dt.monthPt),
      dividerMm: num(t["dividerMm"], LIMITS.dividerMm, dt.dividerMm), showDayNumbers: bool(t["showDayNumbers"], dt.showDayNumbers), semesters: bool(t["semesters"], dt.semesters),
    },
    photo: {
      top: img(p["top"], maxImg), bottom: img(p["bottom"], maxImg), topHmm: num(p["topHmm"], LIMITS.topHmm, dp.topHmm), bottomHmm: num(p["bottomHmm"], LIMITS.bottomHmm, dp.bottomHmm),
      veil: typeof p["veil"] === "string" && HEX.test(p["veil"]) ? p["veil"] : dp.veil, veilStrength: num(p["veilStrength"], LIMITS.veilStrength, dp.veilStrength),
      useDefaultTop: bool(p["useDefaultTop"], dp.useDefaultTop),
      topAdj: adj(p["topAdj"], dp.topAdj), bottomAdj: adj(p["bottomAdj"], dp.bottomAdj), page: img(p["page"], maxImg), pageAdj: adj(p["pageAdj"], dp.pageAdj),
    },
    stickers: (Array.isArray(r["stickers"]) ? r["stickers"] : []).flatMap((s, i): Sticker[] => {
      if (!isObj(s)) return []; const src = img(s["src"], maxImg); if (!src) return [];
      const pos = clampBox({ x: num(s["x"], [0, SHEET_W], 10), y: num(s["y"], [0, SHEET_H], 10), w: num(s["w"], [4, SHEET_W], 20), h: num(s["h"], [4, SHEET_H], 20) });
      return [{ id: typeof s["id"] === "string" && /^[a-z0-9-]{1,40}$/.test(s["id"]) ? s["id"] : `img-${i}`, src, ...pos,
        rot: num(s["rot"], LIMITS.rot, 0), opacity: num(s["opacity"], LIMITS.opacity, 100), z: Math.round(num(s["z"], [0, 50], 5)), front: bool(s["front"], true), locked: bool(s["locked"], false) }];
    }).slice(0, MAX_STICKERS),
    layers: sanitizeLayers(r["layers"], fonts, maxImg),
  };
}

/** Avisos do layout (nunca corrige sozinho): sobreposição sem permissão e tabela manual maior que o bloco. */
export function layoutIssues(f: FreeLayout): { overlaps: [FreeBlockId, FreeBlockId][]; tableOverflow: boolean } {
  const vis = FREE_BLOCKS.filter((id) => f.blocks[id].visible);
  const overlaps: [FreeBlockId, FreeBlockId][] = [];
  if (!f.allowOverlap) for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = f.blocks[vis[i]!], b = f.blocks[vis[j]!];
    if (a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01) overlaps.push([vis[i]!, vis[j]!]);
  }
  const m = f.blocks.matriz, t = f.table;
  const tableOverflow = m.visible && t.mode === "manual" && (t.monthColMm + 31 * t.cellWmm + t.totalColMm > m.w + 0.01 || ((t.semesters ? 16 : 13) * t.cellHmm) > m.h + 0.01);
  return { overlaps, tableOverflow };
}

/** Move/redimensiona um bloco (não mexe em bloco travado), com encaixe na grade e limite da folha. */
export function moveFreeBlock(f: FreeLayout, id: FreeBlockId, patch: Partial<Pick<BlockBox, "x" | "y" | "w" | "h">>): FreeLayout {
  const b = f.blocks[id]; if (b.locked) return f;
  const next = { x: patch.x ?? b.x, y: patch.y ?? b.y, w: patch.w ?? b.w, h: patch.h ?? b.h };
  const snapped = { x: snapTo(next.x, f.stepMm, f.snap), y: snapTo(next.y, f.stepMm, f.snap), w: snapTo(next.w, f.stepMm, f.snap), h: snapTo(next.h, f.stepMm, f.snap) };
  return { ...f, blocks: { ...f.blocks, [id]: { ...b, ...clampBox(snapped) } } };
}

/** Pilha de desfazer/refazer do editor (limitada). */
export type History<T> = { past: T[]; present: T; future: T[] };
export const historyPush = <T,>(h: History<T>, next: T, limit = 60): History<T> => (next === h.present ? h : { past: [...h.past, h.present].slice(-limit), present: next, future: [] });
export const historyUndo = <T,>(h: History<T>): History<T> => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1]!, future: [h.present, ...h.future] } : h);
export const historyRedo = <T,>(h: History<T>): History<T> => (h.future.length ? { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) } : h);

/** Move/redimensiona uma imagem avulsa (não mexe na travada), dentro da folha. */
export function moveSticker(f: FreeLayout, id: string, patch: Partial<Pick<Sticker, "x" | "y" | "w" | "h">>): FreeLayout {
  return { ...f, stickers: f.stickers.map((s) => {
    if (s.id !== id || s.locked) return s;
    const n = { x: patch.x ?? s.x, y: patch.y ?? s.y, w: patch.w ?? s.w, h: patch.h ?? s.h };
    return { ...s, ...clampBox({ x: snapTo(n.x, f.stepMm, f.snap), y: snapTo(n.y, f.stepMm, f.snap), w: snapTo(n.w, f.stepMm, f.snap), h: snapTo(n.h, f.stepMm, f.snap) }) };
  }) };
}
/** CSS de imagem ajustada: foco, zoom e opacidade (só aparência). */
export const adjustedBg = (src: string, a: ImgAdjust) => ({ backgroundImage: `url(${src})`, backgroundPosition: `${a.fx}% ${a.fy}%`, backgroundSize: a.zoom === 100 ? "cover" : `${a.zoom}%`, backgroundRepeat: "no-repeat", opacity: a.opacity / 100 });
