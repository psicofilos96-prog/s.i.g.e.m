CREATE INDEX IF NOT EXISTS sesd_school_idx ON public.school_enrollment_start_declarations(school_id, enrollment_id);

-- Início declarado vigente por matrícula da escola, conhecido em knownAt. Só é exposto por junção
-- com as matrículas que o chamador já enxerga em cycle_enrollments_at (INVOKER), por isso não revela nada novo.
CREATE OR REPLACE FUNCTION public.enrollment_declared_starts_for_school(_school text, _known_at timestamptz)
 RETURNS TABLE(enrollment_id text, start_on date)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT DISTINCT ON (d.enrollment_id) d.enrollment_id, d.start_on
  FROM public.school_enrollment_start_declarations d
  WHERE d.school_id = _school AND auth.uid() IS NOT NULL
    AND (_known_at IS NULL OR d.recorded_at <= _known_at)
    AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_start_declarations n
                    WHERE n.supersedes_id = d.id AND (_known_at IS NULL OR n.recorded_at <= _known_at))
  ORDER BY d.enrollment_id, d.recorded_at DESC
$$;
REVOKE ALL ON FUNCTION public.enrollment_declared_starts_for_school(text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enrollment_declared_starts_for_school(text, timestamptz) TO authenticated, service_role;

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
  WITH decl AS (
    SELECT * FROM public.enrollment_declared_starts_for_school(_school, _known_at)
  ), heads AS (
    SELECT e.id, e.logical_id, e.student_id, e.school_id, e.academic_year_id, e.institutional_number, e.originating_act_ref, e.created_at,
      coalesce(e.opened_on, dd.start_on) AS opened_on
    FROM public.school_enrollments e
    LEFT JOIN decl dd ON dd.enrollment_id = e.id
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