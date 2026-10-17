CREATE OR REPLACE FUNCTION public.diary_justified_students(_school text, _students text[], _on date)
RETURNS TABLE(student_id text, doc_kind text, starts_on date, ends_on date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF NOT (public.has_school_capability('registrar-frequencia', _school) OR public.has_school_capability('consultar-frequencia', _school)
          OR public.has_school_capability('manter-matricula-e-enturmacao', _school)) THEN RETURN; END IF;
  RETURN QUERY SELECT r.student_id, r.doc_kind, r.starts_on, r.ends_on
  FROM public.student_absence_justification_events r
  WHERE r.school_id=_school AND r.act='registrar' AND r.student_id = ANY(coalesce(_students,'{}'::text[]))
    AND _on BETWEEN r.starts_on AND r.ends_on
    AND NOT EXISTS (SELECT 1 FROM public.student_absence_justification_events v WHERE v.justification_id=r.justification_id AND v.act='anular');
END $$;
REVOKE ALL ON FUNCTION public.diary_justified_students(text,text[],date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.diary_justified_students(text,text[],date) TO authenticated;