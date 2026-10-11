-- NEI.2: ficha e casos. Executa como contas sintéticas dentro de transação e termina em ROLLBACK.
DO $$
DECLARE st text; sc text; other text; u_tec uuid := gen_random_uuid(); u_aee uuid := gen_random_uuid(); u_none uuid := gen_random_uuid();
  cid uuid; f jsonb; ok boolean;
BEGIN
  SELECT e.student_id, e.school_id INTO st, sc FROM public.class_enrollment_episodes e WHERE public.nei_enrolled_in(e.student_id, e.school_id) LIMIT 1;
  SELECT id INTO other FROM public.institutional_schools WHERE id <> sc LIMIT 1;
  INSERT INTO public.nei_role_grants(user_id, role, scope_kind, school_id, valid_from, reason, granted_by) VALUES
    (u_tec,'tecnico','escola',sc,CURRENT_DATE,'teste sintético',gen_random_uuid()),
    (u_aee,'aee','escola',sc,CURRENT_DATE,'teste sintético',gen_random_uuid()),
    (u_none,'tecnico','escola',other,CURRENT_DATE,'teste sintético',gen_random_uuid());
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_tec, 'role','authenticated')::text, true);
  cid := public.open_nei_case(st, sc, 'Solicitação de apoio pedagógico em sala', 'escola', 'alta', NULL);
  PERFORM public.record_nei_profile_entry(st, sc, 'apoios', 'Apoio visual nas atividades');
  PERFORM public.record_nei_case_event(cid, 1, 'triagem', 'triado');
  BEGIN PERFORM public.record_nei_case_event(cid, 1, 'analise', 'velho'); RAISE EXCEPTION 'FAIL stale'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%stale%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_nei_case_event(cid, 2, 'execucao', 'pulo'); RAISE EXCEPTION 'FAIL jump'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%invalid-transition%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_nei_case_event(cid, 2, 'encerramento', 'curto'); RAISE EXCEPTION 'FAIL close'; EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
  PERFORM public.record_nei_case_event(cid, 2, 'encerramento', 'Demanda atendida pela escola, sem necessidade de AEE');
  BEGIN PERFORM public.record_nei_case_event(cid, 3, 'triagem', 'reabrir'); RAISE EXCEPTION 'FAIL terminal'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%invalid-transition%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_aee, 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_nei_profile_entry(st, sc, 'planos', 'x x x'); RAISE EXCEPTION 'FAIL aee section'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%not-authorized%' THEN RAISE; END IF; END;
  PERFORM public.record_nei_profile_entry(st, sc, 'aee', 'Sala de recursos às terças');
  BEGIN PERFORM public.open_nei_case(st, sc, 'AEE tentando abrir caso', NULL, NULL, NULL); RAISE EXCEPTION 'FAIL aee open'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%not-authorized%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_none, 'role','authenticated')::text, true);
  f := public.nei_student_file(st, sc); IF f IS NOT NULL THEN RAISE EXCEPTION 'FAIL B reads A'; END IF;
  IF EXISTS (SELECT 1 FROM public.nei_student_search(sc, 'aaa')) THEN RAISE EXCEPTION 'FAIL B search'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.nei_access_events WHERE user_id = u_none AND outcome = 'recusado' AND action = 'ficha') INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL refusal not logged'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_tec, 'role','authenticated')::text, true);
  f := public.nei_student_file(st, sc);
  IF jsonb_array_length(f->'entries') <> 2 OR jsonb_array_length(f->'cases'->0->'events') <> 3 THEN RAISE EXCEPTION 'FAIL file %', f; END IF;
  BEGIN UPDATE public.nei_case_events SET note = 'x' WHERE case_id = cid; RAISE EXCEPTION 'FAIL mutable'; EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
  RAISE EXCEPTION 'NEI2_PASS';  -- termina em exceção: nada persiste
END $$;
