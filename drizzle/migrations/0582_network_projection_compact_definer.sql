
DROP FUNCTION public.network_projection_compact_sources(text[], date, timestamptz);

-- Leitura em lote da projeção da rede com verificação de capacidade UMA vez por chamada.
-- Mesma semântica temporal dos leitores por escola e mesmo resultado de acesso: só escolas onde o
-- chamador tem 'consultar-matricula-e-movimentacao' (escopo rede ou escola) retornam dados;
-- escolas sem capacidade retornam listas vazias, como aconteceria via RLS.
CREATE FUNCTION public.network_projection_compact_sources(_schools text[], _valid_on date, _known_at timestamptz)
RETURNS TABLE(school_id text, enrollments jsonb, participations jsonb, allocations jsonb, movements jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = '' SET row_security = off
AS $$
DECLARE
  _allowed text[];
BEGIN
  IF public.has_network_capability('consultar-matricula-e-movimentacao') THEN
    _allowed := _schools;
  ELSE
    SELECT coalesce(array_agg(s), '{}') INTO _allowed
    FROM unnest(_schools) AS s
    WHERE s IN (SELECT public.school_capability_schools('consultar-matricula-e-movimentacao'));
  END IF;

  IF EXISTS (SELECT 1 FROM public.school_enrollments e
      WHERE e.school_id = ANY(_allowed) AND e.logical_id IS NOT NULL AND (_known_at IS NULL OR e.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s2 WHERE s2.supersedes_id = e.id AND (_known_at IS NULL OR s2.created_at <= _known_at))
      GROUP BY e.school_id, e.logical_id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions x
      WHERE x.school_id = ANY(_allowed) AND x.enrollment_logical_id IS NOT NULL AND (_known_at IS NULL OR x.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions s2 WHERE s2.supersedes_id = x.id AND (_known_at IS NULL OR s2.created_at <= _known_at))
      GROUP BY x.school_id, x.enrollment_logical_id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM public.cycle_participations p
      WHERE p.school_id = ANY(_allowed) AND (_known_at IS NULL OR p.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.cycle_participations s2 WHERE s2.supersedes_id = p.id AND (_known_at IS NULL OR s2.created_at <= _known_at))
      GROUP BY p.school_id, p.logical_id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM public.class_enrollment_episodes a
      WHERE a.school_id = ANY(_allowed) AND (_known_at IS NULL OR a.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s2 WHERE s2.supersedes_id = a.id AND (_known_at IS NULL OR s2.created_at <= _known_at))
      GROUP BY a.school_id, a.logical_id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM public.class_allocation_ending_versions x
      WHERE x.school_id = ANY(_allowed) AND (_known_at IS NULL OR x.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s2 WHERE s2.supersedes_id = x.id AND (_known_at IS NULL OR s2.created_at <= _known_at))
      GROUP BY x.school_id, x.allocation_logical_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'network-projection:ambiguous-temporal-state';
  END IF;

  RETURN QUERY
  WITH allowed AS (SELECT unnest(_allowed) AS sid),
  decl AS (
    SELECT a.sid, d.* FROM allowed a
    CROSS JOIN LATERAL public.enrollment_declared_starts_for_school(a.sid, _known_at) d
  ), enr_heads AS (
    SELECT e.school_id AS sid, e.id, e.logical_id, e.student_id,
      coalesce(e.opened_on, dd.start_on) AS opened_on
    FROM public.school_enrollments e
    LEFT JOIN decl dd ON dd.enrollment_id = e.id AND dd.sid = e.school_id
    WHERE e.school_id = ANY(_allowed) AND (_known_at IS NULL OR e.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s2 WHERE s2.supersedes_id = e.id AND (_known_at IS NULL OR s2.created_at <= _known_at))
  ), enr_ends AS (
    SELECT x.school_id AS sid, x.enrollment_logical_id, x.annulled, x.ended_on
    FROM public.cycle_enrollment_ending_versions x
    WHERE x.school_id = ANY(_allowed) AND (_known_at IS NULL OR x.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions s2 WHERE s2.supersedes_id = x.id AND (_known_at IS NULL OR s2.created_at <= _known_at))
  ), enr AS (
    SELECT h.sid, h.id, h.student_id, h.opened_on,
      CASE WHEN x.enrollment_logical_id IS NULL OR x.annulled THEN NULL ELSE x.ended_on END AS ended_on
    FROM enr_heads h LEFT JOIN enr_ends x ON x.enrollment_logical_id = h.logical_id AND x.sid = h.sid
    WHERE _valid_on IS NULL OR (h.opened_on IS NOT NULL AND h.opened_on <= _valid_on
      AND (x.enrollment_logical_id IS NULL OR x.annulled OR x.ended_on >= _valid_on))
  ), part AS (
    SELECT p.school_id AS sid, p.id, p.version, p.valid_from, p.valid_until, p.annulled
    FROM public.cycle_participations p
    WHERE p.school_id = ANY(_allowed) AND NOT p.annulled AND (_known_at IS NULL OR p.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.cycle_participations s2 WHERE s2.supersedes_id = p.id AND (_known_at IS NULL OR s2.created_at <= _known_at))
      AND (_valid_on IS NULL OR (p.valid_from <= _valid_on AND (p.valid_until IS NULL OR p.valid_until >= _valid_on)))
  ), alloc_heads AS (
    SELECT a.school_id AS sid, a.id, a.logical_id, a.student_id, a.class_id, a.valid_from
    FROM public.class_enrollment_episodes a
    WHERE a.school_id = ANY(_allowed) AND (_known_at IS NULL OR a.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s2 WHERE s2.supersedes_id = a.id AND (_known_at IS NULL OR s2.created_at <= _known_at))
  ), alloc_ends AS (
    SELECT x.school_id AS sid, x.allocation_logical_id, x.annulled, x.ended_on
    FROM public.class_allocation_ending_versions x
    WHERE x.school_id = ANY(_allowed) AND (_known_at IS NULL OR x.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s2 WHERE s2.supersedes_id = x.id AND (_known_at IS NULL OR s2.created_at <= _known_at))
  ), alloc_af AS (
    SELECT y.episode_id, min(y.ended_on) AS ended_on
    FROM public.class_enrollment_episode_endings y
    WHERE y.episode_id IN (SELECT h.id FROM alloc_heads h)
      AND (_known_at IS NULL OR y.created_at <= _known_at)
    GROUP BY y.episode_id
  ), alloc AS (
    SELECT h.sid, h.id, h.student_id, h.class_id, h.valid_from,
      CASE WHEN x.allocation_logical_id IS NOT NULL AND NOT x.annulled THEN x.ended_on ELSE f.ended_on END AS ended_on
    FROM alloc_heads h
    LEFT JOIN alloc_ends x ON x.allocation_logical_id = h.logical_id AND x.sid = h.sid
    LEFT JOIN alloc_af f ON f.episode_id = h.id
  ), mov AS (
    SELECT m.id, m.version, m.movement_type_id, m.effective_on, m.school_scope_ids,
      (SELECT array_agg(s) FROM unnest(m.school_scope_ids) s WHERE s = ANY(_allowed)) AS matched
    FROM public.student_movement_events m
    WHERE m.school_scope_ids && _allowed AND (_known_at IS NULL OR m.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.student_movement_events s2 WHERE s2.supersedes_id = m.id AND (_known_at IS NULL OR s2.created_at <= _known_at))
  ), mov_exp AS (
    SELECT s AS sid, m.id, m.version, m.movement_type_id, m.effective_on, m.school_scope_ids
    FROM mov m CROSS JOIN LATERAL unnest(m.matched) s
  )
  SELECT s.id,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'student_id',e.student_id,'opened_on',e.opened_on,'ended_on',e.ended_on)) FROM enr e WHERE e.sid = s.id), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'version',p.version,'valid_from',p.valid_from,'valid_until',p.valid_until,'annulled',p.annulled)) FROM part p WHERE p.sid = s.id), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'student_id',a.student_id,'class_id',a.class_id,'valid_from',a.valid_from,'ended_on',a.ended_on)) FROM alloc a WHERE a.sid = s.id), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'version',m.version,'movement_type_id',m.movement_type_id,'effective_on',m.effective_on,'school_scope_ids',m.school_scope_ids)) FROM mov_exp m WHERE m.sid = s.id), '[]'::jsonb)
  FROM unnest(_schools) AS s(id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.network_projection_compact_sources(text[], date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_projection_compact_sources(text[], date, timestamptz) TO authenticated;
