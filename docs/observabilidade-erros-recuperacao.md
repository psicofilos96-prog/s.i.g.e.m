# NOBS — Erros, observabilidade e recuperação

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Atualização: complementado por `observabilidade-nobs3.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Status NOBS.2: PASS — ERROR_SURFACES_AND_CONFIRMATIONS_COMPLETE (varredura final sem exposição crua injustificada).

## Padrão
- Erro do backend → `governError` / `userErrorText` / `GuidedErrorState`: mensagem pt-BR curta + `Código: op-…`; detalhe técnico só em log (`redactText`).
- Validação local escrita para a pessoa → `UserFacingError` (ou erro de domínio pt-BR como `BulkError`, `CalendarWriteRefused`); `presentError` deixa passar só esses.
- Tradutores de domínio (`followupMessage`, `familyMessage`, `writeRefusalText`, assistente de calendário) nunca devolvem o texto cru: fallback governado.
- Confirmação → `confirmAction` (consequência obrigatória); pedido de motivo/texto → `askText` (mesmo contrato do prompt). Sem host montado, ambos falham fechados.
- Fronteira de erro por rota/estação: `defaultErrorComponent = RouteErrorState` (router). Mostra mensagem governada + código; erro original vai a `console.error`; "Tentar de novo" só refaz leituras (`router.invalidate`).
- Retry: só leituras (consultas do React Query e loaders). Mutations/writers não têm retry automático; repetir é ato da pessoa.

## Migrado no NOBS.2
- window.confirm (5 sites, avisos de saída do Diário/Avaliação e remoção de observação) → `confirmAction` (`shouldBlockFn` assíncrono).
- window.prompt (≈30 sites em 13 telas: comunicação, documentos, referências curriculares, importações, alimentação, administração institucional, inclusão, acompanhamento) → `askText`.
- Texto cru: calendário externo, aplicabilidade, publicações, regras do Mapa, composição de turma, lote, leitura do navegador no calendário, tradutores com fallback cru.
- As demais ~60 leituras de `error.message` passam por tradutores de domínio com fallback genérico (verificado um a um).

## Exceções documentadas
- Aviso nativo de "sair da página" ao fechar/recarregar a aba (`enableBeforeUnload`): o navegador exige resposta síncrona e não permite janela própria.

## Testes
`src/lib/observability/error-surfaces-nobs2.test.ts`: varredura estática (nenhum window.confirm/alert/prompt; nenhum `e.message` direto para estado/tela), sessão expirada, sem conexão, autorização, conflito/stale-head, validação, falha inesperada, tradutores, confirmação destrutiva.
