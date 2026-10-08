# Diário — gate end-to-end real (2026-10-05)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Registro de continuidade, não fonte normativa. Fluxo: Professor → regência → turma → período → aula → frequência → avaliação → fechamento.

## Mapa REAL / LAB / AUSENTE (com sessão)

| Etapa | Leitura | Gravação | Estado |
|---|---|---|---|
| Professor / atuação | `institutional-teaching.ts` (`institutional_engagements`) | — | REAL |
| Regência (B4.8) | `teaching_assignments_at` (painel da turma) | `record_teaching_assignment_version` fechado | REAL leitura; escrita AUSENTE (competência pendente); Diário ainda autoriza pela atuação |
| Turma / turno | `class_at` / `class_shift_at` | B2.5/B2.6 | REAL |
| Estudantes | `institutional-roster.ts` (cadeia B3) | B3 | REAL |
| Componente / matriz | `curricular_matrix_*_at`, `class_curricular_resolution_context_at` | E1–E4 | REAL; sem matriz homologada na Cloud ⇒ vazio |
| Período | B2.4 + `resolveCyclesForOrigin` | — | REAL; sem fonte ⇒ indisponível |
| Calendário | `institutional-calendar-days.ts` | Supervisão | REAL |
| Jornada / grade | `class_journey_at` / `class_schedule_at` | 0062 fechados | REAL leitura; sem grade ⇒ nenhuma aula prevista |
| Aula | `lesson_record_versions` via `diary-cloud.ts` | função SQL com capacidade e base esperada | REAL |
| Frequência | `attendance_record_versions` | idem | REAL |
| Ocorrências / fechamento de frequência | `attendance-occurrences-cloud.ts`, políticas da Cloud | `record_attendance_closing_act` | REAL |
| Avaliação | `assessment-results-cloud.ts` | `register_assessment_results` | REAL |
| Fechamento do período | `period-closing-cloud.ts` | `record_period_closing_act` | REAL |
| Parecer EI | `descriptive-report-cloud.ts` | função SQL | REAL — **corrigido**: períodos vinham da configuração demonstrativa |
| Percurso do estudante | `useCloudPeriodFacts` | — | REAL — **corrigido**: configuração vinha do laboratório |
| Situação / encerramento | `academic-standing-cloud.ts`, `cycle-closing-cloud.ts` | RPCs canônicos | REAL |
| Laboratório (`/laboratorio/*`, sem sessão) | fixtures | memória | LAB, separado |

Todos os writers acima já validam capacidade, escopo, base esperada (concorrência otimista), cadeia append-only e knownAt/validOn no banco (ver `supabase/AGENTS.md`); nada novo foi necessário.

## Correções desta rodada
- `reportPeriodsForClass` fora do laboratório devolve vazio (estado vazio "Nenhum período letivo configurado").
- `buildStudentJourney` recebe o estado da configuração da sessão; com sessão nunca usa `assessmentConfigurations` de demonstração.
- Teste `diary-official-no-fixture.test.ts`: modos `cloud`/`pendente` sem fixture; ausência permanece ausência.

## Gate final — fatos/regras pedagógicas pendentes (decisão do proprietário)
1. Competências de escrita: `manter-jornada-da-turma`, `manter-grade-da-turma`, `manter-atribuicao-docente`.
2. Configuração avaliativa homologada (escala, composição, estrutura de períodos) por etapa — sem ela Avaliação/Fechamento ficam "sem configuração".
3. Política de cálculo/fechamento de frequência homologada (frequência mínima não é presumida).
4. Regras de recuperação, conselho e situação final homologadas.
5. Importação D1 pela sessão autorizada + homologação E1/E2/E3 (componente aplicável).
6. Taxonomias abertas: D3 blocos, D7 carga, D8 papéis/substituições.
7. Decidir se o Diário passa a exigir regência B4.8 (além da atuação) para autorizar lançamentos.
