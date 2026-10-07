# Docente / Diário — produto

| Requisito | Estado |
|---|---|
| A Meu Diário | Existente + correções N10 |
| B Chamada | Existente (6D.1.3) |
| C Registro da aula | Existente, versionado |
| D Notas | Existente (Pauta) |
| E EI autosave | Ligado à tela de experiência (memória da aba); recuperação após recarregar PENDENTE |
| F SIPE envio OP | DECISÃO PENDENTE: plano não tem aprovação (Frente Z) |
| G SIA | Parcial |
| H Horários | Existente (B4.4 + próxima aula na agenda) |
| I PEI/PAEE | Depende do N8 |
| K Testes autenticados | Bloqueado: sessão indisponível |

## N10.2 — PARTIAL (CONTINUE_FROM=N10.2.1)
| Item | Situação |
|---|---|
| 1 Autosave EI | Controlador genérico `src/features/autosave/autosave-controller.ts` (debounce, salvando/salvo/erro, retry crescente, flush ao sair, edição durante salvamento preservada) — testado; ainda NÃO ligado às telas de habilidades/fases da escrita/observações nem à persistência versionada |
| 2 SIPE | PENDENTE (fluxo decidido: rascunho → enviado → OP aprova/ajuste → reenviado) |
| 3 SIA | PENDENTE |
| 4 Horários | existentes (grade por turma/profissional); próxima aula/integração Meu Diário PENDENTES |
| 5 Mobile | não testado em viewport neste lote |
| 6 Documentos pedagógicos | depende de N8.2.1 |

- N5.3.2: composição da turma lida de `class_composition_at`; subtotais pela posição individual (B3.3), total = estudantes únicos; sem posição = "Posição curricular não registrada".

## N10.2.1 (parcial)
- Agenda: `teacher-agenda.ts` (próxima aula, conflitos factuais por sobreposição) sobre blocos da grade publicada; puro + teste. PENDENTE: ligar ao Meu Diário.
- PENDENTE técnico: autosave EI nas telas reais, SIPE docente, SIA, regressão mobile 390×844/tablet, PEI/PAEE no contexto do docente (depende de N8.2.1).

## N10.2.3 — PARTIAL (2026-10-07)

| Item | Estado |
|---|---|
| 1 Autosave EI | LIGADO na tela "Registrar experiência" (habilidades/objetivos, campos, observação coletiva e individuais): `useAutosave` (debounce 800 ms, cada salvamento = nova versão do rascunho, aviso "Salvando/Rascunho salvo/Não foi possível", botão "Tentar salvar de novo", flush ao navegar e ao desmontar; só pergunta ao sair se o salvamento falhou). Testes: use-autosave.test.tsx (2) + infant-experiences (19). LIMITE: rascunho vive na memória da aba (não há tabela de rascunho no servidor); recuperação após fechar/recarregar = PENDENTE (exige tabela de rascunho por autor com RLS). Fases da escrita: não há tela no sistema → AUSENTE. |
| 2 SIPE | PENDENTE técnico: fluxo decidido (rascunho→enviado→OP aprova/ajuste→reenviado) exige migration de eventos de submissão sobre o plano (Frente Z não tem aprovação) + fila da OP + comentários + impressão. Não iniciado neste lote. |
| 3 SIA | PENDENTE técnico: instrumentos (0079) existem; faltam envio à OP, aprovação/ajuste e ligação aplicar→corrigir. |
| 4 Documentos pedagógicos no contexto docente | PENDENTE (depende de N8.2.1). |
| 5 Meu Diário | agenda/próxima aula/chamada/registro já conectados (N10.2.1); multisseriada sem revisão nova. |
| 6 Mobile 390×844/tablet | INTERACTIVE_BROWSER_VALIDATION_PENDING. |
| 7 Professor relacionado/não relacionado | INTERACTIVE_BROWSER_VALIDATION_PENDING (harness). |

## N10.2.3 (rodada 2) — PARTIAL (2026-10-07)

| Item | Estado | Prova |
|---|---|---|
| 1 Autosave EI | COMPLETO na tela "Registrar experiência": cada salvamento automático grava nova versão em `infant_experience_drafts` (0236; só o autor lê/grava; append-only; sem anon); "Retomar rascunho de …" após recarregar/fechar; concluir grava evento de descarte (nada é apagado). Laboratório segue na memória da aba. Fases da escrita: tela não existe → AUSENTE. | use-autosave.test.tsx, teacher-work-review.test.ts (recuperação), infant-experiences (19) |
| 2 SIPE | INTEGRADO: painel no Planejamento (situação, histórico com comentários, Enviar/Reenviar) + fila na tela de acompanhamento da OP (Aprovar / Pedir ajuste com comentário obrigatório). Banco: só o autor envia, só a versão atual, autor não aprova o próprio, cabeça esperada, append-only. PENDENTE: Quadro Permanente e impressão do plano aprovado. | teacher-work-review.test.ts (9) |
| 3 SIA | INTEGRADO o envio→OP→aprovar/ajuste→reenviar na tela de provas do professor (mesmo motor). PENDENTE: exigir aprovação antes de aplicar/corrigir (hoje aplicar segue o motor existente sem esse requisito). | idem |
| Autorização da OP | Capacidade `revisar-trabalho-docente` exigida em política homologada; ainda NÃO atribuída → a fila mostra "Sem autorização" até a atribuição (ASSIGNMENT_PENDING). | — |
| 4 Documentos pedagógicos | PENDENTE (depende de N8.2.1). | — |
| 5 Meu Diário | Sem mudança nesta rodada (agenda/próxima aula/chamada/registro de N10.2.1); multisseriada não revisada. | — |
| 6 Mobile | 390×844 e 820×1180 sem rolagem lateral em /diario, nova experiência, /planejamento, /avaliacoes-do-professor, /acompanhamento-planejamento (headless, visão sem login). Com login = INTERACTIVE_BROWSER_VALIDATION_PENDING. | Playwright headless |
| 7 Relacionado/não relacionado | Garantido pelo banco (autor/capacidade); prova com contas sintéticas = INTERACTIVE_BROWSER_VALIDATION_PENDING. | — |

Gates: 4.065/4.065 full suite (após ajuste), deep 31/31, typecheck 0 erros, migration integrity ok (0236 congelada), diff-check limpo. Security scan: 26 achados, todos anteriores (catálogos legíveis por qualquer conta logada); nenhum nas tabelas novas.

## N10.2.3 — rodada 3 (2026-10-07)
- SIPE/SIA: "Imprimir com a situação da análise" no plano e na prova; a folha sempre mostra a situação (aprovado / em análise / ajuste) e, sem aprovação vigente, declara isso por extenso; histórico da análise impresso; texto escapado.
- Aprovação obrigatória antes de aplicar/corrigir a prova: NÃO implementada — exigir aprovação é norma institucional ainda não decidida (DEPENDE_DECISAO). A prova continua aplicável pela regra atual; a situação da análise fica visível na tela e na impressão.
- Quadro Permanente: sem definição institucional do conteúdo/escopo → DEPENDE_DECISAO.
- Documentos pedagógicos no contexto docente: PENDENTE (N8.2.1). Multisseriada no Meu Diário: não revisada nesta rodada.
- Capacidade `revisar-trabalho-docente`: ASSIGNMENT_PENDING. Contas sintéticas / login: INTERACTIVE_BROWSER_VALIDATION_PENDING.
- Situação: PARTIAL (não TEACHER_CLASSROOM_TECHNICALLY_COMPLETE).
