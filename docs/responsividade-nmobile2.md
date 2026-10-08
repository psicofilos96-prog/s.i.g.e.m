# NMOBILE.2 — Fechamento dos gaps mobile (2026-10-08)

## Situação atual
- Classe: **Registro de lote**. Complementa `responsividade-nmobile1.md`.

## Varredura headless
Viewports: 390×844 e 820×1180 com toque (ponteiro grosso, mínimo 44 px) e 640 px CSS com DPR 2 (zoom 200%, ponteiro fino, mínimo 24 px — WCAG 2.5.8).
Rotas sem login: /diario, /diario/chamadas, /diario/aulas, /secretaria, /secretaria/vagas, /familia, /autorizacoes-familia, /central-de-acessos, /pendencias, /planejamento, /avaliacoes-do-professor, /turmas, /relatorios (39 combinações).
- Antes: 168 alvos abaixo do mínimo. Depois: **0**. Rolagem horizontal: **0** antes e depois.
- Alvo da home do Diário: link "Histórico de aulas e experiências" (20 px de altura) → 44 px no toque.

## Correções (só apresentação, nos componentes compartilhados)
- Botão ícone: `shrink-0` (no cabeçalho os botões menu/busca/avisos encolhiam para 30–42 px).
- Campo de texto, campo de data e seu botão de calendário, seletor: 44 px no toque.
- Caixa de seleção: área de toque invisível de 44 px (visual 16 px inalterado).
- Ajuda da página, "O que é …?", resumo de ajuda, migalha "Início", busca do cabeçalho: 44 px no toque.
- Links de nome em listas (turmas, estudantes, profissionais, matrizes, atuações): 24 px no desktop, 44 px no toque.
- Gerador/catálogo de relatórios: passos, campos e seletores com 44 px no toque.
- Teclado virtual: `interactive-widget=resizes-content` no viewport e `scroll-margin-block: 6rem` nos campos, para a ação e o campo focado não ficarem cobertos; diálogos já limitados a 100dvh (NMOBILE.1).

## Testes / evidências
`src/components/mobile-nmobile2.test.ts`; capturas em Files, pasta `nmobile2-screenshots`.

## Pendências
- INTERACTIVE_BROWSER_VALIDATION_PENDING: telas com login e teclado virtual em aparelho físico (a simulação headless não abre teclado real).
