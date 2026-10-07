# SIGEM — Design system
- Tokens únicos em `src/styles.css` (cores oklch semânticas, `--shadow-panel`, `--radius`, `--sidebar-*`, `--territory-*`); nenhuma cor crua em componente (barrado por teste).
- Tipografia: Outfit (títulos), Figtree (texto), IBM Plex Mono (códigos).
- Primitivas de estado: `src/components/sigem/states.tsx`; padrões: `patterns.tsx`, `workspace-ui.tsx`, `filter-bar.tsx`, `data-grid.tsx`.
- Carregamento de área: esqueleto (`data-sigem-shell-skeleton`), nunca texto cru.
- Bloqueio por estação: cartão centrado, uma ação ("Voltar para a minha área").
- Login: campos 48px, rótulo visível, mostrar senha, erro em `role=alert`.
