ALTER TABLE public.sector_parameter_catalog DROP CONSTRAINT IF EXISTS sector_parameter_catalog_value_kind_check;
ALTER TABLE public.sector_parameter_catalog ADD CONSTRAINT sector_parameter_catalog_value_kind_check CHECK (value_kind IN ('dias','escolha','percentual'));

INSERT INTO public.sector_parameter_catalog(key, sector, capability_id, value_kind, allowed, default_value)
VALUES ('frequencia.limite-infrequencia', 'frequencia', 'homologar-regra-de-calculo', 'percentual', NULL, '75'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.aa_infrequency_threshold() RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT coalesce((public.sector_parameter_value('frequencia.limite-infrequencia') #>> '{}')::numeric, 75)
$$;
REVOKE ALL ON FUNCTION public.aa_infrequency_threshold() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aa_infrequency_threshold() TO authenticated;

ALTER TABLE public.aa_outreach_cases DROP CONSTRAINT IF EXISTS aa_outreach_cases_basis_presence_pct_check;
ALTER TABLE public.aa_outreach_cases ADD CONSTRAINT aa_outreach_cases_basis_presence_pct_check CHECK (basis_presence_pct >= 0 AND basis_presence_pct < 100);

CREATE OR REPLACE FUNCTION public.aa_open_outreach_case(_school text, _class text, _student text, _enrollment text, _mode text, _period text, _pct numeric, _responsible text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'busca-ativa:unauthenticated'; END IF;
  IF NOT public.has_school_capability('registrar-busca-ativa', _school) THEN RAISE EXCEPTION 'busca-ativa:forbidden'; END IF;
  IF _pct IS NULL OR _pct >= public.aa_infrequency_threshold() THEN RAISE EXCEPTION 'busca-ativa:not-below-threshold'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.school_id = _school AND e.class_id = _class AND e.student_id = _student) THEN RAISE EXCEPTION 'busca-ativa:enrollment-not-found'; END IF;
  INSERT INTO public.aa_outreach_cases(school_id, class_id, student_id, enrollment_id, basis_mode, basis_period, basis_presence_pct, responsible_label, opened_by)
  VALUES (_school, _class, _student, _enrollment, _mode, _period, _pct, nullif(btrim(coalesce(_responsible,'')),''), auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.record_sector_parameter(_key text, _value jsonb, _reason text, _expected_version integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c public.sector_parameter_catalog; cur integer; g uuid; n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO c FROM public.sector_parameter_catalog WHERE key = _key;
  IF NOT FOUND THEN RAISE EXCEPTION 'parameter:unknown'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN RAISE EXCEPTION 'parameter:reason-required'; END IF;
  IF c.sector = 'alimentacao' THEN g := public.meal_network_grant_on(c.capability_id, current_date);
  ELSE
    SELECT x.engagement_id INTO g FROM public.effective_scope_capabilities(current_date) x
     WHERE x.capability_id = c.capability_id AND x.policy_id IS NOT NULL AND x.scope_level = 'rede'
     ORDER BY x.policy_version DESC, x.engagement_id LIMIT 1;
    IF g IS NULL THEN g := public.bo_fixture_network_engagement(c.capability_id); END IF;
    IF g IS NULL THEN RAISE EXCEPTION 'capability:%', c.capability_id; END IF;
  END IF;
  IF c.value_kind = 'dias' THEN
    IF jsonb_typeof(_value) <> 'number' OR (_value #>> '{}')::numeric <> floor((_value #>> '{}')::numeric)
       OR (_value #>> '{}')::int < 1 OR (_value #>> '{}')::int > 365 THEN RAISE EXCEPTION 'parameter:days-invalid'; END IF;
  ELSIF c.value_kind = 'percentual' THEN
    IF jsonb_typeof(_value) <> 'number' OR (_value #>> '{}')::numeric < 1 OR (_value #>> '{}')::numeric > 99 THEN RAISE EXCEPTION 'parameter:percent-invalid'; END IF;
  ELSIF NOT (c.allowed ? (_value #>> '{}')) THEN RAISE EXCEPTION 'parameter:choice-invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sector-parameter:' || _key));
  SELECT coalesce(max(version), 0) INTO cur FROM public.sector_parameter_versions WHERE key = _key;
  IF cur <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'parameter:stale-base'; END IF;
  n := cur + 1;
  INSERT INTO public.sector_parameter_versions(key, version, value, reason, author_user_id, author_engagement)
  VALUES (_key, n, _value, btrim(_reason), auth.uid(), g);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.record_sector_parameter(text, jsonb, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sector_parameter(text, jsonb, text, integer) TO authenticated;