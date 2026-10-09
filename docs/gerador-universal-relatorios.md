# Gerador universal de relatórios (REPORT.PRO.1)

**Situação atual:** Registro de lote — parcial (PASS não declarado).

## Entregue
- `src/features/reports/report-analytics.ts` (motor puro sobre linhas já devolvidas pelo reader do usuário): agrupamento multinível (até 4), subtotais, total geral, ordenação múltipla, pivot; cálculos só da lista fechada count, distinct, sum, avg, min, max + percentual, diferença, variação, razão; ausência nunca vira zero (contada à parte; divisão por zero = não disponível); coluna sensível não entra em cálculo.
- Gráficos (barras, horizontais, empilhadas, linha, área, donut, dispersão, ranking) com regras de adequação (pizza só composição ≤ 8 fatias; linha/área só temporal; dispersão 2 medidas; ranking marcado como descritivo), tabela acessível equivalente e texto de fonte/metodologia.
- Layout: A4/A3, retrato/paisagem, capa, cabeçalho/rodapé, logo https, filtros, metodologia, observações, até 4 assinaturas, paginação. QR recusado: não há endpoint de verificação de relatório.
- Prévia declara amostra; exportação usa o conjunto completo e recusa se incompleta (teto já existente de 50.000 linhas).
- Catálogo de assuntos completo: além de escolas, turmas e 5 de Alimentação (com leitura real), os demais aparecem como indisponíveis com o motivo.
- 12 testes novos (incluindo 50.000 linhas); 41 existentes continuam passando.

## Já existia (NREL.2/NREL.3)
Assistente Assunto → Filtros → Colunas → Prévia → Exportar; CSV/XLSX/PDF pelo motor único; modelos pessoais no servidor, versionados, sem localStorage; isolamento A/B na exportação testado.

## Pendências (bloqueiam o PASS)
- REPORT_UI_PENDING: a tela ainda não oferece passos de agrupamento, cálculos, gráficos e layout; o motor existe só em código.
- REPORT_SOURCES_PENDING: infraestrutura, alunos/matrículas, movimentações, Mapa, profissionais/DP, jornadas, frequência, Avaliação, Censo, Inclusão, Secretaria, Família, auditoria sem adaptador governado.
- REPORT_TEMPLATE_ACTIONS_PENDING: duplicar, renomear, favorito e modelo institucional por setor (sem capability).
- REPORT_XLSX_SHEETS_PENDING: XLSX com abas de metadados/gráficos.
- REPORT_QR_PENDING: endpoint de verificação.
- Testes autenticados (duas escolas reais, rede) e PDF renderizado não executados.
