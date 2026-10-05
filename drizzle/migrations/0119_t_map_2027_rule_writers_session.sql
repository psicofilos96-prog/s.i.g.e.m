-- 0119 — Frente T: Mapa Estatístico 2027. Regra de competência com rascunho/homologação por ato humano
-- (sessão + pessoa + atuação + capability), escopo explícito de escolas, ano operacional como portão de abertura,
-- e conferência/oficialização/correção por sessão (service_role + _actor deixa de executar). Nenhuma regra é criada aqui.

ALTER TABLE public.map_competence_rules
  ADD COLUMN IF NOT EXISTS drafted_by uuid,
  ADD COLUMN IF NOT EXISTS drafted_person_id uuid,
  ADD COLUMN IF NOT EXISTS drafted_engagement_id uuid,
  ADD COLUMN IF NOT EXISTS homologated_by uuid,
  ADD COLUMN IF NOT EXISTS homologated_person_id uuid,
  ADD COLUMN IF NOT EXISTS homologated_engagement_id uuid,
  ADD COLUMN IF NOT EXISTS homologated_at timestamptz;
COMMENT ON COLUMN public.map_competence_rules.homologation_act_ref IS 'Fonte documental opcional; a homologação é o ato humano registrado em homologated_person_id.';

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.map_competence_rules, public.statistical_maps, public.statistical_map_events, public.statistical_map_versions, public.institutional_visit_records FROM anon, authenticated, service_role;

-- Ano operacional na data: último estado do ano cuja versão vigente cobre a data.
CREATE OR REPLACE FUNCTION public.map_year_state_on(_on date)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT coalesce((
    SELECT s.state FROM public.academic_year_operational_states s
    WHERE s.academic_year_id = (
      SELECT v.academic_year_id FROM public.institutional_academic_year_versions v
      WHERE v.is_active AND v.starts_on <= _on AND v.ends_on >= _on
        AND NOT EXISTS (SELECT 1 FROM public.institutional_academic_year_versions w WHERE w.supersedes_id = v.id)
      ORDER BY v.valid_from DESC LIMIT 1)
    ORDER BY s.sequence DESC LIMIT 1), 'sem-estado')
$$;
REVOKE ALL ON FUNCTION public.map_year_state_on(date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.map_year_state_on(date) TO authenticated;

-- Regra aplicável à escola na data: homologada, vigente e com cobertura explícita da escola.
CREATE OR REPLACE FUNCTION public.applicable_map_rule_for_school(_school text, _on date)
RETURNS TABLE(id text, version integer) LANGUAGE sql STABLE SET search_path TO '' AS $$
  SELECT r.id, r.version FROM public.map_competence_rules r
  WHERE r.status = 'homologada' AND r.valid_from <= _on AND (r.valid_until IS NULL OR r.valid_until >= _on)
    AND jsonb_typeof(r.definition -> 'coveredSchoolIds') = 'array' AND (r.definition -> 'coveredSchoolIds') ? _school
  ORDER BY r.version DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.applicable_map_rule_for_school(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.applicable_map_rule_for_school(text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.map_rule_definition_issue(_d jsonb)
RETURNS text LANGUAGE plpgsql STABLE SET search_path TO '' AS $$
DECLARE k text;
BEGIN
  IF _d IS NULL OR jsonb_typeof(_d) <> 'object' THEN RETURN 'map-rule:definition-required'; END IF;
  IF jsonb_typeof(_d -> 'coveredSchoolIds') <> 'array' OR jsonb_array_length(_d -> 'coveredSchoolIds') = 0 THEN RETURN 'map-rule:covered-schools-required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(_d -> 'coveredSchoolIds') x WHERE NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = x)) THEN RETURN 'map-rule:unknown-school'; END IF;
  k := _d -> 'snapshotDate' ->> 'kind';
  IF k IS NULL OR k NOT IN ('dia-do-mes','ultimo-dia-do-mes','data-declarada-por-competencia') THEN RETURN 'map-rule:snapshot-date-required'; END IF;
  IF jsonb_typeof(_d -> 'cells') <> 'array' THEN RETURN 'map-rule:cells-required'; END IF;
  IF jsonb_typeof(_d -> 'blockingCellIds') <> 'array' THEN RETURN 'map-rule:blocking-cells-required'; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.record_map_competence_rule_draft(_id text, _expected_version integer, _valid_from date, _valid_until date, _definition jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE me uuid := public.current_person_id(); g record; head integer; issue text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_network_capability('manter-regra-de-competencia-do-mapa') THEN RAISE EXCEPTION 'map-rule:capability-missing'; END IF;
  SELECT * INTO g FROM public.capability_grant('manter-regra-de-competencia-do-mapa');
  IF coalesce(btrim(_id),'') !~ '^[a-z0-9-]{3,80}$' THEN RAISE EXCEPTION 'map-rule:id-invalid'; END IF;
  IF _valid_from IS NULL OR (_valid_until IS NOT NULL AND _valid_until < _valid_from) THEN RAISE EXCEPTION 'map-rule:validity-invalid'; END IF;
  issue := public.map_rule_definition_issue(_definition);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map-rule:' || _id));
  SELECT max(version) INTO head FROM public.map_competence_rules WHERE id = _id;
  IF head IS DISTINCT FROM _expected_version THEN RAISE EXCEPTION 'map-rule:stale-head'; END IF;
  INSERT INTO public.map_competence_rules(id, version, status, homologation_act_ref, valid_from, valid_until, definition, drafted_by, drafted_person_id, drafted_engagement_id)
  VALUES (_id, coalesce(head, 0) + 1, 'rascunho', NULL, _valid_from, _valid_until, _definition, auth.uid(), me, g.engagement_id);
  RETURN coalesce(head, 0) + 1;
END $$;

CREATE OR REPLACE FUNCTION public.homologate_map_competence_rule(_id text, _version integer, _source_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE me uuid := public.current_person_id(); g record; r record; issue text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_network_capability('manter-regra-de-competencia-do-mapa') THEN RAISE EXCEPTION 'map-rule:capability-missing'; END IF;
  SELECT * INTO g FROM public.capability_grant('manter-regra-de-competencia-do-mapa');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map-rule:' || _id));
  SELECT * INTO r FROM public.map_competence_rules WHERE id = _id AND version = _version FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'map-rule:not-found'; END IF;
  IF r.status <> 'rascunho' THEN RAISE EXCEPTION 'map-rule:not-draft'; END IF;
  IF EXISTS (SELECT 1 FROM public.map_competence_rules WHERE id = _id AND version > _version) THEN RAISE EXCEPTION 'map-rule:stale-head'; END IF;
  IF r.drafted_person_id IS NULL OR r.drafted_person_id = me THEN RAISE EXCEPTION 'map-rule:segregation'; END IF;
  issue := public.map_rule_definition_issue(r.definition);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue; END IF;
  IF EXISTS (SELECT 1 FROM public.map_competence_rules o
             WHERE o.status = 'homologada' AND o.id <> _id
               AND o.valid_from <= coalesce(r.valid_until, 'infinity'::date) AND coalesce(o.valid_until, 'infinity'::date) >= r.valid_from
               AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(o.definition -> 'coveredSchoolIds') a
                           JOIN jsonb_array_elements_text(r.definition -> 'coveredSchoolIds') b ON a = b)) THEN
    RAISE EXCEPTION 'map-rule:overlapping-coverage'; END IF;
  UPDATE public.map_competence_rules SET status = 'homologada', homologation_act_ref = nullif(btrim(coalesce(_source_ref,'')),''),
    homologated_by = auth.uid(), homologated_person_id = me, homologated_engagement_id = g.engagement_id, homologated_at = now()
  WHERE id = _id AND version = _version;
END $$;
REVOKE ALL ON FUNCTION public.record_map_competence_rule_draft(text, integer, date, date, jsonb), public.homologate_map_competence_rule(text, integer, text), public.map_rule_definition_issue(jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_map_competence_rule_draft(text, integer, date, date, jsonb), public.homologate_map_competence_rule(text, integer, text) TO authenticated;

-- Abertura: sessão + pessoa + capability + ano operacional + regra homologada que cobre a escola.
CREATE OR REPLACE FUNCTION public.open_statistical_map(_school text, _year integer, _month integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _id uuid; _r record; _first date; me uuid := public.current_person_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('preparar-mapa-estatistico', _school) THEN RAISE EXCEPTION 'map:capability-missing'; END IF;
  IF _month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'map:competence-invalid'; END IF;
  _first := make_date(_year, _month, 1);
  IF public.map_year_state_on(_first) <> 'operacional' THEN RAISE EXCEPTION 'map:year-not-operational'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map:' || _school || ':' || _year || ':' || _month));
  SELECT id INTO _id FROM public.statistical_maps WHERE school_id = _school AND competence_year = _year AND competence_month = _month;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO _r FROM public.applicable_map_rule_for_school(_school, _first);
  IF _r.id IS NULL THEN RAISE EXCEPTION 'map:no-homologated-rule'; END IF;
  INSERT INTO public.statistical_maps(school_id, competence_year, competence_month, rule_id, rule_version, opened_by, opened_person_id)
  VALUES (_school, _year, _month, _r.id, _r.version, auth.uid(), me) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_map_conference(_map uuid, _fingerprint text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _school text; _id uuid; _person uuid := public.current_person_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF _person IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  SELECT school_id INTO _school FROM public.statistical_maps WHERE id = _map;
  IF _school IS NULL THEN RAISE EXCEPTION 'map:not-found'; END IF;
  IF NOT public.has_school_capability('conferir-mapa-estatistico', _school) THEN RAISE EXCEPTION 'map:capability-missing'; END IF;
  IF coalesce(_fingerprint,'') = '' THEN RAISE EXCEPTION 'map:fingerprint-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map-version:' || _map));
  IF EXISTS (SELECT 1 FROM public.statistical_map_versions WHERE map_id = _map) AND public.open_map_correction_id(_map) IS NULL THEN
    RAISE EXCEPTION 'map:official-open-correction-first'; END IF;
  INSERT INTO public.statistical_map_events(map_id, kind, fingerprint, recorded_by, person_id)
  VALUES (_map, 'conferencia', _fingerprint, auth.uid(), _person) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.open_statistical_map_correction(_map uuid, _base_version uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _school text; _id uuid; _person uuid := public.current_person_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF _person IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  SELECT school_id INTO _school FROM public.statistical_maps WHERE id = _map;
  IF _school IS NULL THEN RAISE EXCEPTION 'map:not-found'; END IF;
  IF NOT public.has_school_capability('corrigir-mapa-estatistico', _school) THEN RAISE EXCEPTION 'map:capability-missing'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'map:reason-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map-version:' || _map));
  IF NOT EXISTS (SELECT 1 FROM public.statistical_map_versions v WHERE v.id = _base_version AND v.map_id = _map
                 AND NOT EXISTS (SELECT 1 FROM public.statistical_map_versions w WHERE w.supersedes_id = v.id)) THEN
    RAISE EXCEPTION 'map:stale-head'; END IF;
  IF public.open_map_correction_id(_map) IS NOT NULL THEN RAISE EXCEPTION 'map:correction-already-open'; END IF;
  INSERT INTO public.statistical_map_events(map_id, kind, payload, recorded_by, person_id)
  VALUES (_map, 'abertura-correcao', jsonb_build_object('baseVersionId', _base_version, 'reason', btrim(_reason)), auth.uid(), _person)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.officialize_statistical_map(_map uuid, _conference uuid, _fingerprint text, _snapshot jsonb, _snapshot_date date, _base_version uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _m record; _g record; _last_event uuid; _conf record; _corr record; _v integer; _id uuid; _person uuid := public.current_person_id(); _reason text := NULL; _corr_id uuid := NULL;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF _person IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  SELECT * INTO _m FROM public.statistical_maps WHERE id = _map;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'map:not-found'; END IF;
  IF NOT public.has_school_capability('oficializar-mapa-estatistico', _m.school_id) THEN RAISE EXCEPTION 'map:capability-missing'; END IF;
  IF _m.rule_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.map_competence_rules r WHERE r.id = _m.rule_id AND r.version = _m.rule_version AND r.status = 'homologada'
       AND (r.definition -> 'coveredSchoolIds') ? _m.school_id) THEN RAISE EXCEPTION 'map:no-homologated-rule'; END IF;
  IF public.map_year_state_on(make_date(_m.competence_year, _m.competence_month, 1)) <> 'operacional' THEN RAISE EXCEPTION 'map:year-not-operational'; END IF;
  IF (_snapshot -> 'rule' ->> 'id') IS DISTINCT FROM _m.rule_id OR (_snapshot -> 'rule' ->> 'version')::int IS DISTINCT FROM _m.rule_version
     OR (_snapshot ->> 'snapshotDate')::date IS DISTINCT FROM _snapshot_date OR _snapshot_date IS NULL THEN RAISE EXCEPTION 'map:snapshot-rule-mismatch'; END IF;
  SELECT * INTO _g FROM public.school_capability_grant('oficializar-mapa-estatistico', _m.school_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map-version:' || _map));
  SELECT id INTO _last_event FROM public.statistical_map_events WHERE map_id = _map ORDER BY recorded_at DESC, id DESC LIMIT 1;
  SELECT * INTO _conf FROM public.statistical_map_events WHERE id = _conference AND map_id = _map AND kind = 'conferencia';
  IF _conf.id IS NULL OR _last_event IS DISTINCT FROM _conference THEN RAISE EXCEPTION 'map:conference-not-latest'; END IF;
  IF _conf.fingerprint IS DISTINCT FROM _fingerprint THEN RAISE EXCEPTION 'map:fingerprint-mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.statistical_map_versions WHERE conference_event_id = _conference) THEN RAISE EXCEPTION 'map:conference-used'; END IF;
  IF _conf.person_id IS NULL OR _conf.person_id = _person THEN RAISE EXCEPTION 'map:segregation'; END IF;
  IF _base_version IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.statistical_map_versions WHERE map_id = _map) THEN RAISE EXCEPTION 'map:already-official'; END IF;
    _v := 1;
  ELSE
    SELECT version + 1 INTO _v FROM public.statistical_map_versions WHERE id = _base_version AND map_id = _map;
    IF _v IS NULL THEN RAISE EXCEPTION 'map:base-not-found'; END IF;
    IF EXISTS (SELECT 1 FROM public.statistical_map_versions WHERE supersedes_id = _base_version) THEN RAISE EXCEPTION 'map:stale-head'; END IF;
    _corr_id := public.open_map_correction_id(_map);
    SELECT * INTO _corr FROM public.statistical_map_events WHERE id = _corr_id;
    IF _corr.id IS NULL OR (_corr.payload->>'baseVersionId')::uuid IS DISTINCT FROM _base_version THEN RAISE EXCEPTION 'map:correction-not-open'; END IF;
    IF (_conf.recorded_at, _conf.id) <= (_corr.recorded_at, _corr.id) THEN RAISE EXCEPTION 'map:conference-before-correction'; END IF;
    _reason := _corr.payload->>'reason';
  END IF;
  INSERT INTO public.statistical_map_versions(map_id, version, supersedes_id, conference_event_id, correction_event_id, fingerprint, snapshot, snapshot_date, rule_id, rule_version,
    correction_reason, recorded_by, person_id, engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_map, _v, _base_version, _conference, _corr_id, _fingerprint, _snapshot, _snapshot_date, _m.rule_id, _m.rule_version,
    _reason, auth.uid(), _person, _g.engagement_id, _g.policy_id, _g.policy_version) RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.open_statistical_map(text, integer, integer), public.record_map_conference(uuid, text), public.open_statistical_map_correction(uuid, uuid, text),
  public.officialize_statistical_map(uuid, uuid, text, jsonb, date, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.open_statistical_map(text, integer, integer), public.record_map_conference(uuid, text), public.open_statistical_map_correction(uuid, uuid, text),
  public.officialize_statistical_map(uuid, uuid, text, jsonb, date, uuid) TO authenticated;

-- Caminho antigo service_role + _actor: automação não é pessoa; deixa de executar.
REVOKE ALL ON FUNCTION public.record_map_conference(uuid, uuid, text), public.open_statistical_map_correction(uuid, uuid, uuid, text),
  public.officialize_statistical_map(uuid, uuid, uuid, text, jsonb, date, uuid) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.officialize_statistical_map(uuid, uuid, uuid, text, jsonb, date, uuid) IS 'DEPRECATED (0119): substituída pela versão por sessão; sem EXECUTE.';
COMMENT ON FUNCTION public.record_map_conference(uuid, uuid, text) IS 'DEPRECATED (0119): substituída pela versão por sessão; sem EXECUTE.';
COMMENT ON FUNCTION public.open_statistical_map_correction(uuid, uuid, uuid, text) IS 'DEPRECATED (0119): substituída pela versão por sessão; sem EXECUTE.';
REVOKE EXECUTE ON FUNCTION public.record_map_observations(uuid, text) FROM PUBLIC, anon, service_role;
