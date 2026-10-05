-- R5.1 — hardening append-only dos writers E2–E4 após auditoria da 0059.
-- Não altera política v4, não homologa nada e não grava dados curriculares.
-- Corrige detecção de sobreposição para considerar todas as janelas efetivas históricas
-- (não apenas a última versão de cada identidade) e nomeia versões JSON malformadas como recusa de domínio.

CREATE OR REPLACE FUNCTION public.record_correspondence_profile_version(
  _profile text, _base_version_id uuid, _change_kind text, _valid_from date, _valid_until date,
  _reason text, _act_ref text, _position_key_schemes text[], _nature_scheme_id text,
  _nature_gates jsonb, _applicability_rule jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; _pid text; _ver integer; _sup uuid; _vid uuid; x jsonb; _s text;
BEGIN
  g := public.r5_network_grant('manter-perfis-correspondencia-curricular');
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'profile:act-required'; END IF;
  IF _position_key_schemes IS NULL OR pg_catalog.cardinality(_position_key_schemes) = 0 THEN RAISE EXCEPTION 'profile:position-key-required'; END IF;
  FOREACH _s IN ARRAY _position_key_schemes LOOP
    IF _s IS NULL OR _s !~ '^[a-z0-9][a-z0-9-]*$' THEN RAISE EXCEPTION 'profile:position-key-invalid'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT k) FROM unnest(_position_key_schemes) k) <> pg_catalog.cardinality(_position_key_schemes) THEN
    RAISE EXCEPTION 'profile:position-key-duplicate'; END IF;
  IF _nature_scheme_id IS NOT NULL AND _nature_scheme_id !~ '^[a-z0-9][a-z0-9-]*$' THEN RAISE EXCEPTION 'profile:nature-scheme-invalid'; END IF;
  IF _nature_gates IS NULL OR pg_catalog.jsonb_typeof(_nature_gates) <> 'array' THEN RAISE EXCEPTION 'profile:nature-gates-required'; END IF;
  IF pg_catalog.jsonb_array_length(_nature_gates) > 0 AND _nature_scheme_id IS NULL THEN RAISE EXCEPTION 'profile:gates-without-nature-axis'; END IF;
  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(_nature_gates) e LOOP
    IF coalesce(x->>'effect','') NOT IN ('matching-regular','associacao-explicita','fora-de-correspondencia') THEN RAISE EXCEPTION 'profile:gate-effect-invalid'; END IF;
    IF x->>'value' IS NULL OR x->>'version' IS NULL OR x->>'version' !~ '^[1-9][0-9]*
      RAISE EXCEPTION 'profile:gate-value-not-homologated'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT e->>'value') FROM pg_catalog.jsonb_array_elements(_nature_gates) e) <> pg_catalog.jsonb_array_length(_nature_gates) THEN
    RAISE EXCEPTION 'profile:gate-duplicate'; END IF;
  IF _applicability_rule IS NOT NULL AND (pg_catalog.jsonb_typeof(_applicability_rule) <> 'object'
      OR _applicability_rule->>'scheme' IS NULL OR _applicability_rule->>'value' IS NULL OR _applicability_rule->>'version' IS NULL
      OR _applicability_rule->>'version' !~ '^[1-9][0-9]*(_applicability_rule->>'scheme', _applicability_rule->>'value', (_applicability_rule->>'version')::integer, _valid_from, _valid_until)) THEN
    RAISE EXCEPTION 'profile:applicability-rule-not-homologated'; END IF;

  SELECT s.next_version, s.supersedes INTO _ver, _sup FROM public.r5_version_step('profile', 'curricular_correspondence_profile_versions', 'profile_id',
    _profile, _base_version_id, _change_kind, _valid_from, _valid_until, _reason) s;
  _pid := coalesce(_profile, 'ccp-' || gen_random_uuid()::text);
  -- Um único perfil de rede por vez: sobreposição com outro perfil ⇒ recusa (o reader seria ambíguo).
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('profile:network', 0));
  IF EXISTS (
    WITH eff AS (
      SELECT o.* FROM public.curricular_correspondence_profile_versions o
      WHERE NOT EXISTS (
        SELECT 1 FROM public.curricular_correspondence_profile_versions r
        WHERE r.supersedes_id = o.id AND r.change_kind = 'retificacao'
      )
    ),
    win AS (
      SELECT e.*,
        LEAST(e.valid_until, (
          SELECT min(e2.valid_from) - 1 FROM eff e2
          WHERE e2.profile_id = e.profile_id AND e2.version > e.version
        )) AS effective_until
      FROM eff e
    )
    SELECT 1 FROM win o
    WHERE o.profile_id <> _pid
      AND o.valid_from <= coalesce(_valid_until, 'infinity'::date)
      AND _valid_from <= coalesce(o.effective_until, 'infinity'::date)
  ) THEN RAISE EXCEPTION 'profile:overlaps-other-profile'; END IF;
  IF _profile IS NULL THEN INSERT INTO public.curricular_correspondence_profiles(id) VALUES (_pid); END IF;

  INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, supersedes_id, change_kind, valid_from, valid_until,
    originating_act_ref, change_reason, applicability_rule_scheme_id, applicability_rule_value_id, applicability_rule_value_version,
    recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_pid, _ver, _sup, _change_kind, _valid_from, _valid_until, pg_catalog.btrim(_act_ref), nullif(pg_catalog.btrim(coalesce(_reason,'')),''),
    _applicability_rule->>'scheme', _applicability_rule->>'value', (_applicability_rule->>'version')::integer,
    auth.uid(), public.current_person_id(), g) RETURNING id INTO _vid;
  INSERT INTO public.curricular_correspondence_profile_position_keys(profile_version_id, scheme_id) SELECT _vid, k FROM unnest(_position_key_schemes) k;
  IF _nature_scheme_id IS NOT NULL THEN
    INSERT INTO public.curricular_correspondence_profile_nature_axis(profile_version_id, scheme_id) VALUES (_vid, _nature_scheme_id);
    INSERT INTO public.curricular_correspondence_profile_nature_gates(profile_version_id, scheme_id, value_id, value_version, effect)
    SELECT _vid, _nature_scheme_id, e->>'value', (e->>'version')::integer, e->>'effect' FROM pg_catalog.jsonb_array_elements(_nature_gates) e;
  END IF;
  RETURN pg_catalog.jsonb_build_object('profile_id', _pid, 'version_id', _vid, 'version', _ver);
END $fn$; OR NOT public.b33_value_homologated_throughout(_nature_scheme_id, x->>'value', (x->>'version')::integer, _valid_from, _valid_until) THEN
      RAISE EXCEPTION 'profile:gate-value-not-homologated'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT e->>'value') FROM pg_catalog.jsonb_array_elements(_nature_gates) e) <> pg_catalog.jsonb_array_length(_nature_gates) THEN
    RAISE EXCEPTION 'profile:gate-duplicate'; END IF;
  IF _applicability_rule IS NOT NULL AND (pg_catalog.jsonb_typeof(_applicability_rule) <> 'object'
      OR _applicability_rule->>'scheme' IS NULL OR _applicability_rule->>'value' IS NULL OR _applicability_rule->>'version' IS NULL
      OR NOT public.b33_value_homologated_throughout(_applicability_rule->>'scheme', _applicability_rule->>'value', (_applicability_rule->>'version')::integer, _valid_from, _valid_until)) THEN
    RAISE EXCEPTION 'profile:applicability-rule-not-homologated'; END IF;

  SELECT s.next_version, s.supersedes INTO _ver, _sup FROM public.r5_version_step('profile', 'curricular_correspondence_profile_versions', 'profile_id',
    _profile, _base_version_id, _change_kind, _valid_from, _valid_until, _reason) s;
  _pid := coalesce(_profile, 'ccp-' || gen_random_uuid()::text);
  -- Um único perfil de rede por vez: sobreposição com outro perfil ⇒ recusa (o reader seria ambíguo).
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('profile:network', 0));
  IF EXISTS (
    WITH eff AS (
      SELECT o.* FROM public.curricular_correspondence_profile_versions o
      WHERE NOT EXISTS (
        SELECT 1 FROM public.curricular_correspondence_profile_versions r
        WHERE r.supersedes_id = o.id AND r.change_kind = 'retificacao'
      )
    ),
    win AS (
      SELECT e.*,
        LEAST(e.valid_until, (
          SELECT min(e2.valid_from) - 1 FROM eff e2
          WHERE e2.profile_id = e.profile_id AND e2.version > e.version
        )) AS effective_until
      FROM eff e
    )
    SELECT 1 FROM win o
    WHERE o.profile_id <> _pid
      AND o.valid_from <= coalesce(_valid_until, 'infinity'::date)
      AND _valid_from <= coalesce(o.effective_until, 'infinity'::date)
  ) THEN RAISE EXCEPTION 'profile:overlaps-other-profile'; END IF;
  IF _profile IS NULL THEN INSERT INTO public.curricular_correspondence_profiles(id) VALUES (_pid); END IF;

  INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, supersedes_id, change_kind, valid_from, valid_until,
    originating_act_ref, change_reason, applicability_rule_scheme_id, applicability_rule_value_id, applicability_rule_value_version,
    recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_pid, _ver, _sup, _change_kind, _valid_from, _valid_until, pg_catalog.btrim(_act_ref), nullif(pg_catalog.btrim(coalesce(_reason,'')),''),
    _applicability_rule->>'scheme', _applicability_rule->>'value', (_applicability_rule->>'version')::integer,
    auth.uid(), public.current_person_id(), g) RETURNING id INTO _vid;
  INSERT INTO public.curricular_correspondence_profile_position_keys(profile_version_id, scheme_id) SELECT _vid, k FROM unnest(_position_key_schemes) k;
  IF _nature_scheme_id IS NOT NULL THEN
    INSERT INTO public.curricular_correspondence_profile_nature_axis(profile_version_id, scheme_id) VALUES (_vid, _nature_scheme_id);
    INSERT INTO public.curricular_correspondence_profile_nature_gates(profile_version_id, scheme_id, value_id, value_version, effect)
    SELECT _vid, _nature_scheme_id, e->>'value', (e->>'version')::integer, e->>'effect' FROM pg_catalog.jsonb_array_elements(_nature_gates) e;
  END IF;
  RETURN pg_catalog.jsonb_build_object('profile_id', _pid, 'version_id', _vid, 'version', _ver);
END $fn$;
      OR NOT public.b33_value_homologated_throughout(_applicability_rule->>'scheme', _applicability_rule->>'value', (_applicability_rule->>'version')::integer, _valid_from, _valid_until)) THEN
    RAISE EXCEPTION 'profile:applicability-rule-not-homologated'; END IF;

  SELECT s.next_version, s.supersedes INTO _ver, _sup FROM public.r5_version_step('profile', 'curricular_correspondence_profile_versions', 'profile_id',
    _profile, _base_version_id, _change_kind, _valid_from, _valid_until, _reason) s;
  _pid := coalesce(_profile, 'ccp-' || gen_random_uuid()::text);
  -- Um único perfil de rede por vez: sobreposição com outro perfil ⇒ recusa (o reader seria ambíguo).
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('profile:network', 0));
  IF EXISTS (
    WITH eff AS (
      SELECT o.* FROM public.curricular_correspondence_profile_versions o
      WHERE NOT EXISTS (
        SELECT 1 FROM public.curricular_correspondence_profile_versions r
        WHERE r.supersedes_id = o.id AND r.change_kind = 'retificacao'
      )
    ),
    win AS (
      SELECT e.*,
        LEAST(e.valid_until, (
          SELECT min(e2.valid_from) - 1 FROM eff e2
          WHERE e2.profile_id = e.profile_id AND e2.version > e.version
        )) AS effective_until
      FROM eff e
    )
    SELECT 1 FROM win o
    WHERE o.profile_id <> _pid
      AND o.valid_from <= coalesce(_valid_until, 'infinity'::date)
      AND _valid_from <= coalesce(o.effective_until, 'infinity'::date)
  ) THEN RAISE EXCEPTION 'profile:overlaps-other-profile'; END IF;
  IF _profile IS NULL THEN INSERT INTO public.curricular_correspondence_profiles(id) VALUES (_pid); END IF;

  INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, supersedes_id, change_kind, valid_from, valid_until,
    originating_act_ref, change_reason, applicability_rule_scheme_id, applicability_rule_value_id, applicability_rule_value_version,
    recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_pid, _ver, _sup, _change_kind, _valid_from, _valid_until, pg_catalog.btrim(_act_ref), nullif(pg_catalog.btrim(coalesce(_reason,'')),''),
    _applicability_rule->>'scheme', _applicability_rule->>'value', (_applicability_rule->>'version')::integer,
    auth.uid(), public.current_person_id(), g) RETURNING id INTO _vid;
  INSERT INTO public.curricular_correspondence_profile_position_keys(profile_version_id, scheme_id) SELECT _vid, k FROM unnest(_position_key_schemes) k;
  IF _nature_scheme_id IS NOT NULL THEN
    INSERT INTO public.curricular_correspondence_profile_nature_axis(profile_version_id, scheme_id) VALUES (_vid, _nature_scheme_id);
    INSERT INTO public.curricular_correspondence_profile_nature_gates(profile_version_id, scheme_id, value_id, value_version, effect)
    SELECT _vid, _nature_scheme_id, e->>'value', (e->>'version')::integer, e->>'effect' FROM pg_catalog.jsonb_array_elements(_nature_gates) e;
  END IF;
  RETURN pg_catalog.jsonb_build_object('profile_id', _pid, 'version_id', _vid, 'version', _ver);
END $fn$; OR NOT public.b33_value_homologated_throughout(_nature_scheme_id, x->>'value', (x->>'version')::integer, _valid_from, _valid_until) THEN
      RAISE EXCEPTION 'profile:gate-value-not-homologated'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT e->>'value') FROM pg_catalog.jsonb_array_elements(_nature_gates) e) <> pg_catalog.jsonb_array_length(_nature_gates) THEN
    RAISE EXCEPTION 'profile:gate-duplicate'; END IF;
  IF _applicability_rule IS NOT NULL AND (pg_catalog.jsonb_typeof(_applicability_rule) <> 'object'
      OR _applicability_rule->>'scheme' IS NULL OR _applicability_rule->>'value' IS NULL OR _applicability_rule->>'version' IS NULL
      OR NOT public.b33_value_homologated_throughout(_applicability_rule->>'scheme', _applicability_rule->>'value', (_applicability_rule->>'version')::integer, _valid_from, _valid_until)) THEN
    RAISE EXCEPTION 'profile:applicability-rule-not-homologated'; END IF;

  SELECT s.next_version, s.supersedes INTO _ver, _sup FROM public.r5_version_step('profile', 'curricular_correspondence_profile_versions', 'profile_id',
    _profile, _base_version_id, _change_kind, _valid_from, _valid_until, _reason) s;
  _pid := coalesce(_profile, 'ccp-' || gen_random_uuid()::text);
  -- Um único perfil de rede por vez: sobreposição com outro perfil ⇒ recusa (o reader seria ambíguo).
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('profile:network', 0));
  IF EXISTS (
    WITH eff AS (
      SELECT o.* FROM public.curricular_correspondence_profile_versions o
      WHERE NOT EXISTS (
        SELECT 1 FROM public.curricular_correspondence_profile_versions r
        WHERE r.supersedes_id = o.id AND r.change_kind = 'retificacao'
      )
    ),
    win AS (
      SELECT e.*,
        LEAST(e.valid_until, (
          SELECT min(e2.valid_from) - 1 FROM eff e2
          WHERE e2.profile_id = e.profile_id AND e2.version > e.version
        )) AS effective_until
      FROM eff e
    )
    SELECT 1 FROM win o
    WHERE o.profile_id <> _pid
      AND o.valid_from <= coalesce(_valid_until, 'infinity'::date)
      AND _valid_from <= coalesce(o.effective_until, 'infinity'::date)
  ) THEN RAISE EXCEPTION 'profile:overlaps-other-profile'; END IF;
  IF _profile IS NULL THEN INSERT INTO public.curricular_correspondence_profiles(id) VALUES (_pid); END IF;

  INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, supersedes_id, change_kind, valid_from, valid_until,
    originating_act_ref, change_reason, applicability_rule_scheme_id, applicability_rule_value_id, applicability_rule_value_version,
    recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_pid, _ver, _sup, _change_kind, _valid_from, _valid_until, pg_catalog.btrim(_act_ref), nullif(pg_catalog.btrim(coalesce(_reason,'')),''),
    _applicability_rule->>'scheme', _applicability_rule->>'value', (_applicability_rule->>'version')::integer,
    auth.uid(), public.current_person_id(), g) RETURNING id INTO _vid;
  INSERT INTO public.curricular_correspondence_profile_position_keys(profile_version_id, scheme_id) SELECT _vid, k FROM unnest(_position_key_schemes) k;
  IF _nature_scheme_id IS NOT NULL THEN
    INSERT INTO public.curricular_correspondence_profile_nature_axis(profile_version_id, scheme_id) VALUES (_vid, _nature_scheme_id);
    INSERT INTO public.curricular_correspondence_profile_nature_gates(profile_version_id, scheme_id, value_id, value_version, effect)
    SELECT _vid, _nature_scheme_id, e->>'value', (e->>'version')::integer, e->>'effect' FROM pg_catalog.jsonb_array_elements(_nature_gates) e;
  END IF;
  RETURN pg_catalog.jsonb_build_object('profile_id', _pid, 'version_id', _vid, 'version', _ver);
END $fn$;

CREATE OR REPLACE FUNCTION public.record_position_matrix_correspondence_version(
  _correspondence text, _profile_id text, _base_version_id uuid, _change_kind text, _valid_from date, _valid_until date,
  _reason text, _act_ref text, _target_matrix_id text, _target_column_key text, _keys jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; _cid text; _prof text; _ver integer; _sup uuid; _vid uuid; x jsonb; _schemes text[]; _given text[]; _sig jsonb;
BEGIN
  g := public.r5_network_grant('manter-correspondencias-posicao-matriz');
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'correspondence:act-required'; END IF;
  IF _target_matrix_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_curricular_matrices m WHERE m.id = _target_matrix_id) THEN
    RAISE EXCEPTION 'correspondence:matrix-not-found'; END IF;
  IF _target_column_key IS NULL OR _target_column_key !~ '^[a-z0-9][a-z0-9-]*$' THEN RAISE EXCEPTION 'correspondence:column-required'; END IF;
  IF _correspondence IS NULL THEN _prof := _profile_id;
  ELSE SELECT c.profile_id INTO _prof FROM public.curricular_position_matrix_correspondences c WHERE c.id = _correspondence;
       IF _prof IS NULL THEN RAISE EXCEPTION 'correspondence:not-found'; END IF;
       IF _profile_id IS NOT NULL AND _profile_id <> _prof THEN RAISE EXCEPTION 'correspondence:profile-immutable'; END IF;
  END IF;
  IF _prof IS NULL THEN RAISE EXCEPTION 'correspondence:profile-required'; END IF;
  SELECT array_agg(pk.scheme_id ORDER BY pk.scheme_id) INTO _schemes FROM public.curricular_correspondence_profile_position_keys pk
   WHERE pk.profile_version_id = (SELECT v.id FROM public.curricular_correspondence_profile_versions v WHERE v.profile_id = _prof ORDER BY v.version DESC LIMIT 1);
  IF _schemes IS NULL THEN RAISE EXCEPTION 'correspondence:profile-without-version'; END IF;
  IF _keys IS NULL OR pg_catalog.jsonb_typeof(_keys) <> 'array' OR pg_catalog.jsonb_array_length(_keys) = 0 THEN RAISE EXCEPTION 'correspondence:position-key-required'; END IF;
  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(_keys) e LOOP
    IF x->>'scheme' IS NULL OR x->>'value' IS NULL OR x->>'version' IS NULL OR x->>'version' !~ '^[1-9][0-9]*(x->>'scheme', x->>'value', (x->>'version')::integer, _valid_from, _valid_until) THEN
      RAISE EXCEPTION 'correspondence:key-value-not-homologated'; END IF;
  END LOOP;
  SELECT array_agg(e->>'scheme' ORDER BY e->>'scheme') INTO _given FROM pg_catalog.jsonb_array_elements(_keys) e;
  IF _given IS DISTINCT FROM _schemes THEN RAISE EXCEPTION 'correspondence:key-schemes-mismatch'; END IF;
  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(e->>'scheme', e->>'value', (e->>'version')::integer) ORDER BY e->>'scheme') INTO _sig
    FROM pg_catalog.jsonb_array_elements(_keys) e;

  SELECT s.next_version, s.supersedes INTO _ver, _sup FROM public.r5_version_step('correspondence', 'curricular_position_matrix_correspondence_versions', 'correspondence_id',
    _correspondence, _base_version_id, _change_kind, _valid_from, _valid_until, _reason) s;
  _cid := coalesce(_correspondence, 'cpm-' || gen_random_uuid()::text);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('correspondence-profile:' || _prof, 0));
  IF EXISTS (
    WITH eff AS (
      SELECT o.* FROM public.curricular_position_matrix_correspondence_versions o
      WHERE NOT EXISTS (
        SELECT 1 FROM public.curricular_position_matrix_correspondence_versions r
        WHERE r.supersedes_id = o.id AND r.change_kind = 'retificacao'
      )
    ),
    win AS (
      SELECT e.*,
        LEAST(e.valid_until, (
          SELECT min(e2.valid_from) - 1 FROM eff e2
          WHERE e2.correspondence_id = e.correspondence_id AND e2.version > e.version
        )) AS effective_until
      FROM eff e
    )
    SELECT 1 FROM public.curricular_position_matrix_correspondences c
    JOIN win o ON o.correspondence_id = c.id
    WHERE c.profile_id = _prof AND c.id <> _cid
      AND o.valid_from <= coalesce(_valid_until, 'infinity'::date)
      AND _valid_from <= coalesce(o.effective_until, 'infinity'::date)
      AND (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(k.scheme_id, k.value_id, k.value_version) ORDER BY k.scheme_id)
             FROM public.curricular_position_matrix_correspondence_keys k WHERE k.correspondence_version_id = o.id) = _sig
  ) THEN RAISE EXCEPTION 'correspondence:overlap'; END IF;
  IF _correspondence IS NULL THEN INSERT INTO public.curricular_position_matrix_correspondences(id, profile_id) VALUES (_cid, _prof); END IF;

  INSERT INTO public.curricular_position_matrix_correspondence_versions(correspondence_id, version, supersedes_id, change_kind, valid_from, valid_until,
    target_matrix_id, target_column_key, originating_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_cid, _ver, _sup, _change_kind, _valid_from, _valid_until, _target_matrix_id, _target_column_key, pg_catalog.btrim(_act_ref),
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id(), g) RETURNING id INTO _vid;
  INSERT INTO public.curricular_position_matrix_correspondence_keys(correspondence_version_id, scheme_id, value_id, value_version)
  SELECT _vid, e->>'scheme', e->>'value', (e->>'version')::integer FROM pg_catalog.jsonb_array_elements(_keys) e;
  RETURN pg_catalog.jsonb_build_object('correspondence_id', _cid, 'version_id', _vid, 'version', _ver);
END $fn$;
       OR NOT public.b33_value_homologated_throughout(x->>'scheme', x->>'value', (x->>'version')::integer, _valid_from, _valid_until) THEN
      RAISE EXCEPTION 'correspondence:key-value-not-homologated'; END IF;
  END LOOP;
  SELECT array_agg(e->>'scheme' ORDER BY e->>'scheme') INTO _given FROM pg_catalog.jsonb_array_elements(_keys) e;
  IF _given IS DISTINCT FROM _schemes THEN RAISE EXCEPTION 'correspondence:key-schemes-mismatch'; END IF;
  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(e->>'scheme', e->>'value', (e->>'version')::integer) ORDER BY e->>'scheme') INTO _sig
    FROM pg_catalog.jsonb_array_elements(_keys) e;

  SELECT s.next_version, s.supersedes INTO _ver, _sup FROM public.r5_version_step('correspondence', 'curricular_position_matrix_correspondence_versions', 'correspondence_id',
    _correspondence, _base_version_id, _change_kind, _valid_from, _valid_until, _reason) s;
  _cid := coalesce(_correspondence, 'cpm-' || gen_random_uuid()::text);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('correspondence-profile:' || _prof, 0));
  IF EXISTS (
    WITH eff AS (
      SELECT o.* FROM public.curricular_position_matrix_correspondence_versions o
      WHERE NOT EXISTS (
        SELECT 1 FROM public.curricular_position_matrix_correspondence_versions r
        WHERE r.supersedes_id = o.id AND r.change_kind = 'retificacao'
      )
    ),
    win AS (
      SELECT e.*,
        LEAST(e.valid_until, (
          SELECT min(e2.valid_from) - 1 FROM eff e2
          WHERE e2.correspondence_id = e.correspondence_id AND e2.version > e.version
        )) AS effective_until
      FROM eff e
    )
    SELECT 1 FROM public.curricular_position_matrix_correspondences c
    JOIN win o ON o.correspondence_id = c.id
    WHERE c.profile_id = _prof AND c.id <> _cid
      AND o.valid_from <= coalesce(_valid_until, 'infinity'::date)
      AND _valid_from <= coalesce(o.effective_until, 'infinity'::date)
      AND (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(k.scheme_id, k.value_id, k.value_version) ORDER BY k.scheme_id)
             FROM public.curricular_position_matrix_correspondence_keys k WHERE k.correspondence_version_id = o.id) = _sig
  ) THEN RAISE EXCEPTION 'correspondence:overlap'; END IF;
  IF _correspondence IS NULL THEN INSERT INTO public.curricular_position_matrix_correspondences(id, profile_id) VALUES (_cid, _prof); END IF;

  INSERT INTO public.curricular_position_matrix_correspondence_versions(correspondence_id, version, supersedes_id, change_kind, valid_from, valid_until,
    target_matrix_id, target_column_key, originating_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_cid, _ver, _sup, _change_kind, _valid_from, _valid_until, _target_matrix_id, _target_column_key, pg_catalog.btrim(_act_ref),
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id(), g) RETURNING id INTO _vid;
  INSERT INTO public.curricular_position_matrix_correspondence_keys(correspondence_version_id, scheme_id, value_id, value_version)
  SELECT _vid, e->>'scheme', e->>'value', (e->>'version')::integer FROM pg_catalog.jsonb_array_elements(_keys) e;
  RETURN pg_catalog.jsonb_build_object('correspondence_id', _cid, 'version_id', _vid, 'version', _ver);
END $fn$;

CREATE OR REPLACE FUNCTION public.record_class_specific_matrix_association_version(
  _association text, _class_id text, _base_version_id uuid, _change_kind text, _valid_from date, _valid_until date,
  _reason text, _specific_act_ref text, _target_matrix_id text, _target_column_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; _aid text; _cls text; _ver integer; _sup uuid; _vid uuid;
BEGIN
  g := public.r5_network_grant('manter-associacoes-especificas-matriz');
  IF coalesce(pg_catalog.btrim(_specific_act_ref),'') = '' THEN RAISE EXCEPTION 'association:act-required'; END IF;
  IF _target_matrix_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_curricular_matrices m WHERE m.id = _target_matrix_id) THEN
    RAISE EXCEPTION 'association:matrix-not-found'; END IF;
  IF _target_column_key IS NOT NULL AND _target_column_key !~ '^[a-z0-9][a-z0-9-]*$' THEN RAISE EXCEPTION 'association:column-invalid'; END IF;
  IF _association IS NULL THEN _cls := _class_id;
  ELSE SELECT a.class_id INTO _cls FROM public.class_specific_matrix_associations a WHERE a.id = _association;
       IF _cls IS NULL THEN RAISE EXCEPTION 'association:not-found'; END IF;
       IF _class_id IS NOT NULL AND _class_id <> _cls THEN RAISE EXCEPTION 'association:class-immutable'; END IF;
  END IF;
  IF _cls IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = _cls) THEN RAISE EXCEPTION 'association:class-not-found'; END IF;

  SELECT s.next_version, s.supersedes INTO _ver, _sup FROM public.r5_version_step('association', 'class_specific_matrix_association_versions', 'association_id',
    _association, _base_version_id, _change_kind, _valid_from, _valid_until, _reason) s;
  _aid := coalesce(_association, 'csa-' || gen_random_uuid()::text);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('association-class:' || _cls, 0));
  IF EXISTS (
    WITH eff AS (
      SELECT o.* FROM public.class_specific_matrix_association_versions o
      WHERE NOT EXISTS (
        SELECT 1 FROM public.class_specific_matrix_association_versions r
        WHERE r.supersedes_id = o.id AND r.change_kind = 'retificacao'
      )
    ),
    win AS (
      SELECT e.*,
        LEAST(e.valid_until, (
          SELECT min(e2.valid_from) - 1 FROM eff e2
          WHERE e2.association_id = e.association_id AND e2.version > e.version
        )) AS effective_until
      FROM eff e
    )
    SELECT 1 FROM public.class_specific_matrix_associations a
    JOIN win o ON o.association_id = a.id
    WHERE a.class_id = _cls AND a.id <> _aid
      AND o.valid_from <= coalesce(_valid_until, 'infinity'::date)
      AND _valid_from <= coalesce(o.effective_until, 'infinity'::date)
  ) THEN RAISE EXCEPTION 'association:overlap'; END IF;
  IF _association IS NULL THEN INSERT INTO public.class_specific_matrix_associations(id, class_id) VALUES (_aid, _cls); END IF;

  INSERT INTO public.class_specific_matrix_association_versions(association_id, version, supersedes_id, change_kind, valid_from, valid_until,
    target_matrix_id, target_column_key, specific_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_aid, _ver, _sup, _change_kind, _valid_from, _valid_until, _target_matrix_id, _target_column_key, pg_catalog.btrim(_specific_act_ref),
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id(), g) RETURNING id INTO _vid;
  RETURN pg_catalog.jsonb_build_object('association_id', _aid, 'version_id', _vid, 'version', _ver);
END $fn$;
