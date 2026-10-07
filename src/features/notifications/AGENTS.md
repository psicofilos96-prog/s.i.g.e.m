## Comunicação e notificações (`src/features/notifications/`, migration 0077)

- Camada única: módulos emitem evento de domínio por `emit_notification_event` (chave idempotente); entrega é linha própria por destinatário criada só por `dispatch_notification_event`, porque cada módulo com seu sistema criaria verdades paralelas.
- Destinatário vem só de regra (`notification_delivery_rules`): capability na escola via política homologada ou responsável com autorização vigente na seção; nunca lista ampla.
- `open_notification` revalida autorização antes de devolver o link e só aceita o próprio destinatário; lido é estado do destinatário (`notification_reads`).
- Payload só com variáveis declaradas no modelo; canais externos recebem apenas `external_summary` sem variáveis e não têm provedor (adaptadores recusam), porque push/e-mail não podem carregar dado sensível.
- Mensagem obrigatória ignora preferência; opcional respeita a última preferência do destinatário.
- NSEARCH.2: categorias (devoluções, aprovações, prazos, pendências, documentos, outros) são agrupamento de apresentação do `event_kind` já emitido; nenhum evento novo nasce da tela.
