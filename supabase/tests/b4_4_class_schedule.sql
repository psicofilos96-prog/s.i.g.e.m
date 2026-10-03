-- B4.4 — Grade canônica da turma. Teste transacional real: o bloco termina em RAISE, nada persiste.
-- Sucesso = 'b44-tests-ok: ...'. Sem writer de produção: fixtures de grade inseridas pelo papel privilegiado do teste.
-- Todos os IDs/horários/rótulos são fictícios e não representam norma.
DO $t$
DECLARE
  u_sec text := '{"sub":"00000000-0000-0000-0000-0000000b4401","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-0000000b4403","role":"authenticated"}';
  pol uuid := '00000000-0000-0000-0000-0000000b44a0';
  p1 uuid := '00000000-0000-0000-0000-0000000b4491'; p2 uuid := '00000000-0000-0000-0000-0000000b4492'; p3 uuid := '00000000-0000-0000-0000-0000000b4493';
  _sch text := 'esc-b44'; _yr text := 'ano-b44'; _k1 text; _k2 text; _esec uuid;
  _ea uuid := gen_random_uuid(); _efree uuid := gen_random_uuid(); _eother uuid := gen_random_uuid(); _eold uuid := gen_random_uuid();
  _j1 text := 'cj-' || gen_random_uuid()::text; _jv uuid := gen_random_uuid();
  _s1 text := 'csch-' || gen_random_uuid()::text; _s2 text := 'csch-' || gen_random_uuid()::text;
  _v1 uuid := gen_random_uuid(); _v2 uuid := gen_random_uuid(); _v3 uuid := gen_random_uuid(); _w1 uuid := gen_random_uuid(); _vx uuid;
  _b uuid; _rb uuid := '00000000-0000-0000-0000-0000000b4401';
  _t0 timestamptz; _t1 timestamptz;
  _ok text := ''; _n integer; _s text; r record;
BEGIN
  -- ACL / ausência de writer ------------------------------------------------
  IF has_function_privilege('anon', 'public.class_schedule_at(text,date,timestamptz)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.class_schedule_at(text,date,timestamptz)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.class_schedule_engagement_valid(uuid,text,text,date,timestamptz)', 'EXECUTE')
    OR has_table_privilege('anon', 'public.class_schedule_versions', 'SELECT')
    OR has_table_privilege('authenticated', 'public.class_schedules', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_schedule_versions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_schedule_blocks', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_schedule_block_engagements', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_schedule_blocks', 'UPDATE')
  THEN RAISE EXCEPTION 'acl'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('class_schedule_at', 'class_schedule_effective_versions')
             AND (prosecdef OR NOT proconfig @> ARRAY['search_path=""'] OR provolatile <> 's'))
  THEN RAISE EXCEPTION 'definer/search_path'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname ~ '(record|register|constitute|maintain|create|homologate|publish).*schedule')
  THEN RAISE EXCEPTION 'writer exists'; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE capability_id ~* '(grade|horario|jornada)')
  THEN RAISE EXCEPTION 'unexpected capability'; END IF;
  _ok := _ok || 'acl no-writer no-capability ';

  -- Fixtures fictícias -------------------------------------------------------
  INSERT INTO public.institutional_persons(id, display_name) VALUES (p1, 'P1'), (p2, 'P2'), (p3, 'P3');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES
    ('00000000-0000-0000-0000-0000000b4401', p1), ('00000000-0000-0000-0000-0000000b4403', p3);
  INSERT INTO public.institutional_schools(id) VALUES (_sch), ('esc-b44-outra');
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
  VALUES (_sch, 1, 'Escola ficticia', true, '2020-01-01', 'ato');
  INSERT INTO public.institutional_engagements(id, person_id, engagement_kind_id, scope_level, school_id, valid_from)
  VALUES (gen_random_uuid(), p1, 'secretaria-escolar', 'escola', _sch, '2020-01-01') RETURNING id INTO _esec;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from)
  VALUES (p3, 'teste-b44-nada', 'escola', 'esc-b44-outra', '2020-01-01');
  INSERT INTO public.institutional_academic_years(id) VALUES (_yr);
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_yr, 1, 'Ano', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato', _rb, p1, _esec);
  INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b44', 1, 'draft', '2020-01-01');
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']);
  UPDATE public.capability_policies SET status = 'homologated' WHERE id = pol;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  _k1 := public.register_institutional_class(_sch, _yr, 'G1', 'Turma ficticia 1', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  _k2 := public.register_institutional_class(_sch, _yr, 'G2', 'Turma ficticia 2', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  SELECT count(*), max(result_kind) INTO _n, _s FROM public.class_schedule_at(_k1, '2026-03-02', now() + interval '1 hour');
  IF _n <> 1 OR _s <> 'absent' THEN RAISE EXCEPTION 'absent: % %', _n, _s; END IF;
  RESET ROLE;
  _t0 := clock_timestamp(); _t1 := _t0 + interval '1 minute';
  _ok := _ok || 'ausente ';

  -- Componentes, catálogo e atuações fictícias -----------------------------
  INSERT INTO public.institutional_curricular_components(id, label) VALUES ('cmp-b44-a', 'A'), ('cmp-b44-b', 'B'), ('cmp-b44-x', 'X');
  INSERT INTO public.curricular_component_versions(component_id, version, official_name, is_active, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES ('cmp-b44-a', 1, 'Componente A ficticio', true, '2020-01-01', 'ato', _rb, _esec),
         ('cmp-b44-b', 1, 'Componente B ficticio', true, '2020-01-01', 'ato', _rb, _esec),
         ('cmp-b44-x', 1, 'Componente X inativo', false, '2020-01-01', 'ato', _rb, _esec);
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status, valid_from) VALUES
    ('esq-b44-natureza', 'v-ok', 1, 'Natureza ficticia homologada', 'homologada', '2020-01-01'),
    ('esq-b44-natureza', 'v-rasc', 1, 'Natureza ficticia em rascunho', 'rascunho', '2020-01-01');
  INSERT INTO public.institutional_engagements(id, person_id, engagement_kind_id, scope_level, class_id, component_id, valid_from) VALUES
    (_ea, p2, 'teste-b44-docencia', 'turma', _k1, 'cmp-b44-a', '2026-01-01'),
    (_efree, p2, 'teste-b44-docencia', 'turma', _k1, NULL, '2026-01-01'),
    (_eother, p2, 'teste-b44-docencia', 'turma', _k2, 'cmp-b44-a', '2026-01-01');
  INSERT INTO public.institutional_engagements(id, person_id, engagement_kind_id, scope_level, class_id, component_id, valid_from, valid_until)
  VALUES (_eold, p2, 'teste-b44-docencia', 'turma', _k1, 'cmp-b44-a', '2025-01-01', '2025-12-31');

  -- Jornada B4.3 de K1 (K2 fica sem jornada) --------------------------------
  INSERT INTO public.class_journeys(id, class_id) VALUES (_j1, _k1);
  INSERT INTO public.class_journey_versions(id, journey_id, version, change_kind, valid_from, valid_until, originating_act_ref, recorded_by, created_at)
  VALUES (_jv, _j1, 1, 'constituicao', '2026-02-01', '2026-12-31', 'ato-j', _rb, _t0);
  INSERT INTO public.class_journey_intervals VALUES (_jv, 1, '07:00', '11:00'), (_jv, 1, '13:00', '15:00');
  INSERT INTO public.class_journey_intervals SELECT _jv, g, '07:00', '11:00' FROM generate_series(2, 7) g;

  -- v1 utilizável -------------------------------------------------------------
  INSERT INTO public.class_schedules(id, class_id) VALUES (_s1, _k1), (_s2, _k2);
  INSERT INTO public.class_schedule_versions(id, schedule_id, version, change_kind, valid_from, valid_until, originating_act_ref, recorded_by, created_at)
  VALUES (_v1, _s1, 1, 'constituicao', '2026-02-01', '2026-06-30', 'ato-g1', _rb, _t0);
  INSERT INTO public.class_schedule_blocks(id, version_id, block_key, weekday, starts_at, ends_at, component_id)
  VALUES (gen_random_uuid(), _v1, 'b1', 1, '07:00', '08:00', 'cmp-b44-a') RETURNING id INTO _b;
  INSERT INTO public.class_schedule_block_engagements VALUES (_b, _ea), (_b, _efree);
  INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES
    (_v1, 'b2', 1, '08:00', '09:00', 'cmp-b44-b'),   -- adjacente, só componente, sem tipo
    (_v1, 'b4', 7, '10:00', '11:00', 'cmp-b44-a');
  INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, nature_scheme_id, nature_value_id, nature_value_version)
  VALUES (_v1, 'b3', 2, '07:00', '08:00', 'esq-b44-natureza', 'v-ok', 1);
  -- K2: grade sem jornada
  INSERT INTO public.class_schedule_versions(id, schedule_id, version, change_kind, valid_from, valid_until, originating_act_ref, recorded_by, created_at)
  VALUES (_w1, _s2, 1, 'constituicao', '2026-02-01', '2026-06-30', 'ato-g2', _rb, _t0);
  INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES (_w1, 'k', 1, '07:00', '08:00', 'cmp-b44-a');

  -- Rejeições estruturais ----------------------------------------------------
  BEGIN INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES (_v1, 'z1', 1, '09:00', '09:00', 'cmp-b44-a');
    RAISE EXCEPTION 'start>=end accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES (_v1, 'z2', 8, '09:00', '10:00', 'cmp-b44-a');
    RAISE EXCEPTION 'weekday 8 accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at) VALUES (_v1, 'z3', 1, '09:00', '10:00');
    RAISE EXCEPTION 'contentless accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, nature_scheme_id, nature_value_id) VALUES (_v1, 'z4', 1, '09:00', '10:00', 'esq', 'v');
    RAISE EXCEPTION 'partial nature accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.class_schedule_versions(schedule_id, version, change_kind, valid_from, valid_until, originating_act_ref, recorded_by)
    VALUES (_s2, 1, 'constituicao', '2025-06-01', '2026-06-30', 'ato', _rb);
    RAISE EXCEPTION 'outside accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
    WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'schedule:outside-class-validity' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.class_schedule_versions(schedule_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by)
    VALUES (_s2, 2, _w1, 'sucessao', '2025-06-01', '2026-06-30', 'ato', 'm', _rb);
    RAISE EXCEPTION 'outside accepted';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT;
    IF _s NOT IN ('schedule:outside-class-validity', 'schedule:succession-must-start-later') THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.class_schedule_versions(schedule_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by)
    VALUES (_s2, 2, _w1, 'sucessao', '2026-07-01', NULL, 'ato', 'm', _rb);
    RAISE EXCEPTION 'open-ended accepted';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'schedule:outside-class-validity' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.class_schedule_versions(schedule_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by)
    VALUES (_s2, 2, _w1, 'sucessao', '2026-07-01', '2026-12-31', 'ato', 'm', _rb);
    SET CONSTRAINTS public.class_schedule_version_has_blocks IMMEDIATE;
    RAISE EXCEPTION 'empty version accepted';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'schedule:version-without-blocks' THEN RAISE; END IF;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  BEGIN
    INSERT INTO public.class_schedule_versions(schedule_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by)
    VALUES (_s1, 5, _v1, 'sucessao', '2026-07-01', '2026-12-31', 'ato', 'm', _rb);
    RAISE EXCEPTION 'bad chain accepted';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'schedule:invalid-chain' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.class_schedule_versions(schedule_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, recorded_by)
    VALUES (_s1, 2, _v1, 'sucessao', '2026-07-01', '2026-12-31', 'ato', _rb);
    RAISE EXCEPTION 'reason missing accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE public.class_schedule_blocks SET ends_at = '09:30' WHERE version_id = _v1;
    RAISE EXCEPTION 'update accepted';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s = 'update accepted' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.class_schedule_block_engagements WHERE block_id = _b;
    RAISE EXCEPTION 'delete accepted';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s = 'delete accepted' THEN RAISE; END IF; END;
  BEGIN
    PERFORM set_config('sigem.schedule_open_' || replace(_v1::text, '-', ''), '', true);
    INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES (_v1, 'late', 3, '07:00', '08:00', 'cmp-b44-a');
    RAISE EXCEPTION 'late block accepted';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'schedule:block-after-version-closed' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM set_config('sigem.schedule_open_' || replace(_v1::text, '-', ''), '', true);
    INSERT INTO public.class_schedule_block_engagements VALUES (_b, _eold);
    RAISE EXCEPTION 'late engagement accepted';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'schedule:block-after-version-closed' THEN RAISE; END IF;
  END;
  _ok := _ok || 'inicio-fim weekday sem-conteudo fora-da-turma sem-bloco cadeia append-only bloco-tardio ';

  -- v2 sucessão (conhecida em _t0) com todos os bloqueios por bloco ------------
  INSERT INTO public.class_schedule_versions(id, schedule_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by, created_at)
  VALUES (_v2, _s1, 2, _v1, 'sucessao', '2026-07-01', '2026-12-31', 'ato-g2', 'nova grade', _rb, _t0);
  INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES
    (_v2, 'p1', 1, '11:30', '12:00', 'cmp-b44-a'),
    (_v2, 'p2', 1, '07:00', '08:00', 'cmp-b44-x'),
    (_v2, 'p8', 5, '07:00', '09:00', 'cmp-b44-a'),
    (_v2, 'p9', 5, '08:00', '10:00', 'cmp-b44-b');
  INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, nature_scheme_id, nature_value_id, nature_value_version) VALUES
    (_v2, 'p3', 2, '07:00', '08:00', 'esq-b44-natureza', 'v-rasc', 1),
    (_v2, 'p4', 2, '08:00', '09:00', 'esq-b44-natureza', 'v-inexistente', 1);
  INSERT INTO public.class_schedule_blocks(id, version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES (gen_random_uuid(), _v2, 'p5', 3, '07:00', '08:00', 'cmp-b44-a') RETURNING id INTO _b;
  INSERT INTO public.class_schedule_block_engagements VALUES (_b, _eother);
  INSERT INTO public.class_schedule_blocks(id, version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES (gen_random_uuid(), _v2, 'p6', 3, '08:00', '09:00', 'cmp-b44-b') RETURNING id INTO _b;
  INSERT INTO public.class_schedule_block_engagements VALUES (_b, _ea);
  INSERT INTO public.class_schedule_blocks(id, version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES (gen_random_uuid(), _v2, 'p7', 4, '07:00', '08:00', 'cmp-b44-a') RETURNING id INTO _b;
  INSERT INTO public.class_schedule_block_engagements VALUES (_b, _eold);
  -- v3 retificação de v2 conhecida só em _t1: apenas sobreposição
  INSERT INTO public.class_schedule_versions(id, schedule_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by, created_at)
  VALUES (_v3, _s1, 3, _v2, 'retificacao', '2026-07-01', '2026-12-31', 'ato-g3', 'erro material', _rb, _t1);
  INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES
    (_v3, 'q1', 5, '07:00', '09:00', 'cmp-b44-a'), (_v3, 'q2', 5, '08:00', '10:00', 'cmp-b44-b');
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  -- v1: utilizável, dois responsáveis no mesmo bloco não são conflito, derivados
  SELECT count(*) INTO _n FROM public.class_schedule_at(_k1, '2026-03-02', _t1) WHERE result_kind = 'block' AND schedule_state = 'utilizavel' AND block_state = 'utilizavel';
  IF _n <> 4 THEN RAISE EXCEPTION 'v1 usable %', _n; END IF;
  SELECT * INTO r FROM public.class_schedule_at(_k1, '2026-03-02', _t1) LIMIT 1;
  IF r.block_key <> 'b1' OR cardinality(r.engagement_ids) <> 2 OR r.block_minutes <> 60 OR r.day_minutes <> 120 OR r.week_minutes <> 240
     OR r.component_name <> 'Componente A ficticio' OR r.effective_until <> '2026-06-30' OR r.coverage_state NOT LIKE 'nao-comprovada%'
     OR cardinality(r.coverage_matrix_ids) <> 0 THEN RAISE EXCEPTION 'v1 row %', row_to_json(r); END IF;
  SELECT * INTO r FROM public.class_schedule_at(_k1, '2026-03-02', _t1) WHERE block_key = 'b3';
  IF r.component_id IS NOT NULL OR r.nature_label <> 'Natureza ficticia homologada' OR r.coverage_state <> 'nao-aplicavel' THEN RAISE EXCEPTION 'b3 %', row_to_json(r); END IF;
  SELECT * INTO r FROM public.class_schedule_at(_k1, '2026-03-02', _t1) WHERE block_key = 'b2';
  IF r.nature_value_id IS NOT NULL OR r.block_state <> 'utilizavel' THEN RAISE EXCEPTION 'component-only %', row_to_json(r); END IF;
  _ok := _ok || 'utilizavel corresponsaveis component-only derivados ';

  -- v2 em knownAt=_t0: bloqueios distintos por bloco
  FOR r IN SELECT * FROM public.class_schedule_at(_k1, '2026-08-07', _t0) LOOP
    IF r.version_id <> _v2 OR r.schedule_state <> 'bloqueada:blocos-com-pendencia' THEN RAISE EXCEPTION 'v2 state %', row_to_json(r); END IF;
    IF (r.block_key = 'p1' AND r.block_state <> 'bloqueada:bloco-fora-da-jornada')
    OR (r.block_key = 'p2' AND r.block_state <> 'bloqueada:componente-inexistente-ou-inativo')
    OR (r.block_key IN ('p3', 'p4') AND r.block_state <> 'bloqueada:tipo-nao-homologado')
    OR (r.block_key IN ('p5', 'p6', 'p7') AND r.block_state <> 'bloqueada:engagement-invalido')
    OR (r.block_key IN ('p8', 'p9') AND (r.block_state <> 'inconsistente:sobreposicao-de-blocos' OR cardinality(r.overlapping_block_keys) <> 1))
    THEN RAISE EXCEPTION 'v2 block %', row_to_json(r); END IF;
  END LOOP;
  SELECT count(*) INTO _n FROM public.class_schedule_at(_k1, '2026-08-07', _t0);
  IF _n <> 9 THEN RAISE EXCEPTION 'v2 count %', _n; END IF;
  _ok := _ok || 'fora-jornada componente-inativo tipo-nao-homologado tipo-inexistente engagement-turma engagement-componente engagement-vigencia ';
  -- v3 conhecida em _t1: só sobreposição ⇒ inconsistente, nada escolhido
  SELECT count(*), max(schedule_state) INTO _n, _s FROM public.class_schedule_at(_k1, '2026-08-07', _t1);
  IF _n <> 2 OR _s <> 'inconsistente:sobreposicao-de-blocos' THEN RAISE EXCEPTION 'v3 % %', _n, _s; END IF;
  _ok := _ok || 'sobreposicao knownat-retificacao ';
  -- validOn antes da grade
  SELECT max(result_kind) INTO _s FROM public.class_schedule_at(_k1, '2026-01-15', _t1);
  IF _s <> 'absent' THEN RAISE EXCEPTION 'before validity %', _s; END IF;
  SELECT max(result_kind) INTO _s FROM public.class_schedule_at(_k1, '2026-03-02', _t0 - interval '1 second');
  IF _s <> 'absent' THEN RAISE EXCEPTION 'knownAt before %', _s; END IF;
  -- jornada ausente
  SELECT max(schedule_state) INTO _s FROM public.class_schedule_at(_k2, '2026-03-02', _t1);
  IF _s <> 'bloqueada:jornada-ausente' THEN RAISE EXCEPTION 'journey absent %', _s; END IF;
  _ok := _ok || 'validon jornada-ausente ';

  -- sem permissão: nada vaza
  PERFORM set_config('request.jwt.claims', u_none, true);
  SELECT count(*), max(result_kind) INTO _n, _s FROM public.class_schedule_at(_k1, '2026-03-02', _t1);
  IF _n <> 1 OR _s <> 'access-denied' THEN RAISE EXCEPTION 'denied % %', _n, _s; END IF;
  SELECT count(*) INTO _n FROM public.class_schedule_at(_k1, '2026-03-02', _t1) WHERE block_id IS NOT NULL OR weekday IS NOT NULL OR schedule_state IS NOT NULL;
  IF _n <> 0 THEN RAISE EXCEPTION 'denied leak'; END IF;
  SELECT count(*) INTO _n FROM public.class_schedule_at('turma-inexistente', '2026-03-02', _t1) WHERE result_kind = 'access-denied';
  IF _n <> 1 THEN RAISE EXCEPTION 'nonexistent'; END IF;
  IF public.class_schedule_engagement_valid(_ea, _k1, 'cmp-b44-a', '2026-03-02', _t1) IS NOT NULL THEN RAISE EXCEPTION 'helper leak'; END IF;
  SELECT (SELECT count(*) FROM public.class_schedules) + (SELECT count(*) FROM public.class_schedule_versions)
       + (SELECT count(*) FROM public.class_schedule_blocks) + (SELECT count(*) FROM public.class_schedule_block_engagements) INTO _n;
  IF _n <> 0 THEN RAISE EXCEPTION 'table leak %', _n; END IF;
  RESET ROLE;
  _ok := _ok || 'sem-permissao ';

  -- cadeia corrompida e ambiguidade: falham fechadas
  BEGIN
    ALTER TABLE public.class_schedule_versions DISABLE TRIGGER class_schedule_version_guard;
    _vx := gen_random_uuid();
    INSERT INTO public.class_schedule_versions(id, schedule_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by, created_at)
    VALUES (_vx, _s1, 4, _v3, 'sucessao', '2026-01-15', '2026-12-31', 'ato', 'corrompida', _rb, _t1);
    PERFORM set_config('sigem.schedule_open_' || replace(_vx::text, '-', ''), '1', true);
    INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES (_vx, 'c', 2, '08:00', '09:00', 'cmp-b44-a');
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', u_sec, true);
    PERFORM * FROM public.class_schedule_at(_k1, '2026-03-02', _t1);
    RAISE EXCEPTION 'ambiguity not detected';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'schedule:ambiguous-temporal-state' THEN RAISE; END IF;
  END;
  RESET ROLE;
  BEGIN
    ALTER TABLE public.class_schedule_versions DISABLE TRIGGER class_schedule_version_guard;
    _vx := gen_random_uuid();
    INSERT INTO public.class_schedule_versions(id, schedule_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by, created_at)
    VALUES (_vx, _s1, 9, _v3, 'sucessao', '2026-09-01', '2026-12-31', 'ato', 'corrompida', _rb, _t1);
    PERFORM set_config('sigem.schedule_open_' || replace(_vx::text, '-', ''), '1', true);
    INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES (_vx, 'c', 2, '08:00', '09:00', 'cmp-b44-a');
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', u_sec, true);
    PERFORM * FROM public.class_schedule_at(_k1, '2026-03-02', _t1);
    RAISE EXCEPTION 'invalid chain not detected';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'schedule:invalid-chain' THEN RAISE; END IF;
  END;
  _ok := _ok || 'ambiguidade cadeia-corrompida ';

  RAISE EXCEPTION 'b44-tests-ok: %', _ok;
END $t$;
