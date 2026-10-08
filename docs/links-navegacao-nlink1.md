# Links e ações navegacionais — NLINK.1

## Situação atual
Registro de lote (2026-10-08).

- Varredura de todos os destinos literais (`to`/`href`) em menus, cards, guias, breadcrumbs, relatórios, documentos e páginas públicas contra a árvore de rotas: nenhum destino inexistente (só arquivos estáticos do cabeçalho).
- Corrigido: botão "Avisos" duplicado e sem ação no topo (o sino real `NotificationBell` continua); botão "Ajuda" sem destino agora abre `/ajuda`; `InlineLink` (botão sem ação, sem uso) removido.
- Atalhos para áreas sem acesso: regra de NPERM.4/NNAV.2 mantida (breadcrumb só vira link se a estação pode abrir; Integrações só com capacidade de rede).
- Smoke test: `src/test/invariants/nlink1-links.test.ts` (destino inexistente ou botão de ícone sem ação no topo falham).
- Limite: destinos montados em tempo de execução são cobertos pelo typecheck do roteador, não por este teste. Clique com login real: INTERACTIVE_BROWSER_VALIDATION_PENDING.
