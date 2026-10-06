-- BO.5: matrícula legada (importação 2026) não tem logical_id; agrupar NULLs como uma só cadeia
-- fazia o reader recusar toda escola com mais de uma matrícula legada ("ambiguous-temporal-state").
-- Ambiguidade só existe entre versões da MESMA cadeia lógica (logical_id não nulo).
CREATE OR REPLACE FUNCTION public.cycle_enrollments_at(_school text, _valid_on date DEFAULT NULL::date, _known_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id text, logical_id text, student_id text, school_id text, academic_year_id text, opened_on date, institutional_number text, originating_act_ref text, created_at timestamp with time zone, ending_version_id uuid, ended_on date, bond_status_value_id text, bond_status_version integer, ending_reason text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
#variable_conflict use_column
BEGIN
  IF _school IS NULL THEN RAISE EXCEPTION 'enrollment:query-arguments-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_enrollments e
      WHERE e.school_id = _school AND e.logical_id IS NOT NULL AND (_known_at IS NULL OR e.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY e.logical_id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions x
      WHERE x.school_id = _school AND x.enrollment_logical_id IS NOT NULL AND (_known_at IS NULL OR x.created_at <= _known_at)
        AND NOT EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions s WHERE s.supersedes_id = x.id AND (_known_at IS NULL OR s.created_at <= _known_at))
      GROUP BY x.enrollment_logical_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'enrollment:ambiguous-temporal-state';
  END IF;
  RETURN QUERY
  WITH heads AS (
    SELECT e.* FROM public.school_enrollments e
    WHERE e.school_id = _school AND (_known_at IS NULL OR e.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id AND (_known_at IS NULL OR s.created_at <= _known_at))
  ), ends AS (
    SELECT x.* FROM public.cycle_enrollment_ending_versions x
    WHERE x.school_id = _school AND (_known_at IS NULL OR x.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions s WHERE s.supersedes_id = x.id AND (_known_at IS NULL OR s.created_at <= _known_at))
  )
  SELECT h.id, h.logical_id, h.student_id, h.school_id, h.academic_year_id, h.opened_on, h.institutional_number, h.originating_act_ref,
    h.created_at, x.id, CASE WHEN x.annulled THEN NULL ELSE x.ended_on END, CASE WHEN x.annulled THEN NULL ELSE x.bond_status_value_id END,
    CASE WHEN x.annulled THEN NULL ELSE x.bond_status_version END, x.reason_text
  FROM heads h LEFT JOIN ends x ON x.enrollment_logical_id = h.logical_id
  WHERE _valid_on IS NULL OR (h.opened_on IS NOT NULL AND h.opened_on <= _valid_on
    AND (x.id IS NULL OR x.annulled OR x.ended_on >= _valid_on));
END $function$;