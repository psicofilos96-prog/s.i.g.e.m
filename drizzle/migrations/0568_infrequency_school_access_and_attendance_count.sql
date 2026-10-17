CREATE OR REPLACE FUNCTION public.aa_infrequency_at(_school text DEFAULT NULL::text, _from date DEFAULT NULL::date, _to date DEFAULT NULL::date)
RETURNS TABLE(school_id text, class_id text, student_id text, enrollment_id text, period_id text, period_start date, present integer, absent integer, unmarked integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'infrequencia:unauthenticated'; END IF;
 IF NOT (public.has_network_capability('acompanhar-infrequencia') OR (_school IS NOT NULL AND (public.has_school_capability('acompanhar-infrequencia',_school) OR public.has_school_capability('manter-matricula-e-enturmacao',_school)))) THEN RAISE EXCEPTION 'infrequencia:forbidden'; END IF;
 RETURN QUERY
 WITH les AS (
  SELECT DISTINCT ON (l.logical_record_id) l.logical_record_id,l.class_id,l.lesson_date,l.period_id
  FROM public.lesson_record_versions l ORDER BY l.logical_record_id,l.version_number DESC
 ), att AS (
  SELECT DISTINCT ON (a.logical_attendance_id) a.lesson_logical_id,a.marks,a.eligible_student_ids
  FROM public.attendance_record_versions a ORDER BY a.logical_attendance_id,a.version_number DESC
 ), slots AS (
  SELECT les.class_id,les.lesson_date,les.period_id,att.marks,att.eligible_student_ids
  FROM att JOIN les ON les.logical_record_id=att.lesson_logical_id
  WHERE (_from IS NULL OR les.lesson_date>=_from) AND (_to IS NULL OR les.lesson_date<=_to)
 ), ep AS (
  SELECT e.school_id,e.class_id,e.student_id,e.enrollment_id,e.valid_from,public.b3_allocation_ended_on(e.logical_id) ended_on
  FROM public.class_enrollment_episodes e
  WHERE NOT EXISTS(SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id=e.id)
   AND (_school IS NULL OR e.school_id=_school)
   AND (public.has_network_capability('acompanhar-infrequencia') OR public.has_school_capability('acompanhar-infrequencia',e.school_id) OR (_school IS NOT NULL AND e.school_id=_school AND public.has_school_capability('manter-matricula-e-enturmacao',e.school_id)))
 )
 SELECT ep.school_id,ep.class_id,ep.student_id,ep.enrollment_id,sl.period_id,min(sl.lesson_date),
 count(*) FILTER(WHERE sl.marks->>ep.student_id='Presente')::int,
 count(*) FILTER(WHERE sl.marks->>ep.student_id='Ausente')::int,
 count(*) FILTER(WHERE NOT(sl.marks ? ep.student_id))::int
 FROM ep JOIN slots sl ON sl.class_id=ep.class_id AND sl.lesson_date>=ep.valid_from AND (ep.ended_on IS NULL OR sl.lesson_date<=ep.ended_on)
  AND ep.student_id=ANY(sl.eligible_student_ids)
 GROUP BY ep.school_id,ep.class_id,ep.student_id,ep.enrollment_id,sl.period_id;
END $$;
REVOKE ALL ON FUNCTION public.aa_infrequency_at(text,date,date) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.aa_infrequency_at(text,date,date) TO authenticated;
COMMENT ON FUNCTION public.aa_infrequency_at(text,date,date) IS 'Canonical attendance counts once per eligible student/lesson; secretariat enrollment capability reads only an explicitly selected authorized school.';