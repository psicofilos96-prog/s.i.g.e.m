/** NDOC.UX — sequência do dia do professor. Só navegação; nenhuma regra. */
export type TeacherDayStep = {
  id: "proxima" | "aula" | "chamada" | "planejamento" | "pendencias";
  label: string;
  hint: string;
  /** Âncora na própria tela (#id) ou rota. */
  anchor?: string;
  to?: "/planejamento";
};

export const TEACHER_DAY_STEPS: readonly TeacherDayStep[] = [
  { id: "proxima", label: "Próxima aula", hint: "Onde e quando", anchor: "proxima-aula" },
  { id: "aula", label: "Registrar aula", hint: "O que foi feito", anchor: "agenda-title" },
  { id: "chamada", label: "Fazer chamada", hint: "Presença da turma", anchor: "agenda-title" },
  { id: "planejamento", label: "Planejamento", hint: "Próximas aulas", to: "/planejamento" },
  { id: "pendencias", label: "Pendências", hint: "O que falta concluir", anchor: "pending-title" },
];
