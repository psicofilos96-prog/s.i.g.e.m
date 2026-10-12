-- Revogar coluna não basta com GRANT de tabela: concede-se só as colunas seguras.
REVOKE SELECT ON public.ops_request_events FROM authenticated;
GRANT SELECT (id, request_id, seq, kind, responsible_engagement, protocol_ref, object_kind, object_ref, valid_from, note, actor_person, idempotency_key, created_at)
  ON public.ops_request_events TO authenticated;
