# NCONC.2 — Prova de concorrência com rollback

## Situação atual
- Classe: **Registro de lote** (2026-10-08). Em conflito, prevalecem os `AGENTS.md`.

Estado: **PARTIAL** — 6 de 8 domínios PASS no banco; calendário parcial; Mapa com recurso indisponível.

## Método
Cada prova roda numa única transação que termina em `RAISE` (nada persiste), com contas setoriais reais ou autoria
sintética como sessão. "Sessão 1" e "Sessão 2" leem a mesma cabeça; a 1 grava; a 2 chega com a cabeça antiga.
Duas conexões simultâneas não existem neste mecanismo: a serialização entre conexões vem da trava adquirida antes
da comparação e da ausência de ordens invertidas de travas (invariante `concurrency-nconc1.test.ts`, 9 pares, 0 inversões).

## Resultado por domínio
| Domínio | Prova | Resultado |
|---|---|---|
| Turma (composição) | `nconc2_a_*` | PASS `composition:stale-head`, vencedora preservada |
| Matrícula guiada | `nconc2_a_*` | PASS `draft:stale-head`; conclusão dupla `draft:closed`, 1 enturmação |
| Enturmação (remanejamento) | `nconc2_a_*` | PASS `base-superseded` |
| Atribuição docente | `nconc2_a_*` | PASS `assignment:stale-head`, 2 versões |
| Jornada | `nconc2_a_*` | PASS `journey:stale-head` (constituição dupla e sucessão dupla) |
| Avaliação | `nconc2_b_avaliacao` | PASS aplicação/conferência `aa:stale-head`; reenvio idempotente; correção `concurrent-change`, vencedora preservada |
| Documentos | `nconc2_c_documentos` | PASS mesma chave = 1 emissão; chave reutilizada `idempotency:key-reused`; retificação e cancelamento duplos `base-superseded` |
| Regras institucionais | `nconc2_d_regras` | PASS `institutional-rule:stale-head` (v1 e v2); homologação dupla `already-homologated` |
| Calendário | `nconc2_e_calendario` | PARCIAL: tipo de dia PASS `calendar-day-type:base-superseded`; versão do calendário RECURSO_INDISPONIVEL |
| Mapa Estatístico | `n4_3_*` (executada) | RECURSO_INDISPONIVEL para stale-head |

## Mensagem humana — correção
Três códigos de corrida chegavam à pessoa como "falha técnica": `draft:closed`, `institutional-rule:already-homologated`
e `idempotency:key-reused`. Agora são "conflito" ("O registro mudou desde que você abriu a tela…"). Guarda: `src/test/invariants/concurrency-nconc2.test.ts`.

## Recursos indisponíveis (registrados à parte)
- **Calendário (versão)**: o writer vigente exige escola ativa na janela do alcance; nenhuma escola real tem registro vigente em 2026 e a prova não fabrica escola. Coberto só pela invariante estática.
- **Mapa**: nenhuma prova transacional existente tem sessão com capacidade de Mapa e regra homologada; a corrida (`map:stale-head`) fica só na invariante estática. A prova executada recusa antes, por capacidade.
- `nconc2_b_avaliacao.sql` guarda o roteiro e o resultado; o corpo executado é derivado de `aa2_assessment_e2e.sql`.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: duas abas com login real.

## Resíduo
Nenhum: todas as execuções terminaram em `RAISE` (rollback); nenhuma conta temporária foi criada.
