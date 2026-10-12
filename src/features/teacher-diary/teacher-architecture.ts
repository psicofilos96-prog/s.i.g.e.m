// SIGEM 2.0 Perfil Docente — Lote 01: mapa auditado das 34 seções → código existente → lacunas.
// Só referencia o que existe; status é declarado pela auditoria e conferido por teste (arquivo existe).
// Cadeia canônica reaproveitada: estudante → matrícula → enturmação/alocação → turma → componente → registro,
// autorizada pela atribuição docente temporal (teaching_assignments_at). Nenhum cadastro paralelo.

export type SectionStatus = "tela" | "parcial" | "nucleo" | "lacuna" | "fora-de-escopo" | "bloqueado";
export type Section = { n: number; title: string; status: SectionStatus; routes: string[]; modules: string[]; tables: string[]; gap: string | null };

export const CANONICAL_CHAIN = [
  { step: "estudante", source: "institutional_persons / roster" },
  { step: "matricula", source: "cycle_participations" },
  { step: "enturmacao", source: "class_enrollment_episodes" },
  { step: "turma", source: "class_at" },
  { step: "componente", source: "curricular_component_versions" },
  { step: "atribuicao", source: "teaching_assignment_versions (teaching_assignments_at)" },
  { step: "registro", source: "lesson_record_versions / attendance_record_versions / assessment_entry_versions" },
] as const;

const r = (n: number, title: string, status: SectionStatus, routes: string[], modules: string[], tables: string[], gap: string | null = null): Section => ({ n, title, status, routes, modules, tables, gap });

export const TEACHER_SECTIONS: readonly Section[] = [
  r(1, "Finalidade do perfil", "fora-de-escopo", [], [], []),
  r(2, "Objetivos estratégicos", "fora-de-escopo", [], [], []),
  r(3, "Perfis docentes contemplados", "parcial", [], ["src/features/diary/institutional-teaching.ts"], ["teaching_assignment_versions", "teaching_substitution_versions"], "Regente/substituto existem; papel pedagógico não é declarado (UNREGISTERED_PEDAGOGICAL_ROLE)."),
  r(4, "Arquitetura do perfil", "nucleo", ["src/routes/diario.tsx"], ["src/features/teacher-diary/teacher-architecture.ts"], []),
  r(5, "Painel geral docente", "parcial", ["src/routes/diario.index.tsx"], ["src/features/teacher-diary/diary-overview-page.tsx"], [], "Central da Aula unificada (aula do momento + chamada + registro) ainda não existe."),
  r(6, "Minhas turmas", "tela", ["src/routes/diario.turmas.index.tsx"], ["src/features/teacher-diary/my-diaries-page.tsx"], ["teaching_assignment_versions"]),
  r(7, "Minha agenda", "parcial", ["src/routes/diario.aulas.tsx"], [], ["class_schedule_blocks"], "Agenda só de aulas da grade; sem eventos do calendário/AA."),
  r(8, "Diário de classe eletrônico", "tela", ["src/routes/diario_.livro.tsx"], ["src/features/diary/diary-pages.tsx"], ["teacher_diary_approvals"], "90 modelos de diário não foram fornecidos ao projeto; leiaute conferido só com os modelos presentes."),
  r(9, "Registro de aulas", "tela", ["src/routes/diario.registrar.tsx", "src/routes/diario.registros.$registroId.tsx"], ["src/features/diary/lesson-versions.ts"], ["lesson_record_versions", "lesson_record_drafts"]),
  r(10, "Frequência", "tela", ["src/routes/diario.chamadas.tsx", "src/routes/diario.frequencia.tsx"], ["src/features/diary/attendance-pages.tsx"], ["attendance_record_versions", "attendance_closing_versions"]),
  r(11, "Planejamento pedagógico", "tela", ["src/routes/planejamento.tsx"], [], ["teaching_plan_versions", "sipe_plan_template_versions"]),
  r(12, "BNCC e currículo", "parcial", [], [], ["lesson_curricular_references", "curriculum_objectives"], "Relações BNCC↔currículo local homologadas ausentes."),
  r(13, "Atividades pedagógicas", "lacuna", [], [], [], "Sem entidade de atividade (tarefa/exercício) distinta de avaliação."),
  r(14, "Avaliações e notas", "tela", ["src/routes/diario.turmas.$turmaId.avaliacao.index.tsx", "src/routes/avaliacoes-do-professor.tsx"], [], ["assessment_instruments", "assessment_entry_versions"]),
  r(15, "Acompanhamento da aprendizagem", "parcial", ["src/routes/diario.turmas.$turmaId.alunos.index.tsx"], [], [], "Ficha longitudinal existe na OP; visão docente restrita às próprias turmas."),
  r(16, "Recuperação e intervenções", "parcial", ["src/routes/diario.turmas.$turmaId.avaliacao.periodo.tsx"], [], ["aa_intervention_versions"], "Recuperação via regra homologada; intervenção docente via A&A."),
  r(17, "Educação Infantil", "tela", [], ["src/features/diary/infant-descriptive-report.ts"], ["descriptive_report_versions"]),
  r(18, "EJA", "parcial", [], [], [], "Calendário EJA existe; regras de avaliação EJA dependem de configuração homologada."),
  r(19, "Educação inclusiva", "parcial", [], ["src/features/teacher-diary/teaching-support.ts"], [], "Docente recebe só sinalização de apoio, nunca conteúdo do PEI."),
  r(20, "Materiais didáticos", "lacuna", [], [], ["teaching_plan_attachments"], "Só anexos de plano; sem biblioteca de materiais."),
  r(21, "Comunicação institucional", "lacuna", [], [], [], "Sem canal docente↔escola no perfil."),
  r(22, "Documentos docentes", "tela", ["src/routes/diario.documentos.tsx"], [], []),
  r(23, "Relatórios docentes", "parcial", [], [], [], "Gerador universal existe; assuntos docentes não catalogados."),
  r(24, "Meu histórico", "lacuna", [], [], ["teaching_assignment_versions"], "Sem tela de histórico de atribuições/registros do próprio docente."),
  r(25, "Encerramento do período", "tela", ["src/routes/diario.turmas.$turmaId.encerramento.tsx", "src/routes/diario.turmas.$turmaId.avaliacao.fechamento.tsx"], [], ["attendance_closing_versions", "cycle_closing_versions"]),
  r(26, "Automações e facilidades", "parcial", [], ["src/components/sigem/attendance-speed.tsx"], [], "Chamada rápida existe; sem replicação de registro entre turmas."),
  r(27, "Experiência do usuário", "parcial", [], [], [], "Acessibilidade guardada por src/components/a11y.test.tsx."),
  r(28, "Perfis e permissões", "bloqueado", [], ["src/features/authority/session-authority.ts"], ["capability_policies"], "Política de capacidades homologada vigente ausente; nenhuma atribuição real."),
  r(29, "Integração com módulos", "parcial", [], [], [], "Leitura de matrícula/turma/grade por readers canônicos."),
  r(30, "Arquitetura de dados", "nucleo", [], ["src/features/teacher-diary/teacher-architecture.ts"], []),
  r(31, "Segurança e auditoria", "parcial", [], [], [], "Writers SECURITY DEFINER append-only; E2E autenticado pendente."),
  r(32, "Plano de implementação", "fora-de-escopo", [], [], []),
  r(33, "Critérios de aceitação", "fora-de-escopo", [], [], []),
  r(34, "Resultado institucional esperado", "fora-de-escopo", [], [], []),
];

/** Prioridade do usuário: Central da Aula → Diário/frequência → planejamento/avaliações → acompanhamento. */
export const PRIORITY = [5, 8, 9, 10, 11, 14, 15, 16] as const;

export function gaps(sections: readonly Section[] = TEACHER_SECTIONS) {
  const order = new Map<number, number>(PRIORITY.map((n, i) => [n, i]));
  return sections.filter((s) => s.gap && s.status !== "tela")
    .sort((a, b) => (order.get(a.n) ?? 99) - (order.get(b.n) ?? 99) || a.n - b.n);
}
