# Auditoria final de matrizes curriculares e catálogos — NCURR.3

Situação atual: Registro de lote (2026-10-08).

Escopo: lista, detalhe temporal, comparação, histórico, importação em prévia (D1), aplicabilidade, integrações (Turmas, Diário, Horários, Avaliação). Nenhum conteúdo homologado.

## Correções
- Importação D1 em prévia: tabela ganhou caption e `th scope="col"`; situação passa por `knownLabel` e, antes da leitura, mostra "Situação ainda não lida" em vez de "—".

## Conferido
Comparação por itemKey com carga ausente = "Ainda não configurado" (NCURR.1); "Uso nas outras telas" nunca fica pronto sem homologação lida (NCURR.2); Horários "não calculável" sem carga; gravação só pelos writers canônicos; tabelas do quadro e comparação com caption/scope.

## Pendências
- DEPENDE_DADO: matriz curricular oficial e catálogos oficiais.
- Autoridade de homologação (R5) separada; ASSIGNMENT_PENDING.
- INTERACTIVE_BROWSER_VALIDATION_PENDING.

Teste: `src/features/curriculum/ncurr3.test.ts`.
