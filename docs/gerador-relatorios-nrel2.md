# NREL.2 — Gerador transversal de relatórios

Em `/relatorios`, seção "Montar um relatório": **Assunto → Filtros → Colunas → Prévia → Exportar**.

- Código: `src/features/reports/report-builder.ts` (modelo puro), `builder-sources.ts` (assuntos), `report-builder-page.tsx` (tela), teste `report-builder.test.ts`.
- Assuntos são adaptadores fechados; não há SQL nem fonte livre. Leitura sempre com a sessão de quem gera (RLS + capability do dado de origem); nenhum usa privilégio de serviço.
- Paginação completa (`collectAll`) até o fim real; teto de 50.000 linhas marca o arquivo como INCOMPLETO.
- Proveniência gravada em CSV/XLSX/PDF: assunto e versão, fonte, período, metodologia, acesso, setor, filtros, linhas/páginas.
- Exportação pelo motor comum (`report-engine.ts`): neutralização de fórmula, colunas sensíveis fora, ausência = "não disponível".
- Modelos salvos por conta + setor, só as escolhas (nunca dado), no navegador; revalidados ao abrir.

| Setor | Assunto | Situação |
|---|---|---|
| Secretaria / CIECE / Supervisão / OP-Direção / Admin | Cadastro das escolas | Disponível |
| Secretaria / CIECE / OP-Direção / Supervisão | Turmas | Disponível |
| NAE / OP-Direção | Alimentação: pedidos, entregas, não conformidades, movimentos, execução | Disponível |
| Avaliação | Resultados por habilidade | PENDENTE — sai pela tela de Desempenho (política de supressão) |
| DP | Vínculos funcionais | PENDENTE — sem leitor transversal autorizado |
| CIECE | Fotografia do Censo | Use a aba Relatórios do Censo |

Testes (fixtures): 9.763 linhas em 98 páginas; teto; escola A não recebe B; coluna sensível/filtro não previsto recusados; proveniência e neutralização no CSV; modelos isolados por conta/setor; assunto indisponível recusa por extenso; sem SQL.

Pendências: modelos compartilhados entre pessoas do setor (exige tabela; PENDENTE); conferência com login real de cada setor (INTERACTIVE_BROWSER_VALIDATION_PENDING).
