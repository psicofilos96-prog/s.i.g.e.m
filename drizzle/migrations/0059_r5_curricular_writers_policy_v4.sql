-- R5 — Competência de construção e homologação E1–E4 (decisão institucional: gestao-pedagogica-da-rede).
-- Aditiva. Não altera v1/v2/v3, tabelas, readers nem migrations históricas. Não homologa v4. Não grava dado curricular.
-- Writers SECURITY DEFINER, search_path '', EXECUTE só authenticated; novas operações R5 só ganham efeito por política HOMOLOGADA. E1 construção já permanece autorizada pela v3 existente.

-- ---------------------------------------------------------------------------
-- 1. Política v4 DRAFT = 199 regras de v3 + 7 capacidades × 2 tipos [network] = 213 regras / 85 capacidades.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.r5_capabilities()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT ARRAY['homologar-matrizes-curriculares',
               'manter-perfis-correspondencia-curricular','homologar-perfis-correspondencia-curricular',
               'manter-correspondencias-posicao-matriz','homologar-correspondencias-posicao-matriz',
               'manter-associacoes-especificas-matriz','homologar-associacoes-especificas-matriz']::text[]
$$;
REVOKE ALL ON FUNCTION public.r5_capabilities() FROM PUBLIC, anon, authenticated, service_role;

DO $v4$
DECLARE
  _v3 uuid; _v4 uuid; _v4sup uuid; _v4status text; _n3 integer; _expected jsonb; _actual jsonb;
BEGIN
  SELECT id INTO _v3 FROM public.capability_policies
   WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 3 AND status = 'homologated';
  IF _v3 IS NULL THEN RAISE EXCEPTION 'r5:v3-homologated-missing'; END IF;
  SELECT count(*) INTO _n3 FROM public.capability_policy_rules WHERE policy_id = _v3;
  IF _n3 <> 199 THEN RAISE EXCEPTION 'r5:v3-unexpected-rule-count:%', _n3; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE policy_id = _v3 AND capability_id = ANY (public.r5_capabilities())) THEN
    RAISE EXCEPTION 'r5:v3-already-has-r5-capability'; END IF;

  WITH want AS (
    SELECT engagement_kind_id, capability_id, scope_dimensions FROM public.capability_policy_rules WHERE policy_id = _v3
    UNION ALL
    SELECT k, c, ARRAY['network']::text[]
      FROM unnest(ARRAY['gestao-pedagogica-da-rede','administrador-geral-do-sigem']) k, unnest(public.r5_capabilities()) c)
  SELECT jsonb_agg(jsonb_build_array(engagement_kind_id, capability_id, scope_dimensions) ORDER BY engagement_kind_id, capability_id, scope_dimensions)
    INTO _expected FROM want;

  SELECT id, supersedes_version_id, status INTO _v4, _v4sup, _v4status FROM public.capability_policies
   WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 4;
  IF _v4 IS NOT NULL THEN
    -- Idempotência: v4 existente só é aceita se idêntica; divergência é denunciada, nunca sobrescrita.
    SELECT jsonb_agg(jsonb_build_array(engagement_kind_id, capability_id, scope_dimensions) ORDER BY engagement_kind_id, capability_id, scope_dimensions)
      INTO _actual FROM public.capability_policy_rules WHERE policy_id = _v4;
    IF _v4sup IS DISTINCT FROM _v3 OR _v4status IS DISTINCT FROM 'draft' OR _actual IS DISTINCT FROM _expected
       OR EXISTS (SELECT 1 FROM public.capability_policies p WHERE p.id = _v4 AND (p.homologation_act_ref IS NOT NULL OR p.homologated_at IS NOT NULL)) THEN
      RAISE EXCEPTION 'r5:v4-exists-divergent'; END IF;
    RETURN;
  END IF;

  INSERT INTO public.capability_policies(logical_policy_id, version, supersedes_version_id, status)
  VALUES ('politica-capacidades-diario', 4, _v3, 'draft') RETURNING id INTO _v4;
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
  SELECT _v4, x->>0, x->>1, ARRAY(SELECT jsonb_array_elements_text(x->2)) FROM jsonb_array_elements(_expected) x;

  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v4) <> 213 THEN RAISE EXCEPTION 'r5:v4-rule-count'; END IF;
  IF (SELECT count(DISTINCT capability_id) FROM public.capability_policy_rules WHERE policy_id = _v4) <> 85 THEN RAISE EXCEPTION 'r5:v4-capability-count'; END IF;
  IF EXISTS (SELECT 1 FROM public.sigem_general_admin_coverage_issues(_v4)) THEN RAISE EXCEPTION 'r5:v4-general-admin-coverage'; END IF;
END $v4$;

-- ---------------------------------------------------------------------------
-- 2. Portão privado: atuação de rede com capacidade R5 por política homologada (designação nunca conta).
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.r5_network_grant(_capability text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'r5:session-required'; END IF;
  IF _capability IS NULL OR NOT (_capability = ANY (public.r5_capabilities() || ARRAY['manter-matrizes-curriculares'])) THEN
    RAISE EXCEPTION 'r5:capability-not-r5'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.scope_level = 'rede' AND c.policy_id IS NOT NULL
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.r5_network_grant(text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Homologação genérica privada sobre os 4 ledgers canônicos existentes (mapa fechado).
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.r5_record_homologation(_kind text, _target uuid, _expected_head uuid,
  _decision text, _effective_from date, _act_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  _ledger text; _col text; _versions text; _cap text; _p text; g uuid;
  _hid uuid; _hseq integer; _hdec text; _hfrom date; _new uuid; _seq integer;
BEGIN
  CASE _kind
    WHEN 'matrix' THEN _ledger := 'curricular_matrix_version_homologations'; _col := 'matrix_version_id';
      _versions := 'curricular_matrix_versions'; _cap := 'homologar-matrizes-curriculares'; _p := 'matrix-homologation';
    WHEN 'profile' THEN _ledger := 'curricular_correspondence_profile_homologations'; _col := 'profile_version_id';
      _versions := 'curricular_correspondence_profile_versions'; _cap := 'homologar-perfis-correspondencia-curricular'; _p := 'profile-homologation';
    WHEN 'correspondence' THEN _ledger := 'curricular_position_matrix_correspondence_homologations'; _col := 'correspondence_version_id';
      _versions := 'curricular_position_matrix_correspondence_versions'; _cap := 'homologar-correspondencias-posicao-matriz'; _p := 'correspondence-homologation';
    WHEN 'association' THEN _ledger := 'class_specific_matrix_association_homologations'; _col := 'association_version_id';
      _versions := 'class_specific_matrix_association_versions'; _cap := 'homologar-associacoes-especificas-matriz'; _p := 'association-homologation';
    ELSE RAISE EXCEPTION 'r5:unknown-kind';
  END CASE;
  g := public.r5_network_grant(_cap);
  IF _target IS NULL THEN RAISE EXCEPTION '%:target-required', _p; END IF;
  IF _decision IS NULL OR _decision NOT IN ('homologada','revogada') THEN RAISE EXCEPTION '%:invalid-decision', _p; END IF;
  IF _effective_from IS NULL THEN RAISE EXCEPTION '%:effective-from-required', _p; END IF;
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION '%:act-required', _p; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_p || ':' || _target::text, 0));
  EXECUTE pg_catalog.format('SELECT 1 FROM public.%I WHERE id = $1', _versions) USING _target;
  GET DIAGNOSTICS _seq = ROW_COUNT;
  IF _seq = 0 THEN RAISE EXCEPTION '%:target-not-found', _p; END IF;

  EXECUTE pg_catalog.format('SELECT id, sequence, decision, effective_from FROM public.%I WHERE %I = $1 ORDER BY sequence DESC LIMIT 1', _ledger, _col)
    INTO _hid, _hseq, _hdec, _hfrom USING _target;
  IF _expected_head IS DISTINCT FROM _hid THEN RAISE EXCEPTION '%:stale-head', _p; END IF;
  IF _decision = 'homologada' AND _hdec = 'homologada' THEN RAISE EXCEPTION '%:already-homologated', _p; END IF;
  IF _decision = 'revogada' AND _hdec IS DISTINCT FROM 'homologada' THEN RAISE EXCEPTION '%:nothing-to-revoke', _p; END IF;
  IF _hfrom IS NOT NULL AND _effective_from < _hfrom THEN RAISE EXCEPTION '%:effective-before-head', _p; END IF;
  IF (_hid IS NOT NULL OR _decision = 'revogada') AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN
    RAISE EXCEPTION '%:reason-required', _p; END IF;
  _seq := coalesce(_hseq, 0) + 1;

  EXECUTE pg_catalog.format('INSERT INTO public.%I(%I, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason,
      exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id', _ledger, _col)
    INTO _new USING _target, _seq, _hid, _decision, _effective_from, pg_catalog.btrim(_act_ref),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), _cap, auth.uid(), public.current_person_id(), g;
  RETURN pg_catalog.jsonb_build_object('homologation_id', _new, 'sequence', _seq);
END $fn$;
REVOKE ALL ON FUNCTION public.r5_record_homologation(text, uuid, uuid, text, date, text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.homologate_curricular_matrix_version(_version_id uuid, _expected_head_id uuid,
  _decision text, _effective_from date, _act_ref text, _reason text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  SELECT public.r5_record_homologation('matrix', _version_id, _expected_head_id, _decision, _effective_from, _act_ref, _reason) $$;
CREATE FUNCTION public.homologate_correspondence_profile_version(_version_id uuid, _expected_head_id uuid,
  _decision text, _effective_from date, _act_ref text, _reason text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  SELECT public.r5_record_homologation('profile', _version_id, _expected_head_id, _decision, _effective_from, _act_ref, _reason) $$;
CREATE FUNCTION public.homologate_position_matrix_correspondence_version(_version_id uuid, _expected_head_id uuid,
  _decision text, _effective_from date, _act_ref text, _reason text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  SELECT public.r5_record_homologation('correspondence', _version_id, _expected_head_id, _decision, _effective_from, _act_ref, _reason) $$;
CREATE FUNCTION public.homologate_class_specific_matrix_association_version(_version_id uuid, _expected_head_id uuid,
  _decision text, _effective_from date, _act_ref text, _reason text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  SELECT public.r5_record_homologation('association', _version_id, _expected_head_id, _decision, _effective_from, _act_ref, _reason) $$;

-- ---------------------------------------------------------------------------
-- 4. Encadeamento comum de versões (base esperada = última versão; regras iguais às da matriz B4.1.1).
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.r5_version_step(_p text, _versions text, _owner_col text, _owner text, _base uuid,
  _change_kind text, _valid_from date, _valid_until date, _reason text)
RETURNS TABLE(next_version integer, supersedes uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _bid uuid; _bver integer; _bfrom date; _pred date;
BEGIN
  IF _valid_from IS NULL THEN RAISE EXCEPTION '%:valid-from-required', _p; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION '%:ends-before-start', _p; END IF;
  IF _owner IS NULL THEN
    IF _change_kind IS DISTINCT FROM 'constituicao' OR _base IS NOT NULL THEN RAISE EXCEPTION '%:invalid-change-kind', _p; END IF;
    next_version := 1; supersedes := NULL; RETURN NEXT; RETURN;
  END IF;
  IF _change_kind IS NULL OR _change_kind NOT IN ('sucessao','retificacao') THEN RAISE EXCEPTION '%:invalid-change-kind', _p; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_p || ':' || _owner, 0));
  EXECUTE pg_catalog.format('SELECT id, version, valid_from FROM public.%I WHERE %I = $1 ORDER BY version DESC LIMIT 1', _versions, _owner_col)
    INTO _bid, _bver, _bfrom USING _owner;
  IF _bid IS NULL THEN RAISE EXCEPTION '%:not-found', _p; END IF;
  IF _base IS DISTINCT FROM _bid THEN RAISE EXCEPTION '%:base-superseded', _p; END IF;
  IF coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION '%:reason-required', _p; END IF;
  IF _change_kind = 'sucessao' AND _valid_from <= _bfrom THEN RAISE EXCEPTION '%:succession-must-start-after-base', _p; END IF;
  IF _change_kind = 'retificacao' THEN
    EXECUTE pg_catalog.format('SELECT p.valid_from FROM public.%1$I p WHERE p.%2$I = $1 AND p.version < $2
        AND NOT EXISTS (SELECT 1 FROM public.%1$I r WHERE r.supersedes_id = p.id AND r.change_kind = ''retificacao'')
        ORDER BY p.version DESC LIMIT 1', _versions, _owner_col) INTO _pred USING _owner, _bver;
    IF _pred IS NOT NULL AND _valid_from <= _pred THEN RAISE EXCEPTION '%:retification-must-start-after-predecessor', _p; END IF;
  END IF;
  next_version := _bver + 1; supersedes := _bid; RETURN NEXT;
END $fn$;
REVOKE ALL ON FUNCTION public.r5_version_step(text, text, text, text, uuid, text, date, date, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. E2 — perfil de correspondência.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.record_correspondence_profile_version(
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
    IF x->>'value' IS NULL OR x->>'version' IS NULL OR NOT public.b33_value_homologated_throughout(_nature_scheme_id, x->>'value', (x->>'version')::integer, _valid_from, _valid_until) THEN
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
  IF EXISTS (SELECT 1 FROM public.curricular_correspondence_profile_versions o
      WHERE o.profile_id <> _pid AND o.version = (SELECT max(o2.version) FROM public.curricular_correspondence_profile_versions o2 WHERE o2.profile_id = o.profile_id)
        AND o.valid_from <= coalesce(_valid_until, 'infinity'::date) AND _valid_from <= coalesce(o.valid_until, 'infinity'::date)) THEN
    RAISE EXCEPTION 'profile:overlaps-other-profile'; END IF;
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

-- ---------------------------------------------------------------------------
-- 6. E3 — correspondência chave de posição → matriz lógica + coluna.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.record_position_matrix_correspondence_version(
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
    IF x->>'scheme' IS NULL OR x->>'value' IS NULL OR x->>'version' IS NULL
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
    SELECT 1 FROM public.curricular_position_matrix_correspondences c
    JOIN public.curricular_position_matrix_correspondence_versions o ON o.correspondence_id = c.id
    WHERE c.profile_id = _prof AND c.id <> _cid
      AND o.version = (SELECT max(o2.version) FROM public.curricular_position_matrix_correspondence_versions o2 WHERE o2.correspondence_id = c.id)
      AND o.valid_from <= coalesce(_valid_until, 'infinity'::date) AND _valid_from <= coalesce(o.valid_until, 'infinity'::date)
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

-- ---------------------------------------------------------------------------
-- 7. E4 — associação explícita específica da turma (exceção, nunca fallback).
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.record_class_specific_matrix_association_version(
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
    SELECT 1 FROM public.class_specific_matrix_associations a
    JOIN public.class_specific_matrix_association_versions o ON o.association_id = a.id
    WHERE a.class_id = _cls AND a.id <> _aid
      AND o.version = (SELECT max(o2.version) FROM public.class_specific_matrix_association_versions o2 WHERE o2.association_id = a.id)
      AND o.valid_from <= coalesce(_valid_until, 'infinity'::date) AND _valid_from <= coalesce(o.valid_until, 'infinity'::date)
  ) THEN RAISE EXCEPTION 'association:overlap'; END IF;
  IF _association IS NULL THEN INSERT INTO public.class_specific_matrix_associations(id, class_id) VALUES (_aid, _cls); END IF;

  INSERT INTO public.class_specific_matrix_association_versions(association_id, version, supersedes_id, change_kind, valid_from, valid_until,
    target_matrix_id, target_column_key, specific_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_aid, _ver, _sup, _change_kind, _valid_from, _valid_until, _target_matrix_id, _target_column_key, pg_catalog.btrim(_specific_act_ref),
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id(), g) RETURNING id INTO _vid;
  RETURN pg_catalog.jsonb_build_object('association_id', _aid, 'version_id', _vid, 'version', _ver);
END $fn$;

-- ---------------------------------------------------------------------------
-- 8. ACL: só authenticated executa os 7 RPCs públicos; helpers privados fechados.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.homologate_curricular_matrix_version(uuid, uuid, text, date, text, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.homologate_correspondence_profile_version(uuid, uuid, text, date, text, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.homologate_position_matrix_correspondence_version(uuid, uuid, text, date, text, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.homologate_class_specific_matrix_association_version(uuid, uuid, text, date, text, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.record_correspondence_profile_version(text, uuid, text, date, date, text, text, text[], text, jsonb, jsonb) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.record_position_matrix_correspondence_version(text, text, uuid, text, date, date, text, text, text, text, jsonb) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.record_class_specific_matrix_association_version(text, text, uuid, text, date, date, text, text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.homologate_curricular_matrix_version(uuid, uuid, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homologate_correspondence_profile_version(uuid, uuid, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homologate_position_matrix_correspondence_version(uuid, uuid, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homologate_class_specific_matrix_association_version(uuid, uuid, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_correspondence_profile_version(text, uuid, text, date, date, text, text, text[], text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_position_matrix_correspondence_version(text, text, uuid, text, date, date, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_class_specific_matrix_association_version(text, text, uuid, text, date, date, text, text, text, text) TO authenticated;

COMMENT ON TABLE public.curricular_matrix_version_homologations IS
  'B4.2.1/E1: ledger append-only de homologação/revogação de versão de matriz. Writer R5: homologate_curricular_matrix_version (homologar-matrizes-curriculares).';

-- ---------------------------------------------------------------------------
-- 9. ACL canônica: configuração curricular é escrita por RPC, nunca por service_role direto.
-- Mantém SELECT existente; remove somente privilégios destrutivos/de mutação.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.institutional_curricular_matrices,
  public.curricular_matrix_versions,
  public.curricular_matrix_items,
  public.curricular_matrix_applicability,
  public.curricular_matrix_layouts,
  public.curricular_matrix_layout_columns,
  public.curricular_matrix_layout_rows,
  public.curricular_matrix_layout_groups,
  public.curricular_matrix_layout_cells,
  public.curricular_matrix_layout_notes,
  public.curricular_matrix_version_homologations,
  public.curricular_correspondence_profiles,
  public.curricular_correspondence_profile_versions,
  public.curricular_correspondence_profile_position_keys,
  public.curricular_correspondence_profile_nature_axis,
  public.curricular_correspondence_profile_nature_gates,
  public.curricular_correspondence_profile_homologations,
  public.curricular_position_matrix_correspondences,
  public.curricular_position_matrix_correspondence_versions,
  public.curricular_position_matrix_correspondence_keys,
  public.curricular_position_matrix_correspondence_homologations,
  public.class_specific_matrix_associations,
  public.class_specific_matrix_association_versions,
  public.class_specific_matrix_association_homologations
FROM service_role;

-- E1 já existia antes de R5; alinha seus dois overloads ao contrato "writer somente authenticated".
REVOKE EXECUTE ON FUNCTION public.record_curricular_matrix_version(text,uuid,text,text,date,date,text,text,jsonb,jsonb)
  FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.record_curricular_matrix_version(text,uuid,text,text,date,date,text,text,jsonb,jsonb,jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_curricular_matrix_version(text,uuid,text,text,date,date,text,text,jsonb,jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_curricular_matrix_version(text,uuid,text,text,date,date,text,text,jsonb,jsonb,jsonb)
  TO authenticated;
