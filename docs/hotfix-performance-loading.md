# Hotfix PERF.LOADING.1 — páginas presas em "Carregando"

Situação atual: Registro de lote (2026-10-09).

## Causa raiz (medida em pg_stat_statements, não estimada)
As regras de acesso de várias tabelas grandes chamavam, **para cada linha**, funções que recalculam
`effective_capabilities()` (que já cruza atuações × regras × 698 turmas). Custo quadrático:

| Leitura (baseline) | Chamadas | Média | Máx |
|---|---|---|---|
| `institutional_classes` (school_id, 698 linhas) | 36 | 6.633 ms | 7.586 ms |
| `institutional_classes` (id, school_id) | 25 | 6.603 ms | 7.950 ms |
| `institutional_classes` por `id = ANY` | 80 | 2.495 ms | 3.888 ms |
| `school_enrollments` por ano | 3 | 4.096 ms | 7.106 ms |
| `professional_census_declarations` | 3 | 3.803 ms | 6.960 ms |
| `institutional_students` (página) | 320 | 834 ms | 7.878 ms |
| `effective_capabilities()` | 4.862 | 81 ms | 3.063 ms |

Leituras em páginas de 1000 (`readPages`) multiplicavam isso de forma sequencial, e qualquer tela
que lê turmas (ou tabelas cuja regra consulta turmas: declarações do Censo, identificadores,
observações) herdava 6–8 s por requisição — com novas tentativas, a tela parecia nunca terminar.

## Correções
1. Migration `0259_perf_loading_set_based_rls`: mesmas regras, avaliadas **uma vez por consulta**:
   - `readable_class_ids()` (conjunto de turmas legíveis; avalia oferta/matrícula por escola e por
     ano, não por turma) substitui as duas regras de `institutional_classes` e de
     `institutional_class_record_versions`;
   - `school_enrollments`, `student_school_day_observations`, `professional_exercises`: capacidade
     escolar por conjunto (`school_capability_schools`), equivalente exato de `has_school_capability`;
   - capacidade por turma via `capability_classes` + `capability_unbound` (equivalente a `has_capability`);
   - `institutional_persons` "Own person" com `current_person_id()` em subplano.
   Nenhuma permissão foi ampliada; índices existentes (student_id, enrollment_id, school_id) já cobriam os JOINs — nenhum índice novo sem evidência.
2. Portão de sessão: as 8 rotas que liam antes da sessão (`session-read-gate.ts`) não montam sem
   sessão; mostram "Entre para abrir esta página". Teste: `session-read-gate.test.ts`.

## Números depois
A medição autenticada não pôde rodar aqui (o ambiente não consegue entrar com uma conta sem
aprovação). Os tempos depois da correção devem ser lidos de novo em pg_stat_statements após uso real.

## Pendências reais
- Medição antes/depois autenticada por rota (shell, primeira lista, requisições) — sem login no ambiente.
- Paginação no servidor nas listas que ainda usam `readPages` até milhares de linhas.
- Tempo-limite técnico com "Tentar novamente" em todas as consultas (hoje: 2 novas tentativas e erro governado).
- `/alunos`, `/profissionais`, `/turmas` de listagem ainda exibem dados demonstrativos, não a base 2026.
