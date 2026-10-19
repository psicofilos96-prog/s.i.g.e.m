CREATE OR REPLACE FUNCTION public.direcao_occurrence_staff(_school text, _q text)
RETURNS TABLE(person_key text, name text, cargo text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.auth_user_id = auth.uid()
    AND p.station_code = 'direcao_escolar' AND p.school_id = _school) THEN RAISE EXCEPTION 'occurrence:direcao-only'; END IF;
  IF length(btrim(coalesce(_q, ''))) < 3 THEN RETURN; END IF;
  RETURN QUERY SELECT x.person_key, x.name, x.cargo FROM (
    SELECT DISTINCT p.id::text AS person_key, p.display_name AS name, 'Professor(a)'::text AS cargo
    FROM public.institutional_engagements e JOIN public.institutional_classes c ON c.id = e.class_id
    JOIN public.institutional_persons p ON p.id = e.person_id
    WHERE c.school_id = _school AND e.engagement_kind_id = 'professor'
    UNION
    SELECT 'q:' || s.id::text, s.full_name, coalesce(s.funcao, s.cargo)
    FROM public.staff_administrative_records s
    WHERE s.school_id = _school AND s.source_kind = 'servidores-por-escola') x
  WHERE lower(unaccent(coalesce(x.name, ''))) LIKE '%' || lower(unaccent(btrim(_q))) || '%'
  ORDER BY x.name LIMIT 20;
END $$;
REVOKE ALL ON FUNCTION public.direcao_occurrence_staff(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direcao_occurrence_staff(text, text) TO authenticated;