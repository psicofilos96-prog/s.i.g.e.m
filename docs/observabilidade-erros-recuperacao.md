# NOBS.1 — Erros, observabilidade e recuperação

Status: NÃO PASSOU (parcial).

## Feito (2026-10-07)
- `governError` ganhou duas categorias com próxima ação própria: `sessao-expirada` (entrar de novo) e `sem-conexao` (verificar internet), avaliadas antes de `autorizacao`.
- Categorias atuais: sessão expirada, sem conexão, validação, autorização, conflito (dado desatualizado / versão), registro fechado, dependência normativa, fonte ausente, indisponível, falha técnica.
- Mensagem da tela = texto pt-BR + código `op-…` aleatório; detalhe técnico passa por `redactText` e fica só em log.
- Teste: `src/lib/observability/governed-errors-nobs1.test.ts` (4/4); observabilidade + suporte 58/58.

## Pendente
- Telas que ainda mostram `error.message` cru (ex.: Horários `readableClasses`) — inventariar e passar por `userErrorText`.
- Error boundary por estação; retry só em leitura; estado offline nos fluxos móveis; correlação nos logs do servidor por rota.
- Suíte completa, typecheck e build não rodados nesta rodada.
