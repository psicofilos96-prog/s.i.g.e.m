-- Frente W — Diário do Professor 2027 (aditivo). Reutiliza lesson_record_versions/attendance_record_versions (B4.10),
-- regência B4.8/V, substituições V, ledger anual S, calendário B4.6, períodos B2.4 e repositório Y.
-- Aula é FATO registrado pelo docente (nunca derivado da grade); chamada nasce de aula real e só cobre alunos
-- alocados na data; ausência de marcação nunca é falta. v1 permanece legível e é aposentado para gravação nova.

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['lesson_record_versions','attendance_record_versions','attendance_closing_versions','attendance_closing_events',
    'attendance_occurrence_types','attendance_calculation_policies','assessment_entry_versions','assessment_entry_batch_acts',
    'period_closing_versions','period_closing_events'] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
  END LOOP;
END $$;

ALTER TABLE public.lesson_record_versions
  ADD COLUMN IF NOT EXISTS diary_contract text,
  ADD COLUMN IF NOT EXISTS teaching_assignment_version_id uuid REFERENCES public.teaching_assignment_versions(id),
  ADD COLUMN IF NOT EXISTS substitution_version_id uuid REFERENCES public.teaching_substitution_versions(id),
  ADD COLUMN IF NOT EXISTS matrix_version_id uuid,
  ADD COLUMN IF NOT EXISTS item_key text,
  ADD COLUMN IF NOT EXISTS period_id text,
  ADD COLUMN IF NOT EXISTS calendar_id text,
  ADD COLUMN IF NOT EXISTS calendar_version_id uuid,
  ADD COLUMN IF NOT EXISTS schedule_block_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS academic_year_id text;
ALTER TABLE public.attendance_record_versions
  ADD COLUMN IF NOT EXISTS diary_contract text,
  ADD COLUMN IF NOT EXISTS eligible_student_ids text[];

CREATE TABLE IF NOT EXISTS public.lesson_curricular_references (
  lesson_version_id uuid NOT NULL REFERENCES public.lesson_record_versions(id),
  reference_item_id uuid NOT NULL REFERENCES public.curricular_reference_items(id),
  edition_id uuid NOT NULL REFERENCES public.curricular_reference_editions(id),
  PRIMARY KEY (lesson_version_id, reference_item_id));
GRANT SELECT ON public.lesson_curricular_references TO authenticated;
GRANT SELECT ON public.lesson_curricular_references TO service_role;
ALTER TABLE public.lesson_curricular_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read lesson references with the lesson" ON public.lesson_curricular_references FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lesson_record_versions l WHERE l.id = lesson_version_id));
CREATE TRIGGER lesson_curricular_references_append_only BEFORE UPDATE OR DELETE ON public.lesson_curricular_references
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.diary_period_at(_class text, _on date, _known_at timestamptz)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _org text; _n int; _p text;
BEGIN
  SELECT o.organization_id INTO _org FROM public.institutional_class_period_organization_versions o
   WHERE o.class_id = _class AND o.created_at <= _known_at AND o.valid_from <= _on AND (o.valid_until IS NULL OR o.valid_until >= _on)
     AND NOT EXISTS (SELECT 1 FROM public.institutional_class_period_organization_versions s WHERE s.supersedes_id = o.id AND s.created_at <= _known_at)
   ORDER BY o.version DESC LIMIT 1;
  IF _org IS NULL THEN RETURN NULL; END IF;
  SELECT count(*), min(p.id) INTO _n, _p FROM public.institutional_academic_periods p
   JOIN LATERAL (SELECT v.* FROM public.institutional_academic_period_versions v WHERE v.period_id = p.id AND v.created_at <= _known_at
                 ORDER BY v.version DESC LIMIT 1) v ON true
   WHERE p.period_organization_id = _org AND v.is_active AND _on BETWEEN v.starts_on AND v.ends_on;
  RETURN CASE WHEN _n = 1 THEN _p END;
END $$;

CREATE OR REPLACE FUNCTION public.diary_school_day_issue(_school text, _on date, _known_at timestamptz,
  OUT issue text, OUT calendar_id text, OUT calendar_version_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _n int; _t int; _f int; _u int; _st text; _hs text;
BEGIN
  SELECT count(*) FILTER (WHERE c.resolution = 'candidato'), count(*) FILTER (WHERE c.resolution NOT IN ('candidato','sem-candidato')),
         min(c.calendar_id) FILTER (WHERE c.resolution = 'candidato')
    INTO _n, _u, calendar_id FROM public.calendar_applicability_candidates(_on, _known_at, _school, NULL, NULL, NULL) c;
  IF _u > 0 OR _n > 1 THEN issue := 'diary:calendar-ambiguous'; RETURN; END IF;
  IF _n = 0 THEN issue := 'diary:calendar-missing'; RETURN; END IF;
  SELECT max(d.day_state), max(d.homologation_state), max(d.version_id::text)::uuid,
         count(*) FILTER (WHERE d.school_day_effect IS TRUE), count(*) FILTER (WHERE d.school_day_effect IS FALSE)
    INTO _st, _hs, calendar_version_id, _t, _f FROM public.calendar_day_declarations(calendar_id, _on, _known_at) d;
  IF _st IS DISTINCT FROM 'declarado' THEN issue := 'diary:calendar-day-' || coalesce(_st, 'indisponivel'); RETURN; END IF;
  IF _hs IS DISTINCT FROM 'homologada' THEN issue := 'diary:calendar-not-homologated'; RETURN; END IF;
  IF _f > 0 OR _t = 0 THEN issue := 'diary:not-a-school-day'; RETURN; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.diary_teacher_actor(_assignment text, _substitution text, _on date, _capability text,
  OUT engagement_id uuid, OUT assignment_version_id uuid, OUT substitution_version_id uuid, OUT policy_id uuid, OUT policy_version int,
  OUT class_id text, OUT school_id text, OUT academic_year_id text, OUT matrix_version_id uuid, OUT item_key text, OUT component_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _person uuid := public.current_person_id(); _ys text; _k timestamptz := pg_catalog.now(); r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'diary:session-required'; END IF;
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'diary:natural-person-required'; END IF;
  IF _on IS NULL OR coalesce(_assignment,'') = '' THEN RAISE EXCEPTION 'diary:target-required'; END IF;
  SELECT a.class_id, c.school_id, c.academic_year_id INTO class_id, school_id, academic_year_id
    FROM public.teaching_assignments a JOIN public.institutional_classes c ON c.id = a.class_id WHERE a.id = _assignment;
  IF class_id IS NULL THEN RAISE EXCEPTION 'diary:assignment-not-found'; END IF;
  SELECT s.state INTO _ys FROM public.academic_year_operational_state_at(academic_year_id) s;
  IF _ys IS DISTINCT FROM 'operacional' THEN RAISE EXCEPTION 'diary:year-not-operational:%', coalesce(_ys, 'sem-estado'); END IF;
  SELECT t.* INTO r FROM public.teaching_assignments_at(class_id, _on, _k) t WHERE t.assignment_id = _assignment;
  IF r.version_id IS NULL OR r.assignment_state <> 'vigente' THEN RAISE EXCEPTION 'diary:assignment-not-effective'; END IF;
  assignment_version_id := r.version_id; matrix_version_id := r.matrix_version_id; item_key := r.item_key; component_id := r.component_id;
  IF _substitution IS NULL THEN
    IF r.person_id IS DISTINCT FROM _person THEN RAISE EXCEPTION 'diary:not-assignment-holder'; END IF;
    engagement_id := r.engagement_id;
  ELSE
    SELECT s.* INTO r FROM public.teaching_substitutions_at(class_id, _on, _k) s WHERE s.substitution_id = _substitution AND s.assignment_id = _assignment;
    IF r.version_id IS NULL THEN RAISE EXCEPTION 'diary:substitution-not-effective'; END IF;
    IF r.substitute_person_id IS DISTINCT FROM _person THEN RAISE EXCEPTION 'diary:not-substitute'; END IF;
    engagement_id := r.substitute_engagement_id; substitution_version_id := r.version_id;
  END IF;
  SELECT c.policy_id, c.policy_version INTO policy_id, policy_version FROM public.effective_scope_capabilities(_on) c
   WHERE c.capability_id = _capability AND c.engagement_id = diary_teacher_actor.engagement_id
     AND (c.school_id IS NULL OR c.school_id = diary_teacher_actor.school_id) AND c.policy_id IS NOT NULL LIMIT 1;
  IF policy_id IS NULL THEN RAISE EXCEPTION 'diary:capability-missing'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_lesson_version_v2(_logical text, _assignment text, _substitution text, _date date,
  _base_version_id uuid, _facts jsonb, _blocks uuid[], _references uuid[], _justification text, _changed_aspects text[], _plan_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a record; _cur record; _pol record; _closing uuid; _new uuid; _existing uuid; _c text; _rect jsonb; _period text; cal record;
  _k timestamptz := pg_catalog.now(); _cap text;
BEGIN
  IF coalesce(pg_catalog.btrim(_plan_id),'') = '' OR coalesce(pg_catalog.btrim(_logical),'') = '' THEN RAISE EXCEPTION 'diary:plan-required'; END IF;
  IF _facts IS NULL OR pg_catalog.jsonb_typeof(_facts) <> 'object' THEN RAISE EXCEPTION 'diary:facts-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lesson:' || _logical));
  SELECT id INTO _existing FROM public.lesson_record_versions WHERE plan_id = _plan_id;
  IF _existing IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.lesson_record_versions WHERE id = _existing AND author_user_id = auth.uid()) THEN RETURN _existing; END IF;
    RAISE EXCEPTION 'diary:plan-conflict';
  END IF;
  SELECT v.* INTO _cur FROM public.lesson_record_versions v WHERE v.logical_record_id = _logical
     AND NOT EXISTS (SELECT 1 FROM public.lesson_record_versions s WHERE s.supersedes_version_id = v.id);
  IF _cur.id IS DISTINCT FROM _base_version_id THEN RAISE EXCEPTION 'diary:stale-head'; END IF;
  IF _cur.id IS NOT NULL AND (_cur.diary_contract IS DISTINCT FROM 'w/1' OR _cur.assignment_id <> _assignment OR _cur.lesson_date <> _date)
    THEN RAISE EXCEPTION 'diary:scope-mismatch'; END IF;
  _cap := CASE WHEN _cur.id IS NULL THEN 'registrar-aula' ELSE 'executar-retificacao-de-registro-de-aula' END;
  SELECT * INTO a FROM public.diary_teacher_actor(_assignment, _substitution, _date, _cap);
  _period := public.diary_period_at(a.class_id, _date, _k);
  IF _period IS NULL THEN RAISE EXCEPTION 'diary:period-missing-or-ambiguous'; END IF;
  SELECT * INTO cal FROM public.diary_school_day_issue(a.school_id, _date, _k);
  IF cal.issue IS NOT NULL THEN RAISE EXCEPTION '%', cal.issue; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.unnest(coalesce(_blocks,'{}')) b WHERE NOT EXISTS (
      SELECT 1 FROM public.class_schedule_at(a.class_id, _date, _k) s WHERE s.block_id = b AND s.weekday = extract(isodow FROM _date)::int
        AND s.component_id IS NOT DISTINCT FROM a.component_id AND s.block_state = 'utilizavel'))
    THEN RAISE EXCEPTION 'diary:block-not-in-schedule'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.unnest(coalesce(_references,'{}')) r WHERE NOT EXISTS (SELECT 1 FROM public.curricular_reference_items i WHERE i.id = r))
    THEN RAISE EXCEPTION 'diary:reference-unknown'; END IF;
  IF _cur.id IS NOT NULL THEN
    IF _cur.facts = _facts AND _cur.schedule_block_ids = coalesce(_blocks,'{}') AND
       (SELECT coalesce(array_agg(reference_item_id ORDER BY reference_item_id),'{}') FROM public.lesson_curricular_references WHERE lesson_version_id = _cur.id)
       = (SELECT coalesce(array_agg(x ORDER BY x),'{}') FROM pg_catalog.unnest(coalesce(_references,'{}')) x)
      THEN RAISE EXCEPTION 'diary:no-change'; END IF;
    _closing := public.attendance_closing_covering(_logical, a.class_id);
    SELECT * INTO _pol FROM public.applicable_diary_policy('registro-de-aula', _closing IS NOT NULL);
    IF NOT FOUND THEN RAISE EXCEPTION 'diary:correction-policy-missing'; END IF;
    IF _pol.outcome <> 'admissible' THEN RAISE EXCEPTION 'diary:correction-forbidden'; END IF;
    FOREACH _c IN ARRAY _pol.required_capabilities LOOP
      PERFORM public.diary_teacher_actor(_assignment, _substitution, _date, _c);
    END LOOP;
    IF 'justificativa' = ANY(_pol.requirement_codes) AND coalesce(pg_catalog.btrim(_justification),'') = '' THEN RAISE EXCEPTION 'diary:justification-required'; END IF;
    _rect := pg_catalog.jsonb_build_object('policyId', _pol.logical_policy_id, 'policyVersion', _pol.version,
      'justification', NULLIF(pg_catalog.btrim(coalesce(_justification,'')),''), 'changedAspects', pg_catalog.to_jsonb(coalesce(_changed_aspects,'{}')),
      'consultedClosingId', _closing);
  END IF;
  INSERT INTO public.lesson_record_versions (logical_record_id, version_number, supersedes_version_id, class_id, component_id, assignment_id,
    lesson_date, facts, rectification, plan_id, consulted_closing_id, author_user_id, author_person_id, authorizing_engagement_id,
    capability_policy_id, capability_policy_version, diary_contract, teaching_assignment_version_id, substitution_version_id,
    matrix_version_id, item_key, period_id, calendar_id, calendar_version_id, schedule_block_ids, academic_year_id)
  VALUES (_logical, coalesce(_cur.version_number,0)+1, _cur.id, a.class_id, coalesce(a.component_id, a.item_key), _assignment, _date, _facts, _rect,
    _plan_id, _closing, auth.uid(), public.current_person_id(), a.engagement_id, a.policy_id, a.policy_version, 'w/1', a.assignment_version_id,
    a.substitution_version_id, a.matrix_version_id, a.item_key, _period, cal.calendar_id, cal.calendar_version_id, coalesce(_blocks,'{}'), a.academic_year_id)
  RETURNING id INTO _new;
  INSERT INTO public.lesson_curricular_references (lesson_version_id, reference_item_id, edition_id)
  SELECT _new, i.id, i.edition_id FROM public.curricular_reference_items i WHERE i.id = ANY(coalesce(_references,'{}'));
  RETURN _new;
END $$;

CREATE OR REPLACE FUNCTION public.record_attendance_version_v2(_lesson_logical text, _base_version_id uuid, _marks jsonb, _justification text, _plan_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _l record; _cur record; a record; _pol record; _closing uuid; _new uuid; _existing uuid; _rect jsonb; _changes jsonb;
  _eligible text[]; _subst text; _logical text := 'chamada:' || _lesson_logical; _cap text;
BEGIN
  IF coalesce(pg_catalog.btrim(_plan_id),'') = '' THEN RAISE EXCEPTION 'diary:plan-required'; END IF;
  IF _marks IS NULL OR pg_catalog.jsonb_typeof(_marks) <> 'object'
     OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(_marks) s WHERE pg_catalog.jsonb_typeof(s.value) <> 'object')
     OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(_marks) s, pg_catalog.jsonb_each(s.value) m
                WHERE pg_catalog.jsonb_typeof(m.value) <> 'string' OR m.value #>> '{}' NOT IN ('Presente','Ausente'))
    THEN RAISE EXCEPTION 'diary:invalid-mark'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(_marks) s, pg_catalog.jsonb_each(s.value) m) THEN RAISE EXCEPTION 'diary:empty-attendance'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lesson:' || _lesson_logical));
  SELECT id INTO _existing FROM public.attendance_record_versions WHERE plan_id = _plan_id;
  IF _existing IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.attendance_record_versions WHERE id = _existing AND author_user_id = auth.uid()) THEN RETURN _existing; END IF;
    RAISE EXCEPTION 'diary:plan-conflict';
  END IF;
  SELECT v.* INTO _l FROM public.lesson_record_versions v WHERE v.logical_record_id = _lesson_logical
     AND NOT EXISTS (SELECT 1 FROM public.lesson_record_versions s WHERE s.supersedes_version_id = v.id);
  IF _l.id IS NULL THEN RAISE EXCEPTION 'diary:lesson-not-registered'; END IF;
  IF _l.diary_contract IS DISTINCT FROM 'w/1' THEN RAISE EXCEPTION 'diary:lesson-legacy-contract'; END IF;
  SELECT v.* INTO _cur FROM public.attendance_record_versions v WHERE v.logical_attendance_id = _logical
     AND NOT EXISTS (SELECT 1 FROM public.attendance_record_versions s WHERE s.supersedes_version_id = v.id);
  IF _cur.id IS DISTINCT FROM _base_version_id THEN RAISE EXCEPTION 'diary:stale-head'; END IF;
  SELECT s.substitution_id INTO _subst FROM public.teaching_substitution_versions s WHERE s.id = _l.substitution_version_id;
  _cap := CASE WHEN _cur.id IS NULL THEN 'registrar-frequencia' ELSE 'executar-retificacao-de-frequencia' END;
  BEGIN
    SELECT * INTO a FROM public.diary_teacher_actor(_l.assignment_id, NULL, _l.lesson_date, _cap);
  EXCEPTION WHEN raise_exception THEN
    IF _subst IS NULL THEN RAISE; END IF;
    SELECT * INTO a FROM public.diary_teacher_actor(_l.assignment_id, _subst, _l.lesson_date, _cap);
  END;
  IF _cur.id IS NULL THEN
    SELECT coalesce(array_agg(DISTINCT x.student_id ORDER BY x.student_id),'{}') INTO _eligible
      FROM public.class_allocations_at(NULL, _l.class_id, _l.lesson_date, pg_catalog.now()) x
     WHERE x.valid_from <= _l.lesson_date AND (x.ended_on IS NULL OR x.ended_on >= _l.lesson_date);
  ELSE _eligible := _cur.eligible_student_ids; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(_marks) s, pg_catalog.jsonb_each(s.value) m WHERE NOT m.key = ANY(_eligible))
    THEN RAISE EXCEPTION 'diary:student-not-allocated-on-lesson-date'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(_marks) s WHERE s.key <> 'aula' AND NOT s.key = ANY(_l.schedule_block_ids::text[]))
    THEN RAISE EXCEPTION 'diary:slot-not-in-lesson'; END IF;
  _closing := public.attendance_closing_covering(_lesson_logical, _l.class_id);
  IF _cur.id IS NULL THEN
    IF _closing IS NOT NULL THEN RAISE EXCEPTION 'diary:period-closed'; END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(_cur.marks) s, pg_catalog.jsonb_each(s.value) m WHERE NOT (_marks -> s.key ? m.key))
      THEN RAISE EXCEPTION 'diary:mark-removal-not-admissible'; END IF;
    SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('slotKey', s.key, 'studentId', m.key, 'from', _cur.marks -> s.key -> m.key, 'to', m.value)), '[]')
      INTO _changes FROM pg_catalog.jsonb_each(_marks) s, pg_catalog.jsonb_each(s.value) m WHERE (_cur.marks -> s.key -> m.key) IS DISTINCT FROM m.value;
    IF pg_catalog.jsonb_array_length(_changes) = 0 THEN RAISE EXCEPTION 'diary:no-change'; END IF;
    SELECT * INTO _pol FROM public.applicable_diary_policy('frequencia', _closing IS NOT NULL);
    IF NOT FOUND THEN RAISE EXCEPTION 'diary:correction-policy-missing'; END IF;
    IF _pol.outcome <> 'admissible' THEN RAISE EXCEPTION 'diary:correction-forbidden'; END IF;
    IF 'justificativa' = ANY(_pol.requirement_codes) AND coalesce(pg_catalog.btrim(_justification),'') = '' THEN RAISE EXCEPTION 'diary:justification-required'; END IF;
    _rect := pg_catalog.jsonb_build_object('policyId', _pol.logical_policy_id, 'policyVersion', _pol.version,
      'justification', NULLIF(pg_catalog.btrim(coalesce(_justification,'')),''), 'changes', _changes, 'consultedClosingId', _closing);
  END IF;
  INSERT INTO public.attendance_record_versions (logical_attendance_id, lesson_logical_id, lesson_version_id, class_id, component_id,
    version_number, supersedes_version_id, marks, rectification, plan_id, consulted_closing_id, author_user_id, author_person_id,
    authorizing_engagement_id, capability_policy_id, capability_policy_version, diary_contract, eligible_student_ids)
  VALUES (_logical, _lesson_logical, _l.id, _l.class_id, _l.component_id, coalesce(_cur.version_number,0)+1, _cur.id, _marks, _rect, _plan_id,
    _closing, auth.uid(), public.current_person_id(), a.engagement_id, a.policy_id, a.policy_version, 'w/1', _eligible)
  RETURNING id INTO _new;
  RETURN _new;
END $$;

CREATE OR REPLACE FUNCTION public.my_diaries_at(_on date, _known_at timestamptz)
RETURNS TABLE(role text, assignment_id text, substitution_id text, class_id text, school_id text, academic_year_id text, year_state text,
  engagement_id uuid, matrix_id text, item_key text, component_id text, component_label text, effective_from date, effective_until date, assignment_state text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
#variable_conflict use_column
DECLARE _person uuid := public.current_person_id(); c record;
BEGIN
  IF auth.uid() IS NULL OR _person IS NULL OR _on IS NULL OR _known_at IS NULL THEN RETURN; END IF;
  FOR c IN SELECT DISTINCT a.class_id, ic.school_id, ic.academic_year_id FROM public.teaching_assignments a
      JOIN public.institutional_classes ic ON ic.id = a.class_id
     WHERE EXISTS (SELECT 1 FROM public.teaching_assignment_versions v JOIN public.institutional_engagements e ON e.id = v.engagement_id
                    WHERE v.assignment_id = a.id AND e.person_id = _person)
        OR EXISTS (SELECT 1 FROM public.teaching_substitution_versions sv JOIN public.institutional_engagements e ON e.id = sv.substitute_engagement_id
                   JOIN public.teaching_substitutions ts ON ts.id = sv.substitution_id WHERE ts.assignment_id = a.id AND e.person_id = _person) LOOP
    RETURN QUERY SELECT 'titular'::text, t.assignment_id, NULL::text, c.class_id, c.school_id, c.academic_year_id,
        (SELECT s.state FROM public.academic_year_operational_state_at(c.academic_year_id) s), t.engagement_id, t.matrix_id, t.item_key, t.component_id,
        t.component_label_snapshot, t.effective_from, t.effective_until, t.assignment_state
      FROM public.teaching_assignments_at(c.class_id, _on, _known_at) t WHERE t.person_id = _person;
    RETURN QUERY SELECT 'substituto'::text, s.assignment_id, s.substitution_id, c.class_id, c.school_id, c.academic_year_id,
        (SELECT y.state FROM public.academic_year_operational_state_at(c.academic_year_id) y), s.substitute_engagement_id, t.matrix_id, t.item_key, t.component_id,
        t.component_label_snapshot, s.effective_from, s.effective_until, t.assignment_state
      FROM public.teaching_substitutions_at(c.class_id, _on, _known_at) s
      LEFT JOIN public.teaching_assignments_at(c.class_id, _on, _known_at) t ON t.assignment_id = s.assignment_id
     WHERE s.substitute_person_id = _person;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.diary_roster_at(_assignment text, _substitution text, _on date)
RETURNS TABLE(student_id text, display_name text, allocation_valid_from date, allocation_ended_on date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.diary_teacher_actor(_assignment, _substitution, _on, 'consultar-frequencia');
  RETURN QUERY SELECT x.student_id, st.display_name, x.valid_from, x.ended_on
    FROM public.class_allocations_at(NULL, a.class_id, _on, pg_catalog.now()) x JOIN public.institutional_students st ON st.id = x.student_id
   WHERE x.valid_from <= _on AND (x.ended_on IS NULL OR x.ended_on >= _on) ORDER BY st.display_name;
END $$;

REVOKE ALL ON FUNCTION public.diary_period_at(text,date,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.diary_school_day_issue(text,date,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.diary_teacher_actor(text,text,date,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_lesson_version_v2(text,text,text,date,uuid,jsonb,uuid[],uuid[],text,text[],text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.record_attendance_version_v2(text,uuid,jsonb,text,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.my_diaries_at(date,timestamptz) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.diary_roster_at(text,text,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_lesson_version_v2(text,text,text,date,uuid,jsonb,uuid[],uuid[],text,text[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_version_v2(text,uuid,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_diaries_at(date,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diary_roster_at(text,text,date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_lesson_version(text,text,text,text,date,uuid,jsonb,text,text[],text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.record_attendance_version(text,uuid,jsonb,text,text) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.record_lesson_version(text,text,text,text,date,uuid,jsonb,text,text[],text) IS 'DEPRECATED: replaced by record_lesson_version_v2 (Frente W)';
COMMENT ON FUNCTION public.record_attendance_version(text,uuid,jsonb,text,text) IS 'DEPRECATED: replaced by record_attendance_version_v2 (Frente W)';
