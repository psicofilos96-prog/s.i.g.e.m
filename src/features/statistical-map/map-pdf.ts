/**
 * Gerador PDF do Mapa Estatístico: A4 paisagem (297 × 210 mm) com área segura de 12 mm,
 * paginação física medida linha a linha (cabeçalho de tabela repetido, título nunca sozinho,
 * linha nunca partida) e download direto, sem depender da impressão do navegador.
 * Só desenha o modelo recebido; nunca calcula nem altera número.
 */
import { jsPDF } from "jspdf";
import type { Block, Col, OfficialMapDoc, Row } from "./map-official-model";

export const PAGE = { w: 297, h: 210, m: 12 } as const;
const HEAD_H = 15; const FOOT_H = 8;
const TOP = PAGE.m + HEAD_H; const BOTTOM = PAGE.h - PAGE.m - FOOT_H; const LEFT = PAGE.m; const WIDTH = PAGE.w - 2 * PAGE.m;
const C = { navy: [15, 42, 82], mid: [31, 95, 168], light: [232, 240, 250], sub: [214, 228, 245], line: [160, 180, 205], gold: [184, 147, 47], ink: [20, 33, 61], gray: [95, 105, 120], zebra: [247, 250, 254] } as const;
const PT = 0.3528;
const lh = (pt: number) => pt * PT * 1.22;

/** Texto só com caracteres da fonte padrão do PDF (evita quadrados no lugar de símbolos). */
export const pdfSafe = (s: string) => s.replace(/[\u2212\u2013]/g, "-").replace(/\u00d7/g, "x").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
  .replace(/[^\u0000-\u00ff\u2014\u2022\u2026]/g, "");

export type Box = { page: number; x: number; y: number; w: number; h: number; kind: string };
export type RenderOpts = { cover?: boolean; emblem?: { dataUrl: string; w: number; h: number } | null };

export function renderOfficialMapPdf(d: OfficialMapDoc, o: RenderOpts = {}): { pdf: jsPDF; boxes: Box[]; pages: number; text: string[] } {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const boxes: Box[] = []; const text: string[] = [];
  let y = TOP; let firstContent = 1;
  const page = () => pdf.getCurrentPageInfo().pageNumber;
  const rgb = (c: readonly number[], k: "fill" | "draw" | "text") => (k === "fill" ? pdf.setFillColor(c[0]!, c[1]!, c[2]!) : k === "draw" ? pdf.setDrawColor(c[0]!, c[1]!, c[2]!) : pdf.setTextColor(c[0]!, c[1]!, c[2]!));
  const font = (pt: number, style: "normal" | "bold" | "italic" = "normal", color: readonly number[] = C.ink) => { pdf.setFont("helvetica", style); pdf.setFontSize(pt); rgb(color, "text"); };
  const wrap = (s: string, w: number) => pdf.splitTextToSize(pdfSafe(s), Math.max(2, w)) as string[];
  const put = (lines: string[] | string, x: number, yy: number, opt: { align?: "left" | "center" | "right" } = {}) => {
    const arr = Array.isArray(lines) ? lines : [lines]; text.push(...arr);
    pdf.text(arr, x, yy, { baseline: "top", align: opt.align ?? "left", lineHeightFactor: 1.22 });
  };
  const box = (x: number, yy: number, w: number, h: number, kind: string) => boxes.push({ page: page(), x, y: yy, w, h, kind });

  // ---------- capa ----------
  if (o.cover !== false) {
    rgb(C.light, "fill"); pdf.rect(0, 0, PAGE.w, PAGE.h, "F");
    rgb(C.navy, "fill"); pdf.rect(0, PAGE.h - 34, PAGE.w, 34, "F");
    rgb(C.mid, "fill"); pdf.rect(0, PAGE.h - 38, PAGE.w, 4, "F");
    rgb(C.gold, "fill"); pdf.rect(0, PAGE.h - 39, PAGE.w, 1, "F");
    rgb(C.navy, "fill"); pdf.rect(0, 0, 8, PAGE.h - 39, "F");
    let x0 = 24;
    if (o.emblem) { const h = 30; const w = (o.emblem.w / o.emblem.h) * h; pdf.addImage(o.emblem.dataUrl, "PNG", 24, 22, w, h); x0 = 24 + w + 8; }
    font(11, "bold", C.navy); put(d.headerLines.map((l) => l.toUpperCase()), x0, 26);
    font(36, "bold", C.navy); put("MAPA ESTATÍSTICO", PAGE.w / 2, 76, { align: "center" });
    font(15, "normal", C.mid); put("da Unidade Escolar", PAGE.w / 2, 92, { align: "center" });
    rgb(C.gold, "fill"); pdf.rect(PAGE.w / 2 - 25, 103, 50, 0.8, "F");
    font(16, "bold", C.ink); put(wrap(d.schoolName, 220), PAGE.w / 2, 110, { align: "center" });
    font(14, "bold", [255, 255, 255]); rgb(C.mid, "fill");
    const comp = d.competence.toUpperCase(); const cw = pdf.getTextWidth(comp) + 20;
    pdf.roundedRect(PAGE.w / 2 - cw / 2, 128, cw, 10, 5, 5, "F"); put(comp, PAGE.w / 2, 130.3, { align: "center" });
    font(9, "normal", C.gray); put(d.statusTag, PAGE.w / 2, 144, { align: "center" });
    font(9, "bold", [255, 255, 255]); put("SIGEM · SISTEMA DE GESTÃO EDUCACIONAL MUNICIPAL", PAGE.w - PAGE.m - 6, PAGE.h - 20, { align: "right" });
    pdf.addPage(); firstContent = 2;
  }

  const runHead = () => {
    let x = LEFT;
    if (o.emblem) { const h = 10; const w = (o.emblem.w / o.emblem.h) * h; pdf.addImage(o.emblem.dataUrl, "PNG", LEFT, PAGE.m, w, h); x += w + 3; }
    font(7, "bold", C.navy); put(d.headerLines.map((l) => l.toUpperCase()), x, PAGE.m + 0.8);
    font(9.5, "bold", C.navy); put(wrap(d.schoolName, 120)[0] ?? "", PAGE.w - PAGE.m, PAGE.m, { align: "right" });
    font(8, "normal", C.mid); put(`Mapa Estatístico · ${d.competence} · ${d.statusTag}`, PAGE.w - PAGE.m, PAGE.m + 4.6, { align: "right" });
    rgb(C.mid, "fill"); pdf.rect(LEFT, PAGE.m + 11.2, WIDTH, 0.5, "F");
    box(LEFT, PAGE.m, WIDTH, 11.7, "head");
    y = TOP;
  };
  const newPage = () => { pdf.addPage(); runHead(); };
  const room = () => BOTTOM - y;
  const ensure = (h: number) => { if (h > room()) { newPage(); return true; } return false; };
  runHead();

  // ---------- tabela ----------
  const colW = (cols: Col[]) => { const t = cols.reduce((a, c) => a + c.w, 0); return cols.map((c) => (c.w / t) * WIDTH); };
  const PAD = 1.1; const TPT = 8; const HPT = 7.5;
  const measure = (cells: string[], ws: number[], pt: number, bold: boolean) => { font(pt, bold ? "bold" : "normal"); return cells.map((c, i) => wrap(c, ws[i]! - 2 * PAD)); };
  const rowH = (lines: string[][], pt: number) => Math.max(...lines.map((l) => Math.max(1, l.length))) * lh(pt) + 2 * PAD;

  const drawRow = (lines: string[][], ws: number[], cols: Col[], h: number, style: { fill?: readonly number[]; pt: number; bold?: boolean; italic?: boolean; color?: readonly number[] }) => {
    let x = LEFT;
    for (let i = 0; i < ws.length; i++) {
      if (style.fill) { rgb(style.fill, "fill"); pdf.rect(x, y, ws[i]!, h, "F"); }
      rgb(C.line, "draw"); pdf.setLineWidth(0.15); pdf.rect(x, y, ws[i]!, h, "S");
      font(style.pt, style.italic ? "italic" : style.bold ? "bold" : "normal", style.color ?? C.ink);
      const a = cols[i]?.align ?? "left"; const tx = a === "right" ? x + ws[i]! - PAD : a === "center" ? x + ws[i]! / 2 : x + PAD;
      put(lines[i] ?? [], tx, y + PAD + 0.2, { align: a });
      x += ws[i]!;
    }
    box(LEFT, y, WIDTH, h, "row"); y += h;
  };

  const caption = (b: Extract<Block, { kind: "table" }>, cont: boolean) => {
    if (!b.caption) return;
    font(9.5, "bold", C.navy); put(pdfSafe(b.caption + (cont ? " (continuação)" : "")), LEFT, y); y += lh(9.5) + 0.4;
    if (b.subtitle && !cont) { font(7.5, "italic", C.gray); const l = wrap(b.subtitle, WIDTH); put(l, LEFT, y); y += l.length * lh(7.5); }
    y += 0.8;
  };
  const captionH = (b: Extract<Block, { kind: "table" }>) => (b.caption ? lh(9.5) + 1.2 : 0) + (b.subtitle ? wrap(b.subtitle, WIDTH).length * lh(7.5) : 0);

  const header = (b: Extract<Block, { kind: "table" }>, ws: number[]) => {
    if (b.groups) {
      let x = LEFT; let i = 0; const h = lh(HPT) + 2 * PAD;
      for (const g of b.groups) { const w = ws.slice(i, i + g.span).reduce((a, c) => a + c, 0); i += g.span;
        if (g.label) { rgb(C.mid, "fill"); pdf.rect(x, y, w, h, "F"); font(HPT, "bold", [255, 255, 255]); put(g.label.toUpperCase(), x + w / 2, y + PAD + 0.2, { align: "center" }); }
        x += w; }
      box(LEFT, y, WIDTH, h, "group"); y += h;
    }
    const lines = measure(b.cols.map((c) => c.label), ws, HPT, true);
    drawRow(lines, ws, b.cols.map((c) => ({ ...c, align: c.align === "right" ? "center" : c.align })), rowH(lines, HPT), { fill: C.light, pt: HPT, bold: true, color: C.navy });
  };
  const headerH = (b: Extract<Block, { kind: "table" }>, ws: number[]) => (b.groups ? lh(HPT) + 2 * PAD : 0) + rowH(measure(b.cols.map((c) => c.label), ws, HPT, true), HPT);

  const table = (b: Extract<Block, { kind: "table" }>) => {
    const ws = colW(b.cols);
    const rows: Row[] = b.rows;
    const lineOf = (r: Row) => measure(r.cells, ws, TPT, !!r.style);
    const firstH = rows.length ? rowH(lineOf(rows[0]!), TPT) : lh(TPT) + 2 * PAD;
    ensure(captionH(b) + headerH(b, ws) + firstH + 1);
    caption(b, false); header(b, ws);
    if (!rows.length) {
      font(TPT, "italic", C.gray); const l = wrap(b.empty ?? "Sem registro.", WIDTH - 2 * PAD); const h = rowH([l], TPT);
      rgb(C.line, "draw"); pdf.rect(LEFT, y, WIDTH, h, "S"); put(l, LEFT + PAD, y + PAD + 0.2); box(LEFT, y, WIDTH, h, "row"); y += h;
    }
    rows.forEach((r, i) => {
      const lines = lineOf(r); const h = rowH(lines, TPT);
      if (ensure(h)) { caption(b, true); header(b, ws); }
      const fill = r.style === "total" ? C.sub : r.style === "sub" ? C.light : i % 2 ? C.zebra : undefined;
      drawRow(lines, ws, b.cols, h, { fill, pt: TPT, bold: !!r.style, color: r.style === "total" ? C.navy : C.ink });
    });
    y += 3;
  };

  const fields = (pairs: [string, string][]) => {
    const colWd = (WIDTH - 4) / 2; const LW = 38;
    for (let i = 0; i < pairs.length; i += 2) {
      const pair = [pairs[i]!, pairs[i + 1]];
      font(TPT); const vs = pair.map((p) => (p ? wrap(p[1], colWd - LW - 2 * PAD) : []));
      const h = Math.max(...vs.map((v) => Math.max(1, v.length))) * lh(TPT) + 2 * PAD + 0.4;
      ensure(h);
      pair.forEach((p, j) => { if (!p) return; const x = LEFT + j * (colWd + 4);
        rgb(C.light, "fill"); pdf.rect(x, y, LW, h, "F"); rgb(C.line, "draw"); pdf.setLineWidth(0.15); pdf.rect(x, y, colWd, h, "S");
        font(7.5, "bold", C.navy); put(wrap(p[0].toUpperCase(), LW - 2 * PAD), x + PAD, y + PAD + 0.3);
        font(TPT, "normal"); put(vs[j]!, x + LW + PAD, y + PAD + 0.2); });
      box(LEFT, y, WIDTH, h, "fields"); y += h;
    }
    y += 3;
  };

  const note = (t: string) => { font(7.5, "italic", C.gray); const l = wrap(t, WIDTH); ensure(l.length * lh(7.5)); put(l, LEFT, y); box(LEFT, y, WIDTH, l.length * lh(7.5), "note"); y += l.length * lh(7.5) + 2.5; };

  const firstBlockH = (b: Block | undefined) => (!b ? 0 : b.kind === "table" ? captionH(b) + headerH(b, colW(b.cols)) + 8 : b.kind === "fields" ? 10 : 6);
  for (const s of d.sections) {
    const bandH = 7.5;
    ensure(bandH + 3 + firstBlockH(s.blocks[0]));
    rgb(C.navy, "fill"); pdf.rect(LEFT, y, WIDTH, bandH, "F"); rgb(C.gold, "fill"); pdf.rect(LEFT, y, 1.4, bandH, "F");
    font(11.5, "bold", [255, 255, 255]); put(pdfSafe(s.title.toUpperCase()), LEFT + 4, y + 1.6); box(LEFT, y, WIDTH, bandH, "band");
    y += bandH + 3;
    for (const b of s.blocks) b.kind === "table" ? table(b) : b.kind === "fields" ? fields(b.pairs) : note(b.text);
    y += 2;
  }

  // ---------- encerramento: observações + assinaturas no pé da última folha ----------
  font(TPT); const obs = wrap(d.observations.trim() || "Sem observações.", WIDTH - 2 * PAD - 2);
  const obsH = Math.max(12, obs.length * lh(TPT) + 2 * PAD + 2);
  const SIG_H = 30;
  ensure(lh(9.5) + 2 + obsH + 4 + SIG_H);
  font(9.5, "bold", C.navy); put("Observações", LEFT, y); y += lh(9.5) + 1.5;
  rgb(C.line, "draw"); pdf.setLineWidth(0.2); pdf.roundedRect(LEFT, y, WIDTH, obsH, 1.2, 1.2, "S");
  font(TPT, d.observations.trim() ? "normal" : "italic", d.observations.trim() ? C.ink : C.gray); put(obs, LEFT + PAD + 1, y + PAD + 0.5); box(LEFT, y, WIDTH, obsH, "obs"); y += obsH + 4;
  const sy = Math.max(y, BOTTOM - SIG_H);
  const n = Math.max(1, d.signatures.length) + 1; const gap = 10; const sw = (WIDTH - gap * (n - 1)) / n;
  [...d.signatures, "Data de entrega"].forEach((s, i) => {
    const x = LEFT + i * (sw + gap); const ly = sy + 18;
    rgb(C.ink, "draw"); pdf.setLineWidth(0.3); pdf.line(x, ly, x + sw, ly);
    font(8, "normal"); put(i === n - 1 ? "Data de entrega: ____/____/______" : wrap(s, sw), x + sw / 2, ly + 1.5, { align: "center" });
  });
  font(7.5, "normal", C.gray); put(`Competência: ${d.competence}`, LEFT, sy + 26);
  box(LEFT, sy, WIDTH, SIG_H, "signatures");

  // ---------- rodapé com paginação (sem a capa) ----------
  const total = pdf.getNumberOfPages(); const counted = total - firstContent + 1;
  for (let p = firstContent; p <= total; p++) {
    pdf.setPage(p);
    rgb(C.line, "fill"); pdf.rect(LEFT, PAGE.h - PAGE.m - 5, WIDTH, 0.2, "F");
    font(7, "normal", C.gray);
    put(pdfSafe(`${d.schoolName} · ${d.competence} · Gerado pelo SIGEM em ${d.generatedAt} · ${d.footerNote}`).slice(0, 190), LEFT, PAGE.h - PAGE.m - 3.6);
    put(`Página ${p - firstContent + 1} de ${counted}`, PAGE.w - PAGE.m, PAGE.h - PAGE.m - 3.6, { align: "right" });
    boxes.push({ page: p, x: LEFT, y: PAGE.h - PAGE.m - 5, w: WIDTH, h: 5, kind: "foot" });
  }
  return { pdf, boxes, pages: total, text };
}

/** Carrega o brasão como imagem embutível (só no navegador). Falha vira "sem brasão", nunca erro. */
export async function loadEmblem(url: string): Promise<RenderOpts["emblem"]> {
  try {
    const blob = await (await fetch(url)).blob();
    const dataUrl = await new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsDataURL(blob); });
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = dataUrl; });
    const c = document.createElement("canvas"); const s = Math.min(1, 360 / img.height); c.width = img.width * s; c.height = img.height * s;
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL("image/png"), w: c.width, h: c.height };
  } catch { return null; }
}

export async function downloadOfficialMapPdf(d: OfficialMapDoc, fileName: string, o: { cover: boolean; emblemUrl: string | null }) {
  const emblem = o.emblemUrl ? await loadEmblem(o.emblemUrl) : null;
  renderOfficialMapPdf(d, { cover: o.cover, emblem }).pdf.save(fileName);
}
