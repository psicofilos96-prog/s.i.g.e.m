# Auditoria de impressão e documentos — NDOC.1 (2026-10-07)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Nenhum conteúdo institucional alterado.

## Inventário de geradores
| Gerador | Arquivo | Página | Cabeçalho de tabela repetido | Sem menu/barra |
|---|---|---|---|---|
| Calendário (interno/externo) | calendar-print-view.tsx + styles.css | A4 paisagem, margem na folha | n/a (folha única, excesso avisado) | sim (portal `.cd-print-root`) |
| Mapa Estatístico | map-structures.ts (HTML próprio) | A4 retrato | sim | sim (documento separado) |
| Livro de Matrícula/Vagas | vacancies-book.ts | A4 retrato, "Página X de Y" | sim | sim |
| Horários | schedule-print-view.tsx | herdava paisagem global (corrigido) | agora sim | print:hidden |
| Matriz curricular | matrix-print-page.tsx | herdava paisagem global (corrigido) | agora sim | print:hidden |
| Central de documentos da Secretaria | document-center-page.tsx | herdava paisagem global (corrigido) | agora sim | print:hidden |
| Avaliação (autoria) | authoring-page.tsx | herdava paisagem global (corrigido) | agora sim | print:hidden |
| Relatórios | report-engine.ts (PDF/CSV/XLSX) | do motor | — | arquivo |
| Carteirinha | sem PDF (pendente N9.2.2) | — | — | — |
| NEI/PEI/PAEE | sem gerador (pendente N8.2.2) | — | — | — |

## Achado corrigido
- `@page { size: A4 landscape; margin: 0 }` e `width: 297mm` no `body` eram globais dentro de `@media print`: toda impressão do SIGEM saía em paisagem e sem margem. Agora a página é nomeada (`cd-landscape`) e só a folha do calendário a usa; a largura fixa só vale quando a folha existe. Tabelas impressas repetem o cabeçalho e não partem linha.
- Teste: `src/test/print-css.test.ts` (3/3).

## Não feito
- Render headless + rasterização com fixtures por gerador, testes de pageCount/overflow por documento, assinaturas longas, QR, reprodução histórica: PENDENTE.
- Navegador interativo: INTERACTIVE_BROWSER_VALIDATION_PENDING.

## Status
NÃO PASS.

## Rodada 2026-10-07 (render headless, sem login)
- Antes: /calendario, /horarios, /matriz-curricular saíam em papel Carta (612×792 pt), porque não havia tamanho padrão.
- Corrigido: `@page { size: A4; }` padrão (fora do calendário, que continua com página nomeada paisagem). Depois: os três em A4 (595×842 pt); calendário 1 página, horários 2, matriz 1. Teste print-css atualizado.
- Horários: na impressão aparecem só o título da página e a trilha "Início › Horários" (não é o menu lateral/topo do sistema).
- Pendente: geradores com login (Mapa, Livro, Secretaria, avaliação, relatórios, carteirinha), assinaturas longas, QR, reprodução histórica; NEI/PEI/PAEE sem gerador.
