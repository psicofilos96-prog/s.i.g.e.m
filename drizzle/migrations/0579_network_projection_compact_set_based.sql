CREATE OR REPLACE FUNCTION public.network_projection_compact_sources(_schools text[], _valid_on date DEFAULT NULL::date, _known_at timestamptz DEFAULT NULL::timestamptz)
RETURNS TABLE(school_id text, enrollments jsonb, participations jsonb, allocations jsonb, movements jsonb)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $function$
BEGIN
  -- Mesmas verificacoes de ambiguidade dos leitores por escola (falha fechada), agora em conjunto.
  IF EXISTS (SELECT 1 FROM public.school_enrollments e
      WHERE e.school_id = ANY(_schools) AND e.logical_id IS NOT NULL AND (_known_at IS NULL OR e.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY e.school_id, e.logical_id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions x
      WHERE x.school_id = ANY(_schools) AND x.enrollment_logical_id IS NOT NULL AND (_known_at IS NULL OR x.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions s WHERE s.supersedes_id = x.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY x.school_id, x.enrollment_logical_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'enrollment:ambiguous-temporal-state';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cycle_participations p
      WHERE p.school_id = ANY(_schools) AND (_known_at IS NULL OR p.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.cycle_participations s WHERE s.supersedes_id = p.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY p.school_id, p.logical_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'participation:ambiguous-temporal-state';
  END IF;
  IF EXISTS (SELECT 1 FROM public.class_allocation_ending_versions x
      WHERE x.school_id = ANY(_schools) AND (_known_at IS NULL OR x.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s WHERE s.supersedes_id = x.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY x.school_id, x.allocation_logical_id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM public.class_enrollment_episodes a
      WHERE a.school_id = ANY(_schools) AND (_known_at IS NULL OR a.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY a.school_id, a.logical_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'allocation:ambiguous-temporal-state';
  END IF;

  RETURN QUERY
  WITH e_heads AS (
    SELECT e.id, e.logical_id, e.student_id, e.school_id, e.opened_on
    FROM public.school_enrollments e
    WHERE e.school_id = ANY(_schools) AND (_known_at IS NULL OR e.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id AND (_known_at IS NULL OR s.created_at <= _known_at))
  ), e_decl AS (
    SELECT DISTINCT ON (d.enrollment_id) d.enrollment_id, d.start_on
    FROM public.school_enrollment_start_declarations d
    WHERE d.school_id = ANY(_schools) AND auth.uid() IS NOT NULL
      AND (_known_at IS NULL OR d.recorded_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_start_declarations n WHERE n.supersedes_id = d.id AND (_known_at IS NULL OR n.recorded_at <= _known_at))
    ORDER BY d.enrollment_id, d.recorded_at DESC
  ), e_ends AS (
    SELECT x.enrollment_logical_id, x.ended_on, x.annulled
    FROM public.cycle_enrollment_ending_versions x
    WHERE x.school_id = ANY(_schools) AND (_known_at IS NULL OR x.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions s WHERE s.supersedes_id = x.id AND (_known_at IS NULL OR s.created_at <= _known_at))
  ), e_final AS (
    SELECT h.school_id, h.id, h.student_id,
      coalesce(h.opened_on, dd.start_on) AS opened_on,
      CASE WHEN x.enrollment_logical_id IS NOT NULL AND NOT x.annulled THEN x.ended_on END AS ended_on
    FROM e_heads h
    LEFT JOIN e_decl dd ON dd.enrollment_id = h.id
    LEFT JOIN e_ends x ON x.enrollment_logical_id = h.logical_id
    WHERE _valid_on IS NULL OR (coalesce(h.opened_on, dd.start_on) IS NOT NULL AND coalesce(h.opened_on, dd.start_on) <= _valid_on
      AND (x.enrollment_logical_id IS NULL OR x.annulled OR x.ended_on >= _valid_on))
  ), p_final AS (
    SELECT p.school_id, p.id, p.version, p.valid_from, p.valid_until, p.annulled
    FROM public.cycle_participations p
    WHERE p.school_id = ANY(_schools) AND NOT p.annulled AND (_known_at IS NULL OR p.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.cycle_participations s WHERE s.supersedes_id = p.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      AND (_valid_on IS NULL OR (p.valid_from <= _valid_on AND (p.valid_until IS NULL OR p.valid_until >= _valid_on)))
  ), a_heads AS (
    SELECT a.id, a.logical_id, a.student_id, a.school_id, a.class_id, a.valid_from
    FROM public.class_enrollment_episodes a
    WHERE a.school_id = ANY(_schools) AND (_known_at IS NULL OR a.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id AND (_known_at IS NULL OR s.created_at <= _known_at))
  ), a_ends AS (
    SELECT x.allocation_logical_id, x.ended_on, x.annulled
    FROM public.class_allocation_ending_versions x
    WHERE x.school_id = ANY(_schools) AND (_known_at IS NULL OR x.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s WHERE s.supersedes_id = x.id AND (_known_at IS NULL OR s.created_at <= _known_at))
  ), a_af AS (
    SELECT y.episode_id, min(y.ended_on) AS ended_on
    FROM public.class_enrollment_episode_endings y
    WHERE y.episode_id IN (SELECT h.id FROM a_heads h) AND (_known_at IS NULL OR y.created_at <= _known_at)
    GROUP BY y.episode_id
  ), a_final AS (
    SELECT h.school_id, h.id, h.student_id, h.class_id, h.valid_from,
      CASE WHEN x.allocation_logical_id IS NOT NULL AND NOT x.annulled THEN x.ended_on ELSE f.ended_on END AS ended_on
    FROM a_heads h
    LEFT JOIN a_ends x ON x.allocation_logical_id = h.logical_id
    LEFT JOIN a_af f ON f.episode_id = h.id
  ), m_final AS (
    SELECT s.id AS school_id, m.id, m.version, m.movement_type_id, m.effective_on, m.school_scope_ids
    FROM unnest(_schools) AS s(id)
    JOIN public.student_movement_events m ON s.id = ANY(m.school_scope_ids)
    WHERE (_known_at IS NULL OR m.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.student_movement_events n WHERE n.supersedes_id = m.id AND (_known_at IS NULL OR n.created_at <= _known_at))
  )
  SELECT s.id,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'student_id', e.student_id, 'opened_on', e.opened_on, 'ended_on', e.ended_on)), '[]'::jsonb) FROM e_final e WHERE e.school_id = s.id),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'version', p.version, 'valid_from', p.valid_from, 'valid_until', p.valid_until, 'annulled', p.annulled)), '[]'::jsonb) FROM p_final p WHERE p.school_id = s.id),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'student_id', a.student_id, 'class_id', a.class_id, 'valid_from', a.valid_from, 'ended_on', a.ended_on)), '[]'::jsonb) FROM a_final a WHERE a.school_id = s.id),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'version', m.version, 'movement_type_id', m.movement_type_id, 'effective_on', m.effective_on, 'school_scope_ids', m.school_scope_ids)), '[]'::jsonb) FROM m_final m WHERE m.school_id = s.id)
  FROM unnest(_schools) AS s(id);
END
$function$;
COMMENT ON FUNCTION public.network_projection_compact_sources(text[], date, timestamptz) IS 'Leitor em conjunto (uma passagem para todas as escolas) das fontes da projecao da rede; mesma semantica temporal e de ambiguidade dos leitores canonicos por escola (cycle_enrollments_at, cycle_participations_at, class_allocations_at, student_movements_known). Somente leitura, SECURITY INVOKER: a RLS das tabelas canonicas continua valendo.';