CREATE OR REPLACE FUNCTION public.class_allocations_at(_school text, _class text, _valid_on date DEFAULT NULL::date, _known_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id text, logical_id text, participation_logical_id text, enrollment_id text, student_id text, school_id text, class_id text, valid_from date, ended_on date, ending_version_id uuid, ending_reason text, originating_act_ref text, class_label_snapshot text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
#variable_conflict use_column
BEGIN
  IF _school IS NULL AND _class IS NULL THEN RAISE EXCEPTION 'allocation:query-arguments-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.class_allocation_ending_versions x
      WHERE (_school IS NULL OR x.school_id = _school) AND (_class IS NULL OR x.class_id = _class)
        AND (_known_at IS NULL OR x.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s WHERE s.supersedes_id = x.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY x.allocation_logical_id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM public.class_enrollment_episodes a
      WHERE (_school IS NULL OR a.school_id = _school) AND (_known_at IS NULL OR a.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY a.logical_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'allocation:ambiguous-temporal-state';
  END IF;
  RETURN QUERY
  WITH heads AS MATERIALIZED (
    SELECT a.* FROM public.class_enrollment_episodes a
    WHERE (_school IS NULL OR a.school_id = _school) AND (_class IS NULL OR a.class_id = _class)
      AND (_known_at IS NULL OR a.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id AND (_known_at IS NULL OR s.created_at <= _known_at))
  ), ends AS (
    -- Só encerramentos das alocações já lidas (antes varria a rede inteira por chamada).
    SELECT x.* FROM public.class_allocation_ending_versions x
    WHERE x.allocation_logical_id IN (SELECT h.logical_id FROM heads h)
      AND (_known_at IS NULL OR x.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s WHERE s.supersedes_id = x.id AND (_known_at IS NULL OR s.created_at <= _known_at))
  ), af AS (
    SELECT y.episode_id, min(y.ended_on) AS ended_on, min(y.reason_label) AS reason_label FROM public.class_enrollment_episode_endings y
    WHERE y.episode_id IN (SELECT h.id FROM heads h)
      AND (_known_at IS NULL OR y.created_at <= _known_at) GROUP BY y.episode_id
  ), j AS (
    SELECT h.*, x.id AS x_id, x.reason_text AS x_reason,
      CASE WHEN x.id IS NOT NULL AND NOT x.annulled THEN x.ended_on ELSE f.ended_on END AS eff_end,
      CASE WHEN x.id IS NOT NULL AND NOT x.annulled THEN x.reason_text ELSE f.reason_label END AS eff_reason
    FROM heads h LEFT JOIN ends x ON x.allocation_logical_id = h.logical_id LEFT JOIN af f ON f.episode_id = h.id
  )
  SELECT j.id, j.logical_id, j.participation_logical_id, j.enrollment_id, j.student_id, j.school_id, j.class_id, j.valid_from,
    j.eff_end, j.x_id, j.eff_reason, j.originating_act_ref, j.class_label_snapshot, j.created_at
  FROM j
  WHERE _valid_on IS NULL OR (j.valid_from <= _valid_on AND (j.eff_end IS NULL OR j.eff_end >= _valid_on));
END $function$;
CREATE INDEX IF NOT EXISTS class_allocation_ending_versions_logical_idx ON public.class_allocation_ending_versions (allocation_logical_id);