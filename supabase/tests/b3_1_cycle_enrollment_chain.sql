-- B3.1 — Cadeia inscrição → participação → alocação, capacidade e tipos de movimentação.
-- Execução real no banco, numa transação descartada: o bloco termina com RAISE, então
-- nenhum fixture (pessoas, política de teste, catálogos de teste, turmas) permanece.
-- Sucesso = erro final 'b31-tests-ok: ...'; qualquer outro erro é falha.
DO $b31t$
DECLARE
  u_sec text := '{"sub":"00000000-0000-0000-0000-0000000b3101","role":"authenticated"}';
  u_cat text := '{"sub":"00000000-0000-0000-0000-0000000b3102","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-0000000b3103","role":"authenticated"}';
  u_other text := '{"sub":"00000000-0000-0000-0000-0000000b3104","role":"authenticated"}';
  pol uuid := '00000000-0000-0000-0000-0000000b31a0';
  cls_a text; cls_short text; cls_b text; cls_y text;
  p1 uuid; p1b uuid; e_end uuid; a1_end uuid; a1_end2 uuid; cap1 uuid; t0 timestamptz; n integer;
  ok text := '';
BEGIN
  -- Fixture (privilegiado) ------------------------------------------------
  INSERT INTO public.institutional_persons(id, display_name)
  SELECT ('00000000-0000-0000-0000-0000000b30' || lpad(i::text, 2, '0'))::uuid, 'Pessoa ' || i FROM generate_series(1, 4) i;
  INSERT INTO public.user_person_links(user_id, person_id)
  SELECT ('00000000-0000-0000-0000-0000000b31' || lpad(i::text, 2, '0'))::uuid,
         ('00000000-0000-0000-0000-0000000b30' || lpad(i::text, 2, '0'))::uuid FROM generate_series(1, 4) i;
  INSERT INTO public.institutional_schools(id) VALUES ('esc-b31-a'), ('esc-b31-b');
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
  VALUES ('esc-b31-a', 1, 'Escola A', true, '2020-01-01', 'ato'), ('esc-b31-b', 1, 'Escola B', true, '2020-01-01', 'ato');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    ('00000000-0000-0000-0000-0000000b3001', 'secretaria-escolar', 'escola', 'esc-b31-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b3002', 'cadastro-institucional-da-rede', 'rede', NULL, '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b3003', 'teste-b31-nada', 'escola', 'esc-b31-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b3004', 'secretaria-escolar', 'escola', 'esc-b31-b', '2020-01-01');
  INSERT INTO public.institutional_academic_years(id) VALUES ('ano-b31'), ('ano-b31-y');
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  SELECT y, 1, 'Ano ' || y, '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato',
    '00000000-0000-0000-0000-0000000b3101', '00000000-0000-0000-0000-0000000b3001', e.id
  FROM public.institutional_engagements e, unnest(ARRAY['ano-b31', 'ano-b31-y']) y
  WHERE e.person_id = '00000000-0000-0000-0000-0000000b3001';
  INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b31', 1, 'draft', '2020-01-01');
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']),
    (pol, 'secretaria-escolar', 'manter-matricula-e-enturmacao', ARRAY['school']),
    (pol, 'secretaria-escolar', 'consultar-matricula-e-movimentacao', ARRAY['school']),
    (pol, 'secretaria-escolar', 'registrar-movimentacao-escolar', ARRAY['school']),
    (pol, 'cadastro-institucional-da-rede', 'manter-catalogos-institucionais', ARRAY['network']);
  UPDATE public.capability_policies SET status = 'homologated' WHERE id = pol;
  INSERT INTO public.institutional_students(id, display_name) VALUES ('est-b31-1', 'Estudante 1'), ('est-b31-2', 'Estudante 2');

  -- ACL (executado com has_*_privilege no banco real) ------------------------
  IF has_table_privilege('authenticated', 'public.school_enrollments', 'INSERT')
    OR has_table_privilege('authenticated', 'public.cycle_participations', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_enrollment_episodes', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_capacity_records', 'INSERT')
    OR has_table_privilege('authenticated', 'public.movement_type_definitions', 'INSERT')
    OR has_table_privilege('anon', 'public.cycle_participations', 'SELECT')
  THEN RAISE EXCEPTION 'b31:direct-dml-present'; END IF;
  IF has_function_privilege('anon', 'public.constitute_cycle_enrollment(text,text,text,text,date,text,text,text,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.record_class_capacity(text,uuid,text,integer,date,date,text,text,text,boolean)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.record_student_movement(text,uuid,text,text,text,integer,date,jsonb,jsonb,text,text,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.movement_types_at(date,timestamptz)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.class_allocations_at(text,text,date,timestamptz)', 'EXECUTE')
  THEN RAISE EXCEPTION 'b31:anon-execute-present'; END IF;
  IF has_function_privilege('authenticated', 'public.b3_enrollment_head(text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.b3_participation_head(text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.b3_allocation_ended_on(text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.register_school_enrollment(text,text,text,text,date,text,text,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.register_class_enrollment_episode(text,text,text,date,text,text,text)', 'EXECUTE')
  THEN RAISE EXCEPTION 'b31:definer-helpers-or-legacy-reachable'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.movement_types_at(date,timestamptz)', 'EXECUTE')
  THEN RAISE EXCEPTION 'b31:reader-not-granted'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
      AND p.proname IN ('constitute_cycle_enrollment','record_cycle_enrollment_ending','declare_cycle_participation','record_class_allocation',
        'record_class_allocation_ending','record_class_capacity','record_student_movement')
      AND NOT (coalesce(p.proconfig, '{}') @> ARRAY['search_path=""'])) THEN RAISE EXCEPTION 'b31:search-path-not-hardened'; END IF;
  ok := ok || ' acl';

  PERFORM set_config('role', 'authenticated', true);

  -- Sem sessão ---------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.constitute_cycle_enrollment('m-x', 'est-b31-1', 'esc-b31-a', 'ano-b31', '2026-02-01', NULL, 'ato', NULL, NULL);
    RAISE EXCEPTION 'b31:no-session-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%enrollment:session-required%' THEN RAISE; END IF; END;
  ok := ok || ' sem-sessao';

  -- Escopo escolar / capacidade ---------------------------------------------
  PERFORM set_config('request.jwt.claims', u_none, true);
  BEGIN PERFORM public.constitute_cycle_enrollment('m-x', 'est-b31-1', 'esc-b31-a', 'ano-b31', '2026-02-01', NULL, 'ato', NULL, NULL);
    RAISE EXCEPTION 'b31:no-capability-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%enrollment:capability-missing%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', u_other, true);
  BEGIN PERFORM public.constitute_cycle_enrollment('m-x', 'est-b31-1', 'esc-b31-a', 'ano-b31', '2026-02-01', NULL, 'ato', NULL, NULL);
    RAISE EXCEPTION 'b31:other-school-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%enrollment:capability-missing%' THEN RAISE; END IF; END;
  ok := ok || ' escopo-escolar';

  -- Turmas (escritor B2.5) ----------------------------------------------------
  PERFORM set_config('request.jwt.claims', u_sec, true);
  cls_a := public.register_institutional_class('esc-b31-a', 'ano-b31', 'A', 'Turma A', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  cls_short := public.register_institutional_class('esc-b31-a', 'ano-b31', 'S', 'Turma S', 'ativa', '2026-01-01', '2026-06-30', 'ato-t');
  cls_y := public.register_institutional_class('esc-b31-a', 'ano-b31-y', 'Y', 'Turma Y', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  PERFORM set_config('request.jwt.claims', u_other, true);
  cls_b := public.register_institutional_class('esc-b31-b', 'ano-b31', 'B', 'Turma B', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');

  -- Capacidade ----------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', u_sec, true);
  IF EXISTS (SELECT 1 FROM public.class_capacity_at(cls_a, '2026-03-01')) THEN RAISE EXCEPTION 'b31:capacity-not-absent'; END IF;
  ok := ok || ' capacidade-ausente';
  BEGIN PERFORM public.record_class_capacity('c-s', NULL, cls_short, 30, '2026-03-01', '2026-09-30', NULL, 'ato', NULL);
    RAISE EXCEPTION 'b31:capacity-beyond-class';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capacity:class-inactive-on-date%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_capacity('c-s', NULL, cls_short, 30, '2026-08-01', NULL, NULL, 'ato', NULL);
    RAISE EXCEPTION 'b31:capacity-inactive-class';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capacity:class-inactive-on-date%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_capacity('c-s', NULL, cls_a, 30, '2026-03-01', '2027-03-01', NULL, 'ato', NULL);
    RAISE EXCEPTION 'b31:capacity-beyond-year';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capacity:class-inactive-on-date%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_capacity('c-s', NULL, cls_a, 30, '2026-03-01', '2026-02-01', NULL, 'ato', NULL);
    RAISE EXCEPTION 'b31:capacity-reversed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capacity:ends-before-start%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', u_other, true);
  BEGIN PERFORM public.record_class_capacity('c-x', NULL, cls_a, 30, '2026-03-01', NULL, NULL, 'ato', NULL);
    RAISE EXCEPTION 'b31:capacity-other-school';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capacity:capability-missing%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', u_sec, true);
  cap1 := public.record_class_capacity('c-1', NULL, cls_short, 30, '2026-02-01', '2026-06-30', NULL, 'ato', NULL);
  IF (SELECT reference_limit FROM public.class_capacity_at(cls_short, '2026-03-01')) <> 30 THEN RAISE EXCEPTION 'b31:capacity-read'; END IF;
  ok := ok || ' capacidade-turma-inativa-e-periodo';

  -- Inscrição -----------------------------------------------------------------
  PERFORM public.constitute_cycle_enrollment('m-1', 'est-b31-1', 'esc-b31-a', 'ano-b31', '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-2', 'est-b31-2', 'esc-b31-a', 'ano-b31', '2026-02-01', NULL, 'ato', NULL, NULL);

  -- Participação: natureza não homologada, depois homologada só neste teste ----
  BEGIN PERFORM public.declare_cycle_participation('p-1', NULL, 'm-1', 'nat-b31', 1, '2026-02-01', NULL, 'ato', NULL);
    RAISE EXCEPTION 'b31:nature-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%participation:nature-not-homologated%' THEN RAISE; END IF; END;
  ok := ok || ' natureza-nao-homologada';
  PERFORM set_config('request.jwt.claims', u_cat, true);
  PERFORM public.record_attribute_value_version('natureza-da-participacao-educacional', 'nat-b31', NULL, 'Natureza de teste', 'homologada', '2020-01-01', 'ato-teste', NULL);
  PERFORM public.record_attribute_value_version('situacao-do-vinculo', 'sv-b31', NULL, 'Situação de teste', 'homologada', '2020-01-01', 'ato-teste', NULL);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  p1 := public.declare_cycle_participation('p-1', NULL, 'm-1', 'nat-b31', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.declare_cycle_participation('p-2', NULL, 'm-2', 'nat-b31', 1, '2026-02-01', NULL, 'ato', NULL);
  BEGIN PERFORM public.declare_cycle_participation('p-1x', NULL, 'm-1', 'nat-b31', 1, '2026-03-01', NULL, 'ato', NULL);
    RAISE EXCEPTION 'b31:overlap-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%participation:coexistence-policy-absent%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.declare_cycle_participation('p-1y', NULL, 'm-1', 'nat-b31', 1, '2026-01-15', '2026-01-20', 'ato', NULL);
    RAISE EXCEPTION 'b31:participation-before-enrollment';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%participation:outside-enrollment%' THEN RAISE; END IF; END;
  ok := ok || ' sobreposicao-participacao';

  -- Alocação ------------------------------------------------------------------
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-1', cls_b, '2026-02-01', 'ato', NULL, NULL);
    RAISE EXCEPTION 'b31:other-school-class';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:class-other-school%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-1', cls_y, '2026-02-01', 'ato', NULL, NULL);
    RAISE EXCEPTION 'b31:other-year-class';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:academic-year-mismatch%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-1', cls_short, '2026-08-01', 'ato', NULL, NULL);
    RAISE EXCEPTION 'b31:inactive-class';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:class-inactive-on-date%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-1', cls_a, '2026-01-10', 'ato', NULL, NULL);
    RAISE EXCEPTION 'b31:before-participation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:outside-participation%' THEN RAISE; END IF; END;
  ok := ok || ' turma-outra-escola-outro-ano-inativa';
  PERFORM public.record_class_allocation('a-1', 'p-1', cls_a, '2026-02-01', 'ato', NULL, NULL);
  PERFORM public.record_class_allocation('a-2', 'p-2', cls_short, '2026-02-01', 'ato', NULL, NULL);
  BEGIN PERFORM public.record_class_allocation('a-1b', 'p-1', cls_short, '2026-03-01', 'ato', NULL, NULL);
    RAISE EXCEPTION 'b31:second-allocation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:cardinality-policy-absent%' THEN RAISE; END IF; END;
  ok := ok || ' segunda-alocacao';
  IF public.class_occupancy_at(cls_short, '2026-03-01') <> 1 THEN RAISE EXCEPTION 'b31:occupancy-derived'; END IF;

  -- Término de alocação -------------------------------------------------------
  BEGIN PERFORM public.record_class_allocation_ending('a-1', NULL, '2026-01-15', 'motivo', 'ato', NULL);
    RAISE EXCEPTION 'b31:ending-before-start';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation-ending:before-start%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_allocation_ending('a-2', NULL, '2026-08-01', 'motivo', 'ato', NULL);
    RAISE EXCEPTION 'b31:ending-after-class';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation-ending:class-inactive-in-interval%' THEN RAISE; END IF; END;
  ok := ok || ' termino-antes-inicio' || ' termino-fora-da-turma';

  -- Pai → filho: participação não encurta com alocação aberta -----------------
  BEGIN PERFORM public.declare_cycle_participation('p-1', p1, 'm-1', 'nat-b31', 1, '2026-02-01', '2026-05-31', 'ato', 'encurtar');
    RAISE EXCEPTION 'b31:shorten-with-open-allocation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%participation:child-allocation-outside%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.declare_cycle_participation('p-1', p1, 'm-1', 'nat-b31', 1, '2026-03-01', NULL, 'ato', 'adiar');
    RAISE EXCEPTION 'b31:start-after-allocation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%participation:child-allocation-outside%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.declare_cycle_participation('p-1', p1, 'm-1', 'nat-b31', 1, '2026-02-01', NULL, 'ato', 'anular', true);
    RAISE EXCEPTION 'b31:annul-with-allocation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%participation:has-allocations%' THEN RAISE; END IF; END;
  a1_end := public.record_class_allocation_ending('a-1', NULL, '2026-05-31', 'motivo', 'ato', NULL);
  p1b := public.declare_cycle_participation('p-1', p1, 'm-1', 'nat-b31', 1, '2026-02-01', '2026-05-31', 'ato', 'encurtar');
  BEGIN PERFORM public.record_class_allocation_ending('a-1', a1_end, NULL, NULL, 'ato', 'reabrir', true);
    RAISE EXCEPTION 'b31:reopen-beyond-participation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation-ending:open-beyond-participation%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_allocation_ending('a-1', a1_end, '2026-06-15', 'motivo', 'ato', 'estender');
    RAISE EXCEPTION 'b31:ending-beyond-participation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation-ending:outside-participation%' THEN RAISE; END IF; END;
  ok := ok || ' participacao-alocacao-sem-cascata';

  -- Pai → filho: inscrição -----------------------------------------------------
  BEGIN PERFORM public.record_cycle_enrollment_ending('m-1', NULL, '2026-04-30', 'sv-b31', 1, 'motivo', 'ato', NULL);
    RAISE EXCEPTION 'b31:enrollment-end-before-participation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ending:child-participation-outside%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_cycle_enrollment_ending('m-2', NULL, '2026-04-30', 'sv-b31', 1, 'motivo', 'ato', NULL);
    RAISE EXCEPTION 'b31:enrollment-end-open-participation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ending:child-participation-outside%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_cycle_enrollment_ending('m-1', NULL, '2026-01-10', 'sv-b31', 1, 'motivo', 'ato', NULL);
    RAISE EXCEPTION 'b31:enrollment-end-before-start';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ending:before-start%' THEN RAISE; END IF; END;
  e_end := public.record_cycle_enrollment_ending('m-1', NULL, '2026-06-30', 'sv-b31', 1, 'motivo', 'ato', NULL);
  BEGIN PERFORM public.constitute_cycle_enrollment('m-1b', 'est-b31-1', 'esc-b31-a', 'ano-b31', '2026-03-01', NULL, 'ato', 'm-1', 'corrigir abertura');
    RAISE EXCEPTION 'b31:opened-on-after-participation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%enrollment:child-participation-outside%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.constitute_cycle_enrollment('m-1b', 'est-b31-1', 'esc-b31-a', 'ano-b31-y', '2026-02-01', NULL, 'ato', 'm-1', 'trocar ano');
    RAISE EXCEPTION 'b31:identity-changed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%enrollment:identity-immutable%' THEN RAISE; END IF; END;
  ok := ok || ' inscricao-participacao-sem-cascata' || ' identidade-imutavel';

  -- Retificação append-only ---------------------------------------------------
  a1_end2 := public.record_class_allocation_ending('a-1', a1_end, '2026-05-15', 'motivo', 'ato', 'data correta');
  IF (SELECT count(*) FROM public.class_allocation_ending_versions WHERE allocation_logical_id = 'a-1') <> 2 THEN RAISE EXCEPTION 'b31:append-only'; END IF;
  BEGIN PERFORM public.record_class_allocation_ending('a-1', a1_end, '2026-05-20', 'motivo', 'ato', 'base velha');
    RAISE EXCEPTION 'b31:stale-base';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation-ending:base-superseded%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_allocation_ending('a-1', a1_end2, '2026-05-20', 'motivo', 'ato', NULL);
    RAISE EXCEPTION 'b31:correction-without-reason';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation-ending:correction-reason-required%' THEN RAISE; END IF; END;
  ok := ok || ' retificacao-append-only' || ' base-esperada';

  -- Tipos de movimentação -----------------------------------------------------
  IF EXISTS (SELECT 1 FROM public.movement_types_at('2026-03-01')) THEN RAISE EXCEPTION 'b31:movement-types-not-empty'; END IF;
  PERFORM set_config('request.jwt.claims', u_cat, true);
  PERFORM public.record_movement_type_definition('mt-b31', NULL, 'Tipo v1', 'homologada', '2020-01-01', 'ato-1');
  PERFORM public.record_movement_type_definition('mt-b31', 1, 'Tipo v2', 'homologada', '2026-06-01', 'ato-2');
  PERFORM public.record_movement_type_definition('mt-b31', 2, 'Tipo v3', 'rascunho', NULL, NULL);
  IF (SELECT version FROM public.movement_types_at('2026-03-01')) <> 1 THEN RAISE EXCEPTION 'b31:future-version-visible'; END IF;
  IF (SELECT version FROM public.movement_types_at('2026-07-01')) <> 2 THEN RAISE EXCEPTION 'b31:superseded-version-visible'; END IF;
  IF (SELECT count(*) FROM public.movement_types_at('2026-07-01')) <> 1 THEN RAISE EXCEPTION 'b31:draft-or-duplicate-visible'; END IF;
  PERFORM set_config('request.jwt.claims', u_sec, true);
  BEGIN PERFORM public.record_student_movement('mv-1', NULL, 'est-b31-2', 'm-2', 'mt-b31', 1, '2026-07-01',
      '{"schoolId":"esc-b31-a"}', '{}', NULL, NULL, 'ato', NULL);
    RAISE EXCEPTION 'b31:superseded-type-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%movement:type-not-current%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_student_movement('mv-1', NULL, 'est-b31-2', 'm-2', 'mt-b31', 2, '2026-03-01',
      '{"schoolId":"esc-b31-a"}', '{}', NULL, NULL, 'ato', NULL);
    RAISE EXCEPTION 'b31:future-type-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%movement:type-not-current%' THEN RAISE; END IF; END;
  PERFORM public.record_student_movement('mv-1', NULL, 'est-b31-2', 'm-2', 'mt-b31', 2, '2026-07-01',
      '{"schoolId":"esc-b31-a"}', '{}', NULL, NULL, 'ato', NULL);
  ok := ok || ' tipo-movimentacao-vigente';

  -- knownAt antes/depois de retificação conhecida depois -------------------------
  RESET ROLE;
  t0 := now();
  INSERT INTO public.class_allocation_ending_versions(allocation_logical_id, school_id, class_id, version, supersedes_id, ended_on, annulled,
    reason_text, correction_reason, recorded_by, created_at)
  VALUES ('a-2', 'esc-b31-a', cls_short, 1, NULL, '2026-04-30', false, 'motivo', NULL, '00000000-0000-0000-0000-0000000b3101', t0 + interval '1 hour');
  INSERT INTO public.movement_type_definitions(id, version, label, status, homologation_act_ref, valid_from, created_at)
  VALUES ('mt-b31', 4, 'Tipo v4', 'homologada', 'ato-4', '2026-06-15', t0 + interval '1 hour');
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  IF (SELECT count(*) FROM public.class_allocations_at(NULL, cls_short, '2026-05-15', t0)) <> 1
    OR (SELECT count(*) FROM public.class_allocations_at(NULL, cls_short, '2026-05-15', t0 + interval '2 hours')) <> 0
    OR (SELECT count(*) FROM public.class_allocations_at(NULL, cls_short, '2026-05-15')) <> 0
  THEN RAISE EXCEPTION 'b31:allocation-bitemporal'; END IF;
  IF (SELECT version FROM public.movement_types_at('2026-07-01', t0)) <> 2
    OR (SELECT version FROM public.movement_types_at('2026-07-01', t0 + interval '2 hours')) <> 4
  THEN RAISE EXCEPTION 'b31:movement-type-bitemporal'; END IF;
  ok := ok || ' knownat-antes-depois';

  -- Leitor sem escopo não vê nada (RLS da sessão) -------------------------------
  PERFORM set_config('request.jwt.claims', u_none, true);
  SELECT count(*) INTO n FROM public.class_allocations_at('esc-b31-a', NULL, NULL);
  IF n <> 0 THEN RAISE EXCEPTION 'b31:reader-leaks-without-capability'; END IF;
  ok := ok || ' leitor-rls';

  RAISE EXCEPTION 'b31-tests-ok:%', ok;
END $b31t$;
