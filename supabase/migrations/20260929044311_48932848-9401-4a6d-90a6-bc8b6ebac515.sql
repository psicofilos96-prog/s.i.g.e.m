-- 14.10.1: conferência e oficialização só pelo servidor, com o agente verificado declarado.
DROP FUNCTION IF EXISTS public.record_map_conference(uuid, text);
DROP FUNCTION IF EXISTS public.officialize_statistical_map(uuid,uuid,text,jsonb,date,uuid,text);

CREATE OR REPLACE FUNCTION public.act_as_verified_user(_actor uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Operação reservada ao servidor do SIGEM'; END IF;
  IF _actor IS NULL THEN RAISE EXCEPTION 'Agente ausente'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _actor::text, 'role', 'authenticated')::text, true);
END $$;
REVOKE EXECUTE ON FUNCTION public.act_as_verified_user(uuid) FROM anon, public, authenticated;

CREATE OR REPLACE FUNCTION public.record_map_conference(_actor uuid, _map uuid, _fingerprint text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school text; _id uuid;
BEGIN
  PERFORM public.act_as_verified_user(_actor);
  SELECT school_id INTO _school FROM statistical_maps WHERE id = _map;
  IF _school IS NULL THEN RAISE EXCEPTION 'Mapa inexistente'; END IF;
  IF NOT public.has_school_capability('conferir-mapa-estatistico', _school) THEN RAISE EXCEPTION 'Capacidade conferir-mapa-estatistico ausente na escola'; END IF;
  IF coalesce(_fingerprint,'') = '' THEN RAISE EXCEPTION 'Conferência exige marca da fotografia'; END IF;
  INSERT INTO statistical_map_events(map_id, kind, fingerprint, recorded_by, person_id)
  VALUES (_map, 'conferencia', _fingerprint, auth.uid(), public.current_person_id()) RETURNING id INTO _id;
  RETURN _id;
END $$;

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
  IF (_snapshot ->> 'ruleId') IS DISTINCT FROM _m.rule_id OR (_snapshot ->> 'ruleVersion')::int IS DISTINCT FROM _m.rule_version THEN
    RAISE EXCEPTION 'Fotografia montada com regra diferente da registrada na competência'; END IF;
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
REVOKE EXECUTE ON FUNCTION public.record_map_conference(uuid,uuid,text), public.officialize_statistical_map(uuid,uuid,uuid,text,jsonb,date,uuid,text) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.record_map_conference(uuid,uuid,text), public.officialize_statistical_map(uuid,uuid,uuid,text,jsonb,date,uuid,text) TO service_role;

-- 14.11.1: atributos cadastrais e temporais na MESMA versão da escola.
ALTER TABLE public.institutional_school_record_versions
  ADD COLUMN phone text, ADD COLUMN institutional_email text, ADD COLUMN own_building boolean,
  ADD COLUMN hard_access boolean, ADD COLUMN classroom_count integer CHECK (classroom_count IS NULL OR classroom_count >= 0);

DROP FUNCTION IF EXISTS public.register_school_record_version(text,uuid,text,text,text,text,boolean,date,text,text,text,text);
CREATE OR REPLACE FUNCTION public.register_school_record_version(
  _school text, _base_version_id uuid, _official_name text, _address text, _district text,
  _location_kind text, _active boolean, _valid_from date, _justification text, _act_ref text,
  _inep text, _network_code text, _phone text DEFAULT NULL, _email text DEFAULT NULL,
  _own_building boolean DEFAULT NULL, _hard_access boolean DEFAULT NULL, _classroom_count integer DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; cur record; nv integer; vid uuid; pid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT ec.engagement_id, ec.policy_id, ec.policy_version INTO g
    FROM public.effective_capabilities(current_date) ec
   WHERE ec.capability_id = 'manter-cadastro-unidade-escolar' AND (ec.school_id = _school) LIMIT 1;
  IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'Capacidade manter-cadastro-unidade-escolar não concedida por política homologada'; END IF;
  IF coalesce(trim(_official_name),'') = '' THEN RAISE EXCEPTION 'Nome oficial obrigatório'; END IF;
  IF _email IS NOT NULL AND _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail institucional inválido'; END IF;
  pid := public.current_person_id();
  PERFORM pg_advisory_xact_lock(hashtext('school:' || _school));
  SELECT * INTO cur FROM public.institutional_school_record_versions WHERE school_id = _school ORDER BY version_number DESC LIMIT 1;
  IF cur.id IS NULL THEN
    IF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'Base inexistente'; END IF;
    INSERT INTO public.institutional_schools(id, originating_act_ref, author_user_id) VALUES (_school, _act_ref, auth.uid()) ON CONFLICT DO NOTHING;
    nv := 1;
  ELSE
    IF _base_version_id IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'Versão base superada'; END IF;
    IF coalesce(trim(_justification),'') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória para mudança cadastral'; END IF;
    nv := cur.version_number + 1;
  END IF;
  IF _inep IS NOT NULL THEN
    INSERT INTO public.institutional_school_identifiers(school_id, identifier_kind, value, originating_act_ref, author_user_id)
    VALUES (_school, 'inep', _inep, _act_ref, auth.uid()) ON CONFLICT (school_id, identifier_kind) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE school_id=_school AND identifier_kind='inep' AND value=_inep) THEN
      RAISE EXCEPTION 'INEP divergente do já cadastrado para esta unidade'; END IF;
  END IF;
  IF _network_code IS NOT NULL THEN
    INSERT INTO public.institutional_school_identifiers(school_id, identifier_kind, value, originating_act_ref, author_user_id)
    VALUES (_school, 'codigo-rede', _network_code, _act_ref, auth.uid()) ON CONFLICT (school_id, identifier_kind) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE school_id=_school AND identifier_kind='codigo-rede' AND value=_network_code) THEN
      RAISE EXCEPTION 'Código de rede divergente do já cadastrado para esta unidade'; END IF;
  END IF;
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, supersedes_version_id, official_name, address, district, location_kind, active, valid_from, justification, originating_act_ref, author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version, phone, institutional_email, own_building, hard_access, classroom_count)
  VALUES (_school, nv, cur.id, _official_name, _address, _district, _location_kind, _active, _valid_from, _justification, _act_ref, auth.uid(), pid, g.engagement_id, g.policy_id, g.policy_version, _phone, _email, _own_building, _hard_access, _classroom_count)
  RETURNING id INTO vid;
  RETURN vid;
END $$;
REVOKE ALL ON FUNCTION public.register_school_record_version(text,uuid,text,text,text,text,boolean,date,text,text,text,text,text,text,boolean,boolean,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_school_record_version(text,uuid,text,text,text,text,boolean,date,text,text,text,text,text,text,boolean,boolean,integer) TO authenticated;

-- Anexos/unidades vinculadas: vínculo temporal entre duas identidades escolares.
CREATE TABLE public.institutional_school_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_link_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES public.institutional_school_links(id),
  principal_school_id text NOT NULL REFERENCES public.institutional_schools(id),
  linked_school_id text NOT NULL REFERENCES public.institutional_schools(id),
  link_kind_id text NOT NULL,
  link_kind_version integer NOT NULL,
  valid_from date NOT NULL,
  valid_until date,
  originating_act_ref text NOT NULL,
  correction_reason text,
  author_user_id uuid,
  author_person_id uuid REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid REFERENCES public.capability_policies(id),
  capability_policy_version integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_link_id, version),
  CHECK (principal_school_id <> linked_school_id),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
GRANT SELECT ON public.institutional_school_links TO authenticated;
GRANT ALL ON public.institutional_school_links TO service_role;
ALTER TABLE public.institutional_school_links ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER school_links_immutable BEFORE UPDATE OR DELETE ON public.institutional_school_links FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE POLICY "school links readable" ON public.institutional_school_links FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.record_school_link(_logical uuid, _base uuid, _principal text, _linked text,
  _kind text, _kind_version integer, _valid_from date, _valid_until date, _act_ref text, _correction_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; cur record; _id uuid; _v integer := 1; _lid uuid := coalesce(_logical, gen_random_uuid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT ec.engagement_id, ec.policy_id, ec.policy_version INTO g FROM public.effective_capabilities(current_date) ec
   WHERE ec.capability_id = 'manter-cadastro-unidade-escolar' AND ec.school_id = _principal LIMIT 1;
  IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'Capacidade manter-cadastro-unidade-escolar não concedida por política homologada'; END IF;
  IF NOT public.attribute_value_homologated('vinculo-entre-unidades', _kind, _kind_version, _valid_from) THEN
    RAISE EXCEPTION 'Tipo de vínculo entre unidades não homologado para a data'; END IF;
  IF coalesce(btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'Vínculo exige ato originador'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('school-link:' || _lid));
  SELECT * INTO cur FROM institutional_school_links WHERE logical_link_id = _lid ORDER BY version DESC LIMIT 1;
  IF cur.id IS NOT NULL THEN
    IF _base IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'Versão base superada'; END IF;
    IF coalesce(btrim(_correction_reason),'') = '' THEN RAISE EXCEPTION 'Correção exige motivo'; END IF;
    _v := cur.version + 1;
  ELSIF _base IS NOT NULL THEN RAISE EXCEPTION 'Base inexistente'; END IF;
  INSERT INTO institutional_school_links(logical_link_id, version, supersedes_id, principal_school_id, linked_school_id, link_kind_id, link_kind_version,
    valid_from, valid_until, originating_act_ref, correction_reason, author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_lid, _v, cur.id, _principal, _linked, _kind, _kind_version, _valid_from, _valid_until, _act_ref, _correction_reason,
    auth.uid(), public.current_person_id(), g.engagement_id, g.policy_id, g.policy_version) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_school_link(uuid,uuid,text,text,text,integer,date,date,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_school_link(uuid,uuid,text,text,text,integer,date,date,text,text) TO authenticated;

-- 14.11.2: direção = atuação vigente de tipo homologado ('tipo-de-atuacao') declarado pela regra.
CREATE OR REPLACE FUNCTION public.school_engagements_of_kinds(_school text, _on date, _kinds text[])
RETURNS TABLE(engagement_id uuid, person_id uuid, person_name text, engagement_kind_id text, valid_from date, valid_until date, originating_act_ref text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.person_id, p.display_name, e.engagement_kind_id, e.valid_from, e.valid_until, e.originating_act_ref
  FROM institutional_engagements e JOIN institutional_persons p ON p.id = e.person_id
  WHERE public.has_school_capability('consultar-mapa-estatistico', _school)
    AND e.school_id = _school AND e.class_id IS NULL AND e.engagement_kind_id = ANY(_kinds)
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND EXISTS (SELECT 1 FROM attribute_value_definitions d WHERE d.scheme_id = 'tipo-de-atuacao' AND d.value_id = e.engagement_kind_id
                AND d.status = 'homologada' AND d.valid_from <= _on)
$$;
REVOKE EXECUTE ON FUNCTION public.school_engagements_of_kinds(text,date,text[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.school_engagements_of_kinds(text,date,text[]) TO authenticated;