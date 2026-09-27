/**
 * CAMADA DE APRESENTAÇÃO do cadastro de pessoa/aluno (Etapa 13UX · Rodada 4).
 *
 * "O domínio pensa como máquina. A interface conversa como pessoa."
 *
 * Aqui não existe regra: apenas tradução de diagnósticos do domínio para a
 * linguagem de quem atende na secretaria. O texto institucional original
 * permanece disponível e é sempre apresentado sob demanda, nunca descartado.
 */
import type { PersonDraft, PersonDraftIssue } from "@/features/students/person-draft";

export type PersonStepId = "basicos" | "documentos" | "contato" | "conferencia";

export type PersonStep = {
  id: PersonStepId;
  label: string;
  /** Frase que responde "o que preciso fazer agora?". */
  instruction: string;
  fields: ReadonlyArray<keyof PersonDraft>;
};

export const PERSON_STEPS: readonly PersonStep[] = [
  {
    id: "basicos",
    label: "Dados básicos",
    instruction: "Informe o nome e a data de nascimento do aluno.",
    fields: ["fullName", "socialName", "birthDate", "administrativeSex"],
  },
  {
    id: "documentos",
    label: "Documentos",
    instruction: "Registre os documentos que você tiver em mãos. Nenhum deles é obrigatório.",
    fields: ["cpf", "educationalExternalId", "civilRegistry"],
  },
  {
    id: "contato",
    label: "Contato",
    instruction: "Informe um telefone para a escola falar com a família, se você tiver.",
    fields: ["contactPhone", "contactNote"],
  },
  {
    id: "conferencia",
    label: "Conferência",
    instruction: "Confira as informações e conclua o cadastro.",
    fields: [],
  },
];

/** Frases humanas para cada diagnóstico do domínio, sem perder a precisão. */
const HUMAN_ISSUE_MESSAGES: Record<string, string> = {
  name: "Informe o nome completo do aluno para continuar.",
  birth: "Informe a data de nascimento para continuar.",
  "birth-format": "Confira a data de nascimento: use o formato dia/mês/ano.",
  "cpf-format": "Confira o CPF: use o formato 000.000.000-00.",
  "cpf-absent": "Sem CPF informado. O cadastro pode ser concluído assim mesmo.",
  sex: "Sexo do aluno não informado. Você pode concluir sem preencher.",
  duplicate: "Encontramos um cadastro parecido na rede. Confira antes de prosseguir.",
  homonym: "Existe alguém com o mesmo nome na rede. Confira se é a mesma pessoa.",
  verification: "Você marcou este cadastro para conferência de identidade.",
};

export function humanIssueMessage(issue: PersonDraftIssue) {
  return HUMAN_ISSUE_MESSAGES[issue.id] ?? issue.message;
}

export function stepOfField(field: keyof PersonDraft): PersonStepId {
  const step = PERSON_STEPS.find((candidate) => candidate.fields.includes(field));
  return step?.id ?? "conferencia";
}

/** Passo em que a pendência deve ser corrigida. */
export function stepOfIssue(issue: PersonDraftIssue): PersonStepId {
  return issue.field ? stepOfField(issue.field) : "basicos";
}
