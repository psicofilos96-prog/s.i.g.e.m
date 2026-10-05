-- Frente V (0129) — prova no banco canônico; termina em RAISE (nada persiste). Dados sintéticos, sem PII.
-- Sucesso = 'v-offer-tests-ok: ...'.
DO $t$
DECLARE _ok text := ''; _e text; b boolean;
  c26 text; s1 text; s2 text; y27 text := 'ano-500f63b6-b71d-4000-9762-bbb65c40d21d';
  c27 text := 'tur-v-' || gen_random_uuid()::text; c27b text := 'tur-v-' || gen_random_uuid()::text;
  p uuid := gen_random_uuid(); u uuid := gen_random_uuid(); eng uuid; eng_sec uuid; ta text; v1 uuid; v2 uuid;
  mv uuid; n_before int; n_after int;
BEGIN
  SELECT count(*) INTO n_before FROM (SELECT 1 FROM public.class_journey_versions UNION ALL SELECT 1 FROM public.class_schedule_versions
    UNION ALL SELECT 1 FROM public.teaching_assignment_versions UNION ALL SELECT 1 FROM public.teaching_substitution_versions) x;

  -- V.0.1 ACL: nenhuma role de app faz DML direto; writers humanos não executáveis por anon/service_role
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['class_journeys','class_journey_versions','class_journey_intervals','class_schedules',
       'class_schedule_versions','class_schedule_blocks','class_schedule_block_engagements','teaching_assignments',
       'teaching_assignment_versions','teaching_substitutions','teaching_substitution_versions']) t,
       unnest(ARRAY['anon','authenticated','service_role']) r, unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE']) pr
     WHERE has_table_privilege(r, 'public.' || t, pr)) THEN RAISE EXCEPTION 'falha: dml direto'; END IF;
  IF has_function_privilege('anon','public.record_class_journey_version(text,uuid,text,date,date,text,text,jsonb)','EXECUTE')
     OR has_function_privilege('service_role','public.record_class_journey_version(text,uuid,text,date,date,text,text,jsonb)','EXECUTE')
     OR has_function_privilege('service_role','public.record_class_schedule_version(text,uuid,text,date,date,text,text,jsonb)','EXECUTE')
     OR has_function_privilege('service_role','public.record_teaching_assignment_version_v2(text,text,uuid,text,date,date,uuid,uuid,uuid,text,text,text,integer,text,text)','EXECUTE')
     OR has_function_privilege('service_role','public.record_teaching_substitution_version(text,text,uuid,text,date,date,uuid,uuid,boolean,text,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.record_teaching_assignment_version(text,text,uuid,text,date,date,uuid,uuid,text,text,text,integer,text,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.class_time_capability_grant(text,text,date)','EXECUTE')
     OR has_function_privilege('authenticated','public.teaching_staff_fit(text,uuid,text,uuid,date,date)','EXECUTE')
  THEN RAISE EXCEPTION 'falha: acl writers'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('record_class_journey_version','record_class_schedule_version',
       'record_teaching_assignment_version_v2','record_teaching_substitution_version','class_time_capability_grant','class_time_writable_target')
       AND (NOT prosecdef OR NOT proconfig @> ARRAY['search_path=""'] OR prosrc ILIKE '%current_date%')) THEN RAISE EXCEPTION 'falha: definer/search_path/current_date'; END IF;
  IF pg_get_functiondef('public.class_schedule_at(text,date,timestamptz)'::regprocedure) LIKE '%class_schedule_block_engagements%'
     OR pg_get_functiondef('public.record_class_schedule_version(text,uuid,text,date,date,text,text,jsonb)'::regprocedure) LIKE '%INSERT INTO public.class_schedule_block_engagements%'
  THEN RAISE EXCEPTION 'falha: segunda fonte de regência'; END IF;
  _ok := _ok || 'acl ';

  SELECT id, school_id INTO c26, s1 FROM public.institutional_classes WHERE academic_year_id = 'ano-431ece00-be5c-41ed-a430-75ba853b0831' ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.institutional_schools WHERE id <> s1 ORDER BY id LIMIT 1;

  -- V.0.4 Cadeia protegida pelo banco mesmo em inserção privilegiada
  ta := 'ta-' || gen_random_uuid()::text;
  SELECT id INTO mv FROM public.curricular_matrix_versions LIMIT 1;
  INSERT INTO public.institutional_persons(id, display_name) VALUES (p, 'Pessoa sintética V');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (p, 'direcao-escolar', 'Direção (sintético)', s1, '2027-01-01', 'teste-v', 'escola') RETURNING id INTO eng;
  IF mv IS NOT NULL THEN
    INSERT INTO public.teaching_assignments(id, class_id) VALUES (ta, c26);
    b := false; BEGIN
      INSERT INTO public.teaching_assignment_versions(assignment_id, version, change_kind, valid_from, engagement_id, matrix_id, matrix_version_id, item_key, recorded_by, recorded_via_engagement_id)
        VALUES (ta, 2, 'constituicao', '2027-02-01', eng, 'm', mv, 'k', u, eng);
    EXCEPTION WHEN check_violation OR raise_exception THEN b := true; END;
    IF NOT b THEN RAISE EXCEPTION 'falha: raiz versão 2'; END IF;
    INSERT INTO public.teaching_assignment_versions(assignment_id, version, change_kind, valid_from, engagement_id, matrix_id, matrix_version_id, item_key, recorded_by, recorded_via_engagement_id)
      VALUES (ta, 1, 'constituicao', '2027-02-01', eng, 'm', mv, 'k', u, eng) RETURNING id INTO v1;
    b := false; BEGIN
      INSERT INTO public.teaching_assignment_versions(assignment_id, version, change_kind, valid_from, engagement_id, matrix_id, matrix_version_id, item_key, recorded_by, recorded_via_engagement_id)
        VALUES (ta, 1, 'constituicao', '2027-03-01', eng, 'm', mv, 'k', u, eng);
    EXCEPTION WHEN unique_violation OR raise_exception THEN b := true; END;
    IF NOT b THEN RAISE EXCEPTION 'falha: segunda raiz'; END IF;
    b := false; BEGIN
      INSERT INTO public.teaching_assignment_versions(assignment_id, version, supersedes_id, change_kind, valid_from, engagement_id, matrix_id, matrix_version_id, item_key, change_reason, recorded_by, recorded_via_engagement_id)
        VALUES (ta, 3, v1, 'retificacao', '2027-02-01', eng, 'm', mv, 'k', 'x', u, eng);
    EXCEPTION WHEN raise_exception THEN b := SQLERRM = 'assignment:invalid-chain'; END;
    IF NOT b THEN RAISE EXCEPTION 'falha: salto de versão'; END IF;
    INSERT INTO public.teaching_assignment_versions(assignment_id, version, supersedes_id, change_kind, valid_from, engagement_id, matrix_id, matrix_version_id, item_key, change_reason, recorded_by, recorded_via_engagement_id)
      VALUES (ta, 2, v1, 'retificacao', '2027-02-01', eng, 'm', mv, 'k', 'x', u, eng) RETURNING id INTO v2;
    b := false; BEGIN
      INSERT INTO public.teaching_assignment_versions(assignment_id, version, supersedes_id, change_kind, valid_from, engagement_id, matrix_id, matrix_version_id, item_key, change_reason, recorded_by, recorded_via_engagement_id)
        VALUES (ta, 3, v1, 'retificacao', '2027-02-01', eng, 'm', mv, 'k', 'x', u, eng);
    EXCEPTION WHEN unique_violation OR raise_exception THEN b := true; END;
    IF NOT b THEN RAISE EXCEPTION 'falha: bifurcação'; END IF;
    _ok := _ok || 'chain ';
  END IF;

  -- Estado anual e gates de sessão/pessoa/capacidade
  PERFORM set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_class_journey_version(c26, NULL, 'constituicao', '2026-03-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"11:00"}]');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'session-required' THEN RAISE EXCEPTION 'falha sessão: %', _e; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', u, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_class_journey_version(c26, NULL, 'constituicao', '2026-03-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"11:00"}]');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'journey:year-not-writable' THEN RAISE EXCEPTION 'falha 2026: %', _e; END IF; END;
  RESET ROLE;
  _ok := _ok || 'session 2026-historical ';

  -- 2027 sem estado bloqueado
  INSERT INTO public.institutional_classes(id, school_id, school_label_snapshot, academic_year_id, academic_year_label, name, valid_from)
    VALUES (c27, s1, 'Escola (sintético)', y27, '2027', 'Turma sintética V', '2027-02-01'),
           (c27b, s2, 'Escola (sintético)', y27, '2027', 'Turma sintética V outra escola', '2027-02-01');
  IF EXISTS (SELECT 1 FROM public.academic_year_operational_state_at(y27)) THEN RAISE EXCEPTION 'falha: 2027 já tem estado real'; END IF;
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_class_journey_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"11:00"}]');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'journey:year-without-state' THEN RAISE EXCEPTION 'falha 2027 sem estado: %', _e; END IF; END;
  RESET ROLE;

  -- 2027 em preparação (sintético, desfeito no rollback): pessoa sem vínculo de usuário é recusada
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    VALUES (y27, 1, 'em-preparacao', 'teste sintético V (rollback)', 'teste-v-rollback');
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_class_journey_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"11:00"}]');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'person-required' THEN RAISE EXCEPTION 'falha sem pessoa: %', _e; END IF; END;
  BEGIN PERFORM public.record_class_journey_version(c27, NULL, 'constituicao', '2026-12-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"11:00"}]');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'journey:window-outside-year' THEN RAISE EXCEPTION 'falha janela: %', _e; END IF; END;
  RESET ROLE;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (u, p);
  SET LOCAL ROLE authenticated;
  -- Direção de outra escola: negada
  BEGIN PERFORM public.record_class_journey_version(c27b, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"11:00"}]');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'capability:manter-jornada-da-turma' THEN RAISE EXCEPTION 'falha outra escola: %', _e; END IF; END;
  -- Direção da própria escola: passa o portão (capacidade avaliada em 2027-02-01, não hoje) e chega à regra de domínio
  BEGIN PERFORM public.record_class_journey_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"11:00"}]');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e NOT IN ('journey:outside-class-validity', 'aberto') THEN RAISE EXCEPTION 'falha própria escola: %', _e; END IF; END;
  -- Grade sem jornada: recusa; bloco com responsáveis diretos: recusa
  BEGIN PERFORM public.record_class_schedule_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL,
      '[{"block_key":"b1","weekday":1,"starts_at":"07:00","ends_at":"08:00","engagement_ids":[]}]');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e NOT IN ('schedule:responsibles-come-from-teaching-assignments','schedule:outside-class-validity') THEN RAISE EXCEPTION 'falha bloco regência: %', _e; END IF; END;
  BEGIN PERFORM public.record_class_schedule_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL,
      '[{"block_key":"b1","weekday":1,"starts_at":"07:00","ends_at":"08:00","component_id":"x"}]');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e NOT IN ('schedule:component-without-matrix-item','schedule:outside-class-validity') THEN RAISE EXCEPTION 'falha componente sem item: %', _e; END IF; END;
  -- Atribuição: pessoa sem vínculo funcional/lotação é recusada (nunca inferida por cargo/lotação)
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c27, NULL, NULL, 'constituicao', '2027-02-01', '2027-06-30', eng, gen_random_uuid(),
      coalesce(mv, gen_random_uuid()), 'k', NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'assignment:functional-link-not-of-person' THEN RAISE EXCEPTION 'falha vínculo: %', _e; END IF; END;
  -- Writer antigo aposentado e não executável
  b := false; BEGIN PERFORM public.record_teaching_assignment_version(c27, NULL, NULL, 'constituicao', '2027-02-01', NULL, eng, gen_random_uuid(), 'k', NULL, NULL, NULL, NULL, NULL);
    EXCEPTION WHEN insufficient_privilege THEN b := true; WHEN raise_exception THEN b := SQLERRM = 'assignment:superseded-writer'; END;
  IF NOT b THEN RAISE EXCEPTION 'falha: writer antigo'; END IF;
  -- Prontidão: em preparação explica bloqueio, nunca "pronto"
  IF NOT EXISTS (SELECT 1 FROM public.class_diary_readiness_at(c27, '2027-02-01', now()) r WHERE r.code = 'ano-em-preparacao:organizacao-permitida-diario-nao')
     OR NOT EXISTS (SELECT 1 FROM public.class_diary_readiness_at(c27, '2027-02-01', now()) r WHERE r.scope = 'resultado' AND r.state <> 'ready')
  THEN RAISE EXCEPTION 'falha: prontidão'; END IF;
  -- Carga: sem fonte contratual o saldo nunca vira zero
  IF EXISTS (SELECT 1 FROM public.school_teaching_load_at(s1, '2027-02-01', now()) l WHERE l.result_kind = 'load' AND l.balance_state <> 'nao-calculavel') THEN
    RAISE EXCEPTION 'falha: saldo calculado sem fonte'; END IF;
  RESET ROLE;
  _ok := _ok || '2027-no-state preparation person scope target-date no-direct-responsibles staff-chain readiness load ';

  -- Secretaria da escola: só leitura, writer negado
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (p, 'secretaria-escolar', 'Secretaria (sintético)', s2, '2027-01-01', 'teste-v', 'escola') RETURNING id INTO eng_sec;
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_class_journey_version(c27b, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"11:00"}]');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'capability:manter-jornada-da-turma' THEN RAISE EXCEPTION 'falha secretaria: %', _e; END IF; END;
  RESET ROLE;
  _ok := _ok || 'secretaria-readonly ';

  SELECT count(*) INTO n_after FROM (SELECT 1 FROM public.class_journey_versions UNION ALL SELECT 1 FROM public.class_schedule_versions
    UNION ALL SELECT 1 FROM public.teaching_substitution_versions) x;
  RAISE EXCEPTION 'v-offer-tests-ok: % (antes=%)', _ok, n_before;
END $t$;
