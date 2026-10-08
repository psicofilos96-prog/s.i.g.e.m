# OP e Direção — produto

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


| Requisito | Estado | Teste |
|---|---|---|
| A/C Home "o que depende de você" | Parcial: pendências agrupadas e ações distintas | vitest school-followup |
| B Ocorrências dossiê | Pendente | — |
| D Diário fiscalização | N7.2: projeção pura somente leitura (`src/features/diary-oversight/`): aula/chamada registrada × em elaboração × não registrada a partir da grade canônica; sem grade nada é faltante; tela e leitura real PENDENTES | diary-oversight (2) |
| E SIPE fila OP | Pendente | — |
| F SIA | Pendente | — |
| G Conselho/Reclassificação | Existente (link por turma) | — |
| H Busca Ativa | DECISÃO PENDENTE: autoridade Secretaria × OP | — |
| K Testes autenticados | Bloqueado: sessão indisponível | — |

## N7.2 — PARTIAL (CONTINUE_FROM=N7.2.1)
Entregue só o núcleo da fiscalização do Diário. Dossiê da Direção, SIPE, SIA, Conselho, relatórios e testes autenticados pendentes. Busca Ativa segue com autoridade configurável (decisão pendente).

## N7.2.1 (parcial)
- Fiscalização do Diário: filtros puros (turma, professor, período) + rótulos sobre a projeção existente, com teste. PENDENTE: ligar à grade (`class_schedule_at`) e aos registros reais na tela da OP.
- PENDENTE técnico: Dossiê da Direção, SIPE ponta a ponta, SIA, Conselho/ata, relatórios.
- Busca ativa: transição final DEPENDE_DECISAO. Browser: INTERACTIVE_BROWSER_VALIDATION_PENDING.

## N7.2.2 (parcial)
- Fiscalização do Diário ligada à grade publicada (`class_schedule_at`) e aos registros reais em /acompanhamento-diarios: aula prevista × aula/chamada registrada, filtros turma/professor, sem ranking; sem grade nada é faltante. Limite: turmas sem nenhum registro no período não aparecem (falta leitor de turmas da escola). Pendentes: Dossiê, SIPE, SIA, Conselho, relatórios, Busca Ativa (DEPENDE_DECISAO).

## N10.2.2 (parcial)
- Meu Diário mostra "Próxima aula" só da grade publicada (teachingClassBlocks → blocksForDate → nextLesson) e sobreposições factuais; sem grade, "Nenhuma aula prevista", nada deduzido de carga horária.
- Pendentes: autosave EI nas telas, SIPE/SIA docente, mobile headless, PEI/PAEE docente.

## N7.2.2 parte 2 (2026-10-07)
- Fiscalização do Diário (`diary-oversight-section.tsx`, em /diario visão geral): além da lista por aula prevista com filtros de turma/professor (período vem do seletor De/Até da página), agora mostra "Resumo por turma" com contagens (previstas, sem registro, sem chamada), sem taxa nem ranking, sobre o mesmo recorte filtrado.
- Gap mantido: turma e componente ainda aparecem pelo código porque não há leitor de nomes de turma da escola para a OP; acesso ao registro original (somente leitura) pendente.
- Pendentes: Dossiê da Direção, SIPE com ajuste/reenvio, SIA completo, Conselho/Reclassificação com ata e assinaturas, relatórios OP/Direção. Busca Ativa: transição final = DEPENDE_DECISAO. NÃO PASS.

## N7.2.4 (2026-10-08)
- Dossiê da Direção: botão "Gerar Dossiê da Direção (PDF)" em /gestao-escolar, A4, com a MESMA projeção da tela (blocos + pendências) pelo motor de relatórios; texto escapado; declara que não é documento oficial; sem pendência nunca afirma "escola em ordem" — FEITO. PDF headless (fixtures, 30 turmas com nomes longos): 2 páginas A4, 0 overflow.
- Duas escolas (harness de fixtures, `dossier-n724.test.ts`): escola não alcançada fica toda "Não disponível", sem zero e sem nomes da outra escola.
- SIPE/SIA: estados já definidos (não enviado, em análise, ajuste solicitado, aprovado) e impressão com a situação visível permanecem; sem mudança. Conselho/ata: registro de deliberação humana pelo módulo colegiado; nenhuma reclassificação automática.
- DEPENDE_DECISAO: aprovação obrigatória da prova, Quadro Permanente, Busca Ativa, regra de reclassificação. ASSIGNMENT_PENDING: `revisar-trabalho-docente`. INTERACTIVE_BROWSER_VALIDATION_PENDING: duas escolas reais com login.

## Leitura da tabela inicial (NDOCS.2, 2026-10-08)
A tabela do topo é o estado de N7.2 (histórico). O estado vigente é o da seção N7.2.4: Dossiê da Direção (tela e PDF), SIPE/SIA nos estados definidos e Conselho/ata como deliberação humana. DEPENDE_DECISAO: aprovação obrigatória da prova, Quadro Permanente, Busca Ativa, reclassificação.
