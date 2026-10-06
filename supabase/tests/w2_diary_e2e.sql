-- Frente W.2 — E2E sintético POSITIVO do Diário + recusas. Termina em RAISE: nada persiste.
-- Cadeia: ano → período → escola/turma → alunos/alocações → pessoas/vínculos/lotações/atuações → regência (+ substituição) → jornada/grade → aula → roster → chamada → correção.
-- Dublês transacionais: resolvedor curricular U e leitura do calendário (aplicável/dia letivo), desfeitos pelo rollback;
-- nenhum ato humano real, nenhuma homologação real; 2027 nunca é aberto fora da transação.
-- Sucesso = 'w2-diary-e2e-ok: ...'.
DO $t$
DECLARE _ok text := ''; st1 text := 'stu-w2-'||gen_random_uuid(); st2 text := 'stu-w2-'||gen_random_uuid(); en1 text := 'enr-w2-'||gen_random_uuid(); en2 text := 'enr-w2-'||gen_random_uuid(); al2 text := 'al-w2-'||gen_random_uuid(); org text := 'org-w2-'||gen_random_uuid(); per text := 'per-w2-'||gen_random_uuid(); blk uuid; L1 uuid; L2 uuid; A1 uuid; A2 uuid; n0 int; n1 int; m0 int; ok boolean; _e text; r jsonb; n int;
  y27 text := 'ano-500f63b6-b71d-4000-9762-bbb65c40d21d'; s1 text; s2 text; pol uuid;
  c27 text := 'tur-w2-' || gen_random_uuid()::text;
  pd uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); eng_dir uuid;
  pt uuid := gen_random_uuid(); ut uuid := gen_random_uuid(); eng_t uuid; fl_t uuid := gen_random_uuid();
  ps uuid := gen_random_uuid(); us uuid := gen_random_uuid(); ux uuid := gen_random_uuid(); eng_s uuid; fl_s uuid := gen_random_uuid();
  px uuid := gen_random_uuid(); eng_x uuid; fl_x uuid := gen_random_uuid();
  mid text := 'mat-' || gen_random_uuid()::text; mv uuid; jh uuid; sh uuid; ta text; tah uuid; sub text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.academic_year_operational_state_at(y27)) THEN RAISE EXCEPTION 'falha: 2027 já tem estado real'; END IF;
  SELECT id INTO s1 FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.institutional_schools WHERE id <> s1 ORDER BY id LIMIT 1;
  SELECT id INTO pol FROM public.capability_policies WHERE status = 'homologated' ORDER BY version DESC LIMIT 1;

  -- Cadeia sintética mínima (rollback)
  INSERT INTO public.institutional_persons(id, display_name) VALUES (pd,'Direção sintética W2'),(pt,'Titular sintético W2'),
    (ps,'Substituto sintético W2'),(px,'Outra pessoa sintética W2');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (ud, pd), (ut, pt), (us, ps), (ux, px);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (pd,'direcao-escolar','Direção (sintético)', s1,'2027-01-01','teste-w2','escola') RETURNING id INTO eng_dir;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (pt,'professor','Professor (sintético)', s1,'2027-01-01','teste-w2','escola') RETURNING id INTO eng_t;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (ps,'professor','Professor (sintético)', s1,'2027-01-01','teste-w2','escola') RETURNING id INTO eng_s;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (px,'professor','Professor (sintético)', s1,'2027-01-01','teste-w2','escola') RETURNING id INTO eng_x;
  INSERT INTO public.professional_functional_links(logical_id, version, person_id, link_nature_id, link_nature_version, valid_from)
    VALUES (fl_t,1,pt,'sintetico',1,'2027-01-01'),(fl_s,1,ps,'sintetico',1,'2027-01-01'),(fl_x,1,px,'sintetico',1,'2027-01-01');
  INSERT INTO public.professional_postings(logical_id, version, functional_link_logical_id, school_id, valid_from, valid_until)
    VALUES (gen_random_uuid(),1,fl_t,s1,'2027-01-01',NULL),(gen_random_uuid(),1,fl_s,s1,'2027-01-01',NULL),
           (gen_random_uuid(),1,fl_x,s1,'2027-01-01',NULL);
  INSERT INTO public.institutional_classes(id, school_id, school_label_snapshot, academic_year_id, academic_year_label, name, valid_from)
    VALUES (c27, s1, 'Escola (sintético)', y27, '2027', 'Turma sintética W2', '2027-02-01');
  INSERT INTO public.institutional_class_record_versions(class_id, segment_id, version, name, administrative_status, valid_from,
      originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id, authorizing_policy_id, created_at)
    VALUES (c27, gen_random_uuid(), 1, 'Turma sintética W2', 'ativa', '2027-02-01', 'teste-w2', ud, pd, eng_dir, pol, now() - interval '1 minute');
  INSERT INTO public.institutional_curricular_components(id, label) VALUES ('comp-v1-sintetico', 'Componente sintético W2');
  INSERT INTO public.curricular_component_versions(component_id, version, official_name, is_active, valid_from, recorded_by, recorded_via_engagement_id, created_at)
    VALUES ('comp-v1-sintetico', 1, 'Componente sintético W2', true, '2027-01-01', ud, eng_dir, now() - interval '1 minute');
  INSERT INTO public.institutional_curricular_matrices(id) VALUES (mid);
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, recorded_by, recorded_via_engagement_id)
    VALUES (mid, 1, 'constituicao', 'Matriz sintética W2', '2027-01-01', ud, eng_dir) RETURNING id INTO mv;
  INSERT INTO public.curricular_matrix_items(matrix_version_id, item_key, position, component_id, component_label_snapshot)
    VALUES (mv, 'k1', 1, 'comp-v1-sintetico', 'Elemento sintético');
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    VALUES (y27, 1, 'em-preparacao', 'teste sintético W2 (rollback)', 'teste-w2-rollback');

  SELECT count(*) INTO n0 FROM public.lesson_record_versions; SELECT count(*) INTO m0 FROM public.attendance_record_versions;
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.class_curricular_matrices_at(_school text, _class_id text, _on date, _known_at timestamptz)
   RETURNS TABLE(result_kind text, class_id text, valid_on date, known_at timestamptz, context_state text, gate_effect text, state text,
     matrix_id text, matrix_version_id uuid, matrix_homologation_id uuid, allocation_count integer, total_allocations integer,
     resolved_allocations integer, column_keys text[], correspondence_ids text[], association_id text, association_version_id uuid,
     association_homologation_id uuid) LANGUAGE plpgsql STABLE SET search_path TO '' AS $b$
  BEGIN IF _class_id = current_setting('v1.class', true) THEN
      result_kind := 'matrix'; state := 'resolvida-por-posicao'; matrix_id := current_setting('v1.mid'); class_id := _class_id; valid_on := _on; matrix_version_id := current_setting('v1.mv')::uuid; RETURN NEXT; END IF; END $b$$s$;
  -- Dublês do calendário (sem fabricar homologação real): um calendário aplicável; dia letivo salvo a data em w2.nonschool.
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.calendar_applicability_candidates(_on date, _known_at timestamptz, _school text, _allocation text, _position text, _axis jsonb)
    RETURNS TABLE(resolution text, calendar_id text, version_id uuid, scope_key text) LANGUAGE sql STABLE SET search_path TO '' AS
    $b$ SELECT 'candidato'::text, 'cal-w2'::text, NULL::uuid, 'escola'::text $b$$s$;
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.calendar_day_declarations(_calendar_id text, _date date, _known_at timestamptz)
    RETURNS TABLE(day_state text, version_id uuid, reference_issue text, homologation_state text, declaration_kind text, declaration_id text,
      starts_on date, ends_on date, event_label text, day_type_id text, day_type_version_id uuid, day_type_version integer, day_type_label text, school_day_effect boolean)
    LANGUAGE sql STABLE SET search_path TO '' AS
    $b$ SELECT 'declarado'::text, NULL::uuid, NULL::text, 'homologada'::text, 'dia'::text, 'd'::text, _date, _date, NULL::text, 't'::text, NULL::uuid, 1, 'Dia'::text,
        (_date::text IS DISTINCT FROM current_setting('w2.nonschool', true)) $b$$s$;
  PERFORM set_config('v1.class', c27, true); PERFORM set_config('v1.mv', mv::text, true); PERFORM set_config('w2.nonschool', '2027-03-15', true); PERFORM set_config('v1.mid', mid, true);

  -- Direção organiza: jornada, grade (segunda-feira), atribuição do titular, substituição de abril
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := public.record_class_journey_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"12:00"}]');
  r := public.record_class_schedule_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL,
      jsonb_build_array(jsonb_build_object('block_key','b1','weekday',1,'starts_at','07:00','ends_at','07:50','matrix_version_id',mv,'item_key','k1')));
  r := public.record_teaching_assignment_version_v2(c27, NULL, NULL, 'constituicao', '2027-02-01', '2027-06-30', eng_t, fl_t, mv, 'k1', NULL, NULL, NULL, NULL, NULL);
  ta := r->>'assignment_id';
  r := public.record_teaching_substitution_version(ta, NULL, NULL, 'constituicao', '2027-04-01', '2027-04-30', eng_s, fl_s, false, NULL, 'licença sintética');
  sub := r->>'substitution_id';
  RESET ROLE;
  SELECT b.id INTO blk FROM public.class_schedule_blocks b JOIN public.class_schedule_versions v ON v.id = b.version_id JOIN public.class_schedules s ON s.id = v.schedule_id
   WHERE s.class_id = c27 LIMIT 1;

  -- Período, alunos e alocações (fixtures de fatos de origem, rollback)
  INSERT INTO public.institutional_period_organizations(id, academic_year_id) VALUES (org, y27);
  INSERT INTO public.institutional_academic_periods(id, academic_year_id, label, starts_on, ends_on, period_organization_id) VALUES (per, y27, 'P1 sintético', '2027-02-01', '2027-06-30', org);
  INSERT INTO public.institutional_academic_period_versions(period_id, version, official_name, starts_on, ends_on, is_active, valid_from, recorded_by, recorded_by_person_id, recorded_via_engagement_id, created_at)
    VALUES (per, 1, 'P1 sintético', '2027-02-01', '2027-06-30', true, '2027-02-01', ud, pd, eng_dir, now() - interval '1 minute');
  INSERT INTO public.institutional_class_period_organization_versions(class_id, version, organization_id, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id, segment_id, authorizing_policy_id, created_at)
    VALUES (c27, 1, org, '2027-02-01', 'teste-w2', ud, pd, eng_dir, gen_random_uuid(), pol, now() - interval '1 minute');
  INSERT INTO public.institutional_students(id, display_name) VALUES (st1, 'Aluno sintético A'), (st2, 'Aluno sintético B');
  INSERT INTO public.school_enrollments(id, student_id, school_id, opened_on, academic_year_id) VALUES (en1, st1, s1, '2027-02-01', y27), (en2, st2, s1, '2027-02-01', y27);
  INSERT INTO public.class_enrollment_episodes(id, logical_id, enrollment_id, student_id, school_id, class_id, class_label_snapshot, valid_from)
    VALUES ('al-w2-'||gen_random_uuid(), 'al-w2-a-'||gen_random_uuid(), en1, st1, s1, c27, 'Turma sintética', '2027-02-01'),
           (al2, al2, en2, st2, s1, c27, 'Turma sintética', '2027-03-01');   -- B entra só em março
  INSERT INTO public.class_allocation_ending_versions(allocation_logical_id, school_id, class_id, version, ended_on, reason_text, recorded_by)
    VALUES (al2, s1, c27, 1, '2027-04-30', 'transferência sintética', ud);         -- B sai em 30/04

  -- Recusas antes da operação: ano em preparação
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-1', ta, NULL, '2027-02-08', NULL, '{"content":"x"}', ARRAY[blk], '{}', NULL, NULL, 'w2-p0');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:year-not-operational:em-preparacao' THEN RAISE EXCEPTION 'falha preparação: %', _e; END IF; END;
  IF NOT EXISTS (SELECT 1 FROM public.my_diaries_at('2027-02-08', now()) d WHERE d.assignment_id = ta AND d.year_state = 'em-preparacao') THEN RAISE EXCEPTION 'falha: meus diários em preparação'; END IF;
  RESET ROLE;
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, supersedes_id, reason, technical_provenance)
    SELECT y27, 2, 'operacional', id, 'teste sintético W2 (rollback)', 'teste-w2-rollback' FROM public.academic_year_operational_states WHERE academic_year_id = y27 AND sequence = 1;
  _ok := _ok || 'preparacao-bloqueia ';

  -- anon / service_role / writer legado
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-1', ta, NULL, '2027-02-08', NULL, '{}', '{}', '{}', NULL, NULL, 'w2-a'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE service_role;
  BEGIN PERFORM public.record_attendance_version_v2('aula:w2-1', NULL, '{"aula":{}}', NULL, 'w2-s'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.diary_school_overview_at(s1, '2027-02-01', '2027-02-28'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_lesson_version('aula:w2-1', c27, 'x', ta, '2027-02-08', NULL, '{}', 'p', NULL, NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  _ok := _ok || 'anon/service_role/legado-negados ';

  -- Titular: aula + roster + chamada
  IF NOT EXISTS (SELECT 1 FROM public.my_diary_slots_at(ta, NULL, '2027-02-08') x WHERE x.block_id = blk) THEN RAISE EXCEPTION 'falha: aula prevista'; END IF;
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-x', ta, NULL, '2027-03-15', NULL, '{"content":"x"}', ARRAY[blk], '{}', NULL, NULL, 'w2-nl');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:not-a-school-day' THEN RAISE EXCEPTION 'falha dia não letivo: %', _e; END IF; END;
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-x', ta, NULL, '2027-07-05', NULL, '{"content":"x"}', '{}', '{}', NULL, NULL, 'w2-fora');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:assignment-not-effective' THEN RAISE EXCEPTION 'falha fora da atribuição: %', _e; END IF; END;
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-x', ta, NULL, '2027-02-09', NULL, '{"content":"x"}', ARRAY[blk], '{}', NULL, NULL, 'w2-bl');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:block-not-in-schedule' THEN RAISE EXCEPTION 'falha bloco de outro dia: %', _e; END IF; END;
  L1 := public.record_lesson_version_v2('aula:w2-1', ta, NULL, '2027-02-08', NULL, '{"content":"Conteúdo sintético"}', ARRAY[blk], '{}', NULL, NULL, 'w2-p1');
  IF public.record_lesson_version_v2('aula:w2-1', ta, NULL, '2027-02-08', NULL, '{"content":"Conteúdo sintético"}', ARRAY[blk], '{}', NULL, NULL, 'w2-p1') <> L1 THEN RAISE EXCEPTION 'falha idempotência'; END IF;
  IF EXISTS (SELECT 1 FROM public.diary_roster_at(ta, NULL, '2027-02-08') x WHERE x.student_id = st2)
     OR NOT EXISTS (SELECT 1 FROM public.diary_roster_at(ta, NULL, '2027-02-08') x WHERE x.student_id = st1) THEN RAISE EXCEPTION 'falha: roster antes da alocação'; END IF;
  BEGIN PERFORM public.record_attendance_version_v2('aula:w2-1', NULL, jsonb_build_object('aula', jsonb_build_object(st2, 'Presente')), NULL, 'w2-c0');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:student-not-allocated-on-lesson-date' THEN RAISE EXCEPTION 'falha aluno fora: %', _e; END IF; END;
  BEGIN PERFORM public.record_attendance_version_v2('aula:w2-1', NULL, jsonb_build_object('aula', jsonb_build_object(st1, 'Falta justificada')), NULL, 'w2-c00');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:invalid-mark' THEN RAISE EXCEPTION 'falha marcação inventada: %', _e; END IF; END;
  A1 := public.record_attendance_version_v2('aula:w2-1', NULL, jsonb_build_object('aula', jsonb_build_object(st1, 'Presente')), NULL, 'w2-c1');
  _ok := _ok || 'aula-prevista dia-nao-letivo fora-atribuicao bloco aula idempotente roster-antes chamada ';

  -- Aula de março: B elegível; B fica SEM marcação (≠ ausente)
  L2 := public.record_lesson_version_v2('aula:w2-2', ta, NULL, '2027-03-08', NULL, '{"content":"Março"}', ARRAY[blk], '{}', NULL, NULL, 'w2-p2');
  A2 := public.record_attendance_version_v2('aula:w2-2', NULL, jsonb_build_object('aula', jsonb_build_object(st1, 'Ausente')), NULL, 'w2-c2');
  IF NOT (SELECT st2 = ANY(eligible_student_ids) AND NOT (marks->'aula' ? st2) FROM public.attendance_record_versions WHERE id = A2) THEN RAISE EXCEPTION 'falha: pendente ≠ ausente'; END IF;
  _ok := _ok || 'durante-alocacao pendente-nao-e-falta ';

  -- Stale-head e correção sem regra homologada
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-1', ta, NULL, '2027-02-08', NULL, '{"content":"corr"}', ARRAY[blk], '{}', 'j', NULL, 'w2-st');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:stale-head' THEN RAISE EXCEPTION 'falha stale: %', _e; END IF; END;
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-1', ta, NULL, '2027-02-08', L1, '{"content":"corr"}', ARRAY[blk], '{}', 'j', NULL, 'w2-cr0');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:correction-policy-missing' THEN RAISE EXCEPTION 'falha sem regra: %', _e; END IF; END;
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-1', ta, NULL, '2027-02-08', NULL, '{"content":"x"}', ARRAY[blk], '{}', NULL, NULL, 'w2-p1-outro');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:stale-head' THEN RAISE EXCEPTION 'falha concorrência: %', _e; END IF; END;
  RESET ROLE;
  -- Regra de correção SINTÉTICA vigente só em 2027 (rollback) — prova vigência pela data da aula, não pelo relógio
  INSERT INTO public.diary_correction_policies(logical_policy_id, version, status, family_id, applies_when_official_closing, outcome, required_capabilities, requirement_codes, admissible_changes, valid_from, valid_until)
    VALUES ('w2-sint-aula', 1, 'homologada', 'registro-de-aula', 'any', 'admissible', '{}', ARRAY['justificativa'], '{}', '2027-01-01', '2027-12-31'),
           ('w2-sint-freq', 1, 'homologada', 'frequencia', 'any', 'admissible', '{}', ARRAY['justificativa'], '{}', '2027-01-01', '2027-12-31');
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-1', ta, NULL, '2027-02-08', L1, '{"content":"corr"}', ARRAY[blk], '{}', ' ', NULL, 'w2-cr1');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:justification-required' THEN RAISE EXCEPTION 'falha justificativa: %', _e; END IF; END;
  L1 := public.record_lesson_version_v2('aula:w2-1', ta, NULL, '2027-02-08', L1, '{"content":"Conteúdo corrigido"}', ARRAY[blk], '{}', 'correção sintética', ARRAY['content'], 'w2-cr2');
  BEGIN PERFORM public.record_attendance_version_v2('aula:w2-1', A1, '{"aula":{}}', 'j', 'w2-ca0');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:empty-attendance' THEN RAISE EXCEPTION 'falha remoção: %', _e; END IF; END;
  A1 := public.record_attendance_version_v2('aula:w2-1', A1, jsonb_build_object('aula', jsonb_build_object(st1, 'Ausente')), 'correção sintética', 'w2-ca1');
  IF (SELECT version_number FROM public.lesson_record_versions WHERE id = L1) <> 2 OR (SELECT version_number FROM public.attendance_record_versions WHERE id = A1) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.my_diary_lessons(ta, NULL) x WHERE x.lesson_version_id = L1 AND x.attendance_version_id = A1 AND x.version_number = 2)
     OR (SELECT count(*) FROM public.my_diary_lessons(ta, NULL)) <> 2 THEN RAISE EXCEPTION 'falha: cadeia de versões'; END IF;
  _ok := _ok || 'stale-head concorrencia sem-regra-bloqueia correcao-versionada ';

  -- Outro professor (com lotação, sem regência) e pessoa sem capability
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ux, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-9', ta, NULL, '2027-02-15', NULL, '{"content":"x"}', '{}', '{}', NULL, NULL, 'w2-x');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:not-assignment-holder' THEN RAISE EXCEPTION 'falha outro professor: %', _e; END IF; END;
  IF EXISTS (SELECT 1 FROM public.my_diary_lessons(ta, NULL)) OR EXISTS (SELECT 1 FROM public.my_diaries_at('2027-02-15', now())) THEN RAISE EXCEPTION 'falha: lotação concede diário'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-9', ta, NULL, '2027-02-15', NULL, '{"content":"x"}', '{}', '{}', NULL, NULL, 'w2-d');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:not-assignment-holder' THEN RAISE EXCEPTION 'falha direção escreve: %', _e; END IF; END;
  -- Visão administrativa somente leitura (Direção da própria escola): vê existência/contagens, sem texto
  IF (SELECT count(*) FROM public.diary_school_overview_at(s1, '2027-02-01', '2027-03-31') o WHERE o.result_kind = 'lesson' AND o.class_id = c27) <> 2
    THEN RAISE EXCEPTION 'falha: visão Direção'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.diary_school_overview_at(s2, '2027-02-01', '2027-03-31') o WHERE o.result_kind = 'access-denied') THEN RAISE EXCEPTION 'falha: Direção outra escola'; END IF;
  _ok := _ok || 'outro-professor lotacao-sem-regencia direcao-nao-escreve visao-direcao outra-escola-negada ';

  -- Substituto: só na janela; nova aula em maio sem B (saída 30/04); histórico de março preservado
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-s0', ta, sub, '2027-05-03', NULL, '{"content":"x"}', '{}', '{}', NULL, NULL, 'w2-s0');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:substitution-not-effective' THEN RAISE EXCEPTION 'falha substituto fora: %', _e; END IF; END;
  BEGIN PERFORM public.record_lesson_version_v2('aula:w2-s0', ta, NULL, '2027-04-05', NULL, '{"content":"x"}', '{}', '{}', NULL, NULL, 'w2-s00');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:not-assignment-holder' THEN RAISE EXCEPTION 'falha substituto como titular: %', _e; END IF; END;
  PERFORM public.record_lesson_version_v2('aula:w2-s1', ta, sub, '2027-04-05', NULL, '{"content":"Substituição"}', ARRAY[blk], '{}', NULL, NULL, 'w2-s1');
  PERFORM public.record_attendance_version_v2('aula:w2-s1', NULL, jsonb_build_object('aula', jsonb_build_object(st1, 'Presente', st2, 'Presente')), NULL, 'w2-sc1');
  IF (SELECT count(*) FROM public.my_diary_lessons(ta, sub)) <> 1 THEN RAISE EXCEPTION 'falha: substituto vê só a janela'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);
  PERFORM public.record_lesson_version_v2('aula:w2-3', ta, NULL, '2027-05-03', NULL, '{"content":"Maio"}', ARRAY[blk], '{}', NULL, NULL, 'w2-p3');
  IF EXISTS (SELECT 1 FROM public.diary_roster_at(ta, NULL, '2027-05-03') x WHERE x.student_id = st2) THEN RAISE EXCEPTION 'falha: transferido em nova aula'; END IF;
  BEGIN PERFORM public.record_attendance_version_v2('aula:w2-3', NULL, jsonb_build_object('aula', jsonb_build_object(st2, 'Presente')), NULL, 'w2-c3');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'diary:student-not-allocated-on-lesson-date' THEN RAISE EXCEPTION 'falha transferido: %', _e; END IF; END;
  IF NOT (SELECT st2 = ANY(eligible_student_ids) FROM public.attendance_record_versions WHERE id = A2) THEN RAISE EXCEPTION 'falha: histórico março'; END IF;
  RESET ROLE;
  _ok := _ok || 'substituto-janela substituto-nao-titular transferencia historico-preservado ';

  -- Plano ≠ aula: nenhuma aula nasce de planejamento ou passagem de tempo
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname LIKE '%teaching_plan%' AND prosrc ILIKE '%lesson_record_versions%' AND prosrc ILIKE '%insert%') THEN RAISE EXCEPTION 'falha: plano grava aula'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('record_lesson_version_v2','record_attendance_version_v2','diary_teacher_actor','diary_holder_scope','my_diary_slots_at','my_diary_lessons','diary_school_overview_at','applicable_diary_policy_on')
      AND (prosrc ILIKE '%current_date%' OR NOT proconfig @> ARRAY['search_path=""'])) THEN RAISE EXCEPTION 'falha: current_date/search_path'; END IF;
  _ok := _ok || 'plano-nao-e-aula sem-current-date ';
  SELECT count(*) INTO n1 FROM public.lesson_record_versions;
  _ok := _ok || 'aulas-na-transacao=' || (n1 - n0) || ' ';
  RAISE EXCEPTION 'w2-diary-e2e-ok: %', _ok;
END $t$;
