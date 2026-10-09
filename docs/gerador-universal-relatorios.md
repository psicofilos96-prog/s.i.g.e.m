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

## REPORT.PRO.2 — pacotes por setor (`sector-packs.ts`)
Situação: parcial (PASS — SECTOR_REPORT_AND_CHART_PACKS_COMPLETE não declarado).
- 54 pacotes nos 9 setores; cada um é só uma escolha pré-montada (assunto, colunas, agrupamento, cálculo, gráfico, layout), relida com a sessão de quem gera e personalizável.
- Prontos (11), validados contra as colunas reais por teste: CIECE turmas por escola/etapa e escolas por dependência/localização; Secretaria turmas; Direção panorama de turmas e execução da alimentação; Alimentação solicitações, recebimentos, estoque, não conformidades e cobertura de execução; Admin cadastro das escolas. Todos com gráfico e tabela equivalente.
- Bloqueados (43) com motivo por extenso: matrículas/movimentação (enturmação 2026), Mapa, Censo, qualidade, Diário/frequência, Avaliação, OP, Docente, Inclusão (CID/laudo nunca entram), vagas, Livro, documentos, saúde do sistema, acessos, auditoria, fechamento NAE.
- Sem linhas, o gráfico fica vazio — nenhum número é inventado (teste).
- Pendente: a tela da Central ainda não lista os pacotes nem os abre no gerador (REPORT_UI_PENDING).

## REPORT.PRO.3 — Central no produto (2026-10-09)
Situação: parcial. UNIVERSAL_REPORT_BUILDER_COMPLETE e SECTOR_REPORT_AND_CHART_PACKS_COMPLETE **não declarados** (fontes e validação com login real pendentes).
- `/relatorios` expõe as 10 etapas: Assunto → Filtros → Colunas → Agrupamentos (até 4, subtotais, total, pivot com 2 níveis) → Cálculos (lista fechada + derivados) → Gráficos (SVG + tabela equivalente) → Layout → Prévia → Salvar → Exportar.
- 54 pacotes listados por setor com disponibilidade, motivo e "Abrir no assistente" (abre cópia; o pacote original não muda).
- Novo assunto real: Matrículas (`school_enrollments` com a sessão do usuário, sem dado nominal, registro substituído por correção sai). Pacotes CIECE/Secretaria de matrículas agora prontos (13 prontos, 41 indisponíveis).
- Modelos (só com login, na conta, append-only): salvar nova versão, duplicar, renomear (nova + arquivar antiga), favoritar, excluir rascunho (= versão arquivada; relatório não gera emissão dependente). Modelo institucional e compartilhar: desabilitados com motivo (sem capability).
- XLSX: abas Relatório, Filtros, Metodologia e fonte, Resumo, Dados do gráfico. PDF: HTML imprimível A4/A3, retrato/paisagem, capa, gráfico, tabelas, metodologia, assinaturas, paginação, sem menus do sistema. QR não oferecido (sem endpoint).
- Correção: exatamente 50.000 linhas não é mais marcado como incompleto.
- Testes: `report-studio.test.ts` (12).

### Fontes ainda sem reader governado (REPORT_SOURCES_PENDING)
Alunos nominais, movimentações, Mapa, Censo/Qualidade, Diário/frequência, Avaliação, Direção/OP, DP, Auditoria, Livro, Vagas (reader existe só por escola+ano), Documentos emitidos. Cada uma exige reader estreito com decisão de supressão/capability antes de entrar.
