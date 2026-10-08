# SIGEM — Arquitetura de informação

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.

- Casca: menu navy por ambiente de trabalho (`src/config/navigation.ts`), topo com contexto, busca, avisos e conta.
- Rotas públicas e `/auth` não recebem a casca.
- Cada estação abre em `STATION_HOME`; páginas fora da estação mostram orientação, e o servidor também recusa.
- Próximo: homes como "o que precisa de você hoje" e redução de páginas redundantes (N3.2).

## N3.2 — PARTIAL (CONTINUE_FROM=N3.2.1)
Inventário de rotas em docs/ux-sigem-migracao-rotas.md (classificação heurística). Homes de estação, sidebar/topbar, migração das rotas ANTIGA e regressão visual por breakpoint pendentes.
