/**
 * REPORT.PRO.3 — Camada final do gerador: junta escolha (assunto/filtros/colunas) + organização
 * (agrupamento/cálculos) + gráfico + layout, e produz XLSX multi-aba e PDF (HTML imprimível) reais.
 * Tudo roda sobre linhas que o reader do usuário já devolveu; nada amplia acesso nem inventa número.
 */
import { ABSENT, cellText, neutralize, type CellValue, type ReportResult } from "./report-engine";
import type { BuilderChoice } from "./report-builder";
import {
  DEFAULT_LAYOUT, chartData, chartIssues, flatten, layoutIssues, organize, pivot, validateOrganization,
  type ChartData, type ChartSpec, type Organization, type Organized, type ReportLayout, type Row,
} from "./report-analytics";
import type { SectorPack } from "./sector-packs";

export type StudioSpec = Readonly<{ organization: Organization | null; chart: ChartSpec | null; layout: ReportLayout; favorite?: boolean; fromPack?: string | null }>;
/** O modelo salvo guarda só escolhas: a especificação viaja junto da escolha (nunca dado). */
export type StudioChoice = BuilderChoice & Readonly<{ studio?: StudioSpec }>;

export const emptySpec = (title = ""): StudioSpec => ({ organization: null, chart: null, layout: { ...DEFAULT_LAYOUT, title } });
export const specOf = (c: BuilderChoice, title = ""): StudioSpec => (c as StudioChoice).studio ?? emptySpec(title);
export const withSpec = (c: BuilderChoice, s: StudioSpec): StudioChoice => ({ ...c, studio: s });

/** Abre um pacote como CÓPIA: personalizar nunca altera o pacote original. */
export function openPack(p: SectorPack): { choice: BuilderChoice; spec: StudioSpec } {
  if (p.blockedBy || !p.choice) throw new Error(`Pacote indisponível: ${p.blockedBy ?? "sem escolha"}`);
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  return { choice: clone(p.choice), spec: { organization: clone(p.organization ?? null), chart: clone(p.chart ?? null), layout: clone(p.layout ?? { ...DEFAULT_LAYOUT, title: p.title }), fromPack: p.id } };
}

export function packDescription(p: SectorPack, sourceTitle: string | null): string {
  if (p.blockedBy) return p.blockedBy;
  const g = p.organization?.groupBy.join(", ") || "sem agrupamento";
  return `${sourceTitle ?? p.sourceId}: agrupado por ${g}${p.chart ? `; gráfico ${p.chart.kind}` : ""}.`;
}

export const rowsAsRecords = (r: ReportResult): Row[] => r.rows.map((x) => Object.fromEntries(r.columns.map((c, i) => [c.id, x[i] ?? null])));

export type Analysis = Readonly<{
  organized: Organized | null; summary: { headers: string[]; rows: string[][] } | null;
  chart: ChartData | null; pivot: { headers: string[]; rows: string[][] } | null; issues: string[];
}>;

const fmt = (v: CellValue | number | undefined) => v === null || v === undefined ? ABSENT : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",")) : String(v);

export function analyze(result: ReportResult, spec: StudioSpec, sourceLabel: string): Analysis {
  const issues = [...layoutIssues(spec.layout, result.columns.length)];
  const o = spec.organization;
  if (!o || o.groupBy.length === 0) {
    if (spec.chart) issues.push("Gráfico exige agrupamento.");
    return { organized: null, summary: null, chart: null, pivot: null, issues };
  }
  for (const g of o.groupBy) if (!result.columns.some((c) => c.id === g)) issues.push(`Agrupamento fora das colunas escolhidas: ${g}.`);
  issues.push(...validateOrganization(result.columns, o));
  if (issues.some((i) => i.startsWith("Agrupamento") || i.includes("inexistente") || i.includes("sensível"))) return { organized: null, summary: null, chart: null, pivot: null, issues };
  const rows = rowsAsRecords(result);
  const org = organize(rows, o);
  const label = (id: string) => result.columns.find((c) => c.id === id)?.label ?? o.measures.find((m) => m.id === id)?.label ?? o.derived.find((d) => d.id === id)?.label ?? id;
  const valueIds = [...o.measures.map((m) => m.id), ...o.derived.map((d) => d.id)];
  const flat = flatten(org, o);
  const summary = {
    headers: ["Nível", ...o.groupBy.map(label), ...valueIds.map(label)],
    rows: flat.map((r) => [r._kind === "grupo" ? "Grupo" : r._kind === "subtotal" ? "Subtotal" : "Total geral", ...o.groupBy.map((g) => r._kind === "total" ? "" : g in r ? fmt(r[g]) : ""), ...valueIds.map((v) => fmt(r[v]))]),
  };
  let chart: ChartData | null = null;
  if (spec.chart) {
    const ci = chartIssues(spec.chart, o, org);
    if (ci.length) issues.push(...ci); else chart = chartData(spec.chart, o, org, sourceLabel);
  }
  let pv: Analysis["pivot"] = null;
  if (o.groupBy.length === 2 && o.measures[0]) {
    const p = pivot(rows, o.groupBy[0]!, o.groupBy[1]!, o.measures[0]);
    if ("refused" in p) issues.push(p.refused);
    else pv = { headers: [label(o.groupBy[0]!), ...p.columns.map((c) => fmt(c))], rows: p.rows.map((r) => [fmt(r.key), ...r.cells.map((c) => fmt(c))]) };
  }
  return { organized: org, summary, chart, pivot: pv, issues };
}

/* ---------- Gráfico em SVG (sem script; texto escapado) ---------- */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const PALETTE = ["#1f5f8b", "#d08c2b", "#3c8d5a", "#9c3d54", "#6b5b95", "#4a7f86", "#b5651d", "#5d6d7e"];

export function chartSvg(d: ChartData, w = 720, h = 340): string {
  const pad = { l: 150, r: 20, t: 34, b: 50 };
  const m = d.spec.measures;
  const vals = d.points.flatMap((p) => m.map((k) => p.values[k] ?? 0));
  const max = Math.max(1, ...vals);
  const title = `<text x="${w / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold">${esc(d.spec.title)}</text>`;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(d.spec.title)}" font-family="sans-serif">${title}`;
  if (d.points.length === 0) return `${open}<text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="12">Sem linhas visíveis: gráfico vazio (nenhum número inventado).</text></svg>`;
  const lbl = (v: CellValue) => esc(fmt(v).slice(0, 24));
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  let body = "";
  const k = d.spec.kind;
  if (k === "donut") {
    const total = d.points.reduce((s, p) => s + (p.values[m[0]!] ?? 0), 0) || 1;
    let a0 = -Math.PI / 2; const cx = 170, cy = h / 2 + 10, R = 110, r = 60;
    d.points.forEach((p, i) => {
      const v = p.values[m[0]!] ?? 0; const a1 = a0 + (v / total) * Math.PI * 2; const big = a1 - a0 > Math.PI ? 1 : 0;
      const P = (a: number, rr: number) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
      body += `<path d="M${P(a0, R)} A${R},${R} 0 ${big} 1 ${P(a1, R)} L${P(a1, r)} A${r},${r} 0 ${big} 0 ${P(a0, r)} Z" fill="${PALETTE[i % 8]}"/>`;
      body += `<rect x="320" y="${50 + i * 22}" width="12" height="12" fill="${PALETTE[i % 8]}"/><text x="338" y="${61 + i * 22}" font-size="11">${lbl(p.category)} — ${esc(fmt(p.values[m[0]!] ?? null))}</text>`;
      a0 = a1;
    });
  } else if (k === "barras-horizontais" || k === "ranking") {
    const n = d.points.length; const bh = Math.max(4, ph / n - 4);
    d.points.forEach((p, i) => {
      const v = p.values[m[0]!] ?? null; const y = pad.t + i * (ph / n);
      body += `<text x="${pad.l - 6}" y="${y + bh / 2 + 4}" text-anchor="end" font-size="10">${lbl(p.category)}</text>`;
      body += v === null ? `<text x="${pad.l + 4}" y="${y + bh / 2 + 4}" font-size="10">${ABSENT}</text>` : `<rect x="${pad.l}" y="${y}" width="${(v / max) * pw}" height="${bh}" fill="${PALETTE[0]}"/><text x="${pad.l + (v / max) * pw + 4}" y="${y + bh / 2 + 4}" font-size="10">${esc(fmt(v))}</text>`;
    });
  } else if (k === "linha" || k === "area" || k === "dispersao") {
    const n = d.points.length; const x = (i: number) => pad.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw); const y = (v: number) => pad.t + ph - (v / max) * ph;
    m.forEach((mid, j) => {
      const pts = d.points.map((p, i) => [i, p.values[mid] ?? null] as const).filter((q): q is readonly [number, number] => q[1] !== null);
      if (k === "dispersao") { pts.forEach(([i, v]) => { body += `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${PALETTE[j % 8]}"/>`; }); return; }
      const line = pts.map(([i, v]) => `${x(i)},${y(v)}`).join(" ");
      if (k === "area" && pts.length) body += `<polygon points="${x(pts[0]![0])},${pad.t + ph} ${line} ${x(pts[pts.length - 1]![0])},${pad.t + ph}" fill="${PALETTE[j % 8]}" opacity="0.3"/>`;
      body += `<polyline points="${line}" fill="none" stroke="${PALETTE[j % 8]}" stroke-width="2"/>`;
    });
    d.points.forEach((p, i) => { body += `<text x="${x(i)}" y="${h - pad.b + 16}" text-anchor="middle" font-size="9">${lbl(p.category)}</text>`; });
  } else {
    // barras / barras-empilhadas: agrupa por categoria; séries empilham.
    const cats = [...new Set(d.points.map((p) => fmt(p.category)))];
    const series = [...new Set(d.points.map((p) => fmt(p.series)))];
    const stacked = k === "barras-empilhadas";
    const totals = cats.map((c) => d.points.filter((p) => fmt(p.category) === c).reduce((s, p) => s + m.reduce((t, mm) => t + (p.values[mm] ?? 0), 0), 0));
    const top = stacked ? Math.max(1, ...totals) : max;
    const bw = pw / cats.length;
    cats.forEach((c, ci) => {
      const pts = d.points.filter((p) => fmt(p.category) === c);
      let acc = 0; const slots = stacked ? 1 : pts.length * m.length; let si = 0;
      pts.forEach((p) => m.forEach((mm, mi) => {
        const v = p.values[mm] ?? 0; const hh = (v / top) * ph; const color = PALETTE[(stacked ? series.indexOf(fmt(p.series)) : mi) % 8];
        const xx = pad.l + ci * bw + 4 + (stacked ? 0 : si * ((bw - 8) / slots)); const ww = stacked ? bw - 8 : (bw - 8) / slots;
        body += `<rect x="${xx}" y="${pad.t + ph - hh - (stacked ? acc : 0)}" width="${Math.max(1, ww - 1)}" height="${hh}" fill="${color}"/>`;
        acc += stacked ? hh : 0; si++;
      }));
      body += `<text x="${pad.l + ci * bw + bw / 2}" y="${h - pad.b + 14}" text-anchor="middle" font-size="9">${lbl(c)}</text>`;
    });
    if (stacked) series.forEach((s, i) => { body += `<rect x="${pad.l + i * 110}" y="${h - 18}" width="10" height="10" fill="${PALETTE[i % 8]}"/><text x="${pad.l + i * 110 + 14}" y="${h - 9}" font-size="10">${esc(s.slice(0, 14))}</text>`; });
  }
  return `${open}<line x1="${pad.l}" y1="${pad.t + ph}" x2="${w - pad.r}" y2="${pad.t + ph}" stroke="#555"/>${body}</svg>`;
}
export const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/* ---------- XLSX multi-aba ---------- */
export const XLSX_SHEETS = { report: "Relatório", filters: "Filtros", method: "Metodologia e fonte", chart: "Dados do gráfico", summary: "Resumo" } as const;
const xcell = (v: string | number) => (typeof v === "number" ? v : neutralize(v));
const numOrText = (s: string): string | number => (/^-?\d+(,\d+)?$/.test(s) ? Number(s.replace(",", ".")) : s);

export async function toStudioXlsx(result: ReportResult, spec: StudioSpec, meta: readonly string[], a: Analysis, methodology: readonly string[]): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const rep = wb.addWorksheet(XLSX_SHEETS.report);
  rep.addRow([neutralize(spec.layout.title || result.definitionId)]).font = { bold: true, size: 14 };
  rep.addRow(result.columns.map((c) => c.label)).font = { bold: true };
  for (const r of result.rows) rep.addRow(r.map((v) => (v === null ? ABSENT : xcell(v))));
  const fil = wb.addWorksheet(XLSX_SHEETS.filters);
  fil.addRow(["Item", "Valor"]).font = { bold: true };
  for (const m of meta) { const i = m.indexOf(":"); fil.addRow(i > 0 ? [neutralize(m.slice(0, i)), neutralize(m.slice(i + 1).trim())] : [neutralize(m), ""]); }
  const met = wb.addWorksheet(XLSX_SHEETS.method);
  for (const m of methodology) met.addRow([neutralize(m)]);
  met.addRow(["Ausência de dado aparece como \"não disponível\"; nunca é convertida em zero."]);
  if (a.summary) {
    const s = wb.addWorksheet(XLSX_SHEETS.summary);
    s.addRow(a.summary.headers.map(neutralize)).font = { bold: true };
    for (const r of a.summary.rows) s.addRow(r.map((x) => xcell(numOrText(x))));
    if (a.pivot) { s.addRow([]); s.addRow(["Tabela cruzada"]).font = { bold: true }; s.addRow(a.pivot.headers.map(neutralize)).font = { bold: true }; for (const r of a.pivot.rows) s.addRow(r.map((x) => xcell(numOrText(x)))); }
  }
  if (a.chart) {
    const c = wb.addWorksheet(XLSX_SHEETS.chart);
    c.addRow([neutralize(a.chart.spec.title)]).font = { bold: true };
    c.addRow(a.chart.table.headers.map(neutralize)).font = { bold: true };
    for (const r of a.chart.table.rows) c.addRow(r.map((x) => xcell(numOrText(x))));
    c.addRow([]); c.addRow([neutralize(a.chart.methodology)]); for (const n of a.chart.notes) c.addRow([neutralize(n)]);
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/* ---------- PDF (documento imprimível, sem AppShell) ---------- */
const table = (headers: readonly string[], rows: readonly (readonly string[])[], caption: string) =>
  `<table><caption>${esc(caption)}</caption><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("\n")}</tbody></table>`;

export function toStudioHtml(result: ReportResult, spec: StudioSpec, meta: readonly string[], a: Analysis, methodology: readonly string[]): string {
  const L = spec.layout;
  const size = `${L.paper} ${L.orientation === "paisagem" ? "landscape" : "portrait"}`;
  const pages = L.pageNumbers ? `@bottom-right{content:"Página " counter(page) " de " counter(pages);font:9px sans-serif}` : "";
  const foot = L.footer ? `@bottom-left{content:"${esc(L.footer).replace(/"/g, "'")}";font:9px sans-serif}` : "";
  const logo = L.logoUrl && /^https:\/\//.test(L.logoUrl) ? `<img src="${esc(L.logoUrl)}" alt="" style="height:48px">` : "";
  const head = `${logo}${L.headerLines.map((l) => `<div class="hl">${esc(l)}</div>`).join("")}`;
  const cover = L.cover ? `<section class="cover">${head}<h1>${esc(L.title)}</h1>${L.subtitle ? `<p>${esc(L.subtitle)}</p>` : ""}<p>Gerado em ${esc(result.generatedAt)}</p></section>` : "";
  const detail = table(result.columns.map((c) => c.label), result.rows.map((r) => r.map(cellText)), "Dados detalhados");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(L.title || result.definitionId)}</title>
<style>@page{size:${size};margin:14mm 12mm;${pages}${foot}}body{font-family:"DejaVu Sans",Arial,sans-serif;margin:0;color:#111;overflow-wrap:anywhere}h1{font-size:17px;margin:6px 0}h2{font-size:13px;margin:14px 0 6px}.hl{font-size:11px}.cover{page-break-after:always;text-align:center;padding-top:30%}table{border-collapse:collapse;width:100%;table-layout:fixed;margin-bottom:10px}caption{text-align:left;font-weight:bold;font-size:11px;padding:4px 0}thead{display:table-header-group}tr{page-break-inside:avoid}td,th{border:1px solid #999;padding:3px;font-size:10px;text-align:left;vertical-align:top}th{background:#eee}.chart{page-break-inside:avoid;max-width:100%}.chart img{max-width:100%;height:auto}.meta p,.met p{font-size:10px;margin:2px 0}.sig{display:flex;gap:24px;margin-top:40px;flex-wrap:wrap}.sig div{flex:1;min-width:150px;border-top:1px solid #000;text-align:center;font-size:10px;padding-top:4px}</style></head><body>
${cover}${L.cover ? "" : head}<h1>${esc(L.title || result.definitionId)}</h1>${!L.cover && L.subtitle ? `<p>${esc(L.subtitle)}</p>` : ""}
${L.showFilters ? `<section class="meta"><h2>Filtros e escopo</h2>${meta.map((m) => `<p>${esc(m)}</p>`).join("")}</section>` : ""}
${a.chart ? `<section class="chart"><h2>Gráfico</h2><img alt="${esc(a.chart.spec.title)}" src="${svgDataUri(chartSvg(a.chart))}">${table(a.chart.table.headers, a.chart.table.rows, "Tabela equivalente ao gráfico")}${a.chart.notes.map((n) => `<p>${esc(n)}</p>`).join("")}</section>` : ""}
${a.summary ? `<h2>Resumo</h2>${table(a.summary.headers, a.summary.rows, "Agrupamentos e cálculos")}` : ""}
${a.pivot ? table(a.pivot.headers, a.pivot.rows, "Tabela cruzada") : ""}
<h2>Dados</h2>${detail}
${L.showMethodology ? `<section class="met"><h2>Metodologia e fonte</h2>${methodology.map((m) => `<p>${esc(m)}</p>`).join("")}<p>Ausência de dado aparece como "${ABSENT}"; nunca é convertida em zero.</p></section>` : ""}
${L.observations ? `<h2>Observações</h2><p>${esc(L.observations)}</p>` : ""}
${L.signatures.length ? `<div class="sig">${L.signatures.map((s) => `<div>${esc(s)}</div>`).join("")}</div>` : ""}
<p style="font-size:9px">Gerado em ${esc(result.generatedAt)}. Relatório de trabalho; não é documento oficial.</p></body></html>`;
}
