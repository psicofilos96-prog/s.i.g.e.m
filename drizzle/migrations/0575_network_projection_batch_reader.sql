CREATE OR REPLACE FUNCTION public.network_projection_sources(_schools text[], _valid_on date DEFAULT NULL, _known_at timestamptz DEFAULT NULL)
RETURNS TABLE(school_id text, enrollments jsonb, participations jsonb, allocations jsonb, movements jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT s.id,
    (SELECT coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) FROM public.cycle_enrollments_at(s.id, _valid_on, _known_at) e),
    (SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM public.cycle_participations_at(s.id, _valid_on, _known_at) p),
    (SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM public.class_allocations_at(s.id, NULL, NULL, _known_at) a),
    (SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM public.student_movements_known(s.id, _known_at) m)
  FROM unnest(_schools) AS s(id);
$$;
REVOKE EXECUTE ON FUNCTION public.network_projection_sources(text[], date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_projection_sources(text[], date, timestamptz) TO authenticated;