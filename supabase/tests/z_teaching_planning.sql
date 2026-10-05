-- Frente Z: recusas do writer de planejamento; termina em RAISE (nada persiste).
DO $$
DECLARE e text; n0 int := (SELECT count(*) FROM public.teaching_plan_versions);
BEGIN
  -- sem sessão
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,'x','t',NULL,'2027-03-01',NULL,NULL,NULL,'[]','[]','rascunho',NULL,NULL);
    RAISE EXCEPTION 'expected no-session'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS e = MESSAGE_TEXT;
    IF e NOT LIKE 'plan:no-session%' THEN RAISE EXCEPTION 'z-fail no-session: %', e; END IF; END;
  -- sessão sem pessoa natural (automação não é autora)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,'x','t',NULL,'2027-03-01',NULL,NULL,NULL,'[]','[]','rascunho',NULL,NULL);
    RAISE EXCEPTION 'expected natural'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS e = MESSAGE_TEXT;
    IF e NOT LIKE 'plan:natural-person-required%' THEN RAISE EXCEPTION 'z-fail natural: %', e; END IF; END;
  -- ACL
  IF has_table_privilege('service_role','public.teaching_plan_versions','INSERT') OR has_table_privilege('authenticated','public.teaching_plan_versions','INSERT')
     OR has_function_privilege('service_role','public.record_teaching_plan_version_v2(text,uuid,text,text,text,date,text,date,date,jsonb,jsonb,text,uuid,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.record_teaching_plan_version(text,uuid,text,text,text,date,date,jsonb,jsonb,text,uuid,text)','EXECUTE')
    THEN RAISE EXCEPTION 'z-fail acl'; END IF;
  IF (SELECT count(*) FROM public.teaching_plan_versions) <> n0 THEN RAISE EXCEPTION 'z-fail residue'; END IF;
  RAISE EXCEPTION 'z-plan-tests-ok: no-session natural-person acl no-residue';
END $$;
