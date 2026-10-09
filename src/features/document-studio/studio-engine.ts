/**
 * DOCS.PRO.1 — Studio de documentos (motor puro).
 * Modelo = dados declarativos (blocos + página). Nada de HTML/JS: todo texto é
 * escapado na renderização; estilos vêm de listas fechadas; tokens só do
 * catálogo de fatos devolvidos pelos readers autorizados. Nenhum template
 * executa SQL; fato ausente aparece como ausente, nunca como zero.
 */
export type Align = "left" | "center" | "right" | "justify";
export type Weight = "normal" | "bold";
export const FONTS = ["Source Serif 4", "IBM Plex Sans", "Times New Roman", "Arial"] as const;
export type Font = (typeof FONTS)[number];
export const COLOR_TOKENS = ["texto", "mudo", "primaria", "alerta"] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

export type TextStyle = { font?: Font; size?: number; weight?: Weight; italic?: boolean; align?: Align; color?: ColorToken; spacingAfter?: number };
/** Texto rico limitado: segmentos com negrito/itálico; tokens {{chave}}. */
export type RichRun = { text: string; bold?: boolean; italic?: boolean };
export type Condition = { fact: string; present: boolean };

export type StudioBlock =
  | { type: "header"; lines: string[]; logoAsset?: string | null; style?: TextStyle; when?: Condition }
  | { type: "image"; asset: string; width: number; align?: Align; opacity?: number; alt: string; when?: Condition }
  | { type: "title"; text: string; style?: TextStyle; when?: Condition }
  | { type: "rich"; runs: RichRun[]; style?: TextStyle; when?: Condition }
  | { type: "field"; label: string; fact: string; when?: Condition }
  | { type: "list"; ordered: boolean; items: string[]; when?: Condition }
  | { type: "table"; columns: { label: string; fact: string }[]; rowsFact: string; when?: Condition }
  | { type: "box"; title?: string; children: StudioBlock[]; border?: boolean; background?: "nenhum" | "suave"; when?: Condition }
  | { type: "columns"; columns: StudioBlock[][]; when?: Condition }
  | { type: "line"; when?: Condition }
  | { type: "qr"; label: string; when?: Condition }
  | { type: "signature"; label: string; role?: string; when?: Condition }
  | { type: "date-place"; place: string; when?: Condition }
  | { type: "document-number"; when?: Condition }
  | { type: "page-break" };

export type PageSetup = {
  size: "A4"; orientation: "retrato" | "paisagem";
  marginsMm: { top: number; right: number; bottom: number; left: number };
  baseFont: Font; baseSize: number;
  repeatHeader: boolean; footerText: string | null; pageNumbers: boolean;
  watermark: string | null;
};
export const DEFAULT_PAGE: PageSetup = {
  size: "A4", orientation: "retrato", marginsMm: { top: 20, right: 18, bottom: 20, left: 18 },
  baseFont: "Source Serif 4", baseSize: 11, repeatHeader: true, footerText: null, pageNumbers: true, watermark: null,
};

export type TemplateState = "rascunho" | "em-revisao" | "homologado" | "substituido" | "arquivado";
export const STATE_LABEL: Record<TemplateState, string> = {
  rascunho: "Rascunho", "em-revisao": "Em revisão", homologado: "Homologado", substituido: "Substituído", arquivado: "Arquivado",
};
export type LifecycleEvent = { versionId: string; kind: "enviar-revisao" | "devolver" | "homologar" | "arquivar"; at: string; actor: string };

/** Estado é projeção dos eventos (nunca campo editável). Homologar a sucessora substitui a anterior. */
export function projectStates(versions: { id: string; supersedes: string | null }[], events: readonly LifecycleEvent[]): Record<string, TemplateState> {
  const out: Record<string, TemplateState> = {};
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  for (const v of versions) out[v.id] = "rascunho";
  for (const e of sorted) {
    const cur = out[e.versionId]; if (!cur) continue;
    if (cur === "arquivado" || cur === "substituido") continue;
    if (e.kind === "enviar-revisao" && cur === "rascunho") out[e.versionId] = "em-revisao";
    else if (e.kind === "devolver" && cur === "em-revisao") out[e.versionId] = "rascunho";
    else if (e.kind === "homologar" && cur === "em-revisao") {
      out[e.versionId] = "homologado";
      let prev = versions.find((v) => v.id === e.versionId)?.supersedes ?? null;
      while (prev) { if (out[prev] === "homologado") out[prev] = "substituido"; prev = versions.find((v) => v.id === prev)?.supersedes ?? null; }
    } else if (e.kind === "arquivar") out[e.versionId] = "arquivado";
  }
  return out;
}

/** Sem homologação ninguém auto-aprova: autor da versão não pode homologá-la. */
export function canTransition(state: TemplateState, kind: LifecycleEvent["kind"], actorIsAuthor: boolean): boolean {
  if (kind === "homologar") return state === "em-revisao" && !actorIsAuthor;
  if (kind === "enviar-revisao") return state === "rascunho";
  if (kind === "devolver") return state === "em-revisao";
  return state !== "arquivado";
}

/* ---------- Tokens canônicos ---------- */
export type TokenInfo = { key: string; label: string; reader: string | null; sensitive?: boolean };
/** Tokens que o reader autorizado (`school_document_facts`) devolve hoje. */
export const TOKEN_CATALOG: readonly TokenInfo[] = [
  { key: "aluno.nome", label: "Nome do aluno", reader: "school_document_facts" },
  { key: "aluno.identificador", label: "Identificador do aluno", reader: "school_document_facts" },
  { key: "escola.nome", label: "Nome da escola", reader: "school_document_facts" },
  { key: "ano_letivo.nome", label: "Ano letivo", reader: "school_document_facts" },
  { key: "matricula.numero", label: "Número da matrícula", reader: "school_document_facts" },
  { key: "matricula.abertura", label: "Data da matrícula", reader: "school_document_facts" },
  { key: "turma.rotulo", label: "Turma", reader: "school_document_facts" },
  { key: "turma.desde", label: "Na turma desde", reader: "school_document_facts" },
  { key: "documento.data_de_referencia", label: "Data de referência", reader: "school_document_facts" },
  { key: "documento.numero", label: "Número do documento", reader: "emissão" },
  { key: "documento.codigo_verificacao", label: "Código de verificação", reader: "emissão" },
  // Sem reader autorizado: listados para o editor, bloqueiam a emissão.
  { key: "responsavel.nome", label: "Responsável legal", reader: null, sensitive: true },
  { key: "profissional.nome", label: "Profissional", reader: null },
  { key: "ato.referencia", label: "Ato institucional", reader: null },
  { key: "historico.anos", label: "Vida escolar (anos)", reader: null },
  { key: "transferencia.destino", label: "Escola de destino", reader: null },
];
const TOKEN = /\{\{\s*([a-z0-9_.-]+)\s*\}\}/gi;

export type ValidationIssue = { path: string; code: string };
const allowedSize = (n: unknown) => typeof n === "number" && n >= 6 && n <= 40;

/** Validação estrutural: tipos fechados, tokens do catálogo, sem marcação. */
export function validateTemplate(blocks: readonly StudioBlock[], page: PageSetup): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const known = new Set(TOKEN_CATALOG.map((t) => t.key));
  const checkText = (s: string, path: string) => {
    if (/[<>]/.test(s)) issues.push({ path, code: "markup-forbidden" });
    for (const m of s.matchAll(TOKEN)) if (!known.has(m[1]!)) issues.push({ path, code: `token-unknown:${m[1]}` });
  };
  const checkStyle = (st: TextStyle | undefined, path: string) => {
    if (!st) return;
    if (st.font && !FONTS.includes(st.font)) issues.push({ path, code: "font-not-allowed" });
    if (st.size !== undefined && !allowedSize(st.size)) issues.push({ path, code: "size-out-of-range" });
    if (st.color && !COLOR_TOKENS.includes(st.color)) issues.push({ path, code: "color-not-token" });
  };
  const walk = (bs: readonly StudioBlock[], base: string) => bs.forEach((b, i) => {
    const p = `${base}[${i}]`;
    if (b.type !== "page-break" && b.when && !known.has(b.when.fact)) issues.push({ path: p, code: `token-unknown:${b.when.fact}` });
    switch (b.type) {
      case "header": b.lines.forEach((l, j) => checkText(l, `${p}.lines[${j}]`)); checkStyle(b.style, p); break;
      case "title": checkText(b.text, p); checkStyle(b.style, p); break;
      case "rich": b.runs.forEach((r, j) => checkText(r.text, `${p}.runs[${j}]`)); checkStyle(b.style, p); break;
      case "field": if (!known.has(b.fact)) issues.push({ path: p, code: `token-unknown:${b.fact}` }); checkText(b.label, p); break;
      case "list": b.items.forEach((t, j) => checkText(t, `${p}.items[${j}]`)); break;
      case "table": b.columns.forEach((c) => checkText(c.label, p)); break;
      case "box": walk(b.children, `${p}.children`); break;
      case "columns": if (b.columns.length < 1 || b.columns.length > 3) issues.push({ path: p, code: "columns-1-to-3" }); b.columns.forEach((c, j) => walk(c, `${p}.columns[${j}]`)); break;
      case "image":
        if (!/^(asset:|https:\/\/)/.test(b.asset)) issues.push({ path: p, code: "image-source-not-allowed" });
        if (b.opacity !== undefined && (b.opacity < 0.05 || b.opacity > 1)) issues.push({ path: p, code: "opacity-out-of-range" });
        if (!b.alt.trim()) issues.push({ path: p, code: "image-alt-required" }); break;
      case "signature": checkText(b.label, p); break;
      case "date-place": checkText(b.place, p); break;
      default: break;
    }
  });
  walk(blocks, "blocks");
  const m = page.marginsMm;
  if ([m.top, m.right, m.bottom, m.left].some((x) => x < 5 || x > 50)) issues.push({ path: "page.margins", code: "margin-out-of-range" });
  if (!allowedSize(page.baseSize)) issues.push({ path: "page.baseSize", code: "size-out-of-range" });
  if (page.footerText) checkText(page.footerText, "page.footer");
  return issues;
}

/** Tokens usados que não têm reader autorizado ⇒ emissão recusada (fail-closed). */
export function unresolvableTokens(blocks: readonly StudioBlock[]): string[] {
  const noReader = new Set(TOKEN_CATALOG.filter((t) => !t.reader).map((t) => t.key));
  const json = JSON.stringify(blocks);
  const found = new Set<string>();
  for (const m of json.matchAll(TOKEN)) if (noReader.has(m[1]!)) found.add(m[1]!);
  for (const m of json.matchAll(/"(?:fact|rowsFact)":"([a-z0-9_.-]+)"/g)) if (noReader.has(m[1]!)) found.add(m[1]!);
  return [...found].sort();
}

/* ---------- Renderização (HTML imprimível, sempre escapado) ---------- */
export type Facts = Readonly<Record<string, string | number | null | undefined | ReadonlyArray<Record<string, string | number | null>>>>;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const isPresent = (v: unknown) => (typeof v === "string" && v.trim() !== "") || (typeof v === "number" && Number.isFinite(v)) || (Array.isArray(v) && v.length > 0);
const fill = (s: string, f: Facts, missing: Set<string>) => esc(s).replace(TOKEN, (_, k: string) => {
  const v = f[k]; if (isPresent(v) && !Array.isArray(v)) return esc(String(v));
  missing.add(k); return `<span class="ausente">[${esc(k)}: sem registro]</span>`;
});
const COLOR_CSS: Record<ColorToken, string> = { texto: "#14213d", mudo: "#5b6475", primaria: "#1d4f91", alerta: "#9a3412" };
const css = (st?: TextStyle) => !st ? "" : ` style="${[
  st.font && `font-family:'${st.font}'`, st.size && `font-size:${st.size}pt`, st.weight === "bold" && "font-weight:700",
  st.italic && "font-style:italic", st.align && `text-align:${st.align}`, st.color && `color:${COLOR_CSS[st.color]}`,
  st.spacingAfter !== undefined && `margin-bottom:${st.spacingAfter}pt`].filter(Boolean).join(";")}"`;

/** Rodapé vai à margem da página (@page), nunca sobre o conteúdo; texto puro escapado para CSS. */
const cssString = (t: string) => t.replace(/[\\'"\n\r<>]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `);
const footerPlain = (s: string, f: Facts, missing: Set<string>) => s.replace(TOKEN, (_, k: string) => {
  const v = f[k]; if (isPresent(v) && !Array.isArray(v)) return String(v); missing.add(k); return `[${k}: sem registro]`;
});

export type RenderOutput = { html: string; missing: string[]; pageBreaks: number };

export function renderStudio(a: { title: string; blocks: readonly StudioBlock[]; page: PageSetup; facts: Facts; draftLabel: string | null; assets?: Record<string, string>; qrImage?: string | null }): RenderOutput {
  const missing = new Set<string>(); let breaks = 0;
  const src = (asset: string) => asset.startsWith("asset:") ? a.assets?.[asset.slice(6)] ?? "" : asset;
  const one = (b: StudioBlock): string => {
    if (b.type !== "page-break" && b.when && isPresent(a.facts[b.when.fact]) !== b.when.present) return "";
    switch (b.type) {
      case "header": return `<header class="inst"${css(b.style)}>${b.logoAsset ? `<img class="logo" src="${esc(src(b.logoAsset))}" alt="Brasão">` : ""}<div>${b.lines.map((l) => `<div>${fill(l, a.facts, missing)}</div>`).join("")}</div></header>`;
      case "image": return `<figure style="text-align:${b.align ?? "center"}"><img src="${esc(src(b.asset))}" alt="${esc(b.alt)}" style="width:${Math.min(Math.max(b.width, 5), 100)}%;opacity:${b.opacity ?? 1}"></figure>`;
      case "title": return `<h1${css(b.style)}>${fill(b.text, a.facts, missing)}</h1>`;
      case "rich": return `<p${css(b.style)}>${b.runs.map((r) => { let t = fill(r.text, a.facts, missing); if (r.bold) t = `<strong>${t}</strong>`; if (r.italic) t = `<em>${t}</em>`; return t; }).join("")}</p>`;
      case "field": { const v = a.facts[b.fact]; const ok = isPresent(v) && !Array.isArray(v); if (!ok) missing.add(b.fact);
        return `<div class="field"><span class="lbl">${esc(b.label)}:</span> ${ok ? esc(String(v)) : `<span class="ausente">sem registro</span>`}</div>`; }
      case "list": { const t = b.ordered ? "ol" : "ul"; return `<${t}>${b.items.map((i) => `<li>${fill(i, a.facts, missing)}</li>`).join("")}</${t}>`; }
      case "table": { const rows = a.facts[b.rowsFact]; if (!Array.isArray(rows)) missing.add(b.rowsFact);
        const body = Array.isArray(rows) && rows.length ? rows.map((r) => `<tr>${b.columns.map((c) => { const v = r[c.fact]; return `<td>${v === null || v === undefined || v === "" ? '<span class="ausente">—sem registro</span>' : esc(String(v))}</td>`; }).join("")}</tr>`).join("")
          : `<tr><td colspan="${b.columns.length}" class="ausente">Sem registros</td></tr>`;
        return `<table><thead><tr>${b.columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`; }
      case "box": return `<section class="box${b.border === false ? "" : " bordered"}${b.background === "suave" ? " soft" : ""}">${b.title ? `<h2>${esc(b.title)}</h2>` : ""}${b.children.map(one).join("")}</section>`;
      case "columns": return `<div class="cols" style="grid-template-columns:repeat(${b.columns.length},1fr)">${b.columns.map((c) => `<div>${c.map(one).join("")}</div>`).join("")}</div>`;
      case "line": return `<hr>`;
      case "qr": { const code = a.facts["documento.codigo_verificacao"]; if (!isPresent(code)) missing.add("documento.codigo_verificacao");
        const img = a.qrImage && /^data:image\/(gif|png);base64,[A-Za-z0-9+/=]+$/.test(a.qrImage) ? `<img class="qrimg" src="${a.qrImage}" alt="QR de verificação" width="96" height="96">` : "";
        return `<div class="qr">${img}<div class="qrbox" aria-label="${esc(b.label)}">${isPresent(code) ? esc(String(code)) : "sem código"}</div><small>${esc(b.label)}</small></div>`; }
      case "signature": return `<div class="sig"><div class="sigline"></div><div>${fill(b.label, a.facts, missing)}</div>${b.role ? `<small>${esc(b.role)}</small>` : ""}</div>`;
      case "date-place": { const d = a.facts["documento.data_de_referencia"]; if (!isPresent(d)) missing.add("documento.data_de_referencia");
        return `<p class="dateplace">${esc(b.place)}, ${isPresent(d) ? esc(String(d)) : '<span class="ausente">[data: sem registro]</span>'}.</p>`; }
      case "document-number": { const n = a.facts["documento.numero"]; if (!isPresent(n)) missing.add("documento.numero");
        return `<p class="docnum">Documento nº ${isPresent(n) ? esc(String(n)) : '<span class="ausente">(atribuído na emissão)</span>'}</p>`; }
      case "page-break": breaks++; return `<div class="pb"></div>`;
    }
  };
  const p = a.page; const m = p.marginsMm;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(a.title)}</title><style>
@page{size:A4 ${p.orientation === "paisagem" ? "landscape" : "portrait"};margin:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;${p.pageNumbers ? "@bottom-right{content:'Página ' counter(page) ' de ' counter(pages)}" : ""}${p.footerText ? `@bottom-center{content:'${cssString(footerPlain(p.footerText, a.facts, missing))}';font-size:8pt;color:#5b6475}` : ""}}
body{font-family:'${p.baseFont}',serif;font-size:${p.baseSize}pt;color:#14213d;line-height:1.45}
h1{font-size:15pt;text-align:center;margin:10pt 0}.inst{display:flex;gap:10pt;align-items:center;border-bottom:1px solid #1d4f91;padding-bottom:6pt;margin-bottom:8pt}.logo{height:48pt}
table{width:100%;border-collapse:collapse;page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid}th,td{border:1px solid #9aa3b2;padding:3pt 5pt;text-align:left}
.box.bordered{border:1px solid #9aa3b2;padding:6pt;margin:6pt 0}.box.soft{background:#f3f5f8}.cols{display:grid;gap:10pt}
.dateplace{break-after:avoid}.sig+.sig,.sig+.qr{break-before:avoid}.sig{margin-top:28pt;text-align:center;page-break-inside:avoid}.sigline{border-top:1px solid #14213d;width:60%;margin:0 auto 3pt}
.qr{display:inline-block;text-align:center}.qrbox{border:1px solid #14213d;padding:6pt;font-family:monospace}
.ausente{color:#9a3412;font-style:italic}.pb{page-break-after:always}.draft{border:2px solid #9a3412;color:#9a3412;padding:4pt;text-align:center;font-weight:700;margin-bottom:8pt}
${p.watermark ? `body::before{content:'${esc(p.watermark)}';position:fixed;top:45%;left:10%;font-size:48pt;opacity:.08;transform:rotate(-30deg)}` : ""}
</style></head><body>${a.draftLabel ? `<div class="draft" role="note">${esc(a.draftLabel)}</div>` : ""}${a.blocks.map(one).join("")}</body></html>`;
  return { html, missing: [...missing].sort(), pageBreaks: breaks };
}

/* ---------- Emissão: congelamento ---------- */
export type FrozenEmission = {
  schema: "sigem.studio-emission.v1"; templateId: string; versionId: string; versionNo: number; state: TemplateState;
  blocks: StudioBlock[]; page: PageSetup; facts: Record<string, unknown>; issuedAt: string; actor: string; sha256: string;
};
async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const stable = (v: unknown): string => Array.isArray(v) ? `[${v.map(stable).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}` : JSON.stringify(v);

/** Congela versão exata + dados; só modelo homologado emite oficial; token sem reader recusa. */
export async function freezeEmission(a: { templateId: string; versionId: string; versionNo: number; state: TemplateState; blocks: StudioBlock[]; page: PageSetup; facts: Facts; issuedAt: string; actor: string }): Promise<FrozenEmission> {
  if (a.state !== "homologado") throw new Error("document:template-not-homologated");
  const bad = unresolvableTokens(a.blocks); if (bad.length) throw new Error(`document:token-without-reader:${bad.join(",")}`);
  const body = { schema: "sigem.studio-emission.v1" as const, templateId: a.templateId, versionId: a.versionId, versionNo: a.versionNo, state: a.state,
    blocks: structuredClone(a.blocks), page: structuredClone(a.page), facts: structuredClone({ ...a.facts }) as Record<string, unknown>, issuedAt: a.issuedAt, actor: a.actor };
  return { ...body, sha256: await sha256(stable(body)) };
}
export async function verifyFrozen(e: FrozenEmission): Promise<boolean> {
  const { sha256: h, ...body } = e; return (await sha256(stable(body))) === h;
}
