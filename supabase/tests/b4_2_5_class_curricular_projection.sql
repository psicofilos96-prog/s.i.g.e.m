-- B4.2.5 — Projeção da turma sobre B4.2.4 (inclui o cenário B4.2.4). Teste transacional real:
-- o bloco termina em RAISE, então nada persiste. Sucesso = 'b424-tests-ok: ...'.
-- Todos os esquemas/valores/IDs são fictícios e não representam norma.
DO $t$
DECLARE
  u_sec text := '{"sub":"00000000-0000-0000-0000-0000000b4241","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-0000000b4243","role":"authenticated"}';
  pol uuid := '00000000-0000-0000-0000-0000000b42a0';
  _sch text := 'esc-b424'; _yr text := 'ano-b424';
  _k text[] := ARRAY[]::text[];
  _p1 text := 'ccp-' || gen_random_uuid()::text; _p2 text := 'ccp-' || gen_random_uuid()::text;
  _ma text := 'mat-' || gen_random_uuid()::text; _mb text := 'mat-' || gen_random_uuid()::text;
  _mc text := 'mat-' || gen_random_uuid()::text; _mn text := 'mat-' || gen_random_uuid()::text;
  _mz text := 'mat-' || gen_random_uuid()::text; _map text := 'mat-' || gen_random_uuid()::text;
  _me text := 'mat-' || gen_random_uuid()::text;
  _mva uuid; _mvb uuid; _mvc uuid; _mvn uuid; _mvap uuid; _mve uuid;
  _pv1 uuid; _pv2 uuid; _pq uuid; _ov uuid; _cv uuid; _cv10 uuid; _cid text; _cid10 text; _av uuid; _aid text;
  _tA timestamptz; _tR timestamptz; _tN timestamptz; _s text; _n integer; _ok text := '';
  _e uuid := gen_random_uuid(); _u uuid := gen_random_uuid(); _on date := DATE '2026-03-01';
  r record; i integer; _ax jsonb;
  pos jsonb[] := ARRAY[NULL,
    '[{"scheme":"esq-b424-extra","value":"x","version":1}]',
    '[{"scheme":"esq-b424-pos","value":"p03","version":1}]',
    '[{"scheme":"esq-b424-pos","value":"p04","version":1}]',
    '[{"scheme":"esq-b424-pos","value":"p05","version":1}]',
    '[{"scheme":"esq-b424-pos","value":"p06","version":1}]',
    '[{"scheme":"esq-b424-pos","value":"p07","version":1}]',
    '[{"scheme":"esq-b424-pos","value":"p08","version":1}]',
    '[{"scheme":"esq-b424-pos","value":"p09","version":1}]',
    '[{"scheme":"esq-b424-pos","value":"p10","version":1},{"scheme":"esq-b424-extra","value":"x","version":1}]',
    '[{"scheme":"esq-b424-pos","value":"p11","version":1}]',
    '[{"scheme":"esq-b424-pos","value":"p12","version":1}]',
    '[{"scheme":"esq-b424-pos","value":"p10","version":1}]',
    NULL,
    '[{"scheme":"esq-b424-pos","value":"p10","version":1}]']::jsonb[];
  cls_of integer[] := ARRAY[1,1,1,1,1,1,1,1,1,1,1,1, 2, 3, 6];
  want text[] := ARRAY['ausente:posicao','ausente:posicao-incompleta','ausente:correspondencia','inconsistente:correspondencia-ambigua',
    'ausente:matriz-vigente','bloqueada:matriz-nao-homologada','bloqueada:coluna-inexistente','bloqueada:coluna-nao-referenciada',
    'inconsistente:coluna-ref-divergente','resolvida-por-posicao','resolvida-por-posicao','bloqueada:aplicabilidade-nao-homologada',
    'nao-aplicavel:natureza','nao-aplicavel:ramo-especifico','inconsistente:associacao-explicita-em-turma-regular'];
BEGIN
  -- ACL ---------------------------------------------------------------------
  IF has_function_privilege('anon','public.class_curricular_resolution_context_at(text,date,timestamptz)','EXECUTE')
    OR has_function_privilege('anon','public.class_specific_curricular_matrix_at(text,date,timestamptz)','EXECUTE')
    OR has_function_privilege('anon','public.student_curricular_matrix_at(text,text,date,timestamptz)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.student_curricular_matrix_at(text,text,date,timestamptz)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.class_specific_curricular_matrix_at(text,date,timestamptz)','EXECUTE')
  THEN RAISE EXCEPTION 'acl exec'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('class_curricular_resolution_context_at','class_specific_curricular_matrix_at','student_curricular_matrix_at')
             AND (prosecdef OR NOT proconfig @> ARRAY['search_path=""'] OR provolatile <> 's'))
  THEN RAISE EXCEPTION 'definer/search_path'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname ~ '^(record|homologate|create)_.*(correspondence|specific|association|profile|resolution)') THEN RAISE EXCEPTION 'writer exists'; END IF;
  _ok := _ok || 'acl ';

  -- Fixtures fictícias (privilegiadas) --------------------------------------
  INSERT INTO public.institutional_persons(id, display_name) VALUES
    ('00000000-0000-0000-0000-0000000b4291', 'P1'), ('00000000-0000-0000-0000-0000000b4293', 'P3');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES
    ('00000000-0000-0000-0000-0000000b4241', '00000000-0000-0000-0000-0000000b4291'),
    ('00000000-0000-0000-0000-0000000b4243', '00000000-0000-0000-0000-0000000b4293');
  INSERT INTO public.institutional_schools(id) VALUES (_sch);
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
  VALUES (_sch, 1, 'Escola ficticia', true, '2020-01-01', 'ato');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    ('00000000-0000-0000-0000-0000000b4291', 'secretaria-escolar', 'escola', _sch, '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b4293', 'teste-b424-nada', 'escola', _sch, '2020-01-01');
  INSERT INTO public.institutional_academic_years(id) VALUES (_yr);
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  SELECT _yr, 1, 'Ano', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato',
    '00000000-0000-0000-0000-0000000b4241', '00000000-0000-0000-0000-0000000b4291', e.id
  FROM (SELECT id FROM public.institutional_engagements WHERE person_id = '00000000-0000-0000-0000-0000000b4291' LIMIT 1) e;
  INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b424', 1, 'draft', '2020-01-01');
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']),
    (pol, 'secretaria-escolar', 'manter-matricula-e-enturmacao', ARRAY['school']),
    (pol, 'secretaria-escolar', 'consultar-matricula-e-movimentacao', ARRAY['school']);
  UPDATE public.capability_policies SET status = 'homologated' WHERE id = pol;
  INSERT INTO public.institutional_students(id, display_name) SELECT 'est-b424-' || g, 'E' || g FROM generate_series(1, 15) g;
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status, homologation_act_ref, valid_from)
  SELECT 'esq-b424-pos', 'p' || lpad(g::text, 2, '0'), 1, 'P' || g, 'homologada', 'ato', '2020-01-01' FROM generate_series(2, 12) g;
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status, homologation_act_ref, valid_from) VALUES
    ('natureza-da-participacao-educacional', 'nat-b424', 1, 'N', 'homologada', 'ato', '2020-01-01'),
    ('esq-b424-extra', 'x', 1, 'X', 'homologada', 'ato', '2020-01-01'),
    ('esq-b424-nat', 'reg', 1, 'R', 'homologada', 'ato', '2020-01-01'),
    ('esq-b424-nat', 'fora', 1, 'F', 'homologada', 'ato', '2020-01-01'),
    ('esq-b424-nat', 'esp', 1, 'S', 'homologada', 'ato', '2020-01-01'),
    ('esq-b424-nat', 'semp', 1, 'SP', 'homologada', 'ato', '2020-01-01'),
    ('esq-b424-nat', 'rasc', 1, 'RA', 'rascunho', 'ato', '2020-01-01');

  -- turmas, matrículas, alocações e posições pelos writers canônicos
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  FOR i IN 1..10 LOOP
    _k := _k || public.register_institutional_class(_sch, _yr, 'K' || i, 'Turma ficticia ' || i, 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  END LOOP;
  FOR i IN 1..15 LOOP
    PERFORM public.constitute_cycle_enrollment('m-b424-' || i, 'est-b424-' || i, _sch, _yr, '2026-02-01', NULL, 'ato', NULL, NULL);
    PERFORM public.declare_cycle_participation('p-b424-' || i, NULL, 'm-b424-' || i, 'nat-b424', 1, '2026-02-01', NULL, 'ato', NULL);
    PERFORM public.record_class_allocation('a-b424-' || i, 'p-b424-' || i, _k[cls_of[i]], '2026-02-01', 'ato', NULL, NULL);
    IF pos[i] IS NOT NULL THEN
      PERFORM public.record_allocation_curricular_position('pos-b424-' || i, NULL, 'a-b424-' || i, '2026-02-01', NULL, pos[i], 'ato', NULL);
    END IF;
  END LOOP;
  RESET ROLE;

  -- perfil ausente
  SELECT context_state INTO _s FROM public.class_curricular_resolution_context_at(_k[1], _on, clock_timestamp());
  IF _s IS DISTINCT FROM 'bloqueada:perfil-ausente' THEN RAISE EXCEPTION 'perfil ausente: %', _s; END IF;
  SELECT count(*) INTO _n FROM public.student_curricular_matrix_at(_sch, _k[1], _on, clock_timestamp()) WHERE resolution_state = 'bloqueada:perfil-ausente';
  IF _n <> 12 THEN RAISE EXCEPTION 'perfil ausente estudantes: %', _n; END IF;
  BEGIN PERFORM * FROM public.class_curricular_resolution_context_at(_k[1], _on, NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'resolution:known-at-required' THEN RAISE; END IF; END;
  _ok := _ok || 'perfil-ausente ';

  -- perfil homologado sem eixo de natureza
  INSERT INTO public.curricular_correspondence_profiles(id) VALUES (_p1), (_p2);
  INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, change_kind, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_p1, 1, 'constituicao', DATE '2026-01-01', 'ato-p', _u, _e) RETURNING id INTO _pv1;
  INSERT INTO public.curricular_correspondence_profile_position_keys VALUES (_pv1, 'esq-b424-pos');
  INSERT INTO public.curricular_correspondence_profile_homologations(profile_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_pv1, 1, 'homologada', DATE '2026-01-01', 'ato-hp', 'cap-ficticia', _u, _e);
  PERFORM pg_sleep(0.01); _tA := clock_timestamp(); PERFORM pg_sleep(0.01);
  SELECT context_state INTO _s FROM public.class_curricular_resolution_context_at(_k[1], _on, _tA);
  IF _s IS DISTINCT FROM 'bloqueada:natureza-nao-designada' THEN RAISE EXCEPTION 'eixo ausente: %', _s; END IF;
  _ok := _ok || 'eixo-ausente ';

  -- retificação do perfil com eixo e portões; homologada
  INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, supersedes_id, change_kind, valid_from, originating_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
  VALUES (_p1, 2, _pv1, 'retificacao', DATE '2026-01-01', 'ato-p2', 'correcao ficticia', _u, _e) RETURNING id INTO _pv2;
  INSERT INTO public.curricular_correspondence_profile_position_keys VALUES (_pv2, 'esq-b424-pos');
  INSERT INTO public.curricular_correspondence_profile_nature_axis VALUES (_pv2, 'esq-b424-nat');
  INSERT INTO public.curricular_correspondence_profile_nature_gates VALUES
    (_pv2, 'esq-b424-nat', 'reg', 1, 'matching-regular'), (_pv2, 'esq-b424-nat', 'fora', 1, 'fora-de-correspondencia'),
    (_pv2, 'esq-b424-nat', 'esp', 1, 'associacao-explicita'), (_pv2, 'esq-b424-nat', 'rasc', 1, 'matching-regular');
  INSERT INTO public.curricular_correspondence_profile_homologations(profile_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_pv2, 1, 'homologada', DATE '2026-01-01', 'ato-hp2', 'cap-ficticia', _u, _e);

  -- ofertas: K1 reg, K2 fora, K3/K4/K5/K9 esp, K6 reg, K7 sem oferta, K8 sem portão, K10 valor não homologado
  FOR r IN SELECT * FROM (VALUES (1,'reg'),(2,'fora'),(3,'esp'),(4,'esp'),(5,'esp'),(6,'reg'),(8,'semp'),(9,'esp'),(10,'rasc')) v(c, val) LOOP
    INSERT INTO public.class_offering_versions(class_id, logical_id, version, valid_from, recorded_by)
    VALUES (_k[r.c], 'of-' || gen_random_uuid()::text, 1, DATE '2026-01-01', _u) RETURNING id INTO _ov;
    INSERT INTO public.class_offering_axis_values VALUES (_ov, 'esq-b424-nat', r.val, 1);
  END LOOP;
  SELECT context_state INTO _s FROM public.class_curricular_resolution_context_at(_k[1], _on, _tA);
  IF _s IS DISTINCT FROM 'bloqueada:natureza-nao-designada' THEN RAISE EXCEPTION 'knownAt perfil reescrito: %', _s; END IF;
  SELECT context_state INTO _s FROM public.class_curricular_resolution_context_at(_k[7], _on, clock_timestamp());
  IF _s IS DISTINCT FROM 'ausente:natureza-nao-registrada' THEN RAISE EXCEPTION 'oferta ausente: %', _s; END IF;
  SELECT context_state INTO _s FROM public.class_curricular_resolution_context_at(_k[8], _on, clock_timestamp());
  IF _s IS DISTINCT FROM 'bloqueada:natureza-sem-portao' THEN RAISE EXCEPTION 'sem portao: %', _s; END IF;
  SELECT context_state INTO _s FROM public.class_curricular_resolution_context_at(_k[10], _on, clock_timestamp());
  IF _s IS DISTINCT FROM 'bloqueada:natureza-nao-homologada' THEN RAISE EXCEPTION 'valor nao homologado: %', _s; END IF;
  SELECT resolution_state INTO _s FROM public.class_specific_curricular_matrix_at(_k[2], _on, clock_timestamp());
  IF _s IS DISTINCT FROM 'nao-aplicavel:natureza' THEN RAISE EXCEPTION 'fora: %', _s; END IF;
  _ok := _ok || 'knownat-perfil oferta-ausente sem-portao natureza-nao-homologada fora ';

  -- matrizes: A, B, C, AP, E homologadas; N não homologada; Z sem versão
  INSERT INTO public.institutional_curricular_matrices(id) VALUES (_ma), (_mb), (_mc), (_mn), (_mz), (_map), (_me);
  FOR r IN SELECT * FROM (VALUES (_ma), (_mb), (_mc), (_mn), (_map), (_me)) v(m) LOOP
    INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
    VALUES (r.m, 1, 'constituicao', 'Matriz ficticia', DATE '2026-01-01', 'ato-m', _u, _e) RETURNING id INTO _cv;
    INSERT INTO public.curricular_matrix_layouts(matrix_version_id, source_locator) VALUES (_cv, 'fonte-ficticia');
    IF r.m <> _mn THEN
      INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
      VALUES (_cv, 1, 'homologada', DATE '2026-01-01', 'ato-hm', 'cap-ficticia', _u, _e);
    END IF;
    IF r.m = _ma THEN _mva := _cv; ELSIF r.m = _mb THEN _mvb := _cv; ELSIF r.m = _mc THEN _mvc := _cv;
    ELSIF r.m = _mn THEN _mvn := _cv; ELSIF r.m = _map THEN _mvap := _cv; ELSE _mve := _cv; END IF;
  END LOOP;
  INSERT INTO public.curricular_matrix_layout_columns(matrix_version_id, column_key, position, header_text, ref_scheme_id, ref_value_id, ref_value_version) VALUES
    (_mva, 'col-a', 0, 'A', 'esq-b424-pos', 'p10', 1),
    (_mvb, 'col-b', 0, 'B', 'esq-b424-pos', 'p11', 1),
    (_mvb, 'col-b10', 1, 'B10', 'esq-b424-pos', 'p10', 1),
    (_mvc, 'col-noref', 0, 'NR', NULL, NULL, NULL),
    (_mvc, 'col-div', 1, 'DV', 'esq-b424-extra', 'x', 1),
    (_mvn, 'col-n', 0, 'N', 'esq-b424-pos', 'p06', 1),
    (_mvap, 'col-ap', 0, 'AP', 'esq-b424-pos', 'p12', 1);
  INSERT INTO public.curricular_matrix_applicability(matrix_version_id, dimension, school_id) VALUES (_mvap, 'escola', _sch);

  -- correspondências E3 homologadas (p03 sem correspondência; p04 ambígua)
  FOR r IN SELECT * FROM (VALUES ('p04', _ma, 'col-a'), ('p04', _mb, 'col-b'), ('p05', _mz, 'col-z'), ('p06', _mn, 'col-n'),
      ('p07', _ma, 'col-inexistente'), ('p08', _mc, 'col-noref'), ('p09', _mc, 'col-div'), ('p10', _ma, 'col-a'),
      ('p11', _mb, 'col-b'), ('p12', _map, 'col-ap')) v(val, mat, col) LOOP
    _cid := 'cpm-' || gen_random_uuid()::text;
    INSERT INTO public.curricular_position_matrix_correspondences(id, profile_id) VALUES (_cid, _p1);
    INSERT INTO public.curricular_position_matrix_correspondence_versions(correspondence_id, version, change_kind, valid_from, target_matrix_id, target_column_key, originating_act_ref, recorded_by, recorded_via_engagement_id)
    VALUES (_cid, 1, 'constituicao', DATE '2026-01-01', r.mat, r.col, 'ato-c', _u, _e) RETURNING id INTO _cv;
    INSERT INTO public.curricular_position_matrix_correspondence_keys VALUES (_cv, 'esq-b424-pos', r.val, 1);
    INSERT INTO public.curricular_position_matrix_correspondence_homologations(correspondence_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
    VALUES (_cv, 1, 'homologada', DATE '2026-01-01', 'ato-hc', 'cap-ficticia', _u, _e);
    IF r.val = 'p10' THEN _cid10 := _cid; _cv10 := _cv; END IF;
  END LOOP;

  -- E4: rascunho em K1 (não contamina), homologadas em K3 (sem coluna), K5 (coluna faltante), K6 (turma regular), K9 (aplicabilidade)
  FOR r IN SELECT * FROM (VALUES (1, _me, NULL::text, false), (3, _me, NULL, true), (5, _me, 'col-faltante', true),
      (6, _me, NULL, true), (9, _map, NULL, true)) v(c, mat, col, hom) LOOP
    _aid := 'csa-' || gen_random_uuid()::text;
    INSERT INTO public.class_specific_matrix_associations(id, class_id) VALUES (_aid, _k[r.c]);
    INSERT INTO public.class_specific_matrix_association_versions(association_id, version, change_kind, valid_from, target_matrix_id, target_column_key, specific_act_ref, recorded_by, recorded_via_engagement_id)
    VALUES (_aid, 1, 'constituicao', DATE '2026-01-01', r.mat, r.col, 'ato-especifico-ficticio', _u, _e) RETURNING id INTO _av;
    IF r.hom THEN
      INSERT INTO public.class_specific_matrix_association_homologations(association_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
      VALUES (_av, 1, 'homologada', DATE '2026-01-01', 'ato-ha', 'cap-ficticia', _u, _e);
    END IF;
  END LOOP;
  PERFORM pg_sleep(0.01); _tR := clock_timestamp(); PERFORM pg_sleep(0.01);

  -- ramo regular por estudante: cada estudante no seu estado esperado
  FOR i IN 1..15 LOOP
    SELECT resolution_state INTO _s FROM public.student_curricular_matrix_at(_sch, _k[cls_of[i]], _on, _tR) WHERE student_id = 'est-b424-' || i;
    IF _s IS DISTINCT FROM want[i] THEN RAISE EXCEPTION 'estudante %: % (esperado %)', i, _s, want[i]; END IF;
  END LOOP;
  SELECT count(DISTINCT matrix_id) INTO _n FROM public.student_curricular_matrix_at(_sch, _k[1], _on, _tR) WHERE resolution_state = 'resolvida-por-posicao';
  IF _n <> 2 THEN RAISE EXCEPTION 'duas matrizes na mesma turma: %', _n; END IF;
  SELECT r2.matrix_id INTO _s FROM public.student_curricular_matrix_at(_sch, _k[1], _on, _tR) r2 WHERE r2.student_id = 'est-b424-10';
  IF _s IS DISTINCT FROM _ma THEN RAISE EXCEPTION 'p10 deveria ir para A'; END IF;
  IF EXISTS (SELECT 1 FROM public.student_curricular_matrix_at(_sch, _k[1], _on, _tR) x WHERE x.resolution_state = 'resolvida-por-posicao'
             AND (x.profile_homologation_id IS NULL OR x.correspondence_homologation_id IS NULL OR x.matrix_homologation_id IS NULL
                  OR x.position_version_id IS NULL OR x.offering_version_id IS NULL OR x.column_key IS NULL)) THEN RAISE EXCEPTION 'proveniencia'; END IF;
  SELECT association_state INTO _s FROM public.student_curricular_matrix_at(_sch, _k[3], _on, _tR) WHERE student_id = 'est-b424-14';
  IF _s IS DISTINCT FROM 'vinculo-especifico-vigente' THEN RAISE EXCEPTION 'referencia ao vinculo da turma: %', _s; END IF;
  _ok := _ok || 'regular-estados duas-matrizes proveniencia e4-rascunho-nao-contamina e4-em-regular ';

  -- ramo específico por turma
  SELECT resolution_state INTO _s FROM public.class_specific_curricular_matrix_at(_k[3], _on, _tR);
  IF _s IS DISTINCT FROM 'vinculo-especifico-vigente' THEN RAISE EXCEPTION 'e4 valida: %', _s; END IF;
  SELECT resolution_state INTO _s FROM public.class_specific_curricular_matrix_at(_k[4], _on, _tR);
  IF _s IS DISTINCT FROM 'nao-registrada:associacao-especifica' THEN RAISE EXCEPTION 'e4 ausente: %', _s; END IF;
  SELECT resolution_state INTO _s FROM public.class_specific_curricular_matrix_at(_k[5], _on, _tR);
  IF _s IS DISTINCT FROM 'bloqueada:elemento-da-fonte-inexistente' THEN RAISE EXCEPTION 'e4 coluna: %', _s; END IF;
  SELECT resolution_state INTO _s FROM public.class_specific_curricular_matrix_at(_k[9], _on, _tR);
  IF _s IS DISTINCT FROM 'bloqueada:aplicabilidade-nao-homologada' THEN RAISE EXCEPTION 'e4 aplicabilidade: %', _s; END IF;
  SELECT resolution_state INTO _s FROM public.class_specific_curricular_matrix_at(_k[1], _on, _tR);
  IF _s IS DISTINCT FROM 'nao-aplicavel:ramo-regular' THEN RAISE EXCEPTION 'turma regular no ramo especifico: %', _s; END IF;
  SELECT resolution_state INTO _s FROM public.class_specific_curricular_matrix_at(_k[6], _on, _tR);
  IF _s IS DISTINCT FROM 'inconsistente:associacao-explicita-em-turma-regular' THEN RAISE EXCEPTION 'k6: %', _s; END IF;
  _ok := _ok || 'especifico-vigente especifico-ausente especifico-coluna aplicabilidade ';

  -- knownAt: retificação de p10 para B não reescreve consulta anterior
  INSERT INTO public.curricular_position_matrix_correspondence_versions(correspondence_id, version, supersedes_id, change_kind, valid_from, target_matrix_id, target_column_key, originating_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
  VALUES (_cid10, 2, _cv10, 'retificacao', DATE '2026-01-01', _mb, 'col-b10', 'ato-cr', 'correcao ficticia', _u, _e) RETURNING id INTO _cv;
  INSERT INTO public.curricular_position_matrix_correspondence_keys VALUES (_cv, 'esq-b424-pos', 'p10', 1);
  SELECT resolution_state INTO _s FROM public.student_curricular_matrix_at(_sch, _k[1], _on, clock_timestamp()) WHERE student_id = 'est-b424-10';
  IF _s IS DISTINCT FROM 'ausente:correspondencia' THEN RAISE EXCEPTION 'retificacao herdou homologacao: %', _s; END IF;
  INSERT INTO public.curricular_position_matrix_correspondence_homologations(correspondence_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_cv, 1, 'homologada', DATE '2026-01-01', 'ato-hcr', 'cap-ficticia', _u, _e);
  SELECT x.matrix_id INTO _s FROM public.student_curricular_matrix_at(_sch, _k[1], _on, clock_timestamp()) x WHERE x.student_id = 'est-b424-10' AND x.resolution_state = 'resolvida-por-posicao';
  IF _s IS DISTINCT FROM _mb THEN RAISE EXCEPTION 'retificada nao resolve'; END IF;
  SELECT x.matrix_id INTO _s FROM public.student_curricular_matrix_at(_sch, _k[1], _on, _tR) x WHERE x.student_id = 'est-b424-10';
  IF _s IS DISTINCT FROM _ma THEN RAISE EXCEPTION 'passado reescrito'; END IF;
  _ok := _ok || 'knownat ';

  -- privacidade: authenticated com roster lê as mesmas linhas; sem capability não lê alocações
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  SELECT count(*) INTO _n FROM public.student_curricular_matrix_at(_sch, _k[1], _on, _tR);
  IF _n <> 12 THEN RAISE EXCEPTION 'authenticated roster: %', _n; END IF;
  PERFORM set_config('request.jwt.claims', u_none, true);
  SELECT count(*) INTO _n FROM public.student_curricular_matrix_at(_sch, _k[1], _on, _tR);
  IF _n <> 0 THEN RAISE EXCEPTION 'roster aberto sem capability: %', _n; END IF;
  RESET ROLE;
  _ok := _ok || 'roster ';

  -- ===== B4.2.5 — projeção da turma (class_curricular_matrices_at) =====
  IF has_function_privilege('anon','public.class_curricular_matrices_at(text,text,date,timestamptz)','EXECUTE')
    OR has_function_privilege('public','public.class_curricular_matrices_at(text,text,date,timestamptz)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.class_curricular_matrices_at(text,text,date,timestamptz)','EXECUTE')
  THEN RAISE EXCEPTION 'b425 acl'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'class_curricular_matrices_at'
             AND (prosecdef OR NOT proconfig @> ARRAY['search_path=""'] OR provolatile <> 's')) THEN RAISE EXCEPTION 'b425 definer'; END IF;
  _tN := clock_timestamp(); PERFORM pg_sleep(0.01);
  PERFORM set_config('role', 'authenticated', true);
  -- sem permissão: uma única linha access-denied, sem contagem nem estado
  PERFORM set_config('request.jwt.claims', u_none, true);
  SELECT count(*), count(*) FILTER (WHERE x.result_kind = 'access-denied' AND x.total_allocations IS NULL AND x.allocation_count IS NULL
         AND x.state IS NULL AND x.context_state IS NULL) INTO _n, i
  FROM public.class_curricular_matrices_at(_sch, _k[1], _on, _tR) x;
  IF _n <> 1 OR i <> 1 THEN RAISE EXCEPTION 'b425 vazamento sem permissao: % %', _n, i; END IF;
  PERFORM set_config('request.jwt.claims', u_sec, true);
  -- K1 em _tR: A=1, B=1 (duas matrizes, sem dominante); 10 estados não resolvidos de 1 cada; cobertura 2/12
  SELECT x.total_allocations, x.resolved_allocations, x.context_state INTO _n, i, _s FROM public.class_curricular_matrices_at(_sch, _k[1], _on, _tR) x WHERE x.result_kind = 'context';
  IF _n IS DISTINCT FROM 12 OR i IS DISTINCT FROM 2 OR _s IS DISTINCT FROM 'portao-resolvido' THEN RAISE EXCEPTION 'b425 contexto: % % %', _n, i, _s; END IF;
  SELECT count(*) INTO _n FROM public.class_curricular_matrices_at(_sch, _k[1], _on, _tR) x
  WHERE x.result_kind = 'matrix' AND x.allocation_count = 1 AND x.matrix_homologation_id IS NOT NULL
    AND ((x.matrix_id = _ma AND x.column_keys = ARRAY['col-a']) OR (x.matrix_id = _mb AND x.column_keys = ARRAY['col-b']));
  IF _n <> 2 OR (SELECT count(*) FROM public.class_curricular_matrices_at(_sch, _k[1], _on, _tR) x WHERE x.result_kind = 'matrix') <> 2
  THEN RAISE EXCEPTION 'b425 duas matrizes: % [%]', _n, (SELECT string_agg(x.result_kind || '|' || coalesce(x.matrix_id,'-') || '|' || coalesce(x.allocation_count::text,'-') || '|' || coalesce(array_to_string(x.column_keys,','),'-') || '|' || coalesce(x.matrix_homologation_id::text,'-'), ' ; ') FROM public.class_curricular_matrices_at(_sch, _k[1], _on, _tR) x); END IF;
  SELECT count(*), sum(x.allocation_count) INTO _n, i FROM public.class_curricular_matrices_at(_sch, _k[1], _on, _tR) x WHERE x.result_kind = 'unresolved-state';
  IF _n IS DISTINCT FROM 10 OR i IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'b425 estados: % %', _n, i; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_curricular_matrices_at(_sch, _k[1], _on, _tR) x WHERE x.result_kind = 'unresolved-state'
                 AND x.state = 'inconsistente:correspondencia-ambigua' AND x.allocation_count = 1) THEN RAISE EXCEPTION 'b425 estado ambiguo'; END IF;
  -- após retificação (knownAt _tN): p10 → B ⇒ B conta 2, colunas col-b e col-b10; _tR permanece intacto (acima)
  SELECT x.allocation_count, array_to_string(x.column_keys, ',') INTO _n, _s FROM public.class_curricular_matrices_at(_sch, _k[1], _on, _tN) x WHERE x.result_kind = 'matrix' AND x.matrix_id = _mb;
  IF _n IS DISTINCT FROM 2 OR _s IS DISTINCT FROM 'col-b,col-b10' THEN RAISE EXCEPTION 'b425 mesma matriz: % %', _n, _s; END IF;
  IF EXISTS (SELECT 1 FROM public.class_curricular_matrices_at(_sch, _k[1], _on, _tN) x WHERE x.result_kind = 'matrix' AND x.matrix_id = _ma) THEN RAISE EXCEPTION 'b425 A residual'; END IF;
  IF EXISTS (SELECT 1 FROM public.class_curricular_matrices_at(_sch, _k[1], _on, _tN) x WHERE x.known_at <> _tN OR x.valid_on <> _on) THEN RAISE EXCEPTION 'b425 tempo'; END IF;
  -- fora-de-correspondencia preservado
  SELECT string_agg(x.result_kind || ':' || coalesce(x.state, x.gate_effect), ',' ORDER BY x.result_kind) INTO _s FROM public.class_curricular_matrices_at(_sch, _k[2], _on, _tR) x;
  IF _s IS DISTINCT FROM 'context:fora-de-correspondencia,unresolved-state:nao-aplicavel:natureza' THEN RAISE EXCEPTION 'b425 fora: %', _s; END IF;
  -- bloqueio de contexto sem estudantes ainda explicável
  SELECT string_agg(x.result_kind || ':' || x.context_state || ':' || x.total_allocations, ',') INTO _s FROM public.class_curricular_matrices_at(_sch, _k[8], _on, _tR) x;
  IF _s IS DISTINCT FROM 'context:bloqueada:natureza-sem-portao:0' THEN RAISE EXCEPTION 'b425 bloqueio: %', _s; END IF;
  -- ramo específico: vínculo da turma, sem contagem por estudante
  SELECT string_agg(x.result_kind || ':' || coalesce(x.state, '-') || ':' || coalesce(x.allocation_count::text, 'null'), ',' ORDER BY x.result_kind) INTO _s
  FROM public.class_curricular_matrices_at(_sch, _k[3], _on, _tR) x;
  IF _s IS DISTINCT FROM 'context:-:null,specific-link:vinculo-especifico-vigente:null' THEN RAISE EXCEPTION 'b425 especifico: %', _s; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_curricular_matrices_at(_sch, _k[3], _on, _tR) x WHERE x.result_kind = 'specific-link' AND x.matrix_id = _me AND x.association_homologation_id IS NOT NULL) THEN RAISE EXCEPTION 'b425 especifico proveniencia'; END IF;
  SELECT x.state INTO _s FROM public.class_curricular_matrices_at(_sch, _k[4], _on, _tR) x WHERE x.result_kind = 'specific-link';
  IF _s IS DISTINCT FROM 'nao-registrada:associacao-especifica' THEN RAISE EXCEPTION 'b425 especifico ausente: %', _s; END IF;
  RESET ROLE;
  _ok := _ok || 'b425-acl b425-sem-permissao b425-duas-matrizes b425-mesma-matriz b425-estados b425-cobertura b425-fora b425-bloqueio b425-especifico b425-knownat ';

  -- perfil ambíguo: estado explícito, nunca ausência
  INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, change_kind, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_p2, 1, 'constituicao', DATE '2026-01-01', 'ato-q', _u, _e) RETURNING id INTO _pq;
  INSERT INTO public.curricular_correspondence_profile_homologations(profile_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_pq, 1, 'homologada', DATE '2026-01-01', 'ato-hq', 'cap-ficticia', _u, _e);
  SELECT context_state INTO _s FROM public.class_curricular_resolution_context_at(_k[1], _on, clock_timestamp());
  IF _s IS DISTINCT FROM 'inconsistente:perfil-ambiguo' THEN RAISE EXCEPTION 'perfil ambiguo: %', _s; END IF;
  SELECT count(*) INTO _n FROM public.student_curricular_matrix_at(_sch, _k[1], _on, clock_timestamp()) WHERE resolution_state = 'inconsistente:perfil-ambiguo';
  IF _n <> 12 THEN RAISE EXCEPTION 'perfil ambiguo estudantes: %', _n; END IF;
  _ok := _ok || 'perfil-ambiguo';

  RAISE EXCEPTION 'b425-tests-ok: %', _ok;
END $t$;
