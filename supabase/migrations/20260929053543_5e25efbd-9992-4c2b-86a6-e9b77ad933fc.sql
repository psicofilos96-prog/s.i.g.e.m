
-- 1. Novo tipo de evento: abertura formal de correção do Mapa
ALTER TABLE public.statistical_map_events DROP CONSTRAINT statistical_map_events_kind_check;
ALTER TABLE public.statistical_map_events ADD CONSTRAINT statistical_map_events_kind_check
  CHECK (kind = ANY (ARRAY['observacoes','conferencia','abertura-correcao']));
ALTER TABLE public.statistical_map_events ADD CONSTRAINT statistical_map_events_correction_check
  CHECK (kind <> 'abertura-correcao' OR (coalesce(btrim(payload->>'reason'),'') <> '' AND (payload->>'baseVersionId') IS NOT NULL AND person_id IS NOT NULL));

-- Segregação por PESSOA entre conferência e oficialização da mesma versão
ALTER TABLE public.statistical_map_versions ADD COLUMN correction_event_id uuid REFERENCES public.statistical_map_events(id) UNIQUE;
ALTER TABLE public.statistical_map_versions ADD CONSTRAINT statistical_map_versions_correction_event_check
  CHECK (version = 1 OR correction_event_id IS NOT NULL);

-- Correção aberta e ainda não consumida para a versão vigente
CREATE OR REPLACE FUNCTION public.open_map_correction_id(_map uuid)
RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT e.id FROM statistical_map_events e
  JOIN statistical_map_versions cur ON cur.map_id = e.map_id AND cur.id = (e.payload->>'baseVersionId')::uuid
  WHERE e.map_id = _map AND e.kind = 'abertura-correcao'
    AND NOT EXISTS (SELECT 1 FROM statistical_map_versions w WHERE w.supersedes_id = cur.id)
    AND NOT EXISTS (SELECT 1 FROM statistical_map_versions u WHERE u.correction_event_id = e.id)
  ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.open_statistical_map_correction(_actor uuid, _map uuid, _base_version uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school text; _id uuid; _person uuid;
BEGIN
  PERFORM public.act_as_verified_user(_actor);
  SELECT school_id INTO _school FROM statistical_maps WHERE id = _map;
  IF _school IS NULL THEN RAISE EXCEPTION 'Mapa inexistente'; END IF;
  IF NOT public.has_school_capability('corrigir-mapa-estatistico', _school) THEN RAISE EXCEPTION 'Capacidade corrigir-mapa-estatistico ausente na escola'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'Abertura de correção exige motivo'; END IF;
  _person := public.current_person_id();
  IF _person IS NULL THEN RAISE EXCEPTION 'Usuário sem pessoa institucional vinculada'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('map-version:' || _map));
  IF NOT EXISTS (SELECT 1 FROM statistical_map_versions v WHERE v.id = _base_version AND v.map_id = _map
                 AND NOT EXISTS (SELECT 1 FROM statistical_map_versions w WHERE w.supersedes_id = v.id)) THEN
    RAISE EXCEPTION 'Correção só parte da versão oficial vigente'; END IF;
  IF public.open_map_correction_id(_map) IS NOT NULL THEN RAISE EXCEPTION 'Já existe correção aberta para a versão vigente'; END IF;
  INSERT INTO statistical_map_events(map_id, kind, payload, recorded_by, person_id)
  VALUES (_map, 'abertura-correcao', jsonb_build_object('baseVersionId', _base_version, 'reason', btrim(_reason)), auth.uid(), _person)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.open_statistical_map_correction(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_statistical_map_correction(uuid,uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.open_map_correction_id(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.record_map_conference(_actor uuid, _map uuid, _fingerprint text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school text; _id uuid; _person uuid;
BEGIN
  PERFORM public.act_as_verified_user(_actor);
  SELECT school_id INTO _school FROM statistical_maps WHERE id = _map;
  IF _school IS NULL THEN RAISE EXCEPTION 'Mapa inexistente'; END IF;
  IF NOT public.has_school_capability('conferir-mapa-estatistico', _school) THEN RAISE EXCEPTION 'Capacidade conferir-mapa-estatistico ausente na escola'; END IF;
  IF coalesce(_fingerprint,'') = '' THEN RAISE EXCEPTION 'Conferência exige marca da fotografia'; END IF;
  _person := public.current_person_id();
  IF _person IS NULL THEN RAISE EXCEPTION 'Usuário sem pessoa institucional vinculada'; END IF;
  IF EXISTS (SELECT 1 FROM statistical_map_versions WHERE map_id = _map) AND public.open_map_correction_id(_map) IS NULL THEN
    RAISE EXCEPTION 'Mapa oficializado: abra formalmente a correção antes de nova conferência'; END IF;
  INSERT INTO statistical_map_events(map_id, kind, fingerprint, recorded_by, person_id)
  VALUES (_map, 'conferencia', _fingerprint, auth.uid(), _person) RETURNING id INTO _id;
  RETURN _id;
END $$;

DROP FUNCTION public.officialize_statistical_map(uuid,uuid,uuid,text,jsonb,date,uuid,text);
CREATE FUNCTION public.officialize_statistical_map(_actor uuid, _map uuid, _conference uuid, _fingerprint text, _snapshot jsonb, _snapshot_date date, _base_version uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m record; _g record; _last_event uuid; _conf record; _corr record; _v integer; _id uuid; _person uuid; _reason text := NULL; _corr_id uuid := NULL;
BEGIN
  PERFORM public.act_as_verified_user(_actor);
  SELECT * INTO _m FROM statistical_maps WHERE id = _map;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'Mapa inexistente'; END IF;
  IF _m.rule_id IS NULL OR NOT EXISTS (SELECT 1 FROM map_competence_rules r WHERE r.id = _m.rule_id AND r.version = _m.rule_version AND r.status = 'homologada') THEN
    RAISE EXCEPTION 'Sem regra de competência homologada: o Mapa não pode ser oficializado'; END IF;
  IF (_snapshot -> 'rule' ->> 'id') IS DISTINCT FROM _m.rule_id OR (_snapshot -> 'rule' ->> 'version')::int IS DISTINCT FROM _m.rule_version
     OR (_snapshot ->> 'snapshotDate')::date IS DISTINCT FROM _snapshot_date THEN
    RAISE EXCEPTION 'Fotografia montada com regra ou data diferente da registrada na competência'; END IF;
  IF NOT public.has_school_capability('oficializar-mapa-estatistico', _m.school_id) THEN RAISE EXCEPTION 'Capacidade oficializar-mapa-estatistico ausente na escola'; END IF;
  SELECT * INTO _g FROM public.school_capability_grant('oficializar-mapa-estatistico', _m.school_id);
  _person := public.current_person_id();
  IF _person IS NULL THEN RAISE EXCEPTION 'Usuário sem pessoa institucional vinculada'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('map-version:' || _map));
  SELECT id INTO _last_event FROM statistical_map_events WHERE map_id = _map ORDER BY recorded_at DESC, id DESC LIMIT 1;
  SELECT * INTO _conf FROM statistical_map_events WHERE id = _conference AND map_id = _map AND kind = 'conferencia';
  IF _conf.id IS NULL OR _last_event IS DISTINCT FROM _conference THEN RAISE EXCEPTION 'Conferência não é a mais recente; confira novamente'; END IF;
  IF _conf.fingerprint IS DISTINCT FROM _fingerprint THEN RAISE EXCEPTION 'Fotografia diferente da conferida; confira novamente'; END IF;
  IF EXISTS (SELECT 1 FROM statistical_map_versions WHERE conference_event_id = _conference) THEN RAISE EXCEPTION 'Conferência já utilizada'; END IF;
  -- Segregação por pessoa, independentemente da atuação usada
  IF _conf.person_id IS NULL OR _conf.person_id = _person THEN
    RAISE EXCEPTION 'Segregação: quem conferiu esta versão não pode oficializá-la'; END IF;
  IF _base_version IS NULL THEN
    IF EXISTS (SELECT 1 FROM statistical_map_versions WHERE map_id = _map) THEN RAISE EXCEPTION 'Mapa já oficializado; abra correção'; END IF;
    _v := 1;
  ELSE
    SELECT version + 1 INTO _v FROM statistical_map_versions WHERE id = _base_version AND map_id = _map;
    IF _v IS NULL THEN RAISE EXCEPTION 'Versão base inexistente'; END IF;
    IF EXISTS (SELECT 1 FROM statistical_map_versions WHERE supersedes_id = _base_version) THEN RAISE EXCEPTION 'Versão base já substituída'; END IF;
    _corr_id := public.open_map_correction_id(_map);
    SELECT * INTO _corr FROM statistical_map_events WHERE id = _corr_id;
    IF _corr.id IS NULL OR (_corr.payload->>'baseVersionId')::uuid IS DISTINCT FROM _base_version THEN
      RAISE EXCEPTION 'Correção não aberta formalmente para a versão vigente'; END IF;
    IF (_conf.recorded_at, _conf.id) <= (_corr.recorded_at, _corr.id) THEN RAISE EXCEPTION 'Conferência anterior à abertura da correção'; END IF;
    _reason := _corr.payload->>'reason';
  END IF;
  INSERT INTO statistical_map_versions(map_id, version, supersedes_id, conference_event_id, correction_event_id, fingerprint, snapshot, snapshot_date, rule_id, rule_version,
    correction_reason, recorded_by, person_id, engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_map, _v, _base_version, _conference, _corr_id, _fingerprint, _snapshot, _snapshot_date, _m.rule_id, _m.rule_version,
    _reason, auth.uid(), _person, _g.engagement_id, _g.policy_id, _g.policy_version) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.officialize_statistical_map(uuid,uuid,uuid,text,jsonb,date,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.officialize_statistical_map(uuid,uuid,uuid,text,jsonb,date,uuid) TO service_role;

-- 2/1. Política em RASCUNHO (não homologada): encerramento e Mapa
DELETE FROM public.capability_policy_rules
 WHERE policy_id = 'b424c230-8ee8-4d5a-b5f0-afe9c981c565' AND engagement_kind_id = 'direcao-escolar' AND capability_id = 'encerrar-ciclo-turma';
INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
SELECT 'b424c230-8ee8-4d5a-b5f0-afe9c981c565', k, c, '{school}'::text[] FROM (VALUES
 ('secretaria-escolar','consultar-mapa-estatistico'),('secretaria-escolar','preparar-mapa-estatistico'),
 ('secretaria-escolar','conferir-mapa-estatistico'),('secretaria-escolar','corrigir-mapa-estatistico'),
 ('secretaria-escolar','consultar-historico-mapa-estatistico'),
 ('direcao-escolar','consultar-mapa-estatistico'),('direcao-escolar','oficializar-mapa-estatistico'),
 ('direcao-escolar','consultar-historico-mapa-estatistico')) AS t(k,c)
WHERE NOT EXISTS (SELECT 1 FROM public.capability_policy_rules r WHERE r.policy_id='b424c230-8ee8-4d5a-b5f0-afe9c981c565' AND r.engagement_kind_id=t.k AND r.capability_id=t.c);
