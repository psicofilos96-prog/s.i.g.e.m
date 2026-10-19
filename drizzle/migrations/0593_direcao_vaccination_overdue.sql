CREATE OR REPLACE FUNCTION public.direcao_vaccination_overdue(_school text)
RETURNS TABLE(student_id text, student_name text, declared_on date, due_on date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'vaccination:auth-required'; END IF;
  IF NOT public.sdo_can_read(_school) THEN RAISE EXCEPTION 'vaccination:not-authorized'; END IF;
  RETURN QUERY SELECT x.student_id, x.display_name, x.declared_on, x.due_on FROM (
    SELECT DISTINCT ON (v.student_id) v.student_id, st.display_name, v.status, v.declared_on, v.due_on
    FROM public.student_vaccination_status_events v JOIN public.institutional_students st ON st.id=v.student_id
    WHERE v.school_id=_school ORDER BY v.student_id, v.sequence DESC) x
  WHERE x.status='pendente' AND x.due_on IS NOT NULL AND x.due_on < (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ORDER BY x.due_on, x.display_name;
END $$;
REVOKE ALL ON FUNCTION public.direcao_vaccination_overdue(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.direcao_vaccination_overdue(text) TO authenticated;