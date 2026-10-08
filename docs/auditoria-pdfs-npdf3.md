# NPDF.3 — Revalidação de PDFs pelo harness (2026-10-08)

## Situação atual
- Classe: **Registro de lote**. Instantâneo na data; sucede `auditoria-pdfs-ndoc2.md` sem apagá-lo.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.

## Método
- Camada do harness: **static/headless** (sem login humano, sem gravação no banco). Os HTML vêm dos geradores reais do código com dados temporários extremos (140 linhas, nomes longos, códigos de 180 caracteres sem espaço), descartados em `/tmp` ao fim.
- Chromium headless, mídia de impressão, A4. Medido: páginas (`pdfinfo`), elementos além da largura útil (≈186 mm), interface do app no PDF, cabeçalho de tabela repetido (`thead` = `table-header-group`), título, e reprodução (hash do texto do PDF igual em São Paulo e Tóquio e entre duas gerações da mesma fotografia).
- Calendário: tela de impressão do laboratório (`/calendario-escolar/cal-rede-2027-regular/documento`), inspecionada visualmente.
- QR: gerado com os mesmos parâmetros da carteirinha (`qrcode-generator`, nível M) e decodificado por `jsQR`.

## Resultado por documento

| Documento | Gerador | Páginas | Vazamento | Interface do app | Cabeçalho repetido | Reprodução | Resultado |
|---|---|---|---|---|---|---|---|
| Mapa Estatístico | `renderMapDocument` | 5 | 0 | ausente | sim (2 tabelas) | idêntica (2 gerações, 2 fusos) | PASS |
| Livro de Matrícula | `bookPrintHtml` | 35 | 0 | ausente | sim | idêntica | PASS |
| Avaliação (habilidade × escola) | `HEATMAP_REPORT` + `toPrintableHtml` | 12 | 0 | ausente | sim | idêntica | PASS |
| Relatórios (motor) | `toPrintableHtml` (`indicadores-da-rede`) | 140 | 0 | ausente | sim | idêntica | PASS — 1 linha por página só com texto patológico em todas as 12 colunas (sem corte) |
| Horários | `schedulePrintHtml` | 29 | 0 | ausente | sim | idêntica | PASS |
| Calendário 2027 (laboratório) | `CalendarPrintView` | 1 (A4 paisagem) | nenhum visível | ausente | n/a | idêntica | PASS — a medição automática não se aplica à folha paisagem; conferida por imagem |
| Pedagógico — revisão do trabalho docente | `reviewPrintHtml` | 9 | 0 | ausente | sem tabela | idêntica (data do histórico no fuso de Itaperuna) | PASS |
| Pedagógico — relatório evolutivo (Inclusão) | `evolutionReportHtml` | 20 | 0 | ausente | sim | idêntica | PASS |
| Dossiê da Direção (não oficial) | `dossierPrintHtml` | 43 | 0 | ausente | sim | idêntica | PASS |
| QR da carteirinha | `student-card-view` | — | — | — | — | decodifica a URL https exata | PASS (só aparece com URL https: teste existente) |
| Documentos da Secretaria | modelo do banco | — | — | — | — | — | **TEMPLATE_INSTITUCIONAL_PENDENTE**: nenhum modelo cadastrado (0 versões); nenhum criado |

Nenhuma correção de layout foi necessária. Nenhum template, regra, dado oficial ou permissão foi criado.

## Pendências
- TEMPLATE_INSTITUCIONAL_PENDENTE: documentos da Secretaria, PEI/PAEE/relatório NEI e campos de assinatura homologados.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: PDFs gerados a partir das telas com login real (dados reais) e calendário institucional homologado (não há versão 2027 homologada); leitura do QR por câmera de celular.

Teste de regressão: `src/test/pdf-render-audit.test.ts` (bloco NPDF.3).
