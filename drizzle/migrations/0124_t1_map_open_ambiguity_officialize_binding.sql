-- T.1 — fail-closed da abertura (ambiguidade de regra) e fronteira de confiança da oficialização.
-- Aditiva: novos helpers, nova assinatura de conferência que vincula conteúdo, writers redefinidos.

-- 1) Regra para abertura: exatamente uma regra lógica homologada aplicável; 0 ⇒ sem regra; >1 ⇒ ambígua.
CREATE OR REPLACE FUNCTION public.map_single_applicable_rule(_school text, _on date)
RETURNS TABLE(id text, version integer) LANGUAGE plpgsql STABLE SET search_path TO '' AS $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.applicable_map_rule_for_school(_school, _on);
  IF n = 0 THEN RAISE EXCEPTION 'map:no-homologated-rule'; END IF;
  IF n > 1 THEN RAISE EXCEPTION 'map:ambiguous-rules'; END IF;
  RETURN QUERY SELECT a.id, a.version FROM public.applicable_map_rule_for_school(_school, _on) a;
END $$;
REVOKE ALL ON FUNCTION public.map_single_applicable_rule(text, date) FROM PUBLIC, anon, authenticated, service_role;

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
  SELECT m.id INTO _id FROM public.statistical_maps m WHERE m.school_id = _school AND m.competence_year = _year AND m.competence_month = _month;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO STRICT _r FROM public.map_single_applicable_rule(_school, _first);
  INSERT INTO public.statistical_maps(school_id, competence_year, competence_month, rule_id, rule_version, opened_by, opened_person_id)
  VALUES (_school, _year, _month, _r.id, _r.version, auth.uid(), me) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- 2) Digest canônico do conteúdo calculado NO BANCO (jsonb normaliza chaves/espaços).
CREATE OR REPLACE FUNCTION public.map_snapshot_digest(_snapshot jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT 'mapa-db-v1-' || encode(extensions.digest(convert_to(_snapshot::text, 'UTF8'), 'sha256'), 'hex')
$$;
REVOKE ALL ON FUNCTION public.map_snapshot_digest(jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Coerência do snapshot com o Mapa, a regra e a base temporal VIGENTES no momento da chamada.
-- Devolve NULL se coerente; senão o código do problema. Revalida regra única e calendário (concorrência).
CREATE OR REPLACE FUNCTION public.map_snapshot_binding_issue(_map uuid, _snapshot jsonb, _snapshot_date date)
RETURNS text LANGUAGE plpgsql STABLE SET search_path TO '' AS $$
DECLARE m record; r record; crit jsonb; k text; b jsonb; first date; last date; n integer; cal jsonb; expected date; d date;
BEGIN
  SELECT * INTO m FROM public.statistical_maps WHERE id = _map;
  IF m.id IS NULL THEN RETURN 'map:not-found'; END IF;
  IF _snapshot IS NULL OR jsonb_typeof(_snapshot) <> 'object' OR _snapshot_date IS NULL THEN RETURN 'map:snapshot-required'; END IF;
  first := make_date(m.competence_year, m.competence_month, 1);
  last := (first + interval '1 month' - interval '1 day')::date;
  IF (_snapshot -> 'competence' ->> 'schoolId') IS DISTINCT FROM m.school_id
     OR (_snapshot -> 'competence' ->> 'year') IS DISTINCT FROM m.competence_year::text
     OR (_snapshot -> 'competence' ->> 'month') IS DISTINCT FROM m.competence_month::text THEN RETURN 'map:snapshot-competence-mismatch'; END IF;
  IF (_snapshot -> 'rule' ->> 'id') IS DISTINCT FROM m.rule_id OR (_snapshot -> 'rule' ->> 'version') IS DISTINCT FROM m.rule_version::text THEN RETURN 'map:snapshot-rule-mismatch'; END IF;
  IF (_snapshot ->> 'snapshotDate') IS DISTINCT FROM _snapshot_date::text OR _snapshot_date < first OR _snapshot_date > last THEN RETURN 'map:snapshot-date-mismatch'; END IF;
  IF (_snapshot ->> 'yearState') IS DISTINCT FROM 'operacional' THEN RETURN 'map:snapshot-year-state-mismatch'; END IF;
  -- Regra: o Mapa só oficializa se sua regra continua sendo a ÚNICA aplicável (nova regra/versão ⇒ nova conferência).
  SELECT count(*) INTO n FROM public.applicable_map_rule_for_school(m.school_id, first);
  IF n <> 1 OR NOT EXISTS (SELECT 1 FROM public.applicable_map_rule_for_school(m.school_id, first) a WHERE a.id = m.rule_id AND a.version = m.rule_version)
    THEN RETURN 'map:rule-changed-since-conference'; END IF;
  SELECT * INTO r FROM public.map_competence_rules WHERE id = m.rule_id AND version = m.rule_version;
  crit := r.definition -> 'snapshotDate'; k := crit ->> 'kind';
  b := _snapshot -> 'snapshotDateBasis';
  IF b IS NULL OR (b ->> 'criterion') IS DISTINCT FROM k OR (b ->> 'date') IS DISTINCT FROM _snapshot_date::text OR (b ->> 'reason') IS NOT NULL
    THEN RETURN 'map:snapshot-basis-mismatch'; END IF;
  IF k = 'dia-fixo-do-mes' THEN
    IF (crit ->> 'day')::int > extract(day FROM last)::int THEN RETURN 'map:snapshot-basis-mismatch'; END IF;
    expected := make_date(m.competence_year, m.competence_month, (crit ->> 'day')::int);
    IF expected <> _snapshot_date THEN RETURN 'map:snapshot-basis-mismatch'; END IF;
  ELSIF k = 'data-definida-por-competencia' THEN
    IF (crit -> 'dates' ->> to_char(first, 'YYYY-MM')) IS DISTINCT FROM _snapshot_date::text THEN RETURN 'map:snapshot-basis-mismatch'; END IF;
  ELSIF k = 'ultimo-dia-letivo-do-mes-calendario-oficial' THEN
    IF jsonb_typeof(b -> 'calendars') <> 'array' OR jsonb_array_length(b -> 'calendars') <> 1 THEN RETURN 'map:snapshot-basis-mismatch'; END IF;
    cal := b -> 'calendars' -> 0;
    IF (cal ->> 'lastSchoolDay') IS DISTINCT FROM _snapshot_date::text THEN RETURN 'map:snapshot-basis-mismatch'; END IF;
    -- Revalidação canônica agora: calendário único aplicável no 1º e no último dia, com a MESMA versão da base.
    FOREACH d IN ARRAY ARRAY[first, last] LOOP
      IF (SELECT count(*) FROM public.calendar_applicability_candidates(d, now(), m.school_id, NULL, NULL, NULL) c WHERE c.resolution = 'candidato') <> 1
         OR EXISTS (SELECT 1 FROM public.calendar_applicability_candidates(d, now(), m.school_id, NULL, NULL, NULL) c WHERE c.resolution NOT IN ('candidato','sem-candidato'))
         OR NOT EXISTS (SELECT 1 FROM public.calendar_applicability_candidates(d, now(), m.school_id, NULL, NULL, NULL) c
                        WHERE c.resolution = 'candidato' AND c.calendar_id = cal ->> 'calendarId' AND c.version_id::text IS NOT DISTINCT FROM cal ->> 'versionId')
        THEN RETURN 'map:calendar-changed-since-conference'; END IF;
    END LOOP;
  ELSE
    RETURN 'map:snapshot-criterion-not-admitted';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.map_snapshot_binding_issue(uuid, jsonb, date) FROM PUBLIC, anon, authenticated, service_role;

-- 3) Conferência vincula CONTEÚDO: o banco calcula o digest do snapshot conferido e valida coerência.
CREATE OR REPLACE FUNCTION public.record_map_conference(_map uuid, _fingerprint text, _snapshot jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _school text; _id uuid; _person uuid := public.current_person_id(); issue text;
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
  issue := public.map_snapshot_binding_issue(_map, _snapshot, (_snapshot ->> 'snapshotDate')::date);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue; END IF;
  INSERT INTO public.statistical_map_events(map_id, kind, fingerprint, payload, recorded_by, person_id)
  VALUES (_map, 'conferencia', _fingerprint, jsonb_build_object('snapshotDigest', public.map_snapshot_digest(_snapshot)), auth.uid(), _person)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_map_conference(uuid, text, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_map_conference(uuid, text, jsonb) TO authenticated;
-- Conferência só por marca (sem conteúdo) deixa de executar: não vincula o que foi conferido.
REVOKE ALL ON FUNCTION public.record_map_conference(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.record_map_conference(uuid, text) IS 'DEPRECATED (0124): substituída por record_map_conference(uuid,text,jsonb), que vincula o conteúdo; sem EXECUTE.';

-- 4) Oficialização: snapshot deve ter o MESMO digest do conferido e continuar coerente com regra/calendário vigentes.
CREATE OR REPLACE FUNCTION public.officialize_statistical_map(_map uuid, _conference uuid, _fingerprint text, _snapshot jsonb, _snapshot_date date, _base_version uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _m record; _g record; _last_event uuid; _conf record; _corr record; _v integer; _id uuid; _person uuid := public.current_person_id(); _reason text := NULL; _corr_id uuid := NULL; issue text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF _person IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  SELECT * INTO _m FROM public.statistical_maps WHERE id = _map;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'map:not-found'; END IF;
  IF NOT public.has_school_capability('oficializar-mapa-estatistico', _m.school_id) THEN RAISE EXCEPTION 'map:capability-missing'; END IF;
  IF public.map_year_state_on(make_date(_m.competence_year, _m.competence_month, 1)) <> 'operacional' THEN RAISE EXCEPTION 'map:year-not-operational'; END IF;
  SELECT * INTO _g FROM public.school_capability_grant('oficializar-mapa-estatistico', _m.school_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map-version:' || _map));
  -- Mesmo lock de regra usado por rascunho/homologação: nenhuma homologação concorrente durante a gravação.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map-rule:' || _m.rule_id));
  SELECT id INTO _last_event FROM public.statistical_map_events WHERE map_id = _map ORDER BY recorded_at DESC, id DESC LIMIT 1;
  SELECT * INTO _conf FROM public.statistical_map_events WHERE id = _conference AND map_id = _map AND kind = 'conferencia';
  IF _conf.id IS NULL OR _last_event IS DISTINCT FROM _conference THEN RAISE EXCEPTION 'map:conference-not-latest'; END IF;
  IF _conf.fingerprint IS DISTINCT FROM _fingerprint THEN RAISE EXCEPTION 'map:fingerprint-mismatch'; END IF;
  IF (_conf.payload ->> 'snapshotDigest') IS NULL OR (_conf.payload ->> 'snapshotDigest') IS DISTINCT FROM public.map_snapshot_digest(_snapshot)
    THEN RAISE EXCEPTION 'map:snapshot-not-conferred'; END IF;
  IF EXISTS (SELECT 1 FROM public.statistical_map_versions WHERE conference_event_id = _conference) THEN RAISE EXCEPTION 'map:conference-used'; END IF;
  IF _conf.person_id IS NULL OR _conf.person_id = _person THEN RAISE EXCEPTION 'map:segregation'; END IF;
  issue := public.map_snapshot_binding_issue(_map, _snapshot, _snapshot_date);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue; END IF;
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
REVOKE ALL ON FUNCTION public.open_statistical_map(text, integer, integer), public.officialize_statistical_map(uuid, uuid, text, jsonb, date, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.open_statistical_map(text, integer, integer), public.officialize_statistical_map(uuid, uuid, text, jsonb, date, uuid) TO authenticated;
