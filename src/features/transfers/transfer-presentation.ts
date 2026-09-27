/**
 * CAMADA DE APRESENTAÇÃO da transferência escolar (13UX · Rodada 6B.2.2).
 *
 * Só tradução: nenhuma regra, nenhum efeito, nenhuma admissibilidade é decidida
 * aqui. Os diagnósticos continuam vindo de `transfer-draft.ts`; esta camada
 * escolhe as palavras do Nível 1 e o passo em que cada requisito se resolve.
 */
import type { TransferIssue, TransferIssueField } from "@/features/transfers/transfer-draft";

export type TransferStepId = "aluno" | "destino" | "quando" | "conferencia";

export const TRANSFER_STEPS: readonly {
  id: TransferStepId;
  label: string;
  instruction: string;
  fields: readonly TransferIssueField[];
}[] = [
  {
    id: "aluno",
    label: "Aluno",
    instruction: "Confirme o aluno e a escola em que ele está hoje.",
    fields: ["originId", "entryStudentId"],
  },
  {
    id: "destino",
    label: "Para onde vai",
    instruction: "Informe o tipo de transferência e para onde o aluno vai.",
    fields: ["destinationUnitId", "destinationOfferId", "destinationOrganization", "externalDestino"],
  },
  {
    id: "quando",
    label: "Quando",
    instruction: "Informe a data em que a transferência passa a valer.",
    fields: ["effectiveDate"],
  },
  {
    id: "conferencia",
    label: "Conferência",
    instruction: "Confira o que será encerrado, o que fica preservado e conclua.",
    fields: ["conflito", "versao", "participacoes", "documentacao"],
  },
];

const HUMAN_ISSUE_MESSAGES: Record<string, string> = {
  origin: "Este aluno ainda não tem uma matrícula que possa ser transferida.",
  "entry-student": "Localize primeiro o cadastro do aluno que está chegando.",
  "effective-date": "Informe a data em que a transferência passa a valer.",
  overlap: "Escolha uma data posterior ao início da turma atual do aluno.",
  "destination-unit": "Escolha a escola de destino.",
  "same-unit": "A escola de destino é a mesma de hoje. Para trocar de turma, use a movimentação.",
  "destination-offer": "Escolha a oferta do destino.",
  "destination-organization": "Escolha a etapa ou o ano no destino.",
  "destination-period": "O ano letivo do destino ainda não foi informado.",
  continuity: "A etapa ou ano do destino é diferente da atual. Isso precisa ser conferido.",
  "destination-enrollment": "O aluno já tem matrícula nesta escola: ela será reaproveitada.",
  "external-name": "Informe o nome da escola de destino ou marque que ela não é conhecida.",
  "external-unknown": "A escola de destino não foi informada, e isso é permitido.",
  "external-origin": "A escola de origem não foi identificada.",
  "regular-conflict": "Este aluno já tem matrícula ativa em outra escola. Isso precisa ser resolvido antes.",
  complementary: "Este aluno tem atendimentos além da turma regular, que exigem decisão própria.",
  "version-conflict": "Outra pessoa alterou os dados deste aluno agora. Recomece a conferência.",
  documentation: "Há documentos pendentes. Isso não impede a transferência.",
};

export function humanTransferIssue(issue: TransferIssue) {
  return HUMAN_ISSUE_MESSAGES[issue.id] ?? issue.message;
}

export function stepOfTransferIssue(issue: TransferIssue): TransferStepId {
  return TRANSFER_STEPS.find((step) => step.fields.includes(issue.field))?.id ?? "conferencia";
}

export function transferGuidance(issue: TransferIssue | undefined) {
  if (!issue) return null;
  return humanTransferIssue(issue)
    .replace(/\.$/, "")
    .replace(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ])/, (letter) => letter.toLowerCase());
}
