# Perfil Docente — Auditoria e arquitetura (Lote 01)

**Situação atual:** Registro de lote (2026-10-12). Fonte de verdade da matriz: `src/features/teacher-diary/teacher-architecture.ts`, conferida por `teacher-architecture.test.ts` (rotas, módulos e tabelas citados existem; tabelas nascem em migration).

## Cadeia canônica reaproveitada
estudante → matrícula (`cycle_participations`) → enturmação (`class_enrollment_episodes`) → turma (`class_at`) → componente → atribuição docente temporal (`teaching_assignments_at`) → registro (aula, frequência, resultado). Nenhum cadastro paralelo é criado.

## Resumo das 34 seções
- **Tela (9):** 6 Minhas turmas, 8 Diário, 9 Registro de aulas, 10 Frequência, 11 Planejamento, 14 Avaliações, 17 Educação Infantil, 22 Documentos, 25 Encerramento.
- **Parcial (13):** 3, 5, 7, 12, 15, 16, 18, 19, 23, 26, 27, 29, 31.
- **Lacuna (4):** 13 Atividades, 20 Materiais, 21 Comunicação, 24 Meu histórico.
- **Bloqueado (1):** 28 Perfis e permissões (sem política de capacidades homologada vigente).
- **Núcleo/descritivas:** 4, 30; 1, 2, 32–34.

Ordem de lacunas pela prioridade do usuário: 5 Central da Aula → 8 Diário → 15/16 acompanhamento → demais.

## Evidências do banco (2026-10-12)
Contagens reais: `lesson_record_versions` 0, `attendance_record_versions` 0, `teaching_assignment_versions` 0, `teaching_plan_versions` 0, `teacher_diary_approvals` 0. Não há atribuição docente real; nenhum dado foi presumido.

## Bloqueios
- Os "90 modelos de diários" não estão nos arquivos enviados ao projeto; leiaute do Livro do Diário segue só os modelos presentes.
- Sem atribuições reais nem política homologada, o perfil não pode ser provado com conta real; harness autenticado ausente.
