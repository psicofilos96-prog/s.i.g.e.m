-- has_capability(cap, NULL) só casava concessões sem turma; capacidade de rede é verificada por has_network_capability.
CREATE OR REPLACE FUNCTION public.record_op_permanent_board_version(_stage text, _expected_head uuid, _title text, _sections jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE head public.op_permanent_board_versions; _new uuid; _st text := btrim(coalesce(_stage,''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT public.has_network_capability('manter-quadro-permanente-op') THEN RAISE EXCEPTION 'board:capability-missing'; END IF;
  IF _st = '' OR coalesce(btrim(_title),'') = '' THEN RAISE EXCEPTION 'board:fields-required'; END IF;
  IF jsonb_typeof(_sections) <> 'array' OR jsonb_array_length(_sections) = 0 THEN RAISE EXCEPTION 'board:sections-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('opboard:' || _st));
  SELECT * INTO head FROM public.op_permanent_board_versions b WHERE b.stage_key = _st ORDER BY b.version DESC LIMIT 1;
  IF head.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'board:head-changed'; END IF;
  IF head.id IS NOT NULL AND coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'board:reason-required'; END IF;
  INSERT INTO public.op_permanent_board_versions(stage_key, version, supersedes_id, title, sections, change_reason, author_user_id)
  VALUES (_st, coalesce(head.version,0)+1, head.id, btrim(_title), _sections, nullif(btrim(_reason),''), auth.uid()) RETURNING id INTO _new;
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.record_op_permanent_board_version(text,uuid,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_op_permanent_board_version(text,uuid,text,jsonb,text) TO authenticated;