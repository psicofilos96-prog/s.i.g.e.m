-- N5.3.1 — prova do assistente "Nova turma" com contas setoriais REAIS (Secretaria A/B, Direção A, OP A, CIECE)
-- numa ÚNICA transação que termina em RAISE: nada persiste. Fixture revertida: ano 2026 "operacional",
-- catálogo sintético homologado de posições ('fixture-n531-posicao') e de turno ('turno').
DO $$
DECLARE
  yr text := 'ano-431ece00-be5c-41ed-a430-75ba853b0831'; dt date := '2026-09-15';
  sa text; sb text; ua uuid; ub uuid; udir uuid; uop uuid; uciece uuid; pa uuid;
  r jsonb; c1 text; c2 text; c3 text; cl0 int; n int; st text; ok text := ''; head uuid; d uuid := gen_random_uuid(); seq int; res jsonb;
  P1 jsonb := '{"scheme":"fixture-n531-posicao","value":"ano-1","version":1}';
  P2 jsonb := '{"scheme":"fixture-n531-posicao","value":"ano-2","version":1}';
  P3 jsonb := '{"scheme":"fixture-n531-posicao","value":"ano-3","version":1}';
  PX jsonb := '{"scheme":"fixture-n531-outro","value":"x","version":1}';
BEGIN
  SELECT school_id, auth_user_id, id INTO sa, ua, pa FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id LIMIT 1;
  SELECT school_id, auth_user_id INTO sb, ub FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id OFFSET 1 LIMIT 1;
  SELECT auth_user_id INTO udir FROM public.institutional_sector_principals WHERE station_code = 'direcao_escolar' AND school_id = sa;
  SELECT auth_user_id INTO uop FROM public.institutional_sector_principals WHERE station_code = 'orientacao_pedagogica' AND school_id = sa;
  SELECT auth_user_id INTO uciece FROM public.institutional_sector_principals WHERE station_code = 'ciece';
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status, valid_from, change_reason) VALUES
    ('fixture-n531-posicao','ano-1',1,'1º ano (fixture)','homologada','2026-01-01','FIXTURE REVERTIDA N5.3.1'),
    ('fixture-n531-posicao','ano-2',1,'2º ano (fixture)','homologada','2026-01-01','FIXTURE REVERTIDA N5.3.1'),
    ('fixture-n531-posicao','ano-3',1,'3º ano (fixture)','homologada','2026-01-01','FIXTURE REVERTIDA N5.3.1'),
    ('fixture-n531-outro','x',1,'outro catálogo','homologada','2026-01-01','FIXTURE REVERTIDA N5.3.1'),
    ('turno','fixture-manha',1,'Manhã (fixture)','homologada','2026-01-01','FIXTURE REVERTIDA N5.3.1');
  SELECT count(*) INTO cl0 FROM public.institutional_classes;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  -- ano histórico recusa turma nova
  BEGIN PERFORM public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N531 X', '2026-09-01', NULL, jsonb_build_array(P1), NULL, NULL, NULL); RAISE EXCEPTION 'Y: ano histórico aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%class:year-not-open%' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    VALUES (yr, 2, 'operacional', 'FIXTURE REVERTIDA N5.3.1', 'technical:n5-3-1-rollback');
  PERFORM set_config('role', 'authenticated', true);
  -- A/E/G) simples + turno + capacidade, autor = principal setorial (sem pessoa)
  r := public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N531 SIMPLES', '2026-09-01', NULL, jsonb_build_array(P1), jsonb_build_object('value','fixture-manha','version',1), 2, NULL);
  c1 := r->>'class_id';
  IF r->>'actor_kind' <> 'institutional' THEN RAISE EXCEPTION 'A: ator %', r; END IF;
  SELECT kind INTO st FROM public.class_composition_at(c1, dt, clock_timestamp());
  IF st IS DISTINCT FROM 'simples' THEN RAISE EXCEPTION 'A: composição %', st; END IF;
  -- B) multisseriada 2 anos, capacidade ausente
  r := public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N531 MULTI2', '2026-09-01', NULL, jsonb_build_array(P1, P2), NULL, NULL, NULL); c2 := r->>'class_id';
  SELECT kind, jsonb_array_length(positions) INTO st, n FROM public.class_composition_at(c2, dt, clock_timestamp());
  IF st IS DISTINCT FROM 'multisseriada' OR n IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'B: % %', st, n; END IF;
  -- C) multisseriada 3 anos
  r := public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N531 MULTI3', '2026-09-01', NULL, jsonb_build_array(P1, P2, P3), NULL, NULL, NULL); c3 := r->>'class_id';
  SELECT jsonb_array_length(positions) INTO n FROM public.class_composition_at(c3, dt, clock_timestamp());
  IF n IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'C: %', n; END IF;
  ok := 'Y,A,B,C ';
  -- D) combinações inválidas recusadas, sem turma parcial
  PERFORM set_config('role', 'postgres', true); SELECT count(*) INTO cl0 FROM public.institutional_classes; PERFORM set_config('role', 'authenticated', true);
  BEGIN PERFORM public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N531 MIX', '2026-09-01', NULL, jsonb_build_array(P1, PX), NULL, NULL, NULL); RAISE EXCEPTION 'D: catálogos misturados aceitos';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%composition:mixed-catalogs%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N531 DUP', '2026-09-01', NULL, jsonb_build_array(P1, P1), NULL, NULL, NULL); RAISE EXCEPTION 'D: posição duplicada aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%composition:duplicate-position%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N531 NH', '2026-09-01', NULL, '[{"scheme":"fixture-n531-posicao","value":"ano-9","version":1}]'::jsonb, NULL, NULL, NULL); RAISE EXCEPTION 'D: não homologada aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%composition:position-not-homologated%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N531 CAP0', '2026-09-01', NULL, jsonb_build_array(P1), NULL, 0, NULL); RAISE EXCEPTION 'E: capacidade 0 aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capacity:positive-required%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.secretariat_create_class(sa, yr, NULL, 'fixture n531 simples', '2026-09-01', NULL, jsonb_build_array(P1), NULL, NULL, NULL); RAISE EXCEPTION 'D: nome duplicado aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%class:duplicate-name%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N531 TURNO', '2026-09-01', NULL, jsonb_build_array(P1), '{"value":"inexistente","version":1}'::jsonb, NULL, NULL); RAISE EXCEPTION 'D: turno inválido aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'D:%' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT count(*) FROM public.institutional_classes) <> cl0 THEN RAISE EXCEPTION 'D: turma parcial'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_class_record_versions v WHERE v.class_id = c1 AND v.recorded_by_principal_id = pa AND v.recorded_by_person_id IS NULL AND v.technical_operation_id IS NULL) THEN RAISE EXCEPTION 'A: autoria setorial'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  ok := ok || 'D ';
  -- O) nova versão da composição preserva a anterior (knownAt reproduz)
  SELECT version_id INTO head FROM public.class_composition_at(c2, dt, clock_timestamp());
  BEGIN PERFORM public.record_class_composition(c2, NULL, jsonb_build_array(P1, P2, P3), '2026-09-01', NULL, 'x'); RAISE EXCEPTION 'O: stale aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%composition:stale-head%' THEN RAISE; END IF; END;
  PERFORM public.record_class_composition(c2, head, jsonb_build_array(P1, P2, P3), '2026-09-01', NULL, 'Inclusão do 3º ano');
  SELECT jsonb_array_length(positions) INTO n FROM public.class_composition_at(c2, dt, clock_timestamp());
  IF n IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'O: nova versão %', n; END IF;
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT count(*) FROM public.class_composition_versions WHERE class_id = c2) <> 2 THEN RAISE EXCEPTION 'O: anterior perdida'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  ok := ok || 'O ';
  -- L/E) Vagas: capacidade 2 = ha-vaga; ausente = capacidade-nao-informada (nunca zero)
  SELECT v.vacancy_state INTO st FROM public.secretariat_class_vacancies_at(sa, yr, dt) v WHERE v.class_id = c1;
  IF st IS DISTINCT FROM 'ha-vaga' THEN RAISE EXCEPTION 'L: %', st; END IF;
  SELECT count(*) INTO n FROM public.secretariat_class_vacancies_at(sa, yr, dt) v WHERE v.class_id = c3 AND v.vacancy_state = 'capacidade-nao-informada' AND v.capacity IS NULL;
  IF n IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'F: ausência não honesta'; END IF;
  -- M) enturmação pelo assistente de matrícula na turma criada
  seq := public.enrollment_draft_save(d, sa, 0, 8, '{"aluno":{"nome":"FIXTURE N531 ALUNO"}}'::jsonb, '11144477735', NULL, NULL);
  res := public.enrollment_draft_complete(d, seq, yr, dt, c2);
  IF res->>'episode_id' IS NULL THEN RAISE EXCEPTION 'M: %', res; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.secretariat_enrollment_book_at(sa, yr, NULL) b WHERE b.enrollment_id = res->>'enrollment_id') THEN RAISE EXCEPTION 'M: Livro'; END IF;
  ok := ok || 'L,E,F,M ';
  -- J) Secretaria B: não cria em A nem altera composição de A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N531 B', '2026-09-01', NULL, jsonb_build_array(P1), NULL, NULL, NULL); RAISE EXCEPTION 'J: B criou em A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'J:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_composition(c1, NULL, jsonb_build_array(P2), '2026-09-01', NULL, 'x'); RAISE EXCEPTION 'J: B alterou A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'J:%' THEN RAISE; END IF; END;
  IF EXISTS (SELECT 1 FROM public.class_composition_versions WHERE class_id = c1) THEN RAISE EXCEPTION 'J: B leu composição de A'; END IF;
  ok := ok || 'J ';
  -- K) Direção/OP/CIECE: sem writer de turma
  DECLARE u uuid; lbl text; i int := 0;
  BEGIN
    FOREACH u IN ARRAY ARRAY[udir, uop, uciece] LOOP
      i := i + 1; lbl := (ARRAY['direcao','op','ciece'])[i];
      CONTINUE WHEN u IS NULL;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      BEGIN PERFORM public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N531 ' || lbl, '2026-09-01', NULL, jsonb_build_array(P1), NULL, NULL, NULL); RAISE EXCEPTION 'K: % criou', lbl;
      EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'K:%' THEN RAISE; END IF; END;
      BEGIN PERFORM public.record_class_composition(c1, NULL, jsonb_build_array(P2), '2026-09-01', NULL, 'x'); RAISE EXCEPTION 'K: % alterou', lbl;
      EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'K:%' THEN RAISE; END IF; END;
      ok := ok || lbl || '-sem-writer ';
    END LOOP;
  END;
  RAISE EXCEPTION 'N531-PROOF-PASS %', ok;
END $$;
