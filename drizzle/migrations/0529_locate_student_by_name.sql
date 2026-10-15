CREATE OR REPLACE FUNCTION public.locate_student_by_name(_school text, _name text, _birth date DEFAULT NULL)
 RETURNS TABLE(student_id text, display_name text, birth_date date, mother_name text, father_name text, guardian_name text, last_class text, last_grade text, phones text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE words text[]; o text;
BEGIN
  PERFORM public.sec_actor();
  IF NOT public.has_school_capability('localizar-estudante-para-matricula', _school) THEN RAISE EXCEPTION 'lookup:capability-missing'; END IF;
  words := pg_catalog.regexp_split_to_array(pg_catalog.lower(pg_catalog.btrim(coalesce(_name,''))), '\s+');
  IF coalesce(pg_catalog.cardinality(words),0) < 2 OR pg_catalog.length(pg_catalog.btrim(_name)) < 6 THEN RAISE EXCEPTION 'lookup:name-too-short'; END IF;
  INSERT INTO public.exact_lookup_events(user_id, purpose, school_id, identifier_kind, outcome) VALUES (auth.uid(), 'localizar-aluno', _school, 'nome', 'consulta');
  RETURN QUERY
  SELECT st.id, st.display_name, ob.birth_date, ob.mother_name, ob.father_name, ob.guardian_name, ob.class_literal, ob.grade_literal, coalesce(ob.phones, '{}'::text[])
  FROM public.institutional_students st
  LEFT JOIN LATERAL (SELECT * FROM public.student_registration_observations r WHERE r.student_id = st.id ORDER BY r.recorded_at DESC LIMIT 1) ob ON true
  WHERE (SELECT pg_catalog.bool_and(pg_catalog.strpos(pg_catalog.lower(st.display_name), w) > 0) FROM pg_catalog.unnest(words) w)
    AND (_birth IS NULL OR ob.birth_date = _birth)
  ORDER BY st.display_name
  LIMIT 15;
END $function$;
REVOKE ALL ON FUNCTION public.locate_student_by_name(text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.locate_student_by_name(text, text, date) TO authenticated;