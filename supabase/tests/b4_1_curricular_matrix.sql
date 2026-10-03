-- B4.1 — Matriz curricular canônica. Execução real no banco, numa transação descartada:
-- o bloco termina com RAISE, então nenhum fixture permanece.
-- Sucesso = erro final 'b41-tests-ok: ...'; qualquer outro erro é falha.
DO $b41t$
DECLARE
  u_ped text := '{"sub":"00000000-0000-0000-0000-0000000b4101","role":"authenticated"}';
  u_cad text := '{"sub":"00000000-0000-0000-0000-0000000b4102","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-0000000b4103","role":"authenticated"}';
  pol uuid := '00000000-0000-0000-0000-0000000b41a0';
  w text := 'public.record_curricular_matrix_version(text,uuid,text,text,date,date,text,text,jsonb,jsonb)';
  c1 text; c2 text; c3 text; r jsonb; r2 jsonb; r3 jsonb; m text; v1 uuid; v2 uuid;
  t0 timestamptz; t1 timestamptz; t2 timestamptz; n integer; s text; ok text := '';
BEGIN
  -- Fixture (privilegiado) ------------------------------------------------
  INSERT INTO public.institutional_persons(id, display_name)
  SELECT ('00000000-0000-0000-0000-0000000b41' || lpad(i::text, 2, '0'))::uuid, 'Pessoa ' || i FROM generate_series(91, 93) i;
  INSERT INTO public.user_person_links(user_id, person_id)
  SELECT ('00000000-0000-0000-0000-0000000b41' || lpad(i::text, 2, '0'))::uuid,
         ('00000000-0000-0000-0000-0000000b41' || lpad((i + 90)::text, 2, '0'))::uuid FROM generate_series(1, 3) i;
  INSERT INTO public.institutional_schools(id) VALUES ('esc-b41-a');
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
  VALUES ('esc-b41-a', 1, 'Escola A', true, '2020-01-01', 'ato');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    ('00000000-0000-0000-0000-0000000b4191', 'gestao-pedagogica-da-rede', 'rede', NULL, '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b4192', 'cadastro-institucional-da-rede', 'rede', NULL, '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b4193', 'cadastro-institucional-da-rede', 'rede', NULL, '2020-01-01');
  INSERT INTO public.institutional_academic_years(id) VALUES ('ano-b41');
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  SELECT 'ano-b41', 1, 'Ano', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato',
    '00000000-0000-0000-0000-0000000b4102', '00000000-0000-0000-0000-0000000b4192', e.id
  FROM public.institutional_engagements e WHERE e.person_id = '00000000-0000-0000-0000-0000000b4192';
  -- Política temporária homologada (some no rollback). Pessoa 93 é cadastro: NÃO tem a capability da matriz.
  INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b41', 1, 'draft', '2020-01-01');
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'gestao-pedagogica-da-rede', 'manter-matrizes-curriculares', ARRAY['network']),
    (pol, 'cadastro-institucional-da-rede', 'manter-componentes-curriculares', ARRAY['network']),
    (pol, 'cadastro-institucional-da-rede', 'manter-catalogos-institucionais', ARRAY['network']);
  UPDATE public.capability_policies SET status = 'homologated' WHERE id = pol;

  -- ACL / DML direto / definer ---------------------------------------------
  IF has_table_privilege('authenticated', 'public.curricular_matrix_versions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.curricular_matrix_items', 'INSERT')
    OR has_table_privilege('authenticated', 'public.curricular_matrix_applicability', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.institutional_curricular_matrices', 'DELETE')
    OR has_table_privilege('anon', 'public.curricular_matrix_versions', 'SELECT')
  THEN RAISE EXCEPTION 'b41:direct-dml-present'; END IF;
  IF has_function_privilege('anon', w, 'EXECUTE')
    OR has_function_privilege('anon', 'public.curricular_matrices_at(date,timestamptz)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.curricular_matrix_items_at(text,date,timestamptz)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', w, 'EXECUTE')
    OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
       WHERE ns.nspname = 'public' AND p.proname IN ('record_curricular_matrix_version','curricular_matrices_at','curricular_matrix_items_at','curricular_matrix_applicability_at')
         AND (p.proacl IS NULL OR array_to_string(p.proacl, ',') ~ '(^|,)=X'))
  THEN RAISE EXCEPTION 'b41:acl'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = w::regprocedure AND prosecdef AND proconfig @> ARRAY['search_path=""'])
    OR EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.curricular_matrices_at(date,timestamptz)'::regprocedure AND prosecdef)
  THEN RAISE EXCEPTION 'b41:search-path-or-definer'; END IF;
  ok := ok || ' acl-dml';

  PERFORM set_config('role', 'authenticated', true);

  -- Sem sessão --------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[]');
    RAISE EXCEPTION 'b41:no-session-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:session-required%' THEN RAISE; END IF; END;
  ok := ok || ' sem-sessao';

  -- Componentes (B2.3) pelo writer próprio ------------------------------------
  PERFORM set_config('request.jwt.claims', u_cad, true);
  c1 := public.register_curricular_component_version(NULL, NULL, 'Componente Um', NULL, true, '2020-01-01', NULL, 'ato-c');
  c2 := public.register_curricular_component_version(NULL, NULL, 'Componente Dois', NULL, true, '2020-01-01', NULL, 'ato-c');
  c3 := public.register_curricular_component_version(NULL, NULL, 'Componente Três', NULL, true, '2020-01-01', NULL, 'ato-c');
  PERFORM public.register_curricular_component_version(c3,
    (SELECT id FROM public.curricular_component_versions WHERE component_id = c3), 'Componente Três', NULL, false, '2026-07-01', 'inativação', 'ato-c');

  -- Sem capability: cadastro de rede NÃO mantém matriz -------------------------
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[]');
    RAISE EXCEPTION 'b41:cadastro-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capability:manter-matrizes-curriculares%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', u_none, true);
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[]');
    RAISE EXCEPTION 'b41:no-capability-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capability:manter-matrizes-curriculares%' THEN RAISE; END IF; END;
  ok := ok || ' sem-capability';

  -- Referências inexistentes / inválidas -------------------------------------
  PERFORM set_config('request.jwt.claims', u_ped, true);
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[{"component":"comp-nao-existe"}]', '[]');
    RAISE EXCEPTION 'b41:missing-component-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:component-not-found%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', jsonb_build_array(jsonb_build_object('component', c3)), '[]');
    RAISE EXCEPTION 'b41:inactive-component-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:component-inactive-in-validity%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[{"dimension":"ano-letivo","id":"ano-inexistente"}]');
    RAISE EXCEPTION 'b41:missing-year-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:academic-year-not-found%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[{"dimension":"escola","id":"esc-inexistente"}]');
    RAISE EXCEPTION 'b41:missing-school-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:school-not-found%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[{"dimension":"atributo","scheme":"qualquer","value":"x","version":1}]');
    RAISE EXCEPTION 'b41:unhomologated-applicability-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:applicability-value-not-homologated%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[{"element":{"scheme":"elemento-de-matriz-curricular","value":"x","version":1}}]', '[]');
    RAISE EXCEPTION 'b41:unhomologated-element-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:item-element-not-homologated%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', '2025-12-31', NULL, 'ato', '[]', '[]');
    RAISE EXCEPTION 'b41:ends-before-start-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:ends-before-start%' THEN RAISE; END IF; END;
  ok := ok || ' referencias';

  -- Unidade ausente/não homologada nunca vira default --------------------------
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', jsonb_build_array(jsonb_build_object('component', c1, 'quantity', 4)), '[]');
    RAISE EXCEPTION 'b41:quantity-without-unit-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:unit-required%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato',
      jsonb_build_array(jsonb_build_object('component', c1, 'quantity', 4, 'unit', jsonb_build_object('scheme','unidade-de-carga-da-matriz','value','u','version',1))), '[]');
    RAISE EXCEPTION 'b41:unhomologated-unit-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:unit-not-homologated%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato',
      jsonb_build_array(jsonb_build_object('component', c1, 'unit', jsonb_build_object('scheme','unidade-de-carga-da-matriz','value','u','version',1))), '[]');
    RAISE EXCEPTION 'b41:unit-without-quantity-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:quantity-required%' THEN RAISE; END IF; END;
  -- Valor de unidade em rascunho (não homologado) também é recusado.
  PERFORM set_config('request.jwt.claims', u_cad, true);
  PERFORM public.record_attribute_value_version('unidade-de-carga-da-matriz', 'u-teste', NULL, 'Unidade teste', 'rascunho', '2020-01-01', NULL, NULL);
  PERFORM set_config('request.jwt.claims', u_ped, true);
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato',
      jsonb_build_array(jsonb_build_object('component', c1, 'quantity', 4, 'unit', jsonb_build_object('scheme','unidade-de-carga-da-matriz','value','u-teste','version',1))), '[]');
    RAISE EXCEPTION 'b41:draft-unit-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:unit-not-homologated%' THEN RAISE; END IF; END;
  ok := ok || ' unidade-fail-closed';

  -- Constituição válida -------------------------------------------------------
  t0 := clock_timestamp();
  r := public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'Matriz Teste', '2026-01-01', NULL, NULL, 'ato-m1',
    jsonb_build_array(jsonb_build_object('key','um','component', c1), jsonb_build_object('key','dois','component', c2)),
    '[{"dimension":"ano-letivo","id":"ano-b41"},{"dimension":"escola","id":"esc-b41-a"}]');
  m := r->>'matrix_id'; v1 := (r->>'version_id')::uuid;
  SELECT count(*), max(i.component_label_snapshot) FILTER (WHERE i.item_key = 'um') INTO n, s FROM public.curricular_matrix_items i WHERE i.matrix_version_id = v1;
  IF n <> 2 OR s <> 'Componente Um' THEN RAISE EXCEPTION 'b41:items-not-recorded'; END IF;
  IF (SELECT count(*) FROM public.curricular_matrix_applicability WHERE matrix_version_id = v1) <> 2 THEN RAISE EXCEPTION 'b41:applicability-not-recorded'; END IF;
  IF (SELECT recorded_by FROM public.curricular_matrix_versions WHERE id = v1) <> '00000000-0000-0000-0000-0000000b4101' THEN RAISE EXCEPTION 'b41:provenance'; END IF;
  ok := ok || ' constituicao';

  -- Duplicidades ---------------------------------------------------------------
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato',
      jsonb_build_array(jsonb_build_object('key','a','component', c1), jsonb_build_object('key','a','component', c2)), '[]');
    RAISE EXCEPTION 'b41:dup-key-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:item-key-duplicate%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]',
      '[{"dimension":"escola","id":"esc-b41-a"},{"dimension":"escola","id":"esc-b41-a"}]');
    RAISE EXCEPTION 'b41:dup-applicability-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:applicability-duplicate%' THEN RAISE; END IF; END;
  ok := ok || ' duplicidade';

  -- Retificação: base esperada, preserva anterior, knownAt antes/depois ------------
  t1 := clock_timestamp();
  BEGIN PERFORM public.record_curricular_matrix_version(m, NULL, 'retificacao', 'Matriz Teste R', '2026-01-01', NULL, 'erro', 'ato-r', '[]', '[]');
    RAISE EXCEPTION 'b41:stale-base-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:base-superseded%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(m, v1, 'retificacao', 'Matriz Teste R', '2026-01-01', NULL, NULL, 'ato-r', '[]', '[]');
    RAISE EXCEPTION 'b41:no-reason-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:reason-required%' THEN RAISE; END IF; END;
  r2 := public.record_curricular_matrix_version(m, v1, 'retificacao', 'Matriz Teste R', '2026-01-01', NULL, 'erro de grafia', 'ato-r',
    jsonb_build_array(jsonb_build_object('key','um','component', c1)), '[]');
  v2 := (r2->>'version_id')::uuid;
  t2 := clock_timestamp();
  BEGIN PERFORM public.record_curricular_matrix_version(m, v1, 'retificacao', 'Y', '2026-01-01', NULL, 'x', 'ato', '[]', '[]');
    RAISE EXCEPTION 'b41:old-base-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:base-superseded%' THEN RAISE; END IF; END;
  IF NOT EXISTS (SELECT 1 FROM public.curricular_matrix_versions WHERE id = v1 AND official_name = 'Matriz Teste')
    OR (SELECT count(*) FROM public.curricular_matrix_items WHERE matrix_version_id = v1) <> 2 THEN RAISE EXCEPTION 'b41:base-mutated'; END IF;
  IF EXISTS (SELECT 1 FROM public.curricular_matrices_at('2026-03-01', t0) WHERE matrix_id = m) THEN RAISE EXCEPTION 'b41:known-before-creation'; END IF;
  IF (SELECT version_id FROM public.curricular_matrices_at('2026-03-01', t1) WHERE matrix_id = m) IS DISTINCT FROM v1 THEN RAISE EXCEPTION 'b41:knownat-before-correction'; END IF;
  IF (SELECT version_id FROM public.curricular_matrices_at('2026-03-01', t2) WHERE matrix_id = m) IS DISTINCT FROM v2 THEN RAISE EXCEPTION 'b41:knownat-after-correction'; END IF;
  IF (SELECT count(*) FROM public.curricular_matrix_items_at(m, '2026-03-01', t1)) <> 2
    OR (SELECT count(*) FROM public.curricular_matrix_items_at(m, '2026-03-01', t2)) <> 1
    OR EXISTS (SELECT 1 FROM public.curricular_matrix_items_at(m, '2026-03-01', t2) WHERE version_id <> v2)
    OR (SELECT count(*) FROM public.curricular_matrix_applicability_at(m, '2026-03-01', t1)) <> 2
    OR (SELECT count(*) FROM public.curricular_matrix_applicability_at(m, '2026-03-01', t2)) <> 0
  THEN RAISE EXCEPTION 'b41:items-wrong-version'; END IF;
  ok := ok || ' retificacao-knownat';

  -- Sucessão e validOn antes/durante/depois ---------------------------------------
  BEGIN PERFORM public.record_curricular_matrix_version(m, v2, 'sucessao', 'S', '2026-01-01', NULL, 'nova', 'ato', '[]', '[]');
    RAISE EXCEPTION 'b41:succession-same-start-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:succession-must-start-after-base%' THEN RAISE; END IF; END;
  r3 := public.record_curricular_matrix_version(m, v2, 'sucessao', 'Matriz Teste 2027', '2027-01-01', '2027-12-31', 'nova vigência', 'ato-s',
    jsonb_build_array(jsonb_build_object('key','dois','component', c2)), '[]');
  IF EXISTS (SELECT 1 FROM public.curricular_matrices_at('2025-12-31', clock_timestamp()) WHERE matrix_id = m) THEN RAISE EXCEPTION 'b41:valid-before'; END IF;
  IF (SELECT version_id FROM public.curricular_matrices_at('2026-06-01', clock_timestamp()) WHERE matrix_id = m) IS DISTINCT FROM v2
    OR (SELECT effective_until FROM public.curricular_matrices_at('2026-06-01', clock_timestamp()) WHERE matrix_id = m) <> '2026-12-31'
  THEN RAISE EXCEPTION 'b41:valid-during'; END IF;
  IF (SELECT version_id FROM public.curricular_matrices_at('2027-06-01', clock_timestamp()) WHERE matrix_id = m) IS DISTINCT FROM (r3->>'version_id')::uuid THEN RAISE EXCEPTION 'b41:valid-successor'; END IF;
  IF EXISTS (SELECT 1 FROM public.curricular_matrices_at('2028-01-01', clock_timestamp()) WHERE matrix_id = m) THEN RAISE EXCEPTION 'b41:valid-after'; END IF;
  ok := ok || ' validon';

  -- Data/conhecimento ausentes falham fechado; cada data tem no máximo uma versão --------
  BEGIN PERFORM public.curricular_matrices_at(NULL, clock_timestamp()); RAISE EXCEPTION 'b41:null-on';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:valid-on-required%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.curricular_matrices_at('2026-01-01', NULL); RAISE EXCEPTION 'b41:null-known';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:known-at-required%' THEN RAISE; END IF; END;
  IF EXISTS (SELECT d FROM generate_series('2025-06-01'::date, '2028-06-01'::date, '7 days') d
             WHERE (SELECT count(*) FROM public.curricular_matrices_at(d::date, clock_timestamp()) x WHERE x.matrix_id = m) > 1)
  THEN RAISE EXCEPTION 'b41:ambiguous-window'; END IF;
  ok := ok || ' fail-closed-reader';

  -- Append-only mesmo para o dono ----------------------------------------------
  PERFORM set_config('role', 'postgres', true);
  BEGIN UPDATE public.curricular_matrix_versions SET official_name = 'Z' WHERE id = v1; RAISE EXCEPTION 'b41:update-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'b41:%' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.curricular_matrix_items WHERE matrix_version_id = v1; RAISE EXCEPTION 'b41:delete-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'b41:%' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'authenticated', true);
  BEGIN INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
    VALUES (m, 9, 'constituicao', 'Z', '2026-01-01', 'a', gen_random_uuid(), gen_random_uuid()); RAISE EXCEPTION 'b41:direct-insert-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'b41:%' THEN RAISE; END IF; END;
  ok := ok || ' append-only';

  RAISE EXCEPTION 'b41-tests-ok:%', ok;
END $b41t$;
