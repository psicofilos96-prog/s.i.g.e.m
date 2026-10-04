-- B4.6.10 — Calendário central da Supervisão: wrappers transacionais sobre os writers existentes (0024/0032/0035/0039/B2.4).
-- Decisão do usuário (2026-10-04): a conta da Supervisão (designação 0043) salva, homologa e altera o calendário no
-- próprio editor; aplicabilidade operacional sem cadastro de escolas/turmas é DECLARADA pendente (não inferida) e não
-- bloqueia a homologação do documento; consumidores continuam sem calendário aplicável até haver recortes declarados.

CREATE TABLE public.calendar_network_year_links (
  civil_year integer PRIMARY KEY CHECK (civil_year BETWEEN 1900 AND 3000),
  academic_year_id text NOT NULL UNIQUE REFERENCES public.institutional_academic_years(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.calendar_network_source_links (
  source_key text PRIMARY KEY CHECK (btrim(source_key) <> ''),
  calendar_id text NOT NULL UNIQUE REFERENCES public.institutional_calendars(id),
  academic_year_id text NOT NULL REFERENCES public.institutional_academic_years(id),
  period_organization_id text NOT NULL REFERENCES public.institutional_period_organizations(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.calendar_network_period_links (
  source_key text NOT NULL REFERENCES public.calendar_network_source_links(source_key),
  period_key text NOT NULL CHECK (btrim(period_key) <> ''),
  period_id text NOT NULL UNIQUE REFERENCES public.institutional_academic_periods(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (source_key, period_key)
);
CREATE TABLE public.calendar_network_day_type_links (
  code text PRIMARY KEY CHECK (btrim(code) <> ''),
  day_type_id text NOT NULL UNIQUE REFERENCES public.calendar_day_types(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.calendar_version_context_pending (
  version_id uuid PRIMARY KEY REFERENCES public.calendar_versions(id),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

GRANT SELECT ON public.calendar_network_year_links, public.calendar_network_source_links, public.calendar_network_period_links,
  public.calendar_network_day_type_links, public.calendar_version_context_pending TO authenticated;
GRANT ALL ON public.calendar_network_year_links, public.calendar_network_source_links, public.calendar_network_period_links,
  public.calendar_network_day_type_links, public.calendar_version_context_pending TO service_role;
ALTER TABLE public.calendar_network_year_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_network_source_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_network_period_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_network_day_type_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_version_context_pending ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authority reads year links" ON public.calendar_network_year_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calendar_designated_capabilities(CURRENT_DATE) c WHERE c.capability_id = 'construir-calendario-da-rede'));
CREATE POLICY "authority reads source links" ON public.calendar_network_source_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calendar_designated_capabilities(CURRENT_DATE) c WHERE c.capability_id = 'construir-calendario-da-rede'));
CREATE POLICY "authority reads period links" ON public.calendar_network_period_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calendar_designated_capabilities(CURRENT_DATE) c WHERE c.capability_id = 'construir-calendario-da-rede'));
CREATE POLICY "authority reads day type links" ON public.calendar_network_day_type_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.calendar_designated_capabilities(CURRENT_DATE) c WHERE c.capability_id = 'construir-calendario-da-rede'));
CREATE POLICY "authenticated reads pending context" ON public.calendar_version_context_pending FOR SELECT TO authenticated USING (true);

CREATE TRIGGER cnyl_immutable BEFORE UPDATE OR DELETE ON public.calendar_network_year_links FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER cnsl_immutable BEFORE UPDATE OR DELETE ON public.calendar_network_source_links FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER cnpl_immutable BEFORE UPDATE OR DELETE ON public.calendar_network_period_links FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER cndl_immutable BEFORE UPDATE OR DELETE ON public.calendar_network_day_type_links FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER cvcp_immutable BEFORE UPDATE OR DELETE ON public.calendar_version_context_pending FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.homologate_calendar_version(
  _calendar_version_id uuid, _expected_last_homologation_id uuid, _decision text,
  _effective_from date, _act_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE g uuid; _pid uuid; v public.calendar_versions%ROWTYPE; _last public.calendar_version_homologations%ROWTYPE;
  _issue text; _norm text; _id uuid; _seq integer;
BEGIN
  g := public.calendar_network_grant('homologar-calendario-da-rede');
  _pid := public.current_person_id();
  IF _pid IS NULL THEN RAISE EXCEPTION 'calendar-homologation:person-link-required'; END IF;
  IF _decision IS NULL OR _decision NOT IN ('homologada','revogada') THEN RAISE EXCEPTION 'calendar-homologation:invalid-decision'; END IF;
  IF _effective_from IS NULL THEN RAISE EXCEPTION 'calendar-homologation:effective-from-required'; END IF;
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'calendar-homologation:act-required'; END IF;
  SELECT * INTO v FROM public.calendar_versions WHERE id = _calendar_version_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'calendar-homologation:version-not-found'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendar-homologation:' || v.id::text, 0));
  SELECT * INTO _last FROM public.calendar_version_homologations h WHERE h.calendar_version_id = v.id ORDER BY h.sequence DESC LIMIT 1;
  IF _last.id IS DISTINCT FROM _expected_last_homologation_id THEN RAISE EXCEPTION 'calendar-homologation:base-superseded'; END IF;
  IF _last.decision = _decision THEN RAISE EXCEPTION 'calendar-homologation:repeated-decision'; END IF;
  IF _effective_from < v.valid_from OR (v.valid_until IS NOT NULL AND _effective_from > v.valid_until) THEN
    RAISE EXCEPTION 'calendar-homologation:outside-version-validity'; END IF;
  IF _decision = 'revogada' THEN
    IF coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'calendar-homologation:reason-required'; END IF;
  ELSE
    _issue := public.calendar_version_reference_issue(v.id, pg_catalog.clock_timestamp());
    IF _issue IS NOT NULL THEN RAISE EXCEPTION 'calendar-homologation:snapshot-%', _issue; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.calendar_version_applicability_records a WHERE a.version_id = v.id)
       AND NOT EXISTS (SELECT 1 FROM public.calendar_version_context_pending p WHERE p.version_id = v.id) THEN
      RAISE EXCEPTION 'calendar-homologation:blocked-applicability-undeclared-d5'; END IF;
    SELECT x.state INTO _norm FROM public.calendar_composition_norm_state_at(_effective_from, pg_catalog.clock_timestamp()) x WHERE x.norm_id IS NULL;
    IF _norm IS DISTINCT FROM 'norma-homologada' THEN
      RAISE EXCEPTION 'calendar-homologation:blocked-composition-norm-%', coalesce(_norm, 'desconhecida'); END IF;
  END IF;
  _seq := coalesce(_last.sequence, 0) + 1;
  INSERT INTO public.calendar_version_homologations(calendar_version_id, sequence, supersedes_id, decision, effective_from,
    homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (v.id, _seq, _last.id, _decision, _effective_from, pg_catalog.btrim(_act_ref), nullif(pg_catalog.btrim(coalesce(_reason,'')),''),
    'homologar-calendario-da-rede', auth.uid(), _pid, g) RETURNING id INTO _id;
  RETURN pg_catalog.jsonb_build_object('recordId', _id, 'sequence', _seq, 'decision', _decision, 'calendarVersionId', v.id);
END $fn$;
REVOKE ALL ON FUNCTION public.homologate_calendar_version(uuid, uuid, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.homologate_calendar_version(uuid, uuid, text, date, text, text) TO authenticated;

CREATE FUNCTION public.save_network_calendar(_source_key text, _expected_base_version_id uuid, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _yr integer; _y text; _org text; _cal text; _link public.calendar_network_source_links%ROWTYPE;
  _vf date; _vu date; _act text; _reason text; p jsonb; _pid text; _pv public.institutional_academic_period_versions%ROWTYPE;
  _periods jsonb := '[]'::jsonb; t jsonb; _tid text; _tv public.calendar_day_type_versions%ROWTYPE; _r jsonb;
  _tmap jsonb := '{}'::jsonb; _tidmap jsonb := '{}'::jsonb; _days jsonb := '[]'::jsonb; _events jsonb := '[]'::jsonb;
  _roles jsonb := '[]'::jsonb; d jsonb; _vid uuid; _ver integer; _eff boolean;
BEGIN
  PERFORM public.calendar_network_grant('construir-calendario-da-rede');
  IF coalesce(pg_catalog.btrim(_source_key),'') = '' THEN RAISE EXCEPTION 'calendar-save:source-key-required'; END IF;
  IF pg_catalog.jsonb_typeof(_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'calendar-save:payload-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendar-save:' || _source_key, 0));
  _yr := (_payload->>'year')::integer;
  IF _yr IS NULL THEN RAISE EXCEPTION 'calendar-save:year-required'; END IF;
  _vf := pg_catalog.make_date(_yr, 1, 1); _vu := pg_catalog.make_date(_yr, 12, 31);
  _act := pg_catalog.btrim(coalesce(_payload->>'actRef',''));
  IF _act = '' THEN RAISE EXCEPTION 'calendar-save:act-required'; END IF;
  _reason := nullif(pg_catalog.btrim(coalesce(_payload->>'reason','')),'');

  SELECT academic_year_id INTO _y FROM public.calendar_network_year_links WHERE civil_year = _yr;
  IF _y IS NULL THEN
    _y := public.register_academic_year_version(NULL, NULL, 'Ano letivo ' || _yr, _vf, _vu, true, _vf, NULL, _act);
    INSERT INTO public.calendar_network_year_links(civil_year, academic_year_id) VALUES (_yr, _y);
  END IF;

  SELECT * INTO _link FROM public.calendar_network_source_links WHERE source_key = _source_key;
  IF _link.source_key IS NULL THEN
    IF _expected_base_version_id IS NOT NULL THEN RAISE EXCEPTION 'calendar:base-superseded'; END IF;
    _org := public.register_period_organization_version(NULL, _y, NULL,
      coalesce(nullif(pg_catalog.btrim(_payload->>'title'),''), _source_key), true, _vf, NULL, _act);
  ELSE
    IF _link.academic_year_id <> _y THEN RAISE EXCEPTION 'calendar-save:year-mismatch'; END IF;
    _org := _link.period_organization_id; _cal := _link.calendar_id;
  END IF;

  FOR p IN SELECT e FROM pg_catalog.jsonb_array_elements(coalesce(_payload->'periods','[]'::jsonb)) e LOOP
    _pid := NULL;
    IF _link.source_key IS NOT NULL THEN
      SELECT period_id INTO _pid FROM public.calendar_network_period_links WHERE source_key = _source_key AND period_key = p->>'key';
    END IF;
    IF _pid IS NULL THEN
      _pid := public.register_academic_period_version(NULL, _org, NULL, p->>'name', (p->>'start')::date, (p->>'end')::date, true, _vf, NULL, _act);
    ELSE
      SELECT * INTO _pv FROM public.institutional_academic_period_versions WHERE period_id = _pid ORDER BY version DESC LIMIT 1;
      IF _pv.official_name IS DISTINCT FROM p->>'name' OR _pv.starts_on <> (p->>'start')::date OR _pv.ends_on <> (p->>'end')::date OR NOT _pv.is_active THEN
        PERFORM public.register_academic_period_version(_pid, _org, _pv.id, p->>'name', (p->>'start')::date, (p->>'end')::date, true, _pv.valid_from,
          coalesce(_reason, 'Alteração do período no editor do calendário'), _act);
      END IF;
    END IF;
    _periods := _periods || pg_catalog.jsonb_build_array(_pid);
    _tmap := _tmap || pg_catalog.jsonb_build_object('period:' || (p->>'key'), _pid);
  END LOOP;

  FOR t IN SELECT e FROM pg_catalog.jsonb_array_elements(coalesce(_payload->'dayTypes','[]'::jsonb)) e LOOP
    _eff := CASE WHEN t->'effect' IS NULL OR pg_catalog.jsonb_typeof(t->'effect') = 'null' THEN NULL ELSE (t->>'effect')::boolean END;
    _tid := NULL;
    SELECT day_type_id INTO _tid FROM public.calendar_network_day_type_links WHERE code = t->>'code';
    IF _tid IS NULL THEN
      _r := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', t->>'label', _eff, _act, NULL);
      _tid := _r->>'day_type_id';
      INSERT INTO public.calendar_network_day_type_links(code, day_type_id) VALUES (t->>'code', _tid);
      _tv.id := (_r->>'version_id')::uuid;
    ELSE
      SELECT * INTO _tv FROM public.calendar_day_type_versions WHERE day_type_id = _tid ORDER BY version DESC LIMIT 1;
      IF _tv.label IS DISTINCT FROM pg_catalog.btrim(t->>'label') OR _tv.school_day_effect IS DISTINCT FROM _eff THEN
        _r := public.record_calendar_day_type_version(_tid, _tv.id, 'sucessao', t->>'label', _eff, _act,
          coalesce(_reason, 'Alteração do tipo de dia no editor do calendário'));
        _tv.id := (_r->>'version_id')::uuid;
      END IF;
    END IF;
    _tmap := _tmap || pg_catalog.jsonb_build_object(t->>'code', _tv.id::text);
    _tidmap := _tidmap || pg_catalog.jsonb_build_object(t->>'code', _tid);
    IF coalesce(pg_catalog.btrim(t->>'councilRole'),'') <> '' THEN
      _roles := _roles || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('dayTypeId', _tid, 'role', t->>'councilRole', 'sourceProposal', t->>'code'));
    END IF;
  END LOOP;

  FOR d IN SELECT e FROM pg_catalog.jsonb_array_elements(coalesce(_payload->'days','[]'::jsonb)) e LOOP
    IF _tmap->>(d->>'code') IS NULL THEN RAISE EXCEPTION 'calendar-save:undeclared-type-%', d->>'code'; END IF;
    _days := _days || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('day', d->>'day', 'day_type_version_id', _tmap->>(d->>'code')));
  END LOOP;
  FOR d IN SELECT e FROM pg_catalog.jsonb_array_elements(coalesce(_payload->'events','[]'::jsonb)) e LOOP
    IF _tmap->>(d->>'code') IS NULL THEN RAISE EXCEPTION 'calendar-save:undeclared-type-%', d->>'code'; END IF;
    _events := _events || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('starts_on', d->>'starts_on', 'ends_on', d->>'ends_on',
      'label', d->>'label', 'day_type_version_id', _tmap->>(d->>'code')));
  END LOOP;

  _r := public.record_calendar_version(_cal, _expected_base_version_id, CASE WHEN _cal IS NULL THEN 'constituicao' ELSE 'sucessao' END,
    _y, _org, _vf, _vu, _act, CASE WHEN _cal IS NULL THEN _reason ELSE coalesce(_reason, 'Alteração salva no editor do calendário') END,
    _periods, '[]'::jsonb, _events, _days);
  _vid := (_r->>'version_id')::uuid; _ver := (_r->>'version')::integer;
  IF _cal IS NULL THEN
    _cal := _r->>'calendar_id';
    INSERT INTO public.calendar_network_source_links(source_key, calendar_id, academic_year_id, period_organization_id)
      VALUES (_source_key, _cal, _y, _org);
  END IF;
  FOR p IN SELECT e FROM pg_catalog.jsonb_array_elements(coalesce(_payload->'periods','[]'::jsonb)) e LOOP
    INSERT INTO public.calendar_network_period_links(source_key, period_key, period_id)
      VALUES (_source_key, p->>'key', _tmap->>('period:' || (p->>'key'))) ON CONFLICT (source_key, period_key) DO NOTHING;
  END LOOP;

  INSERT INTO public.calendar_version_context_pending(version_id, reason) VALUES (_vid,
    coalesce(nullif(pg_catalog.btrim(_payload->>'contextPending'),''),
      'Aplicabilidade operacional ainda não declarada: faltam os cadastros (escolas, turmas, alocações) que a definem.'));

  PERFORM public.record_calendar_presentation_snapshot(_vid, coalesce(_payload->>'sourceKind','edicao-institucional'), _source_key,
    _payload->>'sourceEntryId', _payload->>'digest', _payload->'raw',
    coalesce(_payload->'presentation','{}'::jsonb) || pg_catalog.jsonb_build_object('typeMap', _tmap, 'typeIds', _tidmap), NULL);
  PERFORM public.record_calendar_council_configuration(_vid, _roles, _act);

  RETURN pg_catalog.jsonb_build_object('calendarId', _cal, 'versionId', _vid, 'version', _ver, 'academicYearId', _y,
    'periodOrganizationId', _org, 'homologated', false);
END $fn$;
REVOKE ALL ON FUNCTION public.save_network_calendar(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_network_calendar(text, uuid, jsonb) TO authenticated;

CREATE FUNCTION public.homologate_network_calendar(_version_id uuid, _expected_last_homologation_id uuid, _act_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v public.calendar_versions%ROWTYPE; _st text; _r jsonb; _nv uuid;
BEGIN
  PERFORM public.calendar_network_grant('homologar-calendario-da-rede');
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'calendar-homologation:act-required'; END IF;
  SELECT * INTO v FROM public.calendar_versions WHERE id = _version_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'calendar-homologation:version-not-found'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendar-norm-bootstrap', 0));
  SELECT x.state INTO _st FROM public.calendar_composition_norm_state_at(v.valid_from, pg_catalog.clock_timestamp()) x WHERE x.norm_id IS NULL;
  IF _st = 'sem-norma' THEN
    _r := public.record_calendar_composition_norm_version(NULL, NULL, 'constituicao', v.valid_from, NULL, _act_ref,
      'Exclusividade: um único calendário aplicável por contexto (decisão da Supervisão)', 'exigir-exclusividade', '[]'::jsonb,
      '[{"dimensionId":"efeito-dia","effectPrimitive":"school_day_effect","effectContractVersion":1}]'::jsonb);
    _nv := (_r->>'versionId')::uuid;
    PERFORM public.homologate_calendar_composition_norm(_nv, NULL, 'homologada', v.valid_from, _act_ref, NULL);
  END IF;
  RETURN public.homologate_calendar_version(_version_id, _expected_last_homologation_id, 'homologada', v.valid_from, _act_ref, _reason);
END $fn$;
REVOKE ALL ON FUNCTION public.homologate_network_calendar(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.homologate_network_calendar(uuid, uuid, text, text) TO authenticated;

CREATE FUNCTION public.calendar_network_sources_at(_known_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RETURN pg_catalog.jsonb_build_object('contract','b4.6.10/1','state','access-denied'); END IF;
  RETURN pg_catalog.jsonb_build_object('contract','b4.6.10/1','state','lido','sources', coalesce((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('sourceKey', l.source_key, 'calendarId', l.calendar_id) ORDER BY l.source_key)
      FROM public.calendar_network_source_links l
     WHERE l.created_at <= _known_at AND (public.calendar_has_network_capability('construir-calendario-da-rede')
        OR EXISTS (SELECT 1 FROM public.calendar_versions v JOIN public.calendar_version_homologations h ON h.calendar_version_id = v.id
                    WHERE v.calendar_id = l.calendar_id AND h.decision = 'homologada'))), '[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_network_sources_at(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_network_sources_at(timestamptz) TO authenticated;