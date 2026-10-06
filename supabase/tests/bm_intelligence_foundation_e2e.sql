-- BM.1 — prova de recusa (sem sessão / sem capability / app role sem DML). Termina em RAISE: nada persiste.
DO $$
DECLARE ok int := 0; f text;
BEGIN
  -- 1. sem sessão
  BEGIN PERFORM public.record_assessment_program(NULL,'registro','P','externa','INEP','INEP','importado-de-fonte-externa',NULL,NULL); RAISE EXCEPTION 'falhou:sem-sessao';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'session-required' THEN RAISE EXCEPTION 'esperado session-required, veio %', SQLERRM; END IF; ok := ok + 1; END;
  -- 2. sessão sintética sem atuação: todo writer e reader recusa por capability
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text, 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_assessment_program(NULL,'registro','P','externa','INEP','INEP','importado-de-fonte-externa',NULL,NULL); RAISE EXCEPTION 'falhou';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE EXCEPTION '1: %', SQLERRM; END IF; ok := ok + 1; END;
  BEGIN PERFORM public.record_intelligence_dashboard(NULL,'registro','pessoal',NULL,'T','[]'::jsonb,'{}'::jsonb,NULL); RAISE EXCEPTION 'falhou';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE EXCEPTION '2: %', SQLERRM; END IF; ok := ok + 1; END;
  BEGIN PERFORM public.record_assessment_analysis_definition(NULL,'previsao','x','1','{}'::jsonb,'["a"]'::jsonb,NULL); RAISE EXCEPTION 'falhou';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE EXCEPTION '3: %', SQLERRM; END IF; ok := ok + 1; END;
  BEGIN PERFORM * FROM public.assessment_programs_at(now()); RAISE EXCEPTION 'falhou';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE EXCEPTION '4: %', SQLERRM; END IF; ok := ok + 1; END;
  -- painel visível: sem atuação, lista vazia (não erro, não vazamento)
  IF EXISTS (SELECT 1 FROM public.intelligence_dashboards_visible()) THEN RAISE EXCEPTION '5: painel vazou'; END IF; ok := ok + 1;
  -- 3. widgets com dados copiados são recusados pela validação
  IF public.ei_widgets_valid('[{"id":"w","queryRef":"q","visual":"kpi","rows":[1]}]') THEN RAISE EXCEPTION '6'; END IF;
  IF NOT public.ei_widgets_valid('[{"id":"w","queryRef":"q","visual":"kpi"}]') THEN RAISE EXCEPTION '7'; END IF; ok := ok + 1;
  -- 4. app roles sem DML nas tabelas novas
  FOREACH f IN ARRAY ARRAY['assessment_program_versions','assessment_edition_versions','assessment_metric_comparability','intelligence_dashboard_versions','assessment_analysis_definitions'] LOOP
    IF has_table_privilege('authenticated','public.'||f,'INSERT') OR has_table_privilege('anon','public.'||f,'SELECT') OR has_table_privilege('service_role','public.'||f,'INSERT') THEN RAISE EXCEPTION 'dml %', f; END IF;
  END LOOP; ok := ok + 1;
  RAISE EXCEPTION 'BM_E2E_OK %/8 (rollback)', ok;
END $$;
