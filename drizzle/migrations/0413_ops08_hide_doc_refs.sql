REVOKE SELECT ON public.ops_work_events, public.ops_space_use_restrictions FROM authenticated;
GRANT SELECT (id, work_id, seq, kind, engagement_id, professional_registry, milestone_key, milestone_label, on_date, note, actor_person, idempotency_key, created_at) ON public.ops_work_events TO authenticated;
GRANT SELECT (id, space_id, seq, action, restriction_key, severity, capacity_limit, shift_ids, effective_from, effective_to, reason, work_id, author_person, idempotency_key, created_at) ON public.ops_space_use_restrictions TO authenticated;
-- Estado da obra só para quem lê a obra: INVOKER, sujeito à RLS.
ALTER FUNCTION public.ops_work_state(uuid) SECURITY INVOKER;