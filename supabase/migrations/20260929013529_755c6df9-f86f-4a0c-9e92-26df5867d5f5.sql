
-- Configurações de colegiado (dado normativo versionado)
CREATE TABLE public.collegial_body_configurations (
  id text NOT NULL,
  version integer NOT NULL,
  status text NOT NULL CHECK (status IN ('rascunho','em-revisao','homologated','arquivada')),
  definition jsonb NOT NULL,
  conduct_capabilities text[] NOT NULL DEFAULT '{}',
  homologated_at timestamptz,
  homologation_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);
GRANT SELECT ON public.collegial_body_configurations TO authenticated;
GRANT ALL ON public.collegial_body_configurations TO service_role;
ALTER TABLE public.collegial_body_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Configurações homologadas são legíveis" ON public.collegial_body_configurations
  FOR SELECT TO authenticated USING (status = 'homologated');
CREATE TRIGGER collegial_body_configurations_immutable BEFORE UPDATE OR DELETE ON public.collegial_body_configurations
  FOR EACH ROW EXECUTE FUNCTION public.guard_homologated_policy();

-- Ledger da sessão
CREATE TABLE public.collegial_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  class_id text NOT NULL,
  body_id text NOT NULL,
  body_configuration_version integer NOT NULL,
  sequence integer NOT NULL,
  preceding_event_id uuid REFERENCES public.collegial_session_events(id),
  kind text NOT NULL,
  document jsonb NOT NULL,
  plan_id text NOT NULL UNIQUE,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  acted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, sequence),
  UNIQUE (preceding_event_id),
  FOREIGN KEY (body_id, body_configuration_version) REFERENCES public.collegial_body_configurations(id, version)
);
GRANT SELECT ON public.collegial_session_events TO authenticated;
GRANT ALL ON public.collegial_session_events TO service_role;
ALTER TABLE public.collegial_session_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER collegial_session_events_append_only BEFORE UPDATE OR DELETE ON public.collegial_session_events
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TABLE public.collegial_deliberations (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  class_id text NOT NULL,
  agenda_item_id text NOT NULL,
  student_id text,
  document jsonb NOT NULL,
  plan_id text NOT NULL UNIQUE,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collegial_deliberations TO authenticated;
GRANT ALL ON public.collegial_deliberations TO service_role;
ALTER TABLE public.collegial_deliberations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER collegial_deliberations_append_only BEFORE UPDATE OR DELETE ON public.collegial_deliberations
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TABLE public.collegial_minute_versions (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  class_id text NOT NULL,
  version integer NOT NULL,
  preceding_minute_id text UNIQUE REFERENCES public.collegial_minute_versions(id),
  document jsonb NOT NULL,
  deliberation_ids text[] NOT NULL,
  rectification_justification text,
  plan_id text NOT NULL UNIQUE,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, version)
);
GRANT SELECT ON public.collegial_minute_versions TO authenticated;
GRANT ALL ON public.collegial_minute_versions TO service_role;
ALTER TABLE public.collegial_minute_versions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER collegial_minute_versions_append_only BEFORE UPDATE OR DELETE ON public.collegial_minute_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Situação acadêmica oficial
CREATE TABLE public.academic_standing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_standing_id text NOT NULL,
  version_number integer NOT NULL,
  supersedes_version_id uuid UNIQUE REFERENCES public.academic_standing_versions(id),
  student_id text NOT NULL,
  class_id text NOT NULL,
  cycle_id text NOT NULL,
  standing_id text NOT NULL,
  rule_set_id text NOT NULL,
  rule_set_version integer NOT NULL,
  deliberation_id text REFERENCES public.collegial_deliberations(id),
  minute_id text REFERENCES public.collegial_minute_versions(id),
  record jsonb NOT NULL,
  batch_plan_id text NOT NULL,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_standing_id, version_number)
);
GRANT SELECT ON public.academic_standing_versions TO authenticated;
GRANT ALL ON public.academic_standing_versions TO service_role;
ALTER TABLE public.academic_standing_versions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER academic_standing_versions_append_only BEFORE UPDATE OR DELETE ON public.academic_standing_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TABLE public.academic_standing_batch_acts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL UNIQUE,
  class_id text NOT NULL,
  cycle_id text NOT NULL,
  version_ids uuid[] NOT NULL,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academic_standing_batch_acts TO authenticated;
GRANT ALL ON public.academic_standing_batch_acts TO service_role;
ALTER TABLE public.academic_standing_batch_acts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER academic_standing_batch_acts_append_only BEFORE UPDATE OR DELETE ON public.academic_standing_batch_acts
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Status do instrumento
CREATE TABLE public.assessment_instrument_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id text NOT NULL REFERENCES public.assessment_instruments(id),
  sequence integer NOT NULL,
  preceding_event_id uuid UNIQUE REFERENCES public.assessment_instrument_status_events(id),
  status text NOT NULL,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  acted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instrument_id, sequence)
);
GRANT SELECT ON public.assessment_instrument_status_events TO authenticated;
GRANT ALL ON public.assessment_instrument_status_events TO service_role;
ALTER TABLE public.assessment_instrument_status_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER assessment_instrument_status_events_append_only BEFORE UPDATE OR DELETE ON public.assessment_instrument_status_events
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Leitura por capacidade na turma
CREATE OR REPLACE FUNCTION public.can_read_collegial(_class text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.effective_capabilities(current_date) c
    WHERE (c.class_id IS NULL OR c.class_id = _class)
      AND (c.capability_id IN ('registrar-situacao-academica','deliberar-situacao','reprocessar-situacao','consultar-auditoria-de-situacao')
           OR c.capability_id IN (SELECT unnest(b.conduct_capabilities) FROM public.collegial_body_configurations b WHERE b.status = 'homologated')))
$$;

CREATE POLICY "Leitura por capacidade" ON public.collegial_session_events FOR SELECT TO authenticated USING (public.can_read_collegial(class_id));
CREATE POLICY "Leitura por capacidade" ON public.collegial_deliberations FOR SELECT TO authenticated USING (public.can_read_collegial(class_id));
CREATE POLICY "Leitura por capacidade" ON public.collegial_minute_versions FOR SELECT TO authenticated USING (public.can_read_collegial(class_id));
CREATE POLICY "Leitura por capacidade" ON public.academic_standing_versions FOR SELECT TO authenticated USING (public.can_read_collegial(class_id));
CREATE POLICY "Leitura por capacidade" ON public.academic_standing_batch_acts FOR SELECT TO authenticated USING (public.can_read_collegial(class_id));
CREATE POLICY "Leitura por capacidade" ON public.assessment_instrument_status_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessment_instruments i WHERE i.id = instrument_id AND public.can_read_closing(i.class_id, i.period_id)));

-- Capacidades de condução: todas as declaradas pela configuração homologada; nada declarado ⇒ falha fechada.
CREATE OR REPLACE FUNCTION public.collegial_conduct_authority(_body text, _version integer, _class text)
RETURNS TABLE(engagement_id uuid, policy_id uuid, policy_version integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _cfg record; _code text;
BEGIN
  SELECT * INTO _cfg FROM public.collegial_body_configurations WHERE id = _body AND version = _version;
  IF NOT FOUND OR _cfg.status <> 'homologated' THEN RAISE EXCEPTION 'configuration-not-homologated'; END IF;
  IF coalesce(array_length(_cfg.conduct_capabilities, 1), 0) = 0 THEN RAISE EXCEPTION 'conduct-capability-undeclared'; END IF;
  FOREACH _code IN ARRAY _cfg.conduct_capabilities LOOP
    IF NOT public.has_capability(_code, _class, NULL) THEN RAISE EXCEPTION 'capability-missing'; END IF;
  END LOOP;
  RETURN QUERY SELECT c.engagement_id, c.policy_id, c.policy_version FROM public.effective_capabilities(current_date) c
    WHERE c.capability_id = _cfg.conduct_capabilities[1] AND (c.class_id IS NULL OR c.class_id = _class) LIMIT 1;
END $$;

CREATE OR REPLACE FUNCTION public.record_collegial_session_event(_session_id text, _kind text, _expected_last_event_id uuid, _document jsonb, _plan_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _class text := _document->'scope'->>'classId'; _body text := _document->>'bodyId';
  _ver integer := (_document->>'bodyConfigurationVersion')::int; _auth record; _last record; _first record; _existing uuid; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF _document->>'id' IS DISTINCT FROM _session_id OR coalesce(_class,'') = '' THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
  IF _kind NOT IN ('abertura','composicao','pauta') THEN RAISE EXCEPTION 'unknown-action'; END IF;
  SELECT * INTO _auth FROM public.collegial_conduct_authority(_body, _ver, _class);
  IF _auth.engagement_id IS NULL THEN RAISE EXCEPTION 'capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('collegial-session:' || _session_id));
  SELECT id INTO _existing FROM public.collegial_session_events WHERE plan_id = _plan_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  IF EXISTS (SELECT 1 FROM public.collegial_minute_versions WHERE session_id = _session_id) THEN RAISE EXCEPTION 'session-concluded'; END IF;
  SELECT * INTO _last FROM public.collegial_session_events WHERE session_id = _session_id ORDER BY sequence DESC LIMIT 1;
  IF _last.id IS DISTINCT FROM _expected_last_event_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  IF _last.id IS NULL AND _kind <> 'abertura' THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
  IF _last.id IS NOT NULL THEN
    IF _kind = 'abertura' THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
    SELECT * INTO _first FROM public.collegial_session_events WHERE session_id = _session_id AND sequence = 1;
    IF _first.class_id <> _class OR _first.body_id <> _body OR _first.body_configuration_version <> _ver THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
  END IF;
  INSERT INTO public.collegial_session_events (session_id, class_id, body_id, body_configuration_version, sequence, preceding_event_id,
    kind, document, plan_id, author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_session_id, _class, _body, _ver, coalesce(_last.sequence,0)+1, _last.id, _kind, _document, _plan_id,
    auth.uid(), public.current_person_id(), _auth.engagement_id, _auth.policy_id, _auth.policy_version)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_collegial_deliberation(_session_id text, _expected_last_event_id uuid, _document jsonb, _plan_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _last record; _auth record; _existing text; _item text := _document->>'agendaItemId';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' OR coalesce(btrim(_document->>'id'),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF _document->>'sessionId' IS DISTINCT FROM _session_id THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('collegial-session:' || _session_id));
  SELECT id INTO _existing FROM public.collegial_deliberations WHERE plan_id = _plan_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  SELECT * INTO _last FROM public.collegial_session_events WHERE session_id = _session_id ORDER BY sequence DESC LIMIT 1;
  IF _last.id IS NULL THEN RAISE EXCEPTION 'session-not-found'; END IF;
  IF _last.id IS DISTINCT FROM _expected_last_event_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  SELECT * INTO _auth FROM public.collegial_conduct_authority(_last.body_id, _last.body_configuration_version, _last.class_id);
  IF _auth.engagement_id IS NULL THEN RAISE EXCEPTION 'capability-missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.collegial_minute_versions WHERE session_id = _session_id) THEN RAISE EXCEPTION 'session-concluded'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_last.document->'agenda') a WHERE a->>'id' = _item) THEN RAISE EXCEPTION 'agenda-item-not-found'; END IF;
  IF coalesce(btrim(_document->>'rationale'),'') = '' THEN RAISE EXCEPTION 'justification-required'; END IF;
  INSERT INTO public.collegial_deliberations (id, session_id, class_id, agenda_item_id, student_id, document, plan_id,
    author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_document->>'id', _session_id, _last.class_id, _item, NULLIF(_document->>'studentId',''), _document, _plan_id,
    auth.uid(), public.current_person_id(), _auth.engagement_id, _auth.policy_id, _auth.policy_version);
  RETURN _document->>'id';
END $$;

CREATE OR REPLACE FUNCTION public.close_collegial_minute(_session_id text, _expected_last_event_id uuid, _expected_minute_id text, _document jsonb, _plan_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _last record; _auth record; _existing text; _current record; _ids text[]; _doc_ids text[]; _version int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' OR coalesce(btrim(_document->>'id'),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF _document->>'sessionId' IS DISTINCT FROM _session_id THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('collegial-session:' || _session_id));
  SELECT id INTO _existing FROM public.collegial_minute_versions WHERE plan_id = _plan_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  SELECT * INTO _last FROM public.collegial_session_events WHERE session_id = _session_id ORDER BY sequence DESC LIMIT 1;
  IF _last.id IS NULL THEN RAISE EXCEPTION 'session-not-found'; END IF;
  IF _last.id IS DISTINCT FROM _expected_last_event_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  SELECT * INTO _auth FROM public.collegial_conduct_authority(_last.body_id, _last.body_configuration_version, _last.class_id);
  IF _auth.engagement_id IS NULL THEN RAISE EXCEPTION 'capability-missing'; END IF;
  SELECT m.* INTO _current FROM public.collegial_minute_versions m WHERE m.session_id = _session_id
    AND NOT EXISTS (SELECT 1 FROM public.collegial_minute_versions s WHERE s.preceding_minute_id = m.id);
  IF _current.id IS DISTINCT FROM _expected_minute_id THEN RAISE EXCEPTION 'minute-changed'; END IF;
  SELECT coalesce(array_agg(x->>'id' ORDER BY x->>'id'), '{}') INTO _doc_ids FROM jsonb_array_elements(coalesce(_document->'deliberations','[]'::jsonb)) x;
  IF _current.id IS NULL THEN
    SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO _ids FROM public.collegial_deliberations WHERE session_id = _session_id;
    IF _ids IS DISTINCT FROM _doc_ids THEN RAISE EXCEPTION 'deliberation-changed'; END IF;
    _version := 1;
  ELSE
    IF coalesce(btrim(_document->'rectification'->>'justification'),'') = '' THEN RAISE EXCEPTION 'justification-required'; END IF;
    IF (SELECT array_agg(x ORDER BY x) FROM unnest(_current.deliberation_ids) x) IS DISTINCT FROM _doc_ids THEN RAISE EXCEPTION 'deliberation-changed'; END IF;
    _ids := _doc_ids;
    _version := _current.version + 1;
  END IF;
  IF (_document->>'version')::int IS DISTINCT FROM _version THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  INSERT INTO public.collegial_minute_versions (id, session_id, class_id, version, preceding_minute_id, document, deliberation_ids,
    rectification_justification, plan_id, author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_document->>'id', _session_id, _last.class_id, _version, _current.id, _document, _ids,
    NULLIF(btrim(_document->'rectification'->>'justification'),''), _plan_id,
    auth.uid(), public.current_person_id(), _auth.engagement_id, _auth.policy_id, _auth.policy_version);
  RETURN _document->>'id';
END $$;

CREATE OR REPLACE FUNCTION public.register_academic_standings(_plan_id text, _class text, _cycle text, _operations jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cap record; _op jsonb; _rec jsonb; _logical text; _current record; _ids uuid[] := '{}'; _new uuid; _act uuid;
  _existing uuid; _minute record; _rev text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF jsonb_typeof(_operations) <> 'array' OR jsonb_array_length(_operations) = 0 THEN RAISE EXCEPTION 'empty-batch'; END IF;
  SELECT * INTO _cap FROM public.effective_capabilities(current_date) c
   WHERE c.capability_id = 'registrar-situacao-academica' AND (c.class_id IS NULL OR c.class_id = _class) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('standing:' || _class || '|' || _cycle));
  SELECT id INTO _existing FROM public.academic_standing_batch_acts WHERE plan_id = _plan_id;
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
      IF NOT public.has_capability(CASE WHEN _rev = 'reprocessamento' THEN 'reprocessar-situacao' ELSE 'deliberar-situacao' END, _class, NULL) THEN
        RAISE EXCEPTION 'capability-missing:%', _rec->>'studentId'; END IF;
    END IF;
    -- Fundamento deliberativo: só ata encerrada VIGENTE que contém a deliberação.
    IF _rec ? 'deliberationId' THEN
      SELECT m.* INTO _minute FROM public.collegial_minute_versions m WHERE m.id = _rec->'deliberationSource'->>'minuteId';
      IF _minute.id IS NULL OR EXISTS (SELECT 1 FROM public.collegial_minute_versions s WHERE s.preceding_minute_id = _minute.id)
         OR NOT ((_rec->>'deliberationId') = ANY(_minute.deliberation_ids)) OR _minute.class_id <> _class THEN
        RAISE EXCEPTION 'deliberation-changed:%', _rec->>'studentId';
      END IF;
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
END $$;

CREATE OR REPLACE FUNCTION public.apply_assessment_instrument(_instrument text, _expected_last_event_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ins record; _cap record; _last record; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  SELECT * INTO _ins FROM public.assessment_instruments WHERE id = _instrument;
  IF NOT FOUND THEN RAISE EXCEPTION 'instrument-not-found'; END IF;
  SELECT * INTO _cap FROM public.effective_capabilities(current_date) c
   WHERE c.capability_id = 'cadastrar-instrumento-avaliativo'
     AND (c.class_id IS NULL OR c.class_id = _ins.class_id) AND (c.period_id IS NULL OR c.period_id = _ins.period_id) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('instrument-status:' || _instrument));
  SELECT * INTO _last FROM public.assessment_instrument_status_events WHERE instrument_id = _instrument ORDER BY sequence DESC LIMIT 1;
  IF _last.status = 'aplicado' THEN RETURN _last.id; END IF; -- idempotente
  IF _last.id IS DISTINCT FROM _expected_last_event_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  INSERT INTO public.assessment_instrument_status_events (instrument_id, sequence, preceding_event_id, status,
    author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_instrument, coalesce(_last.sequence,0)+1, _last.id, 'aplicado', auth.uid(), public.current_person_id(),
    _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
