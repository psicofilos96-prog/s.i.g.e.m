-- Frente AA.2 — conclusão da Avaliação/Fechamento 2027 (aditivo).
-- Relógio civil eliminado: writers datados (_effective_on/_reference_on); período pela versão vigente; completude explicável,
-- conferência versionada com fingerprint calculado no banco, oficialização só com competência homologada, publicação aguardando regra.

CREATE OR REPLACE FUNCTION public.aa_period_window(_period text, _known_at timestamptz, OUT starts_on date, OUT ends_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT v.starts_on, v.ends_on FROM public.institutional_academic_period_versions v
   WHERE v.period_id = _period AND v.created_at <= _known_at ORDER BY v.version DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.create_assessment_instrument_v2(_id text, _assignment text, _period text, _instrument_type text,
  _definition jsonb, _planned_on date, _references uuid[])
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a record; _per record; _w record;
BEGIN
  IF coalesce(pg_catalog.btrim(_id),'') = '' OR coalesce(pg_catalog.btrim(_instrument_type),'') = '' THEN RAISE EXCEPTION 'aa:instrument-fields-required'; END IF;
  IF _planned_on IS NULL THEN RAISE EXCEPTION 'aa:planned-date-required'; END IF;
  IF _definition IS NOT NULL AND pg_catalog.jsonb_typeof(_definition) <> 'object' THEN RAISE EXCEPTION 'aa:invalid-definition'; END IF;
  SELECT * INTO a FROM public.diary_teacher_actor(_assignment, NULL, _planned_on, 'cadastrar-instrumento-avaliativo');
  SELECT * INTO _per FROM public.institutional_academic_periods p WHERE p.id = _period AND p.academic_year_id = a.academic_year_id;
  SELECT * INTO _w FROM public.aa_period_window(_period, pg_catalog.now());
  IF _per IS NULL OR _w.starts_on IS NULL OR _planned_on < _w.starts_on OR _planned_on > _w.ends_on THEN RAISE EXCEPTION 'aa:period-mismatch'; END IF;
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
DECLARE _ins record; a record; _last record; _id uuid; _w record;
BEGIN
  IF _applied_on IS NULL THEN RAISE EXCEPTION 'aa:applied-date-required'; END IF;
  SELECT * INTO _ins FROM public.assessment_instruments WHERE id = _instrument;
  IF _ins IS NULL OR _ins.contract IS DISTINCT FROM 'aa/1' THEN RAISE EXCEPTION 'aa:instrument-not-aa'; END IF;
  SELECT * INTO a FROM public.diary_teacher_actor(_ins.assignment_id, NULL, _applied_on, 'cadastrar-instrumento-avaliativo');
  SELECT * INTO _w FROM public.aa_period_window(_ins.period_id, pg_catalog.now());
  IF _w.starts_on IS NULL OR _applied_on < _w.starts_on OR _applied_on > _w.ends_on THEN RAISE EXCEPTION 'aa:applied-outside-period'; END IF;
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

-- Completude explicável (sem autorização; uso interno). Ausência de lançamento ≠ zero ≠ "não registrado" explícito.
CREATE OR REPLACE FUNCTION public.aa_instrument_completeness_internal(_instrument text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _ins record; _ev record; _school text; _elig text[]; _heads jsonb; _missing text[]; _inel text[]; _reg int; _nr int; _fp text; _state text;
BEGIN
  SELECT * INTO _ins FROM public.assessment_instruments WHERE id = _instrument;
  IF _ins IS NULL THEN RETURN pg_catalog.jsonb_build_object('state','indisponivel','reason','instrument-unknown'); END IF;
  SELECT * INTO _ev FROM public.assessment_instrument_status_events e WHERE e.instrument_id = _instrument ORDER BY e.sequence DESC LIMIT 1;
  IF _ev IS NULL OR _ev.status <> 'aplicado' OR _ev.applied_on IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('state','indisponivel','reason','not-applied','instrument_id',_instrument); END IF;
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _ins.class_id;
  SELECT coalesce(pg_catalog.array_agg(DISTINCT al.student_id ORDER BY al.student_id), '{}') INTO _elig
    FROM public.class_allocations_at(_school, _ins.class_id, _ev.applied_on, pg_catalog.now()) al
   WHERE al.valid_from <= _ev.applied_on AND (al.ended_on IS NULL OR al.ended_on >= _ev.applied_on);
  SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('student_id', v.student_id, 'version_id', v.id, 'kind', v.value->>'kind') ORDER BY v.student_id, v.id), '[]')
    INTO _heads FROM public.assessment_entry_versions v
   WHERE v.instrument_id = _instrument AND NOT EXISTS (SELECT 1 FROM public.assessment_entry_versions s WHERE s.supersedes_version_id = v.id);
  SELECT coalesce(pg_catalog.array_agg(x ORDER BY x), '{}') INTO _missing FROM pg_catalog.unnest(_elig) x
   WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(_heads) h WHERE h->>'student_id' = x);
  SELECT coalesce(pg_catalog.array_agg(DISTINCT h->>'student_id'), '{}') INTO _inel FROM pg_catalog.jsonb_array_elements(_heads) h WHERE NOT (h->>'student_id' = ANY(_elig));
  SELECT count(*) FILTER (WHERE h->>'kind' IS DISTINCT FROM 'nao-registrado'), count(*) FILTER (WHERE h->>'kind' = 'nao-registrado')
    INTO _reg, _nr FROM pg_catalog.jsonb_array_elements(_heads) h;
  _fp := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'instrument', _ins.id, 'definition', _ins.definition, 'planned_on', _ins.planned_on, 'period', _ins.period_id, 'assignment', _ins.assignment_id,
      'status_event', _ev.id, 'applied_on', _ev.applied_on, 'eligible', pg_catalog.to_jsonb(_elig), 'heads', _heads)::text, 'UTF8'), 'sha256'), 'hex');
  _state := CASE WHEN pg_catalog.cardinality(_missing) > 0 OR pg_catalog.cardinality(_inel) > 0 THEN 'incompleto' ELSE 'completo' END;
  RETURN pg_catalog.jsonb_build_object('state', _state, 'instrument_id', _instrument, 'applied_on', _ev.applied_on, 'planned_on', _ins.planned_on,
    'eligible_count', pg_catalog.cardinality(_elig), 'recorded_count', _reg, 'explicit_not_recorded_count', _nr,
    'missing_student_ids', pg_catalog.to_jsonb(_missing), 'ineligible_result_student_ids', pg_catalog.to_jsonb(_inel), 'fingerprint', _fp);
END $$;

CREATE OR REPLACE FUNCTION public.assessment_instrument_completeness(_instrument text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _ins record; _on date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'aa:no-session'; END IF;
  SELECT * INTO _ins FROM public.assessment_instruments WHERE id = _instrument;
  IF _ins IS NULL THEN RETURN pg_catalog.jsonb_build_object('state','indisponivel','reason','access-denied'); END IF;
  SELECT e.applied_on INTO _on FROM public.assessment_instrument_status_events e WHERE e.instrument_id = _instrument ORDER BY e.sequence DESC LIMIT 1;
  _on := coalesce(_on, _ins.planned_on);
  IF NOT EXISTS (SELECT 1 FROM public.my_teaching_assignments_at(_on, pg_catalog.now()) t WHERE t.assignment_id = _ins.assignment_id)
     AND NOT EXISTS (SELECT 1 FROM public.effective_capabilities(_on) c WHERE c.capability_id = 'realizar-conferencia-escolar' AND (c.class_id IS NULL OR c.class_id = _ins.class_id))
    THEN RETURN pg_catalog.jsonb_build_object('state','indisponivel','reason','access-denied'); END IF;
  RETURN public.aa_instrument_completeness_internal(_instrument);
END $$;

CREATE TABLE public.assessment_instrument_conferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id text NOT NULL REFERENCES public.assessment_instruments(id),
  sequence int NOT NULL CHECK (sequence >= 1),
  preceding_id uuid REFERENCES public.assessment_instrument_conferences(id),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  snapshot jsonb NOT NULL,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, authorizing_engagement_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instrument_id, sequence), UNIQUE (preceding_id), CHECK ((sequence = 1) = (preceding_id IS NULL))
);
ALTER TABLE public.assessment_instrument_conferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assessment_instrument_conferences FROM anon, authenticated, service_role;

CREATE TABLE public.assessment_result_officializations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id text NOT NULL REFERENCES public.assessment_instruments(id),
  sequence int NOT NULL CHECK (sequence >= 1),
  preceding_id uuid REFERENCES public.assessment_result_officializations(id),
  conference_id uuid NOT NULL REFERENCES public.assessment_instrument_conferences(id),
  fingerprint text NOT NULL,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, authorizing_engagement_id uuid NOT NULL,
  capability_policy_id uuid NOT NULL, capability_policy_version int NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instrument_id, sequence), UNIQUE (preceding_id), CHECK ((sequence = 1) = (preceding_id IS NULL))
);
ALTER TABLE public.assessment_result_officializations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assessment_result_officializations FROM anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.aa_ledger_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'aa:append-only'; END $$;
CREATE TRIGGER aic_ao BEFORE UPDATE OR DELETE ON public.assessment_instrument_conferences FOR EACH ROW EXECUTE FUNCTION public.aa_ledger_append_only();
CREATE TRIGGER aic_tr BEFORE TRUNCATE ON public.assessment_instrument_conferences EXECUTE FUNCTION public.aa_ledger_append_only();
CREATE TRIGGER aro_ao BEFORE UPDATE OR DELETE ON public.assessment_result_officializations FOR EACH ROW EXECUTE FUNCTION public.aa_ledger_append_only();
CREATE TRIGGER aro_tr BEFORE TRUNCATE ON public.assessment_result_officializations EXECUTE FUNCTION public.aa_ledger_append_only();

CREATE OR REPLACE FUNCTION public.aa_conference_state(_instrument text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _c record; _now jsonb;
BEGIN
  SELECT * INTO _c FROM public.assessment_instrument_conferences WHERE instrument_id = _instrument ORDER BY sequence DESC LIMIT 1;
  IF _c IS NULL THEN RETURN 'sem-conferencia'; END IF;
  _now := public.aa_instrument_completeness_internal(_instrument);
  RETURN CASE WHEN _now->>'fingerprint' = _c.fingerprint AND _now->>'state' = 'completo' THEN 'vigente' ELSE 'requer-reconferencia' END;
END $$;

CREATE OR REPLACE FUNCTION public.record_assessment_conference(_instrument text, _expected_head uuid, _expected_fingerprint text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _ins record; _on date; a record; _snap jsonb; _last record; _id uuid; _person uuid := public.current_person_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'aa:no-session'; END IF;
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'aa:natural-person-required'; END IF;
  SELECT * INTO _ins FROM public.assessment_instruments WHERE id = _instrument;
  IF _ins IS NULL OR _ins.contract IS DISTINCT FROM 'aa/1' THEN RAISE EXCEPTION 'aa:instrument-not-aa'; END IF;
  SELECT e.applied_on INTO _on FROM public.assessment_instrument_status_events e WHERE e.instrument_id = _instrument AND e.status = 'aplicado' ORDER BY e.sequence DESC LIMIT 1;
  IF _on IS NULL THEN RAISE EXCEPTION 'aa:instrument-not-applied'; END IF;
  SELECT * INTO a FROM public.diary_teacher_actor(_ins.assignment_id, NULL, _on, 'registrar-resultado-avaliativo');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('aa-conference:' || _instrument));
  SELECT * INTO _last FROM public.assessment_instrument_conferences WHERE instrument_id = _instrument ORDER BY sequence DESC LIMIT 1;
  IF _last.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'aa:stale-head'; END IF;
  _snap := public.aa_instrument_completeness_internal(_instrument);
  IF _snap->>'state' <> 'completo' THEN RAISE EXCEPTION 'aa:incomplete'; END IF;
  IF _snap->>'fingerprint' IS DISTINCT FROM _expected_fingerprint THEN RAISE EXCEPTION 'aa:fingerprint-changed'; END IF;
  IF _last.id IS NOT NULL AND _last.fingerprint = _snap->>'fingerprint' THEN RAISE EXCEPTION 'aa:already-conferred'; END IF;
  INSERT INTO public.assessment_instrument_conferences(instrument_id, sequence, preceding_id, fingerprint, snapshot, author_user_id, author_person_id, authorizing_engagement_id)
  VALUES (_instrument, coalesce(_last.sequence,0)+1, _last.id, _snap->>'fingerprint', _snap, auth.uid(), _person, a.engagement_id)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_assessment_officialization(_instrument text, _conference_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _ins record; _on date; _cap record; _c record; _last record; _id uuid; _person uuid := public.current_person_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'aa:no-session'; END IF;
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'aa:natural-person-required'; END IF;
  SELECT * INTO _ins FROM public.assessment_instruments WHERE id = _instrument;
  IF _ins IS NULL OR _ins.contract IS DISTINCT FROM 'aa/1' THEN RAISE EXCEPTION 'aa:instrument-not-aa'; END IF;
  SELECT e.applied_on INTO _on FROM public.assessment_instrument_status_events e WHERE e.instrument_id = _instrument AND e.status = 'aplicado' ORDER BY e.sequence DESC LIMIT 1;
  IF _on IS NULL THEN RAISE EXCEPTION 'aa:instrument-not-applied'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.capability_policy_rules r JOIN public.capability_policies p ON p.id = r.policy_id
                  WHERE p.status = 'homologated' AND r.capability_id = 'oficializar-resultado-avaliativo')
    THEN RAISE EXCEPTION 'aa:officialization-competence-unhomologated'; END IF;
  SELECT * INTO _cap FROM public.effective_capabilities(_on) c WHERE c.capability_id = 'oficializar-resultado-avaliativo'
     AND c.policy_id IS NOT NULL AND (c.class_id IS NULL OR c.class_id = _ins.class_id) LIMIT 1;
  IF _cap IS NULL THEN RAISE EXCEPTION 'aa:capability-missing'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('aa-official:' || _instrument));
  SELECT * INTO _c FROM public.assessment_instrument_conferences WHERE instrument_id = _instrument ORDER BY sequence DESC LIMIT 1;
  IF _c.id IS DISTINCT FROM _conference_id OR public.aa_conference_state(_instrument) <> 'vigente' THEN RAISE EXCEPTION 'aa:conference-not-current'; END IF;
  SELECT * INTO _last FROM public.assessment_result_officializations WHERE instrument_id = _instrument ORDER BY sequence DESC LIMIT 1;
  INSERT INTO public.assessment_result_officializations(instrument_id, sequence, preceding_id, conference_id, fingerprint, author_user_id, author_person_id,
    authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_instrument, coalesce(_last.sequence,0)+1, _last.id, _c.id, _c.fingerprint, auth.uid(), _person, _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.assessment_instrument_governance_state(_instrument text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _comp jsonb; _c record; _o record;
BEGIN
  _comp := public.assessment_instrument_completeness(_instrument);
  IF _comp->>'reason' = 'access-denied' THEN RETURN _comp; END IF;
  SELECT * INTO _c FROM public.assessment_instrument_conferences WHERE instrument_id = _instrument ORDER BY sequence DESC LIMIT 1;
  SELECT * INTO _o FROM public.assessment_result_officializations WHERE instrument_id = _instrument ORDER BY sequence DESC LIMIT 1;
  RETURN pg_catalog.jsonb_build_object('completeness', _comp, 'conference_state', public.aa_conference_state(_instrument),
    'conference_id', _c.id, 'conference_sequence', _c.sequence,
    'official', CASE WHEN _o.id IS NULL THEN 'nao-oficializado' WHEN _o.fingerprint = _comp->>'fingerprint' THEN 'oficializado' ELSE 'oficial-superado-por-alteracao' END,
    'officialization_competence', CASE WHEN EXISTS (SELECT 1 FROM public.capability_policy_rules r JOIN public.capability_policies p ON p.id = r.policy_id
        WHERE p.status = 'homologated' AND r.capability_id = 'oficializar-resultado-avaliativo') THEN 'homologada' ELSE 'nao-homologada' END,
    'publication', 'aguardando-regra-homologada',
    'calculation', 'bloqueado-sem-regra-homologada');
END $$;

CREATE OR REPLACE FUNCTION public.record_period_closing_act_v2(_scope_key text, _period text, _scope jsonb, _action text, _expected_last_event_id uuid, _expected_closing_id uuid, _detail text, _justification text, _record jsonb, _effective_on date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  _class text := split_part(_scope_key, '|', 1);
  _capability text; _cap record; _last record; _closing uuid; _new_closing uuid; _event uuid;
  _used uuid[]; _stage text; _after text; _from text[]; _win record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF _effective_on IS NULL THEN RAISE EXCEPTION 'closing:effective-date-required'; END IF;
  SELECT * INTO _win FROM public.aa_period_window(_period, pg_catalog.now());
  IF _win.starts_on IS NULL OR _effective_on < _win.starts_on THEN RAISE EXCEPTION 'closing:effective-outside-period'; END IF;
  _capability := CASE _action
    WHEN 'entrega-docente' THEN 'entregar-pauta-docente'
    WHEN 'inicio-conferencia' THEN 'realizar-conferencia-escolar'
    WHEN 'devolucao-com-apontamentos' THEN 'devolver-pauta-com-apontamentos'
    WHEN 'fechamento-oficial' THEN 'homologar-fechamento-oficial'
    WHEN 'retificacao-pontual' THEN 'executar-retificacao-pos-fechamento'
    WHEN 'reabertura-integral' THEN 'reabrir-periodo-fechado' END;
  IF _capability IS NULL THEN RAISE EXCEPTION 'unknown-action'; END IF;
  SELECT * INTO _cap FROM public.effective_capabilities(_effective_on) c
   WHERE c.capability_id = _capability
     AND (c.class_id IS NULL OR c.class_id = _class) AND (c.period_id IS NULL OR c.period_id = _period) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  IF _action = 'retificacao-pontual' AND NOT EXISTS (SELECT 1 FROM public.effective_capabilities(_effective_on) x WHERE x.capability_id = 'autorizar-retificacao-pos-fechamento' AND (x.class_id IS NULL OR x.class_id = _class) AND (x.period_id IS NULL OR x.period_id = _period)) THEN
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
    -- AA.2: fechamento só com todo instrumento aa/1 da turma/período aplicado e com conferência vigente (fingerprint atual).
    IF EXISTS (SELECT 1 FROM public.assessment_instruments i WHERE i.class_id = _class AND i.period_id = _period AND i.contract = 'aa/1'
                AND public.aa_conference_state(i.id) <> 'vigente') THEN RAISE EXCEPTION 'closing:incomplete'; END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.register_academic_standings_v2(_plan_id text, _class text, _cycle text, _operations jsonb, _effective_on date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE _cap record; _op jsonb; _rec jsonb; _logical text; _current record; _ids uuid[] := '{}'; _new uuid; _act uuid;
  _existing uuid; _minute record; _rev text; _src text; _state text; _closings uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF _effective_on IS NULL THEN RAISE EXCEPTION 'standing:effective-date-required'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF jsonb_typeof(_operations) <> 'array' OR jsonb_array_length(_operations) = 0 THEN RAISE EXCEPTION 'empty-batch'; END IF;
  SELECT * INTO _cap FROM public.effective_capabilities(_effective_on) c
   WHERE c.capability_id = 'registrar-situacao-academica' AND (c.class_id IS NULL OR c.class_id = _class) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('standing:' || _class || '|' || _cycle));
  IF EXISTS (SELECT 1 FROM public.academic_standing_batch_acts WHERE plan_id = _plan_id AND author_user_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'plan-conflict'; END IF;
  SELECT id INTO _existing FROM public.academic_standing_batch_acts WHERE plan_id = _plan_id AND author_user_id = auth.uid();
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  FOR _op IN SELECT * FROM jsonb_array_elements(_operations) LOOP
    _rec := _op->'record';
    _logical := _rec->>'scopeKey';
    IF coalesce(_logical,'') = '' OR _rec->>'cycleId' IS DISTINCT FROM _cycle OR coalesce(_rec->>'studentId','') = '' THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
    IF _rec->>'operationalState' IS DISTINCT FROM 'situacao-determinada' OR coalesce(_rec->>'standingId','') = ''
       OR coalesce(_rec->>'ruleSetId','') = '' THEN RAISE EXCEPTION 'rule-required'; END IF;
    SELECT v.* INTO _current FROM public.academic_standing_versions v WHERE v.logical_standing_id = _logical
      AND NOT EXISTS (SELECT 1 FROM public.academic_standing_versions s WHERE s.supersedes_version_id = v.id);
    IF _current.id IS DISTINCT FROM NULLIF(_op->>'expectedBaseVersionId','')::uuid THEN RAISE EXCEPTION 'concurrent-change:%', _rec->>'studentId'; END IF;
    IF _current.id IS NOT NULL THEN
      _rev := _rec->'revision'->>'kind';
      IF _rev IS NULL THEN RAISE EXCEPTION 'standing-already-registered:%', _rec->>'studentId'; END IF;
      IF coalesce(btrim(_rec->'revision'->>'justification'),'') = '' THEN RAISE EXCEPTION 'justification-required:%', _rec->>'studentId'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.effective_capabilities(_effective_on) x
                      WHERE x.capability_id = CASE WHEN _rev = 'reprocessamento' THEN 'reprocessar-situacao' ELSE 'deliberar-situacao' END
                        AND (x.class_id IS NULL OR x.class_id = _class)) THEN
        RAISE EXCEPTION 'capability-missing:%', _rec->>'studentId'; END IF;
    END IF;
    IF _rec ? 'deliberationId' THEN
      SELECT m.* INTO _minute FROM public.collegial_minute_versions m WHERE m.id = _rec->'deliberationSource'->>'minuteId';
      IF _minute.id IS NULL OR EXISTS (SELECT 1 FROM public.collegial_minute_versions s WHERE s.preceding_minute_id = _minute.id)
         OR NOT ((_rec->>'deliberationId') = ANY(_minute.deliberation_ids)) OR _minute.class_id <> _class THEN
        RAISE EXCEPTION 'deliberation-changed:%', _rec->>'studentId';
      END IF;
    END IF;
    _closings := '{}';
    FOR _src IN SELECT DISTINCT s->>'id' FROM jsonb_array_elements(coalesce(_rec->'facts','[]')) f,
                  jsonb_array_elements(coalesce(f->'provenance'->'sources','[]')) s LOOP
      _state := public.canonical_reference_state(_src);
      IF _state = 'superseded' THEN RAISE EXCEPTION 'facts-changed:%', _rec->>'studentId'; END IF;
      IF _state = 'current' AND EXISTS (SELECT 1 FROM public.period_closing_versions WHERE id::text = _src) THEN _closings := _closings || _src::uuid; END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM public.period_closing_versions p WHERE p.class_id = _class
         AND NOT (p.id = ANY(_closings))
         AND p.period_id IN (SELECT q.period_id FROM public.period_closing_versions q WHERE q.id = ANY(_closings))
         AND NOT EXISTS (SELECT 1 FROM public.period_closing_versions s WHERE s.preceding_closing_id = p.id)) THEN
      RAISE EXCEPTION 'facts-changed:%', _rec->>'studentId';
    END IF;
    INSERT INTO public.academic_standing_versions (logical_standing_id, version_number, supersedes_version_id, student_id, class_id, cycle_id,
      standing_id, rule_set_id, rule_set_version, deliberation_id, minute_id, record, batch_plan_id,
      author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
    VALUES (_logical, coalesce(_current.version_number,0)+1, _current.id, _rec->>'studentId', _class, _cycle,
      _rec->>'standingId', _rec->>'ruleSetId', (_rec->>'ruleSetVersion')::int, NULLIF(_rec->>'deliberationId',''),
      NULLIF(_rec->'deliberationSource'->>'minuteId',''), _rec, _plan_id,
      auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
    RETURNING id INTO _new;
    _ids := _ids || _new;
  END LOOP;
  INSERT INTO public.academic_standing_batch_acts (plan_id, class_id, cycle_id, version_ids, author_user_id, author_person_id,
    authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_plan_id, _class, _cycle, _ids, auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _act;
  RETURN _act;
END $function$;

CREATE OR REPLACE FUNCTION public.record_teacher_instrument_version_v2(_instrument_id text, _expected_head uuid, _assignment_id text, _period_id text, _title text, _instructions text, _items jsonb, _randomization jsonb, _status text, _results_instrument_id text, _reference_on date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a record; head record; v int := 1; new_ins text := _instrument_id; new_id uuid; school text; it jsonb; iv record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'item:no-session'; END IF;
  IF _reference_on IS NULL THEN RAISE EXCEPTION 'item:reference-date-required'; END IF;
  SELECT * INTO a FROM public.my_teaching_assignments_at(_reference_on, pg_catalog.now()) t WHERE t.assignment_id = _assignment_id LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'instrument:assignment-not-current'; END IF;
  SELECT c.school_id INTO school FROM public.institutional_classes c WHERE c.id = a.class_id;
  IF _status NOT IN ('rascunho','publicado') THEN RAISE EXCEPTION 'item:invalid-status'; END IF;
  IF jsonb_typeof(coalesce(_items,'[]')) <> 'array' OR jsonb_array_length(coalesce(_items,'[]')) > 200 THEN RAISE EXCEPTION 'instrument:invalid-items'; END IF;
  IF _status = 'publicado' AND jsonb_array_length(coalesce(_items,'[]')) = 0 THEN RAISE EXCEPTION 'instrument:empty'; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(_items,'[]')) LOOP
    SELECT * INTO iv FROM public.assessment_item_versions x WHERE x.id::text = it->>'item_version_id';
    IF iv IS NULL OR NOT public.can_read_assessment_item(iv.author_user_id, iv.status, iv.visibility, iv.school_id) THEN RAISE EXCEPTION 'instrument:item-not-readable'; END IF;
    IF iv.status <> 'publicado' THEN RAISE EXCEPTION 'instrument:item-not-published'; END IF;
  END LOOP;
  IF _randomization IS NOT NULL AND (jsonb_typeof(_randomization) <> 'object' OR coalesce(_randomization->>'seed','') = '') THEN RAISE EXCEPTION 'instrument:invalid-randomization'; END IF;
  IF _results_instrument_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.assessment_instruments r WHERE r.id = _results_instrument_id AND r.class_id = a.class_id)
    THEN RAISE EXCEPTION 'instrument:results-instrument-mismatch'; END IF;
  IF _expected_head IS NULL THEN
    IF new_ins IS NULL THEN new_ins := 'tin-' || gen_random_uuid(); END IF;
    IF EXISTS (SELECT 1 FROM public.teacher_instrument_versions WHERE instrument_id = new_ins) THEN RAISE EXCEPTION 'item:stale-head'; END IF;
  ELSE
    SELECT * INTO head FROM public.teacher_instrument_versions WHERE instrument_id = _instrument_id ORDER BY version DESC LIMIT 1 FOR UPDATE;
    IF head IS NULL OR head.id <> _expected_head THEN RAISE EXCEPTION 'item:stale-head'; END IF;
    IF head.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'item:not-author'; END IF;
    IF head.status = 'publicado' THEN RAISE EXCEPTION 'instrument:published-frozen'; END IF;
    IF head.assignment_id <> _assignment_id THEN RAISE EXCEPTION 'instrument:assignment-immutable'; END IF;
    v := head.version + 1;
  END IF;
  INSERT INTO public.teacher_instrument_versions(instrument_id, version, supersedes_id, assignment_id, class_id, school_id, period_id, title, instructions, items, randomization, status, results_instrument_id, author_user_id)
    VALUES (new_ins, v, _expected_head, _assignment_id, a.class_id, school, nullif(btrim(_period_id),''), btrim(_title), nullif(btrim(_instructions),''), coalesce(_items,'[]'), _randomization, _status, _results_instrument_id, auth.uid())
    RETURNING id INTO new_id;
  RETURN new_id;
END $function$;

CREATE OR REPLACE FUNCTION public.record_assessment_item_version_v2(_item_id text, _expected_head uuid, _item_type_id text, _stem text, _options jsonb, _curricular_refs jsonb, _school_id text, _visibility text, _status text, _key_shared boolean, _answer jsonb, _criteria text, _copied_from uuid, _reference_on date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE head record; v int := 1; new_item text := _item_id; new_id uuid; r jsonb; o jsonb; src record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'item:no-session'; END IF;
  IF _reference_on IS NULL THEN RAISE EXCEPTION 'item:reference-date-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.my_teaching_assignments_at(_reference_on, pg_catalog.now()) t JOIN public.institutional_classes c ON c.id = t.class_id WHERE c.school_id = _school_id)
    THEN RAISE EXCEPTION 'item:no-current-assignment-in-school'; END IF;
  IF jsonb_typeof(coalesce(_options,'[]')) <> 'array' OR jsonb_array_length(coalesce(_options,'[]')) > 26 THEN RAISE EXCEPTION 'item:invalid-options'; END IF;
  FOR o IN SELECT * FROM jsonb_array_elements(coalesce(_options,'[]')) LOOP
    IF jsonb_typeof(o) <> 'object' OR coalesce(o->>'key','') !~ '^[A-Za-z0-9]{1,4}$' OR length(coalesce(o->>'text','')) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'item:invalid-options'; END IF;
  END LOOP;
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(_curricular_refs,'[]')) LOOP
    IF r->>'kind' <> 'reference-item' OR NOT EXISTS (SELECT 1 FROM public.curricular_reference_items i WHERE i.id::text = r->>'item_id') THEN RAISE EXCEPTION 'item:reference-item-unknown'; END IF;
  END LOOP;
  IF _visibility NOT IN ('pessoal','compartilhado') OR _status NOT IN ('rascunho','publicado') THEN RAISE EXCEPTION 'item:invalid-status'; END IF;
  IF _copied_from IS NOT NULL THEN
    SELECT * INTO src FROM public.assessment_item_versions s WHERE s.id = _copied_from;
    IF src IS NULL OR NOT public.can_read_assessment_item(src.author_user_id, src.status, src.visibility, src.school_id) THEN RAISE EXCEPTION 'item:copy-source-not-readable'; END IF;
  END IF;
  IF _expected_head IS NULL THEN
    IF new_item IS NULL THEN new_item := 'itm-' || gen_random_uuid(); END IF;
    IF EXISTS (SELECT 1 FROM public.assessment_item_versions WHERE item_id = new_item) THEN RAISE EXCEPTION 'item:stale-head'; END IF;
  ELSE
    IF _copied_from IS NOT NULL THEN RAISE EXCEPTION 'item:copy-only-on-new'; END IF;
    SELECT * INTO head FROM public.assessment_item_versions WHERE item_id = _item_id ORDER BY version DESC LIMIT 1 FOR UPDATE;
    IF head IS NULL OR head.id <> _expected_head THEN RAISE EXCEPTION 'item:stale-head'; END IF;
    IF head.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'item:not-author'; END IF;
    v := head.version + 1;
  END IF;
  INSERT INTO public.assessment_item_versions(item_id, version, supersedes_id, item_type_id, stem, options, curricular_refs, school_id, visibility, status, key_shared, copied_from_version_id, author_user_id)
    VALUES (new_item, v, _expected_head, _item_type_id, btrim(_stem), coalesce(_options,'[]'), coalesce(_curricular_refs,'[]'), _school_id, _visibility, _status, coalesce(_key_shared,false), _copied_from, auth.uid())
    RETURNING id INTO new_id;
  IF _answer IS NOT NULL OR _criteria IS NOT NULL THEN
    INSERT INTO public.assessment_item_keys(item_version_id, answer, criteria) VALUES (new_id, coalesce(_answer,'null'::jsonb), nullif(btrim(_criteria),''));
  END IF;
  RETURN new_id;
END $function$;

DO $g$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['public.aa_period_window(text,timestamptz)','public.aa_instrument_completeness_internal(text)','public.aa_conference_state(text)','public.aa_ledger_append_only()'] LOOP
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f); END LOOP;
  FOREACH f IN ARRAY ARRAY['public.assessment_instrument_completeness(text)','public.record_assessment_conference(text,uuid,text)',
    'public.record_assessment_officialization(text,uuid)','public.assessment_instrument_governance_state(text)',
    'public.create_assessment_instrument_v2(text,text,text,text,jsonb,date,uuid[])','public.apply_assessment_instrument_v2(text,uuid,date)',
    'public.record_period_closing_act_v2(text,text,jsonb,text,uuid,uuid,text,text,jsonb,date)','public.register_academic_standings_v2(text,text,text,jsonb,date)',
    'public.record_teacher_instrument_version_v2(text,uuid,text,text,text,text,jsonb,jsonb,text,text,date)',
    'public.record_assessment_item_version_v2(text,uuid,text,text,jsonb,jsonb,text,text,text,boolean,jsonb,text,uuid,date)'] LOOP
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, service_role', f);
    EXECUTE pg_catalog.format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f); END LOOP;
  FOREACH f IN ARRAY ARRAY['public.record_period_closing_act(text,text,jsonb,text,uuid,uuid,text,text,jsonb)','public.register_academic_standings(text,text,text,jsonb)',
    'public.record_teacher_instrument_version(text,uuid,text,text,text,text,jsonb,jsonb,text,text)',
    'public.record_assessment_item_version(text,uuid,text,text,jsonb,jsonb,text,text,text,boolean,jsonb,text,uuid)'] LOOP
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f);
    EXECUTE pg_catalog.format('COMMENT ON FUNCTION %s IS %L', f, 'DEPRECATED (AA.2): usava current_date; substituída pela variante _v2 datada'); END LOOP;
END $g$;