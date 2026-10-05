## Central de tarefas (`src/features/tasks/`, `/tarefas`, migration 0095)
- Manuais são fatos (`operational_tasks` + eventos append-only com `seq`); derivadas são projeção do workflow e só encerram por transição real, porque clique cosmético criaria segunda verdade do processo.
- Responsável é atuação (engagement), não pessoa nem cargo; atuação não vigente ⇒ tarefa órfã e o ex-responsável perde leitura; reatribuição só com `gerir-tarefas-operacionais` (não atribuída).
- Prazo, prioridade (catálogo `operational_task_priorities`, sem semente) e recorrência (objeto com `regra`) só se declarados; nenhum SLA no código.
- `dedupe_key` estável por origem e `idempotency_key` por evento impedem duplicidade; notificação de atribuição vai por `emit_notification_event`.
- Agenda operacional lista só prazos de tarefas e nunca lê/grava o Calendário Escolar.
