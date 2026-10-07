# NADM.2 — Admin, busca, notificações e auditoria (2026-10-07)

Auditoria técnica; nenhuma tela alterada neste lote.

| Item | Situação | Prova |
|---|---|---|
| Busca global — backend | `global_search` é SECURITY INVOKER (RLS de quem pesquisa); só nome/código vigente; identificador oficial só por igualdade exata; sem recentes (termos contêm nomes) | `pg_proc.prosecdef = false`; `global-search.test.ts` 8/8 |
| Notificações — modelo | eventos idempotentes, destinatário só por regra, `open_notification` revalida, lida = `notification_reads` | `notifications.test.ts` PASS |
| Auditoria — modelo | projeção dos ledgers por RLS, allowlist + `redact`; exportação exige `exportar-auditoria` (sem política) ⇒ export **DECISAO pendente** | `audit-model.test.ts` 9/9 |
| Central de acessos — design system, filtros, exportação | PENDENTE | — |
| Busca — categorias/autocomplete na UI | PENDENTE | — |
| Central de notificações — agrupamento por tipo | PENDENTE | — |
| Auditoria — filtros setor/data/ator/tipo na UI | PENDENTE | — |
| Home Admin | PENDENTE | — |
| Full suite / deep / build / security | NÃO EXECUTADO | — |

Sem PASS. CONTINUE_FROM=NADM.2 (parte 2).
