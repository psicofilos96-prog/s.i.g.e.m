CREATE OR REPLACE FUNCTION public.attach_tech_change_document(_change uuid, _kind text, _case_event uuid, _note text, _key text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.tech_changes; _id uuid; _last text;
BEGIN
  SELECT id INTO _id FROM public.tech_change_documents WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _c FROM public.tech_changes WHERE id = _change FOR UPDATE;
  IF _c.id IS NULL OR NOT public.tech_can_manage(_c.school_id) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT action INTO _last FROM public.tech_change_events WHERE change_id = _change ORDER BY seq DESC LIMIT 1;
  IF _last IN ('rejeitar','encerrar') THEN RAISE EXCEPTION 'mudanca-fechada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_case_events e WHERE e.id = _case_event AND e.event_type = 'documento_juntado') THEN RAISE EXCEPTION 'juntada-inexistente'; END IF;
  INSERT INTO public.tech_change_documents(change_id, kind, case_event_ref, note, person_id, idempotency_key)
  VALUES (_change, _kind, _case_event, btrim(_note), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;
REVOKE ALL ON FUNCTION public.attach_tech_change_document(uuid, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_tech_change_document(uuid, text, uuid, text, text) TO authenticated;
