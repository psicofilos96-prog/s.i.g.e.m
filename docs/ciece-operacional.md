# Frente O — CIECE operacional

**Status: PARTIAL.**

Componentes já existentes reutilizados como console de operação:
- Cobertura/reconciliação: `src/features/census-reconciliation/` (projeção derivada, 1.882 comparações, classes EXACT/EXPLAINED/SOURCE_DIVERGENCE/CANONICAL_MISSING/SOURCE_MISSING/NOT_COMPARABLE).
- Qualidade de dados / não informados: `src/features/data-quality/`.
- Status das importações: ledger `technical_execution_operations` (7 operações) lido só agregado.
- Consultas analíticas: `queryAnalytic` com autorização e política de divulgação; drill-down é nova consulta.
- Exportação pelo motor de relatórios (nunca amplia permissão).

Não há editor universal nem acesso técnico irrestrito. Pendente: tela única que agregue os quatro painéis acima e paginação servidor para grandes volumes.
