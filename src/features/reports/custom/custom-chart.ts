/**
 * Gráfico do gerador personalizado: desenha só o resultado já devolvido pelo servidor (mesma consulta
 * da prévia e da exportação). Usa o mesmo motor SVG do estúdio (`chartSvg`), então prévia, PDF, PNG,
 * SVG e XLSX mostram o mesmo desenho. Linhas de subtotal/total e valores ausentes ficam fora (contados).
 */
import { ABSENT, cellText, neutralize, type ReportResult } from "../report-engine";
import { CHART_KINDS, type ChartData, type ChartKind } from "../report-analytics";
import { chartSvg } from "../report-studio";

export type CustomChart = { kind: ChartKind; category: string; measures: string[]; title: string; placement: "antes" | "depois" };
export const CHART_LABEL: Record<ChartKind, string> = {
  barras: "Barras", "barras-horizontais": "Barras horizontais", "barras-empilhadas": "Barras empilhadas", linha: "Linha",
  area: "Área", donut: "Rosca", dispersao: "Dispersão", ranking: "Ranking",
};
export const isChartKind = (k: unknown): k is ChartKind => (CHART_KINDS as readonly string[]).includes(String(k));

const isTotalRow = (r: readonly unknown[]) => r.some((v) => v === "SUBTOTAL" || v === "TOTAL GERAL");

/** Problemas por extenso; vazio = desenhável. */
export function chartProblems(r: Pick<ReportResult, "columns">, c: CustomChart): string[] {
  const e: string[] = [];
  if (!isChartKind(c.kind)) e.push("Tipo de gráfico desconhecido.");
  const cat = r.columns.find((x) => x.id === c.category);
  if (!cat) e.push("Escolha a coluna de categoria do gráfico.");
  else if (cat.kind === "number") e.push("A categoria do gráfico precisa ser texto (um grupo), não número.");
  if (!c.measures.length) e.push("Escolha ao menos uma medida numérica.");
  for (const m of c.measures) { const col = r.columns.find((x) => x.id === m); if (!col || col.kind !== "number") e.push(`Medida não numérica: ${col?.label ?? m}.`); }
  if (c.kind === "dispersao" && c.measures.length < 2) e.push("Dispersão exige 2 medidas.");
  if ((c.kind === "donut" || c.kind === "ranking") && c.measures.length !== 1) e.push("Rosca e ranking usam exatamente 1 medida.");
  return e;
}

export function customChartData(r: ReportResult, c: CustomChart): ChartData | { refused: string[] } {
  const p = chartProblems(r, c);
  if (p.length) return { refused: p };
  const ci = r.columns.findIndex((x) => x.id === c.category);
  const mi = c.measures.map((m) => r.columns.findIndex((x) => x.id === m));
  let excluded = 0, totals = 0;
  const points: ChartData["points"] = [];
  for (const row of r.rows) {
    if (isTotalRow(row)) { totals++; continue; }
    const values: Record<string, number | null> = {};
    let any = false;
    c.measures.forEach((m, k) => { const v = row[mi[k]!]; const n = typeof v === "number" && Number.isFinite(v) ? v : null; values[m] = n; if (n !== null) any = true; });
    if (!any) { excluded++; continue; }
    points.push({ category: row[ci] ?? null, series: null, values });
  }
  const notes: string[] = [];
  if (c.kind === "donut") {
    if (points.length > 8) return { refused: ["Rosca aceita no máximo 8 fatias; use barras ou filtre."] };
    if (points.some((pt) => (pt.values[c.measures[0]!] ?? 0) < 0)) return { refused: ["Rosca não representa valores negativos."] };
  }
  if (c.kind === "ranking") points.sort((a, b) => (b.values[c.measures[0]!] ?? -Infinity) - (a.values[c.measures[0]!] ?? -Infinity));
  if (points.length > 60) return { refused: [`São ${points.length} categorias; o gráfico aceita até 60. Filtre ou agrupe mais.`] };
  if (excluded) notes.push(`${excluded} categoria(s) sem valor ficaram fora do gráfico (não viraram zero).`);
  if (totals) notes.push(`${totals} linha(s) de subtotal/total não entram no gráfico.`);
  const label = (id: string) => r.columns.find((x) => x.id === id)?.label ?? id;
  return {
    spec: { kind: c.kind, category: c.category, measures: c.measures, title: c.title || `${c.measures.map(label).join(", ")} por ${label(c.category)}`, series: null },
    points,
    table: { headers: [label(c.category), ...c.measures.map(label)], rows: points.map((pt) => [cellText(pt.category), ...c.measures.map((m) => cellText(pt.values[m] ?? null))]) },
    methodology: `Desenhado a partir das ${points.length} linha(s) do resultado exportado; nenhuma conta nova.`,
    notes,
  };
}

/** Altura cresce com categorias nas barras horizontais para não sobrepor rótulos. */
export function customChartSvg(d: ChartData): string {
  const h = d.spec.kind === "barras-horizontais" || d.spec.kind === "ranking" ? Math.max(340, 60 + d.points.length * 16) : 360;
  return chartSvg(d, 760, h);
}

/** PNG a partir do mesmo SVG (só navegador). */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const m = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
  const w = Number(m?.[1] ?? 760), h = Number(m?.[2] ?? 360);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("Não foi possível desenhar o gráfico.")); img.src = url; });
    const cv = document.createElement("canvas"); cv.width = w * scale; cv.height = h * scale;
    const ctx = cv.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao gerar PNG."))), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

/** XLSX com abas: Relatório, Dados do gráfico (+imagem PNG), Identificação e verificação. */
export async function toCustomXlsx(
  r: ReportResult, brand: { headerLines: readonly string[]; title: string }, prov: readonly string[],
  chart: { data: ChartData; png: ArrayBuffer | null } | null, signatures: readonly string[],
): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Relatório");
  [...brand.headerLines, brand.title].forEach((l) => ws.addRow([neutralize(l)]));
  ws.addRow([]);
  ws.addRow(r.columns.map((c) => neutralize(c.label))).font = { bold: true };
  for (const row of r.rows) ws.addRow(row.map((v) => (v === null ? ABSENT : typeof v === "number" ? v : neutralize(v))));
  if (chart) {
    const c = wb.addWorksheet("Dados do gráfico");
    c.addRow([neutralize(chart.data.spec.title)]).font = { bold: true };
    c.addRow(chart.data.table.headers.map(neutralize)).font = { bold: true };
    for (const pt of chart.data.points) c.addRow([neutralize(cellText(pt.category)), ...chart.data.spec.measures.map((m) => pt.values[m] ?? ABSENT)]);
    c.addRow([]); c.addRow([neutralize(chart.data.methodology)]); for (const n of chart.data.notes) c.addRow([neutralize(n)]);
    if (chart.png) {
      const id = wb.addImage({ buffer: chart.png as never, extension: "png" });
      c.addImage(id, { tl: { col: chart.data.table.headers.length + 1, row: 1 }, ext: { width: 760, height: 360 } });
    }
  }
  const v = wb.addWorksheet("Identificação e verificação");
  v.addRow(["Item"]).font = { bold: true };
  for (const p of prov) v.addRow([neutralize(p)]);
  if (signatures.length) { v.addRow([]); v.addRow(["Assinaturas"]).font = { bold: true }; for (const s of signatures) v.addRow([neutralize(s), "______________________"]); }
  v.addRow(["A verificação pública pelo código não mostra dados pessoais."]);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
