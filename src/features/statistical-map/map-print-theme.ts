/**
 * Tema único de impressão do Mapa Estatístico (A4 paisagem). Capa, cabeçalho corrido, faixas de seção,
 * rodapé "Página X de Y" e assinaturas manuais vêm só daqui, para o Mapa calculado e o declarado não divergirem.
 * Só aparência: nunca recebe nem altera números.
 */
export type MapDocumentModel = "premium" | "administrativo";
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const P = { navy: "#0f2a52", mid: "#1f5fa8", light: "#e8f0fa", gray: "#f5f7fa", line: "#c9d6e8", gold: "#b8932f", ink: "#14213d" };

export type ThemeInput = { model?: MapDocumentModel | undefined; cover?: boolean | undefined; emblemUrl?: string | null | undefined; headerLines: readonly string[]; schoolName: string; competence: string; signatures: number };

export function mapTheme(t: ThemeInput) {
  const premium = (t.model ?? "premium") === "premium"; const cover = premium && t.cover !== false;
  const COMP = t.competence.toUpperCase();
  const emblem = t.emblemUrl && /^https:\/\//.test(t.emblemUrl) ? `<img class="emb" src="${esc(t.emblemUrl)}" alt="Brasão">` : "";
  const foot = `${t.schoolName} · ${t.competence} · SIGEM`.replace(/["\\]/g, "'");
  const css = `@page{size:A4 landscape;margin:12mm 12mm 14mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:7.5pt sans-serif;color:#556}@bottom-left{content:"${foot}";font:7.5pt sans-serif;color:#556}}
${cover ? "@page :first{margin:0;@bottom-left{content:none}@bottom-right{content:none}}" : ""}
*{box-sizing:border-box}body{font:${premium ? "9pt/1.4" : "8.5pt/1.3"} "Source Sans 3","Inter",Arial,sans-serif;color:${P.ink};margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.cover{width:297mm;height:210mm;position:relative;overflow:hidden;break-after:page;background:linear-gradient(160deg,${P.light} 0%,#fff 45%,${P.light} 100%);padding:16mm 18mm}
.cv-emb .emb{height:22mm}.cv-org{position:absolute;top:16mm;left:${emblem ? "46mm" : "18mm"}}.cv-org p{margin:0;font-weight:700;color:${P.navy};font-size:10pt;text-transform:uppercase}
.cv-mid{position:absolute;top:62mm;left:0;right:0;text-align:center}.cv-mid h1{font-size:40pt;letter-spacing:.02em;color:${P.navy};margin:0}.cv-sub{font-size:16pt;color:${P.mid};margin:2mm 0 8mm}
.cv-school{font-size:15pt;font-weight:700;margin:0 0 5mm}.cv-comp{display:inline-block;background:${P.mid};color:#fff;font-size:15pt;padding:2mm 12mm;border-radius:6mm;margin:0}
.cv-wave{position:absolute;left:-10%;right:-10%;bottom:-28mm;height:62mm;border-radius:50% 50% 0 0;background:linear-gradient(90deg,${P.navy},${P.mid});border-top:1.2mm solid ${P.gold}}
.cv-foot{position:absolute;bottom:9mm;right:18mm;margin:0;color:#fff;font-size:9pt;letter-spacing:.06em;text-transform:uppercase}
.rh{display:flex;align-items:center;gap:4mm;border-bottom:${premium ? `0.6mm solid ${P.mid}` : "0.3mm solid #888"};padding-bottom:2mm;margin-bottom:4mm}.rh .emb{height:11mm}
.rh-l p{margin:0;font-size:7.5pt;font-weight:700;text-transform:uppercase;color:${P.navy}}.rh-r{margin-left:auto;text-align:right;color:${P.mid}}.rh-r strong{display:block;font-size:10pt;color:${P.navy}}.rh-r span{font-size:8.5pt}
dl{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5mm 6mm;margin:0 0 4mm;font-size:8.5pt;background:${premium ? P.gray : "transparent"};border:0.2mm solid ${P.line};border-radius:${premium ? "2mm" : "0"};padding:2.5mm 4mm}
dt{font-weight:700;display:inline;color:${P.navy}}dd{display:inline;margin:0}
h2{font-size:11.5pt;margin:5mm 0 2mm;break-after:avoid}h2 span{display:block;${premium ? `background:linear-gradient(90deg,${P.navy},${P.mid});color:#fff;padding:1.6mm 4mm;border-radius:1.5mm;border-left:1.2mm solid ${P.gold}` : `border-bottom:0.3mm solid #666;padding-bottom:1mm`}}
h3{font-size:9.5pt;margin:3mm 0 1.5mm;color:${P.navy};break-after:avoid;text-transform:uppercase}
section{break-inside:auto}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.5pt;margin-bottom:2mm}
thead{display:table-header-group}th,td{border:0.2mm solid ${P.line};padding:1.4mm 2.2mm;vertical-align:top;overflow-wrap:anywhere}th{background:${premium ? P.light : "#eee"};color:${P.navy};text-align:left;font-weight:700}
tbody tr:nth-child(even)>td{background:${premium ? "#fafcff" : "transparent"}}td.n,th.n{text-align:right;width:22%}th:last-child,td:last-child{width:24%}tr{break-inside:avoid}
table.grid td.n,table.grid th.n{width:auto;text-align:center}table.grid th:last-child,table.grid td:last-child{width:auto}tr.sub>td{font-weight:700;background:${premium ? P.light : "#f2f2f2"}!important}
table.sub{margin-top:1mm;font-size:8pt}table.sub td{border:0;border-top:0.15mm dotted ${P.line};padding:.6mm 1mm;background:transparent!important}table.sub td.n{width:30%}
.empty{font-style:italic;color:#556}.obs{border:0.2mm solid ${P.line};border-radius:1.5mm;padding:2.5mm 4mm;min-height:14mm}.note{font-size:7.5pt;color:#556;margin:1mm 0 2mm}
.final{break-inside:avoid}.sig{display:grid;grid-template-columns:repeat(${Math.max(1, Math.min(3, t.signatures))},1fr);gap:12mm;margin-top:16mm}.sig div{border-top:0.3mm solid ${P.ink};text-align:center;padding-top:1.5mm;font-size:8.5pt}
.date{margin-top:8mm;font-size:8.5pt}footer{margin-top:5mm;font-size:7.5pt;color:#556}`;
  const orgLines = t.headerLines.map((l) => `<p>${esc(l)}</p>`).join("");
  const coverHtml = cover ? `<div class="cover">${emblem ? `<div class="cv-emb">${emblem}</div>` : ""}<div class="cv-org">${orgLines}</div>
<div class="cv-mid"><h1>MAPA ESTATÍSTICO</h1><p class="cv-sub">DA UNIDADE ESCOLAR</p><p class="cv-school">${esc(t.schoolName)}</p><p class="cv-comp">${esc(COMP)}</p></div>
<div class="cv-wave"></div><p class="cv-foot">Sistema Integrado de Gestão Educacional Municipal</p></div>` : "";
  const runHead = `<div class="rh">${emblem}<div class="rh-l">${orgLines}</div><div class="rh-r"><strong>MAPA ESTATÍSTICO</strong><span>${esc(COMP)}</span></div></div>`;
  const h2 = (title: string) => `<h2><span>${esc(title.toUpperCase())}</span></h2>`;
  const signatures = (names: readonly string[]) => `<p class="date">Data de entrega: ____/____/________</p><div class="sig">${names.map((x) => `<div>${esc(x)}</div>`).join("")}</div>`;
  return { css, coverHtml, runHead, h2, signatures };
}
