-- ===== Instrumentos =====
CREATE TABLE public.assessment_instruments (
  id text PRIMARY KEY,
  class_id text NOT NULL,
  period_id text NOT NULL,
  instrument_type_id text NOT NULL,
  closing_scope_key text NOT NULL,
  definition jsonb NOT NULL,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assessment_instruments TO authenticated;
GRANT ALL ON public.assessment_instruments TO service_role;
ALTER TABLE public.assessment_instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read instruments within capability scope" ON public.assessment_instruments FOR SELECT TO authenticated
  USING (public.has_capability('cadastrar-instrumento-avaliativo', class_id, period_id)
      OR public.has_capability('registrar-resultado-avaliativo', class_id, period_id)
      OR public.has_capability('consultar-resultado-avaliativo', class_id, period_id));
CREATE TRIGGER assessment_instruments_append_only BEFORE UPDATE OR DELETE ON public.assessment_instruments
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

ALTER TABLE public.assessment_entry_versions
  ADD CONSTRAINT assessment_entry_versions_instrument_fk FOREIGN KEY (instrument_id) REFERENCES public.assessment_instruments(id);
ALTER TABLE public.assessment_entry_versions ADD COLUMN consulted_closing_id uuid;
ALTER TABLE public.assessment_entry_batch_acts ADD COLUMN consulted_closing_id uuid;

CREATE OR REPLACE FUNCTION public.create_assessment_instrument(
  _id text, _class text, _period text, _instrument_type text, _closing_scope_key text, _definition jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cap record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_id),'') = '' OR coalesce(btrim(_instrument_type),'') = '' THEN RAISE EXCEPTION 'invalid-instrument'; END IF;
  IF split_part(_closing_scope_key, '|', 1) <> _class THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
  SELECT * INTO _cap FROM public.effective_capabilities(current_date) c
   WHERE c.capability_id = 'cadastrar-instrumento-avaliativo'
     AND (c.class_id IS NULL OR c.class_id = _class) AND (c.period_id IS NULL OR c.period_id = _period) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  INSERT INTO public.assessment_instruments (id, class_id, period_id, instrument_type_id, closing_scope_key, definition,
    author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_id, _class, _period, _instrument_type, _closing_scope_key, _definition,
    auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  ON CONFLICT (id) DO NOTHING;
  RETURN _id;
END $$;

-- ===== Fechamentos =====
CREATE TABLE public.period_closing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL,
  class_id text NOT NULL,
  period_id text NOT NULL,
  sequence integer NOT NULL,
  preceding_event_id uuid UNIQUE REFERENCES public.period_closing_events(id),
  action text NOT NULL,
  scope jsonb NOT NULL,
  detail text NOT NULL DEFAULT '',
  justification text,
  closing_version_id uuid,
  exercised_capability text NOT NULL,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  acted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_key, sequence)
);
CREATE TABLE public.period_closing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL,
  class_id text NOT NULL,
  period_id text NOT NULL,
  version_number integer NOT NULL,
  preceding_closing_id uuid UNIQUE REFERENCES public.period_closing_versions(id),
  record jsonb NOT NULL,
  used_entry_version_ids uuid[] NOT NULL DEFAULT '{}',
  rule_id text NOT NULL,
  rule_version integer NOT NULL,
  configuration_id text NOT NULL,
  configuration_version integer,
  revision_kind text,
  justification text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_key, version_number)
);
ALTER TABLE public.period_closing_events ADD CONSTRAINT period_closing_events_version_fk
  FOREIGN KEY (closing_version_id) REFERENCES public.period_closing_versions(id);
GRANT SELECT ON public.period_closing_events, public.period_closing_versions TO authenticated;
GRANT ALL ON public.period_closing_events, public.period_closing_versions TO service_role;
ALTER TABLE public.period_closing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_closing_versions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_closing(_class text, _period text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.effective_capabilities(current_date) c
    WHERE c.capability_id IN ('consultar-auditoria-fechamentos','entregar-pauta-docente','realizar-conferencia-escolar',
      'devolver-pauta-com-apontamentos','homologar-fechamento-oficial','executar-retificacao-pos-fechamento',
      'reabrir-periodo-fechado','registrar-resultado-avaliativo','consultar-resultado-avaliativo')
      AND (c.class_id IS NULL OR c.class_id = _class) AND (c.period_id IS NULL OR c.period_id = _period))
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_closing(text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_read_closing(text,text) TO authenticated;
CREATE POLICY "Read closing events in scope" ON public.period_closing_events FOR SELECT TO authenticated USING (public.can_read_closing(class_id, period_id));
CREATE POLICY "Read closing versions in scope" ON public.period_closing_versions FOR SELECT TO authenticated USING (public.can_read_closing(class_id, period_id));
CREATE TRIGGER period_closing_events_append_only BEFORE UPDATE OR DELETE ON public.period_closing_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER period_closing_versions_append_only BEFORE UPDATE OR DELETE ON public.period_closing_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Versão vigente do fechamento de um escopo (projeção da cadeia).
CREATE OR REPLACE FUNCTION public.current_closing_id(_scope_key text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id FROM public.period_closing_versions v
  WHERE v.scope_key = _scope_key
    AND NOT EXISTS (SELECT 1 FROM public.period_closing_versions s WHERE s.preceding_closing_id = v.id)
$$;
REVOKE EXECUTE ON FUNCTION public.current_closing_id(text) FROM anon, public, authenticated;

-- Um ato do fluxo. Mapa ação → capacidade é o mesmo de CLOSING_ACTION_CAPABILITY.
CREATE OR REPLACE FUNCTION public.record_period_closing_act(
  _scope_key text, _period text, _scope jsonb, _action text,
  _expected_last_event_id uuid, _expected_closing_id uuid,
  _detail text, _justification text, _record jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _class text := split_part(_scope_key, '|', 1);
  _capability text; _cap record; _last record; _closing uuid; _new_closing uuid; _event uuid;
  _used uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF _scope->>'classId' IS DISTINCT FROM _class THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
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
  IF _action IN ('retificacao-pontual','reabertura-integral') AND coalesce(btrim(_justification),'') = '' THEN
    RAISE EXCEPTION 'justification-required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('closing:' || _scope_key));
  SELECT e.* INTO _last FROM public.period_closing_events e
   WHERE e.scope_key = _scope_key ORDER BY e.sequence DESC LIMIT 1;
  IF _last.id IS DISTINCT FROM _expected_last_event_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  _closing := public.current_closing_id(_scope_key);
  IF _closing IS DISTINCT FROM _expected_closing_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;

  IF _record IS NOT NULL THEN
    IF _action NOT IN ('fechamento-oficial','retificacao-pontual') THEN RAISE EXCEPTION 'record-not-admissible'; END IF;
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
  ELSIF _action = 'fechamento-oficial' THEN
    RAISE EXCEPTION 'record-required';
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
REVOKE EXECUTE ON FUNCTION public.record_period_closing_act(text,text,jsonb,text,uuid,uuid,text,text,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_period_closing_act(text,text,jsonb,text,uuid,uuid,text,text,jsonb) TO authenticated;

-- ===== Políticas de correção =====
CREATE TABLE public.assessment_correction_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_policy_id text NOT NULL,
  version integer NOT NULL,
  supersedes_version_id uuid REFERENCES public.assessment_correction_policies(id),
  status text NOT NULL DEFAULT 'draft',
  class_id text,
  applies_when_period_closing text NOT NULL CHECK (applies_when_period_closing IN ('present','absent','any')),
  outcome text NOT NULL CHECK (outcome IN ('admissible','forbidden')),
  required_capabilities text[] NOT NULL DEFAULT '{}',
  requirement_codes text[] NOT NULL DEFAULT '{}',
  admissible_value_kinds text[],
  definition jsonb NOT NULL,
  valid_from date,
  valid_until date,
  homologated_at timestamptz,
  homologation_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_policy_id, version)
);
GRANT SELECT ON public.assessment_correction_policies TO authenticated;
GRANT ALL ON public.assessment_correction_policies TO service_role;
ALTER TABLE public.assessment_correction_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Homologated correction policies" ON public.assessment_correction_policies FOR SELECT TO authenticated USING (status = 'homologated');
CREATE TRIGGER assessment_correction_policies_immutable BEFORE UPDATE OR DELETE ON public.assessment_correction_policies
  FOR EACH ROW EXECUTE FUNCTION public.guard_homologated_policy();

-- ===== Registro de resultados revalidando instrumento, fechamento e rito =====
DROP FUNCTION public.register_assessment_results(text,text,text,text,text,integer,jsonb);
CREATE OR REPLACE FUNCTION public.register_assessment_results(
  _instrument text, _plan_id text, _configuration_id text, _configuration_version integer,
  _expected_closing_id uuid, _operations jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ins record; _cap record; _op jsonb; _current record; _logical text; _student text;
  _problem text; _new uuid; _ids uuid[] := '{}'; _act uuid; _existing uuid; _closing uuid;
  _rect jsonb; _pol record; _pol_count int; _code text; _satisfied text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  SELECT * INTO _ins FROM public.assessment_instruments WHERE id = _instrument;
  IF NOT FOUND THEN RAISE EXCEPTION 'instrument-not-found'; END IF;
  SELECT * INTO _cap FROM public.effective_capabilities(current_date) c
   WHERE c.capability_id = 'registrar-resultado-avaliativo'
     AND (c.class_id IS NULL OR c.class_id = _ins.class_id) AND (c.period_id IS NULL OR c.period_id = _ins.period_id) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  IF jsonb_typeof(_operations) <> 'array' OR jsonb_array_length(_operations) = 0 THEN RAISE EXCEPTION 'empty-batch'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('pauta:' || _instrument));
  PERFORM pg_advisory_xact_lock(hashtext('closing:' || _ins.closing_scope_key));
  SELECT id INTO _existing FROM public.assessment_entry_batch_acts WHERE plan_id = _plan_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  _closing := public.current_closing_id(_ins.closing_scope_key);
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
      -- Rito resolvido AGORA pela política homologada aplicável; ambiguidade ou ausência falham fechadas.
      SELECT count(*) INTO _pol_count FROM public.assessment_correction_policies p
       WHERE p.status = 'homologated' AND (p.class_id IS NULL OR p.class_id = _ins.class_id)
         AND (p.valid_from IS NULL OR p.valid_from <= current_date) AND (p.valid_until IS NULL OR p.valid_until >= current_date)
         AND (p.applies_when_period_closing = 'any'
              OR (p.applies_when_period_closing = 'present' AND _closing IS NOT NULL)
              OR (p.applies_when_period_closing = 'absent' AND _closing IS NULL));
      IF _pol_count = 0 THEN RAISE EXCEPTION 'correction-policy-missing:%', _student; END IF;
      IF _pol_count > 1 THEN RAISE EXCEPTION 'correction-policy-ambiguous:%', _student; END IF;
      SELECT p.* INTO _pol FROM public.assessment_correction_policies p
       WHERE p.status = 'homologated' AND (p.class_id IS NULL OR p.class_id = _ins.class_id)
         AND (p.valid_from IS NULL OR p.valid_from <= current_date) AND (p.valid_until IS NULL OR p.valid_until >= current_date)
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
        IF NOT public.has_capability(_code, _ins.class_id, _ins.period_id) THEN RAISE EXCEPTION 'capability-missing:%', _student; END IF;
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
END $$;
REVOKE EXECUTE ON FUNCTION public.register_assessment_results(text,text,text,integer,uuid,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.register_assessment_results(text,text,text,integer,uuid,jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_assessment_instrument(text,text,text,text,text,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_assessment_instrument(text,text,text,text,text,jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.assessment_value_problem(jsonb) FROM anon, public;