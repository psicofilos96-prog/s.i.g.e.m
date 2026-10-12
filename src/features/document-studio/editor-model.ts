/**
 * SIGEM Documentos L03 — operações puras do editor institucional sobre o Studio.
 * Reutiliza blocos/estilos fechados do `studio-engine` (nada de HTML livre):
 * tipografia só de FONTS/COLOR_TOKENS e tamanho 6–40, tabela só com colunas
 * cujo campo está no catálogo, campo dinâmico só por token do catálogo,
 * cabeçalho/rodapé como texto escapado. Paginação é ESTIMATIVA declarada (o
 * navegador decide a quebra final); exportação usa o MESMO `renderStudio` da
 * prévia, então prévia e PDF não divergem.
 */
import { COLOR_TOKENS, FONTS, TOKEN_CATALOG, type PageSetup, type StudioBlock, type TextStyle } from "./studio-engine";

const known = new Set(TOKEN_CATALOG.map((t) => t.key));
export class EditorError extends Error {}

export function setStyle(blocks: readonly StudioBlock[], i: number, patch: TextStyle): StudioBlock[] {
  if (patch.font && !FONTS.includes(patch.font)) throw new EditorError("fonte não permitida");
  if (patch.color && !COLOR_TOKENS.includes(patch.color)) throw new EditorError("cor fora dos tokens");
  if (patch.size !== undefined && (patch.size < 6 || patch.size > 40)) throw new EditorError("tamanho fora de 6–40");
  return blocks.map((b, k) => (k !== i ? b : b.type === "title" || b.type === "rich" || b.type === "header" ? { ...b, style: { ...b.style, ...patch } } : b));
}

export function insertField(blocks: readonly StudioBlock[], at: number, label: string, fact: string): StudioBlock[] {
  if (!known.has(fact)) throw new EditorError(`campo fora do catálogo: ${fact}`);
  if (!label.trim() || /[<>]/.test(label)) throw new EditorError("rótulo inválido");
  const n = [...blocks]; n.splice(at, 0, { type: "field", label: label.trim(), fact }); return n;
}

export function insertTable(blocks: readonly StudioBlock[], at: number, rowsFact: string, columns: { label: string; fact: string }[]): StudioBlock[] {
  if (!columns.length || columns.length > 8) throw new EditorError("tabela com 1 a 8 colunas");
  if (columns.some((c) => !c.label.trim() || /[<>]/.test(c.label) || !/^[a-z0-9_.-]+$/.test(c.fact))) throw new EditorError("coluna inválida");
  if (!known.has(rowsFact)) throw new EditorError(`lista fora do catálogo: ${rowsFact}`);
  const n = [...blocks]; n.splice(at, 0, { type: "table", rowsFact, columns }); return n;
}

/** Insere {{token}} no texto do bloco; só token do catálogo. */
export function insertToken(blocks: readonly StudioBlock[], i: number, token: string): StudioBlock[] {
  if (!known.has(token)) throw new EditorError(`campo fora do catálogo: ${token}`);
  const tag = `{{${token}}}`;
  return blocks.map((b, k) => k !== i ? b : b.type === "title" ? { ...b, text: `${b.text} ${tag}` } : b.type === "rich" ? { ...b, runs: [...b.runs, { text: ` ${tag}` }] } : b.type === "header" ? { ...b, lines: [...b.lines, tag] } : b);
}

export function setHeaderLines(blocks: readonly StudioBlock[], lines: string[]): StudioBlock[] {
  if (lines.some((l) => /[<>]/.test(l))) throw new EditorError("cabeçalho sem marcação");
  const i = blocks.findIndex((b) => b.type === "header");
  const h: StudioBlock = { type: "header", lines: lines.filter((l) => l.trim()) };
  return i < 0 ? [h, ...blocks] : blocks.map((b, k) => (k === i && b.type === "header" ? { ...b, lines: h.lines } : b));
}

export function setFooter(page: PageSetup, footer: string | null, pageNumbers: boolean): PageSetup {
  if (footer && (/[<>]/.test(footer) || footer.length > 200)) throw new EditorError("rodapé até 200 caracteres, sem marcação");
  return { ...page, footerText: footer?.trim() || null, pageNumbers };
}

/* ---------- Paginação estimada (A4) ---------- */
const PT_TO_MM = 0.3528;
export function printableHeightMm(p: PageSetup) { return (p.orientation === "paisagem" ? 210 : 297) - p.marginsMm.top - p.marginsMm.bottom; }
function blockHeightMm(b: StudioBlock, p: PageSetup, widthMm: number): number {
  const line = p.baseSize * 1.45 * PT_TO_MM;
  const charsPerLine = Math.max(20, Math.floor(widthMm / (p.baseSize * 0.5 * PT_TO_MM)));
  const lines = (s: string) => Math.max(1, Math.ceil(s.length / charsPerLine));
  switch (b.type) {
    case "header": return b.lines.length * line + 8;
    case "title": return lines(b.text) * line * 1.4 + 7;
    case "rich": return lines(b.runs.map((r) => r.text).join("")) * line + 3;
    case "field": case "date-place": case "document-number": return line + 2;
    case "list": return b.items.reduce((a, t) => a + lines(t) * line, 0) + 3;
    case "table": return line * 3; // cabeçalho + linha mínima; linhas reais dependem dos dados
    case "box": return b.children.reduce((a, c) => a + blockHeightMm(c, p, widthMm - 6), 6);
    case "columns": return Math.max(...b.columns.map((c) => c.reduce((a, x) => a + blockHeightMm(x, p, widthMm / b.columns.length), 0)), 0);
    case "signature": return 18; case "qr": return 34; case "image": return 40; case "line": return 3;
    case "page-break": return 0;
  }
}
/** Estimativa de páginas sem dados; quebra explícita sempre abre página nova. */
export function estimatePages(blocks: readonly StudioBlock[], p: PageSetup): { pages: number; estimated: true } {
  const h = printableHeightMm(p); const w = (p.orientation === "paisagem" ? 297 : 210) - p.marginsMm.left - p.marginsMm.right;
  let pages = 1, used = 0;
  for (const b of blocks) {
    if (b.type === "page-break") { pages++; used = 0; continue; }
    const bh = blockHeightMm(b, p, w);
    if (used + bh > h && used > 0) { pages += Math.floor((used + bh) / h); used = (used + bh) % h; } else used += bh;
  }
  return { pages, estimated: true };
}

/* ---------- Rascunho local e recuperação ---------- */
export interface LocalDraft { schema: "sigem.studio-draft.v1"; accountId: string; templateId: string; baseVersion: number; savedAt: string; title: string; blocks: StudioBlock[]; page: PageSetup }
export const draftKey = (accountId: string, templateId: string) => `sigem.studio-draft:${accountId}:${templateId}`;

export function serializeDraft(d: LocalDraft): string {
  if (JSON.stringify(d.blocks).match(/"facts"|"cpf"|"nome_estudante"/)) throw new EditorError("rascunho local não guarda dados de pessoas");
  return JSON.stringify(d);
}
/** Recupera só rascunho da mesma conta e modelo; base mudou ⇒ "desatualizado" (nunca sobrescreve a versão gravada). */
export function recoverDraft(raw: string | null, accountId: string, templateId: string, currentBase: number): { status: "nenhum" | "invalido" | "outra-conta" | "desatualizado" | "recuperavel"; draft: LocalDraft | null } {
  if (!raw) return { status: "nenhum", draft: null };
  let d: LocalDraft; try { d = JSON.parse(raw) as LocalDraft; } catch { return { status: "invalido", draft: null }; }
  if (d.schema !== "sigem.studio-draft.v1" || !Array.isArray(d.blocks)) return { status: "invalido", draft: null };
  if (d.accountId !== accountId || d.templateId !== templateId) return { status: "outra-conta", draft: null };
  return { status: d.baseVersion === currentBase ? "recuperavel" : "desatualizado", draft: d };
}
