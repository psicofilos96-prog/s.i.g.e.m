# Frente W — Diário do Professor 2027

Gate de entrada: a infraestrutura da V (regência, substituição, grade, prontidão) existe no banco; as pendências da V são de fechamento e ativação humana, sem bloqueio estrutural.

- Migrations: 0135 (endurecimento, contexto da aula, referências, writers v2, leitores "meus diários"/lista nominal) e 0136 (ACL da tabela nova).
- Reaproveitamento: `lesson_record_versions`/`attendance_record_versions`, `applicable_diary_policy`, `attendance_closing_covering`, regência/substituição V, ledger anual S, calendário B4.6, períodos B2.4, repositório Y. Nenhuma tabela paralela.
- Avaliação (W.5) e fechamento (W.6): seguem os writers existentes (`register_assessment_results`, `record_attendance_closing_act`, `record_period_closing_act`), agora sem DML direto. O cálculo final continua indisponível sem norma homologada (AA).
- Teste no banco: `supabase/tests/w_teacher_diary.sql` (rollback; zero resíduos).
- Não provado no banco: o caminho positivo completo (aula + chamada gravadas), porque o canônico não tem regência, grade, calendário 2027 homologado nem ano operacional; criar isso exigiria fatos fictícios encadeados.
- Pendências humanas: abrir 2027, homologar o calendário, registrar regências e grades, aprovar a regra de correção do Diário e as regras de avaliação.
