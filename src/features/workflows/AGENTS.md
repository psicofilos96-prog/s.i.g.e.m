## Tramitação (`src/features/workflows/`, `/pendencias`, migration 0090)
- Workflow é definição versionada e homologada (estados, transições, capability por transição, escopo escola/rede); o motor não conhece fluxo, cargo nem aprovador, e nenhuma definição é semeada, porque cadeia hierárquica inventada seria norma no código.
- Só processos que exigem tramitação/aprovação usam o motor; CRUD continua no writer canônico, e a transição nunca altera o fato de origem.
- Eventos são append-only com `seq` contínuo (concorrência otimista) e chave idempotente; `workflow_outbox` registra cada evento para notificação, porque entrega duplicada ou perdida divergiria.
- Prazo só existe se declarado num evento; papel responsável é rótulo, nunca autorização.
