-- N5.3.1b — autoria real do principal setorial no cadastro (substitui o caminho técnico provisório da 0219).
CREATE OR REPLACE FUNCTION public.institutional_class_register_principal(_school_id text, _academic_year_id text, _code text, _name text, _valid_from date, _valid_until date, _act_ref text, _principal uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _school_name text; _year_name text; _class_id text; _at timestamptz;
BEGIN
  IF _principal IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'class:author-xor'; END IF;
  IF coalesce(pg_catalog.btrim(_name), '') = '' THEN RAISE EXCEPTION 'class:name-required'; END IF;
  IF _valid_from IS NULL OR (_valid_until IS NOT NULL AND _valid_until < _valid_from) THEN RAISE EXCEPTION 'class:invalid-dates'; END IF;
  _act_ref := NULLIF(pg_catalog.btrim(_act_ref), '');
  SELECT c.school_name, c.year_name INTO _school_name, _year_name FROM public.class_record_context(_school_id, _academic_year_id, _valid_from, _valid_until) c;
  _class_id := 'turma-' || pg_catalog.gen_random_uuid(); _at := pg_catalog.clock_timestamp();
  INSERT INTO public.institutional_classes (id, school_id, school_label_snapshot, academic_year_id, academic_year_label, code, name, valid_from, valid_until, originating_act_ref, created_at)
  VALUES (_class_id, _school_id, _school_name, _academic_year_id, _year_name, NULLIF(pg_catalog.btrim(_code), ''), pg_catalog.btrim(_name), _valid_from, _valid_until, _act_ref, _at);
  INSERT INTO public.institutional_class_record_versions (class_id, segment_id, version, code, name, administrative_status, valid_from, valid_until, originating_act_ref, recorded_by, recorded_by_principal_id, created_at)
  VALUES (_class_id, pg_catalog.gen_random_uuid(), 1, NULLIF(pg_catalog.btrim(_code), ''), pg_catalog.btrim(_name), 'ativa', _valid_from, _valid_until, _act_ref, auth.uid(), _principal, _at);
  RETURN _class_id;
END $$;
REVOKE ALL ON FUNCTION public.institutional_class_register_principal(text, text, text, text, date, date, text, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.secretariat_create_class(_school text, _year text, _code text, _name text, _valid_from date, _valid_until date,
  _composition jsonb, _shift jsonb, _capacity integer, _source_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE ac record; st text; g record; cid text; comp uuid; sh uuid; cap uuid; act text;
BEGIN
  SELECT * INTO ac FROM public.sec_actor();
  IF _school IS NULL OR _year IS NULL THEN RAISE EXCEPTION 'class:context-required'; END IF;
  IF NOT public.has_school_capability('manter-cadastro-de-turmas', _school) THEN RAISE EXCEPTION 'class:school-capability-required'; END IF;
  SELECT s.state INTO st FROM public.academic_year_operational_state_at(_year) s LIMIT 1;
  IF st IS NULL OR st NOT IN ('em-preparacao','operacional') THEN RAISE EXCEPTION 'class:year-not-open'; END IF;
  IF _capacity IS NOT NULL AND _capacity < 1 THEN RAISE EXCEPTION 'capacity:positive-required'; END IF;
  act := coalesce(nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''), 'Cadastro pela Secretaria Escolar');
  IF EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.school_id = _school AND c.academic_year_id = _year AND pg_catalog.lower(pg_catalog.btrim(c.name)) = pg_catalog.lower(pg_catalog.btrim(coalesce(_name,'')))) THEN
    RAISE EXCEPTION 'class:duplicate-name'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('class-create:' || _school || ':' || _year));
  IF ac.kind = 'human' THEN
    SELECT x.* INTO g FROM public.class_registry_school_grant('manter-cadastro-de-turmas', _school) x;
    IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'class:school-capability-required'; END IF;
    cid := public.institutional_class_register_core(_school, _year, _code, _name, 'ativa', _valid_from, _valid_until, act, auth.uid(), ac.person_id, g.engagement_id, g.policy_id, NULL);
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.id = ac.principal_id AND p.station_code = 'secretaria_escolar' AND p.school_id = _school) THEN
      RAISE EXCEPTION 'class:school-capability-required'; END IF;
    cid := public.institutional_class_register_principal(_school, _year, _code, _name, _valid_from, _valid_until, act, ac.principal_id);
  END IF;
  IF _composition IS NOT NULL THEN comp := public.class_composition_core(cid, NULL, _composition, _valid_from, _valid_until, NULL); END IF;
  IF _shift IS NOT NULL THEN sh := public.record_class_shift_version('shift-' || cid, NULL, cid, _shift->>'value', (_shift->>'version')::int, _valid_from, _valid_until, NULL, act); END IF;
  IF _capacity IS NOT NULL THEN cap := public.record_class_capacity('cap-' || cid, NULL, cid, _capacity, _valid_from, _valid_until, NULL, act, NULL, false); END IF;
  RETURN pg_catalog.jsonb_build_object('class_id', cid, 'composition_version_id', comp, 'shift_version_id', sh, 'capacity_record_id', cap, 'actor_kind', ac.kind);
END $$;
REVOKE ALL ON FUNCTION public.secretariat_create_class(text, text, text, text, date, date, jsonb, jsonb, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_create_class(text, text, text, text, date, date, jsonb, jsonb, integer, text) TO authenticated;