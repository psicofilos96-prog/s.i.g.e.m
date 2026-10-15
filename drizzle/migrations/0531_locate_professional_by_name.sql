CREATE OR REPLACE FUNCTION public.locate_professional_by_name(_school text, _name text)
 RETURNS TABLE(full_name text, registration text, cargo text, funcao text, vinculo text, school_name text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE words text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('localizar-servidor-por-identificador', _school) THEN RAISE EXCEPTION 'lookup:capability-missing'; END IF;
  words := pg_catalog.regexp_split_to_array(pg_catalog.lower(pg_catalog.btrim(coalesce(_name,''))), '\s+');
  IF coalesce(pg_catalog.cardinality(words),0) < 2 OR pg_catalog.length(pg_catalog.btrim(_name)) < 6 THEN RAISE EXCEPTION 'lookup:name-too-short'; END IF;
  INSERT INTO public.exact_lookup_events(user_id, purpose, school_id, identifier_kind, outcome) VALUES (auth.uid(), 'localizar-servidor', _school, 'nome', 'consulta');
  RETURN QUERY
  SELECT DISTINCT ON (r.full_name, r.registration) r.full_name, r.registration, r.cargo, r.funcao, r.vinculo, r.school_name_source
  FROM public.staff_administrative_records r
  WHERE (SELECT pg_catalog.bool_and(pg_catalog.strpos(pg_catalog.lower(r.full_name), w) > 0) FROM pg_catalog.unnest(words) w)
  ORDER BY r.full_name, r.registration, r.imported_at DESC
  LIMIT 15;
END $function$;
REVOKE ALL ON FUNCTION public.locate_professional_by_name(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.locate_professional_by_name(text,text) TO authenticated;