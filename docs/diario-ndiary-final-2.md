# NDIARY.FINAL.2 — autosave, impressões e relatórios do Diário

Situação atual: Registro de lote.

- Enturmação 2026: validada, sem nova conversão — 10.295 episódios, 9.763 estudantes, 0 duplicidades (estudante+turma+início).
- Autosave do registro de aula: `lesson_record_drafts` (migration 0268, append-only, só o autor), debounce 1,2 s, versão por `seq`, retry idempotente (mesma seq; 23505 = já gravado), recuperação do último rascunho aberto, último salvamento visível, falha com "Tentar novamente", flush ao sair, encerramento ao concluir. Rascunho não é registro oficial.
- 7 impressões (`diary-prints.ts`, renderer especializado A4): Diário do período, Frequência, Registro de aulas, Planejamento, Notas/Avaliações, Espelho final (só com OP + Direção), SIPE/SIA. "Ausente" armazenado imprime "F"; sem marcação imprime "—". Leitura completa ou recusa.
- Relatórios: fontes `diario-aulas`, `diario-frequencia`, `diario-justificativas`, `diario-cobertura`, `diario-avaliacoes`, `diario-planejamento`, sem coluna de professor. Pacotes Direção/OP/Docente ligados (54 pacotes mantidos).
- BQ.5: já existente (0256) — conselho amarrado ao período (`scope.periodId`), OP + Direção obrigatórios, aulas/frequência/avaliações/ocorrências recusam escrita; 0269 estende ao planejamento. Sem reabertura.
- Pendências: validação visual autenticada no navegador; prova SQL em transação do fechamento com atribuição de harness; grade/atribuições oficiais 2027 (PROFESSIONALS_CURRICULUM_JOURNEYS) são dado operacional.
