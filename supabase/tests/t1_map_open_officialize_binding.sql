-- T.1 (0124) — prova no banco; termina em RAISE (nada persiste). Dados sintéticos.
DO $t$
DECLARE s text; n integer; ok boolean; m uuid; snap jsonb; issue text;
BEGIN
  SELECT id INTO s FROM public.institutional_schools ORDER BY id LIMIT 1;
  INSERT INTO public.map_competence_rules(id, version, status, homologation_act_ref, valid_from, valid_until, definition)
  VALUES ('t1-a', 1, 'homologada', 'sintetico-t1', '2099-01-01', '2099-12-31', jsonb_build_object('coveredSchoolIds', jsonb_build_array(s), 'snapshotDate', '{"kind":"dia-fixo-do-mes","day":15}'::jsonb, 'cells', '[]'::jsonb, 'blockingCellIds', '[]'::jsonb));
  -- 1 regra ⇒ exatamente ela
  SELECT count(*) INTO n FROM public.map_single_applicable_rule(s, '2099-03-01');
  IF n <> 1 THEN RAISE EXCEPTION 'falha: regra única'; END IF;
  -- 0 regras ⇒ no-homologated-rule
  ok := false; BEGIN PERFORM public.map_single_applicable_rule(s, '2098-03-01'); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'map:no-homologated-rule'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: sem regra'; END IF;
  -- 2 regras distintas sobrepostas ⇒ ambiguous, e open não chega ao INSERT
  INSERT INTO public.map_competence_rules(id, version, status, homologation_act_ref, valid_from, valid_until, definition)
  VALUES ('t1-b', 1, 'homologada', 'sintetico-t1', '2099-02-01', '2099-02-28', jsonb_build_object('coveredSchoolIds', jsonb_build_array(s), 'snapshotDate', '{"kind":"dia-fixo-do-mes","day":20}'::jsonb, 'cells', '[]'::jsonb, 'blockingCellIds', '[]'::jsonb));
  ok := false; BEGIN PERFORM public.map_single_applicable_rule(s, '2099-02-15'); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'map:ambiguous-rules'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: ambiguidade aceita'; END IF;
  IF pg_get_functiondef('public.open_statistical_map(text,integer,integer)'::regprocedure) NOT LIKE '%map_single_applicable_rule%' THEN RAISE EXCEPTION 'falha: open sem regra única'; END IF;
  -- Vinculação snapshot ⇔ Mapa/regra/base, em março (só t1-a cobre)
  INSERT INTO public.statistical_maps(school_id, competence_year, competence_month, rule_id, rule_version, opened_by)
  VALUES (s, 2099, 3, 't1-a', 1, gen_random_uuid()) RETURNING id INTO m;
  snap := jsonb_build_object('competence', jsonb_build_object('schoolId', s, 'year', 2099, 'month', 3), 'rule', jsonb_build_object('id','t1-a','version',1),
    'snapshotDate', '2099-03-15', 'yearState', 'operacional',
    'snapshotDateBasis', jsonb_build_object('criterion','dia-fixo-do-mes','date','2099-03-15','reason',null,'knownAt',null,'calendars','[]'::jsonb), 'cells', '[]'::jsonb);
  issue := public.map_snapshot_binding_issue(m, snap, '2099-03-15');
  IF issue IS NOT NULL THEN RAISE EXCEPTION 'falha: snapshot coerente recusado %', issue; END IF;
  IF public.map_snapshot_binding_issue(m, jsonb_set(snap, '{rule,version}', '2'), '2099-03-15') <> 'map:snapshot-rule-mismatch' THEN RAISE EXCEPTION 'falha: regra adulterada'; END IF;
  IF public.map_snapshot_binding_issue(m, jsonb_set(jsonb_set(snap, '{snapshotDate}', '"2099-03-31"'), '{snapshotDateBasis,date}', '"2099-03-31"'), '2099-03-31') <> 'map:snapshot-basis-mismatch' THEN RAISE EXCEPTION 'falha: data adulterada'; END IF;
  IF public.map_snapshot_binding_issue(m, jsonb_set(snap, '{competence,schoolId}', '"outra"'), '2099-03-15') <> 'map:snapshot-competence-mismatch' THEN RAISE EXCEPTION 'falha: IDOR escola'; END IF;
  IF public.map_snapshot_binding_issue(m, jsonb_set(snap, '{yearState}', '"historico-importado"'), '2099-03-15') <> 'map:snapshot-year-state-mismatch' THEN RAISE EXCEPTION 'falha: ano'; END IF;
  -- Nova regra homologada após a conferência ⇒ Mapa não oficializa sem nova conferência
  INSERT INTO public.map_competence_rules(id, version, status, homologation_act_ref, valid_from, valid_until, definition)
  VALUES ('t1-a', 2, 'homologada', 'sintetico-t1', '2099-01-01', NULL, (SELECT definition FROM public.map_competence_rules WHERE id='t1-a' AND version=1));
  IF public.map_snapshot_binding_issue(m, snap, '2099-03-15') <> 'map:rule-changed-since-conference' THEN RAISE EXCEPTION 'falha: regra mudou'; END IF;
  -- Digest: conteúdo adulterado ≠ conteúdo conferido; ordem de chaves é irrelevante
  IF public.map_snapshot_digest(snap) = public.map_snapshot_digest(jsonb_set(snap, '{cells}', '[{"id":"x","value":999}]')) THEN RAISE EXCEPTION 'falha: digest'; END IF;
  IF public.map_snapshot_digest('{"a":1,"b":2}') <> public.map_snapshot_digest('{"b":2,"a":1}') THEN RAISE EXCEPTION 'falha: digest canônico'; END IF;
  IF pg_get_functiondef('public.officialize_statistical_map(uuid,uuid,text,jsonb,date,uuid)'::regprocedure) NOT LIKE '%snapshot-not-conferred%' THEN RAISE EXCEPTION 'falha: officialize sem digest'; END IF;
  -- ACL
  IF has_function_privilege('anon','public.officialize_statistical_map(uuid,uuid,text,jsonb,date,uuid)','EXECUTE')
     OR has_function_privilege('service_role','public.officialize_statistical_map(uuid,uuid,text,jsonb,date,uuid)','EXECUTE')
     OR has_function_privilege('anon','public.open_statistical_map(text,integer,integer)','EXECUTE')
     OR has_function_privilege('service_role','public.open_statistical_map(text,integer,integer)','EXECUTE')
     OR has_function_privilege('service_role','public.record_map_conference(uuid,text,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.record_map_conference(uuid,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.map_snapshot_binding_issue(uuid,jsonb,date)','EXECUTE')
     OR has_function_privilege('authenticated','public.map_single_applicable_rule(text,date)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.officialize_statistical_map(uuid,uuid,text,jsonb,date,uuid)','EXECUTE')
     THEN RAISE EXCEPTION 'falha: acl'; END IF;
  -- authenticated sem pessoa/capability é recusado antes de qualquer escrita
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ok := false; BEGIN PERFORM public.officialize_statistical_map(m, gen_random_uuid(), 'x', snap, '2099-03-15', NULL); EXCEPTION WHEN raise_exception THEN ok := SQLERRM LIKE 'session:%' OR SQLERRM = 'map:capability-missing'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: authenticated sem capability'; END IF;
  ok := false; BEGIN PERFORM public.open_statistical_map(s, 2099, 3); EXCEPTION WHEN raise_exception THEN ok := SQLERRM LIKE 'session:%' OR SQLERRM = 'map:capability-missing'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: open sem capability'; END IF;
  RESET ROLE;
  RAISE EXCEPTION 't1-map-tests-ok';
END $t$;
