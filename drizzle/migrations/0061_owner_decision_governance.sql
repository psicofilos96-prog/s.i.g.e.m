-- 0061 — Decisão do proprietário governa a construção do SIGEM (append-only).
-- Referência documental passa a ser proveniência OPCIONAL, nunca autorização.
-- Capability/escopo, effective_from/valid_from, motivo, expected-head, append-only
-- e os guards 0060 permanecem intactos.

-- A) Política de capacidades: nova origem 'decisao-do-proprietario' sem ato.
ALTER TABLE public.capability_policies DROP CONSTRAINT capability_policies_homologation_origin_check;
ALTER TABLE public.capability_policies ADD CONSTRAINT capability_policies_homologation_origin_check
  CHECK (homologation_origin IN ('ato-administrativo','ativacao-inicial','decisao-do-proprietario'));
ALTER TABLE public.capability_policies DROP CONSTRAINT capability_policies_homologation_origin_shape;
ALTER TABLE public.capability_policies ADD CONSTRAINT capability_policies_homologation_origin_shape CHECK (
  status <> 'homologated' OR homologation_origin IS NULL
  OR (homologation_origin = 'ato-administrativo' AND homologation_act_ref IS NOT NULL AND btrim(homologation_act_ref) <> '')
  OR (homologation_origin IN ('ativacao-inicial','decisao-do-proprietario') AND homologation_act_ref IS NULL));

CREATE FUNCTION public.capability_policy_homologation_issues(_policy uuid, _valid_from date)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _p record; _cap text; _missing text[] := '{}';
BEGIN
  SELECT * INTO _p FROM public.capability_policies WHERE id = _policy;
  IF _p.id IS NULL OR _p.status <> 'draft' THEN RETURN 'policy:not-draft'; END IF;
  IF _valid_from IS NULL THEN RETURN 'policy:valid-from-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.sigem_general_admin_coverage_issues(_policy)) THEN RETURN 'policy:general-admin-coverage-incomplete'; END IF;
  FOREACH _cap IN ARRAY public.sigem_administrative_capabilities() LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.institutional_engagements e
      JOIN public.capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
      JOIN public.capability_policies q ON q.id = r.policy_id
      WHERE r.capability_id = _cap AND e.scope_level = 'rede'
        AND e.valid_from <= _valid_from AND (e.valid_until IS NULL OR e.valid_until >= _valid_from)
        AND (q.id = _policy OR (q.status = 'homologated' AND q.id IS DISTINCT FROM _p.supersedes_version_id
             AND (q.valid_until IS NULL OR q.valid_until >= _valid_from)
             AND NOT EXISTS (SELECT 1 FROM public.capability_policies s WHERE s.supersedes_version_id = q.id AND s.status = 'homologated' AND s.valid_from <= _valid_from)))
    ) THEN _missing := _missing || _cap; END IF;
  END LOOP;
  IF pg_catalog.array_length(_missing,1) > 0 THEN RETURN 'policy:would-remove-administration:' || pg_catalog.array_to_string(_missing, ','); END IF;
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.capability_policy_homologation_issues(uuid, date) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.homologate_capability_policy(_policy uuid, _act_ref text, _valid_from date)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE _issue text; _act text := nullif(pg_catalog.btrim(coalesce(_act_ref,'')),'');
BEGIN
  IF NOT public.has_network_capability('homologar-politica-de-capacidades') THEN RAISE EXCEPTION 'capability:homologar-politica-de-capacidades'; END IF;
  PERFORM 1 FROM public.capability_policies WHERE id = _policy FOR UPDATE;
  _issue := public.capability_policy_homologation_issues(_policy, _valid_from);
  IF _issue IS NOT NULL THEN RAISE EXCEPTION '%', _issue; END IF;
  UPDATE public.capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = _act,
    homologation_origin = CASE WHEN _act IS NULL THEN 'decisao-do-proprietario' ELSE 'ato-administrativo' END,
    valid_from = _valid_from WHERE id = _policy;
END $function$;

-- Ativação da v4 por decisão expressa do proprietário (2026-10-05): sem ato externo, vigência 2026-10-04.
DO $do$
DECLARE _v4 uuid; _v3 uuid; _issue text;
BEGIN
  SELECT id INTO _v3 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 3 AND status = 'homologated';
  SELECT id INTO _v4 FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 4
    AND status = 'draft' AND supersedes_version_id = _v3 FOR UPDATE;
  IF _v3 IS NULL OR _v4 IS NULL THEN RAISE EXCEPTION 'owner-decision:v4-draft-superseding-v3-missing'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v4) <> 213
     OR (SELECT count(DISTINCT capability_id) FROM public.capability_policy_rules WHERE policy_id = _v4) <> 85 THEN
    RAISE EXCEPTION 'owner-decision:v4-shape-divergent'; END IF;
  _issue := public.capability_policy_homologation_issues(_v4, DATE '2026-10-04');
  IF _issue IS NOT NULL THEN RAISE EXCEPTION 'owner-decision:%', _issue; END IF;
  UPDATE public.capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = NULL,
    homologation_origin = 'decisao-do-proprietario', valid_from = DATE '2026-10-04' WHERE id = _v4;
END $do$;

-- B) Referência documental opcional nos ledgers E1–E4 e nas versões E1–E4.
ALTER TABLE public.curricular_matrix_version_homologations ALTER COLUMN homologation_act_ref DROP NOT NULL;
ALTER TABLE public.curricular_matrix_version_homologations DROP CONSTRAINT curricular_matrix_version_homologati_homologation_act_ref_check;
ALTER TABLE public.curricular_matrix_version_homologations ADD CONSTRAINT r5_matrix_homologation_doc_ref_shape CHECK (homologation_act_ref IS NULL OR btrim(homologation_act_ref) <> '');
ALTER TABLE public.curricular_correspondence_profile_homologations ALTER COLUMN homologation_act_ref DROP NOT NULL;
ALTER TABLE public.curricular_correspondence_profile_homologations DROP CONSTRAINT curricular_correspondence_profile_ho_homologation_act_ref_check;
ALTER TABLE public.curricular_correspondence_profile_homologations ADD CONSTRAINT r5_profile_homologation_doc_ref_shape CHECK (homologation_act_ref IS NULL OR btrim(homologation_act_ref) <> '');
ALTER TABLE public.curricular_position_matrix_correspondence_homologations ALTER COLUMN homologation_act_ref DROP NOT NULL;
ALTER TABLE public.curricular_position_matrix_correspondence_homologations DROP CONSTRAINT curricular_position_matrix_correspon_homologation_act_ref_check;
ALTER TABLE public.curricular_position_matrix_correspondence_homologations ADD CONSTRAINT r5_correspondence_homologation_doc_ref_shape CHECK (homologation_act_ref IS NULL OR btrim(homologation_act_ref) <> '');
ALTER TABLE public.class_specific_matrix_association_homologations ALTER COLUMN homologation_act_ref DROP NOT NULL;
ALTER TABLE public.class_specific_matrix_association_homologations DROP CONSTRAINT class_specific_matrix_association_ho_homologation_act_ref_check;
ALTER TABLE public.class_specific_matrix_association_homologations ADD CONSTRAINT r5_association_homologation_doc_ref_shape CHECK (homologation_act_ref IS NULL OR btrim(homologation_act_ref) <> '');

ALTER TABLE public.curricular_matrix_versions ALTER COLUMN originating_act_ref DROP NOT NULL;
ALTER TABLE public.curricular_matrix_versions DROP CONSTRAINT curricular_matrix_versions_originating_act_ref_check;
ALTER TABLE public.curricular_matrix_versions ADD CONSTRAINT r5_matrix_version_doc_ref_shape CHECK (originating_act_ref IS NULL OR btrim(originating_act_ref) <> '');
ALTER TABLE public.curricular_correspondence_profile_versions ALTER COLUMN originating_act_ref DROP NOT NULL;
ALTER TABLE public.curricular_correspondence_profile_versions DROP CONSTRAINT curricular_correspondence_profile_ver_originating_act_ref_check;
ALTER TABLE public.curricular_correspondence_profile_versions ADD CONSTRAINT r5_profile_version_doc_ref_shape CHECK (originating_act_ref IS NULL OR btrim(originating_act_ref) <> '');
ALTER TABLE public.curricular_position_matrix_correspondence_versions ALTER COLUMN originating_act_ref DROP NOT NULL;
ALTER TABLE public.curricular_position_matrix_correspondence_versions DROP CONSTRAINT curricular_position_matrix_correspond_originating_act_ref_check;
ALTER TABLE public.curricular_position_matrix_correspondence_versions ADD CONSTRAINT r5_correspondence_version_doc_ref_shape CHECK (originating_act_ref IS NULL OR btrim(originating_act_ref) <> '');
ALTER TABLE public.class_specific_matrix_association_versions ALTER COLUMN specific_act_ref DROP NOT NULL;
ALTER TABLE public.class_specific_matrix_association_versions DROP CONSTRAINT class_specific_matrix_association_versio_specific_act_ref_check;
ALTER TABLE public.class_specific_matrix_association_versions ADD CONSTRAINT r5_association_version_doc_ref_shape CHECK (specific_act_ref IS NULL OR btrim(specific_act_ref) <> '');

COMMENT ON COLUMN public.curricular_matrix_versions.originating_act_ref IS 'Referência documental/fonte opcional (proveniência); nunca autorização (0061).';
COMMENT ON COLUMN public.class_specific_matrix_association_versions.specific_act_ref IS 'Referência documental/fonte opcional (proveniência); nunca autorização (0061).';

-- Writers: mesmas definições vigentes, só sem o portão act-required; referência vazia ⇒ NULL.
CREATE OR REPLACE FUNCTION public.r5_record_homologation(_kind text, _target uuid, _expected_head uuid, _decision text, _effective_from date, _act_ref text, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    INTO _new USING _target, _seq, _hid, _decision, _effective_from, nullif(pg_catalog.btrim(coalesce(_act_ref,'')),''),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), _cap, auth.uid(), public.current_person_id(), g;
  RETURN pg_catalog.jsonb_build_object('homologation_id', _new, 'sequence', _seq);
END $function$;

CREATE OR REPLACE FUNCTION public.record_class_specific_matrix_association_version(_association text, _class_id text, _base_version_id uuid, _change_kind text, _valid_from date, _valid_until date, _reason text, _specific_act_ref text, _target_matrix_id text, _target_column_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; _aid text; _cls text; _ver integer; _sup uuid; _vid uuid;
BEGIN
  g := public.r5_network_grant('manter-associacoes-especificas-matriz');
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
  VALUES (_aid, _ver, _sup, _change_kind, _valid_from, _valid_until, _target_matrix_id, _target_column_key, nullif(pg_catalog.btrim(coalesce(_specific_act_ref,'')),''),
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id(), g) RETURNING id INTO _vid;
  RETURN pg_catalog.jsonb_build_object('association_id', _aid, 'version_id', _vid, 'version', _ver);
END $function$;

CREATE OR REPLACE FUNCTION public.record_correspondence_profile_version(_profile text, _base_version_id uuid, _change_kind text, _valid_from date, _valid_until date, _reason text, _act_ref text, _position_key_schemes text[], _nature_scheme_id text, _nature_gates jsonb, _applicability_rule jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; _pid text; _ver integer; _sup uuid; _vid uuid; x jsonb; _s text;
BEGIN
  g := public.r5_network_grant('manter-perfis-correspondencia-curricular');
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
  VALUES (_pid, _ver, _sup, _change_kind, _valid_from, _valid_until, nullif(pg_catalog.btrim(coalesce(_act_ref,'')),''), nullif(pg_catalog.btrim(coalesce(_reason,'')),''),
    _applicability_rule->>'scheme', _applicability_rule->>'value', (_applicability_rule->>'version')::integer,
    auth.uid(), public.current_person_id(), g) RETURNING id INTO _vid;
  INSERT INTO public.curricular_correspondence_profile_position_keys(profile_version_id, scheme_id) SELECT _vid, k FROM unnest(_position_key_schemes) k;
  IF _nature_scheme_id IS NOT NULL THEN
    INSERT INTO public.curricular_correspondence_profile_nature_axis(profile_version_id, scheme_id) VALUES (_vid, _nature_scheme_id);
    INSERT INTO public.curricular_correspondence_profile_nature_gates(profile_version_id, scheme_id, value_id, value_version, effect)
    SELECT _vid, _nature_scheme_id, e->>'value', (e->>'version')::integer, e->>'effect' FROM pg_catalog.jsonb_array_elements(_nature_gates) e;
  END IF;
  RETURN pg_catalog.jsonb_build_object('profile_id', _pid, 'version_id', _vid, 'version', _ver);
END $function$;

CREATE OR REPLACE FUNCTION public.record_curricular_matrix_version(_matrix text, _base_version_id uuid, _change_kind text, _official_name text, _valid_from date, _valid_until date, _reason text, _act_ref text, _items jsonb, _applicability jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  g uuid; _mid text; _vid uuid; _ver integer; _n text := nullif(pg_catalog.btrim(coalesce(_official_name,'')),'');
  b public.curricular_matrix_versions%ROWTYPE; it jsonb; ap jsonb; _pos integer := 0; _key text; _label text;
  _q numeric; _pred_from date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'matrix:session-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
    WHERE c.capability_id = 'manter-matrizes-curriculares' AND c.scope_level = 'rede' LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:manter-matrizes-curriculares'; END IF;
  IF _n IS NULL THEN RAISE EXCEPTION 'matrix:name-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'matrix:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'matrix:ends-before-start'; END IF;
  IF _items IS NULL OR pg_catalog.jsonb_typeof(_items) <> 'array' THEN RAISE EXCEPTION 'matrix:items-required'; END IF;
  IF _applicability IS NULL OR pg_catalog.jsonb_typeof(_applicability) <> 'array' THEN RAISE EXCEPTION 'matrix:applicability-required'; END IF;

  IF _matrix IS NULL THEN
    IF _change_kind IS DISTINCT FROM 'constituicao' OR _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'matrix:invalid-change-kind'; END IF;
    _mid := 'mat-' || gen_random_uuid(); _ver := 1;
    INSERT INTO public.institutional_curricular_matrices(id) VALUES (_mid);
  ELSE
    IF _change_kind IS NULL OR _change_kind NOT IN ('sucessao','retificacao') THEN RAISE EXCEPTION 'matrix:invalid-change-kind'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('matrix:' || _matrix, 0));
    SELECT * INTO b FROM public.curricular_matrix_versions v WHERE v.matrix_id = _matrix ORDER BY v.version DESC LIMIT 1;
    IF b.id IS NULL THEN RAISE EXCEPTION 'matrix:not-found'; END IF;
    IF _base_version_id IS DISTINCT FROM b.id THEN RAISE EXCEPTION 'matrix:base-superseded'; END IF;
    IF coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'matrix:reason-required'; END IF;
    IF _change_kind = 'sucessao' AND _valid_from <= b.valid_from THEN RAISE EXCEPTION 'matrix:succession-must-start-after-base'; END IF;
    IF _change_kind = 'retificacao' THEN
      -- predecessora efetiva da base: maior versão anterior não oculta por retificação.
      SELECT p.valid_from INTO _pred_from FROM public.curricular_matrix_versions p
       WHERE p.matrix_id = _matrix AND p.version < b.version
         AND NOT EXISTS (SELECT 1 FROM public.curricular_matrix_versions r
                         WHERE r.supersedes_id = p.id AND r.change_kind = 'retificacao')
       ORDER BY p.version DESC LIMIT 1;
      IF _pred_from IS NOT NULL AND _valid_from <= _pred_from THEN
        RAISE EXCEPTION 'matrix:retification-must-start-after-predecessor'; END IF;
    END IF;
    _mid := _matrix; _ver := b.version + 1;
  END IF;

  INSERT INTO public.curricular_matrix_versions(matrix_id, version, supersedes_id, change_kind, official_name, valid_from, valid_until,
    change_reason, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_mid, _ver, b.id, _change_kind, _n, _valid_from, _valid_until,
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), nullif(pg_catalog.btrim(coalesce(_act_ref,'')),''), auth.uid(), public.current_person_id(), g)
  RETURNING id INTO _vid;

  FOR it IN SELECT x FROM pg_catalog.jsonb_array_elements(_items) x LOOP
    _key := nullif(it->>'key',''); IF _key IS NULL THEN _key := 'item-' || pg_catalog.substr(gen_random_uuid()::text, 1, 8); END IF;
    IF _key !~ '^[a-z0-9][a-z0-9-]*$' THEN RAISE EXCEPTION 'matrix:item-key-invalid'; END IF;
    IF EXISTS (SELECT 1 FROM public.curricular_matrix_items i WHERE i.matrix_version_id = _vid AND i.item_key = _key) THEN
      RAISE EXCEPTION 'matrix:item-key-duplicate'; END IF;
    IF (it ? 'component') = (it ? 'element') THEN RAISE EXCEPTION 'matrix:item-reference-required'; END IF;
    _label := NULL;
    IF it ? 'component' THEN
      IF NOT EXISTS (SELECT 1 FROM public.institutional_curricular_components c WHERE c.id = it->>'component') THEN
        RAISE EXCEPTION 'matrix:component-not-found'; END IF;
      IF NOT public.b41_component_active_throughout(it->>'component', _valid_from, _valid_until) THEN
        RAISE EXCEPTION 'matrix:component-inactive-in-validity'; END IF;
      SELECT v.official_name INTO _label FROM public.curricular_component_versions v
        WHERE v.component_id = it->>'component' AND v.valid_from <= _valid_from ORDER BY v.version DESC LIMIT 1;
    ELSE
      IF it->'element'->>'scheme' IS DISTINCT FROM 'elemento-de-matriz-curricular'
        OR NOT public.attribute_value_homologated('elemento-de-matriz-curricular', it->'element'->>'value',
             (it->'element'->>'version')::integer, _valid_from)
      THEN RAISE EXCEPTION 'matrix:item-element-not-homologated'; END IF;
    END IF;
    _q := NULL;
    IF it ? 'quantity' AND it->>'quantity' IS NOT NULL THEN
      _q := (it->>'quantity')::numeric;
      IF _q < 0 THEN RAISE EXCEPTION 'matrix:quantity-invalid'; END IF;
      IF NOT (it ? 'unit') OR it->'unit' = 'null'::jsonb THEN RAISE EXCEPTION 'matrix:unit-required'; END IF;
      IF it->'unit'->>'scheme' IS DISTINCT FROM 'unidade-de-carga-da-matriz'
        OR NOT public.attribute_value_homologated('unidade-de-carga-da-matriz', it->'unit'->>'value',
             (it->'unit'->>'version')::integer, _valid_from)
      THEN RAISE EXCEPTION 'matrix:unit-not-homologated'; END IF;
    ELSIF it ? 'unit' AND it->'unit' <> 'null'::jsonb THEN
      RAISE EXCEPTION 'matrix:quantity-required';
    END IF;
    INSERT INTO public.curricular_matrix_items(matrix_version_id, item_key, position, component_id, component_label_snapshot,
      element_scheme_id, element_value_id, element_value_version, quantity, unit_scheme_id, unit_value_id, unit_value_version)
    VALUES (_vid, _key, _pos, it->>'component', _label,
      CASE WHEN it ? 'element' THEN 'elemento-de-matriz-curricular' END, it->'element'->>'value', (it->'element'->>'version')::integer,
      _q, CASE WHEN _q IS NOT NULL THEN 'unidade-de-carga-da-matriz' END,
      CASE WHEN _q IS NOT NULL THEN it->'unit'->>'value' END, CASE WHEN _q IS NOT NULL THEN (it->'unit'->>'version')::integer END);
    _pos := _pos + 1;
  END LOOP;

  FOR ap IN SELECT x FROM pg_catalog.jsonb_array_elements(_applicability) x LOOP
    IF ap->>'dimension' = 'ano-letivo' THEN
      IF NOT EXISTS (SELECT 1 FROM public.institutional_academic_years y WHERE y.id = ap->>'id') THEN
        RAISE EXCEPTION 'matrix:academic-year-not-found'; END IF;
      IF NOT public.b41_year_active_throughout(ap->>'id', _valid_from, _valid_until)
      THEN RAISE EXCEPTION 'matrix:academic-year-inactive'; END IF;
      INSERT INTO public.curricular_matrix_applicability(matrix_version_id, dimension, academic_year_id) VALUES (_vid, 'ano-letivo', ap->>'id');
    ELSIF ap->>'dimension' = 'escola' THEN
      IF NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = ap->>'id') THEN
        RAISE EXCEPTION 'matrix:school-not-found'; END IF;
      IF NOT public.b41_school_active_throughout(ap->>'id', _valid_from, _valid_until)
      THEN RAISE EXCEPTION 'matrix:school-inactive'; END IF;
      INSERT INTO public.curricular_matrix_applicability(matrix_version_id, dimension, school_id) VALUES (_vid, 'escola', ap->>'id');
    ELSIF ap->>'dimension' = 'atributo' THEN
      IF NOT public.attribute_value_homologated(ap->>'scheme', ap->>'value', (ap->>'version')::integer, _valid_from) THEN
        RAISE EXCEPTION 'matrix:applicability-value-not-homologated'; END IF;
      INSERT INTO public.curricular_matrix_applicability(matrix_version_id, dimension, scheme_id, value_id, value_version)
        VALUES (_vid, 'atributo', ap->>'scheme', ap->>'value', (ap->>'version')::integer);
    ELSE
      RAISE EXCEPTION 'matrix:applicability-dimension-invalid';
    END IF;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('matrix_id', _mid, 'version_id', _vid, 'version', _ver);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'matrix:applicability-duplicate';
END $function$;

CREATE OR REPLACE FUNCTION public.record_position_matrix_correspondence_version(_correspondence text, _profile_id text, _base_version_id uuid, _change_kind text, _valid_from date, _valid_until date, _reason text, _act_ref text, _target_matrix_id text, _target_column_key text, _keys jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; _cid text; _prof text; _ver integer; _sup uuid; _vid uuid; x jsonb; _schemes text[]; _given text[]; _sig jsonb;
BEGIN
  g := public.r5_network_grant('manter-correspondencias-posicao-matriz');
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
  VALUES (_cid, _ver, _sup, _change_kind, _valid_from, _valid_until, _target_matrix_id, _target_column_key, nullif(pg_catalog.btrim(coalesce(_act_ref,'')),''),
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id(), g) RETURNING id INTO _vid;
  INSERT INTO public.curricular_position_matrix_correspondence_keys(correspondence_version_id, scheme_id, value_id, value_version)
  SELECT _vid, e->>'scheme', e->>'value', (e->>'version')::integer FROM pg_catalog.jsonb_array_elements(_keys) e;
  RETURN pg_catalog.jsonb_build_object('correspondence_id', _cid, 'version_id', _vid, 'version', _ver);
END $function$;
