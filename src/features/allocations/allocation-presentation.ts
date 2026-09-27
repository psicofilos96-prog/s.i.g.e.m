/**
 * CAMADA DE APRESENTAÇÃO da enturmação e da movimentação (13UX · Rodada 6B.2.2).
 *
 * Só tradução: nenhuma regra, nenhuma admissibilidade, nenhuma vigência é
 * decidida aqui. Os diagnósticos continuam vindo de `allocation-draft.ts`;
 * esta camada escolhe as palavras do Nível 1 e o passo em que cada requisito
 * se resolve. O texto institucional segue disponível no Nível 2/3.
 */
import type {
  AllocationIssue,
  AllocationIssueField,
  AllocationMode,
} from "@/features/allocations/allocation-draft";

export type AllocationStepId = "aluno" | "turma" | "data" | "conferencia";

export type AllocationStep = {
  id: AllocationStepId;
  label: string;
  instruction: string;
  fields: readonly AllocationIssueField[];
};

export const ALLOCATION_STEPS: readonly AllocationStep[] = [
  {
    id: "aluno",
    label: "Aluno",
    instruction: "Confirme de quem é a inscrição que será colocada em uma turma.",
    fields: ["targetId"],
  },
  {
    id: "turma",
    label: "Turma",
    instruction: "Escolha a turma em que o aluno começará a estudar.",
    fields: ["classId", "groupingLabel", "capacidade"],
  },
  {
    id: "data",
    label: "Data",
    instruction: "Informe o primeiro dia do aluno nesta turma.",
    fields: ["startDate", "endDate"],
  },
  {
    id: "conferencia",
    label: "Conferência",
    instruction: "Confira as informações e conclua.",
    fields: ["conflito"],
  },
];

export const MOVEMENT_STEPS: readonly AllocationStep[] = [
  {
    id: "aluno",
    label: "Turma atual",
    instruction: "Confirme o aluno e a turma em que ele está hoje.",
    fields: ["targetId"],
  },
  {
    id: "turma",
    label: "Nova turma",
    instruction: "Escolha a turma para onde o aluno vai.",
    fields: ["classId", "groupingLabel", "capacidade"],
  },
  {
    id: "data",
    label: "Quando",
    instruction: "Informe o primeiro dia do aluno na nova turma.",
    fields: ["startDate", "endDate"],
  },
  {
    id: "conferencia",
    label: "Conferência",
    instruction: "Confira o que será alterado e conclua.",
    fields: ["conflito"],
  },
];

export function stepsFor(mode: AllocationMode) {
  return mode === "movimentacao" ? MOVEMENT_STEPS : ALLOCATION_STEPS;
}

/** Frases humanas por diagnóstico, sem perder a precisão do domínio. */
const HUMAN_ISSUE_MESSAGES: Record<string, string> = {
  target: "Escolha de quem é a inscrição que será colocada em turma.",
  class: "Escolha a turma.",
  "class-blocked": "Esta turma não pode receber o aluno neste contexto.",
  grouping: "Esta turma atende mais de um agrupamento. Informe qual deles é o do aluno.",
  start: "Informe o primeiro dia do aluno na turma.",
  end: "Confira as datas: o término ficou antes do início.",
  "active-conflict": "Este aluno já está em uma turma. Para trocar, faça uma movimentação.",
  "no-active": "Este aluno não está em turma nenhuma. Use a enturmação inicial.",
  overlap: "Escolha uma data posterior ao início da turma atual.",
  "same-class": "A turma escolhida é a mesma de hoje. Escolha outra turma.",
  uncertain: "A compatibilidade desta turma precisa ser conferida por uma pessoa.",
  capacity: "A lotação desta turma precisa ser conferida. Nada é bloqueado por isso.",
  "open-ended": "A turma fica sem data de término, o que é normal.",
};

export function humanAllocationIssue(issue: AllocationIssue) {
  return HUMAN_ISSUE_MESSAGES[issue.id] ?? issue.message;
}

export function stepOfAllocationIssue(
  issue: AllocationIssue,
  mode: AllocationMode,
): AllocationStepId {
  return stepsFor(mode).find((step) => step.fields.includes(issue.field))?.id ?? "conferencia";
}

export function allocationGuidance(issue: AllocationIssue | undefined) {
  if (!issue) return null;
  return humanAllocationIssue(issue)
    .replace(/\.$/, "")
    .replace(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ])/, (letter) => letter.toLowerCase());
}
