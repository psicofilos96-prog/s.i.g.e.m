CREATE OR REPLACE FUNCTION public.enrollment_draft_complete_with_origin(_draft uuid, _expected integer, _year text, _declared_on date, _class text, _entry_kind text, _origin_kind text, _origin_inep text, _origin_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE r jsonb;
BEGIN
  IF _entry_kind NOT IN ('aluno-novo','transferencia-recebida') THEN RAISE EXCEPTION 'forma de ingresso obrigatória'; END IF;
  IF _entry_kind = 'transferencia-recebida' AND nullif(btrim(coalesce(_origin_name,'')),'') IS NULL THEN RAISE EXCEPTION 'escola de origem obrigatória'; END IF;
  r := public.enrollment_draft_complete(_draft, _expected, _year, _declared_on, _class);
  PERFORM public.record_enrollment_entry_origin(r->>'enrollment_id', _entry_kind, _origin_kind, _origin_inep, _origin_name);
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.enrollment_draft_complete_with_origin(uuid,integer,text,date,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enrollment_draft_complete_with_origin(uuid,integer,text,date,text,text,text,text,text) TO authenticated;