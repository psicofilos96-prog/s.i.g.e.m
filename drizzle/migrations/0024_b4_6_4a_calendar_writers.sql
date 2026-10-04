-- B4.6.4a — Preparação da escrita institucional do Calendário (aditiva; 0023 intacta).
-- Decisão do usuário: a Supervisão Escolar (atuação gestao-pedagogica-da-rede, D4) constrói e homologa o calendário da rede.
-- Regras novas SOMENTE na v2 draft (não homologa política nem concede poder efetivo). v1 intacta.
-- Writers: tipo de dia e conteúdo do calendário. Homologação: contrato com recusa explícita até D5.
-- Readers públicos (calendar_at/calendar_day_at) continuam access-denied: competência de consulta pendente.

-- 1. Regras exatas na v2 draft.
DO $b464p$
DECLARE _v1 uuid; _v2 uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.capability_policies) THEN
    RAISE NOTICE 'b4_6_4a:no-capability-policy-present; rules deferred'; RETURN;
  END IF;
  SELECT id INTO _v1 FROM public.capability_policies
    WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 1 AND status = 'draft' FOR UPDATE;
  SELECT id INTO _v2 FROM public.capability_policies
    WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 2 AND status = 'draft' FOR UPDATE;
  IF _v1 IS NULL OR _v2 IS NULL OR
     (SELECT count(*) FROM public.capability_policies WHERE logical_policy_id = 'politica-capacidades-diario') <> 2
  THEN RAISE EXCEPTION 'b4_6_4a:unexpected-policy-versions'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v1) <> 108 OR
     (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2) <> 117
  THEN RAISE EXCEPTION 'b4_6_4a:unexpected-policy-rule-count'; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policy_rules
             WHERE capability_id IN ('construir-calendario-da-rede','homologar-calendario-da-rede'))
  THEN RAISE EXCEPTION 'b4_6_4a:capability-already-present'; END IF;
  INSERT INTO public.capability_policy_rules (policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (_v2, 'gestao-pedagogica-da-rede', 'construir-calendario-da-rede', ARRAY['network']::text[]),
    (_v2, 'gestao-pedagogica-da-rede', 'homologar-calendario-da-rede', ARRAY['network']::text[]);
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v1) <> 108 OR
     (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = _v2) <> 119 OR
     (SELECT status FROM public.capability_policies WHERE id = _v2) <> 'draft'
  THEN RAISE EXCEPTION 'b4_6_4a:policy-insert-failed'; END IF;
END $b464p$;

-- 2. Atuação que gravou (aditivo, anulável: tabelas vazias; writers sempre preenchem).
ALTER TABLE public.calendar_versions ADD COLUMN recorded_via_engagement_id uuid REFERENCES public.institutional_engagements(id);
ALTER TABLE public.calendar_day_type_versions ADD COLUMN recorded_via_engagement_id uuid REFERENCES public.institutional_engagements(id);

-- 3. Capacidade exata de rede (helper privado; sem EXECUTE para PUBLIC/anon/authenticated).
CREATE FUNCTION public.calendar_network_grant(_cap text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'calendar:session-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
    WHERE c.capability_id = _cap AND c.scope_level = 'rede' ORDER BY c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _cap; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_network_grant(text) FROM PUBLIC, anon, authenticated;

-- 4. Writer de tipo de dia: constituição | sucessão | retificação; base esperada = última versão.
CREATE FUNCTION public.record_calendar_day_type_version(
  _day_type text, _base_version_id uuid, _change_kind text, _label text,
  _school_day_effect boolean, _act_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE g uuid; _tid text; _ver integer; b public.calendar_day_type_versions%ROWTYPE; _vid uuid;
  _l text := nullif(pg_catalog.btrim(coalesce(_label,'')),'');
BEGIN
  g := public.calendar_network_grant('construir-calendario-da-rede');
  IF _l IS NULL THEN RAISE EXCEPTION 'calendar-day-type:label-required'; END IF;
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'calendar-day-type:act-required'; END IF;
  IF _day_type IS NULL THEN
    IF _change_kind IS DISTINCT FROM 'constituicao' OR _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'calendar-day-type:invalid-change-kind'; END IF;
    _tid := 'cdt-' || gen_random_uuid(); _ver := 1;
    INSERT INTO public.calendar_day_types(id) VALUES (_tid);
  ELSE
    IF _change_kind IS NULL OR _change_kind NOT IN ('sucessao','retificacao') THEN RAISE EXCEPTION 'calendar-day-type:invalid-change-kind'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendar-day-type:' || _day_type, 0));
    SELECT * INTO b FROM public.calendar_day_type_versions v WHERE v.day_type_id = _day_type ORDER BY v.version DESC LIMIT 1;
    IF b.id IS NULL THEN RAISE EXCEPTION 'calendar-day-type:not-found'; END IF;
    IF _base_version_id IS DISTINCT FROM b.id THEN RAISE EXCEPTION 'calendar-day-type:base-superseded'; END IF;
    IF coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'calendar-day-type:reason-required'; END IF;
    _tid := _day_type; _ver := b.version + 1;
  END IF;
  INSERT INTO public.calendar_day_type_versions(day_type_id, version, supersedes_id, change_kind, label, school_day_effect,
    originating_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_tid, _ver, b.id, _change_kind, _l, _school_day_effect, pg_catalog.btrim(_act_ref),
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id(), g)
  RETURNING id INTO _vid;
  RETURN pg_catalog.jsonb_build_object('day_type_id', _tid, 'version_id', _vid, 'version', _ver);
END $fn$;
REVOKE ALL ON FUNCTION public.record_calendar_day_type_version(text, uuid, text, text, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_calendar_day_type_version(text, uuid, text, text, boolean, text, text) TO authenticated;

-- 5. Writer do conteúdo: versão + períodos B2.4 + intervalos + eventos + dias, numa transação.
--    Cada filho FIXA uma versão de tipo existente. Gravar NÃO homologa.
CREATE FUNCTION public.record_calendar_version(
  _calendar text, _base_version_id uuid, _change_kind text,
  _academic_year_id text, _period_organization_id text, _valid_from date, _valid_until date,
  _act_ref text, _reason text, _periods jsonb, _ranges jsonb, _events jsonb, _days jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE g uuid; _cid text; _ver integer; b public.calendar_versions%ROWTYPE; _vid uuid; x jsonb; _issue text; _pred_from date; _k text;
BEGIN
  g := public.calendar_network_grant('construir-calendario-da-rede');
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'calendar:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'calendar:ends-before-start'; END IF;
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'calendar:act-required'; END IF;
  FOREACH _k IN ARRAY ARRAY['periods','ranges','events','days'] LOOP
    x := CASE _k WHEN 'periods' THEN _periods WHEN 'ranges' THEN _ranges WHEN 'events' THEN _events ELSE _days END;
    IF x IS NULL OR pg_catalog.jsonb_typeof(x) <> 'array' THEN RAISE EXCEPTION 'calendar:%-required', _k; END IF;
  END LOOP;
  IF _calendar IS NULL THEN
    IF _change_kind IS DISTINCT FROM 'constituicao' OR _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'calendar:invalid-change-kind'; END IF;
    _cid := 'cal-' || gen_random_uuid(); _ver := 1;
    INSERT INTO public.institutional_calendars(id) VALUES (_cid);
  ELSE
    IF _change_kind IS NULL OR _change_kind NOT IN ('sucessao','retificacao') THEN RAISE EXCEPTION 'calendar:invalid-change-kind'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendar:' || _calendar, 0));
    SELECT * INTO b FROM public.calendar_versions v WHERE v.calendar_id = _calendar ORDER BY v.version DESC LIMIT 1;
    IF b.id IS NULL THEN RAISE EXCEPTION 'calendar:not-found'; END IF;
    IF _base_version_id IS DISTINCT FROM b.id THEN RAISE EXCEPTION 'calendar:base-superseded'; END IF;
    IF coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'calendar:reason-required'; END IF;
    IF _change_kind = 'retificacao' THEN
      SELECT p.valid_from INTO _pred_from FROM public.calendar_versions p
       WHERE p.calendar_id = _calendar AND p.version < b.version
         AND NOT EXISTS (SELECT 1 FROM public.calendar_versions r WHERE r.supersedes_id = p.id AND r.change_kind = 'retificacao')
       ORDER BY p.version DESC LIMIT 1;
      IF _pred_from IS NOT NULL AND _valid_from <= _pred_from THEN RAISE EXCEPTION 'calendar:retification-must-start-after-predecessor'; END IF;
    END IF;
    _cid := _calendar; _ver := b.version + 1;
  END IF;

  INSERT INTO public.calendar_versions(calendar_id, version, supersedes_id, change_kind, academic_year_id, period_organization_id,
    valid_from, valid_until, originating_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_cid, _ver, b.id, _change_kind, _academic_year_id, _period_organization_id, _valid_from, _valid_until,
    pg_catalog.btrim(_act_ref), nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id(), g)
  RETURNING id INTO _vid;

  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(_periods) e LOOP
    INSERT INTO public.calendar_version_periods(version_id, period_id) VALUES (_vid, x #>> '{}');
  END LOOP;
  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(_ranges) e LOOP
    INSERT INTO public.calendar_version_ranges(version_id, starts_on, ends_on, day_type_version_id)
    VALUES (_vid, (x->>'starts_on')::date, (x->>'ends_on')::date, (x->>'day_type_version_id')::uuid);
  END LOOP;
  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(_events) e LOOP
    INSERT INTO public.calendar_version_events(version_id, starts_on, ends_on, label, day_type_version_id)
    VALUES (_vid, (x->>'starts_on')::date, (x->>'ends_on')::date, x->>'label', (x->>'day_type_version_id')::uuid);
  END LOOP;
  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(_days) e LOOP
    INSERT INTO public.calendar_version_day_assignments(version_id, day, day_type_version_id)
    VALUES (_vid, (x->>'day')::date, (x->>'day_type_version_id')::uuid);
  END LOOP;

  -- Referência B2.4 íntegra em toda a vigência (ano/organização/períodos ativos; conteúdo dentro do ano).
  _issue := public.calendar_version_reference_issue(_vid, pg_catalog.clock_timestamp());
  IF _issue IS NOT NULL THEN RAISE EXCEPTION 'calendar:reference-%', _issue; END IF;
  RETURN pg_catalog.jsonb_build_object('calendar_id', _cid, 'version_id', _vid, 'version', _ver, 'homologated', false);
END $fn$;
REVOKE ALL ON FUNCTION public.record_calendar_version(text, uuid, text, text, text, date, date, text, text, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_calendar_version(text, uuid, text, text, text, date, date, text, text, jsonb, jsonb, jsonb, jsonb) TO authenticated;

-- 6. Homologação: competência distinta e exata; autorização antes de qualquer consulta (sem oráculo).
--    Integridade do snapshot é validável, mas a aplicabilidade (D5) não existe no esquema: recusa explícita,
--    nunca aprovação de calendário incompleto como operacional. Nada é gravado.
CREATE FUNCTION public.homologate_calendar_version(
  _calendar_version_id uuid, _expected_last_homologation_id uuid, _decision text,
  _effective_from date, _act_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE g uuid; v public.calendar_versions%ROWTYPE; _last uuid; _issue text;
BEGIN
  g := public.calendar_network_grant('homologar-calendario-da-rede');
  IF _decision IS NULL OR _decision NOT IN ('homologada','revogada') THEN RAISE EXCEPTION 'calendar-homologation:invalid-decision'; END IF;
  IF _effective_from IS NULL THEN RAISE EXCEPTION 'calendar-homologation:effective-from-required'; END IF;
  IF coalesce(pg_catalog.btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'calendar-homologation:act-required'; END IF;
  SELECT * INTO v FROM public.calendar_versions WHERE id = _calendar_version_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'calendar-homologation:version-not-found'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendar-homologation:' || v.id::text, 0));
  SELECT h.id INTO _last FROM public.calendar_version_homologations h WHERE h.calendar_version_id = v.id ORDER BY h.sequence DESC LIMIT 1;
  IF _last IS DISTINCT FROM _expected_last_homologation_id THEN RAISE EXCEPTION 'calendar-homologation:base-superseded'; END IF;
  _issue := public.calendar_version_reference_issue(v.id, pg_catalog.clock_timestamp());
  IF _issue IS NOT NULL THEN RAISE EXCEPTION 'calendar-homologation:snapshot-%', _issue; END IF;
  RAISE EXCEPTION 'calendar-homologation:blocked-applicability-undeclared-d5';
END $fn$;
REVOKE ALL ON FUNCTION public.homologate_calendar_version(uuid, uuid, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.homologate_calendar_version(uuid, uuid, text, date, text, text) TO authenticated;
