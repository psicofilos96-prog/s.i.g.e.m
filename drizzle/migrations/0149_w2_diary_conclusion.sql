-- Frente W.2 — conclusão do Diário (aditivo). Política de correção do Diário passa a ser resolvida na DATA DA AULA (nunca o relógio civil);
-- leitores do professor (aulas previstas/ministradas da própria regência) e visão administrativa somente leitura.
CREATE OR REPLACE FUNCTION public.applicable_diary_policy_on(_family text, _closing_present boolean, _on date)
RETURNS SETOF public.diary_correction_policies LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$
  SELECT p.* FROM public.diary_correction_policies p
   WHERE _on IS NOT NULL AND p.family_id = _family AND p.status = 'homologada'
     AND (p.valid_from IS NULL OR p.valid_from <= _on)
     AND (p.valid_until IS NULL OR p.valid_until >= _on)
     AND p.applies_when_official_closing IN (CASE WHEN _closing_present THEN 'present' ELSE 'absent' END, 'any')
     AND NOT EXISTS (SELECT 1 FROM public.diary_correction_policies s WHERE s.supersedes_version_id = p.id AND s.status = 'homologada')
   ORDER BY (p.applies_when_official_closing = 'any'), p.version DESC
   LIMIT 1
$$;

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
    SELECT * INTO _pol FROM public.applicable_diary_policy_on('registro-de-aula', _closing IS NOT NULL, _date);
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
    SELECT * INTO _pol FROM public.applicable_diary_policy_on('frequencia', _closing IS NOT NULL, _l.lesson_date);
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

-- Leitura do professor: escopo do titular (regência própria vigente na data) ou do substituto (janela explícita).
CREATE OR REPLACE FUNCTION public.diary_holder_scope(_assignment text, _substitution text, _on date,
  OUT class_id text, OUT school_id text, OUT component_id text, OUT engagement_id uuid, OUT academic_year_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _person uuid := public.current_person_id(); _k timestamptz := pg_catalog.now(); r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'diary:session-required'; END IF;
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'diary:natural-person-required'; END IF;
  IF _on IS NULL OR coalesce(_assignment,'') = '' THEN RAISE EXCEPTION 'diary:target-required'; END IF;
  SELECT a.class_id, c.school_id, c.academic_year_id INTO class_id, school_id, academic_year_id
    FROM public.teaching_assignments a JOIN public.institutional_classes c ON c.id = a.class_id WHERE a.id = _assignment;
  IF class_id IS NULL THEN RAISE EXCEPTION 'diary:assignment-not-found'; END IF;
  SELECT t.* INTO r FROM public.teaching_assignments_at(diary_holder_scope.class_id, _on, _k) t WHERE t.assignment_id = _assignment;
  IF r.version_id IS NULL OR r.assignment_state <> 'vigente' THEN RAISE EXCEPTION 'diary:assignment-not-effective'; END IF;
  component_id := r.component_id;
  IF _substitution IS NULL THEN
    IF r.person_id IS DISTINCT FROM _person THEN RAISE EXCEPTION 'diary:not-assignment-holder'; END IF;
    engagement_id := r.engagement_id;
  ELSE
    SELECT s.* INTO r FROM public.teaching_substitutions_at(diary_holder_scope.class_id, _on, _k) s
     WHERE s.substitution_id = _substitution AND s.assignment_id = _assignment;
    IF r.version_id IS NULL THEN RAISE EXCEPTION 'diary:substitution-not-effective'; END IF;
    IF r.substitute_person_id IS DISTINCT FROM _person THEN RAISE EXCEPTION 'diary:not-substitute'; END IF;
    engagement_id := r.substitute_engagement_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(_on) c WHERE c.capability_id = 'consultar-registro-de-aula'
      AND c.engagement_id = diary_holder_scope.engagement_id AND (c.school_id IS NULL OR c.school_id = diary_holder_scope.school_id) AND c.policy_id IS NOT NULL)
    THEN RAISE EXCEPTION 'diary:capability-missing'; END IF;
END $$;

-- Aulas previstas = blocos utilizáveis da grade do elemento no dia (expectativa, nunca fato).
CREATE OR REPLACE FUNCTION public.my_diary_slots_at(_assignment text, _substitution text, _on date)
RETURNS TABLE(block_id uuid, block_key text, starts_at time, ends_at time, block_state text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.diary_holder_scope(_assignment, _substitution, _on);
  RETURN QUERY SELECT s.block_id, s.block_key, s.starts_at, s.ends_at, s.block_state
    FROM public.class_schedule_at(a.class_id, _on, pg_catalog.now()) s
   WHERE s.result_kind = 'block' AND s.weekday = extract(isodow FROM _on)::int AND s.component_id IS NOT DISTINCT FROM a.component_id
   ORDER BY s.starts_at;
END $$;

-- Aulas ministradas da própria regência (titular: todas; substituto: só as da sua substituição), cabeça da cadeia + chamada vigente.
CREATE OR REPLACE FUNCTION public.my_diary_lessons(_assignment text, _substitution text)
RETURNS TABLE(lesson_version_id uuid, logical_record_id text, version_number int, lesson_date date, facts jsonb, schedule_block_ids uuid[],
  period_id text, recorded_as text, attendance_version_id uuid, attendance_version_number int, marks jsonb, eligible_student_ids text[],
  reference_item_ids uuid[], reference_edition_ids uuid[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _person uuid := public.current_person_id();
BEGIN
  IF auth.uid() IS NULL OR _person IS NULL OR coalesce(_assignment,'') = '' THEN RETURN; END IF;
  IF _substitution IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.teaching_assignment_versions v JOIN public.institutional_engagements e ON e.id = v.engagement_id
                    WHERE v.assignment_id = _assignment AND e.person_id = _person) THEN RETURN; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.teaching_substitution_versions v JOIN public.institutional_engagements e ON e.id = v.substitute_engagement_id
                    JOIN public.teaching_substitutions ts ON ts.id = v.substitution_id
                    WHERE v.substitution_id = _substitution AND ts.assignment_id = _assignment AND e.person_id = _person) THEN RETURN; END IF;
  END IF;
  RETURN QUERY
  SELECT l.id, l.logical_record_id, l.version_number, l.lesson_date, l.facts, l.schedule_block_ids, l.period_id,
    CASE WHEN l.substitution_version_id IS NULL THEN 'titular' ELSE 'substituto' END,
    at.id, at.version_number, at.marks, at.eligible_student_ids,
    (SELECT coalesce(array_agg(r.reference_item_id ORDER BY r.reference_item_id), '{}') FROM public.lesson_curricular_references r WHERE r.lesson_version_id = l.id),
    (SELECT coalesce(array_agg(r.edition_id ORDER BY r.reference_item_id), '{}') FROM public.lesson_curricular_references r WHERE r.lesson_version_id = l.id)
  FROM public.lesson_record_versions l
  LEFT JOIN LATERAL (SELECT x.* FROM public.attendance_record_versions x WHERE x.lesson_logical_id = l.logical_record_id
      AND NOT EXISTS (SELECT 1 FROM public.attendance_record_versions s WHERE s.supersedes_version_id = x.id)) at ON true
  WHERE l.assignment_id = _assignment AND l.diary_contract = 'w/1'
    AND NOT EXISTS (SELECT 1 FROM public.lesson_record_versions s WHERE s.supersedes_version_id = l.id)
    AND (_substitution IS NULL OR EXISTS (SELECT 1 FROM public.teaching_substitution_versions sv
          WHERE sv.substitution_id = _substitution AND l.lesson_date >= sv.valid_from AND (sv.valid_until IS NULL OR l.lesson_date <= sv.valid_until)))
  ORDER BY l.lesson_date DESC, l.logical_record_id;
END $$;

-- Visões administrativas SOMENTE LEITURA: escola própria (Direção/Secretaria/Orientação) ou rede (atuação de rede com a capacidade).
-- Sem conteúdo textual da aula nem marcações individuais: só existência, versões e contagens.
CREATE OR REPLACE FUNCTION public.diary_school_overview_at(_school text, _from date, _to date)
RETURNS TABLE(result_kind text, class_id text, component_id text, assignment_id text, lesson_date date, logical_record_id text,
  lesson_version int, recorded_as text, attendance_version int, marked_count int, eligible_count int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL OR _school IS NULL OR _from IS NULL OR _to IS NULL OR _to < _from OR _to - _from > 62 THEN
    result_kind := 'invalid'; RETURN NEXT; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(_to) c
      WHERE c.capability_id IN ('consultar-registro-de-aula','consultar-frequencia') AND c.policy_id IS NOT NULL
        AND (c.school_id = _school OR c.scope_level = 'rede')) THEN
    result_kind := 'access-denied'; RETURN NEXT; RETURN; END IF;
  RETURN QUERY
  SELECT 'lesson'::text, l.class_id, l.component_id, l.assignment_id, l.lesson_date, l.logical_record_id, l.version_number,
    CASE WHEN l.substitution_version_id IS NULL THEN 'titular' ELSE 'substituto' END, at.version_number,
    (SELECT count(*)::int FROM pg_catalog.jsonb_each(coalesce(at.marks,'{}')) s, pg_catalog.jsonb_each(s.value) m),
    pg_catalog.cardinality(at.eligible_student_ids)
  FROM public.lesson_record_versions l JOIN public.institutional_classes c ON c.id = l.class_id
  LEFT JOIN LATERAL (SELECT x.* FROM public.attendance_record_versions x WHERE x.lesson_logical_id = l.logical_record_id
      AND NOT EXISTS (SELECT 1 FROM public.attendance_record_versions s WHERE s.supersedes_version_id = x.id)) at ON true
  WHERE c.school_id = _school AND l.diary_contract = 'w/1' AND l.lesson_date BETWEEN _from AND _to
    AND NOT EXISTS (SELECT 1 FROM public.lesson_record_versions s WHERE s.supersedes_version_id = l.id)
  ORDER BY l.lesson_date, l.class_id, l.logical_record_id;
END $$;

REVOKE ALL ON FUNCTION public.applicable_diary_policy_on(text,boolean,date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.diary_holder_scope(text,text,date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.my_diary_slots_at(text,text,date) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.my_diary_lessons(text,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.diary_school_overview_at(text,date,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.my_diary_slots_at(text,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_diary_lessons(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diary_school_overview_at(text,date,date) TO authenticated;
REVOKE ALL ON FUNCTION public.record_lesson_version_v2(text,text,text,date,uuid,jsonb,uuid[],uuid[],text,text[],text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.record_attendance_version_v2(text,uuid,jsonb,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_lesson_version_v2(text,text,text,date,uuid,jsonb,uuid[],uuid[],text,text[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_version_v2(text,uuid,jsonb,text,text) TO authenticated;
COMMENT ON FUNCTION public.applicable_diary_policy(text,boolean) IS 'DEPRECATED for W writers: replaced by applicable_diary_policy_on (vigência na data da aula, W.2)';
