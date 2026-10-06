# Frente W — Diário do Professor 2027

Gate de entrada: a infraestrutura da V (regência, substituição, grade, prontidão) existe no banco; as pendências da V são de fechamento e ativação humana, sem bloqueio estrutural.

- Migrations: 0135 (endurecimento, contexto da aula, referências, writers v2, leitores "meus diários"/lista nominal) e 0136 (ACL da tabela nova).
- Reaproveitamento: `lesson_record_versions`/`attendance_record_versions`, `applicable_diary_policy`, `attendance_closing_covering`, regência/substituição V, ledger anual S, calendário B4.6, períodos B2.4, repositório Y. Nenhuma tabela paralela.
- Avaliação (W.5) e fechamento (W.6): seguem os writers existentes (`register_assessment_results`, `record_attendance_closing_act`, `record_period_closing_act`), agora sem DML direto. O cálculo final continua indisponível sem norma homologada (AA).
- Teste no banco: `supabase/tests/w_teacher_diary.sql` (rollback; zero resíduos).
- Não provado no banco: o caminho positivo completo (aula + chamada gravadas), porque o canônico não tem regência, grade, calendário 2027 homologado nem ano operacional; criar isso exigiria fatos fictícios encadeados.
- Pendências humanas: abrir 2027, homologar o calendário, registrar regências e grades, aprovar a regra de correção do Diário e as regras de avaliação.

## W.1 (parcial)
- Fluxo legado `/diario/registrar` com conta não grava: mostra caminho para "Meus diários"; `diary-cloud.ts` recusa sem RPC atuação que não seja regência canônica (`ta-…`). Contrato coberto por `diary-w1-contract.test.ts`.
- Pendentes: seletor de blocos/ReferencePicker/correção em Meus diários, visões administrativas somente leitura, E2E positivo sintético (o harness de teste do sandbox não tem permissão de escrita nas tabelas institucionais).

## W.2 (conclusão)
- Migration 0149: `applicable_diary_policy_on` (vigência na data da aula; writers v2 recriados sem relógio civil), `diary_holder_scope`, `my_diary_slots_at` (aulas previstas), `my_diary_lessons` (aulas ministradas + chamada vigente + referências por item/edição), `diary_school_overview_at` (gestão, somente leitura). EXECUTE só para `authenticated`; helpers sem EXECUTE externo.
- Telas: `/meus-diarios` (previstas × ministradas, horários da grade, ReferencePicker opcional, correção versionada de aula e chamada com justificativa quando a regra exigir, preparação/encerrado/histórico sem gravação) e `/acompanhamento-diarios` (somente leitura).
- E2E `supabase/tests/w2_diary_e2e.sql`: positivo (aula, roster, chamada, correção, substituto) + recusas (preparação, anon, service_role, writer legado, outro professor, lotação sem regência, Direção escrevendo, fora da atribuição, dia não letivo, bloco de outro dia, aluno antes/depois da alocação, marcação inventada, stale-head, concorrência, sem regra de correção). Zero resíduos verificado.
- Regra de correção real: nenhuma homologada ⇒ correções ficam recusadas (`correction-policy-missing`) até decisão humana.
