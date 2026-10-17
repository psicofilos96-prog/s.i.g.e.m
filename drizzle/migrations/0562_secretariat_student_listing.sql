CREATE OR REPLACE FUNCTION public.secretariat_own_student_listing()
RETURNS TABLE(student_id text, student_name text, birth_date date, class_id text, class_label text, has_cpf boolean, vaccination text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s text := public.secretariat_own_school_id();
BEGIN
  IF s IS NULL THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', s) THEN RAISE EXCEPTION 'listing:capability-missing'; END IF;
  RETURN QUERY
  WITH d AS (SELECT * FROM public.secretariat_student_documents_report(s)),
  al AS (SELECT DISTINCT ON (a.student_id) a.student_id sid, a.class_id cid, a.class_label_snapshot lbl FROM public.class_allocations_at(s, NULL, current_date, now()) a ORDER BY a.student_id, a.valid_from DESC),
  vc AS (SELECT DISTINCT ON (v.student_id) v.student_id sid, v.status st FROM public.student_vaccination_status_events v WHERE v.school_id=s ORDER BY v.student_id, v.sequence DESC)
  SELECT d.student_id, d.student_name, d.birth_date, al.cid, al.lbl, d.has_cpf, vc.st
  FROM d LEFT JOIN al ON al.sid=d.student_id LEFT JOIN vc ON vc.sid=d.student_id
  ORDER BY al.lbl NULLS LAST, d.student_name;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_own_student_listing() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_own_student_listing() TO authenticated;