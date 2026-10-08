# NOBS.4 — Trilha de recuperação dos erros

**Situação atual:** Registro de lote (2026-10-08).

## O que foi feito
- `src/lib/observability/recovery-trail.ts` (`createRecoveryTrail`/`useRecoveryTrail`): o erro é governado uma vez e o mesmo código `op-…` aparece na tela e no log. Cada ação grava o evento `recovery` com o desfecho `nova-tentativa`, `recarregou`, `desistiu` ou `recuperado`. `recuperado` só é gravado quando a tela de erro sai depois de uma nova tentativa.
- Gravamos só rota, operação e desfecho. Não há dado pessoal nem envio de telemetria para fora, e nenhuma política de retenção foi criada.
- Botões conectados à trilha:
  - `RouteErrorState`: Tentar novamente e Ir para o início.
  - `GuidedErrorState`: usado pelo painel de revisão docente.
  - Erro raiz (`__root`): o texto passou ao pt-BR governado, com o código.
  - Falha ao abrir a área no AppShell (recarregar).
  - `DataGrid`.
  - Unidades (lista e detalhe).
  - Rascunho do assistente de matrícula.
  - `RecoveryRetryButton`: componente compartilhado para os casos acima que não têm objeto de erro.
- Testes em `src/lib/observability/nobs4.test.ts`: rede, stale-head, autorização, falha inesperada, desistiu/recarregou e "sem nova tentativa não afirma recuperação".

## Pendências
- INTERACTIVE_BROWSER_VALIDATION_PENDING: falta conferir com login real que o evento sai no log publicado.
- `ErrorState` usado direto (sem `GuidedErrorState`) e `ConcurrencyConflictNotice` continuam sem trilha quando a tela não passa o erro: REVISAR tela a tela.
- Fecha a parte NOBS.3 do gap NFINAL.7 nº 8. A parte de erros por campo/célula (NFORM.1) continua aberta.

## Complemento (2026-10-08)
- `ErrorState` direto (portal público, publicações, integrações, central institucional) passou a registrar "nova tentativa" pela trilha (`RecoveryRetryButton`); quem já governou o erro (GuidedErrorState) usa `traced` para não duplicar.
- `ConcurrencyConflictNotice`: "Recarregar versão atual" registra "recarregou".
- Teste: `src/components/sigem/states-recovery-nobs4.test.tsx`. O botão da vitrine `/design-system` é demonstração inerte.
- Pendência: INTERACTIVE_BROWSER_VALIDATION_PENDING (queda real de rede com login).
