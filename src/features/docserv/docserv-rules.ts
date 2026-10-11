/** DocServ LOTES 06–13 — regras puras: política vigente, sugestão por leitura de PDF, temporadas e importação em dry-run. */
import type { CellValue, ReportDefinition } from "@/features/reports/report-engine";

export type TypeRule = { obrigatorio: boolean; validade_meses: number | null; aviso_dias: number | null; retencao_dias: number | null };
export type Policy = { version: number; status: "rascunho" | "aprovada"; origin: string; rules: Record<string, TypeRule>; reason: string };
export type PolicyState = { approved: Policy | null; latest: Policy | null };

/** Só política aprovada produz efeito; a legada (rascunho) nunca torna documento obrigatório. */
export function effectiveRule(p: PolicyState | null, type: string): (TypeRule & { source: "aprovada" }) | null {
  const r = p?.approved?.rules?.[type];
  return r ? { ...r, source: "aprovada" } : null;
}
export const requirementLabel = (p: PolicyState | null, type: string) => {
  const r = effectiveRule(p, type);
  if (!r) return "sem política aprovada";
  return r.obrigatorio ? "obrigatório (política aprovada)" : "opcional (política aprovada)";
};
export const noticeDays = (p: PolicyState | null, type: string, fallback = 30) => effectiveRule(p, type)?.aviso_dias ?? fallback;

/** Validade sugerida pela política: emissão + meses, só quando a política aprovada declarar. */
export function suggestedValidUntil(p: PolicyState | null, type: string, issued: string | null): string | null {
  const m = effectiveRule(p, type)?.validade_meses;
  if (!m || !issued || !/^\d{4}-\d{2}-\d{2}$/.test(issued)) return null;
  const d = new Date(`${issued}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + m);
  return d.toISOString().slice(0, 10);
}

// ---------- 07: leitura assistida (sugestão; nunca decide) ----------
export type Extraction = { issued: string | null; validUntil: string | null; issuer: string | null; dates: string[]; confidence: "nenhuma" | "parcial" | "alta" };
const toIso = (d: string, m: string, y: string) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
const MONTHS: Record<string, string> = { janeiro: "01", fevereiro: "02", marco: "03", março: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };

export function suggestFromText(text: string): Extraction {
  const t = text.replace(/\s+/g, " ");
  const dates: { iso: string; at: number }[] = [];
  for (const m of t.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g)) {
    const [d, mo, y] = [m[1]!, m[2]!, m[3]!];
    if (+mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31) dates.push({ iso: toIso(d, mo, y), at: m.index ?? 0 });
  }
  for (const m of t.matchAll(/\b(\d{1,2}) de ([a-zç]+) de (\d{4})\b/gi)) {
    const mo = MONTHS[m[2]!.toLowerCase()]; if (mo) dates.push({ iso: toIso(m[1]!, mo, m[3]!), at: m.index ?? 0 });
  }
  const near = (re: RegExp) => {
    const k = t.search(re); if (k < 0) return null;
    const after = dates.filter((d) => d.at >= k && d.at - k < 120).sort((a, b) => a.at - b.at)[0];
    return after?.iso ?? null;
  };
  const validUntil = near(/v[áa]lid[ao] at[ée]|validade|v[áa]lida por/i);
  const issued = near(/emitid[ao] em|data d[ae] emiss[ãa]o|expedid[ao] em|emiss[ãa]o:/i);
  const im = t.match(/(tribunal de justi[çc]a[^.,;]{0,40}|pol[íi]cia (civil|federal)[^.,;]{0,30}|secretaria de (estado da )?seguran[çc]a[^.,;]{0,30})/i);
  const issuer = im ? im[0].trim().slice(0, 80) : null;
  const found = [issued, validUntil, issuer].filter(Boolean).length;
  return { issued, validUntil, issuer, dates: [...new Set(dates.map((d) => d.iso))].slice(0, 10), confidence: found === 0 ? "nenhuma" : found === 3 ? "alta" : "parcial" };
}

/** O que vai ao banco: a sugestão e o que a pessoa decidiu (aceitou/corrigiu), nunca a decisão automática. */
export function extractionRecord(s: Extraction | null, chosen: { issued: string | null; validUntil: string | null; issuer: string | null }) {
  if (!s) return null;
  return { sugerido: { emissao: s.issued, validade: s.validUntil, emissor: s.issuer }, confianca: s.confidence,
    aceito: { emissao: s.issued !== null && s.issued === chosen.issued, validade: s.validUntil !== null && s.validUntil === chosen.validUntil, emissor: s.issuer !== null && s.issuer === chosen.issuer } };
}

// ---------- 09: temporadas ----------
export type Season = { year: string; cycle: 1 | 2 | 3; seq: number; opens_on: string; closes_on: string; status: "aberta" | "encerrada"; reason: string };
export function openCycles(seasons: Season[], year: string, today: string): number[] {
  return seasons.filter((s) => s.year === year && s.status === "aberta" && s.opens_on <= today && today <= s.closes_on).map((s) => s.cycle).sort();
}
/** Sem temporada cadastrada para o ano, o envio é livre (não há regra); com temporada, só ciclo aberto. */
export function submissionWindow(seasons: Season[], year: string, today: string): { allowed: boolean; cycles: number[]; reason: string } {
  const any = seasons.some((s) => s.year === year);
  if (!any) return { allowed: true, cycles: [], reason: "Sem temporada cadastrada para o ano." };
  const c = openCycles(seasons, year, today);
  return c.length ? { allowed: true, cycles: c, reason: `Ciclo(s) aberto(s): ${c.join(", ")}.` } : { allowed: false, cycles: [], reason: "Nenhum ciclo aberto para envio neste ano." };
}

// ---------- 13: importação histórica em dry-run ----------
export type ImportRow = { line: number; kind: "servidor" | "escola"; matricula: string | null; cpf: string | null; inep: string | null; problem: string | null };
const SECRET_COLS = /senha|password|token|secret|chave|key|hash/i;
export function parseIdentityCsv(text: string, max = 500): { rows: ImportRow[]; ignoredColumns: string[]; truncated: boolean } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], ignoredColumns: [], truncated: false };
  const sep = (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ";" : ",";
  const head = lines[0]!.split(sep).map((h) => h.trim().toLowerCase());
  const idx = (n: string) => head.indexOf(n);
  const ignored = head.filter((h) => !["tipo", "matricula", "cpf", "inep"].includes(h));
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length && rows.length < max; i++) {
    const c = lines[i]!.split(sep).map((x) => x.trim());
    const get = (n: string) => (idx(n) >= 0 ? c[idx(n)] || null : null);
    const kind = (get("tipo") ?? "servidor").toLowerCase() === "escola" ? "escola" : "servidor";
    const cpf = get("cpf"); const d = cpf?.replace(/\D/g, "") ?? null;
    const r: ImportRow = { line: i + 1, kind, matricula: get("matricula"), cpf: d && d.length === 11 ? d : null, inep: get("inep"), problem: null };
    if (cpf && (!d || d.length !== 11)) r.problem = "CPF com formato inválido";
    else if (kind === "escola" && !r.inep) r.problem = "escola sem INEP";
    else if (kind === "servidor" && !r.matricula && !r.cpf && !r.inep) r.problem = "sem identificador";
    rows.push(r);
  }
  return { rows, ignoredColumns: ignored.filter((h) => SECRET_COLS.test(h)).length ? ignored : ignored, truncated: lines.length - 1 > max };
}
export const hasSecretColumns = (cols: string[]) => cols.some((c) => SECRET_COLS.test(c));

// ---------- 11: relatório da rede (motor comum) ----------
export const NETWORK_REPORT: ReportDefinition = {
  id: "docserv-situacao-rede", version: 1, title: "DocServ — situação das certidões por escola", description: "Projeção da leitura docserv_network_overview.",
  source: "docserv_network_overview", params: [{ id: "temporada", label: "Temporada", type: "text", required: true, maxLength: 4 }],
  columns: [{ id: "escola", label: "Escola", kind: "text" }, { id: "servidores", label: "Servidores", kind: "number" }, { id: "sem_envio", label: "Sem envio", kind: "number" },
    { id: "pendente", label: "Aguardando", kind: "number" }, { id: "problema", label: "Com problema", kind: "number" }, { id: "valido", label: "Válidos", kind: "number" }],
  formats: ["xlsx", "pdf", "csv"], reproducible: false, syncRowLimit: 1000,
};
export type SchoolRow = { school_id: string; servidores: number; sem_envio: number; pendente: number; problema: number; valido: number };
export const reportRows = (s: SchoolRow[], names: Map<string, string>): Record<string, CellValue>[] =>
  s.map((x) => ({ escola: names.get(x.school_id) ?? x.school_id, servidores: x.servidores, sem_envio: x.sem_envio, pendente: x.pendente, problema: x.problema, valido: x.valido }));
