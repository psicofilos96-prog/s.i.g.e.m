# NCSS.2 — Tokens visuais e CSS compartilhado

## Situação atual
Classe: Registro de lote (2026-10-08).

- Tipografia: tamanhos avulsos 10px/0,625rem e 11px/0,6875rem (≈30 usos) viraram tokens `text-2xs` e `text-micro` em `src/styles.css`; guardado por `src/test/invariants/ncss2-tokens.test.ts`.
- Foco: gatilho do menu de navegação removia o contorno sem substituto; agora tem anel `focus-visible`. Itens de menu (Radix) mantêm realce por fundo; linha da chamada já tinha anel próprio.
- Cores cruas seguem barradas pelo teste existente; impressão não alterada (`print:` e folhas de documento preservadas).
- Tema escuro: não suportado de forma completa (um único bloco `.dark`); não testado além do existente.
- REVISAR: tamanhos 9px e 0,65rem (carteirinha, cabeçalhos do Início) e sombras de borda de 1px mantidos — fazem parte de layouts de impressão/identidade.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: regressão visual com login real.
