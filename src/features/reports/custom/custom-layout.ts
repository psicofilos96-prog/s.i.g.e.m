/** Desenho de página do gerador personalizado: A4/A3, retrato/paisagem, margens, brasão, cabeçalho, rodapé, assinaturas, quebras. */
import { cellText, type ReportResult } from "../report-engine";
import { isAllowedLogo } from "../report-analytics";

export type CustomLayout = {
  paper: "A4" | "A3";
  orientation: "retrato" | "paisagem";
  marginMm: number;
  logoUrl: string | null;
  headerLines: string[];
  title: string;
  subtitle: string;
  footer: string;
  signatures: string[];
  pageNumbers: boolean;
  showProvenance: boolean;
  /** Quebra de página quando muda o valor da 1ª coluna (agrupamento). */
  breakOnFirstColumn: boolean;
  fontPt: number;
};
export const defaultLayout = (): CustomLayout => ({
  paper: "A4", orientation: "retrato", marginMm: 12, logoUrl: null,
  headerLines: ["PREFEITURA MUNICIPAL DE ITAPERUNA", "SECRETARIA MUNICIPAL DE EDUCAÇÃO"],
  title: "Relatório personalizado", subtitle: "", footer: "SIGEM — relatório de trabalho", signatures: [], pageNumbers: true,
  showProvenance: true, breakOnFirstColumn: false, fontPt: 9,
});
export function layoutProblems(l: CustomLayout, columns: number): string[] {
  const e: string[] = [];
  if (l.marginMm < 5 || l.marginMm > 30) e.push("Margem entre 5 e 30 mm.");
  if (l.fontPt < 6 || l.fontPt > 14) e.push("Fonte entre 6 e 14 pt.");
  if (l.logoUrl && !isAllowedLogo(l.logoUrl)) e.push("Logo só da identidade institucional ou endereço https.");
  if (l.signatures.length > 4) e.push("No máximo 4 assinaturas.");
  const cap = (l.paper === "A3" ? 2 : 1) * (l.orientation === "paisagem" ? 14 : 9);
  if (columns > cap) e.push(`Mais de ${cap} colunas não cabem em ${l.paper} ${l.orientation}; use paisagem ou A3.`);
  return e;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderCustomHtml(r: ReportResult, l: CustomLayout, provenance: readonly string[], verification = ""): string {
  const size = `${l.paper} ${l.orientation === "paisagem" ? "landscape" : "portrait"}`;
  const pages = l.pageNumbers ? `@bottom-right{content:"Página " counter(page) " de " counter(pages);font:8pt sans-serif}` : "";
  const foot = l.footer ? `@bottom-left{content:"${esc(l.footer).replace(/"/g, "'")}";font:8pt sans-serif}` : "";
  const logo = l.logoUrl && isAllowedLogo(l.logoUrl) ? `<img src="${esc(l.logoUrl)}" alt="" class="logo">` : "";
  const head = `<header>${logo}<div>${l.headerLines.map((x) => `<div class="hl">${esc(x)}</div>`).join("")}</div></header>`;
  const thead = `<thead><tr>${r.columns.map((c) => `<th${c.kind === "number" ? ' class="n"' : ""}>${esc(c.label)}</th>`).join("")}</tr></thead>`;
  const chunks: (readonly (string | number | null)[])[][] = [];
  for (const row of r.rows) {
    const last = chunks[chunks.length - 1];
    if (!last || (l.breakOnFirstColumn && last[0] && last[0][0] !== row[0] && String(row[0] ?? "") !== "SUBTOTAL" && String(row[0] ?? "") !== "")) chunks.push([row]);
    else last.push(row);
  }
  if (!chunks.length) chunks.push([]);
  const tables = chunks.map((rows, i) => `<table${i ? ' class="brk"' : ""}>${thead}<tbody>${rows.map((row) => {
    const total = /^(SUBTOTAL|TOTAL GERAL)$/.test(String(row.find((x) => x === "SUBTOTAL" || x === "TOTAL GERAL") ?? ""));
    return `<tr${total ? ' class="tot"' : ""}>${row.map((v, k) => `<td${r.columns[k]?.kind === "number" ? ' class="n"' : ""}>${esc(cellText(v))}</td>`).join("")}</tr>`;
  }).join("")}${rows.length ? "" : `<tr><td colspan="${r.columns.length}">Nenhuma linha com os filtros escolhidos.</td></tr>`}</tbody></table>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(l.title)}</title><style>
@page{size:${size};margin:${l.marginMm}mm;${pages}${foot}}
body{font-family:"DejaVu Sans",Arial,sans-serif;font-size:${l.fontPt}pt;color:#111;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
header{display:flex;gap:10px;align-items:center;border-bottom:0.75pt solid #222;padding-bottom:6px;margin-bottom:8px}.logo{height:52px;object-fit:contain}.hl{font-size:${l.fontPt + 1}pt;font-weight:600}
h1{font-size:${l.fontPt + 6}pt;margin:6px 0 2px}.sub{margin:0 0 6px}.prov p{margin:1px 0;font-size:${Math.max(6, l.fontPt - 1)}pt;color:#333}
table{border-collapse:separate;border-spacing:0;width:100%;table-layout:auto;border-top:0.75pt solid #222;border-left:0.75pt solid #222;margin-top:6px}
thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th{background:#e8e8e8}
td,th{border-right:0.75pt solid #222;border-bottom:0.75pt solid #222;padding:2.5pt 4pt;text-align:left;vertical-align:top;overflow-wrap:anywhere}.n{text-align:right}
tr.tot td{font-weight:700;background:#f2f2f2}.brk{break-before:page;page-break-before:always}
.sig{display:flex;gap:24px;margin-top:36px;flex-wrap:wrap;break-inside:avoid}.sig div{flex:1;min-width:140px;border-top:0.75pt solid #000;text-align:center;padding-top:3px}
</style></head><body>${head}<h1>${esc(l.title)}</h1>${l.subtitle ? `<p class="sub">${esc(l.subtitle)}</p>` : ""}
${l.showProvenance ? `<section class="prov">${provenance.map((p) => `<p>${esc(p)}</p>`).join("")}</section>` : ""}
${tables}
${l.signatures.length ? `<div class="sig">${l.signatures.map((s) => `<div>${esc(s)}</div>`).join("")}</div>` : ""}
${verification}
<p style="font-size:7pt;margin-top:8px">Gerado em ${esc(new Date(r.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))}. Relatório de trabalho; não é documento oficial.</p></body></html>`;
}
