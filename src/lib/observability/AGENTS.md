## Diagnóstico (AV)
- Erros para o usuário passam por `governError` (categoria + mensagem genérica + código `op-…`), porque detalhe interno revelaria existência ou estrutura.
- `/diagnostico` é só leitura e só para Administrador Geral; aplicação de migrations é afirmada pelo CI, nunca pela tela, porque a sessão não lê o histórico do banco.

## Integridade (AW)
- Verificações de integridade só detectam e reportam (`src/features/support/integrity-checks.ts`); nunca corrigem nem gravam, porque correção silenciosa esconderia corrupção.

## NOBS.3
- Erro mostrado na tela passa por `reportGoverned` (via `userErrorText`/`presentError`): um único `correlationId` liga tela, log `governed_error` e trilha `recovery`; categoria governada mapeia para `expected.*`/`incident.*` por `GOVERNED_CLASS`, porque negar, validar ou conflitar não é incidente.
- Métricas de falha contam só rota/operação/categoria com rótulo validado (sem texto livre), porque rótulo livre vazaria dado pessoal.
