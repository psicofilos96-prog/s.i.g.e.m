CREATE OR REPLACE FUNCTION public.record_academic_year_operational_state(
  _academic_year_id text, _state text, _expected_sequence integer, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _head public.academic_year_operational_states; _id uuid; _person text; _eng text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'year-state:no-session'; END IF;
  IF NOT public.has_network_capability('preparar-ano-letivo') THEN RAISE EXCEPTION 'year-state:capability'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN RAISE EXCEPTION 'year-state:reason-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('year-state:' || _academic_year_id));
  SELECT * INTO _head FROM public.academic_year_operational_states
   WHERE academic_year_id = _academic_year_id ORDER BY sequence DESC LIMIT 1;
  IF COALESCE(_head.sequence, 0) <> COALESCE(_expected_sequence, 0) THEN RAISE EXCEPTION 'year-state:stale-head'; END IF;
  IF NOT (
    (_head.id IS NULL AND _state = 'em-preparacao') OR
    (_head.state = 'em-preparacao' AND _state = 'operacional') OR
    (_head.state = 'operacional' AND _state = 'encerrado') OR
    (_head.state = 'historico-importado' AND _state = 'encerrado')
  ) THEN RAISE EXCEPTION 'year-state:transition-not-allowed'; END IF;
  SELECT l.person_id::text INTO _person FROM public.user_person_links l WHERE l.user_id = auth.uid();
  IF _person IS NULL THEN RAISE EXCEPTION 'year-state:no-person'; END IF;
  SELECT e.id::text INTO _eng FROM public.institutional_engagements e
   WHERE e.person_id::text = _person AND e.scope_level = 'network'
     AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)
   ORDER BY e.created_at DESC LIMIT 1;
  IF _eng IS NULL THEN RAISE EXCEPTION 'year-state:no-engagement'; END IF;
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, supersedes_id, reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_academic_year_id, COALESCE(_head.sequence,0)+1, _state, _head.id, _reason, auth.uid(), _person, _eng)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_academic_year_operational_state(text,text,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_academic_year_operational_state(text,text,integer,text) TO authenticated;