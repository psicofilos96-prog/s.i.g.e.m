# Frente BG — Importações governadas (fechamento da AO)

Pipeline preservado: arquivo → SHA-256 → staging imutável (`stage_import_batch`) → classificação → diff na prévia → confirmação (`record_import_event` `confirmacao`) → writer canônico do adaptador → evento `aplicada`/`falhou`/`compensacao`. Upload nunca grava entidade canônica.

## E2E de banco (`supabase/tests/bg_governed_import_e2e.sql`)
Conteúdo e adaptador (`bg-sintetico`) 100% sintéticos; transação termina em RAISE (zero resíduos). Resultado da execução: `bg-e2e-ok`.

| Caso | Resultado |
|---|---|
| Mesmo hash = mesmo lote (`already_staged`) | PASS |
| Valida / rejeitada / duplicada / conflito / já reconciliada gravadas; motivo obrigatório fora de valida/reconciliada | PASS |
| Aplicar sem confirmação; aplicar rejeitada ou reconciliada | recusado |
| Falha do writer no meio ⇒ nenhum evento `aplicada` | PASS |
| Aplicação duplicada da mesma linha | recusada |
| Reprocesso de lote inexistente; reprocesso cria lote novo encadeado | PASS |
| Staging imutável; SELECT/INSERT/UPDATE direto por app role | recusado |
| Capability só de escola (IDOR/escopo) | recusado |
| service_role e anon | recusados |

Limites honestos: a classificação conflito/reconciliada é calculada pelo motor (`import-engine.ts`, testado em `import-engine.test.ts`) e o stale-head da entidade é revalidado pelo writer canônico (base esperada), não por `record_import_event`. `import_grant` exige sessão + capability de rede `gerir-importacao-de-dados`, mas não exige pessoa natural: a recusa de ato humano por conta técnica vem dos writers canônicos. Achado `GOVERNANCE_REVIEW_PENDING`, não corrigido por ser decisão.

## Fontes
- DP: `DP_FILE_CONTRACT_PENDING` / `BLOCKED_BY_SOURCE_FILE`. Antes do adaptador real é preciso saber: identificadores estáveis, snapshot × delta, múltiplos vínculos, competência/vigência e semântica de ausência. Nenhuma coluna, carga, lotação ou status foi presumida.
- GPE: `EXTERNAL_INTEGRATION_UNDEFINED` / `NO_ACTIVE_CONTRACT`; não existe arquivo aguardado.
- Educacenso: `EDUCACENSO_LAYOUT_BLOCKED_BY_OFFICIAL_SOURCE`.

## Tela `/importacoes`
Mostra adaptador/versão, sha256 do arquivo e do conteúdo guardado, contagens por classe, motivos, prévia antes do staging, histórico de lotes e eventos; aplicação só por botão após confirmação. Competência não é exibida porque nenhum adaptador ativo a declara.
