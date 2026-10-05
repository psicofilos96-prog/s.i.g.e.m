ALTER TABLE public.assessment_instruments ADD COLUMN IF NOT EXISTS assignment_id text;
ALTER TABLE public.assessment_instruments ADD COLUMN IF NOT EXISTS planned_on date;
ALTER TABLE public.assessment_instruments ADD COLUMN IF NOT EXISTS reference_item_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.assessment_instruments ADD COLUMN IF NOT EXISTS contract text;
ALTER TABLE public.assessment_instrument_status_events ADD COLUMN IF NOT EXISTS applied_on date;
COMMENT ON COLUMN public.assessment_instruments.assignment_id IS 'AA: atribuição docente canônica (teaching_assignments.id) do instrumento; nulo = legado sem contrato aa/1.';
COMMENT ON COLUMN public.assessment_instrument_status_events.applied_on IS 'AA: data institucional em que o instrumento foi aplicado; elegibilidade dos estudantes usa esta data.';

CREATE OR REPLACE FUNCTION public.create_assessment_instrument_v2(_id text, _assignment text, _period text, _instrument_type text,
  _definition jsonb, _planned_on date, _references uuid[])
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a record; _k timestamptz := pg_catalog.now(); _per record; _cap record;
BEGIN
  IF coalesce(pg_catalog.btrim(_id),'') = '' OR coalesce(pg_catalog.btrim(_instrument_type),'') = '' THEN RAISE EXCEPTION 'aa:instrument-fields-required'; END IF;
  IF _definition IS NOT NULL AND pg_catalog.jsonb_typeof(_definition) <> 'object' THEN RAISE EXCEPTION 'aa:invalid-definition'; END IF;
  SELECT * INTO a FROM public.diary_teacher_actor(_assignment, NULL, _planned_on, 'cadastrar-instrumento-avaliativo');
  SELECT * INTO _per FROM public.institutional_academic_periods p WHERE p.id = _period AND p.academic_year_id = a.academic_year_id;
  IF _per IS NULL OR _planned_on < _per.starts_on OR _planned_on > _per.ends_on THEN RAISE EXCEPTION 'aa:period-mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.unnest(coalesce(_references,'{}'::uuid[])) r(id)
             WHERE NOT EXISTS (SELECT 1 FROM public.curricular_reference_items i WHERE i.id = r.id)) THEN RAISE EXCEPTION 'aa:reference-unknown'; END IF;
  IF EXISTS (SELECT 1 FROM public.assessment_instruments WHERE id = _id) THEN RAISE EXCEPTION 'aa:instrument-exists'; END IF;
  INSERT INTO public.assessment_instruments(id, class_id, period_id, instrument_type_id, definition, author_user_id, author_person_id,
    authorizing_engagement_id, capability_policy_id, capability_policy_version, assignment_id, planned_on, reference_item_ids, contract)
  VALUES (_id, a.class_id, _period, _instrument_type, coalesce(_definition,'{}'), auth.uid(), public.current_person_id(),
    a.engagement_id, a.policy_id, a.policy_version, _assignment, _planned_on, ARRAY(SELECT DISTINCT x FROM pg_catalog.unnest(coalesce(_references,'{}'::uuid[])) x), 'aa/1');
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.apply_assessment_instrument_v2(_instrument text, _expected_last_event_id uuid, _applied_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _ins record; a record; _last record; _id uuid; _per record;
BEGIN
  SELECT * INTO _ins FROM public.assessment_instruments WHERE id = _instrument;
  IF _ins IS NULL OR _ins.contract IS DISTINCT FROM 'aa/1' THEN RAISE EXCEPTION 'aa:instrument-not-aa'; END IF;
  SELECT * INTO a FROM public.diary_teacher_actor(_ins.assignment_id, NULL, _applied_on, 'cadastrar-instrumento-avaliativo');
  SELECT * INTO _per FROM public.institutional_academic_periods p WHERE p.id = _ins.period_id;
  IF _applied_on < _per.starts_on OR _applied_on > _per.ends_on THEN RAISE EXCEPTION 'aa:applied-outside-period'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('instrument-status:' || _instrument));
  SELECT * INTO _last FROM public.assessment_instrument_status_events WHERE instrument_id = _instrument ORDER BY sequence DESC LIMIT 1;
  IF _last.id IS DISTINCT FROM _expected_last_event_id THEN RAISE EXCEPTION 'aa:stale-head'; END IF;
  IF _last.status = 'aplicado' THEN RAISE EXCEPTION 'aa:already-applied'; END IF;
  INSERT INTO public.assessment_instrument_status_events (instrument_id, sequence, preceding_event_id, status, author_user_id, author_person_id,
    authorizing_engagement_id, capability_policy_id, capability_policy_version, applied_on)
  VALUES (_instrument, coalesce(_last.sequence,0)+1, _last.id, 'aplicado', auth.uid(), public.current_person_id(), a.engagement_id, a.policy_id, a.policy_version, _applied_on)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.register_assessment_results_v2(_instrument text, _plan_id text, _configuration_id text, _configuration_version integer,
  _expected_closing_id uuid, _operations jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _ins record; a record; _applied date; _op jsonb; _school text;
BEGIN
  SELECT * INTO _ins FROM public.assessment_instruments WHERE id = _instrument;
  IF _ins IS NULL OR _ins.contract IS DISTINCT FROM 'aa/1' THEN RAISE EXCEPTION 'aa:instrument-not-aa'; END IF;
  -- aplicado ≠ lançado: resultado só existe após aplicação registrada, na data da aplicação.
  SELECT e.applied_on INTO _applied FROM public.assessment_instrument_status_events e WHERE e.instrument_id = _instrument AND e.status = 'aplicado'
   ORDER BY e.sequence DESC LIMIT 1;
  IF _applied IS NULL THEN RAISE EXCEPTION 'aa:instrument-not-applied'; END IF;
  SELECT * INTO a FROM public.diary_teacher_actor(_ins.assignment_id, NULL, _applied, 'registrar-resultado-avaliativo');
  IF pg_catalog.jsonb_typeof(_operations) <> 'array' OR pg_catalog.jsonb_array_length(_operations) = 0 THEN RAISE EXCEPTION 'aa:empty-batch'; END IF;
  FOR _op IN SELECT * FROM pg_catalog.jsonb_array_elements(_operations) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.class_allocations_at(a.school_id, a.class_id, _applied, pg_catalog.now()) al
                   WHERE al.student_id = _op->>'studentId' AND al.valid_from <= _applied AND (al.ended_on IS NULL OR al.ended_on >= _applied))
      THEN RAISE EXCEPTION 'aa:student-not-allocated-on-date:%', _op->>'studentId'; END IF;
  END LOOP;
  RETURN public.register_assessment_results(_instrument, _plan_id, _configuration_id, _configuration_version, _expected_closing_id, _operations);
END $$;

REVOKE ALL ON FUNCTION public.create_assessment_instrument_v2(text,text,text,text,jsonb,date,uuid[]) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.apply_assessment_instrument_v2(text,uuid,date) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.register_assessment_results_v2(text,text,text,integer,uuid,jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_assessment_instrument_v2(text,text,text,text,jsonb,date,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_assessment_instrument_v2(text,uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_assessment_results_v2(text,text,text,integer,uuid,jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_assessment_instrument(text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.apply_assessment_instrument(text,uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.register_assessment_results(text,text,text,integer,uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.register_assessment_results(text,text,text,integer,uuid,jsonb) IS 'AA: chamada só por register_assessment_results_v2 (gates de atribuição, aplicação e alocação na data).';
COMMENT ON FUNCTION public.create_assessment_instrument(text,text,text,text,jsonb) IS 'DEPRECATED: substituída por create_assessment_instrument_v2';
COMMENT ON FUNCTION public.apply_assessment_instrument(text,uuid) IS 'DEPRECATED: substituída por apply_assessment_instrument_v2';

REVOKE EXECUTE ON FUNCTION public.record_period_closing_act(text,text,jsonb,text,uuid,uuid,text,text,jsonb) FROM PUBLIC, anon, service_role;
REVOKE EXECUTE ON FUNCTION public.register_academic_standings(text,text,text,jsonb) FROM PUBLIC, anon, service_role;
DO $$ DECLARE f regprocedure; BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('record_collegial_deliberation','close_collegial_minute','record_collegial_session_event') LOOP
    EXECUTE pg_catalog.format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, service_role', f);
  END LOOP; END $$;