# Auditoria final da Supervisão — NSUP.3

Situação atual: Registro de lote (2026-10-08).

Escopo: home, calendários, publicações, matrizes/catálogos em consulta, preparação do ano (prontidão), regras homologadas, escolas, pendências, relatórios, histórico de atos. Nenhuma permissão concedida.

## Correções
- Home da Supervisão: situação de bloco e de ferramenta passa por `knownLabel` (desconhecido = "Situação não reconhecida").
- Telas de demonstração com login (`DemoOnlyRoute`, ex.: /alunos) ganharam título principal; a falha a11y recorrente de /alunos (h1=0) foi corrigida.

## Conferido
Pendências em cinco naturezas sem ranking; exportação pelo `report-engine`; responsável só como coluna sensível; preparação do ano só lê (UNKNOWN ≠ zero); calendário só Supervisão constrói/homologa.

## Harness
`institutional-harness.mjs`: 99 PASS, 3 FAIL (todos /alunos h1, corrigidos depois); 0 usuários e 0 resíduos temporários.

## Pendências
- ASSIGNMENT_PENDING: política v8 não tem tipo de atuação da Supervisão no harness; capacidades `registrar-acompanhamento-da-supervisao`/`consultar-supervisao-da-propria-escola` sem atribuição.
- INTERACTIVE_BROWSER_VALIDATION_PENDING (conta supervisao@ real).

Teste: `src/features/school-supervision/nsup3.test.ts`.
