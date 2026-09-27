/**
 * CAMADA DE APRESENTAÇÃO da matrícula escolar (Etapa 13UX · Rodada 6B.2.2).
 *
 * "O domínio pensa como máquina. A interface conversa como pessoa."
 *
 * Aqui não existe regra: apenas tradução. Todo diagnóstico, cenário de relação
 * e impedimento continua vindo de `enrollment-draft.ts`; esta camada apenas
 * escolhe as palavras do Nível 1 e diz em que passo o requisito se resolve.
 * O texto institucional original permanece disponível no Nível 2/3.
 */
import type { EnrollmentIssue, EnrollmentIssueField } from "@/features/enrollments/enrollment-draft";

export type EnrollmentStepId = "aluno" | "escola" | "conferencia";

export type EnrollmentStep = {
  id: EnrollmentStepId;
  label: string;
  /** Frase que responde "o que preciso fazer agora?". */
  instruction: string;
  fields: readonly EnrollmentIssueField[];
};

export const ENROLLMENT_STEPS: readonly EnrollmentStep[] = [
  {
    id: "aluno",
    label: "Aluno",
    instruction: "Encontre o aluno que será matriculado e confirme que é a pessoa certa.",
    fields: ["studentId", "identityConfirmed"],
  },
  {
    id: "escola",
    label: "Escola e ingresso",
    instruction: "Escolha a escola e informe quando o aluno começa a estudar nela.",
    fields: ["unitId", "entryDate", "duplicidade", "outraUnidade"],
  },
  {
    id: "conferencia",
    label: "Conferência",
    instruction: "Confira as informações e conclua a matrícula.",
    fields: [],
  },
];

/** Frases humanas por diagnóstico, sem perder a precisão do domínio. */
const HUMAN_ISSUE_MESSAGES: Record<string, string> = {
  student: "Escolha o aluno que será matriculado.",
  identity: "Confirme que este é o aluno certo.",
  unit: "Escolha a escola onde o aluno vai estudar.",
  "entry-date": "Confira a data de ingresso: use dia/mês/ano.",
  "entry-date-missing": "Data de ingresso ainda não informada. É possível concluir sem ela.",
  duplicate: "Este aluno já tem matrícula nesta escola. Use a matrícula que já existe.",
  return: "Este aluno já estudou nesta escola. A matrícula anterior será reaproveitada.",
  "other-unit": "Este aluno tem registro em outra escola da rede. Confira antes de concluir.",
};

export function humanEnrollmentIssue(issue: EnrollmentIssue) {
  return HUMAN_ISSUE_MESSAGES[issue.id] ?? issue.message;
}

export function stepOfEnrollmentField(field: EnrollmentIssueField): EnrollmentStepId {
  return ENROLLMENT_STEPS.find((step) => step.fields.includes(field))?.id ?? "conferencia";
}

export function stepOfEnrollmentIssue(issue: EnrollmentIssue): EnrollmentStepId {
  return stepOfEnrollmentField(issue.field);
}

/** Orientação curta junto ao botão: minúscula, sem acusação. */
export function guidanceFromIssue(issue: EnrollmentIssue | undefined) {
  if (!issue) return null;
  const phrase = humanEnrollmentIssue(issue).replace(/\.$/, "");
  return phrase.replace(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ])/, (letter) => letter.toLowerCase());
}
