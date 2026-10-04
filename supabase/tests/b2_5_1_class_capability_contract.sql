-- B2.5.1. Executar APÓS a migration, em uma conexão que aceite transação.
-- Todo dado sintético desta prova é revertido pelo ROLLBACK final.
BEGIN;
DO $test$
DECLARE
  v1 uuid;
  v2 uuid;
  v3 uuid;
  school_claim text := '{"sub":"00000000-0000-0000-0000-00000000b501","role":"authenticated"}';
  network_claim text := '{"sub":"00000000-0000-0000-0000-00000000b502","role":"authenticated"}';
  expired_claim text := '{"sub":"00000000-0000-0000-0000-00000000b503","role":"authenticated"}';
BEGIN
  SELECT p.id INTO v1 FROM public.capability_policies p
    WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 1;
  SELECT p.id INTO v2 FROM public.capability_policies p
    WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 2;
  SELECT p.id INTO v3 FROM public.capability_policies p
    WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 3;
  IF v1 IS NULL OR v2 IS NULL OR v3 IS NULL OR
     (SELECT count(*) FROM public.capability_policies p WHERE p.logical_policy_id = 'politica-capacidades-diario') <> 3 OR
     (SELECT count(*) FROM public.capability_policies p WHERE p.id IN (v1, v2) AND p.status = 'draft') <> 2 OR
     (SELECT count(*) FROM public.capability_policies p WHERE p.id = v3 AND p.status = 'homologated') <> 1 OR
     (SELECT count(*) FROM public.capability_policy_rules r WHERE r.policy_id = v1) <> 108 OR
     (SELECT count(*) FROM public.capability_policy_rules r WHERE r.policy_id = v2) <> 121 OR
     (SELECT count(*) FROM public.capability_policy_rules r WHERE r.policy_id = v3) <> 199
  THEN RAISE EXCEPTION 'b251:test-policy-count-or-status'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.capability_policy_rules r WHERE r.policy_id = v1
      AND r.capability_id IN ('manter-cadastro-de-turmas', 'manter-organizacao-de-periodos-da-turma')
  ) OR EXISTS (
    SELECT 1 FROM public.capability_policy_rules r WHERE r.policy_id IN (v1, v2)
    GROUP BY r.policy_id, r.engagement_kind_id, r.capability_id, r.scope_dimensions HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'b251:test-v1-or-duplicate'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules r WHERE r.policy_id = v2
       AND r.engagement_kind_id = 'secretaria-escolar'
       AND r.capability_id = 'manter-cadastro-de-turmas'
       AND r.scope_dimensions = ARRAY['school']::text[]) <> 1 OR
     (SELECT count(*) FROM public.capability_policy_rules r WHERE r.policy_id = v2
       AND r.engagement_kind_id = 'secretaria-escolar'
       AND r.capability_id = 'manter-organizacao-de-periodos-da-turma'
       AND r.scope_dimensions = ARRAY['school']::text[]) <> 1 OR
     (SELECT count(*) FROM public.capability_policy_rules r WHERE r.policy_id = v2
       AND r.capability_id IN ('manter-cadastro-de-turmas', 'manter-organizacao-de-periodos-da-turma')) <> 2
  THEN RAISE EXCEPTION 'b251:test-capability-exactness'; END IF;

  INSERT INTO public.institutional_persons(id, display_name) VALUES
    ('00000000-0000-0000-0000-00000000b511', 'Teste secretaria'),
    ('00000000-0000-0000-0000-00000000b512', 'Teste rede'),
    ('00000000-0000-0000-0000-00000000b513', 'Teste atuação vencida');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES
    ('00000000-0000-0000-0000-00000000b501', '00000000-0000-0000-0000-00000000b511'),
    ('00000000-0000-0000-0000-00000000b502', '00000000-0000-0000-0000-00000000b512'),
    ('00000000-0000-0000-0000-00000000b503', '00000000-0000-0000-0000-00000000b513');
  INSERT INTO public.institutional_schools(id) VALUES ('esc-b251-a'), ('esc-b251-b');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from, valid_until) VALUES
    ('00000000-0000-0000-0000-00000000b511', 'secretaria-escolar', 'escola', 'esc-b251-a', '2020-01-01', NULL),
    ('00000000-0000-0000-0000-00000000b512', 'secretaria-escolar', 'rede', NULL, '2020-01-01', NULL),
    ('00000000-0000-0000-0000-00000000b513', 'secretaria-escolar', 'escola', 'esc-b251-a', '2020-01-01', '2021-01-01');

  -- Uma política de prova com somente cadastro não concede o vínculo.
  BEGIN
    INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from)
      VALUES ('00000000-0000-0000-0000-00000000b521', 'teste-b251-cadastro', 1, 'draft', '2020-01-01');
    INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
      VALUES ('00000000-0000-0000-0000-00000000b521', 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']::text[]);
    UPDATE public.capability_policies SET status = 'homologated' WHERE id = '00000000-0000-0000-0000-00000000b521';
    PERFORM set_config('role', 'authenticated', true);
    IF current_user <> 'authenticated' THEN RAISE EXCEPTION 'b251:test-role-not-authenticated'; END IF;
    PERFORM set_config('request.jwt.claims', school_claim, true);
    IF NOT EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-cadastro-de-turmas', 'esc-b251-a')) OR
       EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-organizacao-de-periodos-da-turma', 'esc-b251-a')) OR
       EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-cadastro-de-turmas', 'esc-b251-b'))
    THEN RAISE EXCEPTION 'b251:test-cadastro-independence-or-school'; END IF;
    PERFORM set_config('request.jwt.claims', network_claim, true);
    IF EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-cadastro-de-turmas', 'esc-b251-a'))
    THEN RAISE EXCEPTION 'b251:test-network-scope'; END IF;
    PERFORM set_config('request.jwt.claims', expired_claim, true);
    IF EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-cadastro-de-turmas', 'esc-b251-a'))
    THEN RAISE EXCEPTION 'b251:test-expired-engagement'; END IF;
    RAISE EXCEPTION 'b251:rollback-cadastro-probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'b251:rollback-cadastro-probe' THEN RAISE; END IF;
  END;

  -- A prova inversa concede somente o vínculo, sem cadastro.
  BEGIN
    INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from)
      VALUES ('00000000-0000-0000-0000-00000000b522', 'teste-b251-vinculo', 1, 'draft', '2020-01-01');
    INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
      VALUES ('00000000-0000-0000-0000-00000000b522', 'secretaria-escolar', 'manter-organizacao-de-periodos-da-turma', ARRAY['school']::text[]);
    UPDATE public.capability_policies SET status = 'homologated' WHERE id = '00000000-0000-0000-0000-00000000b522';
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', school_claim, true);
    IF NOT EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-organizacao-de-periodos-da-turma', 'esc-b251-a')) OR
       EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-cadastro-de-turmas', 'esc-b251-a')) OR
       EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-organizacao-de-periodos-da-turma', 'esc-b251-b'))
    THEN RAISE EXCEPTION 'b251:test-vinculo-independence-or-school'; END IF;
    RAISE EXCEPTION 'b251:rollback-vinculo-probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'b251:rollback-vinculo-probe' THEN RAISE; END IF;
  END;

  -- Uma regra de alcance diferente não deve satisfazer o contrato [school].
  BEGIN
    INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from)
      VALUES ('00000000-0000-0000-0000-00000000b523', 'teste-b251-dimensao', 1, 'draft', '2020-01-01');
    INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
      VALUES ('00000000-0000-0000-0000-00000000b523', 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['network']::text[]);
    UPDATE public.capability_policies SET status = 'homologated' WHERE id = '00000000-0000-0000-0000-00000000b523';
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', school_claim, true);
    IF EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-cadastro-de-turmas', 'esc-b251-a'))
    THEN RAISE EXCEPTION 'b251:test-wrong-rule-scope'; END IF;
    RAISE EXCEPTION 'b251:rollback-dimension-probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'b251:rollback-dimension-probe' THEN RAISE; END IF;
  END;

  IF EXISTS (SELECT 1 FROM public.capability_policies p WHERE p.logical_policy_id LIKE 'teste-b251-%')
  THEN RAISE EXCEPTION 'b251:test-probe-policy-remained'; END IF;
END $test$;
SELECT 'PASS' AS result, 'v1 108 draft; v2 121 draft; v3 199 homologated; capacidades independentes; escola própria; rede e atuação vencida recusadas' AS proof;
ROLLBACK;
