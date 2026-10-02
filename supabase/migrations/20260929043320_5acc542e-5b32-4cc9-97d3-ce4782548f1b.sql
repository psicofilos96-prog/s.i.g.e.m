ALTER TABLE public.institutional_classes DROP COLUMN modality_id;
ALTER TABLE public.institutional_classes DROP COLUMN modality_label_snapshot;

CREATE TABLE public.map_competence_rules (
  id text NOT NULL,
  version integer NOT NULL,
  status text NOT NULL CHECK (status IN ('rascunho','homologada')),
  homologation_act_ref text,
  valid_from date NOT NULL,
  valid_until date,
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version),
  CHECK (status <> 'homologada' OR homologation_act_ref IS NOT NULL)
);
CREATE TABLE public.statistical_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  competence_year integer NOT NULL CHECK (competence_year BETWEEN 2000 AND 2200),
  competence_month integer NOT NULL CHECK (competence_month BETWEEN 1 AND 12),
  rule_id text,
  rule_version integer,
  opened_by uuid NOT NULL,
  opened_person_id uuid REFERENCES public.institutional_persons(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, competence_year, competence_month),
  FOREIGN KEY (rule_id, rule_version) REFERENCES public.map_competence_rules(id, version)
);
CREATE TABLE public.statistical_map_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.statistical_maps(id),
  kind text NOT NULL CHECK (kind IN ('observacoes','conferencia')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint text,
  recorded_by uuid NOT NULL,
  person_id uuid REFERENCES public.institutional_persons(id),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (kind <> 'conferencia' OR fingerprint IS NOT NULL)
);
CREATE TABLE public.statistical_map_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.statistical_maps(id),
  version integer NOT NULL,
  supersedes_id uuid UNIQUE REFERENCES public.statistical_map_versions(id),
  conference_event_id uuid NOT NULL REFERENCES public.statistical_map_events(id),
  fingerprint text NOT NULL,
  snapshot jsonb NOT NULL,
  snapshot_date date NOT NULL,
  rule_id text NOT NULL,
  rule_version integer NOT NULL,
  correction_reason text,
  recorded_by uuid NOT NULL,
  person_id uuid REFERENCES public.institutional_persons(id),
  engagement_id uuid REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid REFERENCES public.capability_policies(id),
  capability_policy_version integer,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (map_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND coalesce(btrim(correction_reason),'') <> '')),
  FOREIGN KEY (rule_id, rule_version) REFERENCES public.map_competence_rules(id, version)
);

GRANT SELECT ON public.map_competence_rules, public.statistical_maps, public.statistical_map_events, public.statistical_map_versions TO authenticated;
GRANT ALL ON public.map_competence_rules, public.statistical_maps, public.statistical_map_events, public.statistical_map_versions TO service_role;
ALTER TABLE public.map_competence_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistical_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistical_map_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistical_map_versions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.guard_map_rule() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.status = 'homologada' THEN RAISE EXCEPTION 'Regra homologada é imutável; crie nova versão'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER map_rules_immutable BEFORE UPDATE OR DELETE ON public.map_competence_rules FOR EACH ROW EXECUTE FUNCTION public.guard_map_rule();
CREATE TRIGGER statistical_maps_immutable BEFORE UPDATE OR DELETE ON public.statistical_maps FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER statistical_map_events_immutable BEFORE UPDATE OR DELETE ON public.statistical_map_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER statistical_map_versions_immutable BEFORE UPDATE OR DELETE ON public.statistical_map_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE POLICY "map rules readable" ON public.map_competence_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "maps by school capability" ON public.statistical_maps FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-mapa-estatistico', school_id));
CREATE POLICY "map events by school capability" ON public.statistical_map_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.statistical_maps m WHERE m.id = map_id AND public.has_school_capability('consultar-mapa-estatistico', m.school_id)));
CREATE POLICY "map versions by school capability" ON public.statistical_map_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.statistical_maps m WHERE m.id = map_id AND
    (public.has_school_capability('consultar-mapa-estatistico', m.school_id) OR public.has_school_capability('consultar-historico-mapa-estatistico', m.school_id))));

-- Concessão efetiva (atuação + política) usada como proveniência do ato.
CREATE OR REPLACE FUNCTION public.school_capability_grant(_capability text, _school text)
RETURNS TABLE(engagement_id uuid, policy_id uuid, policy_version integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.engagement_id, c.policy_id, c.policy_version FROM public.effective_capabilities(current_date) c
  WHERE c.capability_id = _capability AND c.school_id = _school LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.school_capability_grant(text,text) FROM anon, public, authenticated;

CREATE OR REPLACE FUNCTION public.applicable_map_rule(_on date) RETURNS TABLE(id text, version integer)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT r.id, r.version FROM public.map_competence_rules r
  WHERE r.status = 'homologada' AND r.valid_from <= _on AND (r.valid_until IS NULL OR r.valid_until >= _on)
  ORDER BY r.valid_from DESC, r.version DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.open_statistical_map(_school text, _year integer, _month integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _r record; _first date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  IF NOT public.has_school_capability('preparar-mapa-estatistico', _school) THEN RAISE EXCEPTION 'Capacidade preparar-mapa-estatistico ausente na escola'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('map:' || _school || ':' || _year || ':' || _month));
  SELECT id INTO _id FROM statistical_maps WHERE school_id = _school AND competence_year = _year AND competence_month = _month;
  IF _id IS NOT NULL THEN RETURN _id; END IF; -- idempotente
  _first := make_date(_year, _month, 1);
  SELECT * INTO _r FROM public.applicable_map_rule(_first);
  INSERT INTO statistical_maps(school_id, competence_year, competence_month, rule_id, rule_version, opened_by, opened_person_id)
  VALUES (_school, _year, _month, _r.id, _r.version, auth.uid(), public.current_person_id()) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_map_observations(_map uuid, _text text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school text; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT school_id INTO _school FROM statistical_maps WHERE id = _map;
  IF _school IS NULL THEN RAISE EXCEPTION 'Mapa inexistente'; END IF;
  IF NOT public.has_school_capability('preparar-mapa-estatistico', _school) THEN RAISE EXCEPTION 'Capacidade preparar-mapa-estatistico ausente na escola'; END IF;
  IF length(coalesce(_text,'')) > 4000 THEN RAISE EXCEPTION 'Observações excedem 4000 caracteres'; END IF;
  INSERT INTO statistical_map_events(map_id, kind, payload, recorded_by, person_id)
  VALUES (_map, 'observacoes', jsonb_build_object('text', coalesce(_text,'')), auth.uid(), public.current_person_id()) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_map_conference(_map uuid, _fingerprint text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school text; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT school_id INTO _school FROM statistical_maps WHERE id = _map;
  IF _school IS NULL THEN RAISE EXCEPTION 'Mapa inexistente'; END IF;
  IF NOT public.has_school_capability('conferir-mapa-estatistico', _school) THEN RAISE EXCEPTION 'Capacidade conferir-mapa-estatistico ausente na escola'; END IF;
  IF coalesce(_fingerprint,'') = '' THEN RAISE EXCEPTION 'Conferência exige marca da fotografia'; END IF;
  INSERT INTO statistical_map_events(map_id, kind, fingerprint, recorded_by, person_id)
  VALUES (_map, 'conferencia', _fingerprint, auth.uid(), public.current_person_id()) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.officialize_statistical_map(_map uuid, _conference uuid, _fingerprint text, _snapshot jsonb,
  _snapshot_date date, _base_version uuid, _reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m record; _cap text; _g record; _last_event uuid; _conf record; _v integer; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT * INTO _m FROM statistical_maps WHERE id = _map;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'Mapa inexistente'; END IF;
  IF _m.rule_id IS NULL OR NOT EXISTS (SELECT 1 FROM map_competence_rules r WHERE r.id = _m.rule_id AND r.version = _m.rule_version AND r.status = 'homologada') THEN
    RAISE EXCEPTION 'Sem regra de competência homologada: o Mapa não pode ser oficializado'; END IF;
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

REVOKE EXECUTE ON FUNCTION public.open_statistical_map(text,integer,integer), public.record_map_observations(uuid,text),
  public.record_map_conference(uuid,text), public.officialize_statistical_map(uuid,uuid,text,jsonb,date,uuid,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.open_statistical_map(text,integer,integer), public.record_map_observations(uuid,text),
  public.record_map_conference(uuid,text), public.officialize_statistical_map(uuid,uuid,text,jsonb,date,uuid,text) TO authenticated;