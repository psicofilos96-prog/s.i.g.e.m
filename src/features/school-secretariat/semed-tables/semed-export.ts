/**
 * TSEMED.1 — documento da Tabela SEMED: blocos puros (cabeçalho institucional fixo do guia,
 * seções, totais derivados, assinaturas) consumidos pelo PDF A4 e pelo XLSX. O XLSX é SAÍDA,
 * nunca base: valores vêm dos eventos gravados e do cadastro central.
 */
import { neutralize } from "@/features/reports/report-engine";
import { distortion } from "./t04-distortion";
import { colTotal, pct, rowTotal, t06Final, type TableDef, type Values } from "./semed-catalog";
import { T06_COLS, T06_GAP, type T06Totals } from "./t06-movement";

export type Central = Partial<Record<string, string | number | null>>;
export type Block = { title: string; head: string[]; body: (string | number)[][] };
const ABS = "—";
const show = (v: unknown): string | number => (v === null || v === undefined || v === "" ? ABS : (v as string | number));

export const HEADER_LINES = ["PREFEITURA MUNICIPAL DE ITAPERUNA", "SECRETARIA MUNICIPAL DE EDUCAÇÃO", "NÚCLEO DE INFORMAÇÃO E ESTATÍSTICA"];

export type T06Apur = { rule_version: number | null; totals: T06Totals; gaps: string[] };
export function documentBlocks(def: TableDef, v: Values, central: Central, t04Thresholds: Readonly<Record<string, number>> | null = null, t06: T06Apur | null = null): Block[] {
  const out: Block[] = [];
  for (const s of def.sections) {
    if (s.kind === "fields") {
      out.push({ title: s.title, head: ["Campo", "Resposta"], body: s.fields.map((f) => [f.label + (f.central ? " (cadastro central)" : ""), show(f.central ? central[f.central] : v[`${s.id}.${f.key}`])]) });
      continue;
    }
    const is06 = def.code === "06", is11 = def.code === "11";
    const head = [def.code === "10" ? "Nº" : "Ano/etapa", ...s.cols.map((c) => c.label)];
    if (s.rowTotal) head.push("TOTAL");
    if (is06) head.push("% Receb.", "% Transf.", "% Canc.", "% Evasão", "Matr. final", "% Aprov.", "% Reprov.");
    if (is11) head.push("Matrícula inicial");
    const body = s.rows.map((r) => {
      const g = (c: string) => v[`${s.id}.${r.key}.${c}`];
      const row: (string | number)[] = [(r.group && def.code === "04" ? `${r.group} · ` : "") + r.label, ...s.cols.map((c) => show(g(c.key)))];
      if (s.rowTotal) row.push(show(rowTotal(v, s.id, r.key, s.cols)));
      if (is06) {
        const n = (c: string) => (typeof g(c) === "number" ? (g(c) as number) : null);
        const fin = t06Final(v, r.key), ini = n("inicial");
        row.push(show(pct(n("recebidos"), ini)), show(pct(n("transferencia"), ini)), show(pct(n("cancelamento"), ini)), show(pct(n("evasao"), ini)), show(fin), show(pct(n("aprovados"), fin)), show(pct(n("reprovados"), fin)));
      }
      if (is11) { const m = g("masc"), f = g("fem"); row.push(show(typeof m === "number" && typeof f === "number" ? m + f : null)); }
      return row;
    });
    if (s.colTotal) {
      const tot: (string | number)[] = ["TOTAL", ...s.cols.map((c) => show(colTotal(v, s.id, c.key, s.rows)))];
      if (s.rowTotal) { const all = s.cols.map((c) => colTotal(v, s.id, c.key, s.rows)).filter((x): x is number => x !== null); tot.push(show(all.length ? all.reduce((a, b) => a + b, 0) : null)); }
      if (is06) tot.push("", "", "", "", "", "", "");
      if (is11) { const m = colTotal(v, s.id, "masc", s.rows), f = colTotal(v, s.id, "fem", s.rows); tot.push(show(m !== null && f !== null ? m + f : null)); }
      body.push(tot);
    }
    out.push({ title: s.title, head, body });
    if (def.code === "04") out.push({ title: "DISTORÇÃO SÉRIE x IDADE (alunos a partir da idade de distorção da regra registrada)", head: ["Ano/etapa", "Idade de distorção", "Total", "Em distorção", "%"],
      body: distortion(v, t04Thresholds).map((d) => [d.label, show(d.threshold), show(d.total), show(d.distorted), d.pct === null ? (d.threshold === null ? "sem regra" : ABS) : `${String(d.pct).replace(".", ",")}%`]) });
    if (is06 && t06) {
      out.push({ title: `APURAÇÃO POR EVENTOS REAIS (regra ${t06.rule_version ? `v${t06.rule_version}` : "não registrada"}) — total da escola`, head: ["Coluna", "Total informado", "Apurado", "Situação"],
        body: [...T06_COLS, "final" as const].map((c) => {
          const typed = c === "final" ? null : colTotal(v, s.id, c, s.rows); const ap = t06.totals[c];
          return [s.cols.find((x) => x.key === c)?.label ?? "Matrícula final", show(typed), show(ap), typeof ap !== "number" ? "não apurado" : c === "final" || (typed ?? 0) === ap ? "confere" : "DIVERGENTE"];
        }) });
      if (t06.gaps.length) out.push({ title: "LACUNAS DA APURAÇÃO", head: ["Lacuna"], body: t06.gaps.map((g) => [T06_GAP[g] ?? g]) });
    }
  }
  return out;
}

export type DocMeta = { year: number; tableCode: string; title: string; school: string; inep: string; state: string; version: number; generatedAt: Date };
const metaLines = (m: DocMeta) => [`ESCOLA: ${m.school}    CÓDIGO INEP: ${m.inep || ABS}`, `Situação: ${m.state} · catálogo v${m.version} · gerado em ${m.generatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, "“—” = não informado (nunca zero presumido)."];

export async function semedPdf(def: TableDef, blocks: Block[], m: DocMeta): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: def.landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 10;
  let y = M + 2;
  doc.setFont("times", "bold"); doc.setFontSize(10);
  for (const l of HEADER_LINES) { doc.text(l, M, y); y += 4.5; }
  doc.text(`TABELA ${m.tableCode}`, W - M, M + 2, { align: "right" });
  doc.setFontSize(11);
  for (const l of doc.splitTextToSize(`${m.title} — ${m.year}`, W - 2 * M) as string[]) { doc.text(l, W / 2, y + 2, { align: "center" }); y += 5.5; }
  doc.setFont("times", "normal"); doc.setFontSize(8.5);
  for (const l of metaLines(m)) { doc.text(l, M, y + 1); y += 4; }
  const font = def.code === "04" ? 5.6 : def.code === "10" ? 6.5 : 8;
  for (const b of blocks) {
    const startY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 4;
    autoTable(doc, {
      startY, margin: { left: M, right: M, bottom: 14 }, theme: "grid",
      head: [[{ content: b.title, colSpan: b.head.length, styles: { halign: "left", fillColor: [220, 220, 220] } }], b.head], body: b.body.map((r) => r.map(String)),
      styles: { font: "times", fontSize: font, cellPadding: 0.8, overflow: "linebreak", lineColor: [34, 34, 34], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" }, showHead: "everyPage", rowPageBreak: "avoid",
    });
  }
  const dist = blocks.find((b) => b.title.startsWith("DISTORÇÃO"));
  if (dist) {
    const bars = dist.body.filter((r) => typeof r[4] === "string" && /%$/.test(String(r[4])));
    let gy = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
    if (gy + 10 + bars.length * 5 > H - 14) { doc.addPage(); gy = M + 6; }
    doc.setFont("times", "bold"); doc.setFontSize(9); doc.text(`GRÁFICO DISTORÇÃO SÉRIE x IDADE - ${m.year}`, M, gy); doc.setFont("times", "normal");
    if (!bars.length) { doc.setFontSize(8); doc.text("Sem indicador calculável (regra ou valores ausentes).", M, gy + 5); }
    bars.forEach((r, i) => {
      const p = Number(String(r[4]).replace("%", "").replace(",", ".")), by = gy + 4 + i * 5, bw = (W - 2 * M - 70) * p / 100;
      doc.setFontSize(7.5); doc.text(String(r[0]), M, by + 3); doc.setDrawColor(34); doc.rect(M + 40, by, W - 2 * M - 70, 3.5); doc.setFillColor(60, 60, 60); if (bw > 0) doc.rect(M + 40, by, bw, 3.5, "F"); doc.text(String(r[4]), W - M - 26, by + 3);
    });
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable = { finalY: gy + 6 + bars.length * 5 };
  }
  let sy = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 20;
  if (sy + 12 > H - 14) { doc.addPage(); sy = M + 24; }
  const colW = (W - 2 * M) / 2;
  ["Responsável pelo Estabelecimento", "Responsável pelo Preenchimento"].forEach((s, i) => {
    const x = M + i * colW; doc.line(x + 8, sy, x + colW - 8, sy); doc.setFontSize(9); doc.text(s, x + colW / 2, sy + 4.5, { align: "center" });
  });
  doc.text("ITAPERUNA, ____/____/________", W / 2, sy + 12, { align: "center" });
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setFontSize(7.5); doc.text(`Tabela ${m.tableCode} · ${m.school}`, M, H - 6); doc.text(`Página ${p} de ${n}`, W - M, H - 6, { align: "right" }); }
  return doc.output("blob");
}

export async function semedXlsx(blocks: Block[], m: DocMeta): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(`Tabela ${m.tableCode}`);
  for (const l of [...HEADER_LINES, `${m.title} — ${m.year}`, ...metaLines(m)]) ws.addRow([neutralize(l)]);
  for (const b of blocks) {
    ws.addRow([]); ws.addRow([neutralize(b.title)]).font = { bold: true };
    ws.addRow(b.head.map(neutralize)).font = { bold: true };
    for (const r of b.body) ws.addRow(r.map((x) => (typeof x === "number" ? x : neutralize(x))));
  }
  ws.addRow([]); ws.addRow(["Responsável pelo Estabelecimento", "", "Responsável pelo Preenchimento"]);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
