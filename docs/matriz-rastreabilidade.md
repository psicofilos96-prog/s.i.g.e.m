
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

## NADM.3 (2026-10-07)
- Security scan: 26 achados (20 "error", 6 info), todos "leitura por qualquer conta autenticada" em tabelas normativas/catálogo/cadastro escolar público (norma homologada, currículo, regras do Mapa, tipos de movimentação, definições de workflow, infraestrutura e identificadores da escola, estado de instalação). Nenhum com dado de estudante, credencial ou segredo; leitura ampla é intencional (norma precisa ser legível por quem a aplica). `temporal_stand_in_neutralizations` a revisar (REVISAR). Não persistidos ⇒ não podem ser dispensados ainda.
- Central de Acessos, busca global (INVOKER + RLS de quem pesquisa), notificações (revalidação no open), auditoria (allowlist + redact; export exige `exportar-auditoria`, ASSIGNMENT_PENDING): sem mudança nesta rodada. Design final, home Admin e mobile com login real: INTERACTIVE_BROWSER_VALIDATION_PENDING.

## NSUP.2 — Estação da Supervisão (PARTIAL técnico)
- Home `/supervisao-escolar` projeta 10 ferramentas (calendário, publicações, regras homologadas, matrizes, catálogos, preparação do ano em prontidão, escolas, pendências de configuração, relatórios, histórico de atos) só das capacidades efetivas; nenhuma capacidade concedida.
- Pendências de configuração (`/qualidade-dos-dados`) e relatórios: só consulta.
- ASSIGNMENT_PENDING: `homologar-matrizes-curriculares`, `manter-catalogos-institucionais`, `manter-anos-e-periodos-letivos`, `publicar-conteudo-publico`, `exportar-auditoria`, `registrar-acompanhamento-da-supervisao` para a conta da Supervisão (não verificável sem login; a política não é legível pela sandbox).
- INTERACTIVE_BROWSER_VALIDATION_PENDING: visão com a conta supervisao@.

## NCURR.2 — Matrizes e catálogos (PARTIAL técnico)
- Já existentes: lista, detalhe por data, quadro, itens com carga (ausência por extenso), aplicabilidade (ano/escola/atributos — etapas e turnos são esquemas de catálogo), histórico, comparação entre versões, editor de sucessão/retificação, importação D1 com prévia, catálogos com histórico de valores.
- Novo: seção "Uso nas outras telas" (Turmas, Diário, Horários, Avaliação) via `matrix-integration.ts`, com testes em fixtures. Nenhum dado oficial criado.
- Pendente: valores dos catálogos de etapas/anos/turnos e matriz oficial = DADO_AGUARDADO; homologar matriz = ASSIGNMENT_PENDING; visão logada = INTERACTIVE_BROWSER_VALIDATION_PENDING.
