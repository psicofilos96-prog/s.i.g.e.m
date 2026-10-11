-- NEI.6: indicadores, detalhe, agregado de rede com supressão, isolamento A/B, AEE e anônimo. Termina em exceção (nada persiste).
DO $$
DECLARE st text; sc text; other text; u_tec uuid := gen_random_uuid(); u_aee uuid := gen_random_uuid(); u_b uuid := gen_random_uuid(); u_net uuid := gen_random_uuid();
  pid uuid; cid uuid; c int; r record;
BEGIN
  SELECT e.student_id, e.school_id INTO st, sc FROM public.class_enrollment_episodes e WHERE public.nei_enrolled_in(e.student_id, e.school_id) LIMIT 1;
  SELECT id INTO other FROM public.institutional_schools WHERE id <> sc LIMIT 1;
  INSERT INTO public.nei_role_grants(user_id, role, scope_kind, school_id, valid_from, reason, granted_by) VALUES
    (u_tec,'tecnico','escola',sc,CURRENT_DATE,'teste',gen_random_uuid()), (u_aee,'aee','escola',sc,CURRENT_DATE,'teste',gen_random_uuid()),
    (u_b,'tecnico','escola',other,CURRENT_DATE,'teste',gen_random_uuid()), (u_net,'coordenador','rede',NULL,CURRENT_DATE,'teste',gen_random_uuid());
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_tec, 'role','authenticated')::text, true);
  pid := public.create_nei_plan(st, sc, 'pei', 'Plano teste', jsonb_build_object('metas', jsonb_build_array(jsonb_build_object('texto','Meta 1','prazo',(CURRENT_DATE - 2)::text))));
  cid := public.open_nei_case(st, sc, 'Solicitação de apoio pedagógico em sala', 'escola', 'alta', NULL);
  SELECT * INTO r FROM public.nei_indicators(sc);
  IF r.followed < 1 OR r.with_pei < 1 OR r.plans_overdue < 1 OR r.cases_open < 1 THEN RAISE EXCEPTION 'FAIL counts %', row_to_json(r); END IF;
  SELECT count(*) INTO c FROM public.nei_indicator_drill(sc, 'plans_overdue'); IF c < 1 THEN RAISE EXCEPTION 'FAIL drill'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_b, 'role','authenticated')::text, true);
  SELECT count(*) INTO c FROM public.nei_indicators(sc); IF c <> 0 THEN RAISE EXCEPTION 'FAIL B sees A'; END IF;
  SELECT count(*) INTO c FROM public.nei_indicator_drill(sc, 'plans_overdue'); IF c <> 0 THEN RAISE EXCEPTION 'FAIL B drill'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.nei_access_events WHERE user_id = u_b AND outcome = 'recusado') THEN RAISE EXCEPTION 'FAIL log'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_aee, 'role','authenticated')::text, true);
  SELECT count(*) INTO c FROM public.nei_indicators(NULL); IF c <> 0 THEN RAISE EXCEPTION 'FAIL aee'; END IF;
  SELECT count(*) INTO c FROM public.nei_network_aggregate(); IF c <> 0 THEN RAISE EXCEPTION 'FAIL aee aggregate'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_net, 'role','authenticated')::text, true);
  SELECT * INTO r FROM public.nei_network_aggregate() WHERE indicator = 'estudantes-com-pei';
  IF r.value IS NOT NULL OR NOT r.suppressed THEN RAISE EXCEPTION 'FAIL suppression %', row_to_json(r); END IF;
  SELECT count(*) INTO c FROM public.nei_indicators(NULL); IF c < 2 THEN RAISE EXCEPTION 'FAIL network rows %', c; END IF;
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.nei_indicators(NULL); RAISE EXCEPTION 'FAIL anon'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%session-required%' THEN RAISE; END IF; END;
  RAISE EXCEPTION 'NEI6_PASS';
END $$;
