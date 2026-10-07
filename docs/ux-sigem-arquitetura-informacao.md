# SIGEM — Arquitetura de informação
- Casca: menu navy por ambiente de trabalho (`src/config/navigation.ts`), topo com contexto, busca, avisos e conta.
- Rotas públicas e `/auth` não recebem a casca.
- Cada estação abre em `STATION_HOME`; páginas fora da estação mostram orientação, e o servidor também recusa.
- Próximo: homes como "o que precisa de você hoje" e redução de páginas redundantes (N3.2).
