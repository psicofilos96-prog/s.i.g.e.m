# NOBS.3 — Observabilidade técnica (2026-10-08)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Registro de lote**. Instantâneo do lote na data em que foi escrito.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


- Correlação: `governError`/`reportGoverned` gera `op-xxxxxxxxxxxx`; o mesmo código aparece na tela ("Código: op-…"), no log `governed_error` (requestId) e em `recovery`.
- Esperado × incidente (`GOVERNED_CLASS`): sessão expirada, autorização, validação, conflito (stale-head), registro fechado, regra/fonte ausente → `expected.*` (warn); sem conexão, indisponível → `incident.dependency`; falha técnica → `incident.internal` (error).
- Logs estruturados JSON, sem objetos/payload; redação ampliada: CPF, e-mail, token/JWT/chaves, `senha=…`, CID e trechos de laudo/diagnóstico.
- Métricas de falha: `failureMetrics()` por rota × operação × categoria (rótulos validados; texto livre vira "desconhecida").
- Trilha de recuperação: `recordRecovery(correlationId, "nova-tentativa"|"recuperado"|"desistiu"|"recarregou")`.
- Testes: `src/lib/observability/nobs3.test.ts` — stale-head, autorização, rede, validação, inesperado; ausência de CPF/senha/laudo/CID/e-mail/token; métricas; recuperação.

Pendências: PENDENTE — chamar `recordRecovery` nos botões "Tentar novamente" das telas; métricas ficam na memória da aba/processo (sem painel nem envio externo — INFRAESTRUTURA_PENDENTE); INTERACTIVE_BROWSER_VALIDATION_PENDING — conferir logs no app publicado.
