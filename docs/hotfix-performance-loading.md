# Hotfix PERF.LOADING.1/2 — páginas presas em "Carregando"

Situação atual: Registro de lote (2026-10-09).

## Causa raiz (medida, não estimada)
As regras de acesso (e o leitor temporal de turmas) chamavam, **para cada linha**, funções que
recalculam `effective_capabilities()` — que já cruza atuações × regras × 698 turmas. Custo
quadrático: 698 turmas levavam 6–8 s; listas em lotes de 1.000 multiplicavam isso em sequência,
e com novas tentativas a tela parecia nunca terminar.

## Correções
- `0259_perf_loading_set_based_rls`: turmas, cadastro de turmas, matrículas, dias letivos,
  exercícios funcionais e "pessoa própria" com conjunto avaliado uma vez por consulta
  (`readable_class_ids`, `school_capability_schools`, `capability_classes`, `capability_unbound`).
- `0260_perf_loading_classes_reader_set`: `classes_with_period_link_at` usa o mesmo conjunto.
- `0261_perf_loading_census_professionals_set`: declarações do Censo de profissionais por conjunto
  (`own_engagement_network_now`, `own_engagement_schools_now`) + índice em `person_id`.
- Mesma semântica de ACL em todas; nenhuma permissão ampliada.
- Portão de sessão: 8 rotas não montam sem sessão (`session-read-gate.ts`).
- `src/lib/server-page.ts`: paginação no servidor (50 por página, `range` + contagem estimada),
  busca no servidor, tempo-limite de 15 s, no máximo 1 nova tentativa automática, cancelamento ao
  trocar filtro/página, erro legível com "Tentar novamente".
- Alunos, Profissionais e Turmas com sessão mostram só a base institucional (sem demonstração);
  demonstração apenas sem sessão. Profissionais vêm das declarações oficiais do Censo 2026
  (1.057 pessoas), porque vínculos funcionais só são legíveis via lotação (0 lotações).

## Benchmark autenticado (harness, JWT real de conta sintética, mediana de 3; inclui ~200 ms de rede)
Script: `scripts/perf-loading-bench.mjs` (cleanup obrigatório; resíduo 0).

| Leitura | Antes | Depois (Admin) | Depois (Secretaria) |
|---|---|---|---|
| Turmas (698), RLS | 6.633 ms (máx 7.950) | 513 ms | 760 ms |
| Tela de Turmas (leitor temporal) | 3.640 ms Admin · 6.753 Secretaria · 7.799 CIECE | 527 ms (1ª página) | 694 ms |
| Matrículas, 1.000 linhas | 4.096 ms (máx 7.106) | 1.071 ms | 264 ms |
| Matrículas, 1ª página + contagem | — | 1.306 ms | 355 ms |
| Declarações do Censo (turma) | 3.803 ms (máx 6.960) | 349 ms | 713 ms |
| Alunos, 1ª página + contagem | 834 ms (máx 7.878) | 1.287 ms | 298 ms |
| Alunos, busca no servidor | — | 943 ms | 356 ms |
| Profissionais (tela nova) | estouro de 8 s (statement timeout) | 238 ms | 581 ms |

As leituras acima de 1 s (Alunos e Matrículas com contagem, Admin em rede ~9,6 mil linhas)
vêm da contagem sob RLS; a página em si chega abaixo de 2 s.

## Gates
Suíte completa: 4.809 testes passaram (503 arquivos), após corrigir 1 falha (teste de Turmas atualizado
para a leitura paginada); 106 verificações de arquitetura; typecheck limpo; resíduo de fixtures 0.

## Pendências reais
- Outras telas que ainda usam `readPages` (transporte, infraestrutura, painéis, anomalias,
  planejamento) leem até o limite antes de exibir; agora são rápidas por causa das regras, mas não
  estão paginadas no servidor.
- `effective_capabilities` de Admin em rede passa de 1.000 linhas e é cortado pelo servidor na
  leitura da sessão (a tela usa só capability/escola; o banco continua decidindo).
- Secretaria não vê Profissionais: a regra de pessoas exige capability de manutenção de pessoas.
- Smoke em navegador autenticado não roda sem aprovação de sessão; a prova é na camada autenticada.
