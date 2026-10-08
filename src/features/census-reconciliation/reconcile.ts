import { stableHash } from "@/features/data-import/import-kernel";
/**
 * Frente G — reconciliação censitária determinística (projeção derivada, nada persiste).
 * Recebe só agregados (sem PII). Ausência (`null`) nunca vira zero; diferença só é
 * "explicada" por regra declarada cujo delta esperado bate exatamente.
 */
export type ReconClass =
  | "EXACT" | "EXPLAINED_DIFFERENCE" | "SOURCE_DIVERGENCE"
  | "CANONICAL_MISSING" | "SOURCE_MISSING" | "NOT_COMPARABLE";

export type SourceRef = Readonly<{ file: string; sha256: string; knownAt: string | null; locator: string }>;

export type ComparisonInput = Readonly<{
  dimension: string;
  scope: string;
  metric: string;
  source: SourceRef;
  /** null = a fonte não traz o valor (≠ 0). */
  sourceValue: number | string | null;
  /** null = a base canônica não tem o fato (≠ 0). */
  canonicalValue: number | string | null;
  canonicalLineage: string;
  /** Regra declarada: delta esperado (canônico − fonte) e motivo. */
  explanation?: Readonly<{ expectedDelta: number; reason: string }>;
  /** Motivo pelo qual a comparação não é sustentada pelas fontes. */
  notComparable?: string;
}>;

export type Comparison = ComparisonInput & Readonly<{ result: ReconClass; delta: number | null; note: string | null }>;

export function classify(c: ComparisonInput): Comparison {
  const base = { ...c, delta: null as number | null, note: null as string | null };
  if (c.notComparable) return { ...base, result: "NOT_COMPARABLE", note: c.notComparable };
  if (c.sourceValue === null && c.canonicalValue === null) return { ...base, result: "NOT_COMPARABLE", note: "ausente nas duas pontas" };
  if (c.sourceValue === null) return { ...base, result: "SOURCE_MISSING" };
  if (c.canonicalValue === null) return { ...base, result: "CANONICAL_MISSING" };
  if (c.sourceValue === c.canonicalValue) return { ...base, result: "EXACT", delta: 0 };
  const numeric = typeof c.sourceValue === "number" && typeof c.canonicalValue === "number";
  const delta = numeric ? (c.canonicalValue as number) - (c.sourceValue as number) : null;
  if (delta !== null && c.explanation && c.explanation.expectedDelta === delta)
    return { ...base, result: "EXPLAINED_DIFFERENCE", delta, note: c.explanation.reason };
  return { ...base, result: "SOURCE_DIVERGENCE", delta };
}

const key = (c: ComparisonInput) => `${c.dimension}\u0000${c.scope}\u0000${c.metric}\u0000${c.source.sha256}\u0000${c.source.locator}`;

/** Fontes byte-idênticas (mesmo sha256) contam uma vez; ordem de entrada não altera o resultado. */
export function reconcile(inputs: readonly ComparisonInput[]): Comparison[] {
  const seen = new Map<string, ComparisonInput>();
  for (const i of inputs) if (!seen.has(key(i))) seen.set(key(i), i);
  return [...seen.keys()].sort().map((k) => classify(seen.get(k)!));
}

export function summarize(rows: readonly Comparison[]) {
  const out: Record<string, Record<ReconClass, number>> = {};
  for (const r of rows) {
    const d = (out[r.dimension] ??= { EXACT: 0, EXPLAINED_DIFFERENCE: 0, SOURCE_DIVERGENCE: 0, CANONICAL_MISSING: 0, SOURCE_MISSING: 0, NOT_COMPARABLE: 0 });
    d[r.result]++;
  }
  return out;
}

/** Impressão digital estável (FNV-1a) para provar idempotência entre execuções. */
export function fingerprint(rows: readonly Comparison[]): string {
  const s = JSON.stringify(rows.map((r) => [r.dimension, r.scope, r.metric, r.source.sha256, r.sourceValue, r.canonicalValue, r.result]));
  return stableHash(s);
}

/** Literal da fonte → grupo do relatório agregado. Mapeia o literal da ETAPA declarada, nunca o nome da turma. */
export function stageGroup(literal: string | null): "creche" | "pre" | "ei_unificada" | "ai" | "af" | "ef_multi" | "eja" | "nao_se_aplica" | null {
  if (literal === null) return null;
  if (literal.includes("creche")) return "creche";
  if (literal.includes("pré-escola")) return "pre";
  if (literal.includes("unificada")) return "ei_unificada";
  if (literal.startsWith("EJA")) return "eja";
  const m = /(\d)º Ano/.exec(literal);
  if (m) return Number(m[1]) <= 5 ? "ai" : "af";
  if (literal.includes("multi")) return "ef_multi";
  return "nao_se_aplica";
}
