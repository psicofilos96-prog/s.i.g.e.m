-- B4.3/B4.4 — writers de jornada e grade da turma PREPARADOS E FECHADOS (aditivo; 0018–0022 intactas).
-- Nenhuma regra de política é criada: as capabilities abaixo não existem em nenhuma política homologada,
-- portanto o portão falha fechado ('capability:<id>') até o proprietário decidir quem as recebe.

CREATE FUNCTION public.b4_class_time_capabilities() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$ SELECT ARRAY['manter-jornada-da-turma','manter-grade-da-turma']::text[] $$;
REVOKE ALL ON FUNCTION public.b4_class_time_capabilities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.b4_class_time_capabilities() TO authenticated;

CREATE FUNCTION public.b4_class_time_grant(_capability text, _school text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability IS NULL OR NOT (_capability = ANY (public.b4_class_time_capabilities())) THEN
    RAISE EXCEPTION 'class-time:capability-not-allowed'; END IF;
  IF _school IS NULL THEN RAISE EXCEPTION 'class-time:class-not-found'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL
     AND ((c.scope_level = 'escola' AND c.school_id = _school) OR c.scope_level = 'rede')
   ORDER BY (c.scope_level = 'escola') DESC, c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.b4_class_time_grant(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.record_class_journey_version(_class_id text, _expected_head_id uuid, _change_kind text,
  _valid_from date, _valid_until date, _source_ref text, _reason text, _intervals jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _school text; g uuid; _jid text; _head uuid; _hver integer; _vid uuid; _n integer; i jsonb;
BEGIN
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _class_id;
  g := public.b4_class_time_grant('manter-jornada-da-turma', _school);
  IF _change_kind IS NULL OR _change_kind NOT IN ('constituicao','sucessao','retificacao') THEN RAISE EXCEPTION 'journey:invalid-change-kind'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'journey:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'journey:invalid-window'; END IF;
  IF _change_kind <> 'constituicao' AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'journey:reason-required'; END IF;
  IF _intervals IS NULL OR pg_catalog.jsonb_typeof(_intervals) <> 'array' OR pg_catalog.jsonb_array_length(_intervals) = 0 THEN
    RAISE EXCEPTION 'journey:intervals-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('journey:' || _class_id, 0));
  SELECT j.id INTO _jid FROM public.class_journeys j WHERE j.class_id = _class_id;
  IF _jid IS NOT NULL THEN
    SELECT v.id, v.version INTO _head, _hver FROM public.class_journey_versions v WHERE v.journey_id = _jid ORDER BY v.version DESC LIMIT 1;
  END IF;
  IF _expected_head_id IS DISTINCT FROM _head THEN RAISE EXCEPTION 'journey:stale-head'; END IF;
  IF (_head IS NULL) <> (_change_kind = 'constituicao') THEN RAISE EXCEPTION 'journey:invalid-change-kind'; END IF;
  IF _jid IS NULL THEN
    _jid := 'cj-' || gen_random_uuid()::text;
    INSERT INTO public.class_journeys(id, class_id) VALUES (_jid, _class_id);
  END IF;
  INSERT INTO public.class_journey_versions(journey_id, version, supersedes_id, change_kind, valid_from, valid_until,
      originating_act_ref, change_reason, recorded_by, recorded_by_person_id)
    VALUES (_jid, coalesce(_hver,0)+1, _head, _change_kind, _valid_from, _valid_until,
      coalesce(nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''), 'decisao-interna-sem-documento-fonte'),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id())
    RETURNING id INTO _vid;
  _n := 0;
  FOR i IN SELECT * FROM pg_catalog.jsonb_array_elements(_intervals) LOOP
    INSERT INTO public.class_journey_intervals(version_id, weekday, starts_at, ends_at)
      VALUES (_vid, (i->>'weekday')::smallint, (i->>'starts_at')::time, (i->>'ends_at')::time);
    _n := _n + 1;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('journey_id', _jid, 'version_id', _vid, 'version', coalesce(_hver,0)+1,
    'intervals', _n, 'engagement_id', g);
END $fn$;
REVOKE ALL ON FUNCTION public.record_class_journey_version(text, uuid, text, date, date, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_class_journey_version(text, uuid, text, date, date, text, text, jsonb) TO authenticated;

CREATE FUNCTION public.record_class_schedule_version(_class_id text, _expected_head_id uuid, _change_kind text,
  _valid_from date, _valid_until date, _source_ref text, _reason text, _blocks jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _school text; g uuid; _sid text; _head uuid; _hver integer; _vid uuid; _bid uuid; _n integer; b jsonb; e text;
BEGIN
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _class_id;
  g := public.b4_class_time_grant('manter-grade-da-turma', _school);
  IF _change_kind IS NULL OR _change_kind NOT IN ('constituicao','sucessao','retificacao') THEN RAISE EXCEPTION 'schedule:invalid-change-kind'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'schedule:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'schedule:invalid-window'; END IF;
  IF _change_kind <> 'constituicao' AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'schedule:reason-required'; END IF;
  IF _blocks IS NULL OR pg_catalog.jsonb_typeof(_blocks) <> 'array' OR pg_catalog.jsonb_array_length(_blocks) = 0 THEN
    RAISE EXCEPTION 'schedule:blocks-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule:' || _class_id, 0));
  SELECT s.id INTO _sid FROM public.class_schedules s WHERE s.class_id = _class_id;
  IF _sid IS NOT NULL THEN
    SELECT v.id, v.version INTO _head, _hver FROM public.class_schedule_versions v WHERE v.schedule_id = _sid ORDER BY v.version DESC LIMIT 1;
  END IF;
  IF _expected_head_id IS DISTINCT FROM _head THEN RAISE EXCEPTION 'schedule:stale-head'; END IF;
  IF (_head IS NULL) <> (_change_kind = 'constituicao') THEN RAISE EXCEPTION 'schedule:invalid-change-kind'; END IF;
  IF _sid IS NULL THEN
    _sid := 'csch-' || gen_random_uuid()::text;
    INSERT INTO public.class_schedules(id, class_id) VALUES (_sid, _class_id);
  END IF;
  INSERT INTO public.class_schedule_versions(schedule_id, version, supersedes_id, change_kind, valid_from, valid_until,
      originating_act_ref, change_reason, recorded_by, recorded_by_person_id)
    VALUES (_sid, coalesce(_hver,0)+1, _head, _change_kind, _valid_from, _valid_until,
      coalesce(nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''), 'decisao-interna-sem-documento-fonte'),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id())
    RETURNING id INTO _vid;
  _n := 0;
  FOR b IN SELECT * FROM pg_catalog.jsonb_array_elements(_blocks) LOOP
    INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id,
        nature_scheme_id, nature_value_id, nature_value_version)
      VALUES (_vid, b->>'block_key', (b->>'weekday')::smallint, (b->>'starts_at')::time, (b->>'ends_at')::time,
        b->>'component_id', b->>'nature_scheme_id', b->>'nature_value_id', (b->>'nature_value_version')::integer)
      RETURNING id INTO _bid;
    IF b ? 'engagement_ids' THEN
      FOR e IN SELECT * FROM pg_catalog.jsonb_array_elements_text(b->'engagement_ids') LOOP
        INSERT INTO public.class_schedule_block_engagements(block_id, engagement_id) VALUES (_bid, e::uuid);
      END LOOP;
    END IF;
    _n := _n + 1;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('schedule_id', _sid, 'version_id', _vid, 'version', coalesce(_hver,0)+1,
    'blocks', _n, 'engagement_id', g);
END $fn$;
REVOKE ALL ON FUNCTION public.record_class_schedule_version(text, uuid, text, date, date, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_class_schedule_version(text, uuid, text, date, date, text, text, jsonb) TO authenticated;