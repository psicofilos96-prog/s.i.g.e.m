-- Local do registro (escola/aluno) só para quem pode anexar nessa escola; usado para compor o caminho privado.
CREATE FUNCTION public.inclusion_record_location(_record_logical uuid)
RETURNS TABLE(school_id text, student_id text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE s text; st text;
BEGIN
  SELECT r.school_id, r.student_id INTO s, st FROM public.inclusion_records r WHERE r.logical_id = _record_logical LIMIT 1;
  IF s IS NULL THEN RAISE EXCEPTION 'inclusion:record-unknown'; END IF;
  PERFORM public.inclusion_require('anexar-documento-inclusao', s);
  RETURN QUERY SELECT s, st;
END $fn$;
REVOKE ALL ON FUNCTION public.inclusion_record_location(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inclusion_record_location(uuid) TO authenticated;