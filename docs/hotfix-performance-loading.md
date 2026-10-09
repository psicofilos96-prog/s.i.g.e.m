# Hotfix PERF.LOADING.1/2/3 — páginas presas em "Carregando"

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

## PERF.LOADING.3 — capacidades completas, paginação restante e contagens (2026-10-09)

### 1. Permissões cortadas em 1000 (defeito de correção)
`effective_capabilities()` devolve uma linha por capacidade × atuação × **turma**. Medido no harness:
Admin = **206.608 linhas** (186 capacidades distintas), Secretaria = 1.702, CIECE = 3.490 — todas cortadas
em 1.000 na leitura da sessão. Menu, rotas e botões perdiam o que ficava depois da linha 1000.
- Migration 0262: `effective_capability_grants()` (uma linha por concessão, rede/escola sem expandir por
  turma) + `effective_capability_scope_classes()` (turmas do alcance do próprio chamador).
- `src/features/authority/read-all-capabilities.ts`: lê os dois leitores paginados até esgotar (acima do
  teto falha, nunca devolve parcial) e expande: modo `class` reproduz linha a linha `effective_capabilities()`
  (usado no servidor pelo CIECE); modo `school` (tela) gera uma linha por escola com `classId = null`, que o
  cliente já tratava como "todas as turmas". Sem curinga: só o que o banco devolveu.
- Todos os consumidores trocados: sessão, cache compartilhado, Diário, CIECE, Assistente.
- Prova no banco real (harness): contagem antiga = linhas novas em modo `class` (206.608 / 1.702 / 3.490);
  amostras das posições 0, 1.000, 100.000 e da cauda: **0 linhas faltando**. Teste unitário com 110 × 698
  linhas e capacidade após a linha 1000 (`read-all-capabilities.test.ts`).
- Backend inalterado como garantia: RLS/writers continuam usando `effective_capabilities`/`has_capability`.

### 2. Paginação/agregação restante
| Tela | Antes | Depois |
|---|---|---|
| Infraestrutura da rede | 3 requisições, 2.970 observações (~2,3 MB) no navegador | 1 requisição, `infrastructure_coverage_at` (0264, INVOKER): 55 linhas, 92 KB; troca de data cancela a anterior |
| Painel "Matrículas vigentes" | todas as matrículas da escola + recusa acima de 1000 | `active_enrollments_at` (0265, INVOKER): 1 linha, 39 B, sem limite |
| Alunos (contagem) | count estimado | count exato por `readable_students_count` (0263) sem busca; count exato do filtro com busca |
| Transporte, Planejamento, Vida funcional, Anomalias | — | mantidos: são projeções versionadas que precisam do conjunto do escopo (escola/professor/60 dias), recusam truncamento; volume atual 0 / 0 / 0 / 2 linhas |

### 3. Contagens
Migration 0263: `readable_students_count()` / `readable_enrollments_count()` — SECURITY DEFINER que espelham
literalmente o OR das políticas SELECT com o alcance calculado uma vez (conjuntos). Resultado idêntico ao
`count(*)` sob RLS nos 3 perfis (9.763/9.811 Admin; 327/327 Secretaria; 0/0 CIECE).

### 4. Secretaria × Profissionais
Auditado: vincular professor à oferta usa `locateProfessional` (busca exata na própria escola) +
`candidateEngagements`; nenhum fluxo autorizado da Secretaria precisa da lista administrativa. Nenhuma
capacidade concedida nem regra ampliada.

### Benchmark final (harness, mediana de 3, inclui rede)
| Rota / leitura | Antes original | Depois PERF.LOADING.2 | Depois PERF.LOADING.3 |
|---|---|---|---|
| Sessão Admin: permissões | 1 chamada, **truncada** (1.000 de 206.608) | igual (truncada) | **completa**: 381 ms, 2 requisições, 16.280 linhas em memória |
| Sessão Secretaria: permissões | truncada (1.000 de 1.702) | igual | completa: 217 ms, 37 linhas |
| Sessão CIECE: permissões | truncada (1.000 de 3.490) | igual | completa: 697 ms, 275 linhas |
| Alunos Admin: contagem | 834 ms (máx 7.878) | 1.287 ms (estimada) | **192 ms exata** (página 700 ms em paralelo) |
| Matrículas Admin: contagem | 4.096 ms | 1.306 ms | **169 ms exata** |
| Alunos/Matrículas Secretaria: contagem | — | 298 / 355 ms | 238 / 544 ms exata |
| Infraestrutura da rede | 3 × ~550 ms, ~2,3 MB | igual | 190 ms Admin · 674 ms Secretaria (máx 2,4 s numa rodada), 92 KB |
| Painel matrículas vigentes (escola) | 926–977 ms + recusa >1000 | igual | 608–950 ms, 39 B, sem recusa |
| Turmas / Censo / Profissionais | 6,6 s / 3,8 s / 8 s | 0,51 / 0,35 / 0,24 s | inalterado |

Matrículas count sob RLS direto continua 1,7 s para Admin (OR de 4 políticas avaliado por linha); a tela não
usa mais esse caminho.

### Gates PERF.LOADING.3
Build completo (vite build) OK; typecheck limpo; diff-check limpo; manifesto de migrations atualizado
(0262–0265); varredura de segredos: nenhum segredo (só padrões de detecção em `verify.mjs` e teste);
security scan: 25 achados, todos regras de leitura pré-existentes de tabelas normativas/catálogo, nenhum
introduzido; route smoke autenticado headless (NROUTE3, 8 estações): 40/40 rotas 200 + 1 404 esperado,
0 "Carregando" preso, 0 erro de console; resíduo de fixtures 0 (3 resíduos de execuções interrompidas
varridos por `bo-fixture-sweep.mjs`). HUMAN_BROWSER_VISUAL_VALIDATION_PENDING.
Benchmark: `scripts/perf-loading-bench-3.mjs` (`PERF_EQUIV=1` para a equivalência).

## Pendências reais
- (Resolvidas em PERF.LOADING.3: infraestrutura/painel agregados no servidor; permissões completas.)
- Secretaria não vê a lista administrativa de Profissionais — decisão mantida; fluxos reais usam busca exata.
- Smoke em navegador autenticado não roda sem aprovação de sessão; a prova é na camada autenticada.
