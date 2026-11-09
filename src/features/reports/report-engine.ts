/**
 * Motor comum de relatórios (puro). Um relatório é DEFINIÇÃO versionada sobre um read model
 * canônico já autorizado: parâmetros tipados, colunas declaradas, filtros/ordenação/agrupamento
 * apenas sobre colunas declaradas. Não há SQL editável: a fonte é uma função registrada que
 * recebe as linhas que o reader do usuário JÁ devolveu — o motor nunca amplia permissão.
 * Ausência (null) nunca vira zero em nenhum formato.
 */

import brasaoAsset from "@/assets/brasao-itaperuna.png.asset.json";
import educacaoAsset from "@/assets/logo-educacao.png.asset.json";
import { fitPdfImage, wrapPdfRuns, type PdfAttachment, type PdfSection, type PdfRun } from "./pdf-content";

export type ParamType = "date" | "datetime" | "integer" | "text" | "enum";
export type ParamDef = Readonly<{ id: string; label: string; type: ParamType; required: boolean; min?: number; max?: number; options?: readonly string[]; maxLength?: number }>;
export type CellValue = string | number | null;
export type ColumnDef = Readonly<{ id: string; label: string; kind: "text" | "number" | "date"; sensitive?: boolean }>;
export type Branding = Readonly<{ headerLines: readonly string[]; title: string; logoUrl?: string | null }>;
export type ReportFormat = "csv" | "xlsx" | "pdf" | "docx";

export type ReportDefinition = Readonly<{
  id: string; version: number; title: string; description: string;
  source: string; // read model canônico (nome do reader/função), documental
  params: readonly ParamDef[];
  columns: readonly ColumnDef[];
  formats: readonly ReportFormat[];
  reproducible: boolean; // exige snapshot/fingerprint
  /** Limite de linhas para execução síncrona; acima disso vai para job. */
  syncRowLimit: number;
  /** Dependência pendente: relatório catalogado mas sem fonte/regra canônica. */
  dependency?: string | null;
}>;

export type ReportRequest = Readonly<{
  params: Record<string, unknown>;
  columns?: readonly string[];
  filters?: readonly { column: string; equals: CellValue }[];
  sort?: readonly { column: string; dir: "asc" | "desc" }[];
  groupBy?: string | null;
  includeSensitive?: boolean;
}>;

export class ReportError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function validateParams(def: ReportDefinition, raw: Record<string, unknown>): Record<string, CellValue> {
  const out: Record<string, CellValue> = {};
  for (const k of Object.keys(raw)) if (!def.params.some((p) => p.id === k)) throw new ReportError("param:unknown", `Parâmetro não previsto: ${k}.`);
  for (const p of def.params) {
    const v = raw[p.id];
    if (v === undefined || v === null || v === "") {
      if (p.required) throw new ReportError("param:missing", `Informe ${p.label}.`);
      out[p.id] = null; continue;
    }
    switch (p.type) {
      case "date": if (typeof v !== "string" || !ISO_DATE.test(v) || Number.isNaN(Date.parse(v))) throw new ReportError("param:invalid", `${p.label} deve ser uma data válida.`); out[p.id] = v; break;
      case "datetime": if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw new ReportError("param:invalid", `${p.label} deve ser data e hora válidas.`); out[p.id] = new Date(v).toISOString(); break;
      case "integer": {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isInteger(n) || (p.min != null && n < p.min) || (p.max != null && n > p.max)) throw new ReportError("param:invalid", `${p.label} fora do intervalo permitido.`);
        out[p.id] = n; break;
      }
      case "enum": if (typeof v !== "string" || !p.options?.includes(v)) throw new ReportError("param:invalid", `${p.label}: opção não prevista.`); out[p.id] = v; break;
      case "text": if (typeof v !== "string" || v.length > (p.maxLength ?? 200)) throw new ReportError("param:invalid", `${p.label} inválido.`); out[p.id] = v; break;
    }
  }
  return out;
}

export type ReportResult = Readonly<{
  definitionId: string; definitionVersion: number; params: Record<string, CellValue>;
  columns: readonly ColumnDef[]; rows: readonly (readonly CellValue[])[];
  groups: readonly { key: CellValue; count: number }[] | null;
  generatedAt: string; mode: "sync" | "async";
}>;

/** Executa sobre linhas já autorizadas. Filtros só restringem; colunas sensíveis saem por padrão. */
export function runReport(def: ReportDefinition, req: ReportRequest, sourceRows: readonly Record<string, CellValue>[], now = new Date()): ReportResult {
  if (def.dependency) throw new ReportError("report:dependency", `Relatório indisponível: ${def.dependency}`);
  const params = validateParams(def, req.params);
  const known = new Map(def.columns.map((c) => [c.id, c]));
  const check = (id: string) => { if (!known.has(id)) throw new ReportError("column:unknown", `Coluna não prevista: ${id}.`); return id; };
  const chosenIds = (req.columns ?? def.columns.map((c) => c.id)).map(check);
  const cols = chosenIds.map((id) => known.get(id)!).filter((c) => !c.sensitive || req.includeSensitive);
  let rows = sourceRows.filter((r) => (req.filters ?? []).every((f) => (check(f.column), (r[f.column] ?? null) === f.equals)));
  for (const s of [...(req.sort ?? [])].reverse()) {
    check(s.column);
    rows = [...rows].sort((a, b) => {
      const x = a[s.column] ?? null, y = b[s.column] ?? null;
      if (x === y) return 0; if (x === null) return 1; if (y === null) return -1; // ausência sempre ao fim
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR");
      return s.dir === "asc" ? c : -c;
    });
  }
  const groupBy = req.groupBy ? check(req.groupBy) : null;
  const groups = groupBy ? [...rows.reduce((m, r) => m.set(r[groupBy] ?? null, (m.get(r[groupBy] ?? null) ?? 0) + 1), new Map<CellValue, number>())].map(([key, count]) => ({ key, count })) : null;
  return {
    definitionId: def.id, definitionVersion: def.version, params, columns: cols,
    rows: rows.map((r) => cols.map((c) => r[c.id] ?? null)), groups,
    generatedAt: now.toISOString(), mode: rows.length > def.syncRowLimit ? "async" : "sync",
  };
}

export const ABSENT = "não disponível";
export const cellText = (v: CellValue) => (v === null ? ABSENT : String(v));

/** Neutraliza fórmulas (CSV/XLSX injection): prefixa ' quando começa com = + - @ tab ou CR. */
export function neutralize(s: string): string {
  return /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
}

export function toCsv(result: ReportResult, branding: Branding, meta: readonly string[] = []): string {
  const esc = (c: string) => { const n = neutralize(c); return /[";\n\r]/.test(n) ? `"${n.replace(/"/g, '""')}"` : n; };
  const lines: string[][] = [...branding.headerLines.map((l) => [l]), [branding.title], ...meta.map((m) => [m]), [],
    result.columns.map((c) => c.label), ...result.rows.map((r) => r.map(cellText))];
  return "\uFEFF" + lines.map((r) => r.map(esc).join(";")).join("\r\n");
}

export async function toXlsx(result: ReportResult, branding: Branding, meta: readonly string[] = []): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Relatório");
  [...branding.headerLines, branding.title, ...meta].forEach((l) => ws.addRow([neutralize(l)]));
  ws.addRow([]);
  ws.addRow(result.columns.map((c) => c.label)).font = { bold: true };
  // Ausência é texto explícito; número só quando é número. Strings neutralizadas, nunca fórmula.
  for (const r of result.rows) ws.addRow(r.map((v) => (v === null ? ABSENT : typeof v === "number" ? v : neutralize(v))));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const html = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Logo do cabeçalho: endereço https ou imagem embutida (data:) lida do armazenamento da escola; qualquer outro esquema é recusado. */
export const allowedLogoUrl = (u: string) => /^https:\/\//.test(u) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u);

/**
 * Identidade oficial dos documentos emitidos pelo SIGEM: brasão do município no canto
 * superior esquerdo e logo da Secretaria Municipal de Educação no canto superior direito.
 * As imagens são ativos institucionais fixos da mesma origem — nunca vêm de entrada do usuário.
 */
export const DOCUMENT_CREST_URL: string = brasaoAsset.url;
export const DOCUMENT_SECRETARIAT_LOGO_URL: string = educacaoAsset.url;

type HeaderImage = { dataUrl: string; width: number; height: number };
/** Lê um ativo institucional da mesma origem como data URL, com dimensões naturais. Falha = sem imagem, nunca quebra a exportação. */
async function loadHeaderImage(url: string): Promise<HeaderImage | null> {
  try {
    const res = await fetch(new URL(url, window.location.origin).href);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\/(png|jpeg|webp)$/.test(blob.type)) return null;
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;
    const dims = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
    if (!dims || !dims.width || !dims.height) return null;
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}
/** PDF = documento HTML imprimível, com escape total (sem HTML do usuário). */
/** Bordas vetoriais em pt (≥0,75pt, preto, separate+spacing 0): linhas de 1px cinza com collapse somem ao reduzir o zoom do PDF. */
export const PRINT_BORDER = "0.75pt solid #222";
export const PRINT_TABLE_CSS = `@page{size:A4;margin:18mm 16mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:9px serif}}body{font-family:serif;font-size:11pt;line-height:1.5;margin:0;overflow-wrap:anywhere;-webkit-print-color-adjust:exact;print-color-adjust:exact}h1{font-size:16pt;line-height:1.25;margin:18px 0}h2,h3{line-height:1.3;margin:20px 0 8px;break-after:avoid}p{margin:0 0 10px;orphans:3;widows:3}table{border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;border-top:${PRINT_BORDER};border-left:${PRINT_BORDER}}thead{display:table-header-group}tr{page-break-inside:avoid;break-inside:avoid}td,th{border-right:${PRINT_BORDER};border-bottom:${PRINT_BORDER};padding:6px;font-size:10pt;text-align:left;vertical-align:top;overflow-wrap:anywhere}`;
export function toPrintableHtml(result: ReportResult, branding: Branding, meta: readonly string[] = [], fingerprint?: string): string {
  const logo = branding.logoUrl && allowedLogoUrl(branding.logoUrl) ? `<img src="${html(branding.logoUrl)}" alt="" style="height:48px">` : "";
  const header = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">`
    + `<img src="${html(DOCUMENT_CREST_URL)}" alt="Brasão do município" style="height:64px;max-width:72px;object-fit:contain">`
    + `<div style="flex:1;text-align:center">${branding.headerLines.map((l) => `<div>${html(l)}</div>`).join("")}</div>`
    + `<img src="${html(DOCUMENT_SECRETARIAT_LOGO_URL)}" alt="Secretaria Municipal de Educação" style="height:64px;max-width:140px;object-fit:contain">`
    + `</div>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${html(branding.title)}</title>
<style>${PRINT_TABLE_CSS}</style></head><body>
${header}${logo}<h1 style="text-align:center">${html(branding.title)}</h1>
${meta.map((m) => `<p>${html(m)}</p>`).join("")}
<table><thead><tr>${result.columns.map((c) => `<th>${html(c.label)}</th>`).join("")}</tr></thead><tbody>
${result.rows.map((r) => `<tr>${r.map((v) => `<td>${html(cellText(v))}</td>`).join("")}</tr>`).join("\n")}
</tbody></table><p>Gerado em ${html(result.generatedAt)}${fingerprint ? ` · impressão digital ${html(fingerprint)}` : ""}</p></body></html>`;
}

/** Snapshot canônico determinístico (sem generatedAt) e SHA-256. */
export function snapshotOf(result: ReportResult) {
  return JSON.stringify({ d: result.definitionId, v: result.definitionVersion, p: Object.keys(result.params).sort().map((k) => [k, result.params[k]]),
    c: result.columns.map((c) => c.id), r: result.rows });
}
export async function fingerprint(result: ReportResult): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(snapshotOf(result)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Trilha de geração e downloads temporários (sessão) ----------
export type GenerationEntry = Readonly<{ id: string; definitionId: string; version: number; format: ReportFormat; rows: number; fingerprint: string | null; createdAt: string; expiresAt: string }>;
export type JobRunner = (run: () => Promise<Blob>) => Promise<Blob>; // extensível: hoje roda local; job remoto pode substituir

export class GenerationLog {
  private entries: GenerationEntry[] = [];
  private blobs = new Map<string, Blob>();
  constructor(private ttlMs = 10 * 60_000, private clock = () => Date.now()) {}
  record(e: Omit<GenerationEntry, "id" | "createdAt" | "expiresAt">, blob: Blob): GenerationEntry {
    const t = this.clock();
    const entry: GenerationEntry = { ...e, id: crypto.randomUUID(), createdAt: new Date(t).toISOString(), expiresAt: new Date(t + this.ttlMs).toISOString() };
    this.entries = [entry, ...this.entries]; this.blobs.set(entry.id, blob); return entry;
  }
  /** Arquivo só dentro da validade; depois some (a trilha permanece, sem conteúdo). */
  get(id: string): Blob | null {
    const e = this.entries.find((x) => x.id === id);
    if (!e || Date.parse(e.expiresAt) <= this.clock()) { this.blobs.delete(id); return null; }
    return this.blobs.get(id) ?? null;
  }
  list() { this.sweep(); return this.entries; }
  sweep() { for (const e of this.entries) if (Date.parse(e.expiresAt) <= this.clock()) this.blobs.delete(e.id); }
  hasFile(id: string) { return this.get(id) != null; }
}

/** Exportação paginada é incompleta quando parou antes de esgotar a fonte e coletou menos que o total da tela. */
export function exportIncomplete(collected: number, screenTotal: number, exhausted: boolean): boolean {
  return !exhausted && collected < screenTotal;
}

/**
 * PDF de verdade (arquivo), não página web: A4, cabeçalho repetido, quebra de linhas sem corte lateral,
 * numeração "Página x de y" e bloco de assinaturas no fim. Assinaturas são linhas em branco com o papel,
 * nunca nome nem assinatura presumidos.
 */
export async function toPdfFile(result: ReportResult, branding: Branding, meta: readonly string[] = [],
  opts: { landscape?: boolean; signatures?: readonly string[]; sections?: readonly PdfSection[]; attachments?: readonly PdfAttachment[] } = {}): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: opts.landscape ? "landscape" : "portrait", unit: "mm", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = opts.sections ? 18 : 12;
  // Brasão do município à esquerda e logo da Secretaria à direita, em todo documento emitido.
  const [crest, secretariat] = await Promise.all([
    loadHeaderImage(DOCUMENT_CREST_URL), loadHeaderImage(DOCUMENT_SECRETARIAT_LOGO_URL),
  ]);
  const logoH = 16;
  const drawLogo = (img: HeaderImage, x: number) => {
    const w = Math.min(34, (logoH * img.width) / img.height);
    const format = img.dataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
    doc.addImage(img.dataUrl, format, x, M - 2, w, logoH);
  };
  if (crest) drawLogo(crest, M);
  if (secretariat) { const w = Math.min(34, (logoH * secretariat.width) / secretariat.height); drawLogo(secretariat, W - M - w); }
  let y = M + (crest || secretariat ? logoH + 2 : 2);
  doc.setFont("times", "normal"); doc.setFontSize(10);
  for (const l of branding.headerLines) { doc.text(l, W / 2, y, { align: "center" }); y += 5; }
  doc.setFont("times", "bold"); doc.setFontSize(13);
  for (const l of doc.splitTextToSize(branding.title, W - 2 * M) as string[]) { doc.text(l, W / 2, y + 1, { align: "center" }); y += 6; }
  y += 4;
  doc.setFont("times", "normal"); doc.setFontSize(9);
  for (const m of meta) {
    for (const l of doc.splitTextToSize(m, W - 2 * M) as string[]) {
      if (y + 5 > H - 18) { doc.addPage(); y = M + 5; }
      doc.text(l, M, y + 1); y += 4.5;
    }
    y += 1.5;
  }
  y += opts.sections ? 7 : 2;
  if (!opts.sections) autoTable(doc, {
    startY: y + 2, margin: { left: M, right: M, bottom: 16 }, theme: "grid",
    head: [result.columns.map((c) => c.label)], body: result.rows.map((r) => r.map(cellText)),
    styles: { font: "times", fontSize: 8, cellPadding: 1.2, overflow: "linebreak", lineColor: [34, 34, 34], lineWidth: 0.25, textColor: [0, 0, 0] },
    headStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: "bold" }, showHead: "everyPage", rowPageBreak: "avoid",
  });
  const pageTop = () => {
    doc.addPage();
    if (crest) drawLogo(crest, M);
    if (secretariat) { const w = Math.min(34, logoH * secretariat.width / secretariat.height); drawLogo(secretariat, W - M - w); }
    y = M + logoH + 7;
  };
  if (opts.sections) {
    const font = (run: PdfRun) => doc.setFont("times", run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal");
    for (const section of opts.sections) {
      if (y + 30 > H - 18) pageTop();
      doc.setFont("times", "bold"); doc.setFontSize(12);
      for (const line of doc.splitTextToSize(section.title, W - 2 * M) as string[]) {
        if (y + 6 > H - 18) pageTop();
        doc.text(line, M, y); y += 5;
      }
      y += 4;
      for (const paragraph of section.paragraphs) {
        if (paragraph.label) {
          if (y + 22 > H - 18) pageTop();
          y += 2;
        }
        doc.setFontSize(paragraph.label ? 10 : 11);
        const measure = (run: PdfRun) => { font(run); return doc.getTextWidth(run.text); };
        const lines = wrapPdfRuns(paragraph.runs, W - 2 * M, measure);
        lines.forEach((line, index) => {
          if (y + 6 > H - 18) { pageTop(); doc.setFontSize(paragraph.label ? 10 : 11); }
          // Trim trailing spaces before measuring alignment/justification.
          while (line.length && /^\s+$/.test(line[line.length - 1]?.text ?? "")) line.pop();
          const width = line.reduce((sum, run) => sum + measure(run), 0);
          const gaps = line.filter((r) => /^\s+$/.test(r.text)).length;
          const extra = paragraph.alignment === "justify" && index < lines.length - 1 && gaps > 0 ? (W - 2 * M - width) / gaps : 0;
          let x = paragraph.alignment === "center" ? (W - width) / 2 : paragraph.alignment === "right" ? W - M - width : M;
          for (const run of line) {
            font(run);
            // Built-in Times lacks the bullet glyph; use a small vector disk.
            if (run.text === "•") doc.circle(x + 0.8, y - 1, 0.45, "F");
            else doc.text(run.text, x, y);
            x += measure(run) + (/^\s+$/.test(run.text) ? extra : 0);
          }
          y += paragraph.label ? 5 : 5.8;
        });
        y += paragraph.label ? 1 : 3;
      }
      y += 7;
    }
  }
  for (const [index, attachment] of (opts.attachments ?? []).entries()) {
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(attachment.dataUrl)) throw new ReportError("report:image", "Não foi possível incorporar um dos anexos. O PDF não foi gerado.");
    pageTop(); doc.setFont("times", "bold"); doc.setFontSize(13);
    doc.text(`Anexos — Anexo ${index + 1}`, M, y); y += 7;
    doc.setFont("times", "normal"); doc.setFontSize(9);
    const caption = doc.splitTextToSize(attachment.caption, W - 2 * M) as string[];
    for (const line of caption) { if (y + 5 > H - 50) pageTop(); doc.text(line, M, y); y += 4.5; }
    y += 3;
    const fitted = fitPdfImage(attachment.width, attachment.height, W - 2 * M, H - 18 - y);
    doc.addImage(attachment.dataUrl, attachment.dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG", (W - fitted.width) / 2, y, fitted.width, fitted.height);
    y += fitted.height;
  }
  const sig = opts.signatures ?? [];
  if (sig.length) {
    let sy = (opts.sections || opts.attachments?.length ? y : (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 22;
    if (sy + 14 > H - 16) { doc.addPage(); sy = M + 24; }
    const colW = (W - 2 * M) / Math.min(sig.length, 3);
    sig.forEach((s, i) => {
      const row = Math.floor(i / 3), x = M + (i % 3) * colW, yy = sy + row * 22;
      doc.line(x + 6, yy, x + colW - 6, yy); doc.setFontSize(9); doc.text(s, x + colW / 2, yy + 4.5, { align: "center" });
    });
  }
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p); doc.setFont("times", "normal"); doc.setFontSize(8);
    doc.text(`Gerado em ${new Date(result.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, M, H - 7);
    doc.text(`Página ${p} de ${n}`, W - M, H - 7, { align: "right" });
  }
  return doc.output("blob");
}

/** Word editável, produzido somente sobre o mesmo resultado e conteúdo autorizado do PDF. */
export async function toWordFile(result: ReportResult, branding: Branding, meta: readonly string[] = [],
  opts: { landscape?: boolean; sections?: readonly PdfSection[]; attachments?: readonly PdfAttachment[] } = {}): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
    Header, Footer, AlignmentType, HeadingLevel, WidthType, PageOrientation,
    BorderStyle, PageNumber, LevelFormat, ShadingType } = await import("docx");
  const [crest, secretariat] = await Promise.all([
    loadHeaderImage(DOCUMENT_CREST_URL), loadHeaderImage(DOCUMENT_SECRETARIAT_LOGO_URL),
  ]);
  const contentWidth = opts.landscape ? 14782 : 9866;
  const imageRun = (image: HeaderImage, maxWidth: number, maxHeight: number) => {
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image.dataUrl)) {
      throw new ReportError("report:image", "Não foi possível incorporar um dos anexos. O documento não foi gerado.");
    }
    const fit = fitPdfImage(image.width, image.height, maxWidth, maxHeight);
    const bytes = Uint8Array.from(atob(image.dataUrl.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
    return new ImageRun({ type: image.dataUrl.startsWith("data:image/jpeg") ? "jpg" : "png", data: bytes,
      transformation: { width: fit.width, height: fit.height },
      altText: { title: "Imagem do documento", description: "Imagem incorporada ao documento", name: "Imagem" } });
  };
  const headerChildren = [];
  if (crest) headerChildren.push(imageRun(crest, 55, 60));
  headerChildren.push(new TextRun("\t"));
  if (secretariat) headerChildren.push(imageRun(secretariat, 125, 60));
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  for (const line of branding.headerLines) children.push(new Paragraph({ alignment: AlignmentType.CENTER,
    spacing: { after: 80 }, children: [new TextRun({ text: line, size: 22 })] }));
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 260 }, children: [new TextRun({ text: branding.title, bold: true, size: 30 })] }));
  for (const line of meta) children.push(new Paragraph({ spacing: { after: 100 },
    children: [new TextRun({ text: line, size: 18 })] }));
  if (opts.sections) {
    const alignments = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };
    for (const section of opts.sections) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true,
        spacing: { before: 280, after: 180 }, children: [new TextRun({ text: section.title, bold: true, size: 24 })] }));
      for (const p of section.paragraphs) {
        const bullet = p.runs[0]?.text.startsWith("• ") ?? false;
        children.push(new Paragraph({ alignment: alignments[p.alignment], keepNext: p.label,
          numbering: bullet ? { reference: "report-bullets", level: 0 } : undefined,
          spacing: { before: p.label ? 160 : 0, after: p.label ? 60 : 140, line: 300 },
          children: p.runs.map((r, i) => new TextRun({ text: bullet && i === 0 ? r.text.slice(2) : r.text,
            bold: r.bold, italics: r.italic, size: p.label ? 20 : 22 })) }));
      }
    }
  } else if (result.columns.length) {
    const widths = result.columns.map((_, i) => Math.floor(contentWidth / result.columns.length) + (i === 0 ? contentWidth % result.columns.length : 0));
    const row = (values: readonly string[], heading = false) => new TableRow({ tableHeader: heading,
      children: values.map((value, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
        shading: heading ? { fill: "EEEEEE", type: ShadingType.CLEAR } : undefined,
        children: [new Paragraph({ children: [new TextRun({ text: value, bold: heading, size: 18 })] })] })) });
    children.push(new Table({ width: { size: contentWidth, type: WidthType.DXA }, columnWidths: widths,
      rows: [row(result.columns.map((c) => c.label), true), ...result.rows.map((r) => row(r.map(cellText)))] }));
  }
  for (const [i, attachment] of (opts.attachments ?? []).entries()) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, keepNext: true,
      spacing: { after: 180 }, children: [new TextRun({ text: `Anexos — Anexo ${i + 1}`, bold: true, size: 26 })] }));
    for (const line of attachment.caption.split("\n")) children.push(new Paragraph({ keepNext: true,
      spacing: { after: 100 }, children: [new TextRun({ text: line, size: 18 })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER,
      children: [imageRun(attachment, contentWidth / 15, opts.landscape ? 360 : 640)] }));
  }
  const document = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 22 }, paragraph: { spacing: { line: 300 } } } } },
    numbering: { config: [{ reference: "report-bullets", levels: [{ level: 0, format: LevelFormat.BULLET,
      text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 180 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838,
      orientation: opts.landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
      margin: { top: 1580, bottom: 1100, left: 1020, right: 1020, header: 450, footer: 450 } } },
      headers: { default: new Header({ children: [new Paragraph({ tabStops: [{ type: "right", position: contentWidth }], children: headerChildren })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
        tabStops: [{ type: "right", position: contentWidth }], children: [
          new TextRun({ text: `Gerado em ${new Date(result.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, size: 16 }),
          new TextRun({ text: "\tPágina ", size: 16 }), new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
          new TextRun({ text: " de ", size: 16 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 }),
        ] })] }) }, children }],
  });
  return Packer.toBlob(document);
}

/** Baixa um Blob como arquivo. */
export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
