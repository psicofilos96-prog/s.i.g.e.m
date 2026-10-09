/**
 * CAL.EXT.4 — Camadas visuais independentes do calendário externo (fotos, logos, ondas vetoriais, textos).
 * Só APARÊNCIA, medidas em mm sobre a folha. Nenhuma camada carrega data, tipo de dia, total ou período:
 * esses vêm sempre do calendário interno. Textos aceitam só os marcadores {ano}, {titulo} e {subtitulo},
 * resolvidos a partir do próprio calendário — nunca números digitados.
 */
import { SHEET_H, SHEET_W, clampBox, snapTo } from "./calendar-external-free";

export type LayerBase = { id: string; name: string; x: number; y: number; w: number; h: number; z: number; visible: boolean; locked: boolean; opacity: number; rot: number };
export type ImageLayer = LayerBase & { kind: "imagem"; src: string; fit: "cobrir" | "conter"; fx: number; fy: number; zoom: number;
  brightness: number; contrast: number; saturate: number; fade: "nenhum" | "baixo" | "cima" | "ambos"; fadeMm: number };
export type WaveLayer = LayerBase & { kind: "onda"; side: "baixo" | "cima"; amp: number; crest: number; tilt: number; fill: string; fill2: string | null; stroke: string | null; strokeMm: number };
export type TextLayer = LayerBase & { kind: "texto"; text: string; font: string | null; pt: number; bold: boolean; italic: boolean; color: string; accent: string; tracking: number; align: "esquerda" | "centro" | "direita"; shadow: boolean; lh: number };
export type Layer = ImageLayer | WaveLayer | TextLayer;
export const MAX_LAYERS = 40;
export const LAYER_KIND_LABEL: Record<Layer["kind"], string> = { imagem: "Imagem", onda: "Onda", texto: "Texto" };

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
const hexOrNull = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v : null);
const pick = <T,>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const DATA_IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
/** Imagens aceitas: arquivo do próprio sistema (CDN do projeto) ou imagem enviada e reduzida (data URL). */
const ASSET_URL = /^\/__l5e\/assets-v1\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/;
export const safeLayerSrc = (v: unknown, max: number) => (typeof v === "string" && (ASSET_URL.test(v) || (DATA_IMG.test(v) && v.length <= max)) ? v : null);

export function sanitizeLayers(raw: unknown, fonts: readonly string[], maxImg: number): Layer[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((r, i): Layer[] => {
    if (!isObj(r)) return [];
    let id = typeof r["id"] === "string" && /^[a-z0-9-]{1,40}$/.test(r["id"]) ? r["id"] : `camada-${i}`;
    if (seen.has(id)) id = `${id}-${i}`; seen.add(id);
    const pos = clampBox({ x: num(r["x"], -SHEET_W, SHEET_W, 0), y: num(r["y"], -SHEET_H, SHEET_H, 0), w: num(r["w"], 4, SHEET_W, 40), h: num(r["h"], 4, SHEET_H, 20) });
    const base: LayerBase = { id, name: typeof r["name"] === "string" ? r["name"].slice(0, 60) : `Camada ${i + 1}`, ...pos,
      z: Math.round(num(r["z"], 0, 60, 1)), visible: bool(r["visible"], true), locked: bool(r["locked"], false), opacity: num(r["opacity"], 0, 100, 100), rot: num(r["rot"], -180, 180, 0) };
    if (r["kind"] === "imagem") {
      const src = safeLayerSrc(r["src"], maxImg); if (!src) return [];
      return [{ ...base, kind: "imagem", src, fit: pick(r["fit"], ["cobrir", "conter"] as const, "cobrir"), fx: num(r["fx"], 0, 100, 50), fy: num(r["fy"], 0, 100, 50),
        zoom: num(r["zoom"], 100, 400, 100), brightness: num(r["brightness"], 30, 170, 100), contrast: num(r["contrast"], 30, 170, 100), saturate: num(r["saturate"], 0, 200, 100),
        fade: pick(r["fade"], ["nenhum", "baixo", "cima", "ambos"] as const, "nenhum"), fadeMm: num(r["fadeMm"], 0, 80, 12) }];
    }
    if (r["kind"] === "onda") return [{ ...base, kind: "onda", side: pick(r["side"], ["baixo", "cima"] as const, "baixo"), amp: num(r["amp"], 0, 100, 40),
      crest: num(r["crest"], 0, 100, 50), tilt: num(r["tilt"], -100, 100, 0), fill: hex(r["fill"], "#0A2F63"), fill2: hexOrNull(r["fill2"]), stroke: hexOrNull(r["stroke"]), strokeMm: num(r["strokeMm"], 0, 3, 0.6) }];
    if (r["kind"] === "texto") return [{ ...base, kind: "texto", text: typeof r["text"] === "string" ? r["text"].slice(0, 200) : "",
      font: typeof r["font"] === "string" && fonts.includes(r["font"]) ? r["font"] : null, pt: num(r["pt"], 3, 90, 12), bold: bool(r["bold"], false), italic: bool(r["italic"], false),
      color: hex(r["color"], "#FFFFFF"), accent: hex(r["accent"], "#F2B33D"), tracking: num(r["tracking"], -0.1, 1, 0), align: pick(r["align"], ["esquerda", "centro", "direita"] as const, "centro"),
      shadow: bool(r["shadow"], false), lh: num(r["lh"], 0.7, 2.5, 1) }];
    return [];
  }).slice(0, MAX_LAYERS);
}

/** Caminho SVG da onda num retângulo w×h (unidades = mm). `side` indica de que lado fica o preenchimento. */
export function wavePath(l: Pick<WaveLayer, "w" | "h" | "amp" | "crest" | "tilt" | "side">): string {
  const { w, h } = l; const a = (l.amp / 100) * h; const mid = h / 2; const t = (l.tilt / 100) * (h / 2);
  const yL = mid + t, yR = mid - t; const cx = (l.crest / 100) * w;
  const r = (n: number) => Math.round(n * 100) / 100;
  const curve = `M0 ${r(yL)} C ${r(cx * 0.5)} ${r(yL - a)}, ${r(cx)} ${r(mid - a)}, ${r(cx)} ${r(mid - a / 2)} S ${r(cx + (w - cx) * 0.6)} ${r(yR + a)}, ${r(w)} ${r(yR)}`;
  return l.side === "baixo" ? `${curve} L ${r(w)} ${r(h)} L 0 ${r(h)} Z` : `${curve} L ${r(w)} 0 L 0 0 Z`;
}

/** Texto da camada: só marcadores do calendário; `{ano}` vira trecho destacado. */
export function resolveLayerText(text: string, ctx: { year: number | null; title: string | null; subtitle: string | null }): { t: string; accent: boolean }[] {
  const parts: { t: string; accent: boolean }[] = [];
  const src = text.replace(/\{titulo\}/g, ctx.title ?? "").replace(/\{subtitulo\}/g, ctx.subtitle ?? "");
  src.split(/(\{ano\})/).forEach((p) => { if (p === "{ano}") { if (ctx.year !== null) parts.push({ t: String(ctx.year), accent: true }); } else if (p) parts.push({ t: p, accent: false }); });
  return parts;
}

/** Guias inteligentes: encaixa bordas/centro nas bordas/centros de outras camadas e da folha (tolerância em mm). */
export function guideSnap(v: number, size: number, targets: readonly number[], tol = 1.5): number {
  let best = v, bestD = tol + 1;
  for (const t of targets) for (const off of [0, size / 2, size]) { const d = Math.abs(v + off - t); if (d < bestD && d <= tol) { bestD = d; best = t - off; } }
  return best;
}
export function guideTargets(layers: readonly Layer[], except: string, axis: "x" | "y"): number[] {
  const S = axis === "x" ? SHEET_W : SHEET_H; const out = [0, S / 2, S];
  for (const l of layers) if (l.id !== except && l.visible) { const p = axis === "x" ? l.x : l.y, s = axis === "x" ? l.w : l.h; out.push(p, p + s / 2, p + s); }
  return out;
}

export function moveLayer(layers: readonly Layer[], id: string, patch: Partial<Pick<LayerBase, "x" | "y" | "w" | "h">>, opts: { snap: boolean; stepMm: number; guides?: boolean }): Layer[] {
  return layers.map((l) => {
    if (l.id !== id || l.locked) return l;
    let x = patch.x ?? l.x, y = patch.y ?? l.y; const w = patch.w ?? l.w, h = patch.h ?? l.h;
    if (opts.guides !== false && (patch.x !== undefined || patch.y !== undefined)) {
      if (patch.x !== undefined) x = guideSnap(x, w, guideTargets(layers, id, "x"));
      if (patch.y !== undefined) y = guideSnap(y, h, guideTargets(layers, id, "y"));
    }
    return { ...l, ...clampBox({ x: snapTo(x, opts.stepMm, opts.snap), y: snapTo(y, opts.stepMm, opts.snap), w: snapTo(w, opts.stepMm, opts.snap), h: snapTo(h, opts.stepMm, opts.snap) }) } as Layer;
  });
}

export function reorderLayer(layers: readonly Layer[], id: string, dir: "frente" | "tras"): Layer[] {
  return layers.map((l) => (l.id === id ? { ...l, z: Math.max(0, Math.min(60, l.z + (dir === "frente" ? 1 : -1))) } : l));
}
export function duplicateLayer(layers: readonly Layer[], id: string): Layer[] {
  const l = layers.find((x) => x.id === id); if (!l || layers.length >= MAX_LAYERS) return [...layers];
  const copy = { ...l, id: `${l.id.slice(0, 30)}-c${Date.now().toString(36).slice(-4)}`, name: `${l.name} (cópia)`, ...clampBox({ x: l.x + 3, y: l.y + 3, w: l.w, h: l.h }), locked: false } as Layer;
  return [...layers, copy];
}
