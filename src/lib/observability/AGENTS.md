## Diagnóstico (AV)
- Erros para o usuário passam por `governError` (categoria + mensagem genérica + código `op-…`), porque detalhe interno revelaria existência ou estrutura.
- `/diagnostico` é só leitura e só para Administrador Geral; aplicação de migrations é afirmada pelo CI, nunca pela tela, porque a sessão não lê o histórico do banco.

## Integridade (AW)
- Verificações de integridade só detectam e reportam (`src/features/support/integrity-checks.ts`); nunca corrigem nem gravam, porque correção silenciosa esconderia corrupção.
