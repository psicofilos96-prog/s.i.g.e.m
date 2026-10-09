# SIGEM — Design system

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.

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

## NUI.1 — Catálogo de padrões de texto e interação
- Fonte única: `src/components/sigem/ui-vocabulary.ts` (verbos, estados, variantes de botão, datas dd/mm/aaaa).
- Primário = `default`, secundário = `outline`, destrutivo = `destructive`.
- Destrutivo: confirmação com consequência explícita (`destructiveConfirmText`); as confirmações existentes (Diário, Calendário, Atribuição, Avaliação) já dizem o efeito.
- Data ausente = "Não informado"; configuração ausente = "Ainda não configurado"; nunca zero.
- Primitivas shadcn traduzidas (Fechar, Anterior/Próxima, Paginação, menu lateral).
- Pendente NUI.1.1: migrar `window.confirm` para AlertDialog; aplicar o catálogo tela a tela; 21 telas com error.message cru (NOBS.1); revisão visual = INTERACTIVE_BROWSER_VALIDATION_PENDING.

## NUI.1 — rodada 2: confirmação padrão
- `src/components/sigem/confirm-action.tsx`: `confirmAction({title, consequence, actionLabel, destructive})` + `<ConfirmHost/>` montado uma vez no root. Substitui `window.confirm` em cliques; consequência vazia é recusada; sem host, falha fechada (não confirma).
- Migrados: remover agrupamento e remover período (calendário), encerrar vínculo docente.
- `window.confirm` restante só em bloqueio de navegação ("sair sem salvar"), que exige resposta síncrona.
- Pendente: aplicar catálogo tela a tela; 21 telas com error.message cru; revisão visual = INTERACTIVE_BROWSER_VALIDATION_PENDING.

## UX.PREMIUM.0 (2026-10-09)
Fundação premium (tokens, AppShell, PageHeader, Card, Table) descrita em `ux-premium-sigem-2027.md`; migração das rotas piloto pendente (UX.PREMIUM.1).
