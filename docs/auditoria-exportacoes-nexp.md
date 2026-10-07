# Auditoria de exportação e download (2026-10-07)

Regra: arquivo = as mesmas linhas, filtros e escopo que a tela já leu com a conta (RLS/RPC). Nenhuma exportação faz consulta mais ampla.

## Inventário (16 pontos)
| Tela | Formatos | Fonte do arquivo | Motor |
|---|---|---|---|
| Auditoria | CSV | lista filtrada da tela | report-engine |
| Operações em lote | CSV | resultado do lote | report-engine |
| Censo | CSV, PDF | fotografia/conciliação exibida | report-engine |
| Painel da rede | CSV | leitura exibida | report-engine |
| Inclusão | CSV mínimo | registros do estudante, minimizados | próprio (neutraliza fórmula) |
| Central de Acessos | CSV, XLSX | lista filtrada (exporta tudo, tela mostra 400) | report-engine |
| Gerador de relatórios | CSV, XLSX, PDF | todas as páginas do reader, teto 50.000 declarado | report-engine |
| Trajetória do estudante | CSV | ficha exibida | report-engine |
| Gestão escolar | CSV | blocos exibidos | report-engine |
| Alimentação — pedidos/consumo | CSV | listas exibidas | report-engine |
| Alimentação — relatórios | CSV, XLSX, PDF | mesma RPC e filtros, todas as páginas | report-engine |
| Livro de vagas/matrícula | CSV, XLSX, impressão | lista filtrada | report-engine |
| Supervisão | CSV | lista exibida | report-engine |
| Quadro docente | CSV | resultados exibidos | report-engine |
| Mapa da rede | CSV, XLSX | lista filtrada | report-engine |
| Mapa da escola | CSV, XLSX, PDF | células exibidas (fotografia oficial quando houver) | report-engine |

## Corrigido
- Auditoria: cada fonte lê até 500 eventos; ao atingir o limite, a tela e o CSV dizem "INCOMPLETO" (antes cortava em silêncio).
- Alimentação — relatórios: exportação acima do limite agora diz "INCOMPLETO: X de Y linhas" (antes cortava em silêncio).
- Inclusão: CSV com BOM e CRLF (acentos corretos no Excel); fórmula já era neutralizada.

## Mantido bloqueado
- Exportar auditoria exige `exportar-auditoria`; conferido no banco: nenhuma política a atribui (0 regras). Continua bloqueado — ASSIGNMENT_PENDING (decisão sua).
- Avaliação, DP e Censo no Gerador seguem indisponíveis com motivo por extenso (sem fonte).

## Testes
`src/features/reports/export-scope-nexp.test.ts`: volume (12.345 linhas em 13 páginas sem perda; teto declarado), isolamento escola A × B em CSV/XLSX/PDF, filtro idêntico à prévia, coluna sensível excluída, paginação incompleta, CSV da inclusão.
Pendente: INTERACTIVE_BROWSER_VALIDATION_PENDING — baixar os arquivos com login real de duas escolas.
