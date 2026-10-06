CREATE OR REPLACE FUNCTION public.register_assessment_results(_instrument text, _plan_id text, _configuration_id text, _configuration_version integer, _expected_closing_id uuid, _operations jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ins record; _cap record; _op jsonb; _current record; _logical text; _student text;
  _problem text; _new uuid; _ids uuid[] := '{}'; _act uuid; _existing uuid; _closing uuid;
  _rect jsonb; _on date; _pol record; _pol_count int; _code text; _satisfied text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  SELECT * INTO _ins FROM public.assessment_instruments WHERE id = _instrument;
  IF NOT FOUND THEN RAISE EXCEPTION 'instrument-not-found'; END IF;
  -- AA.1: autorização e política na data da aplicação registrada, nunca no relógio civil.
  SELECT e.applied_on INTO _on FROM public.assessment_instrument_status_events e
   WHERE e.instrument_id = _instrument AND e.status = 'aplicado' ORDER BY e.sequence DESC LIMIT 1;
  IF _on IS NULL THEN RAISE EXCEPTION 'aa:instrument-not-applied'; END IF;
  SELECT * INTO _cap FROM public.effective_capabilities(_on) c
   WHERE c.capability_id = 'registrar-resultado-avaliativo'
     AND (c.class_id IS NULL OR c.class_id = _ins.class_id) AND (c.period_id IS NULL OR c.period_id = _ins.period_id) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  IF jsonb_typeof(_operations) <> 'array' OR jsonb_array_length(_operations) = 0 THEN RAISE EXCEPTION 'empty-batch'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('pauta:' || _instrument));
  PERFORM pg_advisory_xact_lock(hashtext('closing-class:' || _ins.class_id || '|' || _ins.period_id));
  IF EXISTS (SELECT 1 FROM public.assessment_entry_batch_acts WHERE plan_id = _plan_id AND author_user_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'plan-conflict'; END IF;
  SELECT id INTO _existing FROM public.assessment_entry_batch_acts WHERE plan_id = _plan_id AND author_user_id = auth.uid();
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  _closing := public.current_closing_for_instrument(_instrument);
  IF _closing IS DISTINCT FROM _expected_closing_id THEN RAISE EXCEPTION 'closing-changed'; END IF;

  FOR _op IN SELECT * FROM jsonb_array_elements(_operations) LOOP
    _student := _op->>'studentId';
    IF coalesce(_student,'') = '' THEN RAISE EXCEPTION 'student-required'; END IF;
    _logical := 'res-' || _instrument || '-' || _student;
    _problem := public.assessment_value_problem(_op->'value');
    IF _problem IS NOT NULL THEN RAISE EXCEPTION '%:%', _problem, _student; END IF;
    SELECT v.* INTO _current FROM public.assessment_entry_versions v
     WHERE v.logical_entry_id = _logical
       AND NOT EXISTS (SELECT 1 FROM public.assessment_entry_versions s WHERE s.supersedes_version_id = v.id);
    IF _current.id IS DISTINCT FROM NULLIF(_op->>'expectedBaseVersionId','')::uuid THEN
      RAISE EXCEPTION 'concurrent-change:%', _student;
    END IF;
    _rect := NULL;
    IF _current.id IS NOT NULL THEN
      _rect := _op->'rectification';
      IF _rect IS NULL OR jsonb_typeof(_rect) <> 'object' THEN RAISE EXCEPTION 'rectification-act-required:%', _student; END IF;
      IF _current.value = _op->'value' AND _current.origin = coalesce(_op->>'origin','diario') THEN
        RAISE EXCEPTION 'no-change:%', _student;
      END IF;
      SELECT count(*) INTO _pol_count FROM public.assessment_correction_policies p
       WHERE p.status = 'homologated' AND (p.class_id IS NULL OR p.class_id = _ins.class_id)
         AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
         AND (p.applies_when_period_closing = 'any'
              OR (p.applies_when_period_closing = 'present' AND _closing IS NOT NULL)
              OR (p.applies_when_period_closing = 'absent' AND _closing IS NULL));
      IF _pol_count = 0 THEN RAISE EXCEPTION 'correction-policy-missing:%', _student; END IF;
      IF _pol_count > 1 THEN RAISE EXCEPTION 'correction-policy-ambiguous:%', _student; END IF;
      SELECT p.* INTO _pol FROM public.assessment_correction_policies p
       WHERE p.status = 'homologated' AND (p.class_id IS NULL OR p.class_id = _ins.class_id)
         AND (p.valid_from IS NULL OR p.valid_from <= _on) AND (p.valid_until IS NULL OR p.valid_until >= _on)
         AND (p.applies_when_period_closing = 'any'
              OR (p.applies_when_period_closing = 'present' AND _closing IS NOT NULL)
              OR (p.applies_when_period_closing = 'absent' AND _closing IS NULL));
      IF _pol.logical_policy_id IS DISTINCT FROM _rect->>'policyId' OR _pol.version::text IS DISTINCT FROM _rect->>'policyVersion' THEN
        RAISE EXCEPTION 'correction-policy-changed:%', _student;
      END IF;
      IF _pol.outcome = 'forbidden' THEN RAISE EXCEPTION 'correction-forbidden:%', _student; END IF;
      IF _pol.admissible_value_kinds IS NOT NULL AND NOT ((_op->'value'->>'kind') = ANY(_pol.admissible_value_kinds)) THEN
        RAISE EXCEPTION 'value-kind-not-admissible:%', _student;
      END IF;
      FOREACH _code IN ARRAY _pol.required_capabilities LOOP
        IF NOT EXISTS (SELECT 1 FROM public.effective_capabilities(_on) x WHERE x.capability_id = _code AND (x.class_id IS NULL OR x.class_id = _ins.class_id) AND (x.period_id IS NULL OR x.period_id = _ins.period_id)) THEN RAISE EXCEPTION 'capability-missing:%', _student; END IF;
      END LOOP;
      SELECT coalesce(array_agg(x->>'code'), '{}') INTO _satisfied
        FROM jsonb_array_elements(coalesce(_rect->'satisfiedRequirements','[]'::jsonb)) x;
      FOREACH _code IN ARRAY _pol.requirement_codes LOOP
        IF NOT (_code = ANY(_satisfied)) THEN RAISE EXCEPTION 'requirement-unsatisfied:%', _student; END IF;
        IF _code = 'justificativa' AND coalesce(btrim(_rect->>'justification'),'') = '' THEN
          RAISE EXCEPTION 'justification-required:%', _student;
        END IF;
      END LOOP;
      _rect := _rect || jsonb_build_object('actedAt', now(), 'agentId', public.current_person_id(),
        'consultedClosingId', _closing, 'exercisedCapabilities', to_jsonb(_pol.required_capabilities));
    END IF;
    INSERT INTO public.assessment_entry_versions (
      logical_entry_id, version_number, supersedes_version_id, instrument_id, student_id, class_id, period_id,
      placement, value, value_label, origin, origin_metadata, rectification, batch_plan_id, consulted_closing_id,
      author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
    VALUES (_logical, coalesce(_current.version_number,0) + 1, _current.id, _instrument, _student, _ins.class_id, _ins.period_id,
      coalesce(_op->'placement','{}'::jsonb), _op->'value', NULLIF(_op->>'valueLabel',''),
      coalesce(_op->>'origin','diario'), coalesce(_op->'originMetadata','{}'::jsonb), _rect, _plan_id, _closing,
      auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
    RETURNING id INTO _new;
    _ids := _ids || _new;
  END LOOP;

  INSERT INTO public.assessment_entry_batch_acts (plan_id, instrument_id, class_id, period_id, configuration_id,
    configuration_version, version_ids, consulted_closing_id, author_user_id, author_person_id, authorizing_engagement_id,
    capability_policy_id, capability_policy_version)
  VALUES (_plan_id, _instrument, _ins.class_id, _ins.period_id, _configuration_id, _configuration_version, _ids, _closing,
    auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _act;
  RETURN _act;
END $function$;
COMMENT ON FUNCTION public.register_assessment_results(text,text,text,integer,uuid,jsonb) IS 'AA.2: capacidades exigidas pela política de correção avaliadas na data da aplicação; chamada só por register_assessment_results_v2.';
REVOKE ALL ON FUNCTION public.register_assessment_results(text,text,text,integer,uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;