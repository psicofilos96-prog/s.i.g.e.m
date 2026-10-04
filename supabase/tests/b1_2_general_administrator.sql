-- B1.2: Administrador Geral do SIGEM. Atores e cadastros fictícios SOMENTE nesta transação;
-- rollback integral pelo RAISE final. Nenhuma instalação, conta ou política persiste.
DO $t$
DECLARE
  v1 uuid; v2 uuid; v3 uuid; fp text; r record;
  um uuid := '00000000-0000-0000-0000-0000000b1201';   -- conta fictícia do mestre
  us uuid := '00000000-0000-0000-0000-0000000b1202';   -- conta fictícia de setor
  pm uuid; ps uuid; em uuid; es uuid; yr text; per text;
  sch text := 'b12-escola'; cls text := 'b12-turma'; comp text := 'b12-comp';
  n int; sup uuid := '06cd106b-32f4-4434-b990-3ae3be2cf4a4';
  ins uuid := '00000000-0000-0000-0000-0000000b1203';  -- B1.3: fixture da conta designada admin@
BEGIN
  SELECT id INTO v1 FROM public.capability_policies WHERE version = 1 AND status = 'draft';
  SELECT id INTO v2 FROM public.capability_policies WHERE version = 2 AND status = 'draft';
  SELECT id INTO v3 FROM public.capability_policies WHERE version = 3 AND status = 'draft' AND supersedes_version_id = v2;
  IF v1 IS NULL OR v2 IS NULL OR v3 IS NULL THEN RAISE EXCEPTION 'T1 versões'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = v1) <> 108
    OR (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = v2) <> 121 THEN RAISE EXCEPTION 'T2 v1/v2 alteradas'; END IF;
  -- v3 = v2 inalterada + mestre
  IF EXISTS (SELECT engagement_kind_id, capability_id, scope_dimensions FROM public.capability_policy_rules WHERE policy_id = v2
             EXCEPT SELECT engagement_kind_id, capability_id, scope_dimensions FROM public.capability_policy_rules WHERE policy_id = v3)
    OR (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = v3 AND engagement_kind_id <> 'administrador-geral-do-sigem') <> 121
    THEN RAISE EXCEPTION 'T3 regras setoriais não preservadas'; END IF;
  IF (SELECT count(DISTINCT capability_id) FROM public.capability_policy_rules WHERE policy_id = v2) <> 78
    OR (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id = v3 AND engagement_kind_id = 'administrador-geral-do-sigem') <> 78
    THEN RAISE EXCEPTION 'T4 contagens'; END IF;
  IF EXISTS (SELECT 1 FROM public.sigem_general_admin_coverage_issues(v3)) THEN RAISE EXCEPTION 'T5 cobertura v3 incompleta'; END IF;
  IF EXISTS (SELECT 1 FROM public.sigem_general_admin_coverage_issues(v2)) THEN RAISE EXCEPTION 'T6 v2 sem mestre deveria passar'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(public.sigem_administrative_capabilities()) a WHERE NOT EXISTS (
     SELECT 1 FROM public.capability_policy_rules WHERE policy_id = v3 AND engagement_kind_id = 'administrador-geral-do-sigem' AND capability_id = a))
    THEN RAISE EXCEPTION 'T7 mestre sem as 5'; END IF;

  -- Instalação com v3 + mestre é aceita (só dentro de sub-bloco desfeito), pela conta designada.
  INSERT INTO auth.users(id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) VALUES ('00000000-0000-0000-0000-0000000b1203', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@sigem.itap.gov.br', now(), now(), now()); -- B1.3: fixture da conta designada
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ins, 'role','authenticated')::text, true);
  fp := public.sigem_policy_fingerprint(v3);
  BEGIN
    PERFORM public.install_sigem_reviewed('teste B1.2', 'orgao-institucional', 'x', NULL, 'administrador-geral-do-sigem', NULL, v3, fp, true);
    IF (SELECT state FROM public.sigem_installation_state) <> 'instalado' THEN RAISE EXCEPTION 'T8 não instalou'; END IF;
    RAISE EXCEPTION 'b12-install-ok';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'b12-install-ok' THEN RAISE EXCEPTION 'T8 %', SQLERRM; END IF; END;

  -- Remover uma regra do mestre (fixture) ⇒ completude falha e homologação/instalação recusam.
  BEGIN
    DELETE FROM public.capability_policy_rules WHERE policy_id = v3 AND engagement_kind_id = 'administrador-geral-do-sigem' AND capability_id = 'registrar-aula';
    IF NOT EXISTS (SELECT 1 FROM public.sigem_general_admin_coverage_issues(v3) WHERE issue = 'missing-sector-capability' AND capability_id = 'registrar-aula')
      THEN RAISE EXCEPTION 'T9 remoção não detectada'; END IF;
    BEGIN
      PERFORM public.install_sigem_reviewed('t', 'orgao-institucional', 'x', NULL, 'administrador-geral-do-sigem', NULL, v3, public.sigem_policy_fingerprint(v3), true);
      RAISE EXCEPTION 'T10 instalou incompleto';
    EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'install:general-admin-coverage-incomplete' THEN RAISE EXCEPTION 'T10 %', SQLERRM; END IF; END;
    RAISE EXCEPTION 'b12-remove-ok';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'b12-remove-ok' THEN RAISE; END IF; END;
  -- Capacidade fictícia só do mestre ⇒ falha.
  BEGIN
    INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
      VALUES (v3, 'administrador-geral-do-sigem', 'capacidade-inventada', ARRAY['network']);
    IF NOT EXISTS (SELECT 1 FROM public.sigem_general_admin_coverage_issues(v3) WHERE issue = 'master-only-capability') THEN RAISE EXCEPTION 'T11'; END IF;
    RAISE EXCEPTION 'b12-fake-ok';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'b12-fake-ok' THEN RAISE; END IF; END;
  -- Setor ganha capacidade nova sem o mestre ⇒ falha (sem concessão automática).
  BEGIN
    INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
      VALUES (v3, 'professor', 'capacidade-futura-de-setor', ARRAY['school','class']);
    IF NOT EXISTS (SELECT 1 FROM public.sigem_general_admin_coverage_issues(v3) WHERE issue = 'missing-sector-capability' AND capability_id = 'capacidade-futura-de-setor') THEN RAISE EXCEPTION 'T12'; END IF;
    RAISE EXCEPTION 'b12-future-ok';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'b12-future-ok' THEN RAISE; END IF; END;

  -- Fixtures desta transação: v3 homologada SÓ aqui, contas/pessoas/atuações/escola/turma/componente fictícios.
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = 'teste', valid_from = current_date WHERE id = v3;
  INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at) VALUES
    (um, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b12-mestre@test.invalid', now(), now()),
    (us, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b12-setor@test.invalid', now(), now());
  INSERT INTO public.institutional_persons(display_name) VALUES ('Mestre fictício') RETURNING id INTO pm;
  INSERT INTO public.institutional_persons(display_name) VALUES ('Secretaria fictícia') RETURNING id INTO ps;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (um, pm), (us, ps);
  INSERT INTO public.institutional_schools(id, originating_act_ref) VALUES (sch, 'teste');
  SELECT id INTO yr FROM public.institutional_academic_years LIMIT 1;
  SELECT id INTO per FROM public.institutional_academic_periods WHERE academic_year_id = yr LIMIT 1;
  INSERT INTO public.institutional_classes(id, school_id, school_label_snapshot, academic_year_id, academic_year_label, name, valid_from)
    VALUES (cls, sch, 'Escola fictícia', yr, 'teste', 'Turma fictícia', current_date - 1);
  INSERT INTO public.institutional_curricular_components(id, label) VALUES (comp, 'Componente fictício');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, valid_from, originating_act_ref)
    VALUES (pm, 'administrador-geral-do-sigem', 'rede', current_date - 1, 'teste') RETURNING id INTO em;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from, originating_act_ref)
    VALUES (ps, 'secretaria-escolar', 'escola', sch, current_date - 1, 'teste') RETURNING id INTO es;

  -- Mestre: atravessa rede/escola/turma/componente/período, sempre atribuído à própria atuação.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', um, 'role','authenticated')::text, true);
  IF NOT public.has_network_capability('manter-cadastro-unidade-escolar') THEN RAISE EXCEPTION 'R1 rede'; END IF;
  IF NOT public.has_network_capability('homologar-politica-de-capacidades') THEN RAISE EXCEPTION 'R2 admin'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', sch) THEN RAISE EXCEPTION 'R3 escola'; END IF;
  IF public.has_school_capability('manter-matricula-e-enturmacao', 'escola-inexistente') THEN RAISE EXCEPTION 'R4 escola inexistente'; END IF;
  IF NOT public.has_capability('registrar-frequencia', cls, per) THEN RAISE EXCEPTION 'R5 turma/período'; END IF;
  SELECT * INTO r FROM public.capability_grant('registrar-aula', cls, comp, per);
  IF r.engagement_id IS DISTINCT FROM em OR r.policy_id IS DISTINCT FROM v3 THEN RAISE EXCEPTION 'R6 componente/autoria'; END IF;
  IF public.has_capability('capacidade-inexistente', cls, per) THEN RAISE EXCEPTION 'R7 wildcard'; END IF;
  SELECT engagement_id INTO r FROM public.class_registry_school_grant('manter-cadastro-de-turmas', sch);
  IF r.engagement_id IS DISTINCT FROM em THEN RAISE EXCEPTION 'R8 turmas'; END IF;
  IF public.b2_4_authorizing_engagement() IS DISTINCT FROM em THEN RAISE EXCEPTION 'R9 anos/períodos'; END IF;
  IF (SELECT count(*) FROM public.general_admin_session()) <> 1 THEN RAISE EXCEPTION 'R10 sessão mestre'; END IF;
  -- Invariantes do writer continuam (ato obrigatório).
  BEGIN PERFORM public.homologate_capability_policy(v2, '', current_date); RAISE EXCEPTION 'R11';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'policy:act-required' THEN RAISE EXCEPTION 'R11 %', SQLERRM; END IF; END;

  -- Setor comum não ganha mestre nem rede.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', us, 'role','authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM public.general_admin_session()) THEN RAISE EXCEPTION 'S1 setor virou mestre'; END IF;
  IF public.has_network_capability('manter-cadastro-unidade-escolar') THEN RAISE EXCEPTION 'S2 setor com rede'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', sch) THEN RAISE EXCEPTION 'S3 setor perdeu escola'; END IF;
  IF public.has_capability('registrar-aula', cls, per) THEN RAISE EXCEPTION 'S4 setor virou professor'; END IF;
  SELECT engagement_id INTO r FROM public.class_registry_school_grant('manter-cadastro-de-turmas', sch);
  IF r.engagement_id IS DISTINCT FROM es THEN RAISE EXCEPTION 'S5 secretaria turmas'; END IF;
  -- Supervisão não recebe mestre.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sup, 'role','authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM public.general_admin_session()) THEN RAISE EXCEPTION 'S6 Supervisão virou mestre'; END IF;
  IF public.has_network_capability('manter-cadastro-unidade-escolar') THEN RAISE EXCEPTION 'S7 Supervisão com cadastro'; END IF;
  -- ACL
  IF has_function_privilege('authenticated', 'public.sigem_general_admin_coverage_issues(uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.general_admin_session()', 'EXECUTE') THEN RAISE EXCEPTION 'A1 acl'; END IF;

  RAISE EXCEPTION 'b1-2-tests-ok';
END $t$;
