# NAUTH.2 — Autenticação e ciclo de sessão (2026-10-07)
Matriz de permissões intocada; sem migration.

## Como funciona (conferido)
- Origem única da sessão: `session-authority.ts` (um ouvinte, revisão por conta; erro de leitura = falha fechada, nunca "sem login"). Principal institucional × pessoa resolvido uma vez em `useSessionAuthority` (chave conta+revisão), consumido por menu, StationGate e telas.
- Carregamento: StationGate não monta conteúdo enquanto a autoridade não foi lida; erro mostra "Não conseguimos abrir sua área".
- Rotas com dado: `ClassRouteGate` — com sessão só banco, sem sessão laboratório; o banco recusa de todo modo (RLS/writers).
- Rota de outro setor: StationGate bloqueia com "Esta página é de outro setor".

## Corrigido
- Sessão encerrada fora do botão Sair (expiração, outra aba): antes só invalidava; agora cancela e limpa o cache e leva a `/auth?motivo=expirada&redirect=<tela>`, com aviso "Sua sessão terminou". Rota pública não redireciona (`session-lifecycle.ts`, `__root.tsx`).
- Sair: marca saída voluntária ⇒ login sem retorno à tela anterior; cache limpo, histórico substituído.
- Deep link: login volta à tela pedida (`redirect` sanitizado: só caminho interno, nunca `//host`, URL externa, `\` ou `/auth`); o botão Entrar leva a tela atual. Antes todo login ia para `/diario`.
- Testes: `session-lifecycle.test.ts` (5).

## Prova
Headless: `/auth?redirect=//evil.com&motivo=expirada` mostra o aviso e recusa o destino externo; `/turmas` sem login abre sem dado real e oferece Entrar.
Pendente: INTERACTIVE_BROWSER_VALIDATION_PENDING — login real, expiração real do token, logout noutra aba e reentrada no deep link.
Observação: sem login as rotas mostram o laboratório (decisão vigente); não redirecionam para o login.
