-- Prova transacional/negativa para rodar somente em banco de HOMOLOGAÇÃO com migration 0613 aplicada.
-- Não instala políticas nem inventa contas. Não executar na base institucional sem autorização.
-- Execução sugerida: psql -v ON_ERROR_STOP=1 -f supabase/tests/0613_school_institutional_followup.sql
BEGIN;

DO $verify$
DECLARE
  s text;
  ghost uuid := pg_catalog.gen_random_uuid();
  vis_before bigint;
  vis_after bigint;
  denied boolean;
  r record;
BEGIN
  -- O catálogo novo não implica acesso ao usuário recém-autenticado.
  IF NOT EXISTS (SELECT 1 FROM public.sigem_capability_catalog
    WHERE capability_id = 'consultar-acompanhamento-institucional')
    OR NOT EXISTS (SELECT 1 FROM public.sigem_capability_catalog
    WHERE capability_id = 'registrar-acompanhamento-institucional')
    THEN RAISE EXCEPTION 'followup-test:catalog-missing'; END IF;

  -- O navegador não recebe SELECT/INSERT/UPDATE/DELETE diretos, nem via service_role.
  IF has_table_privilege('authenticated', 'public.school_institutional_followup_visits', 'SELECT')
    OR has_table_privilege('authenticated', 'public.school_institutional_followup_visits', 'INSERT')
    OR has_table_privilege('authenticated', 'public.school_institutional_followup_actions', 'SELECT')
    OR has_table_privilege('authenticated', 'public.school_institutional_followup_updates', 'SELECT')
    OR has_table_privilege('anon', 'public.school_institutional_followup_visits', 'SELECT')
    THEN RAISE EXCEPTION 'followup-test:table-grants-leak'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'school_institutional_followup_visits'
      AND c.relrowsecurity)
    THEN RAISE EXCEPTION 'followup-test:rls-missing'; END IF;
  IF has_function_privilege('anon',
      'public.school_institutional_followup_school(text)', 'EXECUTE')
    OR has_function_privilege('anon',
      'public.record_school_institutional_followup_bundle(text,date,text,text,text,text,uuid,jsonb,text,text)', 'EXECUTE')
    OR has_function_privilege('anon',
      'public.record_school_institutional_followup_visit(text,date,text,text,text,text,uuid,text,uuid,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated',
      'public.school_institutional_followup_grant(text,text)', 'EXECUTE')
    THEN RAISE EXCEPTION 'followup-test:function-grants-leak'; END IF;

  SELECT id INTO s FROM public.institutional_schools ORDER BY id LIMIT 1;
  IF s IS NULL THEN
    RAISE NOTICE 'followup-test:without-schools — negative scenario only';
    s := '__nonexistent_school__';
  END IF;
  SELECT count(*) INTO vis_before FROM public.school_institutional_followup_visits;
  PERFORM pg_catalog.set_config('request.jwt.claims',
    pg_catalog.json_build_object('sub', ghost, 'role', 'authenticated')::text, true);

  IF public.school_institutional_followup_grant('consultar-acompanhamento-institucional', s)
    OR public.school_institutional_followup_grant('registrar-acompanhamento-institucional', s)
    THEN RAISE EXCEPTION 'followup-test:ghost-has-permission'; END IF;

  denied := false;
  BEGIN
    PERFORM public.school_institutional_followup_school(s);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:read-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-test:reader-failed-open'; END IF;

  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_bundle(
      s, CURRENT_DATE, 'Diagnóstico de prova', '', '', '', pg_catalog.gen_random_uuid(),
      '[{"description":"Ação de prova","request":"11111111-1111-4111-8111-111111111111"}]'::jsonb);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:recording-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-test:writer-failed-open'; END IF;

  FOR r IN SELECT * FROM public.school_institutional_followup_network(
    CURRENT_DATE - 30, CURRENT_DATE)
  LOOP RAISE EXCEPTION 'followup-test:ghost-read-network'; END LOOP;

  SELECT count(*) INTO vis_after FROM public.school_institutional_followup_visits;
  IF vis_before <> vis_after THEN RAISE EXCEPTION 'followup-test:residue'; END IF;
  RAISE NOTICE 'FOLLOWUP_0613_NEGATIVE_ACCESS_OK';
END $verify$;

ROLLBACK;
