-- B3.2: execute against the migrated Cloud database with ON_ERROR_STOP enabled.
-- All institutional fixtures, including the temporary test policy/catalog value,
-- live inside this transaction. A passing run prints b32-tests-ok and rolls back.
BEGIN;
DO $b32$
DECLARE
  u_sec text := '{"sub":"00000000-0000-0000-0000-0000000b3201","role":"authenticated"}';
  u_cat text := '{"sub":"00000000-0000-0000-0000-0000000b3202","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-0000000b3203","role":"authenticated"}';
  u_other text := '{"sub":"00000000-0000-0000-0000-0000000b3204","role":"authenticated"}';
  pol uuid := '00000000-0000-0000-0000-0000000b32a0';
  cls_a text; cls_short text; cls_b text; cls_y text;
  ending_id uuid;
  executor_role text := current_user;
BEGIN
  INSERT INTO public.institutional_persons(id, display_name)
  SELECT ('00000000-0000-0000-0000-0000000b30' || lpad(i::text, 2, '0'))::uuid, 'Pessoa B3.2 ' || i FROM generate_series(5, 8) i;
  INSERT INTO public.user_person_links(user_id, person_id)
  SELECT ('00000000-0000-0000-0000-0000000b32' || lpad(i::text, 2, '0'))::uuid,
         ('00000000-0000-0000-0000-0000000b30' || lpad((i + 4)::text, 2, '0'))::uuid FROM generate_series(1, 4) i;
  INSERT INTO public.institutional_schools(id) VALUES ('esc-b32-a'), ('esc-b32-b');
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
  VALUES ('esc-b32-a', 1, 'Escola A', true, '2020-01-01', 'ato'), ('esc-b32-b', 1, 'Escola B', true, '2020-01-01', 'ato');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    ('00000000-0000-0000-0000-0000000b3005', 'secretaria-escolar', 'escola', 'esc-b32-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b3006', 'cadastro-institucional-da-rede', 'rede', NULL, '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b3007', 'teste-b32-nada', 'escola', 'esc-b32-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b3008', 'secretaria-escolar', 'escola', 'esc-b32-b', '2020-01-01');
  INSERT INTO public.institutional_academic_years(id) VALUES ('ano-b32'), ('ano-b32-y');
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  SELECT y, 1, 'Ano ' || y, '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato',
    '00000000-0000-0000-0000-0000000b3201', '00000000-0000-0000-0000-0000000b3005', e.id
  FROM public.institutional_engagements e, unnest(ARRAY['ano-b32', 'ano-b32-y']) y
  WHERE e.person_id = '00000000-0000-0000-0000-0000000b3005';
  INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from)
  VALUES (pol, 'teste-b32', 1, 'draft', '2020-01-01');
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']),
    (pol, 'secretaria-escolar', 'manter-matricula-e-enturmacao', ARRAY['school']),
    (pol, 'secretaria-escolar', 'consultar-matricula-e-movimentacao', ARRAY['school']),
    (pol, 'cadastro-institucional-da-rede', 'manter-catalogos-institucionais', ARRAY['network']);
  UPDATE public.capability_policies SET status = 'homologated' WHERE id = pol;
  INSERT INTO public.institutional_students(id, display_name)
  VALUES ('est-b32-1', 'Estudante 1'), ('est-b32-2', 'Estudante 2'), ('est-b32-3', 'Estudante 3');

  -- Privilégios e append-only: também verificar os triggers das duas tabelas.
  IF has_function_privilege('anon', 'public.record_class_allocation(text,text,text,date,text,text,text,date)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.record_class_allocation(text,text,text,date,text,text,text,date)', 'EXECUTE')
    OR has_table_privilege('authenticated', 'public.class_enrollment_episodes', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_enrollment_episodes', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.class_enrollment_episodes', 'DELETE')
    OR has_table_privilege('authenticated', 'public.class_allocation_ending_versions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_allocation_ending_versions', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.class_allocation_ending_versions', 'DELETE')
  THEN RAISE EXCEPTION 'b32:acl-or-direct-dml'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.class_enrollment_episodes'::regclass
      AND tgname = 'immutable_episodes' AND tgenabled IN ('O', 'A')) <> 1
    OR (SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.class_allocation_ending_versions'::regclass
      AND tgname = 'immutable_class_allocation_endings' AND tgenabled IN ('O', 'A')) <> 1
  THEN RAISE EXCEPTION 'b32:append-only-trigger-missing'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname = 'record_class_allocation' AND NOT p.prosecdef)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'record_class_allocation' AND NOT (coalesce(p.proconfig, '{}') @> ARRAY['search_path=""']))
  THEN RAISE EXCEPTION 'b32:definer-not-hardened'; END IF;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  cls_a := public.register_institutional_class('esc-b32-a', 'ano-b32', 'A', 'Turma A', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  cls_short := public.register_institutional_class('esc-b32-a', 'ano-b32', 'S', 'Turma S', 'ativa', '2026-01-01', '2026-06-30', 'ato-t');
  cls_y := public.register_institutional_class('esc-b32-a', 'ano-b32-y', 'Y', 'Turma Y', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  PERFORM set_config('request.jwt.claims', u_other, true);
  cls_b := public.register_institutional_class('esc-b32-b', 'ano-b32', 'B', 'Turma B', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  PERFORM set_config('request.jwt.claims', u_sec, true);
  PERFORM public.constitute_cycle_enrollment('m-open', 'est-b32-1', 'esc-b32-a', 'ano-b32', '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-bounded', 'est-b32-2', 'esc-b32-a', 'ano-b32', '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-equal', 'est-b32-3', 'esc-b32-a', 'ano-b32', '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM set_config('request.jwt.claims', u_cat, true);
  PERFORM public.record_attribute_value_version('natureza-da-participacao-educacional', 'nat-b32', NULL,
    'Natureza de teste', 'homologada', '2020-01-01', 'ato-teste', NULL);
  PERFORM public.record_attribute_value_version('situacao-do-vinculo', 'sv-b32', NULL,
    'Situação de teste', 'homologada', '2020-01-01', 'ato-teste', NULL);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  PERFORM public.declare_cycle_participation('p-open', NULL, 'm-open', 'nat-b32', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.declare_cycle_participation('p-bounded', NULL, 'm-bounded', 'nat-b32', 1, '2026-02-01', '2026-12-20', 'ato', NULL);
  PERFORM public.declare_cycle_participation('p-equal', NULL, 'm-equal', 'nat-b32', 1, '2026-02-01', '2026-12-20', 'ato', NULL);
  PERFORM public.record_cycle_enrollment_ending('m-bounded', NULL, '2026-12-20', 'sv-b32', 1, 'motivo', 'ato', NULL);

  -- Sessão e capability são revalidadas no writer de oito argumentos.
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    PERFORM public.record_class_allocation('a-denied', 'p-open', cls_a, '2026-02-01', 'ato', NULL, NULL, NULL);
    RAISE EXCEPTION 'b32:accepted-no-session';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:session-required%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', u_none, true);
  BEGIN
    PERFORM public.record_class_allocation('a-denied', 'p-open', cls_a, '2026-02-01', 'ato', NULL, NULL, NULL);
    RAISE EXCEPTION 'b32:accepted-no-capability';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:capability-missing%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', u_sec, true);

  -- Participação aberta + alocação aberta: a assinatura antiga permanece válida.
  PERFORM public.record_class_allocation('a-open', 'p-open', cls_a, '2026-02-01', 'ato', NULL, NULL);
  IF EXISTS (SELECT 1 FROM public.class_allocation_ending_versions WHERE allocation_logical_id = 'a-open')
  THEN RAISE EXCEPTION 'b32:open-allocation-ended'; END IF;
  IF (SELECT count(*) FROM public.class_allocations_at('esc-b32-a', NULL, '2026-03-01')) <> 1
  THEN RAISE EXCEPTION 'b32:open-allocation-not-readable'; END IF;

  -- Uma participação delimitada exige fim explícito; nunca o escolhe por conta própria.
  BEGIN
    PERFORM public.record_class_allocation('a-denied', 'p-bounded', cls_a, '2026-03-01', 'ato', NULL, NULL);
    RAISE EXCEPTION 'b32:legacy-open-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:open-beyond-participation%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_class_allocation('a-denied', 'p-bounded', cls_a, '2026-03-01', 'ato', NULL, NULL, NULL);
    RAISE EXCEPTION 'b32:new-open-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:open-beyond-participation%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_class_allocation('a-denied', 'p-bounded', cls_a, '2026-03-01', 'ato', NULL, NULL, '2026-12-21');
    RAISE EXCEPTION 'b32:after-participation-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:outside-participation%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_class_allocation('a-denied', 'p-bounded', cls_a, '2026-01-31', 'ato', NULL, NULL, '2026-06-30');
    RAISE EXCEPTION 'b32:before-participation-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:outside-participation%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_class_allocation('a-denied', 'p-bounded', cls_a, '2026-03-01', 'ato', NULL, NULL, '2026-02-28');
    RAISE EXCEPTION 'b32:reverse-interval-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:ending-before-start%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_class_allocation('a-denied', 'p-bounded', cls_short, '2026-03-01', 'ato', NULL, NULL, '2026-07-01');
    RAISE EXCEPTION 'b32:inactive-class-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:class-inactive-on-date%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_class_allocation('a-denied', 'p-bounded', cls_b, '2026-03-01', 'ato', NULL, NULL, '2026-06-30');
    RAISE EXCEPTION 'b32:other-school-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:class-other-school%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_class_allocation('a-denied', 'p-bounded', cls_y, '2026-03-01', 'ato', NULL, NULL, '2026-06-30');
    RAISE EXCEPTION 'b32:other-year-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:academic-year-mismatch%' THEN RAISE; END IF; END;

  -- Dois intervalos permitidos: interno e exatamente até o limite inclusivo do pai.
  PERFORM public.record_class_allocation('a-bounded', 'p-bounded', cls_a, '2026-03-01', 'ato', NULL, NULL, '2026-06-30');
  PERFORM public.record_class_allocation('a-equal', 'p-equal', cls_a, '2026-02-01', 'ato', NULL, NULL, '2026-12-20');
  SELECT x.id INTO ending_id FROM public.class_allocation_ending_versions x WHERE x.allocation_logical_id = 'a-bounded';
  IF ending_id IS NULL OR (SELECT version FROM public.class_allocation_ending_versions WHERE id = ending_id) <> 1
    OR (SELECT ended_on FROM public.class_allocation_ending_versions WHERE allocation_logical_id = 'a-bounded') <> '2026-06-30'
    OR (SELECT ended_on FROM public.class_allocation_ending_versions WHERE allocation_logical_id = 'a-equal') <> '2026-12-20'
  THEN RAISE EXCEPTION 'b32:atomic-ending-not-recorded'; END IF;
  IF (SELECT count(*) FROM public.class_allocations_at('esc-b32-a', NULL, '2026-07-01') WHERE logical_id = 'a-bounded') <> 0
    OR (SELECT count(*) FROM public.class_allocations_at('esc-b32-a', NULL, '2026-06-30') WHERE logical_id = 'a-bounded') <> 1
  THEN RAISE EXCEPTION 'b32:valid-on-reading-broken'; END IF;
  IF (SELECT count(*) FROM public.class_allocations_at('esc-b32-a', NULL, '2026-04-01', now() - interval '1 day') WHERE logical_id = 'a-bounded') <> 0
    OR (SELECT count(*) FROM public.class_allocations_at('esc-b32-a', NULL, '2026-04-01', now() + interval '1 day') WHERE logical_id = 'a-bounded') <> 1
  THEN RAISE EXCEPTION 'b32:known-at-reading-broken'; END IF;

  PERFORM set_config('role', executor_role, true);
  BEGIN
    UPDATE public.class_enrollment_episodes SET class_id = class_id WHERE id = 'a-bounded';
    RAISE EXCEPTION 'b32:allocation-update-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Fato oficial é imutável%' THEN RAISE; END IF; END;
  BEGIN
    DELETE FROM public.class_allocation_ending_versions WHERE id = ending_id;
    RAISE EXCEPTION 'b32:ending-delete-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Fato oficial é imutável%' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'authenticated', true);

  BEGIN
    PERFORM public.record_class_allocation('a-second', 'p-bounded', cls_a, '2026-04-01', 'ato', NULL, NULL, '2026-05-01');
    RAISE EXCEPTION 'b32:second-allocation-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:cardinality-policy-absent%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_class_allocation_ending('a-bounded', ending_id, '2026-12-21', 'motivo', 'ato', 'retificação');
    RAISE EXCEPTION 'b32:ending-correction-outside-parent';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation-ending:outside-participation%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_class_allocation('a-bounded', 'p-bounded', cls_a, '2026-03-01', 'ato', 'a-bounded', 'retificação', '2026-12-20');
    RAISE EXCEPTION 'b32:correction-changed-ending';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:ending-on-correction-unsupported%' THEN RAISE; END IF; END;
  PERFORM public.record_class_allocation('a-bounded-v2', 'p-bounded', cls_a, '2026-03-02', 'ato', 'a-bounded', 'retificação', NULL);
  BEGIN
    PERFORM public.record_class_allocation('a-bounded-v3', 'p-bounded', cls_a, '2026-03-03', 'ato', 'a-bounded', 'base velha', NULL);
    RAISE EXCEPTION 'b32:stale-base-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:base-superseded%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.record_class_allocation('a-bounded-v3', 'p-bounded', cls_a, '2026-07-01', 'ato', 'a-bounded-v2', 'início fora do término', NULL);
    RAISE EXCEPTION 'b32:correction-beyond-ending';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:ending-before-start%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.class_allocation_ending_versions WHERE allocation_logical_id = 'a-bounded') <> 1
    OR (SELECT count(*) FROM public.class_enrollment_episodes WHERE logical_id = 'a-bounded') <> 2
  THEN RAISE EXCEPTION 'b32:append-only-correction-broken'; END IF;

  RAISE NOTICE 'b32-tests-ok: atomicidade, limites, ACL, append-only, validOn, knownAt, cardinalidade';
END $b32$;
ROLLBACK;
DO $after_rollback$
BEGIN
  IF EXISTS (SELECT 1 FROM public.institutional_schools WHERE id LIKE 'esc-b32-%')
    OR EXISTS (SELECT 1 FROM public.institutional_students WHERE id LIKE 'est-b32-%')
    OR EXISTS (SELECT 1 FROM public.class_enrollment_episodes WHERE id IN ('a-open', 'a-bounded', 'a-bounded-v2', 'a-equal'))
    OR EXISTS (SELECT 1 FROM public.class_allocation_ending_versions WHERE allocation_logical_id IN ('a-open', 'a-bounded', 'a-equal'))
    OR EXISTS (SELECT 1 FROM public.cycle_participations WHERE logical_id IN ('p-open', 'p-bounded', 'p-equal'))
    OR EXISTS (SELECT 1 FROM public.school_enrollments WHERE logical_id IN ('m-open', 'm-bounded', 'm-equal'))
    OR EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions WHERE enrollment_logical_id = 'm-bounded')
    OR EXISTS (SELECT 1 FROM public.attribute_value_definitions WHERE
      (scheme_id = 'natureza-da-participacao-educacional' AND value_id = 'nat-b32') OR
      (scheme_id = 'situacao-do-vinculo' AND value_id = 'sv-b32'))
    OR EXISTS (SELECT 1 FROM public.capability_policies WHERE logical_policy_id = 'teste-b32')
  THEN RAISE EXCEPTION 'b32:fixtures-remained-after-rollback'; END IF;
  RAISE NOTICE 'b32-rollback-ok: zero fixtures institucionais';
END $after_rollback$;
