## Diagnóstico (AV)
- Erros para o usuário passam por `governError` (categoria + mensagem genérica + código `op-…`), porque detalhe interno revelaria existência ou estrutura.
- `/diagnostico` é só leitura e só para Administrador Geral; aplicação de migrations é afirmada pelo CI, nunca pela tela, porque a sessão não lê o histórico do banco.

## Integridade (AW)
- Verificações de integridade só detectam e reportam (`src/features/support/integrity-checks.ts`); nunca corrigem nem gravam, porque correção silenciosa esconderia corrupção.

## NOBS.3
- Erro mostrado na tela passa por `reportGoverned` (via `userErrorText`/`presentError`): um único `correlationId` liga tela, log `governed_error` e trilha `recovery`; categoria governada mapeia para `expected.*`/`incident.*` por `GOVERNED_CLASS`, porque negar, validar ou conflitar não é incidente.
- Métricas de falha contam só rota/operação/categoria com rótulo validado (sem texto livre), porque rótulo livre vazaria dado pessoal.

## NOBS.4
- Todo "Tentar novamente"/recarregar/desistir de estado de erro passa por `useRecoveryTrail` (ou `RecoveryRetryButton`), porque recuperação sem o mesmo correlationId não liga a falha ao desfecho.

## Lote 12 Expansão (`admin-health.ts`)
- Status de módulo só de verificação executada e recente; backup só "verificado" com restauração testada e integridade conferida; operador técnico nunca recebe capacidade humana nem curinga; segredos só por nome e data de rotação, porque saúde ou backup afirmados sem evidência seriam falsa garantia.
