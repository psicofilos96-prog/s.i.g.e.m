CREATE OR REPLACE FUNCTION public.record_collegial_deliberation(_session_id text, _expected_last_event_id uuid, _document jsonb, _plan_id text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _last record; _auth record; _existing text; _item text := _document->>'agendaItemId';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' OR coalesce(btrim(_document->>'id'),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF _document->>'sessionId' IS DISTINCT FROM _session_id THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('collegial-session:' || _session_id));
  SELECT * INTO _last FROM public.collegial_session_events WHERE session_id = _session_id ORDER BY sequence DESC LIMIT 1;
  IF _last.id IS NULL THEN RAISE EXCEPTION 'session-unavailable'; END IF;
  BEGIN
    SELECT * INTO _auth FROM public.collegial_conduct_authority(_last.body_id, _last.body_configuration_version, _last.class_id);
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'session-unavailable';
  END;
  IF _auth.engagement_id IS NULL THEN RAISE EXCEPTION 'session-unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.collegial_deliberations WHERE plan_id = _plan_id AND author_user_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'plan-conflict'; END IF;
  SELECT id INTO _existing FROM public.collegial_deliberations WHERE plan_id = _plan_id AND author_user_id = auth.uid();
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  IF _last.id IS DISTINCT FROM _expected_last_event_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  IF EXISTS (SELECT 1 FROM public.collegial_minute_versions WHERE session_id = _session_id) THEN RAISE EXCEPTION 'session-concluded'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_last.document->'agenda') a WHERE a->>'id' = _item) THEN RAISE EXCEPTION 'agenda-item-not-found'; END IF;
  IF coalesce(btrim(_document->>'rationale'),'') = '' THEN RAISE EXCEPTION 'justification-required'; END IF;
  INSERT INTO public.collegial_deliberations (id, session_id, class_id, agenda_item_id, student_id, document, plan_id,
    author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_document->>'id', _session_id, _last.class_id, _item, NULLIF(_document->>'studentId',''), _document, _plan_id,
    auth.uid(), public.current_person_id(), _auth.engagement_id, _auth.policy_id, _auth.policy_version);
  RETURN _document->>'id';
END $function$;

CREATE OR REPLACE FUNCTION public.close_collegial_minute(_session_id text, _expected_last_event_id uuid, _expected_minute_id text, _document jsonb, _plan_id text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _last record; _auth record; _existing text; _current record; _ids text[]; _doc_ids text[]; _version int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' OR coalesce(btrim(_document->>'id'),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF _document->>'sessionId' IS DISTINCT FROM _session_id THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('collegial-session:' || _session_id));
  SELECT * INTO _last FROM public.collegial_session_events WHERE session_id = _session_id ORDER BY sequence DESC LIMIT 1;
  IF _last.id IS NULL THEN RAISE EXCEPTION 'session-unavailable'; END IF;
  BEGIN
    SELECT * INTO _auth FROM public.collegial_conduct_authority(_last.body_id, _last.body_configuration_version, _last.class_id);
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'session-unavailable';
  END;
  IF _auth.engagement_id IS NULL THEN RAISE EXCEPTION 'session-unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.collegial_minute_versions WHERE plan_id = _plan_id AND author_user_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'plan-conflict'; END IF;
  SELECT id INTO _existing FROM public.collegial_minute_versions WHERE plan_id = _plan_id AND author_user_id = auth.uid();
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  IF _last.id IS DISTINCT FROM _expected_last_event_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  SELECT m.* INTO _current FROM public.collegial_minute_versions m WHERE m.session_id = _session_id
    AND NOT EXISTS (SELECT 1 FROM public.collegial_minute_versions s WHERE s.preceding_minute_id = m.id);
  IF _current.id IS DISTINCT FROM _expected_minute_id THEN RAISE EXCEPTION 'minute-changed'; END IF;
  SELECT coalesce(array_agg(x->>'id' ORDER BY x->>'id'), '{}') INTO _doc_ids FROM jsonb_array_elements(coalesce(_document->'deliberations','[]'::jsonb)) x;
  IF _current.id IS NULL THEN
    SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO _ids FROM public.collegial_deliberations WHERE session_id = _session_id;
    IF _ids IS DISTINCT FROM _doc_ids THEN RAISE EXCEPTION 'deliberation-changed'; END IF;
    _version := 1;
  ELSE
    IF coalesce(btrim(_document->'rectification'->>'justification'),'') = '' THEN RAISE EXCEPTION 'justification-required'; END IF;
    IF (SELECT array_agg(x ORDER BY x) FROM unnest(_current.deliberation_ids) x) IS DISTINCT FROM _doc_ids THEN RAISE EXCEPTION 'deliberation-changed'; END IF;
    _ids := _doc_ids;
    _version := _current.version + 1;
  END IF;
  IF (_document->>'version')::int IS DISTINCT FROM _version THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  INSERT INTO public.collegial_minute_versions (id, session_id, class_id, version, preceding_minute_id, document, deliberation_ids,
    rectification_justification, plan_id, author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_document->>'id', _session_id, _last.class_id, _version, _current.id, _document, _ids,
    NULLIF(btrim(_document->'rectification'->>'justification'),''), _plan_id,
    auth.uid(), public.current_person_id(), _auth.engagement_id, _auth.policy_id, _auth.policy_version);
  RETURN _document->>'id';
END $function$;

CREATE OR REPLACE FUNCTION public.record_collegial_session_event(_session_id text, _kind text, _expected_last_event_id uuid, _document jsonb, _plan_id text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _class text := _document->'scope'->>'classId'; _body text := _document->>'bodyId';
  _ver integer := (_document->>'bodyConfigurationVersion')::int; _auth record; _last record; _first record; _existing uuid; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF _document->>'id' IS DISTINCT FROM _session_id OR coalesce(_class,'') = '' THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
  IF _kind NOT IN ('abertura','composicao','pauta') THEN RAISE EXCEPTION 'unknown-action'; END IF;
  SELECT * INTO _auth FROM public.collegial_conduct_authority(_body, _ver, _class);
  IF _auth.engagement_id IS NULL THEN RAISE EXCEPTION 'capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('collegial-session:' || _session_id));
  SELECT * INTO _first FROM public.collegial_session_events WHERE session_id = _session_id AND sequence = 1;
  IF _first.id IS NOT NULL AND (_first.class_id <> _class OR _first.body_id <> _body OR _first.body_configuration_version <> _ver) THEN
    RAISE EXCEPTION 'session-unavailable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.collegial_session_events WHERE plan_id = _plan_id AND author_user_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'plan-conflict'; END IF;
  SELECT id INTO _existing FROM public.collegial_session_events WHERE plan_id = _plan_id AND author_user_id = auth.uid();
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  IF EXISTS (SELECT 1 FROM public.collegial_minute_versions WHERE session_id = _session_id) THEN RAISE EXCEPTION 'session-concluded'; END IF;
  SELECT * INTO _last FROM public.collegial_session_events WHERE session_id = _session_id ORDER BY sequence DESC LIMIT 1;
  IF _last.id IS DISTINCT FROM _expected_last_event_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  IF _last.id IS NULL AND _kind <> 'abertura' THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
  IF _last.id IS NOT NULL AND _kind = 'abertura' THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
  INSERT INTO public.collegial_session_events (session_id, class_id, body_id, body_configuration_version, sequence, preceding_event_id,
    kind, document, plan_id, author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_session_id, _class, _body, _ver, coalesce(_last.sequence,0)+1, _last.id, _kind, _document, _plan_id,
    auth.uid(), public.current_person_id(), _auth.engagement_id, _auth.policy_id, _auth.policy_version)
  RETURNING id INTO _id;
  RETURN _id;
END $function$;

REVOKE ALL ON FUNCTION public.record_collegial_deliberation(text, uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_collegial_minute(text, uuid, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_collegial_session_event(text, text, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_collegial_deliberation(text, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_collegial_minute(text, uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_collegial_session_event(text, text, uuid, jsonb, text) TO authenticated;