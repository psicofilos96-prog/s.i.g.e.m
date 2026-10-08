# Auditoria de autenticação e sessão — NAUTH.3

Situação atual: Registro de lote (2026-10-08).

## Conferido sem mudança
- Carregando/erro de leitura da sessão = "carregando" (fail closed); nenhum dado protegido aparece durante a verificação (`session-authority.ts`).
- Refresh de token e INITIAL_SESSION não recarregam telas nem cache (`__root.tsx`).
- Sessão expirada ou encerrada em outra aba: cache limpo e volta a `/auth?motivo=expirada&redirect=<deep link seguro>`.
- Rotas protegidas sob `_authenticated` (gate gerenciado); páginas de demonstração sem login preservadas.

## Corrigido
- Troca de conta (SIGNED_IN de outro usuário, inclusive em outra aba): cache da conta anterior é descartado (`isAccountSwitch`).
- "Sair" com falha de rede: cache limpo e navegação para `/auth` sempre acontecem (try/finally).

## Testes
- `src/features/authority/nauth3.test.ts` (6) + suíte de autoridade (35 verdes); typecheck OK.

## Pendências
- INTERACTIVE_BROWSER_VALIDATION_PENDING: múltiplas abas com login real não executado (sem sessão no ambiente).
