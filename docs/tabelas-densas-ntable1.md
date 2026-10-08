# NTABLE.1 — Tabelas densas

## Situação atual
Classe: Registro de lote. 2026-10-08.

- Alunos, profissionais e turmas já usam `DataGrid` (cabeçalho fixo, colunas por prioridade, `aria-sort`, seleção por página NPAG.1, ações por linha).
- `DataGrid`: região rolável focável por teclado (`role=region`, `tabIndex=0`); paginação como `nav` com "Página X de Y" anunciada também no celular; botões de página 44px no celular; seleção com `Set` (50.000 ids < 500 ms); removido botão "Entendi" sem efeito no estado sem permissão.
- Relatórios (prévia do gerador): cabeçalho fixo, rolagem vertical limitada e focável, legenda acessível.
- CIECE (decomposição): cabeçalhos com `scope="col"`.
- Teste: `src/components/sigem/data-grid-ntable1.test.tsx`. Dados e regras inalterados.

## Pendências
- REVISAR: Livro e auditoria não usam `DataGrid` (listas próprias); migrar exige revisão tela a tela. Ordenação estável continua via `stableSort` (NPAG.1).
- REVISAR: versão mobile em cartões não existe; colunas secundárias somem por prioridade.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: zoom 200%/400% e teclado com login real.
