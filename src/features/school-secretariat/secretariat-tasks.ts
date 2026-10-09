/**
 * NSEC.UX — tarefas reais da Secretaria na tela inicial. Só orientação e destino;
 * nenhuma regra mora aqui. Tarefas sobre um aluno começam pela busca do aluno.
 */
export type SecretariatTask = {
  id: string; title: string; hint: string;
  target: { kind: "route"; to: "/matriculas/nova" | "/documentos-escolares" | "/preparacao-ano" | "/secretaria/vagas" | "/secretaria/livro-matricula" } | { kind: "find-student" };
};

export const SECRETARIAT_TASKS: readonly SecretariatTask[] = [
  { id: "matricular", title: "Matricular", hint: "Aluno novo na escola.", target: { kind: "route", to: "/matriculas/nova" } },
  { id: "achar", title: "Achar aluno", hint: "Busque pelo CPF ou INEP.", target: { kind: "find-student" } },
  { id: "trocar-turma", title: "Trocar de turma", hint: "Ache o aluno e escolha a nova turma.", target: { kind: "find-student" } },
  { id: "transferir", title: "Transferir ou dar saída", hint: "Ache o aluno e registre a saída.", target: { kind: "find-student" } },
  { id: "renovar", title: "Renovar matrícula", hint: "Decida quem continua no próximo ano.", target: { kind: "route", to: "/preparacao-ano" } },
  { id: "documento", title: "Emitir documento", hint: "Declaração e outros documentos.", target: { kind: "route", to: "/documentos-escolares" } },
  { id: "vagas", title: "Ver vagas", hint: "Lugares livres em cada turma.", target: { kind: "route", to: "/secretaria/vagas" } },
  { id: "livro", title: "Livro de Matrícula", hint: "Lista das matrículas do ano.", target: { kind: "route", to: "/secretaria/livro-matricula" } },
];
