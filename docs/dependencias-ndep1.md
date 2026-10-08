# NDEP.1 — Auditoria de dependências (2026-10-08)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente** (NDEP.2, 2026-10-08). Seção NDEP.2 descreve o estado atual das bibliotecas.
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

## NDEP.2 (2026-10-08) — revisão após os lotes finais
- Removidas 12 bibliotecas sem nenhum uso e os 12 componentes de interface de modelo que eram seu único consumidor (nenhuma tela os importava): `@radix-ui/react-{accordion,aspect-ratio,avatar,context-menu,hover-card,menubar,slider,toggle-group,scroll-area}`, `input-otp`, `react-resizable-panels`, `react-hook-form`.
- Mantidos componentes sem tela mas guardados por teste (`carousel`, `pagination`, `sidebar`, `navigation-menu`) e `calendar`/`chart` (com `react-day-picker`/`date-fns`, `recharts` usado nos gráficos).
- Duplicações: `react`, `react-dom`, `@tanstack/react-router`, `@tanstack/router-core`, `@tanstack/react-query`, `@supabase/supabase-js`, `zod` têm uma única versão.
- `exceljs` 4.4.0 segue a última versão; vulnerabilidades transitivas (`brace-expansion`, `uuid`) sem correção, risco baixo (só navegador, arquivo do usuário, teto 20 MB). REVISAR.
- Nenhuma atualização de versão. Gates: typecheck OK, build OK, 4.630 testes / 464 arquivos (inclui exportações XLSX/CSV/PDF).
