/** Desenhadores da Ficha de Matrícula: SVG (pré-visualização/impressão) e PDF vetorial (jsPDF). Só traduzem primitivas. */
import { jsPDF } from "jspdf";
import { fitContain, PAGE, PT_TO_MM, type ImgKey, type Layout, type Measure, type Prim } from "./layout";

export const FONT_STACK = "Helvetica, Arial, 'Liberation Sans', sans-serif";
export type ImageSrc = { src: string; w: number; h: number };
export type Images = Partial<Record<ImgKey, ImageSrc>>;

/** Métrica única: a do próprio jsPDF (Helvetica), usada também para quebrar as linhas do SVG. */
export function createMeasure(): Measure {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cache = new Map<string, number>();
  return (s, size, bold) => {
    const k = `${size}|${bold ? 1 : 0}|${s}`;
    let w = cache.get(k);
    if (w === undefined) { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); w = doc.getTextWidth(s); cache.set(k, w); }
    return w;
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (x: number) => Math.round(x * 1000) / 1000;

function primSvg(p: Prim, images: Images): string {
  switch (p.k) {
    case "rect": return `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}"${p.r ? ` rx="${p.r}"` : ""} fill="${p.fill ?? "none"}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.lw ?? 0.25}"` : ""}${p.dash ? ` stroke-dasharray="1 0.8"` : ""}/>`;
    case "line": return `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" stroke="${p.stroke}" stroke-width="${p.lw}"${p.dash ? ` stroke-dasharray="1 0.8"` : ""}/>`;
    case "circle": return `<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" fill="${p.fill ?? "none"}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.lw ?? 0.25}"` : ""}/>`;
    case "poly": return `<${p.closed ? "polygon" : "polyline"} points="${p.pts.map(([a, b]) => `${n(a)},${n(b)}`).join(" ")}" fill="${p.fill ?? "none"}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.lw ?? 0.25}" stroke-linejoin="round" stroke-linecap="round"` : ""}/>`;
    case "text": {
      const anchor = p.align === "center" ? "middle" : p.align === "right" ? "end" : "start";
      return `<text x="${n(p.x)}" y="${n(p.y)}" font-size="${n(p.size * PT_TO_MM)}" font-weight="${p.bold ? 700 : 400}" fill="${p.color}" text-anchor="${anchor}" xml:space="preserve">${esc(p.s)}</text>`;
    }
    case "image": {
      const im = images[p.img]; if (!im) return "";
      const f = fitContain(p.x, p.y, p.w, p.h, im.w, im.h);
      return `<image href="${esc(im.src)}" x="${n(f.x)}" y="${n(f.y)}" width="${n(f.w)}" height="${n(f.h)}" preserveAspectRatio="xMidYMid meet"/>`;
    }
  }
}

export function pageSvg(layout: Layout, i: number, images: Images): string {
  const p = layout.pages[i]!;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE.w} ${PAGE.h}" width="${PAGE.w}mm" height="${PAGE.h}mm" font-family="${FONT_STACK}"><rect width="${PAGE.w}" height="${PAGE.h}" fill="#FFFFFF"/>${p.prims.map((x) => primSvg(x, images)).join("")}</svg>`;
}

/** Documento HTML de impressão: uma folha A4 por página, sem margem do navegador e sem a interface do app. */
export function printHtml(layout: Layout, images: Images, title: string): string {
  const pages = layout.pages.map((_, i) => `<div class="sheet">${pageSvg(layout, i, images)}</div>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4 portrait;margin:0}html,body{margin:0;padding:0;background:#fff}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{width:210mm;height:297mm;break-after:page;page-break-after:always}.sheet:last-child{break-after:auto;page-break-after:auto}.sheet svg{display:block}</style></head><body>${pages}</body></html>`;
}

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** PDF vetorial: texto real (Helvetica) e formas; imagens PNG/JPEG embutidas. */
export function renderPdf(layout: Layout, images: Images, title: string): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  doc.setProperties({ title, creator: "SIGEM" });
  layout.pages.forEach((page, i) => {
    if (i > 0) doc.addPage("a4", "portrait");
    for (const p of page.prims) {
      switch (p.k) {
        case "rect": {
          if (p.fill) doc.setFillColor(...rgb(p.fill));
          if (p.stroke) { doc.setDrawColor(...rgb(p.stroke)); doc.setLineWidth(p.lw ?? 0.25); }
          doc.setLineDashPattern(p.dash ? [1, 0.8] : [], 0);
          const style = p.fill && p.stroke ? "FD" : p.fill ? "F" : "S";
          if (p.r) doc.roundedRect(p.x, p.y, p.w, p.h, p.r, p.r, style); else doc.rect(p.x, p.y, p.w, p.h, style);
          doc.setLineDashPattern([], 0);
          break;
        }
        case "line":
          doc.setDrawColor(...rgb(p.stroke)); doc.setLineWidth(p.lw); doc.setLineDashPattern(p.dash ? [1, 0.8] : [], 0);
          doc.line(p.x1, p.y1, p.x2, p.y2); doc.setLineDashPattern([], 0); break;
        case "circle": {
          if (p.fill) doc.setFillColor(...rgb(p.fill));
          if (p.stroke) { doc.setDrawColor(...rgb(p.stroke)); doc.setLineWidth(p.lw ?? 0.25); }
          doc.circle(p.cx, p.cy, p.r, p.fill && p.stroke ? "FD" : p.fill ? "F" : "S"); break;
        }
        case "poly": {
          const [x0, y0] = p.pts[0]!; const deltas = p.pts.slice(1).map(([x, y], k) => [x - p.pts[k]![0], y - p.pts[k]![1]]);
          if (p.fill) doc.setFillColor(...rgb(p.fill));
          if (p.stroke) { doc.setDrawColor(...rgb(p.stroke)); doc.setLineWidth(p.lw ?? 0.25); doc.setLineCap("round"); doc.setLineJoin("round"); }
          doc.lines(deltas, x0, y0, [1, 1], p.fill ? "F" : "S", !!p.closed); doc.setLineCap("butt"); doc.setLineJoin("miter"); break;
        }
        case "text":
          doc.setFont("helvetica", p.bold ? "bold" : "normal"); doc.setFontSize(p.size); doc.setTextColor(...rgb(p.color));
          doc.text(p.s, p.x, p.y, { align: p.align ?? "left", baseline: "alphabetic" }); break;
        case "image": {
          const im = images[p.img]; if (!im) break;
          const f = fitContain(p.x, p.y, p.w, p.h, im.w, im.h);
          doc.addImage(im.src, /^data:image\/jpe?g/.test(im.src) ? "JPEG" : "PNG", f.x, f.y, f.w, f.h, p.img, "FAST");
          break;
        }
      }
    }
  });
  return doc;
}
