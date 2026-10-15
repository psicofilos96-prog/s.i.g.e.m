CREATE OR REPLACE FUNCTION public.locate_student_by_name(_school text, _name text, _birth date DEFAULT NULL::date)
 RETURNS TABLE(student_id text, display_name text, birth_date date, mother_name text, father_name text, guardian_name text, last_class text, last_grade text, phones text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE words text[];
BEGIN
  PERFORM public.sec_actor();
  IF NOT public.has_school_capability('localizar-estudante-para-matricula', _school) THEN RAISE EXCEPTION 'lookup:capability-missing'; END IF;
  words := pg_catalog.regexp_split_to_array(pg_catalog.lower(pg_catalog.btrim(coalesce(_name,''))), '\s+');
  IF coalesce(pg_catalog.cardinality(words),0) < 2 OR pg_catalog.length(pg_catalog.btrim(_name)) < 6 THEN RAISE EXCEPTION 'lookup:name-too-short'; END IF;
  INSERT INTO public.exact_lookup_events(user_id, purpose, school_id, identifier_kind, outcome) VALUES (auth.uid(), 'localizar-aluno', _school, 'nome', 'consulta');
  RETURN QUERY
  WITH off AS (
    SELECT st.id::text AS sid, st.display_name AS dn, ob.birth_date AS bd, ob.mother_name AS mn, ob.father_name AS fn, ob.guardian_name AS gn, ob.class_literal AS cl, ob.grade_literal AS gl, coalesce(ob.phones, '{}'::text[]) AS ph
    FROM public.institutional_students st
    LEFT JOIN LATERAL (SELECT * FROM public.student_registration_observations r WHERE r.student_id = st.id ORDER BY r.recorded_at DESC LIMIT 1) ob ON true
    WHERE (SELECT pg_catalog.bool_and(pg_catalog.strpos(pg_catalog.lower(st.display_name), w) > 0) FROM pg_catalog.unnest(words) w)
      AND (_birth IS NULL OR ob.birth_date = _birth)
  ), sg AS (
    SELECT 'sg:' || s.id::text, s.name, s.birth_date, s.mother_name, s.father_name, s.guardian_name, c.name, c.stage,
           CASE WHEN s.phone IS NULL THEN '{}'::text[] ELSE ARRAY[s.phone] END
    FROM public.sg_students s LEFT JOIN public.sg_classes c ON c.id = s.class_id
    WHERE (SELECT pg_catalog.bool_and(pg_catalog.strpos(pg_catalog.lower(s.name), w) > 0) FROM pg_catalog.unnest(words) w)
      AND (_birth IS NULL OR s.birth_date = _birth)
      AND NOT EXISTS (SELECT 1 FROM off WHERE pg_catalog.upper(pg_catalog.btrim(off.dn)) = pg_catalog.upper(pg_catalog.btrim(s.name)) AND off.bd IS NOT DISTINCT FROM s.birth_date)
  )
  SELECT * FROM (SELECT * FROM off UNION ALL SELECT * FROM sg) u ORDER BY 2 LIMIT 15;
END $function$;