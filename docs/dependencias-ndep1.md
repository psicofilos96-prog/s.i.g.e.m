# NDEP.1 — Auditoria de dependências (2026-10-08)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Registro de lote**. Instantâneo do lote na data em que foi escrito.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


## Alterado (mínimo, compatível)
- Removido `@hookform/resolvers` — nenhum import no código.
- `overrides` patch: `js-yaml` 4.3.0 → 4.3.2 (via @tanstack/react-start) e `source-map-js` 1.2.1 → 1.2.2
  (via @tailwindcss/vite) — corrigem DoS de CPU conhecidos; mesma versão maior.

## Mantido e por quê
- `@tailwindcss/vite`, `@tanstack/router-plugin`, `vite-tsconfig-paths`: usados pela configuração de build
  (sem import direto em `src`).
- `date-fns`: dependência requerida por `react-day-picker`.
- `exceljs` 4.4.0 (última): ainda traz `brace-expansion` e `uuid` vulneráveis. Só é carregado sob demanda
  na exportação XLSX (`report-engine.ts`, import dinâmico) e nunca processa padrões glob nem buffers vindos
  do usuário; forçar versões maiores desses pacotes quebraria o `archiver`/`exceljs`. REVISAR quando sair versão nova.
- Sem upgrades por estética.

## Bundles pesados
- `exceljs` 930 kB — já isolado em arquivo separado, só baixado ao exportar XLSX.
- entrada principal 684 kB; `avaliacao-desempenho` 387 kB (gráficos) — já por rota. Nenhuma mudança.

## Gates
typecheck OK, build OK, suíte completa, varredura de dependências rerodada.
