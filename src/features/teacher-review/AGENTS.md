## Envio à OP de plano e prova (N10.2.3 — `teacher-work-review.ts`, migration 0236)
- Plano (SIPE) e prova (SIA) usam UM ledger append-only `teacher_work_review_events`, porque dois fluxos de aprovação divergiriam.
- O banco decide: só o autor envia a versão atual, autor nunca aprova o próprio, revisão exige `revisar-trabalho-docente` em política homologada e cabeça esperada; a tela só projeta `reviewState`.
- Pedir ajuste exige comentário; aprovar não altera o plano/prova, porque análise não reescreve o trabalho do professor.
