# Performance e escala do SIGEM — NPERF.1 (2026-10-07)

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
