# NBUNDLE.1 — Bundle e carregamento do frontend

## Situação atual
Classe: Registro de lote (2026-10-08).

Medição por `vite build` (bytes não comprimidos, `dist/client/assets`).

| Chunk | Antes | Depois |
|---|---|---|
| avaliacao-desempenho (rota) | 386,6 kB | 19,6 kB |
| group-bar-chart (recharts, sob demanda) | — | 367,7 kB, só quando há gráfico |
| index (núcleo compartilhado) | 686,8 kB | 687,4 kB |
| exceljs | 929,6 kB | 929,6 kB (já dinâmico, só ao exportar) |
| client (Lovable Cloud) | 217,6 kB | 217,6 kB |
| calendar-access-onboarding | 211,2 kB | 211,2 kB |

- Rotas já são divididas automaticamente (TanStack autoCodeSplitting).
- Mudança: gráfico da Avaliação e Desempenho carrega recharts por `lazy` com esqueleto; comportamento igual.
- Guardado por `src/test/invariants/nbundle1-lazy.test.ts`.
- REVISAR: núcleo `index` (687 kB) e `calendar-access-onboarding` (211 kB, compartilhado pelo shell/calendário) — dividir exige mexer na navegação do shell; não feito para não quebrar navegação.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: medir carregamento real em rede móvel.
