/**
 * REPORT.PRO.1 — Organização, cálculos, gráficos e layout do gerador (motor puro).
 * Opera SOMENTE sobre linhas que o reader canônico já devolveu ao usuário: não lê
 * nada, não amplia escopo. Cálculos são lista fechada; ausência (null) nunca vira
 * zero — é contada à parte e o resultado sem dado é null ("não disponível").
 */
import type { CellValue, ColumnDef } from "./report-engine";

export type Row = Readonly<Record<string, CellValue>>;
export const AGGREGATIONS = ["count", "distinct", "sum", "avg", "min", "max"] as const;
export type Aggregation = (typeof AGGREGATIONS)[number];
export const DERIVED = ["percentual", "diferenca", "variacao", "razao"] as const;
export type Derived = (typeof DERIVED)[number];

export type Measure = Readonly<{ id: string; label: string; agg: Aggregation; column: string | null }>;
export type DerivedMeasure = Readonly<{ id: string; label: string; op: Derived; a: string; b: string | null }>;
export type ColumnLayout = Readonly<{ id: string; label?: string; width?: number; align?: "left" | "center" | "right"; format?: "texto" | "inteiro" | "decimal1" | "decimal2" | "percentual" | "data" }>;

export type Organization = Readonly<{
  groupBy: readonly string[];               // multinível
  measures: readonly Measure[];
  derived: readonly DerivedMeasure[];
  sort: readonly { key: string; dir: "asc" | "desc" }[];
  subtotals: boolean; grandTotal: boolean;
}>;

const num = (v: CellValue): number | null => typeof v === "number" && Number.isFinite(v) ? v : null;

export type AggCell = Readonly<{ value: number | null; absent: number }>;
export function aggregate(rows: readonly Row[], m: Measure): AggCell {
  if (m.agg === "count") return { value: rows.length, absent: 0 };
  const col = m.column!;
  const vals = rows.map((r) => r[col] ?? null);
  const absent = vals.filter((v) => v === null).length;
  if (m.agg === "distinct") { const s = new Set(vals.filter((v) => v !== null)); return { value: s.size, absent }; }
  const ns = vals.map(num).filter((x): x is number => x !== null);
  if (!ns.length) return { value: null, absent };
  switch (m.agg) {
    case "sum": return { value: ns.reduce((a, b) => a + b, 0), absent };
    case "avg": return { value: ns.reduce((a, b) => a + b, 0) / ns.length, absent };
    case "min": return { value: Math.min(...ns), absent };
    default: return { value: Math.max(...ns), absent };
  }
}

/** Derivadas: divisão por zero ou operando ausente ⇒ null (nunca 0, nunca infinito). */
export function derive(op: Derived, a: number | null, b: number | null): number | null {
  if (a === null) return null;
  if (op === "diferenca") return b === null ? null : a - b;
  if (b === null || b === 0) return null;
  if (op === "razao") return a / b;
  if (op === "percentual") return (a / b) * 100;
  return ((a - b) / b) * 100; // variação %
}

export function validateOrganization(columns: readonly ColumnDef[], o: Organization): string[] {
  const known = new Map(columns.map((c) => [c.id, c]));
  const errs: string[] = [];
  for (const g of o.groupBy) if (!known.has(g)) errs.push(`Agrupamento não previsto: ${g}.`);
  if (o.groupBy.length > 4) errs.push("No máximo 4 níveis de agrupamento.");
  const ids = new Set<string>();
  for (const m of o.measures) {
    if (!AGGREGATIONS.includes(m.agg)) errs.push(`Cálculo não permitido: ${String(m.agg)}.`);
    if (m.agg !== "count") {
      const c = m.column ? known.get(m.column) : undefined;
      if (!c) errs.push(`Coluna do cálculo não prevista: ${m.column}.`);
      else if (["sum", "avg", "min", "max"].includes(m.agg) && c.kind !== "number") errs.push(`"${m.agg}" exige coluna numérica (${c.id}).`);
      if (c?.sensitive) errs.push(`Coluna sensível não entra em cálculo: ${c.id}.`);
    }
    ids.add(m.id);
  }
  for (const d of o.derived) {
    if (!DERIVED.includes(d.op)) errs.push(`Cálculo derivado não permitido: ${String(d.op)}.`);
    if (!ids.has(d.a) || (d.b !== null && !ids.has(d.b))) errs.push(`Derivado ${d.id} cita medida inexistente.`);
    if (d.op !== "diferenca" && d.b === null) errs.push(`Derivado ${d.id} precisa de denominador.`);
    ids.add(d.id);
  }
  for (const s of o.sort) if (!ids.has(s.key) && !o.groupBy.includes(s.key)) errs.push(`Ordenação não prevista: ${s.key}.`);
  return errs;
}

export type GroupNode = Readonly<{ level: number; keys: Record<string, CellValue>; values: Record<string, number | null>; absent: Record<string, number>; rows: number; children: GroupNode[] }>;
export type Organized = Readonly<{ groups: GroupNode[]; total: GroupNode | null }>;

function compute(rows: readonly Row[], o: Organization): { values: Record<string, number | null>; absent: Record<string, number> } {
  const values: Record<string, number | null> = {}; const absent: Record<string, number> = {};
  for (const m of o.measures) { const r = aggregate(rows, m); values[m.id] = r.value; absent[m.id] = r.absent; }
  for (const d of o.derived) values[d.id] = derive(d.op, values[d.a] ?? null, d.b ? values[d.b] ?? null : null);
  return { values, absent };
}
const cmp = (a: CellValue | number, b: CellValue | number) => a === b ? 0 : a === null ? 1 : b === null ? -1
  : typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "pt-BR");

/** Agrupamento multinível com subtotais e total geral; ordenação múltipla estável. */
export function organize(rows: readonly Row[], o: Organization): Organized {
  const build = (rs: readonly Row[], level: number, keys: Record<string, CellValue>): GroupNode[] => {
    const g = o.groupBy[level]; if (g === undefined) return [];
    const buckets = new Map<string, Row[]>();
    for (const r of rs) { const k = JSON.stringify(r[g] ?? null); (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(r); }
    const nodes = [...buckets.entries()].map(([k, part]) => {
      const nk = { ...keys, [g]: JSON.parse(k) as CellValue };
      return { level, keys: nk, ...compute(part, o), rows: part.length, children: build(part, level + 1, nk) };
    });
    return nodes.sort((x, y) => {
      for (const s of o.sort) {
        const a = s.key in x.values ? x.values[s.key]! : x.keys[s.key] ?? null;
        const b = s.key in y.values ? y.values[s.key]! : y.keys[s.key] ?? null;
        const c = cmp(a, b); if (c) return s.dir === "asc" ? c : -c;
      }
      return cmp(x.keys[g] ?? null, y.keys[g] ?? null);
    });
  };
  const groups = build(rows, 0, {});
  const total = o.grandTotal ? { level: -1, keys: {}, ...compute(rows, o), rows: rows.length, children: [] } : null;
  return { groups, total };
}

/** Achata em linhas de tabela (com subtotais marcados) para prévia/exportação. */
export function flatten(org: Organized, o: Organization): (Record<string, CellValue> & { _kind: "grupo" | "subtotal" | "total" })[] {
  const out: (Record<string, CellValue> & { _kind: "grupo" | "subtotal" | "total" })[] = [];
  const leafLevel = o.groupBy.length - 1;
  const walk = (n: GroupNode) => {
    const isLeaf = n.level === leafLevel;
    if (isLeaf) out.push({ ...n.keys, ...n.values, _kind: "grupo" });
    n.children.forEach(walk);
    if (!isLeaf && o.subtotals) out.push({ ...n.keys, ...n.values, _kind: "subtotal" });
  };
  org.groups.forEach(walk);
  if (org.total) out.push({ ...org.total.values, _kind: "total" });
  return out;
}

/** Pivot só quando há exatamente 2 níveis e 1 medida aditiva (count/sum/distinct não somam entre colunas). */
export function pivot(rows: readonly Row[], rowKey: string, colKey: string, m: Measure): { columns: CellValue[]; rows: { key: CellValue; cells: (number | null)[] }[] } | { refused: string } {
  if (m.agg === "avg" || m.agg === "min" || m.agg === "max") { /* ok: célula individual, sem somar */ }
  const cols = [...new Set(rows.map((r) => r[colKey] ?? null))].sort(cmp);
  if (cols.length > 40) return { refused: "Colunas demais para pivot (máx. 40)." };
  const keys = [...new Set(rows.map((r) => r[rowKey] ?? null))].sort(cmp);
  return { columns: cols, rows: keys.map((k) => ({ key: k, cells: cols.map((c) => aggregate(rows.filter((r) => (r[rowKey] ?? null) === k && (r[colKey] ?? null) === c), m).value) })) };
}

/* ---------- Gráficos ---------- */
export const CHART_KINDS = ["barras", "barras-horizontais", "barras-empilhadas", "linha", "area", "donut", "dispersao", "ranking"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];
export type ChartSpec = Readonly<{ kind: ChartKind; category: string; measures: readonly string[]; series?: string | null; title: string }>;
export type ChartData = Readonly<{ spec: ChartSpec; points: { category: CellValue; series: CellValue; values: Record<string, number | null> }[]; table: { headers: string[]; rows: string[][] }; methodology: string; notes: string[] }>;

/** Adequação: pizza só composição de parte-todo positiva, ≤ 8 fatias, 1 medida aditiva; dispersão exige 2 medidas; ranking só descritivo. */
export function chartIssues(spec: ChartSpec, o: Organization, org: Organized): string[] {
  const errs: string[] = [];
  const measures = new Map(o.measures.map((m) => [m.id, m]));
  for (const id of spec.measures) if (!measures.has(id) && !o.derived.some((d) => d.id === id)) errs.push(`Medida inexistente: ${id}.`);
  if (!o.groupBy.includes(spec.category)) errs.push("A categoria do gráfico precisa ser um agrupamento.");
  if (spec.kind === "donut") {
    const m = measures.get(spec.measures[0] ?? "");
    if (spec.measures.length !== 1 || !m || !["count", "sum"].includes(m.agg)) errs.push("Pizza/donut só para composição com uma medida de contagem ou soma.");
    if (org.groups.length > 8) errs.push("Pizza/donut com mais de 8 fatias fica ilegível; use barras.");
    if (org.groups.some((g) => (g.values[spec.measures[0] ?? ""] ?? 0)! < 0)) errs.push("Pizza/donut não admite valores negativos.");
  }
  if (spec.kind === "dispersao" && spec.measures.length !== 2) errs.push("Dispersão exige exatamente duas medidas.");
  if ((spec.kind === "linha" || spec.kind === "area") && !/data|mes|ano|periodo|competencia/i.test(spec.category)) errs.push("Linha/área só para série temporal (categoria de data/período).");
  if (spec.kind === "barras-empilhadas" && !spec.series) errs.push("Barras empilhadas precisam de série (segundo agrupamento).");
  return errs;
}

export function chartData(spec: ChartSpec, o: Organization, org: Organized, source: string): ChartData {
  const pts: ChartData["points"][number][] = [];
  const visit = (n: GroupNode) => {
    if (n.keys[spec.category] !== undefined && (!spec.series || n.keys[spec.series] !== undefined) && n.children.every((c) => spec.series ? c.keys[spec.series] === undefined : true)) {
      if (!spec.series || n.level === o.groupBy.indexOf(spec.series)) pts.push({ category: n.keys[spec.category] ?? null, series: spec.series ? n.keys[spec.series] ?? null : null, values: Object.fromEntries(spec.measures.map((m) => [m, n.values[m] ?? null])) });
    }
    n.children.forEach(visit);
  };
  org.groups.forEach(visit);
  const ordered = spec.kind === "ranking" ? [...pts].sort((a, b) => cmp(b.values[spec.measures[0]!] ?? null, a.values[spec.measures[0]!] ?? null)) : pts;
  const fmt = (v: number | null) => v === null ? "não disponível" : Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
  const label = (id: string) => o.measures.find((m) => m.id === id)?.label ?? o.derived.find((d) => d.id === id)?.label ?? id;
  const notes: string[] = [];
  const absent = ordered.filter((p) => spec.measures.some((m) => p.values[m] === null)).length;
  if (absent) notes.push(`${absent} categoria(s) sem dado aparecem como "não disponível" — não como zero.`);
  if (spec.kind === "ranking") notes.push("Ordenação descritiva: não é avaliação de desempenho nem critério de premiação ou punição.");
  return {
    spec, points: ordered, methodology: `Fonte: ${source}. Cálculos: ${spec.measures.map(label).join(", ")} por ${spec.category}${spec.series ? ` e ${spec.series}` : ""}.`, notes,
    table: { headers: [spec.category, ...(spec.series ? [spec.series] : []), ...spec.measures.map(label)],
      rows: ordered.map((p) => [p.category === null ? "não disponível" : String(p.category), ...(spec.series ? [p.series === null ? "não disponível" : String(p.series)] : []), ...spec.measures.map((m) => fmt(p.values[m] ?? null))]) },
  };
}

/* ---------- Layout ---------- */
export type ReportLayout = Readonly<{
  paper: "A4" | "A3"; orientation: "retrato" | "paisagem"; cover: boolean;
  title: string; subtitle: string | null; headerLines: readonly string[]; logoUrl: string | null; footer: string | null;
  showFilters: boolean; showMethodology: boolean; observations: string | null; signatures: readonly string[];
  pageNumbers: boolean; verificationQr: boolean;
}>;
export const DEFAULT_LAYOUT: ReportLayout = { paper: "A4", orientation: "retrato", cover: false, title: "", subtitle: null, headerLines: [], logoUrl: null, footer: null,
  showFilters: true, showMethodology: true, observations: null, signatures: [], pageNumbers: true, verificationQr: false };

/** QR só quando existir endpoint de verificação de relatório — hoje não existe; recusa em vez de fingir. */
export const REPORT_VERIFICATION_ENDPOINT: string | null = "/verificar/relatorio/";
export function layoutIssues(l: ReportLayout, columns: number): string[] {
  const errs: string[] = [];
  if (!l.title.trim()) errs.push("Informe o título.");
  if (/[<>]/.test(l.title + (l.subtitle ?? "") + (l.observations ?? "") + l.headerLines.join("") + (l.footer ?? ""))) errs.push("Texto do layout não aceita marcação.");
  if (l.logoUrl && !/^https:\/\//.test(l.logoUrl)) errs.push("Logo só por endereço https.");
  if (l.verificationQr && !REPORT_VERIFICATION_ENDPOINT) errs.push("QR de verificação indisponível: não há endpoint de verificação de relatório.");
  if (columns > 9 && l.orientation === "retrato" && l.paper === "A4") errs.push("Mais de 9 colunas: use paisagem ou A3.");
  if (l.signatures.length > 4) errs.push("No máximo 4 assinaturas.");
  return errs;
}

/** Prévia amostrada declara que é amostra; exportação usa o conjunto completo. */
export function previewNotice(shown: number, collected: number, truncated: boolean): string {
  if (truncated) return `Limite de leitura atingido: ${collected} linhas lidas; a exportação é recusada como incompleta.`;
  return shown < collected ? `Prévia: amostra de ${shown} de ${collected} linhas. A exportação usa as ${collected}.` : `Prévia completa: ${collected} linhas.`;
}
