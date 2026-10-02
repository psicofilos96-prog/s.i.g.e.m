CREATE OR REPLACE FUNCTION public.officialize_statistical_map(_actor uuid, _map uuid, _conference uuid, _fingerprint text, _snapshot jsonb,
  _snapshot_date date, _base_version uuid, _reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m record; _cap text; _g record; _last_event uuid; _conf record; _v integer; _id uuid;
BEGIN
  PERFORM public.act_as_verified_user(_actor);
  SELECT * INTO _m FROM statistical_maps WHERE id = _map;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'Mapa inexistente'; END IF;
  IF _m.rule_id IS NULL OR NOT EXISTS (SELECT 1 FROM map_competence_rules r WHERE r.id = _m.rule_id AND r.version = _m.rule_version AND r.status = 'homologada') THEN
    RAISE EXCEPTION 'Sem regra de competência homologada: o Mapa não pode ser oficializado'; END IF;
  IF (_snapshot -> 'rule' ->> 'id') IS DISTINCT FROM _m.rule_id OR (_snapshot -> 'rule' ->> 'version')::int IS DISTINCT FROM _m.rule_version
     OR (_snapshot ->> 'snapshotDate')::date IS DISTINCT FROM _snapshot_date THEN
    RAISE EXCEPTION 'Fotografia montada com regra ou data diferente da registrada na competência'; END IF;
  _cap := CASE WHEN _base_version IS NULL THEN 'oficializar-mapa-estatistico' ELSE 'corrigir-mapa-estatistico' END;
  IF NOT public.has_school_capability(_cap, _m.school_id) THEN RAISE EXCEPTION 'Capacidade % ausente na escola', _cap; END IF;
  SELECT * INTO _g FROM public.school_capability_grant(_cap, _m.school_id);
  PERFORM pg_advisory_xact_lock(hashtext('map-version:' || _map));
  SELECT id INTO _last_event FROM statistical_map_events WHERE map_id = _map ORDER BY recorded_at DESC, id DESC LIMIT 1;
  SELECT * INTO _conf FROM statistical_map_events WHERE id = _conference AND map_id = _map AND kind = 'conferencia';
  IF _conf.id IS NULL OR _last_event IS DISTINCT FROM _conference THEN RAISE EXCEPTION 'Conferência não é a mais recente; confira novamente'; END IF;
  IF _conf.fingerprint IS DISTINCT FROM _fingerprint THEN RAISE EXCEPTION 'Fotografia diferente da conferida; confira novamente'; END IF;
  IF EXISTS (SELECT 1 FROM statistical_map_versions WHERE conference_event_id = _conference) THEN RAISE EXCEPTION 'Conferência já utilizada'; END IF;
  IF _base_version IS NULL THEN
    IF EXISTS (SELECT 1 FROM statistical_map_versions WHERE map_id = _map) THEN RAISE EXCEPTION 'Mapa já oficializado; use correção'; END IF;
    _v := 1;
  ELSE
    IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'Correção exige motivo'; END IF;
    SELECT version + 1 INTO _v FROM statistical_map_versions WHERE id = _base_version AND map_id = _map;
    IF _v IS NULL THEN RAISE EXCEPTION 'Versão base inexistente'; END IF;
    IF EXISTS (SELECT 1 FROM statistical_map_versions WHERE supersedes_id = _base_version) THEN RAISE EXCEPTION 'Versão base já substituída'; END IF;
  END IF;
  INSERT INTO statistical_map_versions(map_id, version, supersedes_id, conference_event_id, fingerprint, snapshot, snapshot_date, rule_id, rule_version,
    correction_reason, recorded_by, person_id, engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_map, _v, _base_version, _conference, _fingerprint, _snapshot, _snapshot_date, _m.rule_id, _m.rule_version,
    _reason, auth.uid(), public.current_person_id(), _g.engagement_id, _g.policy_id, _g.policy_version) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.officialize_statistical_map(uuid,uuid,uuid,text,jsonb,date,uuid,text) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.officialize_statistical_map(uuid,uuid,uuid,text,jsonb,date,uuid,text) TO service_role;