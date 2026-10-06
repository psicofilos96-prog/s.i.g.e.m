-- Frente AA.2 — E2E sintético da Avaliação: instrumento → planejada → aplicada (data diferente) → resultados (zero e "não registrado")
-- → correção → completude → conferência → alteração invalida → reconferência; oficialização/publicação/cálculo bloqueados sem regra.
-- Reaproveita a cadeia sintética da W.2 (dublês transacionais). Termina em RAISE: nada persiste. Sucesso = 'aa2-assessment-e2e-ok: ...'.
DO $t$
DECLARE _ok text := ''; ins text := 'ins-aa2-'||gen_random_uuid(); ev uuid; fp text; fp2 text; cf uuid; g jsonb; v1 uuid; v2 uuid; e0 int; st1 text := 'stu-w2-'||gen_random_uuid(); st2 text := 'stu-w2-'||gen_random_uuid(); en1 text := 'enr-w2-'||gen_random_uuid(); en2 text := 'enr-w2-'||gen_random_uuid(); al2 text := 'al-w2-'||gen_random_uuid(); org text := 'org-w2-'||gen_random_uuid(); per text := 'per-w2-'||gen_random_uuid(); blk uuid; L1 uuid; L2 uuid; A1 uuid; A2 uuid; n0 int; n1 int; m0 int; ok boolean; _e text; r jsonb; n int;
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

  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, supersedes_id, reason, technical_provenance)
    SELECT y27, 2, 'operacional', id, 'teste sintético AA2 (rollback)', 'teste-aa2-rollback' FROM public.academic_year_operational_states WHERE academic_year_id = y27 AND sequence = 1;
  SELECT count(*) INTO e0 FROM public.assessment_entry_versions;

  -- anon / service_role negados
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.create_assessment_instrument_v2(ins, ta, per, 'prova', '{}', '2027-03-08', '{}'); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.assessment_instrument_governance_state(ins); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE service_role;
  BEGIN PERFORM public.record_assessment_conference(ins, NULL, repeat('0',64)); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.register_assessment_results_v2(ins, 'p', 'c', 0, NULL, '[]'); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.register_assessment_results('x','p','c',0,NULL,'[]'); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.record_period_closing_act('k', per, '{}', 'entrega-docente', NULL, NULL, NULL, NULL, '{}'); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  _ok := _ok || 'anon/service_role/legado-negados ';

  -- Titular cria instrumento (planejado 08/03) e aplica em 15/03... (15/03 é não letivo no dublê, irrelevante p/ avaliação) — usa 22/03
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.create_assessment_instrument_v2(ins, ta, per, 'prova', '{}', '2027-07-05', '{}'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e NOT IN ('diary:assignment-not-effective','aa:period-mismatch') THEN RAISE EXCEPTION 'falha fora do período: %', _e; END IF; END;
  PERFORM public.create_assessment_instrument_v2(ins, ta, per, 'prova', '{"title":"Prova sintética"}', '2027-03-08', '{}');
  BEGIN PERFORM public.register_assessment_results_v2(ins, 'aa2-r0', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st1, 'value', '{"kind":"numerica","value":0}'::jsonb))); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'aa:instrument-not-applied' THEN RAISE EXCEPTION 'falha resultado antes da aplicação: %', _e; END IF; END;
  IF public.assessment_instrument_completeness(ins)->>'reason' <> 'not-applied' THEN RAISE EXCEPTION 'falha completude antes da aplicação'; END IF;
  BEGIN PERFORM public.apply_assessment_instrument_v2(ins, gen_random_uuid(), '2027-03-22'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'aa:stale-head' THEN RAISE EXCEPTION 'falha stale aplicação: %', _e; END IF; END;
  ev := public.apply_assessment_instrument_v2(ins, NULL, '2027-03-22');
  RESET ROLE;
  IF (SELECT applied_on FROM public.assessment_instrument_status_events WHERE id = ev) IS DISTINCT FROM '2027-03-22' OR (SELECT planned_on FROM public.assessment_instruments WHERE id = ins) IS DISTINCT FROM '2027-03-08'
    THEN RAISE EXCEPTION 'falha datas planejada/aplicada'; END IF;
  SET LOCAL ROLE authenticated;
  _ok := _ok || 'fora-periodo resultado-antes-aplicacao stale-aplicacao planejada≠aplicada ';

  -- Outro professor (lotação sem regência) recusado
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ux, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.register_assessment_results_v2(ins, 'aa2-x', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st1, 'value', '{"kind":"numerica","value":5}'::jsonb))); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'diary:not-assignment-holder' THEN RAISE EXCEPTION 'falha outro professor: %', _e; END IF; END;
  IF public.assessment_instrument_governance_state(ins)->>'reason' <> 'access-denied' THEN RAISE EXCEPTION 'falha: outro professor lê conferência'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);

  -- Elegibilidade na data aplicada (22/03): A e B elegíveis. Aluno inexistente recusado.
  BEGIN PERFORM public.register_assessment_results_v2(ins, 'aa2-z', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', 'stu-inexistente', 'value', '{"kind":"numerica","value":5}'::jsonb))); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e NOT LIKE 'aa:student-not-allocated-on-date:%' THEN RAISE EXCEPTION 'falha não elegível: %', _e; END IF; END;
  -- Zero real para A; B sem lançamento ⇒ incompleto (ausência ≠ zero)
  PERFORM public.register_assessment_results_v2(ins, 'aa2-r1', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st1, 'value', '{"kind":"numerica","value":0}'::jsonb)));
  g := public.assessment_instrument_completeness(ins);
  IF g->>'state' <> 'incompleto' OR (g->>'eligible_count')::int <> 2 OR (g->>'recorded_count')::int <> 1 OR NOT (g->'missing_student_ids' ? st2) THEN RAISE EXCEPTION 'falha completude parcial: %', g; END IF;
  BEGIN PERFORM public.record_assessment_conference(ins, NULL, g->>'fingerprint'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'aa:incomplete' THEN RAISE EXCEPTION 'falha conferência incompleta: %', _e; END IF; END;
  -- B: "não registrado" explícito exige motivo e conta separado de zero
  BEGIN PERFORM public.register_assessment_results_v2(ins, 'aa2-r2x', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st2, 'value', '{"kind":"nao-registrado","reason":""}'::jsonb))); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e NOT LIKE 'missing-reason-required:%' THEN RAISE EXCEPTION 'falha motivo: %', _e; END IF; END;
  PERFORM public.register_assessment_results_v2(ins, 'aa2-r2', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st2, 'value', '{"kind":"nao-registrado","reason":"ausente na aplicação"}'::jsonb)));
  g := public.assessment_instrument_completeness(ins);
  IF g->>'state' <> 'completo' OR (g->>'recorded_count')::int <> 1 OR (g->>'explicit_not_recorded_count')::int <> 1 THEN RAISE EXCEPTION 'falha completude: %', g; END IF;
  RESET ROLE; IF (SELECT value->>'value' FROM public.assessment_entry_versions WHERE instrument_id = ins AND student_id = st1) IS DISTINCT FROM '0' THEN RAISE EXCEPTION 'falha zero real'; END IF; SET LOCAL ROLE authenticated;
  _ok := _ok || 'outro-professor nao-elegivel zero-real ausencia≠zero nao-registrado-explicito completude ';

  -- Conferência: fingerprint esperado, stale-head, idempotência
  BEGIN PERFORM public.record_assessment_conference(ins, NULL, repeat('a',64)); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'aa:fingerprint-changed' THEN RAISE EXCEPTION 'falha fingerprint: %', _e; END IF; END;
  fp := g->>'fingerprint';
  cf := public.record_assessment_conference(ins, NULL, fp);
  BEGIN PERFORM public.record_assessment_conference(ins, NULL, fp); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'aa:stale-head' THEN RAISE EXCEPTION 'falha stale conferência: %', _e; END IF; END;
  BEGIN PERFORM public.record_assessment_conference(ins, cf, fp); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'aa:already-conferred' THEN RAISE EXCEPTION 'falha reconferência idêntica: %', _e; END IF; END;
  g := public.assessment_instrument_governance_state(ins);
  IF g->>'conference_state' <> 'vigente' OR g->>'publication' <> 'aguardando-regra-homologada' OR g->>'calculation' <> 'bloqueado-sem-regra-homologada' THEN RAISE EXCEPTION 'falha governança: %', g; END IF;
  -- Oficialização sem competência homologada: recusada, nada gravado
  BEGIN PERFORM public.record_assessment_officialization(ins, cf); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e NOT IN ('aa:officialization-competence-unhomologated','aa:capability-missing') THEN RAISE EXCEPTION 'falha oficialização: %', _e; END IF; END;
  _ok := _ok || 'conferencia fingerprint stale idempotente oficializacao-bloqueada publicacao-aguardando calculo-bloqueado ';

  -- Correção: stale-head e sem regra ⇒ recusa; com regra sintética 2027 ⇒ nova versão; conferência invalida
  RESET ROLE; SELECT id INTO v1 FROM public.assessment_entry_versions WHERE instrument_id = ins AND student_id = st1; SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.register_assessment_results_v2(ins, 'aa2-c0', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st1, 'value', '{"kind":"numerica","value":7}'::jsonb))); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e NOT LIKE 'concurrent-change:%' THEN RAISE EXCEPTION 'falha stale resultado: %', _e; END IF; END;
  RESET ROLE;
  IF NOT EXISTS (SELECT 1 FROM public.assessment_correction_policies p WHERE p.status='homologated' AND (p.valid_from IS NULL OR p.valid_from <= '2027-03-22') AND (p.valid_until IS NULL OR p.valid_until >= '2027-03-22')) THEN
    SET LOCAL ROLE authenticated;
    BEGIN PERFORM public.register_assessment_results_v2(ins, 'aa2-c1', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st1, 'expectedBaseVersionId', v1, 'value', '{"kind":"numerica","value":7}'::jsonb, 'rectification', '{}'::jsonb))); RAISE EXCEPTION 'aberto';
      EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e NOT LIKE 'correction-policy-missing:%' THEN RAISE EXCEPTION 'falha sem regra: %', _e; END IF; END;
    RESET ROLE; _ok := _ok || 'correcao-sem-regra-bloqueia ';
  END IF;
  -- Regra sintética só para 2027 e só nesta turma (rollback)
  INSERT INTO public.assessment_correction_policies(logical_policy_id, version, status, class_id, applies_when_period_closing, outcome, required_capabilities, requirement_codes, definition, valid_from, valid_until)
    VALUES ('aa2-sint', 1, 'homologated', c27, 'any', 'admissible', '{}', ARRAY['justificativa'], '{}', '2027-01-01', '2027-12-31');
  SET LOCAL ROLE authenticated;
  v2 := public.register_assessment_results_v2(ins, 'aa2-c2', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st1, 'expectedBaseVersionId', v1, 'value', '{"kind":"numerica","value":7}'::jsonb,
     'rectification', jsonb_build_object('policyId','aa2-sint','policyVersion','1','justification','correção sintética','satisfiedRequirements', jsonb_build_array(jsonb_build_object('code','justificativa'))))));
  RESET ROLE;
  IF (SELECT count(*) FROM public.assessment_entry_versions WHERE instrument_id = ins AND student_id = st1) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.assessment_entry_versions WHERE id = v1) THEN RAISE EXCEPTION 'falha: correção não versionou'; END IF;
  SET LOCAL ROLE authenticated;
  g := public.assessment_instrument_governance_state(ins);
  IF g->>'conference_state' <> 'requer-reconferencia' THEN RAISE EXCEPTION 'falha: alteração não invalidou conferência: %', g; END IF;
  fp2 := g->'completeness'->>'fingerprint';
  IF fp2 = fp THEN RAISE EXCEPTION 'falha fingerprint inalterado'; END IF;
  BEGIN PERFORM public.record_assessment_officialization(ins, cf); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e NOT IN ('aa:officialization-competence-unhomologated','aa:capability-missing','aa:conference-not-current') THEN RAISE EXCEPTION 'falha oficialização superada: %', _e; END IF; END;
  PERFORM public.record_assessment_conference(ins, cf, fp2);
  IF public.assessment_instrument_governance_state(ins)->>'conference_state' <> 'vigente' THEN RAISE EXCEPTION 'falha reconferência'; END IF;
  _ok := _ok || 'correcao-versionada alteracao-invalida reconferencia ';

  -- Fechamento oficial recusado: Direção sem fechamento nem norma; professor sem capacidade de homologar
  BEGIN PERFORM public.record_period_closing_act_v2(c27||'|'||per, per, '{}', 'fechamento-oficial', NULL, NULL, NULL, 'x', '{}', '2027-06-30'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; _ok := _ok || 'fechamento-recusado(' || split_part(_e, ':', 1) || ') '; END;
  BEGIN PERFORM public.record_period_closing_act_v2(c27||'|'||per, per, '{}', 'entrega-docente', NULL, NULL, NULL, NULL, '{}', '2026-12-01'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'closing:effective-outside-period' THEN RAISE EXCEPTION 'falha data fechamento: %', _e; END IF; END;
  RESET ROLE;
  -- Transferência: B sai 30/04; instrumento aplicado em maio não o tem como elegível
  SET LOCAL ROLE authenticated;
  PERFORM public.create_assessment_instrument_v2(ins||'-m', ta, per, 'prova', '{}', '2027-05-03', '{}');
  PERFORM public.apply_assessment_instrument_v2(ins||'-m', NULL, '2027-05-10');
  BEGIN PERFORM public.register_assessment_results_v2(ins||'-m', 'aa2-m', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st2, 'value', '{"kind":"numerica","value":5}'::jsonb))); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e NOT LIKE 'aa:student-not-allocated-on-date:%' THEN RAISE EXCEPTION 'falha transferido: %', _e; END IF; END;
  IF (public.assessment_instrument_completeness(ins||'-m')->>'eligible_count')::int <> 1 THEN RAISE EXCEPTION 'falha elegíveis maio'; END IF;
  RESET ROLE;
  _ok := _ok || 'transferencia-data-aplicada ';

  -- Sem relógio civil nos writers AA vigentes
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname IN ('create_assessment_instrument_v2','apply_assessment_instrument_v2','register_assessment_results_v2','register_assessment_results',
     'record_period_closing_act_v2','register_academic_standings_v2','record_assessment_item_version_v2','record_teacher_instrument_version_v2','record_assessment_conference','record_assessment_officialization','assessment_instrument_completeness','aa_instrument_completeness_internal')
     AND p.prosrc ~* 'current_date') THEN RAISE EXCEPTION 'falha current_date'; END IF;
  _ok := _ok || 'sem-current-date resultados-na-transacao=' || ((SELECT count(*) FROM public.assessment_entry_versions) - e0) || ' ';
  RAISE EXCEPTION 'aa2-assessment-e2e-ok: %', _ok;
END $t$;
