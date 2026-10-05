-- B4.8 (0063/0064) — atribuição docente. Bloco termina em RAISE: nada persiste. Sucesso = 'b48-tests-ok: ...'.
DO $t$
DECLARE _ok text := ''; _e text; _n integer;
  u text := '{"sub":"00000000-0000-0000-0000-0000000b4801","role":"authenticated"}';
  _cls text;
BEGIN
  IF has_table_privilege('anon','public.teaching_assignment_versions','SELECT')
    OR has_table_privilege('authenticated','public.teaching_assignment_versions','INSERT')
    OR has_table_privilege('authenticated','public.teaching_assignments','UPDATE')
    OR has_table_privilege('service_role','public.teaching_assignment_versions','TRUNCATE')
    OR has_function_privilege('anon','public.teaching_assignments_at(text,date,timestamptz)','EXECUTE')
    OR has_function_privilege('authenticated','public.teaching_assignment_grant(text)','EXECUTE')
  THEN RAISE EXCEPTION 'acl'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.teaching_assignment_versions'::regclass) THEN RAISE EXCEPTION 'rls'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('teaching_assignments_at','my_teaching_assignments_at','teaching_assignment_effective_versions')
     AND (prosecdef OR NOT proconfig @> ARRAY['search_path=""'])) THEN RAISE EXCEPTION 'reader-definer'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('record_teaching_assignment_version','teaching_assignment_grant')
     AND (NOT prosecdef OR NOT proconfig @> ARRAY['search_path=""'])) THEN RAISE EXCEPTION 'writer-search-path'; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE capability_id = 'manter-atribuicao-docente') THEN RAISE EXCEPTION 'rule-created'; END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.teaching_assignment_versions'::regclass AND tgname = 'teaching_assignment_versions_immutable') IS NOT TRUE
  THEN RAISE EXCEPTION 'append-only'; END IF;
  _ok := _ok || 'acl rls invoker-readers append-only no-rule ';
  SELECT id INTO _cls FROM public.institutional_classes LIMIT 1;
  PERFORM set_config('request.jwt.claims', u, true); SET LOCAL ROLE authenticated;
  SELECT count(*) INTO _n FROM public.teaching_assignments_at(coalesce(_cls,'x'), '2027-03-01', now());
  IF _n <> 0 THEN RAISE EXCEPTION 'reader-leak'; END IF;
  SELECT count(*) INTO _n FROM public.my_teaching_assignments_at('2027-03-01', now());
  IF _n <> 0 THEN RAISE EXCEPTION 'own-leak'; END IF;
  BEGIN PERFORM public.record_teaching_assignment_version(coalesce(_cls,'x'), NULL, NULL, 'constituicao', '2027-02-01', NULL,
      gen_random_uuid(), gen_random_uuid(), 'x', NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'writer-open'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e NOT IN ('capability:manter-atribuicao-docente','assignment:class-not-found') THEN RAISE EXCEPTION 'gate: %', _e; END IF; END;
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.record_teaching_assignment_version('x', NULL, NULL, 'constituicao', '2027-02-01', NULL,
      gen_random_uuid(), gen_random_uuid(), 'x', NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'no-session-open'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'session-required' THEN RAISE EXCEPTION 'session: %', _e; END IF; END;
  RESET ROLE;
  _ok := _ok || 'empty-readers gate-fail-closed session-required ';
  RAISE EXCEPTION 'b48-tests-ok: %', _ok;
END $t$;
