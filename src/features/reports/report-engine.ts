/**
 * Motor comum de relatórios (puro). Um relatório é DEFINIÇÃO versionada sobre um read model
 * canônico já autorizado: parâmetros tipados, colunas declaradas, filtros/ordenação/agrupamento
 * apenas sobre colunas declaradas. Não há SQL editável: a fonte é uma função registrada que
 * recebe as linhas que o reader do usuário JÁ devolveu — o motor nunca amplia permissão.
 * Ausência (null) nunca vira zero em nenhum formato.
 */

export type ParamType = "date" | "datetime" | "integer" | "text" | "enum";
export type ParamDef = Readonly<{ id: string; label: string; type: ParamType; required: boolean; min?: number; max?: number; options?: readonly string[]; maxLength?: number }>;
export type CellValue = string | number | null;
export type ColumnDef = Readonly<{ id: string; label: string; kind: "text" | "number" | "date"; sensitive?: boolean }>;
export type Branding = Readonly<{ headerLines: readonly string[]; title: string; logoUrl?: string | null }>;
export type ReportFormat = "csv" | "xlsx" | "pdf";

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
/** PDF = documento HTML imprimível, com escape total (sem HTML do usuário). */
/** Bordas vetoriais em pt (≥0,75pt, preto, separate+spacing 0): linhas de 1px cinza com collapse somem ao reduzir o zoom do PDF. */
export const PRINT_BORDER = "0.75pt solid #222";
export const PRINT_TABLE_CSS = `@page{size:A4;margin:14mm 12mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:9px serif}}body{font-family:serif;margin:0;overflow-wrap:anywhere;-webkit-print-color-adjust:exact;print-color-adjust:exact}h1{font-size:16px}table{border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;border-top:${PRINT_BORDER};border-left:${PRINT_BORDER}}thead{display:table-header-group}tr{page-break-inside:avoid;break-inside:avoid}td,th{border-right:${PRINT_BORDER};border-bottom:${PRINT_BORDER};padding:4px;font-size:11px;text-align:left;vertical-align:top;overflow-wrap:anywhere}`;
export function toPrintableHtml(result: ReportResult, branding: Branding, meta: readonly string[] = [], fingerprint?: string): string {
  const logo = branding.logoUrl && /^https:\/\//.test(branding.logoUrl) ? `<img src="${html(branding.logoUrl)}" alt="" style="height:48px">` : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${html(branding.title)}</title>
<style>${PRINT_TABLE_CSS}</style></head><body>
${logo}${branding.headerLines.map((l) => `<div>${html(l)}</div>`).join("")}<h1>${html(branding.title)}</h1>
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
