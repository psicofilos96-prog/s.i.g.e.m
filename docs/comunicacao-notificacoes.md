# Comunicação e notificações (migration 0077)

Rota: `/avisos` + sino no cabeçalho (contas com login).

Fluxo: fato do módulo → `emit_notification_event` (outbox, chave idempotente) → `dispatch_notification_event` (regras vigentes, modelo vigente, preferências) → entregas in-app únicas → `my_notifications` / `my_unread_notification_count` → `open_notification` (revalida acesso, marca lida, devolve link interno).

## Pendente de decisão
- Capabilities sem regra: `manter-comunicacao-institucional` (modelos e regras, rede) e `emitir-notificacao` (escola|rede).
- Nenhum modelo nem regra semeado; nenhum módulo emite eventos ainda (cada módulo liga seu fato ao emissor quando houver modelo/regra).
- E-mail, push e SMS: só contrato; sem provedor configurado, nada é enviado.
- Despacho é síncrono na emissão; retry = reemitir com a mesma chave (sem duplicar). Fila assíncrona só se surgir volume.
