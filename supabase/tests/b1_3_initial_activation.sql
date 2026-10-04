-- B1.3: ativação institucional inicial sem ato externo. Contas de Auth fictícias SÓ nesta transação
-- (a conta real admin@ não é criada aqui); rollback integral pelo RAISE final.
DO $t$
DECLARE
  v1 uuid; v2 uuid; v3 uuid; fp text; act uuid; r record;
  ua uuid := '00000000-0000-0000-0000-0000000b1301';  -- fixture admin@ confirmado
  uo uuid := '00000000-0000-0000-0000-0000000b1302';  -- fixture outro e-mail
  sup uuid := '06cd106b-32f4-4434-b990-3ae3be2cf4a4';
  n_persons int; n_eng int;
BEGIN
  -- Designação real (fora do rollback, já aplicada pela 0053).
  IF public.sigem_designated_installer_email() <> 'admin@sigem.itap.gov.br' THEN RAISE EXCEPTION 'D1 designação'; END IF;
  SELECT * INTO r FROM public.sigem_installer_designation_versions ORDER BY version DESC LIMIT 1;
  IF r.basis <> 'decisao-de-bootstrap-do-proprietario' OR r.designation_act_ref IS NOT NULL OR r.supersedes_version <> 1
    THEN RAISE EXCEPTION 'D2 proveniência da designação'; END IF;
  IF (SELECT installer_email FROM public.sigem_installer_designation_versions WHERE version = 1) <> 'supervisao@sigem.itap.gov.br'
    THEN RAISE EXCEPTION 'D3 histórico perdido'; END IF;
  BEGIN UPDATE public.sigem_installer_designation_versions SET installer_email = 'x@y' WHERE version = 2; RAISE EXCEPTION 'D4';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'D4' THEN RAISE; END IF; END;

  SELECT id INTO v1 FROM public.capability_policies WHERE version = 1 AND status = 'draft';
  SELECT id INTO v2 FROM public.capability_policies WHERE version = 2 AND status = 'draft';
  SELECT id INTO v3 FROM public.capability_policies WHERE version = 3 AND status = 'draft';
  IF v1 IS NULL OR v2 IS NULL OR v3 IS NULL THEN RAISE EXCEPTION 'P1 políticas não draft'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = v1) <> 108
    OR (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = v2) <> 121
    OR (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = v3) <> 199 THEN RAISE EXCEPTION 'P2 contagens'; END IF;
  fp := public.sigem_policy_fingerprint(v3);
  SELECT count(*) INTO n_persons FROM public.institutional_persons;
  SELECT count(*) INTO n_eng FROM public.institutional_engagements;

  INSERT INTO auth.users(id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  VALUES (ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@sigem.itap.gov.br', now(), now(), now()),
         (uo, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outro@sigem.itap.gov.br', now(), now(), now());

  -- Primeiro acesso: só a Supervisão confirmada e só uma vez, mesmo antes da ativação.
  BEGIN
    INSERT INTO public.sigem_activator_account_origins(user_id, login, requested_by_user_id, designation_version)
    VALUES (ua, 'admin@sigem.itap.gov.br', uo, 2); RAISE EXCEPTION 'B0';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'activator-account:requester-not-authorized' THEN RAISE EXCEPTION 'B0 %', SQLERRM; END IF; END;
  INSERT INTO public.sigem_activator_account_origins(user_id, login, requested_by_user_id, designation_version)
  VALUES (ua, 'admin@sigem.itap.gov.br', sup, 2);
  BEGIN
    INSERT INTO public.sigem_activator_account_origins(user_id, login, requested_by_user_id, designation_version)
    VALUES (uo, 'admin@sigem.itap.gov.br', sup, 2); RAISE EXCEPTION 'B1';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- Supervisão e outro e-mail: não designados.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sup, 'role','authenticated')::text, true);
  IF public.am_designated_installer() THEN RAISE EXCEPTION 'N0 Supervisão ainda designada'; END IF;
  BEGIN PERFORM public.activate_sigem_reviewed(v3, fp, true); RAISE EXCEPTION 'N1';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'install:not-designated' THEN RAISE EXCEPTION 'N1 %', SQLERRM; END IF; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uo, 'role','authenticated')::text, true);
  BEGIN PERFORM public.activate_sigem_reviewed(v3, fp, true); RAISE EXCEPTION 'N2';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'install:not-designated' THEN RAISE EXCEPTION 'N2 %', SQLERRM; END IF; END;

  -- Conta designada: proteções fail-closed.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role','authenticated')::text, true);
  IF NOT public.am_designated_installer() THEN RAISE EXCEPTION 'F0 admin não designado'; END IF;
  BEGIN PERFORM public.activate_sigem_reviewed(v3, fp, false); RAISE EXCEPTION 'F1';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'install:review-not-confirmed' THEN RAISE EXCEPTION 'F1 %', SQLERRM; END IF; END;
  BEGIN PERFORM public.activate_sigem_reviewed(v3, repeat('0', 64), true); RAISE EXCEPTION 'F2';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'install:review-stale' THEN RAISE EXCEPTION 'F2 %', SQLERRM; END IF; END;
  BEGIN PERFORM public.activate_sigem_reviewed(v3, 'abc', true); RAISE EXCEPTION 'F3';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'install:fingerprint-invalid' THEN RAISE EXCEPTION 'F3 %', SQLERRM; END IF; END;
  BEGIN PERFORM public.activate_sigem_reviewed(v2, public.sigem_policy_fingerprint(v2), true); RAISE EXCEPTION 'F4';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'install:engagement-kind-without-rules' THEN RAISE EXCEPTION 'F4 %', SQLERRM; END IF; END;
  BEGIN
    DELETE FROM public.capability_policy_rules WHERE policy_id = v3 AND engagement_kind_id = 'administrador-geral-do-sigem' AND capability_id = 'registrar-aula';
    PERFORM public.activate_sigem_reviewed(v3, public.sigem_policy_fingerprint(v3), true); RAISE EXCEPTION 'F5';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'install:general-admin-coverage-incomplete' THEN RAISE EXCEPTION 'F5 %', SQLERRM; END IF; END;
  BEGIN
    DELETE FROM public.capability_policy_rules WHERE policy_id = v3 AND engagement_kind_id = 'administrador-geral-do-sigem' AND capability_id = 'manter-contas-institucionais';
    PERFORM public.activate_sigem_reviewed(v3, public.sigem_policy_fingerprint(v3), true); RAISE EXCEPTION 'F6';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'install:initial-engagement-lacks-administration:%' THEN RAISE EXCEPTION 'F6 %', SQLERRM; END IF; END;
  -- E-mail não confirmado.
  BEGIN
    UPDATE auth.users SET email_confirmed_at = NULL WHERE id = ua;
    PERFORM public.activate_sigem_reviewed(v3, fp, true); RAISE EXCEPTION 'F7';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'install:email-not-confirmed' THEN RAISE EXCEPTION 'F7 %', SQLERRM; END IF; END;
  IF (SELECT state FROM public.sigem_installation_state) <> 'nao-instalado' THEN RAISE EXCEPTION 'F8 resíduo'; END IF;

  -- Revisão expõe o login designado e o tipo inicial.
  IF (public.installation_review()->>'designatedLogin') <> 'admin@sigem.itap.gov.br'
    OR (public.installation_review()->>'initialEngagementKind') <> 'administrador-geral-do-sigem' THEN RAISE EXCEPTION 'R1 revisão'; END IF;

  -- Ativação sem ato.
  act := public.activate_sigem_reviewed(v3, fp, true);
  SELECT * INTO r FROM public.sigem_installation_acts WHERE id = act;
  IF r.act_ref IS NOT NULL OR r.provenance <> 'ativacao-inicial-sem-ato-externo' OR r.policy_fingerprint <> fp OR r.executor_user_id <> ua
    THEN RAISE EXCEPTION 'A1 registro'; END IF;
  IF (SELECT row(status, homologation_act_ref, homologation_origin, homologated_by)::text FROM public.capability_policies WHERE id = v3)
     <> row('homologated'::text, NULL::text, 'ativacao-inicial'::text, ua)::text THEN RAISE EXCEPTION 'A2 homologação inicial'; END IF;
  IF (SELECT row(display_name, actor_nature)::text FROM public.institutional_persons WHERE id = r.person_id)
     <> row('Administrador Geral do SIGEM'::text, 'orgao-institucional'::text)::text THEN RAISE EXCEPTION 'A3 pessoa'; END IF;
  IF (SELECT origin FROM public.institutional_actor_nature_origins WHERE person_id = r.person_id) NOT LIKE '%ativação institucional inicial%'
    THEN RAISE EXCEPTION 'A4 origem natureza'; END IF;
  IF (SELECT row(engagement_kind_id, scope_level, originating_act_ref, position_label_snapshot)::text FROM public.institutional_engagements WHERE id = r.engagement_id)
     <> row('administrador-geral-do-sigem'::text, 'rede'::text, NULL::text, 'Administrador Geral do SIGEM'::text)::text THEN RAISE EXCEPTION 'A5 atuação'; END IF;
  IF (SELECT state FROM public.sigem_installation_state) <> 'instalado' THEN RAISE EXCEPTION 'A6 estado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.general_admin_session()) THEN RAISE EXCEPTION 'A7 mestre sem sessão'; END IF;
  IF NOT public.has_network_capability('homologar-politica-de-capacidades') THEN RAISE EXCEPTION 'A8 sem capacidade'; END IF;
  IF public.am_designated_installer() THEN RAISE EXCEPTION 'A9 fluxo continua aberto'; END IF;
  BEGIN
    INSERT INTO public.sigem_activator_account_origins(user_id, login, requested_by_user_id, designation_version)
    VALUES (uo, 'admin@sigem.itap.gov.br', sup, 2); RAISE EXCEPTION 'A10';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'activator-account:already-activated' THEN RAISE EXCEPTION 'A10 %', SQLERRM; END IF; END;

  -- Repetição falha.
  BEGIN PERFORM public.activate_sigem_reviewed(v3, fp, true); RAISE EXCEPTION 'X1';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'install:already-installed' THEN RAISE EXCEPTION 'X1 %', SQLERRM; END IF; END;
  -- Designação não muda após ativação.
  BEGIN
    INSERT INTO public.sigem_installer_designation_versions(version, installer_email, basis, basis_note, supersedes_version)
    VALUES (3, 'z@sigem.itap.gov.br', 'decisao-de-bootstrap-do-proprietario', 't', 2); RAISE EXCEPTION 'X2';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'designation:already-activated' THEN RAISE EXCEPTION 'X2 %', SQLERRM; END IF; END;
  -- Homologação posterior comum continua exigindo ato.
  BEGIN PERFORM public.homologate_capability_policy(v2, '', current_date); RAISE EXCEPTION 'H1';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT IN ('policy:act-required','policy:not-draft') THEN RAISE EXCEPTION 'H1 %', SQLERRM; END IF; END;
  BEGIN PERFORM public.homologate_capability_policy(v2, NULL, current_date); RAISE EXCEPTION 'H2';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'policy:act-required' THEN RAISE EXCEPTION 'H2 %', SQLERRM; END IF; END;
  -- Forma da origem é obrigatória.
  BEGIN
    INSERT INTO public.sigem_installation_acts(executor_user_id, person_id, engagement_id, policy_id, act_ref, provenance, singleton)
    VALUES (ua, r.person_id, r.engagement_id, v3, NULL, 'ato-externo', false); RAISE EXCEPTION 'S1';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- ACL
  IF has_function_privilege('anon', 'public.activate_sigem_reviewed(uuid,text,boolean)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.sigem_designated_installer_email()', 'EXECUTE')
    OR has_table_privilege('authenticated', 'public.sigem_installer_designation_versions', 'SELECT')
    THEN RAISE EXCEPTION 'C1 acl'; END IF;
  RAISE EXCEPTION 'b1-3-tests-ok';
END $t$;
