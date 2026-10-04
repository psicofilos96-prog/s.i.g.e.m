-- B2.5.1. Regressão pós-B1.2/B1.3: contrato setorial escolar + Administrador Geral explícito em rede.
-- Executar em conexão que aceite transação. Todo dado sintético é revertido.
BEGIN;
DO $test$
DECLARE
  v1 uuid;
  v2 uuid;
  v3 uuid;
  school_claim text := '{"sub":"00000000-0000-0000-0000-00000000b501","role":"authenticated"}';
  network_claim text := '{"sub":"00000000-0000-0000-0000-00000000b502","role":"authenticated"}';
  expired_claim text := '{"sub":"00000000-0000-0000-0000-00000000b503","role":"authenticated"}';
  master_claim text := '{"sub":"00000000-0000-0000-0000-00000000b504","role":"authenticated"}';
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
    SELECT 1 FROM public.capability_policy_rules r WHERE r.policy_id IN (v1, v2, v3)
    GROUP BY r.policy_id, r.engagement_kind_id, r.capability_id, r.scope_dimensions HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'b251:test-v1-or-duplicate'; END IF;

  -- O contrato setorial original permanece: Secretaria Escolar só tem as duas
  -- capacidades em [school]. A v3 preserva essas regras e acrescenta, separadamente,
  -- regras explícitas [network] para o Administrador Geral (B1.2), sem fallback genérico.
  IF (SELECT count(*) FROM public.capability_policy_rules r WHERE r.policy_id = v2
       AND r.engagement_kind_id = 'secretaria-escolar'
       AND r.capability_id IN ('manter-cadastro-de-turmas','manter-organizacao-de-periodos-da-turma')
       AND r.scope_dimensions = ARRAY['school']::text[]) <> 2 OR
     (SELECT count(*) FROM public.capability_policy_rules r WHERE r.policy_id = v3
       AND r.engagement_kind_id = 'secretaria-escolar'
       AND r.capability_id IN ('manter-cadastro-de-turmas','manter-organizacao-de-periodos-da-turma')
       AND r.scope_dimensions = ARRAY['school']::text[]) <> 2 OR
     (SELECT count(*) FROM public.capability_policy_rules r WHERE r.policy_id = v3
       AND r.engagement_kind_id = 'administrador-geral-do-sigem'
       AND r.capability_id IN ('manter-cadastro-de-turmas','manter-organizacao-de-periodos-da-turma')
       AND r.scope_dimensions = ARRAY['network']::text[]) <> 2
  THEN RAISE EXCEPTION 'b251:test-capability-exactness'; END IF;

  INSERT INTO public.institutional_persons(id, display_name) VALUES
    ('00000000-0000-0000-0000-00000000b511', 'Teste secretaria'),
    ('00000000-0000-0000-0000-00000000b512', 'Teste secretaria rede indevida'),
    ('00000000-0000-0000-0000-00000000b513', 'Teste atuação vencida'),
    ('00000000-0000-0000-0000-00000000b514', 'Teste administrador geral');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES
    ('00000000-0000-0000-0000-00000000b501', '00000000-0000-0000-0000-00000000b511'),
    ('00000000-0000-0000-0000-00000000b502', '00000000-0000-0000-0000-00000000b512'),
    ('00000000-0000-0000-0000-00000000b503', '00000000-0000-0000-0000-00000000b513'),
    ('00000000-0000-0000-0000-00000000b504', '00000000-0000-0000-0000-00000000b514');
  INSERT INTO public.institutional_schools(id) VALUES ('esc-b251-a'), ('esc-b251-b');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from, valid_until) VALUES
    ('00000000-0000-0000-0000-00000000b511', 'secretaria-escolar', 'escola', 'esc-b251-a', '2020-01-01', NULL),
    ('00000000-0000-0000-0000-00000000b512', 'secretaria-escolar', 'rede', NULL, '2020-01-01', NULL),
    ('00000000-0000-0000-0000-00000000b513', 'secretaria-escolar', 'escola', 'esc-b251-a', '2020-01-01', '2021-01-01'),
    ('00000000-0000-0000-0000-00000000b514', 'administrador-geral-do-sigem', 'rede', NULL, '2020-01-01', NULL);

  PERFORM set_config('role', 'authenticated', true);

  -- Secretaria Escolar: própria escola permitida; outra escola recusada.
  PERFORM set_config('request.jwt.claims', school_claim, true);
  IF NOT EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-cadastro-de-turmas', 'esc-b251-a')) OR
     NOT EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-organizacao-de-periodos-da-turma', 'esc-b251-a')) OR
     EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-cadastro-de-turmas', 'esc-b251-b')) OR
     EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-organizacao-de-periodos-da-turma', 'esc-b251-b')) OR
     EXISTS (SELECT 1 FROM public.class_registry_school_grant('capacidade-inexistente', 'esc-b251-a'))
  THEN RAISE EXCEPTION 'b251:test-school-contract'; END IF;

  -- Uma atuação secretaria-escolar em rede não converte a regra [school] em [network].
  PERFORM set_config('request.jwt.claims', network_claim, true);
  IF EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-cadastro-de-turmas', 'esc-b251-a')) OR
     EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-organizacao-de-periodos-da-turma', 'esc-b251-a'))
  THEN RAISE EXCEPTION 'b251:test-secretaria-network-scope'; END IF;

  -- Atuação vencida não autoriza.
  PERFORM set_config('request.jwt.claims', expired_claim, true);
  IF EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-cadastro-de-turmas', 'esc-b251-a')) OR
     EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-organizacao-de-periodos-da-turma', 'esc-b251-a'))
  THEN RAISE EXCEPTION 'b251:test-expired-engagement'; END IF;

  -- B1.2: o Administrador Geral só alcança escolas porque a v3 contém regras
  -- explícitas [network] para essas capacidades; não há impersonação nem wildcard.
  PERFORM set_config('request.jwt.claims', master_claim, true);
  IF NOT EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-cadastro-de-turmas', 'esc-b251-a')) OR
     NOT EXISTS (SELECT 1 FROM public.class_registry_school_grant('manter-organizacao-de-periodos-da-turma', 'esc-b251-b')) OR
     EXISTS (SELECT 1 FROM public.class_registry_school_grant('capacidade-inexistente', 'esc-b251-a'))
  THEN RAISE EXCEPTION 'b251:test-master-explicit-network'; END IF;
END $test$;
SELECT 'PASS' AS result,
  'v1 108 draft; v2 121 draft; v3 199 homologated; Secretaria [school] preservada; Administrador Geral [network] explícito; escopo e vigência fail-closed' AS proof;
ROLLBACK;
