# NUX.4 — Usabilidade e acessibilidade (estado em 2026-10-07)

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
