-- B4.1.2 — Quadro genérico da matriz (linhas × colunas × células). Execução real, transação descartada:
-- termina com RAISE 'b412-tests-ok: ...'; qualquer outro erro é falha. Formas inspiradas na estrutura
-- dos anexos (colunas aninhadas, X, --, *, números, totais, notas), com rótulos FICTÍCIOS — nenhum
-- conteúdo da deliberação é transcrito aqui.
DO $b412t$
DECLARE
  u_ped text := '{"sub":"00000000-0000-0000-0000-0000000b4121","role":"authenticated"}';
  u_cad text := '{"sub":"00000000-0000-0000-0000-0000000b4122","role":"authenticated"}';
  pol uuid := '00000000-0000-0000-0000-0000000b412a';
  w11 text := 'public.record_curricular_matrix_version(text,uuid,text,text,date,date,text,text,jsonb,jsonb,jsonb)';
  rd text := 'public.curricular_matrix_layout_at(text,date,timestamptz)';
  c1 text; c2 text; r jsonb; r2 jsonb; m text; v1 uuid; t1 timestamptz; L jsonb; L2 jsonb; ok text := '';
  items jsonb; lay jsonb; tbl text;
BEGIN
  INSERT INTO public.institutional_persons(id, display_name) VALUES
    ('00000000-0000-0000-0000-0000000b4191', 'P1'), ('00000000-0000-0000-0000-0000000b4192', 'P2');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES
    ('00000000-0000-0000-0000-0000000b4121', '00000000-0000-0000-0000-0000000b4191'),
    ('00000000-0000-0000-0000-0000000b4122', '00000000-0000-0000-0000-0000000b4192');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    ('00000000-0000-0000-0000-0000000b4191', 'gestao-pedagogica-da-rede', 'rede', NULL, '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b4192', 'cadastro-institucional-da-rede', 'rede', NULL, '2020-01-01');
  INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b412', 1, 'draft', '2020-01-01');
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'gestao-pedagogica-da-rede', 'manter-matrizes-curriculares', ARRAY['network']),
    (pol, 'cadastro-institucional-da-rede', 'manter-componentes-curriculares', ARRAY['network']);
  UPDATE public.capability_policies SET status = 'homologated' WHERE id = pol;

  -- ACL --------------------------------------------------------------------------
  FOREACH tbl IN ARRAY ARRAY['curricular_matrix_layouts','curricular_matrix_layout_columns','curricular_matrix_layout_groups',
      'curricular_matrix_layout_rows','curricular_matrix_layout_cells','curricular_matrix_layout_notes'] LOOP
    IF has_table_privilege('authenticated', 'public.' || tbl, 'INSERT') OR has_table_privilege('authenticated', 'public.' || tbl, 'UPDATE')
      OR has_table_privilege('authenticated', 'public.' || tbl, 'DELETE') OR has_table_privilege('anon', 'public.' || tbl, 'SELECT')
      OR NOT has_table_privilege('authenticated', 'public.' || tbl, 'SELECT')
      OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || tbl)::regclass)
    THEN RAISE EXCEPTION 'b412:acl-table %', tbl; END IF;
  END LOOP;
  IF has_function_privilege('anon', w11, 'EXECUTE') OR has_function_privilege('anon', rd, 'EXECUTE')
    OR NOT has_function_privilege('authenticated', w11, 'EXECUTE') OR NOT has_function_privilege('authenticated', rd, 'EXECUTE')
    OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = w11::regprocedure AND prosecdef AND proconfig @> ARRAY['search_path=""'])
    OR EXISTS (SELECT 1 FROM pg_proc WHERE oid = rd::regprocedure AND prosecdef)
    OR EXISTS (SELECT 1 FROM pg_proc WHERE oid IN (w11::regprocedure, rd::regprocedure) AND (proacl IS NULL OR array_to_string(proacl, ',') ~ '(^|,)=X'))
  THEN RAISE EXCEPTION 'b412:acl-function'; END IF;
  ok := ok || ' acl';

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_cad, true);
  c1 := public.register_curricular_component_version(NULL, NULL, 'Componente Alfa', NULL, true, '2020-01-01', NULL, 'ato-c');
  c2 := public.register_curricular_component_version(NULL, NULL, 'Componente Beta', NULL, true, '2020-01-01', NULL, 'ato-c');

  -- Sem capability: quadro não contorna o writer de 10 -----------------------------
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[]',
      '{"source":{"locator":"Anexo"}}');
    RAISE EXCEPTION 'b412:no-capability-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capability:manter-matrizes-curriculares%' THEN RAISE; END IF; END;
  ok := ok || ' sem-capability';

  PERFORM set_config('request.jwt.claims', u_ped, true);
  items := jsonb_build_array(jsonb_build_object('key', 'alfa', 'component', c1), jsonb_build_object('key', 'beta', 'component', c2));

  -- Recusas estruturais -----------------------------------------------------------
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', items, '[]', NULL);
    RAISE EXCEPTION 'b412:null-layout';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:layout-required%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', items, '[]', '{"source":{}}');
    RAISE EXCEPTION 'b412:no-locator';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:layout-source-locator-required%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato',
      '[{"key":"q","component":"x","quantity":40,"unit":{"scheme":"unidade-de-carga-da-matriz","value":"h","version":1}}]', '[]', '{"source":{"locator":"A"}}');
    RAISE EXCEPTION 'b412:item-quantity-with-layout';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:layout-quantity-belongs-to-cells%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', items, '[]',
      '{"source":{"locator":"A"},"rows":[{"key":"r1","role":"item","item":"alfa"}]}');
    RAISE EXCEPTION 'b412:item-without-row';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:layout-item-without-row%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', items, '[]',
      '{"source":{"locator":"A"},"rows":[{"key":"r1","role":"item","item":"alfa"},{"key":"r2","role":"item","item":"nao-existe"}]}');
    RAISE EXCEPTION 'b412:unknown-item';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:layout-reference-not-found%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[]',
      '{"source":{"locator":"A"},"columns":[{"key":"c1","header":"H","parent":"nao-existe"}]}');
    RAISE EXCEPTION 'b412:unknown-parent';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:layout-reference-not-found%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[]',
      '{"source":{"locator":"A"},"columns":[{"key":"c1","header":"H"}],"rows":[{"key":"t","role":"total","label":"T"}],"cells":[{"row":"t","column":"c1","text":"1"},{"row":"t","column":"c1","text":"2"}]}');
    RAISE EXCEPTION 'b412:duplicate-cell';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:layout-key-duplicate%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[]',
      '{"source":{"locator":"A"},"columns":[{"key":"c1","header":"H"}],"rows":[{"key":"t","role":"total","label":"T"}],"cells":[{"row":"t","column":"c1","text":"40","unit":{"scheme":"unidade-de-carga-da-matriz","value":"h","version":1}}]}');
    RAISE EXCEPTION 'b412:unit-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:unit-not-homologated%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[]',
      '{"source":{"locator":"A"},"columns":[{"key":"c1","header":"H"}],"rows":[{"key":"t","role":"total","label":"T"}],"cells":[{"row":"t","column":"c1","text":"X","unit":{"scheme":"unidade-de-carga-da-matriz","value":"h","version":1}}]}');
    RAISE EXCEPTION 'b412:unit-on-symbol';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:layout-unit-without-number%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[]',
      '{"source":{"locator":"A"},"columns":[{"key":"c1","header":"H","ref":{"scheme":"qualquer","value":"v","version":1}}]}');
    RAISE EXCEPTION 'b412:column-ref-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:layout-column-ref-not-homologated%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'X', '2026-01-01', NULL, NULL, 'ato', '[]', '[]',
      '{"source":{"locator":"A"},"rows":[{"key":"t","role":"total"}]}');
    RAISE EXCEPTION 'b412:total-without-label';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%matrix:layout-invalid%' THEN RAISE; END IF; END;
  IF EXISTS (SELECT 1 FROM public.curricular_matrix_versions) OR EXISTS (SELECT 1 FROM public.curricular_matrix_layouts)
  THEN RAISE EXCEPTION 'b412:partial-write-after-refusal'; END IF;
  ok := ok || ' recusas-atomicas';

  -- Constituição com quadro: colunas aninhadas, grupos, X/--/*/números, total, nota, célula ausente ---------
  lay := jsonb_build_object(
    'source', jsonb_build_object('locator', 'Anexo fictício I', 'page', '3', 'sha256', repeat('a', 64)),
    'columns', '[{"key":"col-a","header":"Coluna A"},{"key":"col-a-1","header":"A parcial","parent":"col-a"},{"key":"col-a-2","header":"A integral","parent":"col-a"},{"key":"col-b","header":"Coluna B"}]'::jsonb,
    'groups', '[{"key":"g1","label":"Grupo 1"},{"key":"g1a","label":"Subgrupo","parent":"g1"}]'::jsonb,
    'rows', '[{"key":"r-alfa","role":"item","item":"alfa","group":"g1a"},{"key":"r-beta","role":"item","item":"beta","group":"g1"},{"key":"r-total","role":"total","label":"Total"}]'::jsonb,
    'cells', '[{"row":"r-alfa","column":"col-a-1","text":"X"},{"row":"r-alfa","column":"col-a-2","text":"--"},{"row":"r-alfa","column":"col-b","text":"*"},{"row":"r-beta","column":"col-a-1","text":"40"},{"row":"r-beta","column":"col-b","text":"4,5"},{"row":"r-total","column":"col-a-1","text":"800"}]'::jsonb,
    'notes', '[{"key":"n1","marker":"*","text":"Nota transcrita fictícia."}]'::jsonb);
  r := public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'Matriz teste', '2026-01-01', NULL, NULL, 'Ato fictício 1', items, '[]', lay);
  m := r->>'matrix_id'; v1 := (r->>'version_id')::uuid; t1 := clock_timestamp();
  L := public.curricular_matrix_layout_at(m, '2026-03-01', t1);
  IF L IS NULL OR L->'source'->>'act' <> 'Ato fictício 1' OR L->'source'->>'locator' <> 'Anexo fictício I' OR L->'source'->>'sha256' <> repeat('a', 64)
  THEN RAISE EXCEPTION 'b412:source %', L->'source'; END IF;
  IF jsonb_array_length(L->'columns') <> 4 OR L->'columns'->1->>'parent' <> 'col-a' OR L->'groups'->1->>'parent' <> 'g1'
    OR jsonb_array_length(L->'rows') <> 3 OR L->'rows'->0->>'item' <> 'alfa' OR L->'rows'->2->>'role' <> 'total'
    OR jsonb_array_length(L->'cells') <> 6 OR jsonb_array_length(L->'notes') <> 1 OR L->'notes'->0->>'marker' <> '*'
  THEN RAISE EXCEPTION 'b412:shape %', L; END IF;
  -- símbolos preservados, sem número inferido; números só literais; ausência não vira célula
  IF (SELECT count(*) FROM jsonb_array_elements(L->'cells') c WHERE c->>'text' IN ('X','--','*') AND c->'number' <> 'null'::jsonb) <> 0
    OR (SELECT (c->>'number')::numeric FROM jsonb_array_elements(L->'cells') c WHERE c->>'text' = '40') <> 40
    OR (SELECT (c->>'number')::numeric FROM jsonb_array_elements(L->'cells') c WHERE c->>'text' = '4,5') <> 4.5
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(L->'cells') c WHERE c->>'row' = 'r-beta' AND c->>'column' = 'col-a-2')
    OR (SELECT c->>'text' FROM jsonb_array_elements(L->'cells') c WHERE c->>'row' = 'r-total') <> '800'
  THEN RAISE EXCEPTION 'b412:cells %', L->'cells'; END IF;
  ok := ok || ' quadro-fiel';

  -- Compatibilidade: readers antigos inalterados; itens sem quantidade (carga vive nas células) -------------
  IF (SELECT count(*) FROM public.curricular_matrix_items_at(m, '2026-03-01', t1)) <> 2
    OR EXISTS (SELECT 1 FROM public.curricular_matrix_items_at(m, '2026-03-01', t1) WHERE quantity IS NOT NULL)
    OR (SELECT count(*) FROM public.curricular_matrices_at('2026-03-01', t1) WHERE matrix_id = m) <> 1
  THEN RAISE EXCEPTION 'b412:compat'; END IF;
  r2 := public.record_curricular_matrix_version(NULL, NULL, 'constituicao', 'Sem quadro', '2026-01-01', NULL, NULL, 'ato', items, '[]');
  IF public.curricular_matrix_layout_at(r2->>'matrix_id', '2026-03-01', clock_timestamp()) IS NOT NULL THEN RAISE EXCEPTION 'b412:layout-invented'; END IF;
  ok := ok || ' compatibilidade';

  -- Sucessão com forma diferente (mais colunas, outra estrutura): sem limite fechado; histórico preservado ----
  r2 := public.record_curricular_matrix_version(m, v1, 'sucessao', 'Matriz teste', '2027-01-01', NULL, 'nova deliberação', 'Ato fictício 2',
    '[{"key":"alfa","component":"' || c1 || '"}]',
    '[]', jsonb_build_object('source', jsonb_build_object('locator', 'Anexo fictício II'),
      'columns', (SELECT jsonb_agg(jsonb_build_object('key', 'f' || i, 'header', 'Fase ' || i)) FROM generate_series(1, 9) i),
      'rows', '[{"key":"r","role":"item","item":"alfa"},{"key":"lbl","role":"rotulo","label":"Rótulo"}]'::jsonb,
      'cells', (SELECT jsonb_agg(jsonb_build_object('row', 'r', 'column', 'f' || i, 'text', CASE WHEN i % 2 = 0 THEN 'X' ELSE '--' END)) FROM generate_series(1, 9) i)));
  L2 := public.curricular_matrix_layout_at(m, '2027-03-01', clock_timestamp());
  IF jsonb_array_length(L2->'columns') <> 9 OR L2->'source'->>'act' <> 'Ato fictício 2' OR L2->>'version_id' <> r2->>'version_id'
  THEN RAISE EXCEPTION 'b412:succession %', L2; END IF;
  IF public.curricular_matrix_layout_at(m, '2026-03-01', clock_timestamp()) <> L THEN RAISE EXCEPTION 'b412:history-rewritten'; END IF;
  -- conhecido só até t1, 2027 ainda é coberto pela v1 (sucessão desconhecida): quadro da v1, não o da v2.
  IF public.curricular_matrix_layout_at(m, '2027-03-01', t1) IS DISTINCT FROM L THEN RAISE EXCEPTION 'b412:knownat-leak'; END IF;
  ok := ok || ' sucessao-forma-livre knownat';

  -- Imutabilidade ---------------------------------------------------------------------------------
  PERFORM set_config('role', 'postgres', true);
  BEGIN UPDATE public.curricular_matrix_layout_cells SET source_text = 'Y' WHERE matrix_version_id = v1;
    RAISE EXCEPTION 'b412:cell-mutable';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'b412:%' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.curricular_matrix_layouts WHERE matrix_version_id = v1;
    RAISE EXCEPTION 'b412:layout-deletable';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'b412:%' THEN RAISE; END IF; END;
  ok := ok || ' append-only';

  RAISE EXCEPTION 'b412-tests-ok:%', ok;
END $b412t$;
