CREATE OR REPLACE FUNCTION public.record_period_closing_act(
  _scope_key text, _period text, _scope jsonb, _action text,
  _expected_last_event_id uuid, _expected_closing_id uuid,
  _detail text, _justification text, _record jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _class text := split_part(_scope_key, '|', 1);
  _capability text; _cap record; _last record; _closing uuid; _new_closing uuid; _event uuid;
  _used uuid[]; _stage text; _after text; _from text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  _capability := CASE _action
    WHEN 'entrega-docente' THEN 'entregar-pauta-docente'
    WHEN 'inicio-conferencia' THEN 'realizar-conferencia-escolar'
    WHEN 'devolucao-com-apontamentos' THEN 'devolver-pauta-com-apontamentos'
    WHEN 'fechamento-oficial' THEN 'homologar-fechamento-oficial'
    WHEN 'retificacao-pontual' THEN 'executar-retificacao-pos-fechamento'
    WHEN 'reabertura-integral' THEN 'reabrir-periodo-fechado' END;
  IF _capability IS NULL THEN RAISE EXCEPTION 'unknown-action'; END IF;
  SELECT * INTO _cap FROM public.effective_capabilities(current_date) c
   WHERE c.capability_id = _capability
     AND (c.class_id IS NULL OR c.class_id = _class) AND (c.period_id IS NULL OR c.period_id = _period) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  IF _action = 'retificacao-pontual' AND NOT public.has_capability('autorizar-retificacao-pos-fechamento', _class, _period) THEN
    RAISE EXCEPTION 'capability-missing';
  END IF;
  IF _action IN ('devolucao-com-apontamentos','retificacao-pontual','reabertura-integral') AND coalesce(btrim(_justification),'') = '' THEN
    RAISE EXCEPTION 'justification-required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('closing:' || _scope_key));
  SELECT e.* INTO _last FROM public.period_closing_events e WHERE e.scope_key = _scope_key ORDER BY e.sequence DESC LIMIT 1;
  IF _last.id IS DISTINCT FROM _expected_last_event_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  _closing := public.current_closing_id(_scope_key);
  IF _closing IS DISTINCT FROM _expected_closing_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;

  -- Espelho de CLOSING_STAGE_AFTER / CLOSING_STAGE_FROM (period-closing.ts).
  _stage := CASE _last.action
    WHEN 'entrega-docente' THEN 'entregue' WHEN 'inicio-conferencia' THEN 'em-conferencia'
    WHEN 'devolucao-com-apontamentos' THEN 'devolvida-para-ajustes' WHEN 'fechamento-oficial' THEN 'fechado'
    WHEN 'retificacao-pontual' THEN 'fechado' WHEN 'reabertura-integral' THEN 'reaberto'
    ELSE 'em-andamento' END;
  _from := CASE _action
    WHEN 'entrega-docente' THEN ARRAY['em-andamento','devolvida-para-ajustes','reaberto']
    WHEN 'inicio-conferencia' THEN ARRAY['em-andamento','entregue','devolvida-para-ajustes','reaberto']
    WHEN 'devolucao-com-apontamentos' THEN ARRAY['entregue','em-conferencia','reaberto']
    WHEN 'fechamento-oficial' THEN ARRAY['em-andamento','entregue','em-conferencia','devolvida-para-ajustes','reaberto']
    ELSE ARRAY['fechado'] END;
  IF NOT (_stage = ANY(_from)) THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
  IF _action = 'reabertura-integral' AND _closing IS NULL THEN RAISE EXCEPTION 'nothing-to-reopen'; END IF;

  IF _action IN ('fechamento-oficial','retificacao-pontual') THEN
    IF _record IS NULL THEN RAISE EXCEPTION 'record-required'; END IF;
    IF coalesce(_record->>'ruleId','') = '' OR coalesce(_record->>'configurationId','') = '' THEN RAISE EXCEPTION 'rule-required'; END IF;
    SELECT coalesce(array_agg(x::uuid), '{}') INTO _used
      FROM jsonb_array_elements_text(coalesce(_record->'usedEntryVersionIds','[]'::jsonb)) x;
    INSERT INTO public.period_closing_versions (scope_key, class_id, period_id, version_number, preceding_closing_id, record,
      used_entry_version_ids, rule_id, rule_version, configuration_id, configuration_version, revision_kind, justification,
      author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
    VALUES (_scope_key, _class, _period,
      coalesce((SELECT version_number FROM public.period_closing_versions WHERE id = _closing), 0) + 1, _closing,
      _record, _used, _record->>'ruleId', (_record->>'ruleVersion')::int, _record->>'configurationId',
      NULLIF(_record->>'configurationVersion','')::int,
      CASE WHEN _action = 'retificacao-pontual' THEN 'retificacao-pontual' END, NULLIF(btrim(_justification),''),
      auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
    RETURNING id INTO _new_closing;
  ELSIF _record IS NOT NULL THEN
    RAISE EXCEPTION 'record-not-admissible';
  END IF;

  INSERT INTO public.period_closing_events (scope_key, class_id, period_id, sequence, preceding_event_id, action, scope,
    detail, justification, closing_version_id, exercised_capability, author_user_id, author_person_id,
    authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_scope_key, _class, _period, coalesce(_last.sequence, 0) + 1, _last.id, _action, _scope,
    coalesce(_detail,''), NULLIF(btrim(_justification),''), _new_closing, _capability, auth.uid(),
    public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _event;
  RETURN _event;
END $$;