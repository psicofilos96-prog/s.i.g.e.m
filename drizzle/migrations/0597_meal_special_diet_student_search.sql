CREATE OR REPLACE FUNCTION public.meal_special_diet_student_search(_school text, _q text)
RETURNS TABLE(student_id text, student_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF public.msd_principal('secretaria_escolar', _school) IS NULL THEN RAISE EXCEPTION 'diet:secretaria-only'; END IF;
  IF length(btrim(coalesce(_q,''))) < 3 THEN RETURN; END IF;
  RETURN QUERY SELECT DISTINCT ON (v.student_id) v.student_id, v.civil_name
  FROM public.student_identity_versions v
  WHERE v.civil_name ILIKE '%' || btrim(_q) || '%'
    AND EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = v.student_id AND e.school_id = _school)
  ORDER BY v.student_id, v.version DESC LIMIT 20;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_special_diet_student_search(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meal_special_diet_student_search(text, text) TO authenticated;