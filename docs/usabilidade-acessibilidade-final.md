# NUX.4 — Usabilidade e acessibilidade (estado em 2026-10-07)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


**Resultado: PARTIAL — não declarado PASS.** Nenhuma regra foi alterada.

## Feito
- Primitivas compartilhadas de orientação e estados (ver `docs/ux-sigem-design-system.md`, seção NUX.4), cobertas por axe e por testes de comportamento (erro associado ao campo, erro sem texto técnico, retorno seguro, ausência ≠ zero).
- Corrigida regressão: `/secretaria/servicos` tinha um segundo `<main>` (agora um único landmark por página). Isso também resolve a falha instável de a11y das rodadas anteriores.
- Suíte de componentes: 96/96 PASS.

## Já garantido antes (testes existentes)
Link "pular para o conteúdo", único `<main>`, botões de ícone nomeados, sem `tabIndex` positivo, `dvh`, imagens com `alt`, PWA sem service worker.

## Pendente (CONTINUE_FROM=NUX.4.1)
- Aplicar `TaskGuide`/`GuidedErrorState`/`AccessDeniedState` rota por rota (Docente, Família, Secretaria, consultas) e simplificar telas com excesso de cards/filtros.
- Trocar telas que exibem `error.message` cru (ex.: Horários) por `GuidedErrorState`.
- Contraste AA medido no navegador, zoom 200% e screenshots headless por breakpoint: INTERACTIVE_BROWSER_VALIDATION_PENDING (rotas exigem login).
- Gráficos existentes ainda sem `ChartDataTable` ao lado.

## NUX.4.1 — Primitivas aplicadas rota por rota (2026-10-07)

Aplicação central, não por tela: `src/config/route-guides.ts` (27 rotas principais) + `AppShell` renderiza `TaskGuide` (onde estou / o que fazer / próximo passo) acima do conteúdo, só no caminho exato, oculto na impressão. Detalhe/edição não herdam orientação.

| Rota / estação | Primitivas | Teste |
|---|---|---|
| 27 rotas principais (7 estações + comuns) | TaskGuide | route-guides.test.ts (4) |
| Todas as rotas | RouteErrorState → GuidedErrorState (padrão do router) | error-surfaces-nobs2.test.ts |
| Listas/carregamento | SkeletonState, AccessDeniedState (StationGate) | a11y.test.tsx (7) |
| /avaliacao-desempenho | Gráfico com tabela equivalente (todos os grupos); drill sem UUID de escola/estudante | a11y.test.tsx |

- Único gráfico do sistema (Avaliação) já tem tabela; ChartDataTable fica como padrão para gráficos novos.
- Estados vazios: os existentes já dizem por que não há dado; nenhum vira "tudo bem" nem zero.
- Simplificar cards/filtros por tela: não feito neste lote (mudaria o conteúdo de cada tela) → decisão por tela.
- Zoom 200%, teclado e mobile com navegador real: INTERACTIVE_BROWSER_VALIDATION_PENDING; cobertura headless via a11y.test.tsx.

## Estados de carregamento padronizados (2026-10-07)

- 116 avisos de "Carregando…" em parágrafo solto (78 arquivos, todas as estações) migrados para `SkeletonState` (anunciado a leitor de tela, mesmo visual).
- Guardado por `src/components/sigem/loading-states-adoption.test.ts`.
- Restam 42 menções com rótulo dinâmico ou em listas/seletores (ex.: "Carregando {label}…", item de seleção) — mantidas: já têm papel de status ou são opção de lista.
- Estados vazios e erros: vazio já usa `EmptyState` com motivo; erro usa `GuidedErrorState`/`RouteErrorState` (NOBS.2).
