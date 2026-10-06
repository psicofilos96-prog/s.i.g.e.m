-- BO.4: igual ao BO.3, mas a Direção é conta Auth BO real (GUC bo4.ud/pd/eng definidos pelo runner a partir do provisionador 0194).
-- Origem BO.3: bo3-bd-e2e-ok — DIARIO, AVALIACAO e CADEIA completos; rollback por sentinela; zero resíduos verificado externamente.
-- BO.3 — Orquestrador BD integrado 2027. UM envio = UMA transação; vários blocos DO compartilham estado por GUC local 'bo3.ids'.
-- Sessão = SET LOCAL ROLE authenticated + request.jwt.claims (mesmo mecanismo dos E2E oficiais W2/AA2). Termina em sentinela RAISE ⇒ ROLLBACK.
-- Sucesso = 'bo3-bd-e2e-ok: ...'. NÃO usa dublê de effective_scope_capabilities, política/regra de capacidade de teste nem regra de correção sintética.
-- Pré-condições inseridas na transação (documentadas em docs/frente-bo-fechamento-tecnico-academico.md §BO.3):
--   P1 pessoas+user_person_links+atuações de quem chama (record_engagement exige ator já autorizado; é exercido no bloco C);
--   P2 vínculo funcional/lotação (natureza não homologada); P3 turma 2027 + versão (escola real só como escopo, não alterada);
--   P4 componente/matriz/item; P5 estado operacional do ano sintético (ato humano real proibido); P6 período/organização;
--   P7 estudantes/matrícula/alocações sintéticos; P8 dublês transacionais de resolução curricular e calendário (homologar calendário 2027 = configurar 2027);
--   P9 autorização familiar (nenhum papel homologado tem manter-autorizacao-de-responsavel; o writer é exercido e recusa).
DO $t$
DECLARE _ok text := ''; st1 text := 'stu-bo3-'||gen_random_uuid(); st2 text := 'stu-bo3-'||gen_random_uuid(); en1 text := 'enr-bo3-'||gen_random_uuid(); en2 text := 'enr-bo3-'||gen_random_uuid();
  al2 text := 'al-bo3-'||gen_random_uuid(); org text := 'org-bo3-'||gen_random_uuid(); per text := 'per-bo3-'||gen_random_uuid(); blk uuid; L1 uuid; A1 uuid; A2 uuid; _e text; r jsonb;
  y27 text := 'ano-500f63b6-b71d-4000-9762-bbb65c40d21d'; s1 text; s2 text; pol uuid; c27 text := 'tur-bo3-'||gen_random_uuid();
  pd uuid := nullif(current_setting('bo4.pd', true),'')::uuid; ud uuid := nullif(current_setting('bo4.ud', true),'')::uuid; eng_dir uuid := nullif(current_setting('bo4.eng', true),'')::uuid; pt uuid := gen_random_uuid(); ut uuid := gen_random_uuid(); eng_t uuid; fl_t uuid := gen_random_uuid();
  ps uuid := gen_random_uuid(); us uuid := gen_random_uuid(); eng_s uuid; fl_s uuid := gen_random_uuid(); px uuid := gen_random_uuid(); ux uuid := gen_random_uuid(); eng_x uuid; fl_x uuid := gen_random_uuid();
  mid text := 'mat-'||gen_random_uuid(); mv uuid; ta text; sub text;
BEGIN
  IF ud IS NULL OR pd IS NULL OR eng_dir IS NULL THEN RAISE EXCEPTION 'falha bo4: identidade Auth BO real ausente (UUID inventado proibido)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = ud) THEN RAISE EXCEPTION 'falha bo4: auth user inexistente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.user_id = ud AND a.person_id = pd AND a.engagement_id = eng_dir) THEN RAISE EXCEPTION 'falha bo4: conta não registrada pelo provisionador 0194'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.user_id = nullif(current_setting('bo4.ua', true),'')::uuid) THEN RAISE EXCEPTION 'falha bo4: administração não é conta BO real'; END IF;
  IF EXISTS (SELECT 1 FROM public.academic_year_operational_state_at(y27)) THEN RAISE EXCEPTION 'falha: 2027 já tem estado real'; END IF;
  SELECT id INTO s1 FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.institutional_schools WHERE id <> s1 ORDER BY id LIMIT 1;
  SELECT id INTO pol FROM public.capability_policies WHERE status = 'homologated' ORDER BY version DESC LIMIT 1;
  INSERT INTO public.institutional_persons(id, display_name) VALUES (pt,'BO3 Titular sintético'),(ps,'BO3 Substituto sintético'),(px,'BO3 Outro professor sintético');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (ut, pt), (us, ps), (ux, px);
  -- BO.4: Direção = conta Auth BO real (pessoa+atuação do provisionador 0194, sem INSERT aqui).
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role', 'authenticated')::text, true); SET LOCAL ROLE authenticated;
  IF (SELECT count(DISTINCT capability_id) FROM public.effective_capabilities()) <> 36 THEN RAISE EXCEPTION 'falha bo4: capabilities v8 da sessão real <> 36'; END IF;
  -- Administração = 2ª conta Auth BO real (110 capabilities v8) concede à Direção real, pelo writer oficial, atuação que cobre 2027 (revertida no fim).
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', nullif(current_setting('bo4.ua', true),'')::uuid, 'role', 'authenticated')::text, true);
  IF (SELECT count(DISTINCT capability_id) FROM public.effective_capabilities()) <> 110 THEN RAISE EXCEPTION 'falha bo4: capabilities v8 administração <> 110'; END IF;
  eng_dir := public.record_engagement(pd, 'direcao-escolar', 'escola', s1, NULL, NULL, NULL, current_date, NULL, NULL, 'Direção (BO4)');
  RESET ROLE;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (pt,'professor','Professor (BO3)', s1,'2026-01-01','teste-bo3','escola') RETURNING id INTO eng_t;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (ps,'professor','Professor (BO3)', s1,'2026-01-01','teste-bo3','escola') RETURNING id INTO eng_s;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (px,'professor','Professor (BO3)', s1,'2026-01-01','teste-bo3','escola') RETURNING id INTO eng_x;
  INSERT INTO public.professional_functional_links(logical_id, version, person_id, link_nature_id, link_nature_version, valid_from)
    VALUES (fl_t,1,pt,'sintetico',1,'2027-01-01'),(fl_s,1,ps,'sintetico',1,'2027-01-01'),(fl_x,1,px,'sintetico',1,'2027-01-01');
  INSERT INTO public.professional_postings(logical_id, version, functional_link_logical_id, school_id, valid_from, valid_until)
    VALUES (gen_random_uuid(),1,fl_t,s1,'2027-01-01',NULL),(gen_random_uuid(),1,fl_s,s1,'2027-01-01',NULL),(gen_random_uuid(),1,fl_x,s1,'2027-01-01',NULL);
  INSERT INTO public.institutional_classes(id, school_id, school_label_snapshot, academic_year_id, academic_year_label, name, valid_from)
    VALUES (c27, s1, 'Escola (BO3)', y27, '2027', 'Turma sintética BO3', '2027-02-01');
  INSERT INTO public.institutional_class_record_versions(class_id, segment_id, version, name, administrative_status, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id, authorizing_policy_id, created_at)
    VALUES (c27, gen_random_uuid(), 1, 'Turma sintética BO3', 'ativa', '2027-02-01', 'teste-bo3', ud, pd, eng_dir, pol, now() - interval '1 minute');
  INSERT INTO public.institutional_curricular_components(id, label) VALUES ('comp-v1-sintetico', 'Componente sintético BO3');
  INSERT INTO public.curricular_component_versions(component_id, version, official_name, is_active, valid_from, recorded_by, recorded_via_engagement_id, created_at)
    VALUES ('comp-v1-sintetico', 1, 'Componente sintético BO3', true, '2027-01-01', ud, eng_dir, now() - interval '1 minute');
  INSERT INTO public.institutional_curricular_matrices(id) VALUES (mid);
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, recorded_by, recorded_via_engagement_id)
    VALUES (mid, 1, 'constituicao', 'Matriz sintética BO3', '2027-01-01', ud, eng_dir) RETURNING id INTO mv;
  INSERT INTO public.curricular_matrix_items(matrix_version_id, item_key, position, component_id, component_label_snapshot) VALUES (mv, 'k1', 1, 'comp-v1-sintetico', 'Elemento sintético');
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance) VALUES (y27, 1, 'em-preparacao', 'BO3 (rollback)', 'teste-bo3-rollback');
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.class_curricular_matrices_at(_school text, _class_id text, _on date, _known_at timestamptz)
   RETURNS TABLE(result_kind text, class_id text, valid_on date, known_at timestamptz, context_state text, gate_effect text, state text, matrix_id text, matrix_version_id uuid, matrix_homologation_id uuid, allocation_count integer, total_allocations integer, resolved_allocations integer, column_keys text[], correspondence_ids text[], association_id text, association_version_id uuid, association_homologation_id uuid) LANGUAGE plpgsql STABLE SET search_path TO '' AS $b$
  BEGIN IF _class_id = current_setting('v1.class', true) THEN result_kind := 'matrix'; state := 'resolvida-por-posicao'; matrix_id := current_setting('v1.mid'); class_id := _class_id; valid_on := _on; matrix_version_id := current_setting('v1.mv')::uuid; RETURN NEXT; END IF; END $b$$s$;
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.calendar_applicability_candidates(_on date, _known_at timestamptz, _school text, _allocation text, _position text, _axis jsonb)
    RETURNS TABLE(resolution text, calendar_id text, version_id uuid, scope_key text) LANGUAGE sql STABLE SET search_path TO '' AS $b$ SELECT 'candidato'::text, 'cal-bo3'::text, NULL::uuid, 'escola'::text $b$$s$;
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.calendar_day_declarations(_calendar_id text, _date date, _known_at timestamptz)
    RETURNS TABLE(day_state text, version_id uuid, reference_issue text, homologation_state text, declaration_kind text, declaration_id text, starts_on date, ends_on date, event_label text, day_type_id text, day_type_version_id uuid, day_type_version integer, day_type_label text, school_day_effect boolean)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$ SELECT 'declarado'::text, NULL::uuid, NULL::text, 'homologada'::text, 'dia'::text, 'd'::text, _date, _date, NULL::text, 't'::text, NULL::uuid, 1, 'Dia'::text, (_date::text IS DISTINCT FROM current_setting('w2.nonschool', true)) $b$$s$;
  PERFORM set_config('v1.class', c27, true); PERFORM set_config('v1.mv', mv::text, true); PERFORM set_config('w2.nonschool', '2027-03-15', true); PERFORM set_config('v1.mid', mid, true);

  -- Direção organiza (writers oficiais): jornada, grade, atribuição do titular, substituição
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := public.record_class_journey_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"12:00"}]');
  r := public.record_class_schedule_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL, jsonb_build_array(jsonb_build_object('block_key','b1','weekday',1,'starts_at','07:00','ends_at','07:50','matrix_version_id',mv,'item_key','k1')));
  r := public.record_teaching_assignment_version_v2(c27, NULL, NULL, 'constituicao', '2027-02-01', '2027-06-30', eng_t, fl_t, mv, 'k1', NULL, NULL, NULL, NULL, NULL); ta := r->>'assignment_id';
  r := public.record_teaching_substitution_version(ta, NULL, NULL, 'constituicao', '2027-04-01', '2027-04-30', eng_s, fl_s, false, NULL, 'licença sintética'); sub := r->>'substitution_id';
  RESET ROLE;
  SELECT b.id INTO blk FROM public.class_schedule_blocks b JOIN public.class_schedule_versions v ON v.id = b.version_id JOIN public.class_schedules s ON s.id = v.schedule_id WHERE s.class_id = c27 LIMIT 1;
  INSERT INTO public.institutional_period_organizations(id, academic_year_id) VALUES (org, y27);
  INSERT INTO public.institutional_academic_periods(id, academic_year_id, label, starts_on, ends_on, period_organization_id) VALUES (per, y27, 'P1 BO3', '2027-02-01', '2027-06-30', org);
  INSERT INTO public.institutional_academic_period_versions(period_id, version, official_name, starts_on, ends_on, is_active, valid_from, recorded_by, recorded_by_person_id, recorded_via_engagement_id, created_at)
    VALUES (per, 1, 'P1 BO3', '2027-02-01', '2027-06-30', true, '2027-02-01', ud, pd, eng_dir, now() - interval '1 minute');
  INSERT INTO public.institutional_class_period_organization_versions(class_id, version, organization_id, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id, segment_id, authorizing_policy_id, created_at)
    VALUES (c27, 1, org, '2027-02-01', 'teste-bo3', ud, pd, eng_dir, gen_random_uuid(), pol, now() - interval '1 minute');
  INSERT INTO public.institutional_students(id, display_name) VALUES (st1, 'BO3 Aluno A'), (st2, 'BO3 Aluno B');
  INSERT INTO public.school_enrollments(id, student_id, school_id, opened_on, academic_year_id) VALUES (en1, st1, s1, '2027-02-01', y27), (en2, st2, s1, '2027-02-01', y27);
  INSERT INTO public.class_enrollment_episodes(id, logical_id, enrollment_id, student_id, school_id, class_id, class_label_snapshot, valid_from)
    VALUES ('al-bo3-'||gen_random_uuid(), 'al-bo3-a-'||gen_random_uuid(), en1, st1, s1, c27, 'Turma BO3', '2027-02-01'), (al2, al2, en2, st2, s1, c27, 'Turma BO3', '2027-03-01');
  INSERT INTO public.class_allocation_ending_versions(allocation_logical_id, school_id, class_id, version, ended_on, reason_text, recorded_by) VALUES (al2, s1, c27, 1, '2027-04-30', 'transferência sintética', ud);

  -- Ano em preparação bloqueia o diário
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_lesson_version_v2('aula:bo3-1', ta, NULL, '2027-02-08', NULL, '{"content":"x"}', ARRAY[blk], '{}', NULL, NULL, 'bo3-p0'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'diary:year-not-operational:em-preparacao' THEN RAISE EXCEPTION 'falha preparação: %', _e; END IF; END;
  RESET ROLE;
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, supersedes_id, reason, technical_provenance)
    SELECT y27, 2, 'operacional', id, 'BO3 (rollback)', 'teste-bo3-rollback' FROM public.academic_year_operational_states WHERE academic_year_id = y27 AND sequence = 1;
  _ok := _ok || 'preparacao-bloqueia ';
  -- Ator técnico (service_role) e anon recusados
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.record_lesson_version_v2('aula:bo3-1', ta, NULL, '2027-02-08', NULL, '{}', '{}', '{}', NULL, NULL, 'bo3-a'); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE service_role;
  BEGIN PERFORM public.record_attendance_version_v2('aula:bo3-1', NULL, '{"aula":{}}', NULL, 'bo3-s'); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE authenticated;
  _ok := _ok || 'anon/ator-tecnico-recusados ';

  -- Titular: aula, idempotência, roster por data, chamada; pendente ≠ falta
  BEGIN PERFORM public.record_lesson_version_v2('aula:bo3-x', ta, NULL, '2027-03-15', NULL, '{"content":"x"}', ARRAY[blk], '{}', NULL, NULL, 'bo3-nl'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'diary:not-a-school-day' THEN RAISE EXCEPTION 'falha dia não letivo: %', _e; END IF; END;
  L1 := public.record_lesson_version_v2('aula:bo3-1', ta, NULL, '2027-02-08', NULL, '{"content":"Conteúdo sintético"}', ARRAY[blk], '{}', NULL, NULL, 'bo3-p1');
  IF public.record_lesson_version_v2('aula:bo3-1', ta, NULL, '2027-02-08', NULL, '{"content":"Conteúdo sintético"}', ARRAY[blk], '{}', NULL, NULL, 'bo3-p1') <> L1 THEN RAISE EXCEPTION 'falha idempotência'; END IF;
  IF EXISTS (SELECT 1 FROM public.diary_roster_at(ta, NULL, '2027-02-08') x WHERE x.student_id = st2) OR NOT EXISTS (SELECT 1 FROM public.diary_roster_at(ta, NULL, '2027-02-08') x WHERE x.student_id = st1) THEN RAISE EXCEPTION 'falha roster'; END IF;
  A1 := public.record_attendance_version_v2('aula:bo3-1', NULL, jsonb_build_object('aula', jsonb_build_object(st1, 'Presente')), NULL, 'bo3-c1');
  PERFORM public.record_lesson_version_v2('aula:bo3-2', ta, NULL, '2027-03-08', NULL, '{"content":"Março"}', ARRAY[blk], '{}', NULL, NULL, 'bo3-p2');
  A2 := public.record_attendance_version_v2('aula:bo3-2', NULL, jsonb_build_object('aula', jsonb_build_object(st1, 'Ausente')), NULL, 'bo3-c2');
  RESET ROLE;
  IF NOT (SELECT st2 = ANY(eligible_student_ids) AND NOT (marks->'aula' ? st2) FROM public.attendance_record_versions WHERE id = A2) THEN RAISE EXCEPTION 'falha: pendente ≠ ausente'; END IF;
  SET LOCAL ROLE authenticated;
  _ok := _ok || 'aula idempotente roster-por-data chamada pendente≠falta ';
  -- Stale-head (double-submit com outro plan_id) e correção sem regra homologada ⇒ recusa; histórico intacto
  BEGIN PERFORM public.record_lesson_version_v2('aula:bo3-1', ta, NULL, '2027-02-08', NULL, '{"content":"x"}', ARRAY[blk], '{}', NULL, NULL, 'bo3-p1-outro'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'diary:stale-head' THEN RAISE EXCEPTION 'falha stale: %', _e; END IF; END;
  BEGIN PERFORM public.record_lesson_version_v2('aula:bo3-1', ta, NULL, '2027-02-08', L1, '{"content":"corr"}', ARRAY[blk], '{}', 'j', NULL, 'bo3-cr0'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'diary:correction-policy-missing' THEN RAISE EXCEPTION 'falha sem regra: %', _e; END IF; END;
  RESET ROLE;
  IF (SELECT version_number FROM public.lesson_record_versions WHERE id = L1) <> 1 THEN RAISE EXCEPTION 'falha histórico'; END IF;
  _ok := _ok || 'stale-head correcao-sem-regra-bloqueia historico-intacto ';
  -- Outro professor (lotação sem regência) e Direção não escrevem; Direção lê só a própria escola
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ux, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_lesson_version_v2('aula:bo3-9', ta, NULL, '2027-02-15', NULL, '{"content":"x"}', '{}', '{}', NULL, NULL, 'bo3-x'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'diary:not-assignment-holder' THEN RAISE EXCEPTION 'falha outro professor: %', _e; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_lesson_version_v2('aula:bo3-9', ta, NULL, '2027-02-15', NULL, '{"content":"x"}', '{}', '{}', NULL, NULL, 'bo3-d'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'diary:not-assignment-holder' THEN RAISE EXCEPTION 'falha direção escreve: %', _e; END IF; END;
  IF NOT EXISTS (SELECT 1 FROM public.diary_school_overview_at(s2, '2027-02-01', '2027-03-31') o WHERE o.result_kind = 'access-denied') THEN RAISE EXCEPTION 'falha IDOR Direção outra escola'; END IF;
  _ok := _ok || 'outro-professor direcao-nao-escreve idor-outra-escola ';
  -- Substituto só na janela; transferência por data
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_lesson_version_v2('aula:bo3-s0', ta, sub, '2027-05-03', NULL, '{"content":"x"}', '{}', '{}', NULL, NULL, 'bo3-s0'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'diary:substitution-not-effective' THEN RAISE EXCEPTION 'falha substituto fora: %', _e; END IF; END;
  PERFORM public.record_lesson_version_v2('aula:bo3-s1', ta, sub, '2027-04-05', NULL, '{"content":"Substituição"}', ARRAY[blk], '{}', NULL, NULL, 'bo3-s1');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);
  PERFORM public.record_lesson_version_v2('aula:bo3-3', ta, NULL, '2027-05-03', NULL, '{"content":"Maio"}', ARRAY[blk], '{}', NULL, NULL, 'bo3-p3');
  BEGIN PERFORM public.record_attendance_version_v2('aula:bo3-3', NULL, jsonb_build_object('aula', jsonb_build_object(st2, 'Presente')), NULL, 'bo3-c3'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'diary:student-not-allocated-on-lesson-date' THEN RAISE EXCEPTION 'falha transferido: %', _e; END IF; END;
  RESET ROLE;
  _ok := _ok || 'substituto-janela transferencia-por-data ';
  PERFORM set_config('bo3.ids', jsonb_build_object('ta',ta,'st1',st1,'st2',st2,'s1',s1,'s2',s2,'c27',c27,'per',per,'ud',ud,'ut',ut,'ux',ux,'pd',pd,'eng_dir',eng_dir,'eng_x',eng_x,'mv',mv,'y27',y27)::text, true);
  PERFORM set_config('bo3.log', 'DIARIO[' || _ok || '] ', true);
END $t$;

DO $a$
DECLARE j jsonb := current_setting('bo3.ids')::jsonb; _ok text := ''; _e text; ins text := 'ins-bo3-'||gen_random_uuid(); ev uuid; cf uuid; g jsonb; v1 uuid;
  ta text := j->>'ta'; per text := j->>'per'; st1 text := j->>'st1'; st2 text := j->>'st2'; c27 text := j->>'c27'; ut uuid := (j->>'ut')::uuid; ux uuid := (j->>'ux')::uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.create_assessment_instrument_v2(ins, ta, per, 'prova', '{"title":"Prova sintética"}', '2027-03-08', '{}');
  BEGIN PERFORM public.apply_assessment_instrument_v2(ins, gen_random_uuid(), '2027-03-22'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'aa:stale-head' THEN RAISE EXCEPTION 'falha stale aplicação: %', _e; END IF; END;
  ev := public.apply_assessment_instrument_v2(ins, NULL, '2027-03-22');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ux, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.register_assessment_results_v2(ins, 'bo3-x', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st1, 'value', '{"kind":"numerica","value":5}'::jsonb))); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'diary:not-assignment-holder' THEN RAISE EXCEPTION 'falha outro professor: %', _e; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);
  PERFORM public.register_assessment_results_v2(ins, 'bo3-r1', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st1, 'value', '{"kind":"numerica","value":0}'::jsonb)));
  g := public.assessment_instrument_completeness(ins);
  IF g->>'state' <> 'incompleto' OR (g->>'recorded_count')::int <> 1 OR NOT (g->'missing_student_ids' ? st2) THEN RAISE EXCEPTION 'falha ZERO≠UNKNOWN: %', g; END IF;
  PERFORM public.register_assessment_results_v2(ins, 'bo3-r2', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st2, 'value', '{"kind":"nao-registrado","reason":"ausente na aplicação"}'::jsonb)));
  g := public.assessment_instrument_completeness(ins);
  IF g->>'state' <> 'completo' OR (g->>'explicit_not_recorded_count')::int <> 1 THEN RAISE EXCEPTION 'falha completude: %', g; END IF;
  cf := public.record_assessment_conference(ins, NULL, g->>'fingerprint');
  BEGIN PERFORM public.record_assessment_conference(ins, NULL, g->>'fingerprint'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'aa:stale-head' THEN RAISE EXCEPTION 'falha stale conferência: %', _e; END IF; END;
  g := public.assessment_instrument_governance_state(ins);
  IF g->>'publication' <> 'aguardando-regra-homologada' OR g->>'calculation' <> 'bloqueado-sem-regra-homologada' THEN RAISE EXCEPTION 'falha BLOCKED: %', g; END IF;
  RESET ROLE; SELECT id INTO v1 FROM public.assessment_entry_versions WHERE instrument_id = ins AND student_id = st1; SET LOCAL ROLE authenticated;
  IF NOT EXISTS (SELECT 1 FROM public.assessment_correction_policies p WHERE p.status='homologated') THEN
    BEGIN PERFORM public.register_assessment_results_v2(ins, 'bo3-c1', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st1, 'expectedBaseVersionId', v1, 'value', '{"kind":"numerica","value":7}'::jsonb, 'rectification', '{}'::jsonb))); RAISE EXCEPTION 'aberto';
      EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e NOT LIKE 'correction-policy-missing:%' THEN RAISE EXCEPTION 'falha retificação sem regra: %', _e; END IF; END;
    _ok := _ok || 'retificacao-sem-regra-bloqueia ';
  END IF;
  BEGIN PERFORM public.record_period_closing_act_v2(c27||'|'||per, per, '{}', 'entrega-docente', NULL, NULL, NULL, NULL, '{}', '2026-12-01'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'closing:effective-outside-period' THEN RAISE EXCEPTION 'falha data fechamento: %', _e; END IF; END;
  RESET ROLE;
  _ok := _ok || 'instrumento aplicacao-stale outro-professor zero-real nao-registrado≠zero conferencia-stale publicacao/calculo-BLOCKED fechamento-fora-periodo ';
  PERFORM set_config('bo3.ins', ins, true);
  PERFORM set_config('bo3.log', current_setting('bo3.log') || 'AVALIACAO[' || _ok || '] ', true);
END $a$;

DO $c$
DECLARE j jsonb := current_setting('bo3.ids')::jsonb; _ok text := ''; _e text; n int; m int; r jsonb; P1 uuid;
  ta text := j->>'ta'; per text := j->>'per'; st1 text := j->>'st1'; st2 text := j->>'st2'; c27 text := j->>'c27'; s1 text := j->>'s1'; s2 text := j->>'s2';
  ud uuid := (j->>'ud')::uuid; ut uuid := (j->>'ut')::uuid; ux uuid := (j->>'ux')::uuid; eng_x uuid := (j->>'eng_x')::uuid; mv uuid := (j->>'mv')::uuid; y27 text := j->>'y27';
  ins text := current_setting('bo3.ins'); eng_dir uuid := (j->>'eng_dir')::uuid;
  pa uuid := gen_random_uuid(); ua uuid := gen_random_uuid(); pse uuid := gen_random_uuid(); use_ uuid := gen_random_uuid(); po uuid := gen_random_uuid(); uo uuid := gen_random_uuid();
  pg uuid := gen_random_uuid(); ug uuid := gen_random_uuid(); unp uuid := gen_random_uuid(); ga uuid := gen_random_uuid(); new_eng uuid;
BEGIN
  -- Planejamento
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  P1 := public.record_teaching_plan_version_v2('pln-bo3-1',NULL,ta,'Plano BO3',NULL,'2027-03-01',per,'2027-03-01','2027-03-31','[{"kindValueId":null,"heading":"Objetivos","body":"sintético"}]',
    jsonb_build_array(jsonb_build_object('kind','matrix-item','item_key','k1','matrix_version_id',mv)),'publicado',NULL,NULL);
  BEGIN PERFORM public.record_teaching_plan_version_v2('pln-bo3-1',NULL,ta,'x',NULL,'2027-03-01',per,'2027-03-01','2027-03-31','[]','[]','rascunho',NULL,NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'plan:stale-head' THEN RAISE EXCEPTION 'falha plano stale: %', _e; END IF; END;
  PERFORM public.record_teaching_plan_version_v2('pln-bo3-1',P1,ta,'Plano BO3 v2',NULL,'2027-03-01',per,'2027-03-01','2027-03-31','[]',
    jsonb_build_array(jsonb_build_object('kind','matrix-item','item_key','k1','matrix_version_id',mv)),'publicado',NULL,'ajuste');
  RESET ROLE;
  IF (SELECT count(*) FROM public.teaching_plan_versions WHERE plan_id = 'pln-bo3-1') <> 2 THEN RAISE EXCEPTION 'falha histórico do plano'; END IF;
  _ok := _ok || 'plano(v1→v2,stale,historico) ';

  -- Direção: relatórios reconciliam com os fatos; outra escola sem vazamento
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.diary_school_overview_at(s1, '2027-02-01', '2027-03-31') o WHERE o.result_kind = 'lesson' AND o.class_id = c27;
  RESET ROLE; SELECT count(DISTINCT logical_record_id) INTO m FROM public.lesson_record_versions WHERE assignment_id = ta AND lesson_date <= '2027-03-31'; SET LOCAL ROLE authenticated;
  IF n <> m OR n = 0 THEN RAISE EXCEPTION 'falha reconciliação diário: visão=% fatos=%', n, m; END IF;
  IF (SELECT count(*) FROM public.teaching_plans_overview_at(s1, '2027-03-15') o WHERE o.class_id = c27 AND o.plan_id = 'pln-bo3-1') <> 1 THEN RAISE EXCEPTION 'falha reconciliação plano'; END IF;
  IF EXISTS (SELECT 1 FROM public.teaching_plans_overview_at(s2, '2027-03-15') o WHERE o.class_id = c27) THEN RAISE EXCEPTION 'falha: plano vaza'; END IF;
  _ok := _ok || 'relatorio-diario=' || m || '=fatos relatorio-plano=1 ';
  -- Fechamento oficial pela Direção sem norma homologada ⇒ recusa, nada gravado
  BEGIN PERFORM public.record_period_closing_act_v2(c27||'|'||per, per, '{}', 'fechamento-oficial', NULL, NULL, NULL, 'x', '{}', '2027-06-30'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e = 'aberto' THEN RAISE EXCEPTION 'falha: fechamento sem norma'; END IF; _ok := _ok || 'fechamento-recusado(' || _e || ') '; END;
  -- knownAt
  SELECT count(*) INTO n FROM public.class_at(c27, '2027-03-01', now() - interval '1 hour');
  SELECT count(*) INTO m FROM public.class_at(c27, '2027-03-01', now());
  RESET ROLE;
  _ok := _ok || 'knownAt(antes=' || n || ',agora=' || m || ') ';

  -- Administração: record_engagement + end_engagement (writers oficiais), autoconcessão recusada, revogação sem logout
  INSERT INTO public.institutional_persons(id, display_name) VALUES (pa,'BO3 Administração sintética'),(pse,'BO3 Secretaria sintética'),(po,'BO3 Orientação sintética'),(pg,'BO3 Responsável sintético');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (ua, pa), (use_, pse), (uo, po), (ug, pg);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (pa, 'administrador-geral-do-sigem', 'Administração (BO3)', NULL, '2026-01-01', 'teste-bo3', 'rede');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ua, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN new_eng := public.record_engagement(pse, 'secretaria-escolar', 'escola', s1, NULL, NULL, NULL, current_date, NULL, NULL, 'Secretaria (BO3)'); _ok := _ok || 'record_engagement-ok ';
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; _ok := _ok || 'record_engagement-recusado(' || _e || ') '; END;
  BEGIN PERFORM public.record_engagement(pa, 'professor', 'escola', s1, NULL, NULL, NULL, current_date, NULL, NULL, NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception OR insufficient_privilege THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e = 'aberto' THEN RAISE EXCEPTION 'falha autoconcessão'; END IF; END;
  BEGIN PERFORM public.end_engagement(eng_x, current_date, NULL); _ok := _ok || 'end_engagement-ok ';
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; _ok := _ok || 'end_engagement-recusado(' || _e || ') '; END;
  BEGIN PERFORM public.end_engagement(eng_dir, current_date, NULL); _ok := _ok || 'end_engagement-auth-real-ok ';
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; _ok := _ok || 'end_engagement-auth-real-recusado(' || _e || ') '; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role', 'authenticated')::text, true);
  _ok := _ok || 'caps-auth-real-apos-revogacao(amanha)=' || (SELECT count(*) FROM public.effective_capabilities(current_date + 1)) || ' ';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ux, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.effective_capabilities(current_date + 1);
  IF n <> 0 AND _ok LIKE '%end_engagement-ok%' THEN RAISE EXCEPTION 'falha revogação sem efeito: %', n; END IF;
  _ok := _ok || 'caps-apos-revogacao=' || n || ' ';
  -- Conta sem pessoa
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', unp, 'role', 'authenticated')::text, true);
  IF (SELECT count(*) FROM public.effective_capabilities(current_date)) <> 0 THEN RAISE EXCEPTION 'falha conta sem pessoa'; END IF;
  BEGIN PERFORM public.record_lesson_version_v2('aula:bo3-np', ta, NULL, '2027-02-15', NULL, '{"content":"x"}', '{}', '{}', NULL, NULL, 'bo3-np'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e = 'aberto' THEN RAISE EXCEPTION 'falha conta sem pessoa escreveu'; END IF; END;
  _ok := _ok || 'conta-sem-pessoa(0,recusada) ';

  -- Família: writer oficial com papel real recusa (nenhuma regra homologada concede); leitura pelo reader canônico
  IF new_eng IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', use_, 'role', 'authenticated')::text, true);
    BEGIN PERFORM public.record_guardian_authorization_v3(NULL,'constituicao',st1,pg,s1,NULL,NULL,ARRAY['matricula'],current_date,NULL,NULL,NULL); RAISE EXCEPTION 'aberto';
      EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e = 'aberto' THEN RAISE EXCEPTION 'falha concessão sem regra'; END IF; _ok := _ok || 'familia-concessao-secretaria-recusada(' || left(_e, 60) || ') '; END;
  END IF;
  RESET ROLE;
  INSERT INTO public.guardian_authorizations(logical_id, version, event_kind, student_id, guardian_user_id, guardian_person_id, school_id, sections, valid_from, reason, recorded_by, recorded_engagement)
    VALUES (ga, 1, 'constituicao', st1, ug, pg, s1, ARRAY['matricula','frequencia'], current_date - 1, 'pré-condição BO3 (rollback)', ud, eng_dir);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ug, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.family_students()) <> 1 THEN RAISE EXCEPTION 'falha família lista'; END IF;
  r := public.family_student_summary(st1);
  IF (r->'sections') ? 'avaliacao' OR r ? 'grades' OR r::text ILIKE '%Presente%' OR r::text ILIKE '%Ausente%' THEN RAISE EXCEPTION 'falha família minimização'; END IF;
  BEGIN PERFORM public.family_student_summary(st2); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e NOT LIKE 'family:not-authorized%' THEN RAISE EXCEPTION 'falha família IDOR: %', _e; END IF; END;
  BEGIN PERFORM 1 FROM public.guardian_authorizations; RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.register_assessment_results_v2(ins, 'bo3-fam', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st1, 'value', '{"kind":"numerica","value":9}'::jsonb))); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e = 'aberto' THEN RAISE EXCEPTION 'falha família lançou nota'; END IF; END;
  RESET ROLE;
  INSERT INTO public.guardian_authorizations(logical_id, version, supersedes_id, event_kind, student_id, guardian_user_id, guardian_person_id, school_id, sections, valid_from, reason, recorded_by, recorded_engagement)
    SELECT ga, 2, id, 'revogacao', st1, ug, pg, s1, '{}', current_date - 1, 'revogação BO3', ud, eng_dir FROM public.guardian_authorizations WHERE logical_id = ga AND version = 1;
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.family_students()) <> 0 THEN RAISE EXCEPTION 'falha revogada visível'; END IF;
  RESET ROLE;
  _ok := _ok || 'familia(lista=1,minimizada,interno-oculto,idor-uniforme,sem-tabela,sem-escrita,revogada-invisivel) ';

  -- Orientação: lê a turma; writer de acompanhamento recusa (nenhuma regra homologada)
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (po, 'orientacao-pedagogica', 'Orientação (BO3)', s1, '2026-01-01', 'teste-bo3', 'escola');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uo, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF NOT public.has_capability('consultar-estudantes-da-turma', c27) THEN RAISE EXCEPTION 'falha orientação lê turma'; END IF;
  BEGIN PERFORM public.record_school_pedagogical_record_v2(NULL, 'registro', s1, 'estudante', st1, 'qualquer', 'x', 'acompanhamento-da-escola', '2027-03-01', NULL, NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception OR insufficient_privilege THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e = 'aberto' THEN RAISE EXCEPTION 'falha orientação gravou'; END IF; _ok := _ok || 'acompanhamento-recusado(' || left(_e, 60) || ') '; END;
  -- Gestão/indicadores: estado explícito, não zero inventado
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role', 'authenticated')::text, true);
  BEGIN r := public.network_indicators_at('2027-03-31', now(), s1, y27); _ok := _ok || 'indicadores=' || left(coalesce(r::text,'null'), 120) || ' ';
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; _ok := _ok || 'indicadores-recusado(' || left(_e, 60) || ') '; END;
  RESET ROLE;
  RAISE EXCEPTION 'bo4-bd-e2e-ok(auth-real=%): % CADEIA[%]', ud, current_setting('bo3.log'), _ok;
END $c$;
