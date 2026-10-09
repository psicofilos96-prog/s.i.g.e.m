/** NOP.UX — apresentação da fila. Só texto e navegação; nenhuma regra nova. */
export type FollowupArea = "acompanhar" | "revisar" | "decidir" | "historico";

export const FOLLOWUP_AREAS: readonly { id: FollowupArea; label: string; hint: string }[] = [
  { id: "revisar", label: "Revisar", hint: "Pendências da escola, com motivo e próxima ação." },
  { id: "acompanhar", label: "Acompanhar", hint: "Registros de acompanhamento da escola, turma ou aluno." },
  { id: "decidir", label: "Decidir", hint: "Onde as decisões acontecem, cada uma na tela própria." },
  { id: "historico", label: "Histórico", hint: "Registros anteriores e suas correções, sem edição." },
];

export type QueueKind = "matricula-sem-turma" | "turma-sem-fechamento-de-frequencia" | "turma-sem-fechamento-avaliativo";

/** Prazo só existe se declarado; estas pendências não têm prazo registrado. */
export const QUEUE_PRESENTATION: Record<QueueKind, { title: string; reason: string; next: string; deadline: string | null }> = {
  "matricula-sem-turma": {
    title: "Alunos sem turma",
    reason: "Matrícula vigente sem enturmação na data consultada.",
    next: "Acompanhar o aluno e pedir à Secretaria que coloque em turma.",
    deadline: null,
  },
  "turma-sem-fechamento-de-frequencia": {
    title: "Turmas sem frequência fechada",
    reason: "Não há fechamento de frequência registrado para a turma.",
    next: "Conversar com o professor responsável; o fechamento é feito no Diário.",
    deadline: null,
  },
  "turma-sem-fechamento-avaliativo": {
    title: "Turmas sem notas fechadas",
    reason: "Não há fechamento avaliativo registrado para a turma.",
    next: "Conversar com o professor; depois, levar ao Conselho de Classe.",
    deadline: null,
  },
};

export const deadlineText = (d: string | null) => d ?? "Sem prazo registrado";
