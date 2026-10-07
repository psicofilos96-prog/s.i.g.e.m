
## N11.2.3 (rodada 2, 2026-10-07)
- Transporte: formulário de vínculo estudante↔ponto (cadastro canônico com acesso da própria conta; banco recusa estudante sem matrícula na escola) — FEITO.
- Assistente de Relatórios em `/relatorios`: ordena só o catálogo existente pelas palavras da pergunta; não executa nem exporta; sem correspondência diz que não encontrou — FEITO (testes `report-suggest.test.ts`).
- Construtor de Documentos: TEMPLATE_INSTITUCIONAL_PENDENTE. UX do NAE: INTERACTIVE_BROWSER_VALIDATION_PENDING. Manutenção de infraestrutura: DEPENDE_DECISAO. Capacidades de transporte: ASSIGNMENT_PENDING.

## N7.2.3 (2026-10-07)
- Fiscalização do Diário inclui turmas da escola sem nenhum registro (aula prevista pela grade ⇒ "Não registrada"; sem grade nada é faltante) — FEITO.
- Dossiê da Direção, SIPE/SIA, Conselho/Reclassificação: sem mudança nesta rodada (estado anterior). Aprovação obrigatória da prova, Quadro Permanente, `revisar-trabalho-docente`: DEPENDE_DECISAO/ASSIGNMENT_PENDING. Reclassificação: regra institucional não homologada (DEPENDE_DECISAO). Busca Ativa: autoridade final indefinida (DEPENDE_DECISAO). Duas escolas/isolamento/PDF com login real: INTERACTIVE_BROWSER_VALIDATION_PENDING.

## N6.2.3 (2026-10-07)
- Heatmap habilidade × escola agora para qualquer métrica registrada (antes só a primeira) — FEITO. Já existentes: comparação temporal com recusa por extenso, drill-down aos registros, gráfico com tabela, supressão por política, metas separadas, ciclo da edição (0227).
- Pendentes: exportação CSV/PDF do heatmap pelo motor de relatórios (PENDENTE); série de evolução com 3+ edições na tela (motor `compareSeries` pronto, tela compara 2) (PENDENTE); BNCC↔SAEB sem fonte oficial (DADO_AGUARDADO); visão com login real (INTERACTIVE_BROWSER_VALIDATION_PENDING).
