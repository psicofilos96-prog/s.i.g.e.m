# NDOC.2 — Auditoria de PDFs (2026-10-07)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico** (NDOCS.3, 2026-10-08). Superado por `auditoria-pdfs-npdf3.md (NPDF.3) e auditoria-impressao-nprint4.md (NPRINT.4)`; não use como instrução vigente.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Método: PDFs headless (Chromium, A4, mídia de impressão) a partir dos geradores reais com dados de teste extremos (140 linhas, nomes longos, códigos de 180 caracteres sem espaço). Medido: número de páginas, elementos fora da página, presença da interface do app, mesma saída em fusos diferentes.

| Documento | Páginas | Vazamento antes → depois | Interface do app | Reprodução | Correção |
|---|---|---|---|---|---|
| Livro de Matrícula | 8 | 0 → 0 | ausente | idêntica | — (já repetia cabeçalho e numerava páginas) |
| Relatórios (motor) | 11 → 9 | 276 → 0 | ausente | idêntica | A4, quebra de texto, colunas fixas, cabeçalho repetido |
| Documentos pedagógicos (revisão) | 3 → 7 | 8 → 0 | ausente | dependia do fuso → idêntica | quebra de texto; data do histórico no fuso America/Sao_Paulo |
| Carteirinha | cartão | nome cortado → até 2 linhas | — | — | nome não é mais truncado; QR só com URL https (teste existente) |

Teste de regressão: `src/test/pdf-render-audit.test.ts`.

Pendentes (INTERACTIVE_BROWSER_VALIDATION_PENDING — login real/harness com sessão aprovada): Mapa Estatístico, documentos da Secretaria (composição no banco), pauta/instrumentos de Avaliação, leitura do QR por câmera.
Assinaturas: nenhum documento tem campo de assinatura homologado; não criado (TEMPLATE_INSTITUCIONAL_PENDENTE).
