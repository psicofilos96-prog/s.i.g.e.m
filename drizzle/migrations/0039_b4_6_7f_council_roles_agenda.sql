-- B4.6.7f — Papel de conselho dos tipos de dia como parte da CONSTRUÇÃO da versão do calendário (aditiva).
-- Declaração explícita, imutável, por versão, gravada sob `construir-calendario-da-rede` ANTES de qualquer decisão
-- de homologação da mesma versão (mesma trava da homologação); a homologação aprova o snapshot inteiro, inclusive
-- esta configuração. Nome, sigla, cor ou `councilRole` da fonte nunca decidem: a fonte é só proposta exibida.
-- Agenda: leitor autorizado por alocação/intervalo/knownAt sobre a decisão do servidor (calendar_composed_days_at).
CREATE TABLE public.calendar_version_council_configurations (
  version_id uuid PRIMARY KEY REFERENCES public.calendar_versions(id),
  declares_none boolean NOT NULL,
  act_ref text NOT NULL CHECK (btrim(act_ref) <> ''),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  recorded_via_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.calendar_version_council_roles (
  version_id uuid NOT NULL REFERENCES public.calendar_version_council_configurations(version_id),
  day_type_id text NOT NULL REFERENCES public.calendar_day_types(id),
  role_label text NOT NULL CHECK (btrim(role_label) <> ''),
  source_proposal text,
  PRIMARY KEY (version_id, day_type_id)
);
GRANT ALL ON public.calendar_version_council_configurations TO service_role;
GRANT ALL ON public.calendar_version_council_roles TO service_role;
REVOKE ALL ON public.calendar_version_council_configurations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.calendar_version_council_roles FROM PUBLIC, anon, authenticated;
DO $acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.calendar_version_council_configurations FROM sandbox_exec';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.calendar_version_council_roles FROM sandbox_exec';
  END IF;
END $acl$;
ALTER TABLE public.calendar_version_council_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_version_council_roles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_calendar_council_configurations BEFORE UPDATE OR DELETE ON public.calendar_version_council_configurations
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER immutable_calendar_council_roles BEFORE UPDATE OR DELETE ON public.calendar_version_council_roles
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Writer exato. _roles = [] declara explicitamente "nenhum tipo é conselho nesta versão" (≠ não configurado).
CREATE FUNCTION public.record_calendar_council_configuration(_version_id uuid, _roles jsonb, _act_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE g uuid; _pid uuid; r jsonb; _tid text; _n integer := 0;
BEGIN
  g := public.calendar_network_grant('construir-calendario-da-rede');
  _pid := public.current_person_id();
  IF _pid IS NULL THEN RAISE EXCEPTION 'calendar-council:person-link-required'; END IF;
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'calendar-council:act-required'; END IF;
  IF _version_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.calendar_versions v WHERE v.id = _version_id) THEN
    RAISE EXCEPTION 'calendar-council:version-not-found'; END IF;
  IF pg_catalog.jsonb_typeof(coalesce(_roles,'null')) <> 'array' THEN RAISE EXCEPTION 'calendar-council:roles-required'; END IF;
  -- Mesma trava da homologação: decisão e configuração nunca se intercalam.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendar-homologation:' || _version_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.calendar_version_homologations h WHERE h.calendar_version_id = _version_id) THEN
    RAISE EXCEPTION 'calendar-council:version-already-decided'; END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_version_council_configurations c WHERE c.version_id = _version_id) THEN
    RAISE EXCEPTION 'calendar-council:already-recorded'; END IF;
  INSERT INTO public.calendar_version_council_configurations(version_id, declares_none, act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_version_id, pg_catalog.jsonb_array_length(_roles) = 0, pg_catalog.btrim(_act_ref), auth.uid(), _pid, g);
  FOR r IN SELECT x FROM pg_catalog.jsonb_array_elements(_roles) x LOOP
    _tid := r->>'dayTypeId';
    IF coalesce(pg_catalog.btrim(r->>'role'),'') = '' THEN RAISE EXCEPTION 'calendar-council:role-required'; END IF;
    -- O tipo precisa estar DECLARADO nesta versão (faixa, evento ou atribuição diária).
    IF _tid IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.calendar_day_type_versions t WHERE t.day_type_id = _tid AND t.id IN (
        SELECT day_type_version_id FROM public.calendar_version_ranges WHERE version_id = _version_id
        UNION SELECT day_type_version_id FROM public.calendar_version_events WHERE version_id = _version_id
        UNION SELECT day_type_version_id FROM public.calendar_version_day_assignments WHERE version_id = _version_id)) THEN
      RAISE EXCEPTION 'calendar-council:type-not-in-version'; END IF;
    IF EXISTS (SELECT 1 FROM public.calendar_version_council_roles c WHERE c.version_id = _version_id AND c.day_type_id = _tid) THEN
      RAISE EXCEPTION 'calendar-council:duplicate-type'; END IF;
    INSERT INTO public.calendar_version_council_roles(version_id, day_type_id, role_label, source_proposal)
    VALUES (_version_id, _tid, pg_catalog.btrim(r->>'role'), nullif(pg_catalog.btrim(coalesce(r->>'sourceProposal','')),''));
    _n := _n + 1;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('versionId', _version_id, 'recorded', true, 'roles', _n);
END $fn$;
REVOKE ALL ON FUNCTION public.record_calendar_council_configuration(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_calendar_council_configuration(uuid, jsonb, text) TO authenticated;

-- Configuração por versão: construção vê qualquer; demais autenticados só versão homologada na data.
CREATE FUNCTION public.calendar_council_configuration_at(_version_id uuid, _on date, _known_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE c public.calendar_version_council_configurations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR _version_id IS NULL OR _on IS NULL OR _known_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('contract','b4.6.7f/1','state','access-denied'); END IF;
  IF NOT (public.calendar_has_network_capability('construir-calendario-da-rede')
          OR public.calendar_version_homologation_state(_version_id, _on, _known_at) = 'homologada') THEN
    RETURN pg_catalog.jsonb_build_object('contract','b4.6.7f/1','state','access-denied'); END IF;
  SELECT * INTO c FROM public.calendar_version_council_configurations x WHERE x.version_id = _version_id AND x.created_at <= _known_at;
  IF c.version_id IS NULL THEN RETURN pg_catalog.jsonb_build_object('contract','b4.6.7f/1','state','nao-configurada'); END IF;
  RETURN pg_catalog.jsonb_build_object('contract','b4.6.7f/1','state','configurada','versionId', c.version_id, 'declaresNone', c.declares_none,
    'actRef', c.act_ref, 'recordedAt', c.created_at,
    'roles', coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('dayTypeId', r.day_type_id, 'role', r.role_label,
      'sourceProposal', r.source_proposal) ORDER BY r.day_type_id) FROM public.calendar_version_council_roles r WHERE r.version_id = c.version_id), '[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_council_configuration_at(uuid, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_council_configuration_at(uuid, date, timestamptz) TO authenticated;

-- Agenda de conselhos por alocação: mesma autorização e mesmo snapshot da decisão do servidor; só a versão que o
-- servidor decidiu para a alocação naquele dia é consultada. Efeito do conselho é o school_day_effect declarado
-- (true/false/NULL preservado). Sem versão decidida ⇒ pendente; sem configuração ⇒ nao-configurada (nunca zero).
CREATE FUNCTION public.calendar_council_agenda_at(_allocation text, _from date, _to date, _known_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE base jsonb; d jsonb; _ver uuid; c public.calendar_version_council_configurations%ROWTYPE; _items jsonb; _out jsonb := '[]'::jsonb;
BEGIN
  base := public.calendar_composed_days_at(_allocation, _from, _to, _known_at);
  IF base->>'state' IS DISTINCT FROM 'lido' THEN
    RETURN pg_catalog.jsonb_build_object('contract','b4.6.7f/1','state', base->>'state', 'detail', base->>'detail'); END IF;
  FOR d IN SELECT x FROM pg_catalog.jsonb_array_elements(base->'days') x LOOP
    _ver := nullif(d->>'versionId','')::uuid;
    IF _ver IS NULL THEN
      _out := _out || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('on', d->>'on', 'state', 'pendente', 'dayResult', d->>'result')); CONTINUE; END IF;
    SELECT * INTO c FROM public.calendar_version_council_configurations x WHERE x.version_id = _ver AND x.created_at <= _known_at;
    IF c.version_id IS NULL THEN
      _out := _out || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('on', d->>'on', 'state', 'nao-configurada',
        'dayResult', d->>'result', 'calendarId', d->>'calendarId', 'versionId', _ver)); CONTINUE; END IF;
    SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('dayTypeId', r.day_type_id, 'role', r.role_label,
             'label', coalesce(decl->>'event_label', decl->>'day_type_label'), 'dayTypeLabel', decl->>'day_type_label',
             'schoolDayEffect', decl->'school_day_effect', 'declarationKind', decl->>'declaration_kind') ORDER BY r.day_type_id), '[]'::jsonb)
      INTO _items
      FROM pg_catalog.jsonb_array_elements(coalesce(d->'declarations','[]'::jsonb)) decl
      JOIN public.calendar_version_council_roles r ON r.version_id = _ver AND r.day_type_id = decl->>'day_type_id';
    _out := _out || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('on', d->>'on', 'state', 'configurada',
      'dayResult', d->>'result', 'calendarId', d->>'calendarId', 'versionId', _ver, 'items', _items));
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('contract','b4.6.7f/1','state','lido','authorizes', false, 'allocation', _allocation,
    'snapshot', base->'snapshot', 'days', _out);
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_council_agenda_at(text, date, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_council_agenda_at(text, date, date, timestamptz) TO authenticated;
