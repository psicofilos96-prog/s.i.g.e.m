-- N5.3.2 — prova da atribuição docente e da jornada registradas pela Secretaria setorial (ator institucional),
-- com professor-alvo REAL exigido (pessoa natural + atuação + vínculo funcional + lotação), composição multisseriada
-- e posição individual. Uma única transação que termina em RAISE: nada persiste.
-- Fixture revertida: ano "operacional", catálogo de posições sintético, pessoas/atuações/vínculos/lotações sintéticos,
-- matriz sintética; a aplicabilidade da matriz (E1–E4, provada nos lotes B4/V) é substituída DENTRO da transação.
DO $$
DECLARE
  yr text := 'ano-431ece00-be5c-41ed-a430-75ba853b0831'; dt date := '2026-09-15';
  sa text; sb text; ua uuid; ub uuid; udir uuid; uop uuid; uciece uuid; pa uuid;
  r jsonb; c3 text; n int; ok text := ''; head uuid; vid uuid; a1 text; a2 text;
  pp1 uuid := gen_random_uuid(); pp2 uuid := gen_random_uuid(); porg uuid := gen_random_uuid(); pb uuid := gen_random_uuid();
  e1 uuid; e2 uuid; eorg uuid; eb uuid; l1 uuid := gen_random_uuid(); l2 uuid := gen_random_uuid(); lb uuid := gen_random_uuid();
  mv uuid; d uuid; seq int; res jsonb; alloc text; st text;
  P1 jsonb := '{"scheme":"fixture-n532-posicao","value":"ano-1","version":1}';
  P2 jsonb := '{"scheme":"fixture-n532-posicao","value":"ano-2","version":1}';
  P3 jsonb := '{"scheme":"fixture-n532-posicao","value":"ano-3","version":1}';
BEGIN
  SELECT school_id, auth_user_id, id INTO sa, ua, pa FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id LIMIT 1;
  SELECT school_id, auth_user_id INTO sb, ub FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id OFFSET 1 LIMIT 1;
  SELECT auth_user_id INTO udir FROM public.institutional_sector_principals WHERE station_code = 'direcao_escolar' AND school_id = sa;
  SELECT auth_user_id INTO uop FROM public.institutional_sector_principals WHERE station_code = 'orientacao_pedagogica' AND school_id = sa;
  SELECT auth_user_id INTO uciece FROM public.institutional_sector_principals WHERE station_code = 'ciece';
  -- ===== fixture (postgres) =====
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status, valid_from, change_reason) VALUES
    ('fixture-n532-posicao','ano-1',1,'1º ano (fixture)','homologada','2026-01-01','FIXTURE REVERTIDA N5.3.2'),
    ('fixture-n532-posicao','ano-2',1,'2º ano (fixture)','homologada','2026-01-01','FIXTURE REVERTIDA N5.3.2'),
    ('fixture-n532-posicao','ano-3',1,'3º ano (fixture)','homologada','2026-01-01','FIXTURE REVERTIDA N5.3.2');
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    VALUES (yr, 2, 'operacional', 'FIXTURE REVERTIDA N5.3.2', 'technical:n5-3-2-rollback');
  INSERT INTO public.institutional_persons(id, display_name, actor_nature) VALUES
    (pp1, 'FIXTURE N532 Professora Um', 'pessoa-natural'), (pp2, 'FIXTURE N532 Professor Dois', 'pessoa-natural'),
    (porg, 'FIXTURE N532 Órgão', 'orgao-institucional'), (pb, 'FIXTURE N532 Professora B', 'pessoa-natural');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, scope_level, valid_from, originating_act_ref)
    VALUES (pp1, 'fixture-n532-docente', sa, 'escola', '2026-01-01', 'FIXTURE') RETURNING id INTO e1;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, scope_level, valid_from, originating_act_ref)
    VALUES (pp2, 'fixture-n532-docente', sa, 'escola', '2026-01-01', 'FIXTURE') RETURNING id INTO e2;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, scope_level, valid_from, originating_act_ref)
    VALUES (porg, 'fixture-n532-docente', sa, 'escola', '2026-01-01', 'FIXTURE') RETURNING id INTO eorg;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, scope_level, valid_from, originating_act_ref)
    VALUES (pb, 'fixture-n532-docente', sb, 'escola', '2026-01-01', 'FIXTURE') RETURNING id INTO eb;
  INSERT INTO public.professional_functional_links(logical_id, version, person_id, functional_registration, link_nature_id, link_nature_version, valid_from, originating_act_ref) VALUES
    (l1, 1, pp1, 'FX-532-1', 'fixture-efetivo', 1, '2026-01-01', 'FIXTURE'), (l2, 1, pp2, 'FX-532-2', 'fixture-efetivo', 1, '2026-01-01', 'FIXTURE'),
    (lb, 1, pb, 'FX-532-B', 'fixture-efetivo', 1, '2026-01-01', 'FIXTURE');
  INSERT INTO public.professional_postings(logical_id, version, functional_link_logical_id, school_id, valid_from, originating_act_ref) VALUES
    (gen_random_uuid(), 1, l1, sa, '2026-01-01', 'FIXTURE'), (gen_random_uuid(), 1, l2, sa, '2026-01-01', 'FIXTURE'),
    (gen_random_uuid(), 1, lb, sb, '2026-01-01', 'FIXTURE');
  INSERT INTO public.institutional_curricular_components(id, label) VALUES ('fixture-n532-lp', 'Língua Portuguesa (fixture)');
  INSERT INTO public.institutional_curricular_matrices(id) VALUES ('mat-0532');
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, recorded_by, recorded_via_engagement_id)
    VALUES ('mat-0532', 1, 'constituicao', 'Matriz FIXTURE N532', '2026-01-01', ua, e1) RETURNING id INTO mv;
  INSERT INTO public.curricular_matrix_items(matrix_version_id, item_key, position, component_id, component_label_snapshot)
    VALUES (mv, 'lp', 1, 'fixture-n532-lp', 'Língua Portuguesa (fixture)');
  CREATE OR REPLACE FUNCTION public.offer_matrix_applicable_throughout(_school text, _class_id text, _mv uuid, _from date, _until date)
    RETURNS boolean LANGUAGE sql STABLE SET search_path TO '' AS $f$ SELECT _mv IS NOT NULL AND _from IS NOT NULL $f$;

  -- ===== Secretaria A (principal setorial, sem pessoa) =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  r := public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N532 MULTI3', '2026-09-01', NULL, jsonb_build_array(P1, P2, P3), NULL, NULL, NULL);
  c3 := r->>'class_id';
  -- candidatos: só pessoas naturais com atuação + vínculo + lotação na escola A
  SELECT count(*) INTO n FROM public.secretariat_teaching_candidates(sa, dt);
  IF n <> 2 THEN RAISE EXCEPTION 'CAND: % candidatos', n; END IF;
  SELECT count(*) INTO n FROM public.secretariat_assignment_elements(c3, dt);
  IF n <> 1 THEN RAISE EXCEPTION 'ELEM: %', n; END IF;
  -- G) 1 professor, autor = principal
  r := public.record_teaching_assignment_version_v2(c3, NULL, NULL, 'constituicao', '2026-09-01', NULL, e1, l1, mv, 'lp', NULL, NULL, NULL, NULL, NULL);
  a1 := r->>'assignment_id';
  IF r->>'actor_kind' <> 'institutional' THEN RAISE EXCEPTION 'G: ator %', r; END IF;
  -- H) 2º professor no mesmo elemento (co-responsabilidade = atuação distinta)
  r := public.record_teaching_assignment_version_v2(c3, NULL, NULL, 'constituicao', '2026-09-01', NULL, e2, l2, mv, 'lp', NULL, NULL, NULL, NULL, NULL);
  a2 := r->>'assignment_id';
  SELECT count(*) INTO n FROM public.teaching_assignments_at(c3, dt, clock_timestamp());
  IF n <> 2 THEN RAISE EXCEPTION 'H: % atribuições', n; END IF;
  ok := 'CAND,ELEM,G,H ';
  -- I) conflito de vigência: mesma atuação no mesmo elemento sobreposta
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c3, NULL, NULL, 'constituicao', '2026-10-01', NULL, e1, l1, mv, 'lp', NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'I: sobreposição aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%assignment:overlap%' THEN RAISE; END IF; END;
  -- encerramento sem apagar histórico: retificação com término; stale-head recusado
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c3, a1, NULL, 'retificacao', '2026-09-01', '2026-09-30', e1, l1, mv, 'lp', NULL, NULL, NULL, NULL, 'Encerramento'); RAISE EXCEPTION 'END: stale aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%assignment:stale-head%' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  SELECT id INTO head FROM public.teaching_assignment_versions WHERE assignment_id = a1 ORDER BY version DESC LIMIT 1;
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.record_teaching_assignment_version_v2(c3, a1, head, 'retificacao', '2026-09-01', '2026-09-30', e1, l1, mv, 'lp', NULL, NULL, NULL, NULL, 'Encerramento do vínculo');
  SELECT count(*) INTO n FROM public.teaching_assignments_at(c3, '2026-10-15', clock_timestamp());
  IF n <> 1 THEN RAISE EXCEPTION 'END: depois do término % atribuições', n; END IF;
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT count(*) FROM public.teaching_assignment_versions WHERE assignment_id = a1) <> 2 THEN RAISE EXCEPTION 'HIST: versão anterior perdida'; END IF;
  IF EXISTS (SELECT 1 FROM public.teaching_assignment_versions v JOIN public.teaching_assignments a ON a.id = v.assignment_id
             WHERE a.class_id = c3 AND (v.recorded_by_principal_id IS DISTINCT FROM pa OR v.recorded_by_person_id IS NOT NULL OR v.recorded_via_engagement_id IS NOT NULL))
  THEN RAISE EXCEPTION 'AUTOR: autoria não setorial'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  ok := ok || 'I,END,HIST,AUTOR ';
  -- Adulteração do alvo: órgão como professor, atuação de outra escola, vínculo de outra pessoa
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c3, NULL, NULL, 'constituicao', '2026-09-01', NULL, eorg, l1, mv, 'lp', NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'T: órgão aceito como professor';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%assignment:engagement-not-natural-person%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c3, NULL, NULL, 'constituicao', '2026-09-01', NULL, eb, lb, mv, 'lp', NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'T: atuação de B aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%engagement-outside-school%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c3, NULL, NULL, 'constituicao', '2026-11-01', NULL, e1, l2, mv, 'lp', NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'T: vínculo alheio aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%functional-link-not-of-person%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c3, NULL, NULL, 'constituicao', '2026-11-01', NULL, e1, l1, mv, 'inexistente', NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'T: elemento inexistente aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%element-not-in-matrix%' THEN RAISE; END IF; END;
  ok := ok || 'TAMPER ';
  -- JORNADA: Secretaria A registra jornada canônica; autor = principal
  r := public.record_class_journey_version(c3, NULL, 'constituicao', '2026-09-01', NULL, NULL, NULL,
        '[{"weekday":1,"starts_at":"07:00","ends_at":"11:30"},{"weekday":2,"starts_at":"07:00","ends_at":"11:30"}]'::jsonb);
  IF r->>'actor_kind' <> 'institutional' THEN RAISE EXCEPTION 'J: ator %', r; END IF;
  SELECT count(*) INTO n FROM public.class_journey_at(c3, dt, clock_timestamp());
  IF n < 1 THEN RAISE EXCEPTION 'J: jornada não lida'; END IF;
  ok := ok || 'JORNADA ';
  -- MAPA III / DIÁRIO: 3 estudantes em posições distintas na turma multisseriada
  FOR i IN 1..3 LOOP
    d := gen_random_uuid();
    seq := public.enrollment_draft_save(d, sa, 0, 8, jsonb_build_object('aluno', jsonb_build_object('nome', 'FIXTURE N532 ALUNO ' || i)), (ARRAY['11144477735','52998224725','39053344705'])[i], NULL, NULL);
    res := public.enrollment_draft_complete(d, seq, yr, dt, c3);
    SELECT logical_id INTO alloc FROM public.class_enrollment_episodes WHERE id = res->>'episode_id';
    PERFORM public.record_allocation_curricular_position('pos-' || gen_random_uuid(), NULL, alloc, dt, NULL,
      jsonb_build_array((ARRAY[P1, P2, P3])[i]), 'FIXTURE', NULL, false);
  END LOOP;
  SELECT count(DISTINCT student_id) INTO n FROM public.allocation_curricular_positions_at(sa, c3, dt, NULL);
  IF n <> 3 THEN RAISE EXCEPTION 'MAPA: total único %', n; END IF;
  SELECT string_agg(cnt::text, '/' ORDER BY v) INTO st FROM (
    SELECT ax->>'value' v, count(DISTINCT x.student_id) cnt FROM public.allocation_curricular_positions_at(sa, c3, dt, NULL) x, jsonb_array_elements(x.axes) ax
    WHERE ax->>'scheme' = 'fixture-n532-posicao' GROUP BY 1) q;
  IF st IS DISTINCT FROM '1/1/1' THEN RAISE EXCEPTION 'MAPA: subtotais %', st; END IF;
  SELECT count(*) INTO n FROM public.secretariat_class_vacancies_at(sa, yr, dt) v WHERE v.class_id = c3 AND v.occupancy = 3;
  IF n <> 1 THEN RAISE EXCEPTION 'VAGAS: ocupação'; END IF;
  ok := ok || 'MAPA-1/1/1,VAGAS ';
  -- Secretaria B: não atribui, não lê candidatos de A, não define jornada de A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c3, NULL, NULL, 'constituicao', '2026-11-01', NULL, e2, l2, mv, 'lp', NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'B: atribuiu em A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capability:manter-atribuicao-docente%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.secretariat_teaching_candidates(sa, dt); RAISE EXCEPTION 'B: leu candidatos de A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_journey_version(c3, NULL, 'sucessao', '2026-10-01', NULL, NULL, 'x', '[{"weekday":3,"starts_at":"07:00","ends_at":"11:00"}]'::jsonb); RAISE EXCEPTION 'B: jornada de A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capability:manter-jornada-da-turma%' THEN RAISE; END IF; END;
  ok := ok || 'B-isolada ';
  -- Direção/OP/CIECE: sem writer de atribuição nem jornada
  DECLARE u uuid; lbl text; k int := 0;
  BEGIN
    FOREACH u IN ARRAY ARRAY[udir, uop, uciece] LOOP
      k := k + 1; lbl := (ARRAY['direcao','op','ciece'])[k];
      CONTINUE WHEN u IS NULL;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      BEGIN PERFORM public.record_teaching_assignment_version_v2(c3, NULL, NULL, 'constituicao', '2026-11-01', NULL, e2, l2, mv, 'lp', NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'K: % atribuiu', lbl;
      EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'K:%' THEN RAISE; END IF; END;
      BEGIN PERFORM public.record_class_journey_version(c3, NULL, 'sucessao', '2026-10-01', NULL, NULL, 'x', '[{"weekday":3,"starts_at":"07:00","ends_at":"11:00"}]'::jsonb); RAISE EXCEPTION 'K: % jornada', lbl;
      EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'K:%' THEN RAISE; END IF; END;
      ok := ok || lbl || '-sem-writer ';
    END LOOP;
  END;
  -- sem DML direto de app role
  PERFORM set_config('role', 'postgres', true);
  IF has_table_privilege('authenticated', 'public.teaching_assignment_versions', 'INSERT') OR has_table_privilege('anon', 'public.teaching_assignment_versions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.class_journey_versions', 'INSERT') OR has_function_privilege('anon', 'public.record_teaching_assignment_version_v2(text, text, uuid, text, date, date, uuid, uuid, uuid, text, text, text, integer, text, text)', 'EXECUTE')
  THEN RAISE EXCEPTION 'DML: privilégio indevido'; END IF;
  ok := ok || 'sem-DML-direto';
  RAISE EXCEPTION 'N532-PROOF-PASS %', ok;
END $$;
