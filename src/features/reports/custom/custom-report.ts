/**
 * Gerador personalizado. O catálogo (fontes, campos, cruzamentos e lacunas) vem do banco
 * (`report_custom_catalog`, mesma lista fechada que `report_custom_query` aceita). A consulta roda no
 * servidor como a pessoa que consulta (RLS); a tela só monta a especificação e apresenta o resultado.
 */
import { callRpc } from "@/lib/rpc-call";
import type { CellValue, ColumnDef, ReportResult } from "../report-engine";

export type FieldType = "id" | "text" | "number" | "date" | "boolean";
export type CatalogField = Readonly<{ label: string; type: FieldType; sensitive?: boolean }>;
export type CatalogSource = Readonly<{ label: string; grain: string; fields: Readonly<Record<string, CatalogField>> }>;
export type CatalogJoin = Readonly<{ id: string; from: string; to: string; on: readonly [string, string]; card: string }>;
export type CatalogGap = Readonly<{ from: string; to: string; reason: string }>;
export type Catalog = Readonly<{ sources: Readonly<Record<string, CatalogSource>>; joins: readonly CatalogJoin[]; gaps: readonly CatalogGap[] }>;

export type Operator = "eq" | "neq" | "contains" | "not_contains" | "starts" | "gt" | "gte" | "lt" | "lte" | "between" | "in" | "is_null" | "not_null";
export type Condition = { field: string; operator: Operator; value?: unknown };
export type Group = { op: "and" | "or"; items: (Condition | Group)[] };
export type Aggregate = "count" | "count_distinct" | "sum" | "avg" | "min" | "max" | "percent";
export type Measure = { agg: Aggregate; field?: string; label?: string };
export type Sort = { col: string; dir: "asc" | "desc" };

export type CustomSpec = {
  source: string;
  joins: string[];
  columns: string[];
  groupBy: string[];
  measures: Measure[];
  filter: Group;
  sort: Sort[];
  subtotals: boolean;
  includeSensitive: boolean;
  /** Renomeação por campo/medida (só apresentação). Chave = ref do campo ou "m<i>". */
  labels: Record<string, string>;
};

export const OPERATOR_LABEL: Record<Operator, string> = {
  eq: "é igual a", neq: "é diferente de", contains: "contém", not_contains: "não contém", starts: "começa com",
  gt: "maior que", gte: "maior ou igual a", lt: "menor que", lte: "menor ou igual a", between: "entre", in: "é um de (separe por ;)",
  is_null: "não informado", not_null: "informado",
};
export const OPERATORS_BY_TYPE: Record<FieldType, readonly Operator[]> = {
  id: ["eq", "neq", "in", "contains", "is_null", "not_null"],
  text: ["eq", "neq", "contains", "not_contains", "starts", "in", "is_null", "not_null"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "in", "is_null", "not_null"],
  date: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_null", "not_null"],
  boolean: ["eq", "neq", "is_null", "not_null"],
};
export const AGG_LABEL: Record<Aggregate, string> = {
  count: "Contagem de linhas", count_distinct: "Contagem de distintos", sum: "Soma", avg: "Média", min: "Mínimo", max: "Máximo", percent: "Percentual do total",
};
export const AGG_NEEDS_FIELD: Record<Aggregate, "none" | "any" | "number"> = { count: "none", percent: "none", count_distinct: "any", sum: "number", avg: "number", min: "any", max: "any" };

export const emptySpec = (source = ""): CustomSpec => ({ source, joins: [], columns: [], groupBy: [], measures: [], filter: { op: "and", items: [] }, sort: [], subtotals: false, includeSensitive: false, labels: {} });

export const isGroup = (n: Condition | Group): n is Group => (n as Group).items !== undefined;

/** Fontes presentes na consulta: a principal e as alcançadas pelos cruzamentos escolhidos, em ordem. */
export function sourcesInQuery(cat: Catalog, spec: CustomSpec): string[] {
  const out = spec.source ? [spec.source] : [];
  for (const id of spec.joins) { const j = cat.joins.find((x) => x.id === id); if (j && out.includes(j.from) && !out.includes(j.to)) out.push(j.to); }
  return out;
}
/** Cruzamentos que ainda podem ser acrescentados: partem de uma fonte já presente e trazem uma nova. */
export function availableJoins(cat: Catalog, spec: CustomSpec): CatalogJoin[] {
  const present = sourcesInQuery(cat, spec);
  return cat.joins.filter((j) => present.includes(j.from) && !present.includes(j.to));
}
/** Ligações inexistentes relevantes para as fontes presentes, com o motivo por extenso. */
export function gapsFor(cat: Catalog, spec: CustomSpec): CatalogGap[] {
  const present = sourcesInQuery(cat, spec);
  return cat.gaps.filter((g) => present.includes(g.from) || present.includes(g.to));
}
export type FieldRef = Readonly<{ ref: string; source: string; field: string; def: CatalogField }>;
export function fieldsInScope(cat: Catalog, spec: CustomSpec): FieldRef[] {
  return sourcesInQuery(cat, spec).flatMap((s) => Object.entries(cat.sources[s]?.fields ?? {}).map(([f, def]) => ({ ref: `${s}.${f}`, source: s, field: f, def })));
}
export const fieldOf = (cat: Catalog, ref: string): CatalogField | null => {
  const [s, f] = ref.split(".");
  return (s && f && cat.sources[s]?.fields[f]) || null;
};
export function fieldLabel(cat: Catalog, ref: string): string {
  const [s] = ref.split(".");
  const d = fieldOf(cat, ref);
  return d ? `${d.label} (${cat.sources[s!]?.label ?? s})` : ref;
}

/** Remove cruzamentos desconectados e referências a campos que saíram do escopo (ex.: ao remover um cruzamento). */
export function pruneSpec(cat: Catalog, spec: CustomSpec): CustomSpec {
  const joins: string[] = []; const present = spec.source ? [spec.source] : [];
  for (const id of spec.joins) { const j = cat.joins.find((x) => x.id === id); if (j && present.includes(j.from) && !present.includes(j.to)) { joins.push(id); present.push(j.to); } }
  const ok = (ref: string | undefined) => !!ref && present.includes(ref.split(".")[0]!) && !!fieldOf(cat, ref) && (spec.includeSensitive || !fieldOf(cat, ref)!.sensitive);
  const pruneGroup = (g: Group): Group => ({ op: g.op, items: g.items.flatMap((n): (Condition | Group)[] => (isGroup(n) ? [pruneGroup(n)] : ok(n.field) ? [n] : [])) });
  return { ...spec, joins, columns: spec.columns.filter(ok), groupBy: spec.groupBy.filter(ok), measures: spec.measures.filter((m) => AGG_NEEDS_FIELD[m.agg] === "none" || ok(m.field)), filter: pruneGroup(spec.filter) };
}

export const aggregated = (s: CustomSpec) => s.groupBy.length > 0 || s.measures.length > 0;

/** Validação na tela (o servidor revalida tudo e é quem decide). */
export function validateSpec(cat: Catalog, spec: CustomSpec): string[] {
  const errs: string[] = [];
  if (!cat.sources[spec.source]) return ["Escolha a fonte principal."];
  const scope = new Set(fieldsInScope(cat, spec).map((f) => f.ref));
  const check = (ref: string | undefined, what: string) => {
    if (!ref || !scope.has(ref)) { errs.push(`${what}: campo fora das fontes escolhidas.`); return null; }
    const d = fieldOf(cat, ref)!; if (d.sensitive && !spec.includeSensitive) errs.push(`${what}: "${d.label}" é dado pessoal; marque "incluir dados pessoais".`);
    return d;
  };
  if (aggregated(spec)) { spec.groupBy.forEach((r) => check(r, "Agrupamento")); }
  else { if (!spec.columns.length) errs.push("Escolha ao menos uma coluna."); spec.columns.forEach((r) => check(r, "Coluna")); }
  if (spec.columns.length + spec.groupBy.length + spec.measures.length > 40) errs.push("No máximo 40 colunas.");
  spec.measures.forEach((m, i) => {
    const need = AGG_NEEDS_FIELD[m.agg];
    if (need === "none") return;
    const d = check(m.field, `Cálculo ${i + 1}`);
    if (d && need === "number" && d.type !== "number") errs.push(`Cálculo ${i + 1}: ${AGG_LABEL[m.agg]} exige campo numérico.`);
  });
  const walk = (g: Group, depth: number) => {
    if (depth > 4) errs.push("Filtros aninhados demais.");
    for (const n of g.items) {
      if (isGroup(n)) { walk(n, depth + 1); continue; }
      const d = check(n.field, "Filtro"); if (!d) continue;
      if (!OPERATORS_BY_TYPE[d.type].includes(n.operator)) errs.push(`Filtro "${d.label}": operador não serve para este tipo.`);
      const needsValue = n.operator !== "is_null" && n.operator !== "not_null";
      if (needsValue && (n.value === undefined || n.value === "" || (Array.isArray(n.value) && n.value.some((x) => x === "" || x == null)))) errs.push(`Filtro "${d.label}": informe o valor.`);
    }
  };
  walk(spec.filter, 0);
  if (spec.subtotals && !spec.groupBy.length) errs.push("Subtotais exigem agrupamento.");
  return errs;
}

/** Converte a especificação da tela no corpo aceito pelo servidor (valor de filtro já tipado). */
export function toServerSpec(cat: Catalog, spec: CustomSpec, page: { limit: number; offset: number }) {
  const conv = (g: Group): Group => ({ op: g.op, items: g.items.map((n) => {
    if (isGroup(n)) return conv(n);
    const t = fieldOf(cat, n.field)?.type ?? "text";
    const one = (v: unknown) => (t === "number" ? Number(v) : t === "boolean" ? v === true || v === "true" || v === "sim" : String(v ?? "").trim());
    if (n.operator === "in") return { ...n, value: String(n.value ?? "").split(";").map((x) => x.trim()).filter(Boolean).map(one) };
    if (n.operator === "between") return { ...n, value: (Array.isArray(n.value) ? n.value : [n.value, n.value]).map(one) };
    if (n.operator === "is_null" || n.operator === "not_null") return { field: n.field, operator: n.operator };
    return { ...n, value: one(n.value) };
  }) });
  const agg = aggregated(spec);
  return {
    source: spec.source, joins: spec.joins, includeSensitive: spec.includeSensitive,
    columns: agg ? [] : spec.columns, groupBy: agg ? spec.groupBy : [], measures: agg ? spec.measures.map(({ agg: a, field }) => (field ? { agg: a, field } : { agg: a })) : [],
    subtotals: agg && spec.subtotals, filter: conv(spec.filter), sort: spec.sort, limit: page.limit, offset: page.offset,
  };
}

export type ServerColumn = Readonly<{ id: string; field?: string; agg?: Aggregate; kind: "group" | "measure" | "column" }>;
export type ServerPage = Readonly<{ columns: ServerColumn[]; rows: Record<string, unknown>[]; total: number; limit: number; offset: number }>;

const ERR: [RegExp, string][] = [
  [/rcq:auth-required|permission denied/i, "Entre com sua conta para consultar."],
  [/rcq:sensitive-not-allowed/, "Há dado pessoal na consulta; marque \"incluir dados pessoais\"."],
  [/rcq:unknown-(field|source|join)|rcq:field-source-not-in-query|rcq:join-not-connected|rcq:source-twice/, "A consulta cita campo ou cruzamento fora do catálogo."],
  [/rcq:operator-type|rcq:not-numeric/, "Operador ou cálculo incompatível com o tipo do campo."],
  [/rcq:too-many/, "Consulta grande demais (máx. 4 cruzamentos, 40 colunas, 30 filtros por grupo)."],
  [/statement timeout|canceling statement/i, "A consulta demorou demais. Acrescente filtros ou agrupe."],
  [/invalid input syntax/i, "Valor de filtro inválido para o tipo do campo."],
];
export function customError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return ERR.find(([r]) => r.test(m))?.[1] ?? "Não foi possível executar a consulta com o seu acesso.";
}

export const loadCatalog = () => callRpc<Catalog>("report_custom_catalog");
export async function runPage(cat: Catalog, spec: CustomSpec, limit: number, offset: number): Promise<ServerPage> {
  try { return await callRpc<ServerPage>("report_custom_query", { _spec: toServerSpec(cat, spec, { limit, offset }) }); }
  catch (e) { throw new Error(customError(e)); }
}
export const EXPORT_CAP = 50_000;
/** Lê todas as páginas (até o teto) com a MESMA especificação da prévia. */
export async function runAll(cat: Catalog, spec: CustomSpec, cap = EXPORT_CAP): Promise<{ page: ServerPage; rows: Record<string, unknown>[]; truncated: boolean }> {
  const rows: Record<string, unknown>[] = []; let first: ServerPage | null = null;
  for (let off = 0; ; off += 1000) {
    const p = await runPage(cat, spec, 1000, off); first ??= p;
    rows.push(...p.rows);
    if (p.rows.length < 1000 || rows.length >= p.total) break;
    if (rows.length >= cap) return { page: first, rows: rows.slice(0, cap), truncated: true };
  }
  return { page: first!, rows, truncated: false };
}

const kindOf = (t: FieldType | undefined): ColumnDef["kind"] => (t === "number" ? "number" : t === "date" ? "date" : "text");
export function columnTitle(cat: Catalog, spec: CustomSpec, c: ServerColumn, measureIndex: number): string {
  if (c.kind === "measure") {
    const custom = spec.labels[`m${measureIndex}`]; if (custom) return custom;
    return `${AGG_LABEL[c.agg!]}${c.field ? ` — ${fieldOf(cat, c.field)?.label ?? c.field}` : ""}`;
  }
  return (c.field && spec.labels[c.field]) || (c.field ? fieldOf(cat, c.field)?.label ?? c.field : c.id);
}
const cell = (v: unknown, t: FieldType | undefined): CellValue => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (t === "number" && !Number.isNaN(Number(v))) return Number(v);
  return String(v);
};
/** Resultado no formato do motor comum. Linhas de subtotal/total (ROLLUP) recebem rótulo explícito, nunca célula vazia. */
export function toResult(cat: Catalog, spec: CustomSpec, page: Pick<ServerPage, "columns">, rows: readonly Record<string, unknown>[], now = new Date()): ReportResult {
  let mi = 0;
  const cols = page.columns.map((c) => ({ c, title: columnTitle(cat, spec, c, c.kind === "measure" ? mi++ : -1), type: c.kind === "measure" ? (c.agg === "min" || c.agg === "max" ? fieldOf(cat, c.field ?? "")?.type : "number") : fieldOf(cat, c.field ?? "")?.type }));
  const groupCols = cols.filter((x) => x.c.kind === "group");
  const out = rows.map((r) => {
    const level = typeof r["_nivel"] === "number" ? (r["_nivel"] as number) : 0;
    return cols.map((x) => {
      if (level && x.c.kind === "group") {
        const n = groupCols.length; const gi = groupCols.indexOf(x);
        if (level & (1 << (n - 1 - gi))) {
          if (level === (1 << n) - 1) return gi === 0 ? "TOTAL GERAL" : "";
          const firstAgg = groupCols.findIndex((_, k) => (level & (1 << (n - 1 - k))) !== 0);
          return gi === firstAgg ? "SUBTOTAL" : "";
        }
      }
      return cell(r[x.c.id], x.type);
    });
  });
  return {
    definitionId: `personalizado:${spec.source}`, definitionVersion: 1, params: {},
    columns: cols.map((x) => ({ id: x.c.id, label: x.title, kind: kindOf(x.type) })), rows: out, groups: null,
    generatedAt: now.toISOString(), mode: "sync",
  };
}

/** Linhas de proveniência gravadas no arquivo. */
export function describeSpec(cat: Catalog, spec: CustomSpec): string[] {
  const srcs = sourcesInQuery(cat, spec).map((s) => cat.sources[s]?.label ?? s);
  const f = (g: Group): string => g.items.map((n) => (isGroup(n) ? `(${f(n)})` : `${fieldLabel(cat, n.field)} ${OPERATOR_LABEL[n.operator]}${n.value !== undefined && n.operator !== "is_null" && n.operator !== "not_null" ? ` ${Array.isArray(n.value) ? n.value.join(" e ") : String(n.value)}` : ""}`)).join(g.op === "or" ? " OU " : " E ");
  return [
    `Fontes: ${srcs.join(" + ")}`,
    `Unidade da fonte principal: ${cat.sources[spec.source]?.grain ?? "—"}`,
    `Filtros: ${spec.filter.items.length ? f(spec.filter) : "nenhum"}`,
    aggregated(spec) ? `Agrupado por: ${spec.groupBy.map((r) => fieldLabel(cat, r)).join(", ") || "—"}${spec.subtotals ? " (com subtotais)" : ""}` : "Sem agrupamento",
    "Leitura feita no servidor com o acesso da sua conta; o que a conta não pode ler não entra. Ausência aparece como \"não disponível\".",
  ];
}
