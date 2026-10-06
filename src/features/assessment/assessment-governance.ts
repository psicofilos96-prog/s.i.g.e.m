/**
 * AA.2 — completude, conferência, oficialização e publicação do instrumento (banco é a autoridade).
 * Completude e fingerprint são calculados no banco; a tela só apresenta e envia a cabeça/fingerprint esperados.
 * Ausência de lançamento ≠ zero ≠ "não registrado" explícito. Sem regra homologada: cálculo bloqueado e publicação aguardando.
 */
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

export type Completeness = {
  state: "completo" | "incompleto" | "indisponivel";
  reason?: string;
  applied_on?: string; planned_on?: string;
  eligible_count?: number; recorded_count?: number; explicit_not_recorded_count?: number;
  missing_student_ids?: string[]; ineligible_result_student_ids?: string[];
  fingerprint?: string;
};
export type GovernanceState = {
  completeness: Completeness;
  conference_state: "sem-conferencia" | "vigente" | "requer-reconferencia";
  conference_id: string | null;
  official: "nao-oficializado" | "oficializado" | "oficial-superado-por-alteracao";
  officialization_competence: "homologada" | "nao-homologada";
  publication: "aguardando-regra-homologada";
  calculation: "bloqueado-sem-regra-homologada";
} | (Completeness & { reason: "access-denied" });

const call = async <T,>(f: string, a: Record<string, unknown>) => { const r = await db.rpc(f, a); if (r.error) throw new Error(r.error.message); return r.data as T; };
export const readGovernance = (instrumentId: string) => call<GovernanceState>("assessment_instrument_governance_state", { _instrument: instrumentId });
export const recordConference = (instrumentId: string, expectedHead: string | null, expectedFingerprint: string) =>
  call<string>("record_assessment_conference", { _instrument: instrumentId, _expected_head: expectedHead, _expected_fingerprint: expectedFingerprint });
export const recordOfficialization = (instrumentId: string, conferenceId: string) =>
  call<string>("record_assessment_officialization", { _instrument: instrumentId, _conference_id: conferenceId });

const MESSAGES: Record<string, string> = {
  "aa:incomplete": "A conferência exige todos os estudantes elegíveis com resultado registrado (ou “não registrado” explícito).",
  "aa:fingerprint-changed": "Os dados mudaram desde a leitura. Recarregue antes de conferir.",
  "aa:stale-head": "Outra conferência foi registrada enquanto você lia. Recarregue.",
  "aa:already-conferred": "Estes mesmos dados já estão conferidos.",
  "aa:instrument-not-applied": "Registre a aplicação antes de conferir.",
  "aa:officialization-competence-unhomologated": "Ainda não há competência homologada para oficializar resultados. Nada foi gravado.",
  "aa:capability-missing": "Sua atuação não tem competência para esta ação nesta data.",
  "aa:conference-not-current": "A conferência não corresponde mais aos dados atuais; reconfira antes.",
  "aa:natural-person-required": "Só uma pessoa natural vinculada à sua conta pode realizar este ato.",
  "diary:not-assignment-holder": "Só o professor da atribuição pode conferir este instrumento.",
};
export const governanceMessage = (raw: string) => {
  const k = Object.keys(MESSAGES).find((m) => raw.includes(m));
  return k ? MESSAGES[k]! : "Não foi possível concluir. Tente novamente.";
};

/** Frases explicáveis da completude; nunca converte ausência em número. */
export function completenessLines(c: Completeness): string[] {
  if (c.state === "indisponivel") return [c.reason === "not-applied" ? "Instrumento ainda não aplicado: completude indisponível." : "Completude indisponível para sua atuação."];
  const lines = [`${c.eligible_count ?? 0} estudante(s) elegível(is) na data da aplicação (${c.applied_on}).`,
    `${c.recorded_count ?? 0} com resultado registrado; ${c.explicit_not_recorded_count ?? 0} com “não registrado” explícito.`];
  if (c.missing_student_ids?.length) lines.push(`${c.missing_student_ids.length} elegível(is) ainda sem lançamento (não é zero).`);
  if (c.ineligible_result_student_ids?.length) lines.push(`${c.ineligible_result_student_ids.length} resultado(s) de estudante fora da alocação na data — inconsistência.`);
  return lines;
}
