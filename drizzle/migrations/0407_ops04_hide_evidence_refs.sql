-- Privilégio padrão do schema concedia SELECT de tabela; restringe às colunas seguras.
REVOKE SELECT ON public.ops_inspection_records FROM authenticated;
GRANT SELECT (id, inspection_id, seq, kind, performed_on, answers, recommendations, note, inspector_person, idempotency_key, created_at)
  ON public.ops_inspection_records TO authenticated;
