
-- ================================================================ utilidades
CREATE OR REPLACE FUNCTION public.guard_homologated_row()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'homologada' THEN RAISE EXCEPTION 'Norma homologada é imutável; nova norma gera nova versão'; END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

/** Concessão efetiva (atuação vigente × política homologada) no escopo. */
CREATE OR REPLACE FUNCTION public.capability_grant(_capability text, _class text, _component text DEFAULT NULL, _period text DEFAULT NULL)
RETURNS TABLE(engagement_id uuid, policy_id uuid, policy_version integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.engagement_id, c.policy_id, c.policy_version FROM public.effective_capabilities(current_date) c
   WHERE c.capability_id = _capability
     AND (c.class_id IS NULL OR c.class_id = _class)
     AND (_component IS NULL OR c.component_id IS NULL OR c.component_id = _component)
     AND (_period IS NULL OR c.period_id IS NULL OR c.period_id = _period)
   LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.capability_grant(text, text, text, text) FROM PUBLIC, anon, authenticated;

-- ======================================================= regras de correção
CREATE TABLE public.diary_correction_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_policy_id text NOT NULL,
  version integer NOT NULL,
  supersedes_version_id uuid REFERENCES public.diary_correction_policies(id),
  status text NOT NULL DEFAULT 'rascunho',
  family_id text NOT NULL,
  applies_when_official_closing text NOT NULL,
  outcome text NOT NULL,
  required_capabilities text[] NOT NULL DEFAULT '{}',
  requirement_codes text[] NOT NULL DEFAULT '{}',
  admissible_changes text[],
  definition jsonb NOT NULL DEFAULT '{}',
  valid_from date,
  valid_until date,
  homologated_at timestamptz,
  homologation_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_policy_id, version)
);
GRANT SELECT ON public.diary_correction_policies TO authenticated;
GRANT ALL ON public.diary_correction_policies TO service_role;
ALTER TABLE public.diary_correction_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read homologated diary policies" ON public.diary_correction_policies FOR SELECT TO authenticated USING (status = 'homologada');
CREATE TRIGGER diary_correction_policies_guard BEFORE UPDATE OR DELETE ON public.diary_correction_policies
  FOR EACH ROW EXECUTE FUNCTION public.guard_homologated_row();

CREATE OR REPLACE FUNCTION public.applicable_diary_policy(_family text, _closing_present boolean)
RETURNS SETOF public.diary_correction_policies LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM public.diary_correction_policies p
   WHERE p.family_id = _family AND p.status = 'homologada'
     AND (p.valid_from IS NULL OR p.valid_from <= current_date)
     AND (p.valid_until IS NULL OR p.valid_until >= current_date)
     AND p.applies_when_official_closing IN (CASE WHEN _closing_present THEN 'present' ELSE 'absent' END, 'any')
     AND NOT EXISTS (SELECT 1 FROM public.diary_correction_policies s WHERE s.supersedes_version_id = p.id AND s.status = 'homologada')
   ORDER BY (p.applies_when_official_closing = 'any'), p.version DESC
   LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.applicable_diary_policy(text, boolean) FROM PUBLIC, anon, authenticated;

-- ============================================================ registro de aula
CREATE TABLE public.lesson_record_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_record_id text NOT NULL,
  version_number integer NOT NULL,
  supersedes_version_id uuid UNIQUE REFERENCES public.lesson_record_versions(id),
  class_id text NOT NULL,
  component_id text NOT NULL,
  assignment_id text NOT NULL,
  lesson_date date NOT NULL,
  facts jsonb NOT NULL,
  rectification jsonb,
  plan_id text NOT NULL UNIQUE,
  consulted_closing_id uuid,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  concluded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_record_id, version_number)
);
GRANT SELECT ON public.lesson_record_versions TO authenticated;
GRANT ALL ON public.lesson_record_versions TO service_role;
ALTER TABLE public.lesson_record_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read lessons within capability scope" ON public.lesson_record_versions FOR SELECT TO authenticated
  USING (public.has_capability('registrar-aula', class_id, NULL) OR public.has_capability('consultar-registro-de-aula', class_id, NULL));
CREATE TRIGGER lesson_record_versions_append_only BEFORE UPDATE OR DELETE ON public.lesson_record_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- ================================================================== chamada
CREATE TABLE public.attendance_record_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_attendance_id text NOT NULL,
  lesson_logical_id text NOT NULL,
  lesson_version_id uuid NOT NULL REFERENCES public.lesson_record_versions(id),
  class_id text NOT NULL,
  component_id text NOT NULL,
  version_number integer NOT NULL,
  supersedes_version_id uuid UNIQUE REFERENCES public.attendance_record_versions(id),
  marks jsonb NOT NULL,
  rectification jsonb,
  plan_id text NOT NULL UNIQUE,
  consulted_closing_id uuid,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_attendance_id, version_number)
);
GRANT SELECT ON public.attendance_record_versions TO authenticated;
GRANT ALL ON public.attendance_record_versions TO service_role;
ALTER TABLE public.attendance_record_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read attendance within capability scope" ON public.attendance_record_versions FOR SELECT TO authenticated
  USING (public.has_capability('registrar-frequencia', class_id, NULL) OR public.has_capability('consultar-frequencia', class_id, NULL)
      OR public.has_capability('realizar-conferencia-de-frequencia', class_id, NULL));
CREATE TRIGGER attendance_record_versions_append_only BEFORE UPDATE OR DELETE ON public.attendance_record_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- ================================================== fechamento de frequência
CREATE TABLE public.attendance_closing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL,
  class_id text NOT NULL,
  period_id text NOT NULL,
  version_number integer NOT NULL,
  preceding_closing_id uuid UNIQUE REFERENCES public.attendance_closing_versions(id),
  record jsonb NOT NULL,
  lesson_logical_ids text[] NOT NULL,
  used_attendance_version_ids uuid[] NOT NULL,
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
CREATE TABLE public.attendance_closing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL,
  class_id text NOT NULL,
  period_id text NOT NULL,
  sequence integer NOT NULL,
  preceding_event_id uuid UNIQUE REFERENCES public.attendance_closing_events(id),
  action text NOT NULL,
  scope jsonb NOT NULL,
  detail text NOT NULL,
  justification text,
  closing_version_id uuid REFERENCES public.attendance_closing_versions(id),
  exercised_capability text NOT NULL,
  plan_id text NOT NULL UNIQUE,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  acted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_key, sequence)
);
GRANT SELECT ON public.attendance_closing_versions, public.attendance_closing_events TO authenticated;
GRANT ALL ON public.attendance_closing_versions, public.attendance_closing_events TO service_role;
ALTER TABLE public.attendance_closing_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_closing_events ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.can_read_attendance_closing(_class text, _period text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.effective_capabilities(current_date) c
    WHERE c.capability_id IN ('registrar-frequencia','consultar-frequencia','entregar-pauta-de-frequencia','realizar-conferencia-de-frequencia',
      'devolver-pauta-de-frequencia','homologar-fechamento-de-frequencia','executar-retificacao-de-frequencia','reabrir-frequencia-fechada')
      AND (c.class_id IS NULL OR c.class_id = _class) AND (c.period_id IS NULL OR c.period_id = _period))
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_attendance_closing(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_attendance_closing(text, text) TO authenticated;
CREATE POLICY "Read attendance closings within scope" ON public.attendance_closing_versions FOR SELECT TO authenticated USING (public.can_read_attendance_closing(class_id, period_id));
CREATE POLICY "Read attendance closing acts within scope" ON public.attendance_closing_events FOR SELECT TO authenticated USING (public.can_read_attendance_closing(class_id, period_id));
CREATE TRIGGER attendance_closing_versions_append_only BEFORE UPDATE OR DELETE ON public.attendance_closing_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER attendance_closing_events_append_only BEFORE UPDATE OR DELETE ON public.attendance_closing_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

/** Fechamento de frequência EM VIGOR que cobre a aula (versão vigente e escopo não reaberto). */
CREATE OR REPLACE FUNCTION public.attendance_closing_covering(_lesson_logical text, _class text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id FROM public.attendance_closing_versions v
   WHERE v.class_id = _class AND _lesson_logical = ANY(v.lesson_logical_ids)
     AND NOT EXISTS (SELECT 1 FROM public.attendance_closing_versions s WHERE s.preceding_closing_id = v.id)
     AND coalesce((SELECT e.action FROM public.attendance_closing_events e WHERE e.scope_key = v.scope_key ORDER BY e.sequence DESC LIMIT 1), '') <> 'reabertura-integral'
   LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.attendance_closing_covering(text, text) FROM PUBLIC, anon, authenticated;

-- ============================================== experiência da Ed. Infantil
CREATE TABLE public.infant_experience_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_experience_id text NOT NULL,
  version_number integer NOT NULL,
  supersedes_version_id uuid UNIQUE REFERENCES public.infant_experience_versions(id),
  class_id text NOT NULL,
  component_id text NOT NULL,
  lesson_logical_id text NOT NULL,
  experience_date date NOT NULL,
  record jsonb NOT NULL,
  objective_ids text[] NOT NULL,
  student_ids text[] NOT NULL,
  rectification jsonb,
  plan_id text NOT NULL UNIQUE,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_experience_id, version_number)
);
GRANT SELECT ON public.infant_experience_versions TO authenticated;
GRANT ALL ON public.infant_experience_versions TO service_role;
ALTER TABLE public.infant_experience_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read infant experiences within scope" ON public.infant_experience_versions FOR SELECT TO authenticated
  USING (public.has_capability('registrar-experiencia-infantil', class_id, NULL) OR public.has_capability('consultar-experiencia-infantil', class_id, NULL));
CREATE TRIGGER infant_experience_versions_append_only BEFORE UPDATE OR DELETE ON public.infant_experience_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- =================================================== encerramento do ciclo
CREATE TABLE public.cycle_closing_policies (
  id text NOT NULL,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  definition jsonb NOT NULL,
  closing_capabilities text[] NOT NULL DEFAULT '{}',
  rectification_capabilities text[] NOT NULL DEFAULT '{}',
  reopening_capabilities text[] NOT NULL DEFAULT '{}',
  homologated_at timestamptz,
  homologation_act_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);
GRANT SELECT ON public.cycle_closing_policies TO authenticated;
GRANT ALL ON public.cycle_closing_policies TO service_role;
ALTER TABLE public.cycle_closing_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read homologated cycle closing policies" ON public.cycle_closing_policies FOR SELECT TO authenticated USING (status = 'homologada');
CREATE TRIGGER cycle_closing_policies_guard BEFORE UPDATE OR DELETE ON public.cycle_closing_policies FOR EACH ROW EXECUTE FUNCTION public.guard_homologated_row();

CREATE TABLE public.cycle_closing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL,
  class_id text NOT NULL,
  cycle_id text NOT NULL,
  version_number integer NOT NULL,
  preceding_closing_id uuid UNIQUE REFERENCES public.cycle_closing_versions(id),
  operation text NOT NULL,
  policy_id text NOT NULL,
  policy_version integer NOT NULL,
  snapshot jsonb NOT NULL,
  source_refs jsonb NOT NULL,
  justification text,
  plan_id text NOT NULL UNIQUE,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  capability_policy_version integer NOT NULL,
  declared_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_key, version_number),
  FOREIGN KEY (policy_id, policy_version) REFERENCES public.cycle_closing_policies(id, version)
);
GRANT SELECT ON public.cycle_closing_versions TO authenticated;
GRANT ALL ON public.cycle_closing_versions TO service_role;
ALTER TABLE public.cycle_closing_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read cycle closings within scope" ON public.cycle_closing_versions FOR SELECT TO authenticated
  USING (public.has_capability('encerrar-ciclo', class_id, NULL) OR public.has_capability('consultar-encerramento-do-ciclo', class_id, NULL));
CREATE TRIGGER cycle_closing_versions_append_only BEFORE UPDATE OR DELETE ON public.cycle_closing_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

/**
 * Verifica se uma referência de fonte é fato oficial VIGENTE em qualquer
 * cadeia canônica. Devolve 'current', 'superseded' ou 'unknown'.
 */
CREATE OR REPLACE FUNCTION public.canonical_reference_state(_id text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _u uuid;
BEGIN
  IF _id IS NULL THEN RETURN 'unknown'; END IF;
  IF EXISTS (SELECT 1 FROM public.collegial_minute_versions m WHERE m.id = _id) THEN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM public.collegial_minute_versions s WHERE s.preceding_minute_id = _id) THEN 'superseded' ELSE 'current' END;
  END IF;
  IF _id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN 'unknown'; END IF;
  _u := _id::uuid;
  IF EXISTS (SELECT 1 FROM public.period_closing_versions WHERE id = _u) THEN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM public.period_closing_versions WHERE preceding_closing_id = _u) THEN 'superseded' ELSE 'current' END; END IF;
  IF EXISTS (SELECT 1 FROM public.assessment_entry_versions WHERE id = _u) THEN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM public.assessment_entry_versions WHERE supersedes_version_id = _u) THEN 'superseded' ELSE 'current' END; END IF;
  IF EXISTS (SELECT 1 FROM public.academic_standing_versions WHERE id = _u) THEN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM public.academic_standing_versions WHERE supersedes_version_id = _u) THEN 'superseded' ELSE 'current' END; END IF;
  IF EXISTS (SELECT 1 FROM public.attendance_closing_versions WHERE id = _u) THEN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM public.attendance_closing_versions WHERE preceding_closing_id = _u) THEN 'superseded' ELSE 'current' END; END IF;
  IF EXISTS (SELECT 1 FROM public.attendance_record_versions WHERE id = _u) THEN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM public.attendance_record_versions WHERE supersedes_version_id = _u) THEN 'superseded' ELSE 'current' END; END IF;
  IF EXISTS (SELECT 1 FROM public.descriptive_report_versions WHERE id = _u) THEN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM public.descriptive_report_versions WHERE supersedes_version_id = _u) THEN 'superseded' ELSE 'current' END; END IF;
  RETURN 'unknown';
END $$;
REVOKE EXECUTE ON FUNCTION public.canonical_reference_state(text) FROM PUBLIC, anon, authenticated;

-- ======================================================= função: registro de aula
CREATE OR REPLACE FUNCTION public.record_lesson_version(
  _logical text, _class text, _component text, _assignment text, _date date,
  _base_version_id uuid, _facts jsonb, _justification text, _changed_aspects text[], _plan_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _current record; _cap record; _pol record; _closing uuid; _new uuid; _existing uuid; _c text; _rect jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' OR coalesce(btrim(_logical),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF jsonb_typeof(_facts) <> 'object' THEN RAISE EXCEPTION 'facts-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('lesson:' || _logical));
  SELECT id INTO _existing FROM public.lesson_record_versions WHERE plan_id = _plan_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  SELECT v.* INTO _current FROM public.lesson_record_versions v WHERE v.logical_record_id = _logical
    AND NOT EXISTS (SELECT 1 FROM public.lesson_record_versions s WHERE s.supersedes_version_id = v.id);
  IF _current.id IS DISTINCT FROM _base_version_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;

  IF _current.id IS NULL THEN
    SELECT * INTO _cap FROM public.capability_grant('registrar-aula', _class, _component);
    IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  ELSE
    IF _current.class_id <> _class OR _current.component_id <> _component OR _current.assignment_id <> _assignment OR _current.lesson_date <> _date
      THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
    IF _current.facts = _facts THEN RAISE EXCEPTION 'no-change'; END IF;
    _closing := public.attendance_closing_covering(_logical, _class);
    SELECT * INTO _pol FROM public.applicable_diary_policy('registro-de-aula', _closing IS NOT NULL);
    IF NOT FOUND THEN RAISE EXCEPTION 'correction-policy-missing'; END IF;
    IF _pol.outcome <> 'admissible' THEN RAISE EXCEPTION 'correction-forbidden'; END IF;
    FOREACH _c IN ARRAY _pol.required_capabilities LOOP
      IF NOT EXISTS (SELECT 1 FROM public.capability_grant(_c, _class, _component)) THEN RAISE EXCEPTION 'capability-missing'; END IF;
    END LOOP;
    IF 'justificativa' = ANY(_pol.requirement_codes) AND coalesce(btrim(_justification),'') = '' THEN RAISE EXCEPTION 'justification-required'; END IF;
    IF _pol.admissible_changes IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(coalesce(_changed_aspects,'{}')) a WHERE NOT a = ANY(_pol.admissible_changes))
      THEN RAISE EXCEPTION 'change-not-admissible'; END IF;
    SELECT * INTO _cap FROM public.capability_grant(coalesce(_pol.required_capabilities[1], 'registrar-aula'), _class, _component);
    IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
    _rect := jsonb_build_object('policyId', _pol.logical_policy_id, 'policyVersion', _pol.version,
      'justification', NULLIF(btrim(coalesce(_justification,'')),''), 'changedAspects', to_jsonb(coalesce(_changed_aspects,'{}')),
      'requirementCodes', to_jsonb(_pol.requirement_codes), 'consultedClosingId', _closing);
  END IF;

  INSERT INTO public.lesson_record_versions (logical_record_id, version_number, supersedes_version_id, class_id, component_id, assignment_id,
    lesson_date, facts, rectification, plan_id, consulted_closing_id, author_user_id, author_person_id, authorizing_engagement_id,
    capability_policy_id, capability_policy_version)
  VALUES (_logical, coalesce(_current.version_number,0)+1, _current.id, _class, _component, _assignment, _date, _facts, _rect, _plan_id,
    _closing, auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _new;
  RETURN _new;
END $$;

-- ================================================================ função: chamada
CREATE OR REPLACE FUNCTION public.record_attendance_version(
  _lesson_logical text, _base_version_id uuid, _marks jsonb, _justification text, _plan_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _lesson record; _current record; _cap record; _pol record; _closing uuid; _new uuid; _existing uuid; _c text;
  _logical text := 'chamada:' || _lesson_logical; _changes jsonb; _rect jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF jsonb_typeof(_marks) <> 'object' THEN RAISE EXCEPTION 'invalid-mark'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(_marks) s WHERE jsonb_typeof(s.value) <> 'object')
     OR EXISTS (SELECT 1 FROM jsonb_each(_marks) s, jsonb_each(s.value) m WHERE jsonb_typeof(m.value) <> 'string' OR m.value #>> '{}' NOT IN ('Presente','Ausente'))
    THEN RAISE EXCEPTION 'invalid-mark'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_each(_marks) s, jsonb_each(s.value) m) THEN RAISE EXCEPTION 'empty-attendance'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('lesson:' || _lesson_logical));
  SELECT id INTO _existing FROM public.attendance_record_versions WHERE plan_id = _plan_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  SELECT v.* INTO _lesson FROM public.lesson_record_versions v WHERE v.logical_record_id = _lesson_logical
    AND NOT EXISTS (SELECT 1 FROM public.lesson_record_versions s WHERE s.supersedes_version_id = v.id);
  IF _lesson.id IS NULL THEN RAISE EXCEPTION 'lesson-not-registered'; END IF;
  SELECT v.* INTO _current FROM public.attendance_record_versions v WHERE v.logical_attendance_id = _logical
    AND NOT EXISTS (SELECT 1 FROM public.attendance_record_versions s WHERE s.supersedes_version_id = v.id);
  IF _current.id IS DISTINCT FROM _base_version_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  _closing := public.attendance_closing_covering(_lesson_logical, _lesson.class_id);

  IF _current.id IS NULL THEN
    IF _closing IS NOT NULL THEN RAISE EXCEPTION 'period-closed'; END IF;
    SELECT * INTO _cap FROM public.capability_grant('registrar-frequencia', _lesson.class_id, _lesson.component_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  ELSE
    -- Correção nunca apaga marcação: ausência de marcação não é alvo.
    IF EXISTS (SELECT 1 FROM jsonb_each(_current.marks) s, jsonb_each(s.value) m WHERE NOT (_marks -> s.key ? m.key))
      THEN RAISE EXCEPTION 'mark-removal-not-admissible'; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('slotKey', s.key, 'studentId', m.key,
             'from', _current.marks -> s.key -> m.key, 'to', m.value)), '[]'::jsonb) INTO _changes
      FROM jsonb_each(_marks) s, jsonb_each(s.value) m
     WHERE (_current.marks -> s.key -> m.key) IS DISTINCT FROM m.value;
    IF jsonb_array_length(_changes) = 0 THEN RAISE EXCEPTION 'no-change'; END IF;
    SELECT * INTO _pol FROM public.applicable_diary_policy('frequencia', _closing IS NOT NULL);
    IF NOT FOUND THEN RAISE EXCEPTION 'correction-policy-missing'; END IF;
    IF _pol.outcome <> 'admissible' THEN RAISE EXCEPTION 'correction-forbidden'; END IF;
    FOREACH _c IN ARRAY _pol.required_capabilities LOOP
      IF NOT EXISTS (SELECT 1 FROM public.capability_grant(_c, _lesson.class_id, _lesson.component_id)) THEN RAISE EXCEPTION 'capability-missing'; END IF;
    END LOOP;
    IF 'justificativa' = ANY(_pol.requirement_codes) AND coalesce(btrim(_justification),'') = '' THEN RAISE EXCEPTION 'justification-required'; END IF;
    SELECT * INTO _cap FROM public.capability_grant(coalesce(_pol.required_capabilities[1], 'registrar-frequencia'), _lesson.class_id, _lesson.component_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
    _rect := jsonb_build_object('policyId', _pol.logical_policy_id, 'policyVersion', _pol.version,
      'justification', NULLIF(btrim(coalesce(_justification,'')),''), 'changes', _changes, 'consultedClosingId', _closing);
  END IF;

  INSERT INTO public.attendance_record_versions (logical_attendance_id, lesson_logical_id, lesson_version_id, class_id, component_id,
    version_number, supersedes_version_id, marks, rectification, plan_id, consulted_closing_id,
    author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_logical, _lesson_logical, _lesson.id, _lesson.class_id, _lesson.component_id, coalesce(_current.version_number,0)+1, _current.id,
    _marks, _rect, _plan_id, _closing, auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _new;
  RETURN _new;
END $$;

-- ================================================ função: fechamento de frequência
CREATE OR REPLACE FUNCTION public.record_attendance_closing_act(
  _scope_key text, _class text, _period text, _scope jsonb, _action text,
  _expected_last_event_id uuid, _expected_closing_id uuid, _detail text, _justification text,
  _record jsonb, _expected_attendance_version_ids uuid[], _plan_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _capid text; _cap record; _last record; _stage text; _current record; _existing uuid; _version uuid; _event uuid;
  _lessons text[]; _used uuid[] := '{}'; _l text; _att uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF _scope->>'classId' IS DISTINCT FROM _class THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
  _capid := CASE _action
    WHEN 'entrega-docente' THEN 'entregar-pauta-de-frequencia'
    WHEN 'inicio-conferencia' THEN 'realizar-conferencia-de-frequencia'
    WHEN 'devolucao-com-apontamentos' THEN 'devolver-pauta-de-frequencia'
    WHEN 'fechamento-oficial' THEN 'homologar-fechamento-de-frequencia'
    WHEN 'retificacao-pontual' THEN 'executar-retificacao-de-frequencia'
    WHEN 'reabertura-integral' THEN 'reabrir-frequencia-fechada' END;
  IF _capid IS NULL THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
  SELECT * INTO _cap FROM public.capability_grant(_capid, _class, NULL, _period);
  IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
  IF _action = 'retificacao-pontual' AND NOT EXISTS (SELECT 1 FROM public.capability_grant('autorizar-retificacao-de-frequencia', _class, NULL, _period))
    THEN RAISE EXCEPTION 'capability-missing'; END IF;
  IF _action IN ('devolucao-com-apontamentos','retificacao-pontual','reabertura-integral') AND coalesce(btrim(_justification),'') = ''
    THEN RAISE EXCEPTION 'justification-required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('attendance-closing:' || _scope_key));
  SELECT id INTO _existing FROM public.attendance_closing_events WHERE plan_id = _plan_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  SELECT * INTO _last FROM public.attendance_closing_events WHERE scope_key = _scope_key ORDER BY sequence DESC LIMIT 1;
  IF _last.id IS DISTINCT FROM _expected_last_event_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  _stage := CASE coalesce(_last.action,'') WHEN '' THEN 'em-andamento'
    WHEN 'entrega-docente' THEN 'entregue' WHEN 'inicio-conferencia' THEN 'em-conferencia'
    WHEN 'devolucao-com-apontamentos' THEN 'devolvida-para-ajustes' WHEN 'fechamento-oficial' THEN 'fechado'
    WHEN 'retificacao-pontual' THEN 'fechado' WHEN 'reabertura-integral' THEN 'reaberto' END;
  IF NOT (
    (_action = 'entrega-docente' AND _stage IN ('em-andamento','devolvida-para-ajustes','reaberto')) OR
    (_action = 'inicio-conferencia' AND _stage IN ('entregue','reaberto')) OR
    (_action = 'devolucao-com-apontamentos' AND _stage IN ('entregue','em-conferencia','reaberto')) OR
    (_action = 'fechamento-oficial' AND _stage IN ('em-conferencia','reaberto')) OR
    (_action = 'retificacao-pontual' AND _stage = 'fechado') OR
    (_action = 'reabertura-integral' AND _stage = 'fechado')) THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
  SELECT v.* INTO _current FROM public.attendance_closing_versions v WHERE v.scope_key = _scope_key
    AND NOT EXISTS (SELECT 1 FROM public.attendance_closing_versions s WHERE s.preceding_closing_id = v.id);
  IF _current.id IS DISTINCT FROM _expected_closing_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  IF _action = 'reabertura-integral' AND _current.id IS NULL THEN RAISE EXCEPTION 'nothing-to-reopen'; END IF;

  IF _action IN ('fechamento-oficial','retificacao-pontual') THEN
    IF _record IS NULL OR jsonb_typeof(_record->'lessonEntryIds') <> 'array' THEN RAISE EXCEPTION 'record-required'; END IF;
    SELECT array_agg(x) INTO _lessons FROM jsonb_array_elements_text(_record->'lessonEntryIds') x;
    -- Fatos usados são calculados pelo banco: versão vigente de cada chamada.
    FOREACH _l IN ARRAY coalesce(_lessons,'{}') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.lesson_record_versions v WHERE v.logical_record_id = _l AND v.class_id = _class)
        THEN RAISE EXCEPTION 'source-not-canonical'; END IF;
      SELECT v.id INTO _att FROM public.attendance_record_versions v WHERE v.logical_attendance_id = 'chamada:' || _l
        AND NOT EXISTS (SELECT 1 FROM public.attendance_record_versions s WHERE s.supersedes_version_id = v.id);
      IF _att IS NULL THEN RAISE EXCEPTION 'attendance-missing'; END IF;
      _used := _used || _att;
    END LOOP;
    IF (SELECT array_agg(x ORDER BY x) FROM unnest(_used) x) IS DISTINCT FROM
       (SELECT array_agg(x ORDER BY x) FROM unnest(coalesce(_expected_attendance_version_ids,'{}')) x)
      THEN RAISE EXCEPTION 'facts-changed'; END IF;
    INSERT INTO public.attendance_closing_versions (scope_key, class_id, period_id, version_number, preceding_closing_id, record,
      lesson_logical_ids, used_attendance_version_ids, revision_kind, justification, author_user_id, author_person_id,
      authorizing_engagement_id, capability_policy_id, capability_policy_version)
    VALUES (_scope_key, _class, _period, coalesce(_current.version_number,0)+1, _current.id, _record, coalesce(_lessons,'{}'), _used,
      CASE WHEN _action = 'retificacao-pontual' THEN 'retificacao-pontual' END, NULLIF(btrim(coalesce(_justification,'')),''),
      auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
    RETURNING id INTO _version;
  END IF;

  INSERT INTO public.attendance_closing_events (scope_key, class_id, period_id, sequence, preceding_event_id, action, scope, detail,
    justification, closing_version_id, exercised_capability, plan_id, author_user_id, author_person_id, authorizing_engagement_id,
    capability_policy_id, capability_policy_version)
  VALUES (_scope_key, _class, _period, coalesce(_last.sequence,0)+1, _last.id, _action, _scope, _detail,
    NULLIF(btrim(coalesce(_justification,'')),''), _version, _capid, _plan_id, auth.uid(), public.current_person_id(),
    _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _event;
  RETURN _event;
END $$;

-- ============================================ função: experiência da Ed. Infantil
CREATE OR REPLACE FUNCTION public.register_infant_experience(
  _logical text, _base_version_id uuid, _class text, _component text, _assignment text, _date date,
  _record jsonb, _lesson_logical text, _lesson_facts jsonb, _justification text, _plan_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _current record; _cap record; _lcap record; _pol record; _closing uuid; _new uuid; _existing uuid; _c text; _bad text;
  _objectives text[]; _students text[]; _rect jsonb; _lesson_id text := _lesson_logical;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' OR coalesce(btrim(_logical),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF jsonb_typeof(_record) <> 'object' OR coalesce(btrim(_record->>'title'),'') = '' THEN RAISE EXCEPTION 'record-required'; END IF;
  SELECT coalesce(array_agg(DISTINCT o), '{}') INTO _objectives FROM (
    SELECT jsonb_array_elements_text(coalesce(_record->'objectiveIds','[]')) o
    UNION ALL SELECT jsonb_array_elements_text(coalesce(i->'objectiveIds','[]')) FROM jsonb_array_elements(coalesce(_record->'individualObservations','[]')) i) q;
  SELECT o INTO _bad FROM unnest(_objectives) o WHERE NOT EXISTS (SELECT 1 FROM public.curriculum_objectives co WHERE co.id = o) LIMIT 1;
  IF _bad IS NOT NULL THEN RAISE EXCEPTION 'objective-not-in-matrix:%', _bad; END IF;
  SELECT coalesce(array_agg(DISTINCT i->>'studentId'), '{}') INTO _students FROM jsonb_array_elements(coalesce(_record->'individualObservations','[]')) i;

  PERFORM pg_advisory_xact_lock(hashtext('experience:' || _logical));
  SELECT id INTO _existing FROM public.infant_experience_versions WHERE plan_id = _plan_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  SELECT v.* INTO _current FROM public.infant_experience_versions v WHERE v.logical_experience_id = _logical
    AND NOT EXISTS (SELECT 1 FROM public.infant_experience_versions s WHERE s.supersedes_version_id = v.id);
  IF _current.id IS DISTINCT FROM _base_version_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;

  IF _current.id IS NULL THEN
    SELECT * INTO _cap FROM public.capability_grant('registrar-experiencia-infantil', _class, _component);
    IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
    SELECT * INTO _lcap FROM public.capability_grant('registrar-aula', _class, _component);
    IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
    IF coalesce(btrim(_lesson_logical),'') = '' OR jsonb_typeof(_lesson_facts) <> 'object' THEN RAISE EXCEPTION 'lesson-required'; END IF;
    IF EXISTS (SELECT 1 FROM public.lesson_record_versions WHERE logical_record_id = _lesson_logical) THEN RAISE EXCEPTION 'concurrent-change'; END IF;
    -- Operação composta: aula e experiência nascem juntas, ou nada nasce.
    INSERT INTO public.lesson_record_versions (logical_record_id, version_number, class_id, component_id, assignment_id, lesson_date, facts,
      plan_id, author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
    VALUES (_lesson_logical, 1, _class, _component, _assignment, _date, _lesson_facts, _plan_id || ':aula', auth.uid(), public.current_person_id(),
      _lcap.engagement_id, _lcap.policy_id, _lcap.policy_version);
  ELSE
    IF _current.class_id <> _class OR _current.component_id <> _component OR _current.experience_date <> _date THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
    _lesson_id := _current.lesson_logical_id;
    IF _current.record = _record THEN RAISE EXCEPTION 'no-change'; END IF;
    _closing := public.attendance_closing_covering(_lesson_id, _class);
    SELECT * INTO _pol FROM public.applicable_diary_policy('experiencia-infantil', _closing IS NOT NULL);
    IF NOT FOUND THEN RAISE EXCEPTION 'correction-policy-missing'; END IF;
    IF _pol.outcome <> 'admissible' THEN RAISE EXCEPTION 'correction-forbidden'; END IF;
    FOREACH _c IN ARRAY _pol.required_capabilities LOOP
      IF NOT EXISTS (SELECT 1 FROM public.capability_grant(_c, _class, _component)) THEN RAISE EXCEPTION 'capability-missing'; END IF;
    END LOOP;
    IF 'justificativa' = ANY(_pol.requirement_codes) AND coalesce(btrim(_justification),'') = '' THEN RAISE EXCEPTION 'justification-required'; END IF;
    SELECT * INTO _cap FROM public.capability_grant(coalesce(_pol.required_capabilities[1], 'registrar-experiencia-infantil'), _class, _component);
    IF NOT FOUND THEN RAISE EXCEPTION 'capability-missing'; END IF;
    _rect := jsonb_build_object('policyId', _pol.logical_policy_id, 'policyVersion', _pol.version,
      'justification', NULLIF(btrim(coalesce(_justification,'')),''), 'consultedClosingId', _closing);
  END IF;

  INSERT INTO public.infant_experience_versions (logical_experience_id, version_number, supersedes_version_id, class_id, component_id,
    lesson_logical_id, experience_date, record, objective_ids, student_ids, rectification, plan_id, author_user_id, author_person_id,
    authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_logical, coalesce(_current.version_number,0)+1, _current.id, _class, _component, _lesson_id, _date, _record, _objectives, _students,
    _rect, _plan_id, auth.uid(), public.current_person_id(), _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _new;
  RETURN _new;
END $$;

-- ================================================ função: encerramento do ciclo
CREATE OR REPLACE FUNCTION public.record_cycle_closing(
  _class text, _cycle text, _operation text, _expected_closing_id uuid, _policy_id text, _policy_version integer,
  _snapshot jsonb, _justification text, _plan_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _scope text := _class || '|' || _cycle; _pol record; _caps text[]; _c text; _cap record; _current record; _existing uuid;
  _src jsonb; _state text; _refs jsonb := '[]'::jsonb; _new uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF coalesce(btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'plan-required'; END IF;
  IF _operation NOT IN ('lavratura','retificacao','reabertura') THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
  IF _snapshot->>'classId' IS DISTINCT FROM _class OR _snapshot->>'cycleId' IS DISTINCT FROM _cycle THEN RAISE EXCEPTION 'scope-mismatch'; END IF;
  SELECT * INTO _pol FROM public.cycle_closing_policies WHERE id = _policy_id AND version = _policy_version AND status = 'homologada';
  IF NOT FOUND THEN RAISE EXCEPTION 'policy-not-homologated'; END IF;
  _caps := CASE _operation WHEN 'lavratura' THEN _pol.closing_capabilities WHEN 'retificacao' THEN _pol.rectification_capabilities ELSE _pol.reopening_capabilities END;
  -- Política que não declara quem pode agir: ninguém age.
  IF coalesce(array_length(_caps,1),0) = 0 THEN RAISE EXCEPTION 'authority-not-declared'; END IF;
  FOREACH _c IN ARRAY _caps LOOP
    IF NOT EXISTS (SELECT 1 FROM public.capability_grant(_c, _class)) THEN RAISE EXCEPTION 'capability-missing'; END IF;
  END LOOP;
  SELECT * INTO _cap FROM public.capability_grant(_caps[1], _class);
  IF _operation <> 'lavratura' AND coalesce(btrim(_justification),'') = '' THEN RAISE EXCEPTION 'justification-required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cycle-closing:' || _scope));
  SELECT id INTO _existing FROM public.cycle_closing_versions WHERE plan_id = _plan_id;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  SELECT v.* INTO _current FROM public.cycle_closing_versions v WHERE v.scope_key = _scope
    AND NOT EXISTS (SELECT 1 FROM public.cycle_closing_versions s WHERE s.preceding_closing_id = v.id);
  IF _current.id IS DISTINCT FROM _expected_closing_id THEN RAISE EXCEPTION 'concurrent-change'; END IF;
  IF _operation = 'lavratura' AND _current.id IS NOT NULL AND _current.operation <> 'reabertura' THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;
  IF _operation IN ('retificacao','reabertura') AND (_current.id IS NULL OR _current.operation = 'reabertura') THEN RAISE EXCEPTION 'transition-not-admissible'; END IF;

  -- Retrato só admite referências a fatos oficiais VIGENTES; nada é recalculado.
  IF _operation <> 'reabertura' THEN
    FOR _src IN SELECT * FROM jsonb_array_elements(coalesce(_snapshot->'sources','[]')) LOOP
      _state := public.canonical_reference_state(_src->>'id');
      IF _state = 'unknown' THEN RAISE EXCEPTION 'source-not-canonical:%', _src->>'id'; END IF;
      IF _state = 'superseded' THEN RAISE EXCEPTION 'facts-changed:%', _src->>'id'; END IF;
      _refs := _refs || jsonb_build_array(jsonb_build_object('kind', _src->>'kind', 'id', _src->>'id', 'version', _src->'version'));
    END LOOP;
  END IF;

  INSERT INTO public.cycle_closing_versions (scope_key, class_id, cycle_id, version_number, preceding_closing_id, operation, policy_id,
    policy_version, snapshot, source_refs, justification, plan_id, author_user_id, author_person_id, authorizing_engagement_id,
    capability_policy_id, capability_policy_version)
  VALUES (_scope, _class, _cycle, coalesce(_current.version_number,0)+1, _current.id, _operation, _policy_id, _policy_version, _snapshot,
    _refs, NULLIF(btrim(coalesce(_justification,'')),''), _plan_id, auth.uid(), public.current_person_id(),
    _cap.engagement_id, _cap.policy_id, _cap.policy_version)
  RETURNING id INTO _new;
  RETURN _new;
END $$;

-- ================================ situação acadêmica: revalidação completa dos fatos
CREATE OR REPLACE FUNCTION public.register_academic_standings(_plan_id text, _class text, _cycle text, _operations jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cap record; _op jsonb; _rec jsonb; _logical text; _current record; _ids uuid[] := '{}'; _new uuid; _act uuid;
  _existing uuid; _minute record; _rev text; _src text; _state text; _closings uuid[];
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
    IF _rec ? 'deliberationId' THEN
      SELECT m.* INTO _minute FROM public.collegial_minute_versions m WHERE m.id = _rec->'deliberationSource'->>'minuteId';
      IF _minute.id IS NULL OR EXISTS (SELECT 1 FROM public.collegial_minute_versions s WHERE s.preceding_minute_id = _minute.id)
         OR NOT ((_rec->>'deliberationId') = ANY(_minute.deliberation_ids)) OR _minute.class_id <> _class THEN
        RAISE EXCEPTION 'deliberation-changed:%', _rec->>'studentId';
      END IF;
    END IF;
    -- Todo fato canônico citado na conferência precisa continuar vigente.
    _closings := '{}';
    FOR _src IN SELECT DISTINCT s->>'id' FROM jsonb_array_elements(coalesce(_rec->'facts','[]')) f,
                  jsonb_array_elements(coalesce(f->'provenance'->'sources','[]')) s LOOP
      _state := public.canonical_reference_state(_src);
      IF _state = 'superseded' THEN RAISE EXCEPTION 'facts-changed:%', _rec->>'studentId'; END IF;
      IF _state = 'current' AND EXISTS (SELECT 1 FROM public.period_closing_versions WHERE id::text = _src) THEN _closings := _closings || _src::uuid; END IF;
    END LOOP;
    -- Fato novo: fechamento vigente da turma, no mesmo período, que a conferência não conheceu.
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
END $$;

-- ============================================================ permissões
REVOKE EXECUTE ON FUNCTION public.record_lesson_version(text, text, text, text, date, uuid, jsonb, text, text[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_attendance_version(text, uuid, jsonb, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_attendance_closing_act(text, text, text, jsonb, text, uuid, uuid, text, text, jsonb, uuid[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_infant_experience(text, uuid, text, text, text, date, jsonb, text, jsonb, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_cycle_closing(text, text, text, uuid, text, integer, jsonb, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_academic_standings(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_lesson_version(text, text, text, text, date, uuid, jsonb, text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_version(text, uuid, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_closing_act(text, text, text, jsonb, text, uuid, uuid, text, text, jsonb, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_infant_experience(text, uuid, text, text, text, date, jsonb, text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_cycle_closing(text, text, text, uuid, text, integer, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_academic_standings(text, text, text, jsonb) TO authenticated;
