# NIDEM.1 — Idempotência dos writers e ações repetíveis (2026-10-08)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Registro de lote**. Instantâneo do lote na data em que foi escrito.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


| Área | Writer | Proteção | Resultado de repetição |
|---|---|---|---|
| Secretaria — matrícula guiada | enrollment_draft_complete | trava + cabeça esperada (`draft:stale-head`) + rascunho fechado | recusa explícita |
| Secretaria — enturmar | secretariat_allocate_to_class | trava por matrícula/turma + `active-class-exists` | recusa explícita |
| Secretaria — remanejar/encerrar/saída | secretariat_reassign_class / end_class_episode / record_exit | trava + `base-superseded` / sequência esperada | recusa explícita |
| Documentos — emitir/reproduzir/retificar | **emit_school_document_v3 (novo, 0241)** | chave idempotente por pedido e conta | mesma emissão devolvida (`replayed`) ou `idempotency:key-reused` |
| Documentos — cancelar | cancel_school_document_emission | evento único por emissão | recusa (`emission-not-active`) |
| Calendário — homologar / perfil externo | homologate_calendar_version / record_calendar_external_profile | base esperada + trava | `base-superseded` |
| Mapa — conferência / oficialização | record_map_conference / officialize_statistical_map | trava + `already-official` + digest | recusa explícita |
| Avaliação — lançamentos | register_assessment_results | trava + fechamento esperado | recusa explícita |
| Notificações | emit_notification_event / dispatch | `event_key` único; entrega única (evento, destinatário, canal) | mesmo evento devolvido |
| Importações | stage_import_batch | único por adaptador+versão+hash; `already-applied` | mesmo lote / recusa |
| Tramitação | apply_workflow_transition | `_expected_seq` + `idempotency_key` | mesmo evento |

## Lacuna corrigida
Emissão de documento (original, reprodução, retificação) não tinha chave: clique duplo ou retry após queda de rede criava um segundo documento com outro código. Agora:
- banco: `emit_school_document_v3(_idempotency_key, …)` envolve a v2; mesma chave + mesmo pedido + mesma conta devolve a emissão já gravada; chave com pedido diferente ou de outra conta é recusada; registro imutável em `school_document_emission_requests` (sem acesso direto).
- tela: `createActionGuard` (`src/lib/idempotency.ts`) — segundo clique durante o envio não faz nova chamada; só falha de rede preserva a chave para o retry; sucesso ou recusa definitiva gera chave nova (nova emissão continua sendo um ato novo e consciente).

## Não alterado de propósito
Writers que recusam a repetição continuam recusando: não foram tornados silenciosamente repetíveis.

## Testes
`src/lib/idempotency.test.ts`: clique duplo (1 chamada), retry de rede (mesma chave), chave nova após sucesso/recusa, contrato SQL.

## Pendências
- INTERACTIVE_BROWSER_VALIDATION_PENDING: reexecução real da v3 com sessão (mesma chave duas vezes ⇒ mesmo código de verificação).
- REVISAR: outras telas com botões de gravação sem `disabled` durante envio (o banco já recusa a repetição; seria só ergonomia).
