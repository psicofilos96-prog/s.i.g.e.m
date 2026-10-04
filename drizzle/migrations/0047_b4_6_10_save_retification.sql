-- B4.6.10: alteração do documento anual é retificação da versão vigente (mesma vigência), não sucessão com início posterior.
CREATE OR REPLACE FUNCTION public.save_network_calendar(_source_key text, _expected_base_version_id uuid, _payload jsonb)
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

  _r := public.record_calendar_version(_cal, _expected_base_version_id, CASE WHEN _cal IS NULL THEN 'constituicao' ELSE 'retificacao' END,
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
