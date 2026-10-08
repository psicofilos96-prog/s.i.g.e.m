# NPRINT.4 — Consistência final de impressão (2026-10-08)

## Situação atual
- Classe: **Registro de lote**. Sucede `auditoria-pdfs-npdf3.md` sem apagá-lo.
- Em conflito, prevalecem os `AGENTS.md`; o mapa é `mapa-documentacao-vigente.md`.

## Método
Geradores reais com dados temporários longos (até 300 linhas), em `/tmp` e descartados; Chromium headless, mídia de impressão, `pdfinfo` e rasterização da primeira e da última página.

| Documento | Páginas | Folha | Vazamento | Interface do app | Cabeçalho de tabela repetido | Assinaturas | Rodapé "Página X de Y" |
|---|---|---|---|---|---|---|---|
| Mapa Estatístico | 4 | A4 retrato | 0 | ausente | sim | sim (linhas no fim) | corrigido |
| Livro de Matrícula | 4 | A4 retrato | 0 | ausente | sim | n/a | já existia |
| Relatórios (motor) | 7 | A4 | 0 | ausente | sim | n/a | corrigido |
| Avaliação | 1 | A4 | 0 | ausente | sim | n/a | corrigido (motor) |
| Dossiê da Direção | 7 | A4 | 0 | ausente | sim | n/a | corrigido (motor) |
| Horários | 4 | A4 | 0 | ausente | sim | n/a | corrigido |
| Revisão do trabalho docente | 4 | A4 | 0 | ausente | sem tabela | n/a | corrigido |
| Relatório evolutivo / de inclusão | 1 | A4 | 0 | ausente | sim | n/a | corrigido |
| Calendário 2027 (6 modelos externos) | 1 | A4 paisagem | 0 | ausente | n/a | n/a | n/a (folha única; medido em CAL.EXT.3.1) |
| QR da carteirinha | — | — | — | — | — | — | decodifica a URL exata (NPDF.3) |

Única correção: numeração de páginas no rodapé (`@bottom-right`), só apresentação; conteúdo, regras e templates intocados. Nenhum documento usa logo em imagem (cabeçalho é texto institucional).

## Pendências
- TEMPLATE_INSTITUCIONAL_PENDENTE: documentos da Secretaria, PEI/PAEE e assinaturas homologadas.
- REVISAR: "Gerado em" em formato técnico no rodapé do motor de relatórios.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: impressão a partir das telas com login real; QR por câmera.

Teste: `src/test/pdf-render-audit.test.ts` (bloco NPRINT.4).
