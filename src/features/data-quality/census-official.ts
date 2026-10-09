/**
 * NCIECE.FINAL.2 — Censo oficial (recibo Educacenso importado) × base operacional, por escola.
 * Lê só `census_official_reconciliation` (INVOKER: a RLS de cada fonte decide). Classificação é
 * projeção pura, nunca gravada; ausência nunca vira zero nem "coincide".
 */
import { supabase } from "@/integrations/supabase/client";

export type CensusMeasureRow = {
  schoolId: string; inep: string | null; censusYear: string | null; issuedAt: string | null; sourceRef: string | null;
  receiptVersion: number; measure: string; official: number | null; operational: number | null;
};
export type Divergence = "coincide" | "divergente" | "sem-oficial" | "sem-base-legivel";
export const DIVERGENCE_LABEL: Record<Divergence, string> = {
  coincide: "Coincide com o Censo",
  divergente: "Diverge do Censo",
  "sem-oficial": "Recibo sem este dado",
  "sem-base-legivel": "Base operacional não legível ou ausente",
};
export const MEASURE_LABEL: Record<string, string> = { turmas: "Turmas", matriculas_total: "Matrículas (vínculos aluno × turma)", alunos: "Alunos" };

export function classify(official: number | null, operational: number | null): Divergence {
  if (official === null) return "sem-oficial";
  if (operational === null) return "sem-base-legivel";
  return official === operational ? "coincide" : "divergente";
}
export const difference = (o: number | null, b: number | null) => (o === null || b === null ? null : b - o);
/** Cobertura = base operacional / oficial, em %. Oficial zero ou ausente ⇒ ausente. */
export const coverage = (o: number | null, b: number | null) => (o === null || b === null || o === 0 ? null : Math.round((b / o) * 1000) / 10);

export type SchoolReconciliation = {
  schoolId: string; inep: string | null; issuedAt: string | null; sourceRef: string | null; receiptVersion: number;
  measures: { measure: string; official: number | null; operational: number | null; diff: number | null; coverage: number | null; divergence: Divergence }[];
  worst: Divergence;
};
const ORDER: Divergence[] = ["divergente", "sem-base-legivel", "sem-oficial", "coincide"];

export function bySchool(rows: readonly CensusMeasureRow[]): SchoolReconciliation[] {
  const m = new Map<string, SchoolReconciliation>();
  for (const r of rows) {
    const s = m.get(r.schoolId) ?? { schoolId: r.schoolId, inep: r.inep, issuedAt: r.issuedAt, sourceRef: r.sourceRef, receiptVersion: r.receiptVersion, measures: [], worst: "coincide" as Divergence };
    const divergence = classify(r.official, r.operational);
    s.measures.push({ measure: r.measure, official: r.official, operational: r.operational, diff: difference(r.official, r.operational), coverage: coverage(r.official, r.operational), divergence });
    if (ORDER.indexOf(divergence) < ORDER.indexOf(s.worst)) s.worst = divergence;
    m.set(r.schoolId, s);
  }
  return [...m.values()].sort((a, b) => ORDER.indexOf(a.worst) - ORDER.indexOf(b.worst) || a.schoolId.localeCompare(b.schoolId));
}

const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));
export async function loadCensusReconciliation(knownAt: string): Promise<CensusMeasureRow[]> {
  const r = await (supabase.rpc as unknown as (f: string, p: object) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }>)("census_official_reconciliation", { _known_at: knownAt });
  if (r.error) throw new Error("Não foi possível ler o Censo oficial com o seu acesso.");
  return (r.data ?? []).map((x) => ({
    schoolId: String(x["school_id"]), inep: (x["inep"] as string) ?? null, censusYear: (x["census_year"] as string) ?? null,
    issuedAt: (x["issued_at"] as string) ?? null, sourceRef: (x["source_ref"] as string) ?? null, receiptVersion: Number(x["receipt_version"]),
    measure: String(x["measure"]), official: num(x["official_value"]), operational: num(x["operational_value"]),
  }));
}
