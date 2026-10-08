# Mobile, PWA e acessibilidade AA — revisão transversal (2026-10-05)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


## Corrigido nos componentes compartilhados
- Shell: link "Pular para o conteúdo", `<main id="conteudo">` único (9 telas tinham `<main>` aninhado → `<div>`), `min-h-dvh` (barra do navegador móvel), navegação/topo ocultos na impressão.
- Botão: em ponteiro grosso (toque) altura mínima 44 px (`pointer-coarse:min-h-11`, ícone `size-11`); desktop inalterado.
- Movimento reduzido global (`prefers-reduced-motion`) para animações e transições.
- `EmptyState` usa `h2` (evitava salto de nível sob o `h1` da página).
- Páginas de erro/404 em português.
- Tabela compartilhada já rola horizontalmente no próprio contêiner (reflow a 320 px sem rolar a página).

## PWA
- Somente instalável: `public/manifest.webmanifest` (192/512), `theme-color`, `apple-touch-icon`.
- **Sem service worker** e sem cache de respostas: dados do SIGEM são privados e transacionais. Diário offline não existe porque não há arquitetura de sincronização/conflito; não deve ser prometido.
- Ícones 192/512 derivados do favicon de 64 px — substituir por arte em alta resolução quando houver.

## Testes automatizados (`src/components/a11y.test.tsx`)
axe-core sobre componentes compartilhados; varredura estática: botões de ícone com nome, sem `h-screen`, sem `tabIndex` positivo, `<img>` com `alt`, um único `<main>`, manifest válido e ausência de service worker.

## Checklist manual (não executado nesta etapa)
- [ ] Teclado completo em Diário, Família, Secretaria (Tab/Shift+Tab, Esc fecha diálogos, foco volta ao gatilho).
- [ ] NVDA/VoiceOver/TalkBack: chamada, pauta, portal da Família.
- [ ] Zoom 200% e 400% (reflow 320 px) nas telas acima.
- [ ] Contraste das cores de estado (axe roda sem contraste em jsdom).
- [ ] Erros de formulário com `aria-describedby` nas telas que não usam `FormMessage`.
- [ ] Aparelho intermediário (Android ~4 GB): tempo até interação e rolagem em listas longas.
- [ ] Impressão de telas comuns sem menu.
