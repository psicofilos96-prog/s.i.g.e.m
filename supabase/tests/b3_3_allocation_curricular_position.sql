-- B3.3 — Posição curricular individual da alocação.
-- Execução real no banco, numa transação descartada: o bloco termina com RAISE, então
-- nenhum fixture permanece. Sucesso = erro final 'b33-tests-ok: ...'; qualquer outro erro é falha.
DO $b33t$
DECLARE
  u_sec text := '{"sub":"00000000-0000-0000-0000-0000000b3301","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-0000000b3303","role":"authenticated"}';
  pol uuid := '00000000-0000-0000-0000-0000000b33a0';
  sigw text := 'public.record_allocation_curricular_position(text,uuid,text,date,date,jsonb,text,text,boolean)';
  sigr text := 'public.allocation_curricular_positions_at(text,text,date,timestamptz)';
  cls_a text; cls_b text; v1 uuid; v2 uuid; v3 uuid; t_before timestamptz; n integer; r record;
  ax_e jsonb := jsonb_build_array(jsonb_build_object('scheme', 'eixo-b33-a', 'value', 'val-1', 'version', 1));
  ax_f jsonb := jsonb_build_array(jsonb_build_object('scheme', 'eixo-b33-a', 'value', 'val-2', 'version', 1),
                                  jsonb_build_object('scheme', 'eixo-b33-b', 'value', 'val-x', 'version', 1));
  ok text := '';
BEGIN
  -- Fixture (privilegiado) ------------------------------------------------
  INSERT INTO public.institutional_persons(id, display_name)
  SELECT ('00000000-0000-0000-0000-0000000b33' || lpad(i::text, 2, '0'))::uuid, 'Pessoa ' || i FROM generate_series(91, 93) i;
  INSERT INTO public.user_person_links(user_id, person_id)
  SELECT ('00000000-0000-0000-0000-0000000b33' || lpad(i::text, 2, '0'))::uuid,
         ('00000000-0000-0000-0000-0000000b33' || lpad((i + 90)::text, 2, '0'))::uuid FROM generate_series(1, 3) i;
  INSERT INTO public.institutional_schools(id) VALUES ('esc-b33-a'), ('esc-b33-b');
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
  VALUES ('esc-b33-a', 1, 'Escola A', true, '2020-01-01', 'ato'), ('esc-b33-b', 1, 'Escola B', true, '2020-01-01', 'ato');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    ('00000000-0000-0000-0000-0000000b3391', 'secretaria-escolar', 'escola', 'esc-b33-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b3393', 'teste-b33-nada', 'escola', 'esc-b33-a', '2020-01-01');
  INSERT INTO public.institutional_academic_years(id) VALUES ('ano-b33');
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  SELECT 'ano-b33', 1, 'Ano', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato',
    '00000000-0000-0000-0000-0000000b3301', '00000000-0000-0000-0000-0000000b3391', e.id
  FROM (SELECT id FROM public.institutional_engagements WHERE person_id = '00000000-0000-0000-0000-0000000b3391' LIMIT 1) e;
  INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b33', 1, 'draft', '2020-01-01');
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']),
    (pol, 'secretaria-escolar', 'manter-matricula-e-enturmacao', ARRAY['school']),
    (pol, 'secretaria-escolar', 'consultar-matricula-e-movimentacao', ARRAY['school']);
  UPDATE public.capability_policies SET status = 'homologated' WHERE id = pol;
  INSERT INTO public.institutional_students(id, display_name) VALUES ('est-b33-1', 'E1'), ('est-b33-2', 'E2');
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status, homologation_act_ref, valid_from)
  VALUES ('natureza-da-participacao-educacional', 'nat-b33', 1, 'Natureza teste', 'homologada', 'ato', '2020-01-01');

  -- ACL / DML direto / definer ---------------------------------------------
  IF has_table_privilege('authenticated', 'public.allocation_curricular_positions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.allocation_curricular_position_axes', 'INSERT')
    OR has_table_privilege('authenticated', 'public.allocation_curricular_positions', 'UPDATE')
    OR has_table_privilege('anon', 'public.allocation_curricular_positions', 'SELECT')
    OR has_function_privilege('anon', sigw, 'EXECUTE') OR has_function_privilege('anon', sigr, 'EXECUTE')
    OR NOT has_function_privilege('authenticated', sigw, 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.b33_value_homologated_throughout(text,text,integer,date,date)', 'EXECUTE')
  THEN RAISE EXCEPTION 'b33:acl'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = sigw::regprocedure AND prosecdef AND proconfig @> ARRAY['search_path=""'])
    OR EXISTS (SELECT 1 FROM pg_proc WHERE oid = sigr::regprocedure AND prosecdef)
  THEN RAISE EXCEPTION 'b33:definer'; END IF;
  ok := ok || ' acl';

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.record_allocation_curricular_position('pos-x', NULL, 'a-1', '2026-02-01', NULL, ax_e, 'ato', NULL);
    RAISE EXCEPTION 'b33:no-session';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:session-required%' THEN RAISE; END IF; END;
  ok := ok || ' sem-sessao';

  PERFORM set_config('request.jwt.claims', u_sec, true);
  cls_a := public.register_institutional_class('esc-b33-a', 'ano-b33', 'A', 'Turma A', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  PERFORM public.constitute_cycle_enrollment('m-1', 'est-b33-1', 'esc-b33-a', 'ano-b33', '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-2', 'est-b33-2', 'esc-b33-a', 'ano-b33', '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.declare_cycle_participation('p-1', NULL, 'm-1', 'nat-b33', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.declare_cycle_participation('p-2', NULL, 'm-2', 'nat-b33', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.record_class_allocation('a-1', 'p-1', cls_a, '2026-02-01', 'ato', NULL, NULL);
  PERFORM public.record_class_allocation('a-2', 'p-2', cls_a, '2026-02-01', 'ato', NULL, NULL, '2026-06-30', 'm');

  -- Catálogo vazio: fail-closed -------------------------------------------
  BEGIN PERFORM public.record_allocation_curricular_position('pos-1', NULL, 'a-1', '2026-02-01', NULL, ax_e, 'ato', NULL);
    RAISE EXCEPTION 'b33:empty-catalog-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:value-not-homologated%' THEN RAISE; END IF; END;
  ok := ok || ' catalogo-vazio-recusa';

  RESET ROLE;
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status, homologation_act_ref, valid_from) VALUES
    ('eixo-b33-a', 'val-1', 1, 'V1', 'homologada', 'ato', '2020-01-01'),
    ('eixo-b33-a', 'val-2', 1, 'V2', 'homologada', 'ato', '2020-01-01'),
    ('eixo-b33-b', 'val-x', 1, 'VX', 'homologada', 'ato', '2020-01-01'),
    ('eixo-b33-b', 'val-y', 1, 'VY', 'homologada', 'ato', '2020-01-01'),
    ('eixo-b33-b', 'val-y', 2, 'VY', 'rascunho', 'ato-rev', '2026-04-01');
  PERFORM set_config('role', 'authenticated', true);

  -- Sem capability ----------------------------------------------------------
  PERFORM set_config('request.jwt.claims', u_none, true);
  BEGIN PERFORM public.record_allocation_curricular_position('pos-1', NULL, 'a-1', '2026-02-01', NULL, ax_e, 'ato', NULL);
    RAISE EXCEPTION 'b33:no-capability';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:capability-missing%' THEN RAISE; END IF; END;
  ok := ok || ' sem-capability';
  PERFORM set_config('request.jwt.claims', u_sec, true);

  -- Rejeições de forma/janela ------------------------------------------------
  BEGIN PERFORM public.record_allocation_curricular_position('pos-x', NULL, 'a-1', '2026-01-15', NULL, ax_e, 'ato', NULL);
    RAISE EXCEPTION 'b33:before-allocation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:outside-allocation%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_allocation_curricular_position('pos-x', NULL, 'a-2', '2026-03-01', NULL, ax_e, 'ato', NULL);
    RAISE EXCEPTION 'b33:open-beyond-ended-allocation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:outside-allocation%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_allocation_curricular_position('pos-x', NULL, 'a-1', '2026-02-01', NULL, '[]'::jsonb, 'ato', NULL);
    RAISE EXCEPTION 'b33:no-axes';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:axes-required%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_allocation_curricular_position('pos-x', NULL, 'a-1', '2026-02-01', NULL,
      jsonb_build_array(jsonb_build_object('scheme', 'eixo-b33-a', 'value', 'val-1', 'version', 1),
                        jsonb_build_object('scheme', 'eixo-b33-a', 'value', 'val-2', 'version', 1)), 'ato', NULL);
    RAISE EXCEPTION 'b33:dup-axis';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:axis-duplicated%' THEN RAISE; END IF; END;
  -- Valor revogado no meio da janela
  BEGIN PERFORM public.record_allocation_curricular_position('pos-x', NULL, 'a-1', '2026-02-01', '2026-05-31',
      jsonb_build_array(jsonb_build_object('scheme', 'eixo-b33-b', 'value', 'val-y', 'version', 1)), 'ato', NULL);
    RAISE EXCEPTION 'b33:revoked-mid-window';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:value-not-homologated%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_allocation_curricular_position('pos-x', NULL, 'a-inexistente', '2026-02-01', NULL, ax_e, 'ato', NULL);
    RAISE EXCEPTION 'b33:unknown-allocation';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:allocation-unknown%' THEN RAISE; END IF; END;
  ok := ok || ' rejeicoes';

  -- Ausência explícita antes de qualquer posição ----------------------------
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.allocation_curricular_positions) AND
     EXISTS (SELECT 1 FROM public.allocation_curricular_positions WHERE position_logical_id = 'pos-x')
  THEN RAISE EXCEPTION 'b33:partial-write'; END IF;
  SELECT count(*) INTO n FROM public.allocation_curricular_positions_at('esc-b33-a', cls_a, '2026-03-01') WHERE position_version_id IS NULL;
  IF n <> 2 THEN RAISE EXCEPTION 'b33:absence-not-explicit (%)', n; END IF;
  ok := ok || ' ausencia-explicita';
  PERFORM set_config('role', 'authenticated', true);

  -- Posições sucessivas na mesma alocação ------------------------------------
  v1 := public.record_allocation_curricular_position('pos-1', NULL, 'a-1', '2026-02-01', '2026-05-31', ax_e, 'ato-1', NULL);
  v2 := public.record_allocation_curricular_position('pos-2', NULL, 'a-1', '2026-06-01', NULL, ax_f, 'ato-2', NULL);
  BEGIN PERFORM public.record_allocation_curricular_position('pos-3', NULL, 'a-1', '2026-05-15', '2026-06-15', ax_e, 'ato', NULL);
    RAISE EXCEPTION 'b33:overlap-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:overlap%' THEN RAISE; END IF; END;
  RESET ROLE;
  SELECT * INTO r FROM public.allocation_curricular_positions_at('esc-b33-a', cls_a, '2026-03-01') WHERE allocation_logical_id = 'a-1';
  IF r.position_logical_id <> 'pos-1' OR r.axes <> ax_e THEN RAISE EXCEPTION 'b33:read-first'; END IF;
  SELECT * INTO r FROM public.allocation_curricular_positions_at('esc-b33-a', cls_a, '2026-07-01') WHERE allocation_logical_id = 'a-1';
  IF r.position_logical_id <> 'pos-2' OR jsonb_array_length(r.axes) <> 2 THEN RAISE EXCEPTION 'b33:read-second'; END IF;
  ok := ok || ' sucessivas sem-sobreposicao';
  t_before := clock_timestamp();
  PERFORM pg_sleep(0.01);
  PERFORM set_config('role', 'authenticated', true);

  -- Correção append-only com base esperada ----------------------------------
  BEGIN PERFORM public.record_allocation_curricular_position('pos-1', v1, 'a-1', '2026-02-01', '2026-05-31', ax_f, 'ato', NULL);
    RAISE EXCEPTION 'b33:no-reason';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:correction-reason-required%' THEN RAISE; END IF; END;
  v3 := public.record_allocation_curricular_position('pos-1', v1, 'a-1', '2026-02-01', '2026-05-31', ax_f, 'ato-c', 'erro de registro');
  BEGIN PERFORM public.record_allocation_curricular_position('pos-1', v1, 'a-1', '2026-02-01', '2026-05-31', ax_e, 'ato', 'base velha');
    RAISE EXCEPTION 'b33:stale-base';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:base-superseded%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_allocation_curricular_position('pos-1', v3, 'a-2', '2026-02-01', '2026-05-31', ax_f, 'ato', 'mover');
    RAISE EXCEPTION 'b33:allocation-moved';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:allocation-immutable%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_allocation_curricular_position('pos-1', NULL, 'a-1', '2026-02-01', '2026-05-31', ax_e, 'ato', NULL);
    RAISE EXCEPTION 'b33:logical-reused';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%position:logical-exists%' THEN RAISE; END IF; END;
  RESET ROLE;
  BEGIN UPDATE public.allocation_curricular_positions SET valid_until = NULL WHERE id = v1;
    RAISE EXCEPTION 'b33:mutable';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%imutável%' THEN RAISE; END IF; END;
  IF (SELECT version FROM public.allocation_curricular_positions WHERE id = v3) <> 2
    OR (SELECT count(*) FROM public.allocation_curricular_position_axes WHERE position_version_id = v1) <> 1 THEN
    RAISE EXCEPTION 'b33:append-only'; END IF;
  -- knownAt: consulta anterior à correção continua vendo a versão original
  SELECT * INTO r FROM public.allocation_curricular_positions_at('esc-b33-a', cls_a, '2026-03-01', t_before) WHERE allocation_logical_id = 'a-1';
  IF r.position_version_id <> v1 THEN RAISE EXCEPTION 'b33:knownat-rewritten'; END IF;
  SELECT * INTO r FROM public.allocation_curricular_positions_at('esc-b33-a', cls_a, '2026-03-01') WHERE allocation_logical_id = 'a-1';
  IF r.position_version_id <> v3 THEN RAISE EXCEPTION 'b33:correction-not-visible'; END IF;
  ok := ok || ' correcao-append-only knownat imutavel';
  PERFORM set_config('role', 'authenticated', true);

  -- Anulação ----------------------------------------------------------------
  PERFORM public.record_allocation_curricular_position('pos-2', v2, 'a-1', NULL, NULL, NULL, 'ato-a', 'registrado por engano', true);
  RESET ROLE;
  SELECT * INTO r FROM public.allocation_curricular_positions_at('esc-b33-a', cls_a, '2026-07-01') WHERE allocation_logical_id = 'a-1';
  IF r.position_version_id IS NOT NULL THEN RAISE EXCEPTION 'b33:annul'; END IF;
  ok := ok || ' anulacao';

  -- Posição limitada pelo término da alocação; nunca vista fora dela --------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.record_allocation_curricular_position('pos-a2', NULL, 'a-2', '2026-02-01', '2026-06-30', ax_e, 'ato', NULL);
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.allocation_curricular_positions_at('esc-b33-a', cls_a, '2026-07-15') WHERE allocation_logical_id = 'a-2') THEN
    RAISE EXCEPTION 'b33:outside-allocation-visible'; END IF;
  ok := ok || ' limitada-pela-alocacao';

  -- RLS: sem capability de leitura, nada é visível ---------------------------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_none, true);
  SELECT count(*) INTO n FROM public.allocation_curricular_positions;
  IF n <> 0 THEN RAISE EXCEPTION 'b33:rls-leak'; END IF;
  PERFORM set_config('request.jwt.claims', u_sec, true);
  SELECT count(*) INTO n FROM public.allocation_curricular_positions;
  IF n = 0 THEN RAISE EXCEPTION 'b33:rls-blocks-authorized'; END IF;
  RESET ROLE;
  ok := ok || ' rls';

  RAISE EXCEPTION 'b33-tests-ok:%', ok;
END $b33t$;
