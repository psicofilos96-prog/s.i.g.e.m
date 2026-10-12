/**
 * Matrículas L06 — identificação preliminar e reconciliação supervisionada (migration 0458).
 * Preliminar nasce ligado a um protocolo; candidatos só por identificador oficial exato (forte) ou nome civil
 * normalizado + nascimento exatos (fraca), nunca nome sozinho; a busca devolve só id e força, nenhum dado de terceiro.
 * Decisão humana append-only por pessoa ≠ registrador; nunca funde nem cria estudante.
 */
import { supabase } from "@/integrations/supabase/client";

export type Decision = "mesmo-estudante" | "sem-correspondencia" | "indeterminado";
export type Strength = "forte" | "fraca";
export interface Candidate { student_id: string; strength: Strength }

/** Espelho de `enr_norm_name`: minúsculas, sem acento, espaços colapsados. */
export function normName(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Espelho puro do critério do banco, usado em teste e para explicar a decisão. */
export function matchStrength(p: { name: string; birth: string; official: string | null }, s: { name: string; birth: string; official: string | null }): Strength | null {
  if (p.official && s.official && p.official === s.official) return "forte";
  if (p.birth === s.birth && normName(p.name) === normName(s.name)) return "fraca";
  return null;
}

/** Validação local da decisão; o banco revalida tudo. */
export function decisionProblems(d: { decision: Decision; studentId: string | null; reason: string; evidence: string | null }, candidates: readonly Candidate[], authorIsMe: boolean): string[] {
  const out: string[] = [];
  if (authorIsMe) out.push("Quem registrou a identificação não pode decidir a correspondência.");
  if (d.reason.trim().length < 10) out.push("Justificativa com ao menos 10 caracteres.");
  if (d.decision === "mesmo-estudante") {
    const c = candidates.find((x) => x.student_id === d.studentId);
    if (!c) out.push("Só é possível vincular a um candidato apurado.");
    else if (c.strength === "fraca" && (d.reason.trim().length < 20 || !d.evidence?.trim())) out.push("Correspondência fraca exige evidência documental e justificativa detalhada.");
  }
  if (d.decision === "sem-correspondencia" && candidates.length) out.push("Há candidatos: vincule a um deles ou marque como indeterminado.");
  return out;
}

export async function recordPreliminary(protocolId: string, name: string, birth: string, official: string | null, key: string) {
  return supabase.rpc("record_enr_preliminary_student", { _protocol: protocolId, _name: name, _birth: birth, _official: official as string, _key: key });
}
export async function candidatesFor(prelimId: string) {
  return supabase.rpc("enr_student_candidates", { _prelim: prelimId });
}
export async function recordReconciliation(prelimId: string, expectedSeq: number, decision: Decision, studentId: string | null, evidence: string | null, reason: string, key: string) {
  return supabase.rpc("record_enr_student_reconciliation", {
    _prelim: prelimId, _expected_seq: expectedSeq, _decision: decision, _student: studentId as string, _evidence: evidence as string, _reason: reason, _key: key,
  });
}
