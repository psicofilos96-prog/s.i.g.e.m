-- B4.5 — Horário do profissional como projeção. Teste transacional real: termina em RAISE, nada persiste.
-- Sucesso = 'b45-tests-ok: ...'. Fixtures fictícias inseridas pelo papel privilegiado do teste; sem writer.
DO $t$
DECLARE
  u_sec text := '{"sub":"00000000-0000-0000-0000-0000000b4501","role":"authenticated"}';
  u_doc text := '{"sub":"00000000-0000-0000-0000-0000000b4502","role":"authenticated"}';
  u_oth text := '{"sub":"00000000-0000-0000-0000-0000000b4504","role":"authenticated"}';
  u_abs text := '{"sub":"00000000-0000-0000-0000-0000000b4505","role":"authenticated"}';
  u_nolink text := '{"sub":"00000000-0000-0000-0000-0000000b4509","role":"authenticated"}';
  pol uuid := '00000000-0000-0000-0000-0000000b45a0';
  p1 uuid := '00000000-0000-0000-0000-0000000b4591'; p2 uuid := '00000000-0000-0000-0000-0000000b4592';
  p4 uuid := '00000000-0000-0000-0000-0000000b4594'; p5 uuid := '00000000-0000-0000-0000-0000000b4595';
  _rb uuid := '00000000-0000-0000-0000-0000000b4501';
  _yr text := 'ano-b45'; _k1 text; _k2 text; _k3 text; _esec uuid; _esec2 uuid;
  _ea uuid := gen_random_uuid(); _ea2 uuid := gen_random_uuid(); _eb uuid := gen_random_uuid(); _ec uuid := gen_random_uuid();
  _eo uuid := gen_random_uuid(); _eunref uuid := gen_random_uuid(); _e5 uuid := gen_random_uuid();
  _j1 text := 'cj-' || gen_random_uuid()::text; _j3 text := 'cj-' || gen_random_uuid()::text; _jv1 uuid := gen_random_uuid(); _jv3 uuid := gen_random_uuid();
  _s1 text := 'csch-' || gen_random_uuid()::text; _s2 text := 'csch-' || gen_random_uuid()::text; _s3 text := 'csch-' || gen_random_uuid()::text;
  _v1 uuid := gen_random_uuid(); _v1r uuid := gen_random_uuid(); _v1s uuid := gen_random_uuid(); _w2 uuid := gen_random_uuid(); _w3 uuid := gen_random_uuid(); _vx uuid;
  _b1 uuid := gen_random_uuid(); _b2 uuid := gen_random_uuid(); _b4 uuid := gen_random_uuid(); _c1 uuid := gen_random_uuid(); _k uuid := gen_random_uuid();
  _r1 uuid := gen_random_uuid(); _r2 uuid := gen_random_uuid(); _o1 uuid := gen_random_uuid(); _o2 uuid := gen_random_uuid();
  _t0 timestamptz; _t1 timestamptz; _ok text := ''; _n integer; _s text; r record;
BEGIN
  -- ACL / ausência de writer e de capability ------------------------------------
  IF has_function_privilege('anon', 'public.person_schedule_at(uuid,date,timestamptz)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.person_schedule_at(uuid,date,timestamptz)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.person_schedule_class_source(text,date,timestamptz)', 'EXECUTE')
    OR EXISTS (SELECT 1 FROM information_schema.routine_privileges WHERE grantee = 'PUBLIC'
               AND routine_name IN ('person_schedule_at', 'person_schedule_class_source', 'class_schedule_engagement_valid'))
  THEN RAISE EXCEPTION 'acl'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('person_schedule_at', 'person_schedule_class_source')
             AND (prosecdef OR NOT proconfig @> ARRAY['search_path=""'] OR provolatile <> 's'))
  THEN RAISE EXCEPTION 'definer/search_path'; END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relname ~ '(person|professional)_schedule')
  THEN RAISE EXCEPTION 'persisted projection'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname ~ '(record|register|constitute|maintain|create|homologate|publish).*schedule')
  THEN RAISE EXCEPTION 'writer exists'; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE capability_id ~* '(grade|horario|jornada|agenda)')
  THEN RAISE EXCEPTION 'unexpected capability'; END IF;
  IF position('institutional_class_schedule_slots' IN pg_get_functiondef('public.person_schedule_at(uuid,date,timestamptz)'::regprocedure)) > 0
  THEN RAISE EXCEPTION 'legacy source'; END IF;
  _ok := _ok || 'acl no-writer no-capability no-table no-legacy ';

  -- Fixtures fictícias -----------------------------------------------------------
  INSERT INTO public.institutional_persons(id, display_name) VALUES (p1, 'P1'), (p2, 'P2'), (p4, 'P4'), (p5, 'P5');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES
    ('00000000-0000-0000-0000-0000000b4501', p1), ('00000000-0000-0000-0000-0000000b4502', p2),
    ('00000000-0000-0000-0000-0000000b4504', p4), ('00000000-0000-0000-0000-0000000b4505', p5);
  INSERT INTO public.institutional_schools(id) VALUES ('esc-b45-a'), ('esc-b45-b');
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
  VALUES ('esc-b45-a', 1, 'Escola A ficticia', true, '2020-01-01', 'ato'), ('esc-b45-b', 1, 'Escola B ficticia', true, '2020-01-01', 'ato');
  INSERT INTO public.institutional_engagements(id, person_id, engagement_kind_id, scope_level, school_id, valid_from)
  VALUES (gen_random_uuid(), p1, 'secretaria-escolar', 'escola', 'esc-b45-a', '2020-01-01') RETURNING id INTO _esec;
  INSERT INTO public.institutional_engagements(id, person_id, engagement_kind_id, scope_level, school_id, valid_from)
  VALUES (gen_random_uuid(), p1, 'secretaria-escolar', 'escola', 'esc-b45-b', '2020-01-01') RETURNING id INTO _esec2;
  INSERT INTO public.institutional_academic_years(id) VALUES (_yr);
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_yr, 1, 'Ano', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato', _rb, p1, _esec);
  INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b45', 1, 'draft', '2020-01-01');
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']);
  UPDATE public.capability_policies SET status = 'homologated' WHERE id = pol;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  _k1 := public.register_institutional_class('esc-b45-a', _yr, 'G1', 'Turma ficticia 1', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  _k2 := public.register_institutional_class('esc-b45-a', _yr, 'G2', 'Turma ficticia 2', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  _k3 := public.register_institutional_class('esc-b45-b', _yr, 'G3', 'Turma ficticia 3', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  RESET ROLE;
  _t0 := clock_timestamp(); _t1 := _t0 + interval '1 minute';

  INSERT INTO public.institutional_curricular_components(id, label) VALUES ('cmp-b45-a', 'A'), ('cmp-b45-b', 'B');
  INSERT INTO public.curricular_component_versions(component_id, version, official_name, is_active, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES ('cmp-b45-a', 1, 'Componente A ficticio', true, '2020-01-01', 'ato', _rb, _esec),
         ('cmp-b45-b', 1, 'Componente B ficticio', true, '2020-01-01', 'ato', _rb, _esec);
  INSERT INTO public.institutional_engagements(id, person_id, engagement_kind_id, scope_level, class_id, component_id, valid_from) VALUES
    (_ea, p2, 'teste-b45-docencia', 'turma', _k1, 'cmp-b45-a', '2026-01-01'),
    (_ea2, p2, 'teste-b45-docencia', 'turma', _k1, NULL, '2026-01-01'),
    (_eb, p2, 'teste-b45-docencia', 'turma', _k2, NULL, '2026-01-01'),
    (_ec, p2, 'teste-b45-docencia', 'turma', _k3, NULL, '2026-01-01'),
    (_eo, p4, 'teste-b45-docencia', 'turma', _k1, NULL, '2026-01-01'),
    (_eunref, p4, 'teste-b45-docencia', 'turma', _k1, NULL, '2026-01-01'),
    (_e5, p5, 'teste-b45-docencia', 'turma', _k2, NULL, '2026-01-01');

  -- Jornadas: K1 e K3; K2 sem jornada (grade bloqueada)
  INSERT INTO public.class_journeys(id, class_id) VALUES (_j1, _k1), (_j3, _k3);
  INSERT INTO public.class_journey_versions(id, journey_id, version, change_kind, valid_from, valid_until, originating_act_ref, recorded_by, created_at)
  VALUES (_jv1, _j1, 1, 'constituicao', '2026-02-01', '2026-12-31', 'ato-j', _rb, _t0),
         (_jv3, _j3, 1, 'constituicao', '2026-02-01', '2026-12-31', 'ato-j', _rb, _t0);
  INSERT INTO public.class_journey_intervals SELECT _jv1, g, '07:00', '12:00' FROM generate_series(1, 7) g;
  INSERT INTO public.class_journey_intervals SELECT _jv3, g, '07:00', '12:00' FROM generate_series(1, 7) g;

  -- Grades: K1 v1 (conhecida _t0), K2 sem jornada, K3 em outra escola
  INSERT INTO public.class_schedules(id, class_id) VALUES (_s1, _k1), (_s2, _k2), (_s3, _k3);
  INSERT INTO public.class_schedule_versions(id, schedule_id, version, change_kind, valid_from, valid_until, originating_act_ref, recorded_by, created_at)
  VALUES (_v1, _s1, 1, 'constituicao', '2026-02-01', '2026-06-30', 'ato-g1', _rb, _t0);
  INSERT INTO public.class_schedule_blocks(id, version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES
    (_b1, _v1, 'b1', 1, '07:00', '08:00', 'cmp-b45-a'),
    (_b2, _v1, 'b2', 1, '08:00', '09:00', 'cmp-b45-b'),
    (_b4, _v1, 'b4', 3, '09:00', '10:00', 'cmp-b45-a');
  INSERT INTO public.class_schedule_block_engagements VALUES (_b1, _ea), (_b1, _ea2), (_b1, _eo), (_b2, _ea2), (_b4, _eo);
  INSERT INTO public.class_schedule_versions(id, schedule_id, version, change_kind, valid_from, valid_until, originating_act_ref, recorded_by, created_at)
  VALUES (_w2, _s2, 1, 'constituicao', '2026-02-01', '2026-12-31', 'ato-g2', _rb, _t0);
  INSERT INTO public.class_schedule_blocks(id, version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES (_k, _w2, 'k', 1, '07:00', '08:00', 'cmp-b45-a');
  INSERT INTO public.class_schedule_block_engagements VALUES (_k, _eb), (_k, _e5);
  INSERT INTO public.class_schedule_versions(id, schedule_id, version, change_kind, valid_from, valid_until, originating_act_ref, recorded_by, created_at)
  VALUES (_w3, _s3, 1, 'constituicao', '2026-02-01', '2026-12-31', 'ato-g3', _rb, _t0);
  INSERT INTO public.class_schedule_blocks(id, version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES (_c1, _w3, 'c1', 1, '07:30', '08:30', 'cmp-b45-b');
  INSERT INTO public.class_schedule_block_engagements VALUES (_c1, _ec);
  -- Retificação de K1 v1 conhecida em _t1: b1 passa para 10:00–11:00 (sem sobreposição com c1)
  INSERT INTO public.class_schedule_versions(id, schedule_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by, created_at)
  VALUES (_v1r, _s1, 2, _v1, 'retificacao', '2026-02-01', '2026-06-30', 'ato-g1r', 'erro material', _rb, _t1);
  INSERT INTO public.class_schedule_blocks(id, version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES
    (_r1, _v1r, 'b1', 1, '10:00', '11:00', 'cmp-b45-a'), (_r2, _v1r, 'b2', 1, '08:00', '09:00', 'cmp-b45-b');
  INSERT INTO public.class_schedule_block_engagements VALUES (_r1, _ea), (_r2, _ea2);
  -- Sucessão de K1 a partir de 01/07 (conhecida _t1) com sobreposição dentro da própria turma
  INSERT INTO public.class_schedule_versions(id, schedule_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by, created_at)
  VALUES (_v1s, _s1, 3, _v1r, 'sucessao', '2026-07-01', '2026-12-31', 'ato-g1s', 'nova grade', _rb, _t1);
  INSERT INTO public.class_schedule_blocks(id, version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES
    (_o1, _v1s, 'o1', 1, '07:00', '08:00', 'cmp-b45-a'), (_o2, _v1s, 'o2', 1, '07:30', '08:30', 'cmp-b45-b');
  INSERT INTO public.class_schedule_block_engagements VALUES (_o1, _ea), (_o2, _ea2);
  SET CONSTRAINTS ALL DEFERRED;

  -- Helper B4.4 endurecido: não é oracle -------------------------------------------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  IF public.class_schedule_engagement_valid(_ea, _k1, 'cmp-b45-a', '2026-03-02', _t0) IS NOT TRUE THEN RAISE EXCEPTION 'helper referenced'; END IF;
  IF public.class_schedule_engagement_valid(_eunref, _k1, NULL, '2026-03-02', _t1) IS NOT FALSE THEN RAISE EXCEPTION 'helper oracle unref'; END IF;
  IF public.class_schedule_engagement_valid(gen_random_uuid(), _k1, NULL, '2026-03-02', _t1) IS NOT FALSE THEN RAISE EXCEPTION 'helper oracle random'; END IF;
  IF public.class_schedule_engagement_valid(_eb, _k1, 'cmp-b45-a', '2026-03-02', _t1) IS NOT FALSE THEN RAISE EXCEPTION 'helper oracle other class'; END IF;
  IF public.class_schedule_engagement_valid(_ea2, _k1, 'cmp-x', '2026-03-02', _t1) IS NOT FALSE THEN RAISE EXCEPTION 'helper oracle component'; END IF;
  _ok := _ok || 'helper-sem-oracle ';

  -- Sem pessoa vinculada / outra pessoa: access-denied sem vazamento ------------------
  PERFORM set_config('request.jwt.claims', u_nolink, true);
  SELECT count(*), max(result_kind) INTO _n, _s FROM public.person_schedule_at(p2, '2026-03-02', _t0);
  IF _n <> 1 OR _s <> 'access-denied' THEN RAISE EXCEPTION 'no link % %', _n, _s; END IF;
  PERFORM set_config('request.jwt.claims', u_oth, true);
  FOR r IN SELECT * FROM public.person_schedule_at(p2, '2026-03-02', _t0) LOOP
    IF r.result_kind <> 'access-denied' OR r.class_id IS NOT NULL OR r.block_id IS NOT NULL OR r.weekday IS NOT NULL
       OR r.own_engagement_ids IS NOT NULL OR r.operational_block_count IS NOT NULL OR r.conflict_count IS NOT NULL
    THEN RAISE EXCEPTION 'other leak %', row_to_json(r); END IF;
  END LOOP;
  SELECT count(*) INTO _n FROM public.person_schedule_at(gen_random_uuid(), '2026-03-02', _t0);
  IF _n <> 1 THEN RAISE EXCEPTION 'nonexistent'; END IF;
  -- própria pessoa P4: b1 e b4, sem conflito; não vê engagements de P2
  SELECT count(*) INTO _n FROM public.person_schedule_at(p4, '2026-03-02', _t0) WHERE result_kind = 'block';
  IF _n <> 2 THEN RAISE EXCEPTION 'p4 blocks %', _n; END IF;
  IF EXISTS (SELECT 1 FROM public.person_schedule_at(p4, '2026-03-02', _t0) WHERE result_kind = 'block' AND own_engagement_ids <> ARRAY[_eo])
  THEN RAISE EXCEPTION 'p4 sees others engagements'; END IF;
  _ok := _ok || 'sem-pessoa outra-pessoa-negada propria-pessoa ';

  -- Absent
  PERFORM set_config('request.jwt.claims', u_abs, true);
  -- P5 só está no bloco bloqueado de K2 ⇒ bloco não operacional, nunca confirmado
  SELECT count(*) INTO _n FROM public.person_schedule_at(p5, '2026-03-02', _t0) WHERE result_kind = 'block' AND operational;
  IF _n <> 0 THEN RAISE EXCEPTION 'blocked as operational'; END IF;
  SELECT max(result_kind) INTO _s FROM public.person_schedule_at(p5, '2026-01-15', _t0);
  IF _s <> 'absent' THEN RAISE EXCEPTION 'absent validOn %', _s; END IF;
  _ok := _ok || 'absent ';

  -- P2 em 02/03 (segunda), knownAt _t0 ------------------------------------------------
  PERFORM set_config('request.jwt.claims', u_doc, true);
  SELECT count(*) INTO _n FROM public.person_schedule_at(p2, '2026-03-02', _t0) WHERE result_kind = 'block';
  IF _n <> 4 THEN RAISE EXCEPTION 'p2 blocks %', _n; END IF;               -- b1, b2, c1, k
  SELECT * INTO r FROM public.person_schedule_at(p2, '2026-03-02', _t0) WHERE result_kind = 'block' AND block_id = _b1;
  IF cardinality(r.own_engagement_ids) <> 2 OR NOT r.operational OR r.school_id <> 'esc-b45-a' OR r.component_name <> 'Componente A ficticio'
  THEN RAISE EXCEPTION 'b1 %', row_to_json(r); END IF;
  SELECT * INTO r FROM public.person_schedule_at(p2, '2026-03-02', _t0) WHERE result_kind = 'block' AND block_id = _k;
  IF r.operational OR r.source_state <> 'bloqueada:jornada-ausente' OR r.own_engagement_ids <> ARRAY[_eb] THEN RAISE EXCEPTION 'k %', row_to_json(r); END IF;
  SELECT count(*) INTO _n FROM public.person_schedule_at(p2, '2026-03-02', _t0) WHERE result_kind = 'conflict';
  IF _n <> 2 THEN RAISE EXCEPTION 'conflicts %', _n; END IF;                -- (b1,c1) (b2,c1); b1–b2 adjacentes não conflitam
  IF EXISTS (SELECT 1 FROM public.person_schedule_at(p2, '2026-03-02', _t0) WHERE result_kind = 'conflict'
             AND (block_id >= other_block_id OR _k IN (block_id, other_block_id) OR source_state <> 'conflito-temporal-potencial'))
  THEN RAISE EXCEPTION 'conflict pairs'; END IF;
  SELECT * INTO r FROM public.person_schedule_at(p2, '2026-03-02', _t0) WHERE result_kind = 'conflict' AND _b1 IN (block_id, other_block_id);
  IF r.overlap_starts_at <> '07:30' OR r.overlap_ends_at <> '08:00' THEN RAISE EXCEPTION 'overlap window %', row_to_json(r); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.person_schedule_at(p2, '2026-03-02', _t0) WHERE result_kind = 'conflict'
                 AND (class_id = _k3 OR other_class_id = _k3) AND (class_id = _k1 OR other_class_id = _k1)) THEN RAISE EXCEPTION 'cross-school'; END IF;
  SELECT * INTO r FROM public.person_schedule_at(p2, '2026-03-02', _t0) WHERE result_kind = 'summary';
  IF r.operational_block_count <> 3 OR r.unavailable_block_count <> 1 OR r.week_minutes <> 180 OR r.conflict_count <> 2
  THEN RAISE EXCEPTION 'summary %', row_to_json(r); END IF;
  _ok := _ok || 'um-bloco-dois-engagements-uma-linha adjacentes entre-escolas pares-canonicos fonte-bloqueada totais ';

  -- knownAt _t1: retificação (b1 → 10:00) só reduz para 1 conflito (b2,c1); passado preservado acima
  SELECT count(*) INTO _n FROM public.person_schedule_at(p2, '2026-03-02', _t1) WHERE result_kind = 'conflict';
  IF _n <> 1 THEN RAISE EXCEPTION 'retif conflicts %', _n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.person_schedule_at(p2, '2026-03-02', _t1) WHERE result_kind = 'block' AND block_id = _r1 AND starts_at = '10:00')
  THEN RAISE EXCEPTION 'retif block'; END IF;
  SELECT max(result_kind) INTO _s FROM public.person_schedule_at(p2, '2026-03-02', _t0 - interval '1 second') WHERE result_kind IN ('block', 'absent');
  IF _s <> 'absent' THEN RAISE EXCEPTION 'knownAt before %', _s; END IF;
  -- 06/07: sobreposição dentro de K1 ⇒ grade inconsistente, blocos não operacionais, conflito só com c1? não: inconsistente não gera conflito
  SELECT count(*) INTO _n FROM public.person_schedule_at(p2, '2026-07-06', _t1) WHERE result_kind = 'block' AND class_id = _k1 AND NOT operational
    AND source_state = 'inconsistente:sobreposicao-de-blocos';
  IF _n <> 2 THEN RAISE EXCEPTION 'same-class overlap %', _n; END IF;
  SELECT count(*) INTO _n FROM public.person_schedule_at(p2, '2026-07-06', _t1) WHERE result_kind = 'conflict';
  IF _n <> 0 THEN RAISE EXCEPTION 'inconsistent generated conflict %', _n; END IF;
  _ok := _ok || 'knownat-retificacao validon mesma-turma-inconsistente ';
  RESET ROLE;

  -- Cadeia corrompida em K3 ⇒ fonte indisponível explícita, nenhum bloco de K3 fabricado
  SET CONSTRAINTS ALL IMMEDIATE;  -- descarrega gatilhos pendentes antes do ALTER
  ALTER TABLE public.class_schedule_versions DISABLE TRIGGER class_schedule_version_guard;
  _vx := gen_random_uuid();
  INSERT INTO public.class_schedule_versions(id, schedule_id, version, supersedes_id, change_kind, valid_from, valid_until, originating_act_ref, change_reason, recorded_by, created_at)
  VALUES (_vx, _s3, 7, _w3, 'sucessao', '2026-09-01', '2026-12-31', 'ato', 'corrompida', _rb, _t1);
  PERFORM set_config('sigem.schedule_open_' || replace(_vx::text, '-', ''), '1', true);
  INSERT INTO public.class_schedule_blocks(version_id, block_key, weekday, starts_at, ends_at, component_id) VALUES (_vx, 'c', 2, '08:00', '09:00', 'cmp-b45-a');
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_doc, true);
  SELECT * INTO r FROM public.person_schedule_at(p2, '2026-03-02', _t1) WHERE result_kind = 'source-unavailable';
  IF r.class_id <> _k3 OR r.source_state <> 'erro-de-leitura' OR r.source_issue <> 'schedule:invalid-chain' THEN RAISE EXCEPTION 'source error %', row_to_json(r); END IF;
  IF EXISTS (SELECT 1 FROM public.person_schedule_at(p2, '2026-03-02', _t1) WHERE class_id = _k3 AND result_kind IN ('block', 'conflict'))
  THEN RAISE EXCEPTION 'fabricated K3'; END IF;
  RESET ROLE;
  _ok := _ok || 'cadeia-corrompida-fonte-indisponivel ';

  RAISE EXCEPTION 'b45-tests-ok: %', _ok;
END $t$;
