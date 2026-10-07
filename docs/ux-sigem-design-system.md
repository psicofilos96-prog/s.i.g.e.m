# SIGEM — Design system
- Tokens únicos em `src/styles.css` (cores oklch semânticas, `--shadow-panel`, `--radius`, `--sidebar-*`, `--territory-*`); nenhuma cor crua em componente (barrado por teste).
- Tipografia: Outfit (títulos), Figtree (texto), IBM Plex Mono (códigos).
- Primitivas de estado: `src/components/sigem/states.tsx`; padrões: `patterns.tsx`, `workspace-ui.tsx`, `filter-bar.tsx`, `data-grid.tsx`.
- Carregamento de área: esqueleto (`data-sigem-shell-skeleton`), nunca texto cru.
- Bloqueio por estação: cartão centrado, uma ação ("Voltar para a minha área").
- Login: campos 48px, rótulo visível, mostrar senha, erro em `role=alert`.

## N3.2 — PARTIAL (CONTINUE_FROM=N3.2.1)
Inventário de rotas em docs/ux-sigem-migracao-rotas.md (classificação heurística). Homes de estação, sidebar/topbar, migração das rotas ANTIGA e regressão visual por breakpoint pendentes.

## NUX.4 — Baixa alfabetização digital (PARTIAL)
Primitivas em `src/components/sigem/guidance.tsx` (teste `guidance.test.tsx`, axe):
- `TaskGuide` — onde estou / o que fazer / próximo passo / uma ação principal.
- `SkeletonState` — carregamento com `role=status` e texto para leitor de tela.
- `AccessDeniedState` — nada revelado, um único retorno seguro (alvo de toque ≥44px).
- `GuidedErrorState` — passa por `governError`; nunca SQL/servidor cru, sempre código `op-…`.
- `FieldShell` — rótulo visível, dica e erro ligados por `aria-describedby` + `aria-invalid`.
- `ChartDataTable` — alternativa tabular de gráfico; ausência = "Não informado", nunca zero.
