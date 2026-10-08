# NDATA.2 — Filas de revisão da qualidade dos dados

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Registro de lote**. Instantâneo do lote na data em que foi escrito.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Tela: `/qualidade-dos-dados`. Só sinaliza; nenhum fato oficial é alterado. A única gravação é a revisão humana (`record_data_quality_review`).

## Classes (calculadas na hora, nunca gravadas)
| Classe | Quando |
|---|---|
| ERRO_TECNICO | a fonte não pôde ser lida pela conta (regra "não verificável"); nunca vira "sem problema" |
| DADO_A_REVISAR | matrículas concorrentes, alocação sem participação, regência fora da matriz, atuação encerrada, importação com conflito, matriz ambígua, 2+ calendários |
| AUSENCIA_CONFIGURACAO | nenhuma matriz, nenhum calendário, grade sem jornada, correspondência exigida não cadastrada |
| ESPERADO | documento emitido sobre fato depois retificado (o documento continua válido como foi emitido) |

## Filtros e correção
Escola (obrigatória; só escolas que a conta pode ler), setor/domínio, classe, estado. Cada item explica o problema e tem "Abrir a tela de correção", que leva à tela do writer oficial.

## Testes (`quality-classes.test.ts`)
Classificação por regra/evidência; fonte ilegível = ERRO_TECNICO; detecção não altera a entrada; achados só da escola consultada; a fonte da central não tem insert/update/delete e só chama o writer de revisão; 9.763 matrículas + 698 turmas detectadas em < 1 s.

## Pendente
Tempo das leituras reais com login e isolamento escola A × B pela RLS = INTERACTIVE_BROWSER_VALIDATION_PENDING (a conta técnica não executa as funções de leitura).
