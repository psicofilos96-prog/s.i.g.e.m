-- B4.3/B4.4 (0062) — writers de jornada/grade preparados e FECHADOS. Bloco termina em RAISE: nada persiste.
-- Sucesso = 'b434w-tests-ok: ...'.
DO $t$
DECLARE _ok text := ''; _e text;
  u text := '{"sub":"00000000-0000-0000-0000-0000000b4341","role":"authenticated"}';
  _cls text;
BEGIN
  IF has_function_privilege('anon','public.record_class_journey_version(text,uuid,text,date,date,text,text,jsonb)','EXECUTE')
    OR has_function_privilege('anon','public.record_class_schedule_version(text,uuid,text,date,date,text,text,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.b4_class_time_grant(text,text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.record_class_journey_version(text,uuid,text,date,date,text,text,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'acl'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('record_class_journey_version','record_class_schedule_version','b4_class_time_grant')
     AND (NOT prosecdef OR NOT proconfig @> ARRAY['search_path=""'])) THEN RAISE EXCEPTION 'definer/search_path'; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE capability_id = ANY (public.b4_class_time_capabilities()))
  THEN RAISE EXCEPTION 'policy-rule-created'; END IF;
  _ok := _ok || 'acl definer no-rule ';
  SELECT id INTO _cls FROM public.institutional_classes LIMIT 1;
  PERFORM set_config('request.jwt.claims', u, true); SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_class_journey_version(coalesce(_cls,'x'), NULL,'constituicao','2027-02-01',NULL,NULL,NULL,'[{"weekday":1,"starts_at":"07:00","ends_at":"11:00"}]');
    RAISE EXCEPTION 'journey-open'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e NOT IN ('capability:manter-jornada-da-turma','class-time:class-not-found') THEN RAISE EXCEPTION 'journey gate: %', _e; END IF; END;
  BEGIN PERFORM public.record_class_schedule_version(coalesce(_cls,'x'), NULL,'constituicao','2027-02-01',NULL,NULL,NULL,'[]');
    RAISE EXCEPTION 'schedule-open'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e NOT IN ('capability:manter-grade-da-turma','class-time:class-not-found') THEN RAISE EXCEPTION 'schedule gate: %', _e; END IF; END;
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.record_class_journey_version('x', NULL,'constituicao','2027-02-01',NULL,NULL,NULL,'[]');
    RAISE EXCEPTION 'no-session-open'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'session-required' THEN RAISE EXCEPTION 'session gate: %', _e; END IF; END;
  RESET ROLE;
  _ok := _ok || 'gate-fail-closed session-required ';
  RAISE EXCEPTION 'b434w-tests-ok: %', _ok;
END $t$;
