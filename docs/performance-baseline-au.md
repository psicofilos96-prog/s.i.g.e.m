# Linha de base de desempenho — Frente AU (2026-10-06)

Volume medido: 55 escolas, 9.811 matrículas, 10.295 vínculos de turma, 9.692 observações diárias, 1.659 regras de capacidade. Banco: 101 MB, memória 62%, 7/60 conexões, nenhum alerta de esgotamento.

## Consultas da aplicação (pg_stat_statements)
| Chamada | chamadas | média | máx |
|---|---|---|---|
| effective_capabilities() | 138 | 9,9 ms | 378 ms |
| user_person_links por usuário | 176 | 7,3 ms | 96 ms |
| institutional_persons por id | 113 | 8,6 ms | 87 ms |
| general_admin_session() | 52 | 15,7 ms | 135 ms |
| effective_scope_capabilities() | 46 | 7,7 ms | 81 ms |

As consultas lentas restantes são importações técnicas de uso único (Educacenso 2026, 47 s) e E2E sintéticos, fora da operação.

## Otimização (migration 0178, só índices)
Colunas de FK sem índice nas tabelas maiores levavam a varredura completa. O plano de 4 buscas típicas (matrículas por escola/aluno, vínculos por turma, regras por política) foi de **888,8 ms para 12,8 ms** (EXPLAIN ANALYZE, mesma consulta). Sem mudança de RLS, GRANT, semântica ou dado.

## Cache e frontend
Nenhum cache novo. Os caches existentes são do TanStack Query, em memória, com chave que inclui usuário/sessão; o banco reavalia a ACL a cada leitura, então revogar uma permissão bloqueia leituras novas.

## Concorrência
Os writers usam `pg_advisory_xact_lock` por fato lógico, além de base esperada (stale-head) e plan_id/plan_key (idempotência), cobertos pelos E2E existentes (b252, AF, AQ). Nesta frente não houve teste de carga simultânea com duas conexões.

## Limites
Não existe SLA institucional e nenhum foi inventado. Pendências: medição dos readers com conta real que tenha capability (sem conta real, eles recusam rápido e a medição não serve); expansão sintética acima de 10 mil alunos; medição do tempo de carregamento das telas no navegador.
