-- B4.3 — Jornada canônica da turma. Teste transacional real: o bloco termina em RAISE, nada persiste.
-- Sucesso = 'b43-tests-ok: ...'. Sem writer de produção: fixtures de jornada inseridas pelo papel privilegiado do teste.
-- Todos os IDs/horários são fictícios e não representam norma.
DO $t$
DECLARE
  u_sec text := '{"sub":"00000000-0000-0000-0000-0000000b4301","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-0000000b4303","role":"authenticated"}';
  pol uuid := '00000000-0000-0000-0000-0000000b43a0';
  _sch text := 'esc-b43'; _yr text := 'ano-b43'; _k1 text; _k2 text;
  _j1 text := 'cj-' || gen_random_uuid()::text; _j2 text := 'cj-' || gen_random_uuid()::text;
  _v1 uuid := gen_random_uuid(); _v2 uuid := gen_random_uuid(); _v3 uuid := gen_random_uuid(); _vx uuid;
  _rb uuid := '00000000-0000-0000-0000-0000000b4301';
  _t0 timestamptz := now(); _t1 timestamptz := now() + interval '1 minute';
  _ok text := ''; _n integer; _s text; r record; d integer;
BEGIN
  -- ACL ---------------------------------------------------------------------
  IF has_function_privilege('anon', 'public.class_journey_at(text,date,timestamptz)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.class_journey_at(text,date,timestamptz)', 'EXECUTE')
    OR has_table_privilege('anon', 'public.class_journey_versions', 'SELECT')
    OR has_table_privilege('authenticated', 'public.class_journey_versions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_journey_intervals', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_journeys', 'UPDATE')
  THEN RAISE EXCEPTION 'acl'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('class_journey_at', 'class_journey_effective_versions')
             AND (prosecdef OR NOT proconfig @> ARRAY['search_path=""'] OR provolatile <> 's'))
  THEN RAISE EXCEPTION 'definer/search_path'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname ~ '(record|register|constitute|maintain|create|homologate).*journey')
  THEN RAISE EXCEPTION 'writer exists'; END IF;
  _ok := _ok || 'acl no-writer ';

  -- Fixtures fictícias -------------------------------------------------------
  INSERT INTO public.institutional_persons(id, display_name) VALUES
    ('00000000-0000-0000-0000-0000000b4391', 'P1'), ('00000000-0000-0000-0000-0000000b4393', 'P3');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES
    ('00000000-0000-0000-0000-0000000b4301', '00000000-0000-0000-0000-0000000b4391'),
    ('00000000-0000-0000-0000-0000000b4303', '00000000-0000-0000-0000-0000000b4393');
  INSERT INTO public.institutional_schools(id) VALUES (_sch), ('esc-b43-outra');
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
  VALUES (_sch, 1, 'Escola ficticia', true, '2020-01-01', 'ato');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    ('00000000-0000-0000-0000-0000000b4391', 'secretaria-escolar', 'escola', _sch, '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b4393', 'teste-b43-nada', 'escola', 'esc-b43-outra', '2020-01-01');
  INSERT INTO public.institutional_academic_years(id) VALUES (_yr);
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  SELECT _yr, 1, 'Ano', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato', _rb, '00000000-0000-0000-0000-0000000b4391', e.id
  FROM (SELECT id FROM public.institutional_engagements WHERE person_id = '00000000-0000-0000-0000-0000000b4391' LIMIT 1) e;
  INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b43', 1, 'draft', '2020-01-01');
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']);
  UPDATE public.capability_policies SET status = 'homologated' WHERE id = pol;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  _k1 := public.register_institutional_class(_sch, _yr, 'J1', 'Turma ficticia 1', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  _k2 := public.register_institutional_class(_sch, _yr, 'J2', 'Turma ficticia 2', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  -- ausência explícita
  SELECT count(*), max(result_kind) INTO _n, _s FROM public.class_journey_at(_k1, '2026-03-01', _t1);
  IF _n <> 1 OR _s <> 'absent' THEN RAISE EXCEPTION 'absent: % %', _n, _s; END IF;
  RESET ROLE;
  -- a turma é gravada com clock_timestamp: o instante de conhecimento da jornada vem depois dela
  _t0 := clock_timestamp(); _t1 := _t0 + interval '1 minute';
  _ok := _ok || 'ausente ';

  -- v1: segunda a domingo; segunda com três intervalos (dois adjacentes) -----
  INSERT INTO public.class_journeys(id, class_id) VALUES (_j1, _k1), (_j2, _k2);
  INSERT INTO public.class_journey_versions(id, journey_id, version, change_kind, valid_from, valid_until, originating_act_ref, recorded_by, created_at)
  VALUES (_v1, _j1, 1, 'constituicao', '2026-02-01', '2026-12-31', 'ato-j1', _rb, _t0);
  INSERT INTO public.class_journey_intervals(version_id, weekday, starts_at, ends_at) VALUES
    (_v1, 1, '07:00', '09:00'), (_v1, 1, '09:00', '11:30'), (_v1, 1, '13:00', '15:00');
  INSERT INTO public.class_journey_intervals(version_id, weekday, starts_at, ends_at)
  SELECT _v1, g, '07:00', '11:00' FROM generate_series(2, 7) g;
  _ok := _ok || 'adjacentes ';

  BEGIN
    INSERT INTO public.class_journey_intervals VALUES (_v1, 2, '12:00', '12:00');
    RAISE EXCEPTION 'start>=end accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.class_journey_intervals VALUES (_v1, 1, '10:00', '10:30');
    RAISE EXCEPTION 'overlap accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'journey:interval-overlap' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.class_journey_intervals VALUES (_v1, 8, '07:00', '08:00');
    RAISE EXCEPTION 'weekday 8 accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  _ok := _ok || 'inicio-fim sobreposicao weekday ';

  -- vigência fora da turma
  BEGIN
    INSERT INTO public.class_journey_versions(journey_id, version, change_kind, valid_from, valid_until, originating_act_ref, recorded_by)
    VALUES (_j2, 1, 'constituicao', '2025-06-01', '2026-06-30', 'ato', _rb);
    RAISE EXCEPTION 'outside accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'journey:outside-class-validity' THEN RAISE; END IF;
  END;
  BEGIN -- aberta além do fim da turma
    INSERT INTO public.class_journey_versions(journey_id, version, change_kind, valid_from, valid_until, originating_act_ref, recorded_by)
    VALUES (_j2, 1, 'constituicao', '2026-02-01', NULL, 'ato', _rb);
    RAISE EXCEPTION 'open-ended accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'journey:outside-class-validity' THEN RAISE; END IF;
  END;
  -- versão sem intervalo
  BEGIN
    INSERT INTO public.class_journey_versions(journey_id, version, change_kind, valid_from, valid_until, originating_act_ref, recorded_by)
    VALUES (_j2, 1, 'constituicao', '2026-02-01', '2026-06-30', 'ato', _rb);
    SET CONSTRAINTS public.class_journey_version_has_intervals IMMEDIATE;
    RAISE EXCEPTION 'empty version accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'journey:version-without-intervals' THEN RAISE; END IF;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  -- cadeia inválida na gravação
  BEGIN
    INSERT INTO public.class_journey_versions(journey_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by)
    VALUES (_j1, 5, _v1, 'sucessao', '2026-07-01', '2026-12-31', 'ato', 'm', _rb);
    RAISE EXCEPTION 'bad chain accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'journey:invalid-chain' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.class_journey_versions(journey_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, recorded_by)
    VALUES (_j1, 2, _v1, 'sucessao', '2026-07-01', '2026-12-31', 'ato', _rb);
    RAISE EXCEPTION 'reason missing accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  _ok := _ok || 'fora-da-turma sem-intervalo cadeia ';

  -- append-only
  BEGIN
    UPDATE public.class_journey_intervals SET ends_at = '12:00' WHERE version_id = _v1 AND weekday = 2;
    RAISE EXCEPTION 'update accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s IN ('update accepted') THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.class_journey_versions WHERE id = _v1;
    RAISE EXCEPTION 'delete accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s IN ('delete accepted') THEN RAISE; END IF;
  END;
  BEGIN -- fora da janela da versão: intervalo recusado
    PERFORM set_config('sigem.journey_open_' || replace(_v1::text, '-', ''), '', true);
    INSERT INTO public.class_journey_intervals VALUES (_v1, 2, '15:00', '16:00');
    RAISE EXCEPTION 'late interval accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'journey:interval-after-version-closed' THEN RAISE; END IF;
  END;
  _ok := _ok || 'append-only intervalo-tardio ';

  -- v2 sucessão em 01/07 (conhecida em _t0); v3 retificação de v2 conhecida só em _t1
  INSERT INTO public.class_journey_versions(id, journey_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by, created_at)
  VALUES (_v2, _j1, 2, _v1, 'sucessao', '2026-07-01', '2026-12-31', 'ato-j2', 'nova jornada', _rb, _t0);
  INSERT INTO public.class_journey_intervals VALUES (_v2, 1, '13:00', '17:00');
  INSERT INTO public.class_journey_versions(id, journey_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by, created_at)
  VALUES (_v3, _j1, 3, _v2, 'retificacao', '2026-07-01', '2026-12-31', 'ato-j3', 'erro material', _rb, _t1);
  INSERT INTO public.class_journey_intervals VALUES (_v3, 1, '13:00', '18:00');
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  -- derivados e ordem
  SELECT count(*) INTO _n FROM public.class_journey_at(_k1, '2026-03-02', _t1) WHERE result_kind = 'interval';
  IF _n <> 9 THEN RAISE EXCEPTION 'intervals %', _n; END IF;
  SELECT * INTO r FROM public.class_journey_at(_k1, '2026-03-02', _t1) LIMIT 1;
  IF r.version_id <> _v1 OR r.weekday <> 1 OR r.starts_at <> '07:00' OR r.day_first_start <> '07:00' OR r.day_last_end <> '15:00'
     OR r.day_minutes <> 390 OR r.week_minutes <> 1830 OR r.effective_until <> '2026-06-30' THEN
    RAISE EXCEPTION 'derived %', row_to_json(r); END IF;
  SELECT day_minutes INTO d FROM public.class_journey_at(_k1, '2026-03-02', _t1) WHERE weekday = 7 LIMIT 1;
  IF d <> 240 THEN RAISE EXCEPTION 'sunday %', d; END IF;
  _ok := _ok || 'derivados semana-completa ';
  -- validOn
  SELECT max(result_kind) INTO _s FROM public.class_journey_at(_k1, '2026-01-15', _t1);
  IF _s <> 'absent' THEN RAISE EXCEPTION 'before validity %', _s; END IF;
  -- knownAt: em _t0 vale v2 (13–17); em _t1 vale v3 (13–18)
  SELECT * INTO r FROM public.class_journey_at(_k1, '2026-08-03', _t0);
  IF r.version_id <> _v2 OR r.ends_at <> '17:00' OR r.week_minutes <> 240 THEN RAISE EXCEPTION 'knownAt past %', row_to_json(r); END IF;
  SELECT * INTO r FROM public.class_journey_at(_k1, '2026-08-03', _t1);
  IF r.version_id <> _v3 OR r.ends_at <> '18:00' OR r.week_minutes <> 300 THEN RAISE EXCEPTION 'knownAt now %', row_to_json(r); END IF;
  -- knownAt antes da jornada existir ⇒ ausência
  SELECT max(result_kind) INTO _s FROM public.class_journey_at(_k1, '2026-03-02', _t0 - interval '1 second');
  IF _s <> 'absent' THEN RAISE EXCEPTION 'knownAt before %', _s; END IF;
  _ok := _ok || 'validon knownat ';

  -- sem permissão: nada vaza
  PERFORM set_config('request.jwt.claims', u_none, true);
  SELECT count(*), max(result_kind), max(week_minutes) INTO _n, _s, d FROM public.class_journey_at(_k1, '2026-03-02', _t1);
  IF _n <> 1 OR _s <> 'access-denied' OR d IS NOT NULL THEN RAISE EXCEPTION 'denied % %', _n, _s; END IF;
  SELECT count(*) INTO _n FROM public.class_journey_at('turma-inexistente', '2026-03-02', _t1) WHERE result_kind = 'access-denied';
  IF _n <> 1 THEN RAISE EXCEPTION 'nonexistent'; END IF;
  SELECT (SELECT count(*) FROM public.class_journeys) + (SELECT count(*) FROM public.class_journey_versions)
       + (SELECT count(*) FROM public.class_journey_intervals) INTO _n;
  IF _n <> 0 THEN RAISE EXCEPTION 'table leak %', _n; END IF;
  RESET ROLE;
  _ok := _ok || 'sem-permissao ';

  -- cadeia corrompida e ambiguidade: falham fechadas
  BEGIN
    ALTER TABLE public.class_journey_versions DISABLE TRIGGER class_journey_version_guard;
    _vx := gen_random_uuid();
    INSERT INTO public.class_journey_versions(id, journey_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by, created_at)
    VALUES (_vx, _j1, 4, _v3, 'sucessao', '2026-01-15', '2026-12-31', 'ato', 'corrompida', _rb, _t1);
    PERFORM set_config('sigem.journey_open_' || replace(_vx::text, '-', ''), '1', true); -- guard desligado só neste bloco corrompido
    INSERT INTO public.class_journey_intervals VALUES (_vx, 2, '08:00', '09:00');
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', u_sec, true);
    PERFORM * FROM public.class_journey_at(_k1, '2026-03-02', _t1);
    RAISE EXCEPTION 'ambiguity not detected';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'journey:ambiguous-temporal-state' THEN RAISE; END IF;
  END;
  RESET ROLE;
  BEGIN
    ALTER TABLE public.class_journey_versions DISABLE TRIGGER class_journey_version_guard;
    _vx := gen_random_uuid();
    INSERT INTO public.class_journey_versions(id, journey_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by, created_at)
    VALUES (_vx, _j1, 9, _v3, 'sucessao', '2026-09-01', '2026-12-31', 'ato', 'corrompida', _rb, _t1);
    PERFORM set_config('sigem.journey_open_' || replace(_vx::text, '-', ''), '1', true); -- guard desligado só neste bloco corrompido
    INSERT INTO public.class_journey_intervals VALUES (_vx, 2, '08:00', '09:00');
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', u_sec, true);
    PERFORM * FROM public.class_journey_at(_k1, '2026-03-02', _t1);
    RAISE EXCEPTION 'invalid chain not detected';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'journey:invalid-chain' THEN RAISE; END IF;
  END;
  _ok := _ok || 'ambiguidade cadeia-corrompida ';

  RAISE EXCEPTION 'b43-tests-ok: %', _ok;
END $t$;
