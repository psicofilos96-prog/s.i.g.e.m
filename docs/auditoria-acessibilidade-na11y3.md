# Auditoria de acessibilidade — NA11Y.3

Situação atual: Registro de lote (2026-10-08).

Método: `scripts/na11y3-audit.mjs` + `scripts/na11y3/a11y_audit.py` — 8 contas sintéticas efêmeras (limpeza: 0 contas, 0 resíduos), 32 rotas principais, axe-core WCAG 2.0/2.1 A+AA (contraste, labels, ARIA, dialogs, tabelas, nomes), landmarks/h1/link de pular, 15 Tabs com foco visível, zoom 200% (viewport 640×450). Dados brutos: `docs/na11y3/achados.json`; screenshots em Files `na11y3-screenshots`.

| Rota | Achado | Correção | Teste |
|---|---|---|---|
| todas (32) | axe: 0 violações A/AA (inclui contraste) | — | `docs/na11y3/achados.json` |
| todas (32) | 1 `main`, link de pular presente, foco visível em 15 Tabs | — | idem |
| `/ciece` | sem h1 enquanto o catálogo carrega (e no erro) | h1 oculto nos estados de carregamento/erro | `src/components/sigem/na11y3.test.ts` |
| `/qualidade-dos-dados` | zoom 200%: seletor de escola 20 px além da tela | seletor ocupa a largura disponível no estreito | idem |

Gráficos: as telas com gráfico já têm tabela equivalente (`ChartDataTable`, guardado em `guidance.test.tsx`); mensagens de erro usam `StatePanel`/`GuidedErrorState` com texto (sem só cor).

Pendências
- Auditoria não reexecutada após as 2 correções.
- Supervisão, Avaliação e Alimentação sem perfil sintético (ASSIGNMENT_PENDING); dialogs abertos por ação não foram acionados; leitor de tela real e login real: INTERACTIVE_BROWSER_VALIDATION_PENDING.
- REVISAR: no celular a barra superior mostra dois ícones de sino.
