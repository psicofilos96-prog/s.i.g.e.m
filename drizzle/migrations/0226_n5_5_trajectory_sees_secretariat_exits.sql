CREATE OR REPLACE FUNCTION public.student_trajectory_at(_student text, _as_of date, _known_at timestamp with time zone, _year text DEFAULT NULL::text, _period text DEFAULT NULL::text, _domains text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE k timestamptz := coalesce(_known_at, now()); _own text[]; _own_asg text[]; _ev jsonb := '[]'; _dom jsonb := '{}';
  _schools text[]; _any boolean := false; d text; caps jsonb := jsonb_build_object(
    'matricula','consultar-matricula-e-movimentacao','alocacao','consultar-matricula-e-movimentacao','movimentacao','consultar-matricula-e-movimentacao',
    'frequencia','consultar-acompanhamento-pedagogico','avaliacao','consultar-acompanhamento-pedagogico','fechamento','consultar-acompanhamento-pedagogico',
    'acompanhamento','consultar-acompanhamento-pedagogico');
  _auth_schools jsonb := '{}';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ab:session-required'; END IF;
  IF _as_of IS NULL OR coalesce(_student,'') = '' THEN RAISE EXCEPTION 'ab:target-required'; END IF;
  SELECT coalesce(array_agg(DISTINCT e.school_id), '{}') INTO _schools FROM public.school_enrollments e WHERE e.student_id = _student AND e.created_at <= k;
  SELECT coalesce(array_agg(DISTINCT t.class_id), '{}'), coalesce(array_agg(DISTINCT t.assignment_id), '{}') INTO _own, _own_asg
    FROM public.my_teaching_assignments_at(_as_of, k) t;
  FOR d IN SELECT jsonb_object_keys(caps) LOOP
    _auth_schools := _auth_schools || jsonb_build_object(d, coalesce((SELECT jsonb_agg(s) FROM unnest(_schools) s WHERE public.ab_scope_allows(caps->>d, s, _as_of)), '[]'));
    IF jsonb_array_length(_auth_schools->d) > 0 THEN _any := true; END IF;
  END LOOP;
  IF NOT _any AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes a WHERE a.student_id = _student AND a.class_id = ANY(_own) AND a.created_at <= k) THEN
    RETURN jsonb_build_object('result','access-denied');
  END IF;

  IF _domains IS NULL OR 'matricula' = ANY(_domains) THEN
    _ev := _ev || coalesce((SELECT jsonb_agg(jsonb_build_object('domain','matricula','on',e.opened_on,'label','Matrícula na escola','school_id',e.school_id,
        'year_id',e.academic_year_id,'source','school_enrollments','source_id',e.id,'known_at',e.created_at))
      FROM public.school_enrollments e WHERE e.student_id = _student AND e.created_at <= k AND e.school_id IN (SELECT jsonb_array_elements_text(_auth_schools->'matricula'))
        AND (_year IS NULL OR e.academic_year_id = _year)
        AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id AND s.created_at <= k)), '[]');
    _ev := _ev || coalesce((SELECT jsonb_agg(jsonb_build_object('domain','matricula','on',x.ended_on,'label','Encerramento da matrícula na escola','school_id',e.school_id,
        'year_id',e.academic_year_id,'source','school_enrollment_endings','source_id',x.enrollment_id,'known_at',x.created_at))
      FROM public.school_enrollment_endings x JOIN public.school_enrollments e ON e.id = x.enrollment_id
      WHERE e.student_id = _student AND x.created_at <= k AND e.school_id IN (SELECT jsonb_array_elements_text(_auth_schools->'matricula'))
        AND (_year IS NULL OR e.academic_year_id = _year)), '[]');
  END IF;
  IF _domains IS NULL OR 'alocacao' = ANY(_domains) THEN
    _ev := _ev || coalesce((SELECT jsonb_agg(x) FROM (
      SELECT jsonb_build_object('domain','alocacao','on',a.valid_from,'label','Entrada na turma','school_id',a.school_id,'class_id',a.class_id,
        'year_id',c.academic_year_id,'source','class_enrollment_episodes','source_id',a.id,'known_at',a.created_at) x
        FROM public.class_enrollment_episodes a JOIN public.institutional_classes c ON c.id = a.class_id
       WHERE a.student_id = _student AND a.created_at <= k AND (_year IS NULL OR c.academic_year_id = _year)
         AND (a.school_id IN (SELECT jsonb_array_elements_text(_auth_schools->'alocacao')) OR a.class_id = ANY(_own))
         AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id AND s.created_at <= k)
      UNION ALL
      SELECT jsonb_build_object('domain','alocacao','on',en.ended_on,'label','Saída da turma','school_id',en.school_id,'class_id',en.class_id,
        'year_id',c.academic_year_id,'source','class_allocation_ending_versions','source_id',en.id,'known_at',en.created_at)
        FROM public.class_allocation_ending_versions en JOIN public.class_enrollment_episodes a ON a.logical_id = en.allocation_logical_id
        JOIN public.institutional_classes c ON c.id = en.class_id
       WHERE a.student_id = _student AND en.created_at <= k AND NOT en.annulled AND (_year IS NULL OR c.academic_year_id = _year)
         AND (en.school_id IN (SELECT jsonb_array_elements_text(_auth_schools->'alocacao')) OR en.class_id = ANY(_own))
         AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s WHERE s.supersedes_id = en.id AND s.created_at <= k)
      UNION ALL
      SELECT jsonb_build_object('domain','alocacao','on',x.ended_on,'label','Saída da turma','school_id',a.school_id,'class_id',a.class_id,
        'year_id',c.academic_year_id,'source','class_enrollment_episode_endings','source_id',x.episode_id,'known_at',x.created_at)
        FROM public.class_enrollment_episode_endings x JOIN public.class_enrollment_episodes a ON a.id = x.episode_id
        JOIN public.institutional_classes c ON c.id = a.class_id
       WHERE a.student_id = _student AND x.created_at <= k AND (_year IS NULL OR c.academic_year_id = _year)
         AND (a.school_id IN (SELECT jsonb_array_elements_text(_auth_schools->'alocacao')) OR a.class_id = ANY(_own))) q), '[]');
  END IF;
  IF _domains IS NULL OR 'movimentacao' = ANY(_domains) THEN
    _ev := _ev || coalesce((SELECT jsonb_agg(jsonb_build_object('domain','movimentacao','on',m.effective_on,'label','Movimentação: ' || m.movement_type_id,
        'school_ids',to_jsonb(m.school_scope_ids),'source','student_movement_events','source_id',m.id,'known_at',m.created_at))
      FROM public.student_movement_events m WHERE m.student_id = _student AND m.created_at <= k
        AND EXISTS (SELECT 1 FROM unnest(m.school_scope_ids) s WHERE s IN (SELECT jsonb_array_elements_text(_auth_schools->'movimentacao')))
        AND NOT EXISTS (SELECT 1 FROM public.student_movement_events s WHERE s.supersedes_id = m.id AND s.created_at <= k)), '[]');
  END IF;
  IF _domains IS NULL OR 'frequencia' = ANY(_domains) THEN
    _ev := _ev || coalesce((SELECT jsonb_agg(jsonb_build_object('domain','frequencia','on',l.lesson_date,
        'label', CASE WHEN v.marks->'aula' ? _student THEN 'Chamada: ' || (v.marks->'aula'->>_student) ELSE 'Chamada sem marcação (pendente)' END,
        'mark', v.marks->'aula'->>_student, 'school_id', c.school_id,'class_id',v.class_id,'period_id',l.period_id,'year_id',c.academic_year_id,
        'source','attendance_record_versions','source_id',v.id,'known_at',v.recorded_at))
      FROM public.attendance_record_versions v JOIN public.lesson_record_versions l ON l.id = v.lesson_version_id JOIN public.institutional_classes c ON c.id = v.class_id
      WHERE _student = ANY(v.eligible_student_ids) AND v.recorded_at <= k
        AND NOT EXISTS (SELECT 1 FROM public.attendance_record_versions s WHERE s.supersedes_version_id = v.id AND s.recorded_at <= k)
        AND (_year IS NULL OR c.academic_year_id = _year) AND (_period IS NULL OR l.period_id = _period)
        AND (c.school_id IN (SELECT jsonb_array_elements_text(_auth_schools->'frequencia')) OR l.assignment_id = ANY(_own_asg))), '[]');
  END IF;
  IF _domains IS NULL OR 'avaliacao' = ANY(_domains) THEN
    _ev := _ev || coalesce((SELECT jsonb_agg(jsonb_build_object('domain','avaliacao','on',coalesce(ap.applied_on, i.planned_on),'label','Resultado de instrumento',
        'value', v.value, 'version', v.version_number, 'school_id', c.school_id,'class_id',v.class_id,'period_id',v.period_id,'year_id',c.academic_year_id,
        'source','assessment_entry_versions','source_id',v.id,'known_at',v.recorded_at))
      FROM public.assessment_entry_versions v JOIN public.assessment_instruments i ON i.id = v.instrument_id JOIN public.institutional_classes c ON c.id = v.class_id
      LEFT JOIN LATERAL (SELECT e.applied_on FROM public.assessment_instrument_status_events e WHERE e.instrument_id = i.id AND e.status = 'aplicado' ORDER BY e.sequence DESC LIMIT 1) ap ON true
      WHERE v.student_id = _student AND v.recorded_at <= k
        AND NOT EXISTS (SELECT 1 FROM public.assessment_entry_versions s WHERE s.supersedes_version_id = v.id AND s.recorded_at <= k)
        AND (_year IS NULL OR c.academic_year_id = _year) AND (_period IS NULL OR v.period_id = _period)
        AND (c.school_id IN (SELECT jsonb_array_elements_text(_auth_schools->'avaliacao')) OR i.assignment_id = ANY(_own_asg))), '[]');
  END IF;
  IF _domains IS NULL OR 'fechamento' = ANY(_domains) THEN
    _ev := _ev || coalesce((SELECT jsonb_agg(jsonb_build_object('domain','fechamento','on',p.closed_at::date,'label','Fechamento do período (versão ' || p.version_number || ')',
        'school_id', c.school_id,'class_id',p.class_id,'period_id',p.period_id,'year_id',c.academic_year_id,'source','period_closing_versions','source_id',p.id,'known_at',p.closed_at))
      FROM public.period_closing_versions p JOIN public.institutional_classes c ON c.id = p.class_id
      WHERE p.closed_at <= k AND p.class_id IN (SELECT a.class_id FROM public.class_enrollment_episodes a WHERE a.student_id = _student)
        AND (_year IS NULL OR c.academic_year_id = _year) AND (_period IS NULL OR p.period_id = _period)
        AND c.school_id IN (SELECT jsonb_array_elements_text(_auth_schools->'fechamento'))), '[]');
  END IF;
  IF _domains IS NULL OR 'acompanhamento' = ANY(_domains) THEN
    _ev := _ev || coalesce((SELECT jsonb_agg(jsonb_build_object('domain','acompanhamento','on',r.occurred_on,'label','Acompanhamento: ' || r.category_value_id,
        'event_kind', r.event_kind, 'status', r.status_value_id, 'return_on', r.return_on, 'has_referral', r.referral IS NOT NULL,
        'school_id', r.school_id,'period_id',r.period_id,'source','school_pedagogical_records','source_id',r.id,'known_at',r.recorded_at))
      FROM public.school_pedagogical_records r
      WHERE r.subject_kind = 'estudante' AND r.subject_id = _student AND r.recorded_at <= k
        AND (r.visibility = 'acompanhamento-da-escola' OR r.author_user_id = auth.uid())
        AND NOT EXISTS (SELECT 1 FROM public.school_pedagogical_records s WHERE s.supersedes_id = r.id AND s.recorded_at <= k)
        AND (_period IS NULL OR r.period_id = _period)
        AND r.school_id IN (SELECT jsonb_array_elements_text(_auth_schools->'acompanhamento'))), '[]');
  END IF;

  FOR d IN SELECT jsonb_object_keys(caps) LOOP
    _dom := _dom || jsonb_build_object(d, CASE
      WHEN _domains IS NOT NULL AND NOT d = ANY(_domains) THEN 'nao-solicitado'
      WHEN jsonb_array_length(_auth_schools->d) = 0 AND NOT (d IN ('alocacao','frequencia','avaliacao') AND cardinality(_own) > 0) THEN 'nao-autorizado'
      WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(_ev) e WHERE e->>'domain' = d) THEN 'com-fatos'
      ELSE 'sem-fatos-legiveis' END);
  END LOOP;
  RETURN jsonb_build_object('result','ok','student_id',_student,'as_of',_as_of,'known_at',k,'domains',_dom,
    'events', coalesce((SELECT jsonb_agg(e ORDER BY e->>'on', e->>'domain', e->>'source_id') FROM jsonb_array_elements(_ev) e), '[]'),
    'alerts', jsonb_build_object('state','bloqueado-sem-regra-homologada','items','[]'::jsonb));
END $function$;