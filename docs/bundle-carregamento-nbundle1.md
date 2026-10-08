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

## NBUNDLE.2 (2026-10-08) — reanálise após os novos módulos
Medição por `vite build` (bytes não comprimidos), composição do núcleo por mapa de fontes descartável.

| Chunk | Antes | Depois |
|---|---|---|
| index (núcleo, carregado em toda tela) | 670,0 kB | 591,0 kB |
| horarios (rota) | dentro do núcleo | 31,8 kB, só ao abrir Horários |
| exceljs | 907,8 kB | 907,8 kB (dinâmico, só ao exportar) |
| group-bar-chart (recharts) | 359,0 kB | 359,0 kB (lazy) |
| client (Lovable Cloud) | 212,5 kB | 212,5 kB |
| calendar-access-onboarding | 210,7 kB | 210,7 kB (compartilhado por Calendário e Administração; não é carregado no início) |

- Causa: `src/routes/horarios.tsx` exportava o componente da tela, o que puxava as telas de horários e o cálculo de conflitos para o núcleo. A tela foi para `src/features/schedules/horarios-layout.tsx`; comportamento e navegação iguais. `regras-avaliativas.tsx` deixou de exportar componente.
- Composição do núcleo: react-dom 524 kB, router 175 kB, seroval 105 kB, árvore de rotas 78 kB, sonner 64 kB (fonte não minificada). Sem duplicações de versão.
- Nova proteção: arquivos de rota não exportam componentes (`nbundle1-lazy.test.ts`).
- Gates: typecheck, build, 4.631 testes / 464 arquivos.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: medir carregamento real em rede móvel.
