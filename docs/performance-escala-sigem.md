# Performance e escala do SIGEM — NPERF.1 (2026-10-07)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Nenhuma regra de negócio alterada. Números vêm do acumulado de estatísticas do banco (pg_stat_statements), sem alvo inventado.

## Volumes reais atuais
pessoas 10.822 · identificadores 21.599 · alunos 9.763 · matrículas 9.811 · observações de vínculo aluno-turma 10.295 · declarações de turma do Censo 9.169 · regras de capacidade 1.659. Banco 209 MB, memória 67%, conexões 10/60, sem alertas de esgotamento.

## Hotspots (antes)
| Consulta | chamadas | média ms | máx ms | Causa |
|---|---|---|---|---|
| effective_capabilities() | 2713 | 64,5 | 3063 | chamada por tela/componente, repetida |
| institutional_classes (lista completa) | 19+18 | ~6450 | 7307 | RLS por linha: can_read_institutional_class(id, school_id) e can_read_offer_organization(id) |
| capability_policy_rules (lista) | 44 | 2654 | 6466 | política chamava has_network_capability por linha (1.659 linhas) |
| institutional_students (lista) | 99 | 966 | 7878 | RLS com EXISTS por linha em vínculos/episódios |
| institutional_classes id = ANY | 33 | 2327 | 3888 | mesma RLS por linha |
| user_person_links por user_id | 2417 | 21,3 | 1365 | repetida por componente (N+1 de sessão) |

## Corrigido
- Migration 0232: políticas de leitura de rascunho de capability_policy_rules passam a avaliar `has_network_capability` uma vez por consulta (`(SELECT …)`), mesma semântica, porque a função não depende da linha. "Depois" só é medível após novas chamadas reais; a reavaliar no próximo lote.

## Justificado / pendente (não corrigido neste lote)
- RLS por linha de turmas/alunos: depende de colunas da linha; reescrever como conjunto (`id IN (SELECT readable_classes())`) muda o caminho de autorização e exige prova de equivalência executando como pessoa real — impossível com acesso só leitura (ver NQA.1). PENDENTE.
- Listas completas sem filtro de escola (onboarding, ciece, calendário, otimizador): paginação/filtro por escola no cliente pendente.
- effective_capabilities e user_person_links repetidos: cache por sessão na camada de consulta (mesma chave de usuário, sem cruzar asOf) pendente.
- Concorrência de writers e locks: exige executar writers — bloqueado (acesso só leitura).
- Bundle: rotas já com divisão automática por rota; análise detalhada pendente.
- Índices novos: nenhum sem evidência; os seq_scan altos (calendar_version_day_assignments, capability_policy_rules) estão em tabelas pequenas, onde varredura é esperada.

## Status
NÃO PASS: hotspot principal (RLS por linha de turmas/alunos) segue identificado e não resolvido.

## Rodada 2026-10-07
Medido (estatísticas acumuladas do banco): effective_capabilities 2.713 chamadas, média 64 ms, máx 3,1 s; lista de turmas sem filtro média 6,4 s (p95 não disponível nesta fonte); capability_policy_rules média 2,7 s (anterior à 0232; "depois" mede-se com novas chamadas); alunos média 0,97 s, máx 7,9 s.
Corrigido: Horários (`readableClasses`) disparava uma consulta por turma todas ao mesmo tempo (≈698); agora no máximo 8 simultâneas, mesmo resultado e mesma falha fechada. Solução definitiva = leitor de nomes de turma em lote (migration nova) — pendente.
Pendente: RLS por linha de turmas/alunos, cache por sessão de permissões, concorrência de writers, bundle.

## NPERF.2 (2026-10-07)
Sem mudança de autorização. Medições = estatísticas acumuladas do banco (pg_stat_statements) antes da publicação destas mudanças; o "depois" só aparece com novas chamadas reais.

| Hotspot | Antes (medido) | Ação | Estado |
|---|---|---|---|
| Nomes de turma 1 a 1 (Horários, Mapa, Projeção da rede, CIECE, Calendário) | até ≈698 `class_at` por tela | `classes_at_batch` (0235, INVOKER sobre `class_at`, mesma RLS/validOn/knownAt) via `classNamesAt` | RESOLVIDO (N → 1) |
| `effective_capabilities()` repetida | 2.954 chamadas, média 70 ms, máx 3,1 s | Autoridade da sessão com cache de 5 min por conta + revisão da sessão (troca de conta = nova chave; nunca cruza usuários) | RESOLVIDO na tela principal; chamadas de servidor (assistente, fechamento) seguem por requisição, de propósito |
| `user_person_links` por usuário | 2.611 chamadas, média 24 ms | Mesmo cache (está dentro da autoridade da sessão) | RESOLVIDO |
| Lista de turmas sem filtro (RLS por linha) | 19 chamadas, média 6,4 s | Não alterado | JUSTIFICADO: reescrever a RLS como conjunto só com prova de equivalência executando como pessoa real; banco deste ambiente é só leitura (NQA.1). Segurança não é trocada por velocidade |
| Lista de alunos sem filtro | 130 chamadas, média 0,9 s, máx 7,9 s | Não alterado | JUSTIFICADO: mesma RLS por linha; filtrar por escola no servidor muda o que a tela mostra hoje e depende de decisão de cada tela |
| capability_policy_rules | média 2,2 s (acumulado inclui chamadas antes da 0232) | 0232 já aplicada | REAVALIAR com chamadas novas |

- Cache: só identidade/capacidades para montar a TELA; o banco continua a garantia. Uma política homologada nova aparece na tela em até 5 min ou ao entrar de novo.
- Divisão de código: as rotas já são carregadas sob demanda pelo roteador (uma parte por rota); não há componente pesado importado no início.
- Paginação no servidor: sem lista nova paginada neste lote; as listas grandes que restam são as duas acima, ligadas à RLS.
- Teste de escala com 55/698/9.763 usando login real = INTERACTIVE_BROWSER_VALIDATION_PENDING. Regressão de autorização/temporalidade coberta por `class-names-batch.test.ts` (mesmos validOn/knownAt, falha isolada, ausência nunca vira nome) e pela suíte.

Status NPERF.2: hotspots conhecidos resolvidos ou justificados.

## NPERF.4 (2026-10-08)
Sem mudança de autorização. Fonte: estatísticas acumuladas do banco (pg_stat_statements); "antes" = NPERF.1/NPERF.2, "agora" = mesma fonte em 2026-10-08 (inclui chamadas anteriores às correções, então é tendência, não prova isolada).

| Consulta | NPERF.1/2 | Agora | Leitura |
|---|---|---|---|
| effective_capabilities() | 2.954 ch., 70 ms | 3.856 ch., 79 ms, máx 3,1 s | ainda a mais chamada; restavam leitores fora do cache da tela |
| capability_policy_rules (lista) | 44 ch., 2.654 ms | 106 ch., 1.123 ms | 0232 surtiu efeito (média caiu à metade com mais chamadas) |
| user_person_links | 2.611 ch., 24 ms | 3.332 ch., 30 ms | cache da sessão (NPERF.2) |
| institutional_students (lista) | 130 ch., 0,9 s | 264 ch., 0,85 s, máx 7,9 s | RLS por linha — JUSTIFICADO (inalterado) |
| institutional_classes (lista sem filtro) | 19 ch., 6,4 s | 21 ch., 6,6 s | RLS por linha — JUSTIFICADO (inalterado) |
| general_admin_session() | — | 1.800 ch., 46 ms | novo no ranking; já por sessão; observar |

Corrigido (com evidência no código):
- Fechamento de período e Tarefas chamavam `effective_capabilities()` a cada carga, fora do cache da tela: agora usam `readEffectiveCapabilitiesShared` (`src/features/authority/capabilities-cache.ts`) — chave = conta, 60 s, chamadas simultâneas compartilhadas, erro nunca guardado, login/logout/troca de conta descartam. Teste: `capabilities-cache.test.ts` (4).
- Tarefas perguntava `operational_engagement_active` em série, tarefa × atuação (N×M, repetindo o mesmo par); agora cada par atuação×escola é perguntado uma vez, em paralelo. Mesmo resultado.
- Diário NÃO usa o cache compartilhado: sua carga é por contexto de sessão (B4.10.0c), e reaproveitar a resposta quebraria essa garantia (8 testes provaram). JUSTIFICADO.

Pendente: RLS por linha de turmas/alunos (prova de equivalência como pessoa real); medição de bundle (não há build manual neste ambiente) e de payload por tela com login real — INTERACTIVE_BROWSER_VALIDATION_PENDING; o "depois" dos itens corrigidos aparece só com novas chamadas reais.

Regressão: 4.619 testes (inclui suítes de acesso/autoridade) + typecheck limpos.
Status NPERF.4: hotspots com evidência corrigidos ou justificados; não PASS para RLS de turmas/alunos.
