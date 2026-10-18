CREATE OR REPLACE FUNCTION public.network_projection_compact_sources(_schools text[], _valid_on date DEFAULT NULL, _known_at timestamptz DEFAULT NULL)
RETURNS TABLE(school_id text, enrollments jsonb, participations jsonb, allocations jsonb, movements jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT s.id,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'student_id',e.student_id,'opened_on',e.opened_on,'ended_on',e.ended_on)), '[]'::jsonb) FROM public.cycle_enrollments_at(s.id,_valid_on,_known_at) e),
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'version',p.version,'valid_from',p.valid_from,'valid_until',p.valid_until,'annulled',p.annulled)), '[]'::jsonb) FROM public.cycle_participations_at(s.id,_valid_on,_known_at) p),
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'student_id',a.student_id,'class_id',a.class_id,'valid_from',a.valid_from,'ended_on',a.ended_on)), '[]'::jsonb) FROM public.class_allocations_at(s.id,NULL,NULL,_known_at) a),
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'version',m.version,'movement_type_id',m.movement_type_id,'effective_on',m.effective_on,'school_scope_ids',m.school_scope_ids)), '[]'::jsonb) FROM public.student_movements_known(s.id,_known_at) m)
 FROM unnest(_schools) AS s(id);
$$;
REVOKE EXECUTE ON FUNCTION public.network_projection_compact_sources(text[],date,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.network_projection_compact_sources(text[],date,timestamptz) TO authenticated;
COMMENT ON FUNCTION public.network_projection_compact_sources(text[],date,timestamptz) IS 'Read-only minimal projection over the same canonical INVOKER readers; no new facts or authorization bypass.';