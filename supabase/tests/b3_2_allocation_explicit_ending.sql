-- B3.2 — Alocação criada com término explícito (record_class_allocation de 9 argumentos).
-- Execução real no banco, numa transação descartada: o bloco termina com RAISE, então
-- nenhum fixture permanece. Sucesso = erro final 'b32-tests-ok: ...'; qualquer outro erro é falha.
DO $b32t$
DECLARE
  u_sec text := '{"sub":"00000000-0000-0000-0000-0000000b3201","role":"authenticated"}';
  u_cat text := '{"sub":"00000000-0000-0000-0000-0000000b3202","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-0000000b3203","role":"authenticated"}';
  pol uuid := '00000000-0000-0000-0000-0000000b32a0';
  sig9 text := 'public.record_class_allocation(text,text,text,date,text,text,text,date,text)';
  sig7 text := 'public.record_class_allocation(text,text,text,date,text,text,text)';
  cls_a text; cls_short text; cls_b text; cls_y text; end1 uuid; n integer;
  ok text := '';
BEGIN
  -- Leitura auxiliar do término vigente (privilegiada, só no teste; pg_temp some com a sessão).
  EXECUTE $f$CREATE FUNCTION pg_temp.b32_end(_l text) RETURNS date LANGUAGE sql SECURITY DEFINER AS 'SELECT x.ended_on FROM public.class_allocation_ending_versions x WHERE x.allocation_logical_id = _l AND NOT x.annulled AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s WHERE s.supersedes_id = x.id)'$f$;
  -- Fixture (privilegiado) ------------------------------------------------
  INSERT INTO public.institutional_persons(id, display_name)
  SELECT ('00000000-0000-0000-0000-0000000b32' || lpad(i::text, 2, '0'))::uuid, 'Pessoa ' || i FROM generate_series(91, 93) i;
  INSERT INTO public.user_person_links(user_id, person_id)
  SELECT ('00000000-0000-0000-0000-0000000b32' || lpad(i::text, 2, '0'))::uuid,
         ('00000000-0000-0000-0000-0000000b32' || lpad((i + 90)::text, 2, '0'))::uuid FROM generate_series(1, 3) i;
  INSERT INTO public.institutional_schools(id) VALUES ('esc-b32-a'), ('esc-b32-b');
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
  VALUES ('esc-b32-a', 1, 'Escola A', true, '2020-01-01', 'ato'), ('esc-b32-b', 1, 'Escola B', true, '2020-01-01', 'ato');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    ('00000000-0000-0000-0000-0000000b3291', 'secretaria-escolar', 'escola', 'esc-b32-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b3292', 'cadastro-institucional-da-rede', 'rede', NULL, '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b3293', 'teste-b32-nada', 'escola', 'esc-b32-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b3291', 'secretaria-escolar', 'escola', 'esc-b32-b', '2020-01-01');
  INSERT INTO public.institutional_academic_years(id) VALUES ('ano-b32'), ('ano-b32-y');
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  SELECT y, 1, 'Ano ' || y, '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato',
    '00000000-0000-0000-0000-0000000b3201', '00000000-0000-0000-0000-0000000b3291', e.id
  FROM (SELECT id FROM public.institutional_engagements WHERE person_id = '00000000-0000-0000-0000-0000000b3291' LIMIT 1) e,
       unnest(ARRAY['ano-b32', 'ano-b32-y']) y;
  INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b32', 1, 'draft', '2020-01-01');
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']),
    (pol, 'secretaria-escolar', 'manter-matricula-e-enturmacao', ARRAY['school']),
    (pol, 'secretaria-escolar', 'consultar-matricula-e-movimentacao', ARRAY['school']),
    (pol, 'cadastro-institucional-da-rede', 'manter-catalogos-institucionais', ARRAY['network']);
  UPDATE public.capability_policies SET status = 'homologated' WHERE id = pol;
  INSERT INTO public.institutional_students(id, display_name) VALUES ('est-b32-1', 'E1'), ('est-b32-2', 'E2');

  -- 14. ACL / DML direto / search_path ------------------------------------------
  IF has_table_privilege('authenticated', 'public.class_enrollment_episodes', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_allocation_ending_versions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_enrollment_episodes', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.class_allocation_ending_versions', 'DELETE')
    OR has_table_privilege('anon', 'public.class_enrollment_episodes', 'INSERT')
  THEN RAISE EXCEPTION 'b32:direct-dml-present'; END IF;
  IF has_function_privilege('anon', sig9, 'EXECUTE') OR has_function_privilege('anon', sig7, 'EXECUTE')
    OR NOT has_function_privilege('authenticated', sig9, 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.b3_enrollment_ending_head(text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.b3_participation_head(text)', 'EXECUTE')
  THEN RAISE EXCEPTION 'b32:acl'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = sig9::regprocedure AND prosecdef AND proconfig @> ARRAY['search_path=""'])
    OR EXISTS (SELECT 1 FROM pg_proc WHERE oid = sig7::regprocedure AND prosecdef)
  THEN RAISE EXCEPTION 'b32:search-path-or-definer'; END IF;
  ok := ok || ' acl-dml';

  PERFORM set_config('role', 'authenticated', true);

  -- 11. Sem sessão -----------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-lim', 'x', '2026-02-01', 'ato', NULL, NULL, '2026-03-01', NULL);
    RAISE EXCEPTION 'b32:no-session-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:session-required%' THEN RAISE; END IF; END;
  ok := ok || ' sem-sessao';

  -- Turmas, inscrições, participações -----------------------------------------
  PERFORM set_config('request.jwt.claims', u_sec, true);
  cls_a := public.register_institutional_class('esc-b32-a', 'ano-b32', 'A', 'Turma A', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  cls_short := public.register_institutional_class('esc-b32-a', 'ano-b32', 'S', 'Turma S', 'ativa', '2026-01-01', '2026-06-30', 'ato-t');
  cls_y := public.register_institutional_class('esc-b32-a', 'ano-b32-y', 'Y', 'Turma Y', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  cls_b := public.register_institutional_class('esc-b32-b', 'ano-b32', 'B', 'Turma B', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  PERFORM public.constitute_cycle_enrollment('m-1', 'est-b32-1', 'esc-b32-a', 'ano-b32', '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-2', 'est-b32-2', 'esc-b32-a', 'ano-b32', '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM set_config('request.jwt.claims', u_cat, true);
  PERFORM public.record_attribute_value_version('natureza-da-participacao-educacional', 'nat-b32', NULL, 'Natureza de teste', 'homologada', '2020-01-01', 'ato-teste', NULL);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  PERFORM public.declare_cycle_participation('p-open', NULL, 'm-1', 'nat-b32', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.declare_cycle_participation('p-lim', NULL, 'm-2', 'nat-b32', 1, '2026-02-01', '2026-05-31', 'ato', NULL);

  -- 12. Autenticado sem capability ---------------------------------------------
  PERFORM set_config('request.jwt.claims', u_none, true);
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-lim', cls_a, '2026-02-01', 'ato', NULL, NULL, '2026-03-01', NULL);
    RAISE EXCEPTION 'b32:no-capability-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:capability-missing%' THEN RAISE; END IF; END;
  ok := ok || ' sem-capability';
  PERFORM set_config('request.jwt.claims', u_sec, true);

  -- 1. Pai aberto + alocação aberta (pela assinatura antiga também) -------------
  PERFORM public.record_class_allocation('a-1', 'p-open', cls_a, '2026-02-01', 'ato', NULL, NULL);
  IF pg_temp.b32_end('a-1') IS NOT NULL THEN RAISE EXCEPTION 'b32:implicit-ending'; END IF;
  ok := ok || ' pai-aberto-filho-aberto';

  -- Pai limitado sem término explícito continua recusado ------------------------
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-lim', cls_a, '2026-02-01', 'ato', NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'b32:open-under-bounded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:open-beyond-participation%' THEN RAISE; END IF; END;
  ok := ok || ' pai-limitado-exige-termino';

  -- 4. Filho termina depois do pai ---------------------------------------------
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-lim', cls_a, '2026-02-01', 'ato', NULL, NULL, '2026-06-15', 'm');
    RAISE EXCEPTION 'b32:after-parent';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:outside-participation%' THEN RAISE; END IF; END;
  -- 5. Filho começa antes do pai
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-lim', cls_a, '2026-01-15', 'ato', NULL, NULL, '2026-02-10', 'm');
    RAISE EXCEPTION 'b32:before-parent';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:outside-participation%' THEN RAISE; END IF; END;
  -- 6. Término antes do início
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-lim', cls_a, '2026-03-10', 'ato', NULL, NULL, '2026-03-01', 'm');
    RAISE EXCEPTION 'b32:reversed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:ending-before-start%' THEN RAISE; END IF; END;
  -- 7. Turma inativa em parte da janela
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-open', cls_short, '2026-03-01', 'ato', NULL, NULL, '2026-08-31', 'm');
    RAISE EXCEPTION 'b32:class-partially-inactive';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:class-inactive-on-date%' THEN RAISE; END IF; END;
  -- 8. Outra escola / 9. outro ano
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-lim', cls_b, '2026-02-01', 'ato', NULL, NULL, '2026-03-01', 'm');
    RAISE EXCEPTION 'b32:other-school';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:class-other-school%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-lim', cls_y, '2026-02-01', 'ato', NULL, NULL, '2026-03-01', 'm');
    RAISE EXCEPTION 'b32:other-year';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:academic-year-mismatch%' THEN RAISE; END IF; END;
  ok := ok || ' rejeicoes-janela-turma-escola-ano';
  IF EXISTS (SELECT 1 FROM public.class_enrollment_episodes WHERE id = 'a-x')
    OR EXISTS (SELECT 1 FROM public.class_allocation_ending_versions WHERE allocation_logical_id = 'a-x')
  THEN RAISE EXCEPTION 'b32:partial-write-on-rejection'; END IF;

  -- 2. Pai limitado + filho limitado dentro (início e término atômicos) ----------
  PERFORM public.record_class_allocation('a-2', 'p-lim', cls_a, '2026-02-15', 'ato-2', NULL, NULL, '2026-04-30', 'motivo');
  SELECT id INTO end1 FROM public.class_allocation_ending_versions WHERE allocation_logical_id = 'a-2';
  IF end1 IS NULL OR pg_temp.b32_end('a-2') <> '2026-04-30'
    OR (SELECT version FROM public.class_allocation_ending_versions WHERE id = end1) <> 1
    OR (SELECT recorded_by FROM public.class_allocation_ending_versions WHERE id = end1) <> '00000000-0000-0000-0000-0000000b3201'
    OR (SELECT count(*) FROM public.class_allocations_at('esc-b32-a', cls_a, '2026-03-01')) <> 2
    OR (SELECT count(*) FROM public.class_allocations_at('esc-b32-a', cls_a, '2026-05-10')) <> 1
  THEN RAISE EXCEPTION 'b32:bounded-inside'; END IF;
  ok := ok || ' pai-limitado-filho-limitado-atomico';

  -- 10. Segunda alocação vigente continua proibida ------------------------------
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-lim', cls_short, '2026-03-01', 'ato', NULL, NULL, '2026-03-31', 'm');
    RAISE EXCEPTION 'b32:second-allocation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:cardinality-policy-absent%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_allocation('a-x', 'p-open', cls_short, '2026-03-01', 'ato', NULL, NULL, '2026-03-31', 'm');
    RAISE EXCEPTION 'b32:second-allocation-open';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:cardinality-policy-absent%' THEN RAISE; END IF; END;
  ok := ok || ' cardinalidade-preservada';

  -- 3. Filho termina exatamente no valid_until do pai ---------------------------
  PERFORM public.record_class_allocation('a-3', 'p-lim', cls_short, '2026-05-01', 'ato', NULL, NULL, '2026-05-31', 'motivo');
  IF pg_temp.b32_end('a-3') <> '2026-05-31' THEN RAISE EXCEPTION 'b32:exact-end'; END IF;
  ok := ok || ' termino-igual-ao-pai';

  -- 13. Histórico append-only ----------------------------------------------------
  PERFORM public.record_class_allocation_ending('a-2', end1, '2026-04-20', 'motivo', 'ato', 'data correta');
  IF (SELECT count(*) FROM public.class_allocation_ending_versions WHERE allocation_logical_id = 'a-2') <> 2
    OR (SELECT ended_on FROM public.class_allocation_ending_versions WHERE id = end1) <> '2026-04-30'
    OR pg_temp.b32_end('a-2') <> '2026-04-20'
  THEN RAISE EXCEPTION 'b32:append-only'; END IF;
  BEGIN PERFORM public.record_class_allocation_ending('a-2', end1, '2026-04-25', 'motivo', 'ato', 'base velha');
    RAISE EXCEPTION 'b32:stale-base';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation-ending:base-superseded%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_allocation('a-4', 'p-lim', cls_a, '2026-05-01', 'ato', 'a-3', 'corr', '2026-05-20', 'm');
    RAISE EXCEPTION 'b32:ending-on-correction';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%allocation:ending-on-correction-unsupported%' THEN RAISE; END IF; END;
  ok := ok || ' append-only';

  RAISE EXCEPTION 'b32-tests-ok:%', ok;
END $b32t$;
