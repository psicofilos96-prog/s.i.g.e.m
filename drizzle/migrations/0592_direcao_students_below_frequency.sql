CREATE OR REPLACE FUNCTION public.direcao_students_below_frequency(_school text, _from date, _to date)
RETURNS TABLE(student_id text, student_name text, class_id text, present integer, absent integer, rate numeric, limit_pct numeric, limit_version integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE lim numeric; ver int;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'risk:auth-required'; END IF;
 IF NOT public.sdo_can_read(_school) THEN RAISE EXCEPTION 'risk:not-authorized'; END IF;
 IF _from IS NULL OR _to IS NULL OR _to < _from THEN RAISE EXCEPTION 'risk:period-invalid'; END IF;
 SELECT r.frequency_pct, r.version INTO lim, ver FROM public.school_risk_limits r WHERE r.school_id=_school ORDER BY r.version DESC LIMIT 1;
 IF lim IS NULL THEN RAISE EXCEPTION 'risk:frequency-limit-missing'; END IF;
 RETURN QUERY
 WITH les AS (
  SELECT DISTINCT ON (l.logical_record_id) l.logical_record_id,l.class_id,l.lesson_date
  FROM public.lesson_record_versions l ORDER BY l.logical_record_id,l.version_number DESC
 ), att AS (
  SELECT DISTINCT ON (a.logical_attendance_id) a.lesson_logical_id,a.marks,a.eligible_student_ids
  FROM public.attendance_record_versions a ORDER BY a.logical_attendance_id,a.version_number DESC
 ), slots AS (
  SELECT les.class_id,les.lesson_date,att.marks,att.eligible_student_ids
  FROM att JOIN les ON les.logical_record_id=att.lesson_logical_id
  WHERE les.lesson_date BETWEEN _from AND _to
 ), ep AS (
  SELECT e.class_id,e.student_id,e.valid_from,public.b3_allocation_ended_on(e.logical_id) ended_on
  FROM public.class_enrollment_episodes e
  WHERE e.school_id=_school AND NOT EXISTS(SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id=e.id)
 ), agg AS (
  SELECT ep.student_id sid, max(ep.class_id) cid,
   count(*) FILTER(WHERE sl.marks->>ep.student_id='Presente')::int p,
   count(*) FILTER(WHERE sl.marks->>ep.student_id='Ausente')::int ab
  FROM ep JOIN slots sl ON sl.class_id=ep.class_id AND sl.lesson_date>=ep.valid_from AND (ep.ended_on IS NULL OR sl.lesson_date<=ep.ended_on)
   AND ep.student_id=ANY(sl.eligible_student_ids)
  GROUP BY ep.student_id
 )
 SELECT agg.sid, st.display_name, agg.cid, agg.p, agg.ab, round(100.0*agg.p/(agg.p+agg.ab),1), lim, ver
 FROM agg JOIN public.institutional_students st ON st.id=agg.sid
 WHERE agg.p+agg.ab>0 AND 100.0*agg.p/(agg.p+agg.ab) < lim
 ORDER BY 6, 2 LIMIT 1000;
END $$;
REVOKE ALL ON FUNCTION public.direcao_students_below_frequency(text,date,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.direcao_students_below_frequency(text,date,date) TO authenticated;