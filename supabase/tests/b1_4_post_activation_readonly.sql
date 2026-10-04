-- B1.4: read-only assertions for the real, already activated Cloud.
-- No fixture, auth.uid() simulation, write, or second activation.
DO $test$
DECLARE a record; p record; e record; person record; email text;
BEGIN
  IF (SELECT state FROM public.sigem_installation_state WHERE singleton) <> 'instalado' THEN
    RAISE EXCEPTION 'b1.4:installation-not-active'; END IF;
  IF (SELECT count(*) FROM public.sigem_installation_acts) <> 1 THEN
    RAISE EXCEPTION 'b1.4:installation-act-count'; END IF;
  SELECT * INTO a FROM public.sigem_installation_acts;
  SELECT * INTO p FROM public.capability_policies WHERE id = a.policy_id;
  SELECT * INTO e FROM public.institutional_engagements WHERE id = a.engagement_id;
  SELECT * INTO person FROM public.institutional_persons WHERE id = a.person_id;
  SELECT lower(u.email) INTO email FROM auth.users u WHERE u.id = a.executor_user_id AND u.email_confirmed_at IS NOT NULL;
  IF email IS DISTINCT FROM public.sigem_designated_installer_email()
     OR a.provenance <> 'ativacao-inicial-sem-ato-externo' OR a.act_ref IS NOT NULL
     -- The act stores the reviewed draft hash. The lifecycle status is part of
     -- sigem_policy_fingerprint, so the homologated hash is intentionally different.
     OR a.policy_fingerprint IS DISTINCT FROM '73f7be02d792b16dadc72152c12825a05fcc39203cb673749a8545a10c49f35b'
     OR public.sigem_policy_fingerprint(p.id) IS DISTINCT FROM '4627aa42bbc43bd380072bf9178b9561d4356dd598b62e3e3e219e02c5ae3e56'
     OR p.version <> 3 OR p.status <> 'homologated'
     OR p.homologation_origin <> 'ativacao-inicial' OR p.homologation_act_ref IS NOT NULL
     OR (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = p.id) <> 199
     OR person.display_name <> 'Administrador Geral do SIGEM' OR person.actor_nature <> 'orgao-institucional'
     OR e.person_id <> person.id OR e.engagement_kind_id <> public.sigem_general_admin_kind()
     OR e.scope_level <> 'rede' OR e.school_id IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id)
     OR EXISTS (SELECT 1 FROM public.sigem_general_admin_coverage_issues(p.id))
  THEN RAISE EXCEPTION 'b1.4:activation-chain-divergent'; END IF;
  IF (SELECT count(*) FROM public.sigem_activator_account_origins) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.sigem_activator_account_origins o WHERE o.user_id = a.executor_user_id)
     OR (SELECT count(*) FROM public.capability_policies WHERE version = 1 AND status = 'draft') <> 1
     OR (SELECT count(*) FROM public.capability_policies WHERE version = 2 AND status = 'draft') <> 1
     OR (SELECT count(*) FROM public.capability_policy_rules r JOIN public.capability_policies q ON q.id = r.policy_id WHERE q.version = 1) <> 108
     OR (SELECT count(*) FROM public.capability_policy_rules r JOIN public.capability_policies q ON q.id = r.policy_id WHERE q.version = 2) <> 121
  THEN RAISE EXCEPTION 'b1.4:history-divergent'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'sigem_activator_account_origins_one_shot')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'activator_account_origin_guard' AND NOT tgisinternal)
     OR has_function_privilege('anon', 'public.activate_sigem_reviewed(uuid,text,boolean)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.sigem_activator_account_origins', 'SELECT')
     OR has_table_privilege('authenticated', 'public.capability_policy_rules', 'INSERT')
     OR has_schema_privilege('anon', 'public', 'CREATE')
     OR has_schema_privilege('authenticated', 'public', 'CREATE')
  THEN RAISE EXCEPTION 'b1.4:guard-or-acl-divergent'; END IF;
END $test$;
