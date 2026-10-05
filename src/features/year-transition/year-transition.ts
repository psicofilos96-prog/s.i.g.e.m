/**
 * Frente S (partes 3–5) — modelo puro da transição anual e da busca ativa exata.
 * Nenhuma decisão é inferida: pendente = ausência de decisão humana registrada.
 */
export type TransitionDecision = "renovou" | "transferido-saida" | "nao-renovou";
export type CandidateState = TransitionDecision | "pendente";

export const DECISION_LABEL: Record<CandidateState, string> = {
  renovou: "Renovou",
  "transferido-saida": "Transferido / saída",
  "nao-renovou": "Não renovou",
  pendente: "Pendente",
};

export interface Candidate {
  student_id: string;
  display_name: string | null;
  decision: TransitionDecision | null;
  decision_sequence: number | null;
  resulting_enrollment_id: string | null;
}

export function candidateState(c: Candidate): CandidateState {
  return c.decision ?? "pendente";
}

/** Base esperada para a próxima decisão (concorrência otimista). */
export function expectedSequence(c: Candidate): number {
  return c.decision_sequence ?? 0;
}

/** Retificação exige motivo; decisão inicial não. */
export function reasonRequired(c: Candidate): boolean {
  return c.decision_sequence !== null;
}

export type StudentLookupKind = "cpf" | "inep";
export type ProfessionalLookupKind = "matricula" | "qp-mec";

/** Validação local de formato — a autoridade continua sendo o banco. Nunca aceita nome. */
export function normalizeStudentLookup(kind: StudentLookupKind, raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/[A-Za-zÀ-ÿ]/.test(raw)) return null;
  if (kind === "cpf") return digits.length === 11 ? digits : null;
  return digits.length === 12 ? digits : null;
}

export function normalizeProfessionalLookup(raw: string): string | null {
  const v = raw.trim();
  if (v === "" || v.length > 40) return null;
  // Matrícula/QP-MEC são códigos; espaços internos indicam nome digitado.
  if (/\s/.test(v)) return null;
  return v;
}

export type LookupOutcome = "encontrado" | "nao-encontrado" | "conflito" | "entrada-invalida";

export function lookupMessage(o: LookupOutcome): string {
  switch (o) {
    case "encontrado": return "Identidade encontrada. Confirme antes de vincular.";
    case "nao-encontrado": return "Nenhum registro com este identificador. Você pode seguir para o cadastro.";
    case "conflito": return "O identificador corresponde a mais de um registro. Nada foi feito; encaminhe para revisão cadastral.";
    case "entrada-invalida": return "Identificador em formato inválido.";
  }
}

export function transitionError(message: string): string {
  const m: Record<string, string> = {
    "session:person-required": "Sua conta precisa estar vinculada a uma pessoa com atuação vigente.",
    "transition:capability-missing": "Sua atuação não permite decidir a transição nesta escola.",
    "lookup:capability-missing": "Sua atuação não permite a busca ativa nesta escola.",
    "lookup:rate-limited": "Limite de buscas atingido. Aguarde alguns minutos.",
    "transition:target-year-not-open": "O ano de destino ainda não foi aberto para preparação.",
    "enrollment:year-not-open": "O ano de destino ainda não foi aberto para preparação.",
    "transition:stale-base": "Outra pessoa registrou uma decisão antes. Recarregue a lista.",
    "transition:rectification-reason-required": "Informe o motivo da retificação.",
    "transition:renewed-enrollment-must-be-ended-first": "A matrícula criada pela renovação precisa ser encerrada antes de mudar a decisão.",
    "enrollment:active-elsewhere-requires-transfer": "O aluno está matriculado em outra escola neste ano. Use a transferência.",
    "identity:conflict": "Os identificadores pertencem a pessoas diferentes. Nada foi gravado.",
    "identity:already-registered-use-search": "Este aluno já existe. Use a busca para reutilizá-lo.",
    "summary:capability-missing": "Sua atuação não permite consultar a preparação desta escola.",
  };
  const key = Object.keys(m).find((k) => message.includes(k));
  return key ? m[key]! : "Não foi possível concluir. Nada foi alterado.";
}

export interface PreparationSummary {
  candidatos: number; renovados: number; transferidos_saidas: number; nao_renovados: number; pendentes: number;
  novos_alunos: number; matriculas_ano_destino: number; turmas_ano_destino: number; alunos_sem_turma: number;
  servidores_lotados_ano_destino: number; servidores_observados_baseline: number;
}

/** Invariante: candidatos = renovados + transferidos + não renovados + pendentes. */
export function summaryConsistent(s: PreparationSummary): boolean {
  return s.candidatos === s.renovados + s.transferidos_saidas + s.nao_renovados + s.pendentes;
}

/** Ano de leitura é sempre explícito; nunca há fallback de um ano para outro. */
export function resolveReadingYear(requested: string | undefined, available: readonly string[]): string | null {
  return requested && available.includes(requested) ? requested : null;
}
