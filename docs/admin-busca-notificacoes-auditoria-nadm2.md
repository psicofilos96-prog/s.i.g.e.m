# NADM.2 — Admin, busca, notificações e auditoria (2026-10-07)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Registro de lote**. Instantâneo do lote na data em que foi escrito.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


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

## NADM.4 (2026-10-08)
- Home Admin (`/administracao-geral`): painel "Situação da administração" com dados reais lidos pela sessão (`admin_account_overview`: contas, bloqueadas, troca de senha pendente, nunca entraram; `capability_policies`: última versão homologada e rascunhos); leitura negada = "Não disponível", nunca zero — FEITO (`admin-home.test.ts`).
- Regras da rede: lista `NETWORK_RULE_SCREENS` na home aponta só telas existentes (acessos, institucionais, avaliativas, situação, calendário, matrizes), verificado por teste; não cria nem homologa regra — FEITO.
- Integração: atalhos da home para Central de Acessos e Auditoria. Busca e notificações seguem no cabeçalho, sem mudança.
- Exportação de auditoria: continua bloqueada sem `exportar-auditoria` atribuída (ASSIGNMENT_PENDING).
- Central de Acessos — design final, filtros de auditoria por setor/data/ator na tela, agrupamento de notificações: PENDENTE (não alterados neste lote).
- Mobile sem login (390/1280): `/administracao-geral`, `/central-de-acessos`, `/auditoria` sem rolagem lateral. Escopos e dados com login real: INTERACTIVE_BROWSER_VALIDATION_PENDING.
