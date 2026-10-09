/**
 * NREL.2 — Gerador transversal: Assunto → Filtros → Colunas → Prévia → Exportar.
 * Cada assunto é um adaptador fechado (`BuilderSource`) que lê pelo reader canônico com a sessão
 * de quem consulta (RLS/capability do dado de origem). Não existe SQL nem fonte livre: o gerador só
 * escolhe colunas/filtros DECLARADOS e passa pelo motor comum (`runReport`).
 */
import { runReport, type CellValue, type ColumnDef, type ReportDefinition, type ReportRequest, type ReportResult } from "./report-engine";

export type Sector = "secretaria" | "ciece" | "avaliacao" | "op-direcao" | "dp" | "nae" | "supervisao" | "admin";
export const SECTOR_LABEL: Record<Sector, string> = {
  secretaria: "Secretaria", ciece: "CIECE", avaliacao: "Avaliação", "op-direcao": "OP / Direção", dp: "DP", nae: "NAE (Alimentação)", supervisao: "Supervisão", admin: "Administração",
};

export type Page = Readonly<{ rows: readonly Record<string, CellValue>[]; total: number | null }>;
export type LoadCtx = Readonly<{ from: string | null; to: string | null; offset: number; limit: number }>;

export type BuilderSource = Readonly<{
  id: string;
  title: string;
  sectors: readonly Sector[];
  definition: ReportDefinition; // colunas, versão e fonte documental
  methodology: string;
  acl: string;
  period: boolean; // aceita período de/até
  pageSize: number;
  /** Colunas em que o filtro "igual a" é permitido. */
  filterable: readonly string[];
  /** Assunto existe no catálogo mas o dado ainda não: recusa por extenso. */
  unavailable?: string | null;
  load?: (ctx: LoadCtx) => Promise<Page>;
  /** Pós-processamento após TODAS as páginas (ex.: versão mais recente por escola). */
  finalize?: (rows: readonly Record<string, CellValue>[]) => Record<string, CellValue>[];
  /** Coluna que chega como id de escola e é traduzida para o nome visível à conta. */
  schoolIdColumn?: string;
}>;

export const HARD_ROW_CAP = 50_000;

export type Collected = Readonly<{ rows: Record<string, CellValue>[]; pages: number; total: number | null; truncated: boolean }>;

/** Percorre todas as páginas do reader. Para no fim real, nunca em "parece suficiente". */
export async function collectAll(src: BuilderSource, from: string | null, to: string | null, cap = HARD_ROW_CAP): Promise<Collected> {
  if (src.unavailable || !src.load) throw new Error(src.unavailable ?? "Assunto sem leitura disponível.");
  const rows: Record<string, CellValue>[] = [];
  let pages = 0; let total: number | null = null;
  for (;;) {
    const p = await src.load({ from, to, offset: rows.length, limit: src.pageSize });
    pages++; total = p.total ?? total;
    rows.push(...p.rows);
    if (rows.length >= cap) return { rows: rows.slice(0, cap), pages, total, truncated: true };
    if (p.rows.length < src.pageSize || (total !== null && rows.length >= total)) break;
  }
  return { rows: src.finalize ? src.finalize(rows) : rows, pages, total, truncated: false };
}

export type BuilderChoice = Readonly<{
  sourceId: string;
  from: string | null; to: string | null;
  columns: readonly string[];
  filters: readonly { column: string; equals: CellValue }[];
  sort: readonly { column: string; dir: "asc" | "desc" }[];
}>;

export function validateChoice(src: BuilderSource, c: BuilderChoice): string[] {
  const known = new Set(src.definition.columns.map((x) => x.id));
  const errs: string[] = [];
  if (c.sourceId !== src.id) errs.push("Modelo de outro assunto.");
  if (c.columns.length === 0) errs.push("Escolha ao menos uma coluna.");
  for (const id of c.columns) if (!known.has(id)) errs.push(`Coluna não prevista: ${id}.`);
  for (const f of c.filters) if (!src.filterable.includes(f.column)) errs.push(`Filtro não permitido: ${f.column}.`);
  for (const s of c.sort) if (!known.has(s.column)) errs.push(`Ordenação não prevista: ${s.column}.`);
  if (src.period && c.from && c.to && c.from > c.to) errs.push("O início do período é depois do fim.");
  return errs;
}

export function buildResult(src: BuilderSource, c: BuilderChoice, rows: readonly Record<string, CellValue>[], now = new Date()): ReportResult {
  const params: Record<string, unknown> = {};
  for (const p of src.definition.params) {
    if (p.id === "from" && c.from) params[p.id] = c.from;
    else if (p.id === "to" && c.to) params[p.id] = c.to;
  }
  const req: ReportRequest = { params, columns: c.columns, filters: c.filters, sort: c.sort };
  return runReport(src.definition, req, rows, now);
}

/** Linhas de proveniência gravadas no arquivo: fonte, período, metodologia, acesso, completude. */
export function provenance(src: BuilderSource, c: BuilderChoice, col: Collected, sectorLabel: string): string[] {
  const period = !src.period ? "não se aplica" : c.from || c.to ? `${c.from ?? "início"} a ${c.to ?? "hoje"}` : "todo o período disponível";
  return [
    `Assunto: ${src.title} (definição ${src.definition.id} v${src.definition.version})`,
    `Fonte: ${src.definition.source}`,
    `Período: ${period}`,
    `Metodologia: ${src.methodology}`,
    `Acesso: ${src.acl}`,
    `Setor do modelo: ${sectorLabel}`,
    `Filtros: ${c.filters.length ? c.filters.map((f) => `${f.column} = ${f.equals ?? "não disponível"}`).join("; ") : "nenhum"}`,
    `Linhas lidas: ${col.rows.length} em ${col.pages} página(s)${col.truncated ? ` — INCOMPLETO: limite de ${HARD_ROW_CAP} linhas atingido` : ""}`,
  ];
}

export const previewSlice = (r: ReportResult, n = 20) => r.rows.slice(0, n);

// ---------- modelos salvos por setor (só a escolha; nunca dado) ----------
export type SavedTemplate = Readonly<{ name: string; sector: Sector; choice: BuilderChoice; savedAt: string }>;
export type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void };

const key = (account: string, sector: Sector) => `sigem.report-templates.v1.${account}.${sector}`;

export function loadTemplates(kv: KV, account: string, sector: Sector, sources: readonly BuilderSource[]): SavedTemplate[] {
  let raw: unknown;
  try { raw = JSON.parse(kv.getItem(key(account, sector)) ?? "[]"); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is SavedTemplate => {
    const src = sources.find((s) => s.id === (t as SavedTemplate)?.choice?.sourceId);
    return !!src && (t as SavedTemplate).sector === sector && src.sectors.includes(sector) && validateChoice(src, (t as SavedTemplate).choice).length === 0;
  });
}

export function saveTemplate(kv: KV, account: string, t: SavedTemplate, sources: readonly BuilderSource[]): SavedTemplate[] {
  const src = sources.find((s) => s.id === t.choice.sourceId);
  if (!src || !src.sectors.includes(t.sector)) throw new Error("Este assunto não pertence ao setor escolhido.");
  const errs = validateChoice(src, t.choice);
  if (errs.length) throw new Error(errs.join(" "));
  const name = t.name.trim().slice(0, 80);
  if (!name) throw new Error("Dê um nome ao modelo.");
  const list = loadTemplates(kv, account, t.sector, sources).filter((x) => x.name !== name);
  const next = [...list, { ...t, name }];
  kv.setItem(key(account, t.sector), JSON.stringify(next));
  return next;
}

export const columnsOf = (src: BuilderSource): readonly ColumnDef[] => src.definition.columns.filter((c) => !c.sensitive);
