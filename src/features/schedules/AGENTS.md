## Contexto de sessão dos horários institucionais (B4.10.0e — `schedule-session-context.ts`, `src/routes/horarios.tsx`)

- Com conta, toda chave de cache das telas de horários começa por `userId#sessionRevision`, e o layout remonta a tela e descarta caches de outro contexto, porque novo login (mesma conta ou outra) não pode reaproveitar resposta anterior.
- Sessão carregando ou com erro não abre laboratório nem consulta; só a ausência confirmada de sessão mostra o legado.
- Data: `data` da URL válida prevalece; sem ela, hoje operacional local capturado uma vez por montagem; URL inválida ou campo limpo bloqueia leituras sem substituta. Um knownAt por data efetiva segue a class_at, jornada, grade e nomes.
- Lista de turmas: erro ou ambiguidade de `class_at` derruba a lista (≠ vazio conhecido); a turma escolhida só vale se estiver na lista aceita atual. Nenhum `data` anterior é exibido junto de erro.
- Nomes de responsáveis/turmas/escolas: falha vira rótulo neutro + diagnóstico, sem derrubar a grade lida. Atuação conta só se registrada até knownAt; nome da pessoa e identidade da turma não são bitemporais (valor corrente, limitação declarada).
- A autorização é a RLS dos readers; a tela não a reinterpreta. "Meu horário" continua só da própria pessoa, sem seletor.
- NHOR.2: conflitos (pessoa/turma/sala) só por `schedule-conflicts.ts` sobre blocos registrados, porque inferir bloco de carga ou sala ausente criaria falta/conflito inventado.
- NHOR.3: a grade institucional da turma mostra conflitos factuais (turma/atuação sobrepostas) só por `findConflicts(gridBlocksOf(...))` sobre os blocos lidos; nada é gerado da carga nem da jornada.
- NHOR.4: conflito do mesmo profissional entre turmas só por `teacher-cross-class-conflicts.ts` (lote do mesmo `class_schedule_at` sob a RLS atual; pessoa via atuação até knownAt); turma negada/falha e atuação sem pessoa tornam a verificação PARCIAL e declarada, porque leitura incompleta não prova ausência de conflito.
