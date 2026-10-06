-- Frente Y.1 (0146) — prova no banco: cadeia de revisões, identidade de conteúdo e vigência dos vínculos.
-- Dados SINTÉTICOS ("SINTETICO-*"); termina em RAISE: nada persiste. Sucesso = 'y1-reference-tests-ok: ...'.
DO $t$
DECLARE ok boolean; _ok text := ''; r jsonb; m1 text;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); p1 uuid; p2 uuid;
  ed1 uuid; ed2 uuid; edB uuid; i1 uuid; i2 uuid; iB uuid; s1 uuid; rel uuid; nc uuid; h uuid;
  sha1 text := repeat('1', 64); sha2 text := repeat('2', 64); sha3 text := repeat('3', 64); sha4 text := repeat('4', 64);
  items1 jsonb := '[{"code":"SINT-R","kind":"area","official_text":"SINTETICO raiz"},
    {"code":"SINT-1","kind":"habilidade","official_text":"SINTETICO item um","parent_code":"SINT-R","locator":"p. 1",
     "bindings":[{"scheme_id":"sint-y1-esquema","value_id":"v","value_version":1}]}]';
  items2 jsonb := '[{"code":"SINT-R","kind":"area","official_text":"SINTETICO raiz"},
    {"code":"SINT-1","kind":"habilidade","official_text":"SINTETICO item um revisto","parent_code":"SINT-R",
     "bindings":[{"scheme_id":"sint-y1-esquema","value_id":"v","value_version":2}]}]';
  n_items int; n_eds int;
BEGIN
  SELECT count(*) INTO n_items FROM public.curricular_reference_items;
  SELECT count(*) INTO n_eds FROM public.curricular_reference_editions;

  -- ===== ACL =====
  IF has_function_privilege('service_role','public.record_curricular_reference_edition_v2(text,text,text,text,date,date,text,text,uuid,integer,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.record_curricular_reference_edition_v2(text,text,text,text,date,date,text,text,uuid,integer,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.record_curricular_reference_edition_v2(text,text,text,text,date,date,text,text,uuid,integer,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.curricular_reference_edition_chain(text,timestamptz)','EXECUTE')
     OR has_function_privilege('service_role','public.curricular_reference_edition_applicable_on(text,date,timestamptz)','EXECUTE')
     OR has_function_privilege('anon','public.attribute_value_state_on(text,text,integer,date)','EXECUTE')
     OR has_function_privilege('authenticated','public.cre_chain_guard()','EXECUTE')
     OR has_table_privilege('authenticated','public.curricular_reference_editions','INSERT')
     OR has_table_privilege('service_role','public.curricular_reference_item_bindings','INSERT')
     OR has_table_privilege('service_role','public.curricular_reference_glossary_versions','INSERT')
     OR has_table_privilege('authenticated','public.curricular_reference_correspondence_assessments','INSERT')
  THEN RAISE EXCEPTION 'falha: acl'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('record_curricular_reference_edition_v2','cre_chain_guard','crb_guard','attribute_value_state_on',
      'curricular_reference_edition_chain','curricular_reference_edition_applicable_on','curricular_reference_item_bindings_on')
      AND (prosrc ILIKE '%current_date%' OR NOT proconfig @> ARRAY['search_path=""'])) THEN RAISE EXCEPTION 'falha: current_date/search_path'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('curricular_reference_edition_chain','curricular_reference_edition_applicable_on','curricular_reference_item_bindings_on') AND prosecdef)
  THEN RAISE EXCEPTION 'falha: reader DEFINER'; END IF;
  _ok := _ok || 'acl ';

  -- ===== Valores canônicos sintéticos: v1 desde 2026-01-01; v2 desde 2026-07-01; w com histórico não monotônico =====
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status, valid_from) VALUES
    ('sint-y1-esquema','v',1,'SINTETICO v1','homologada','2026-01-01'),
    ('sint-y1-esquema','v',2,'SINTETICO v2','homologada','2026-07-01'),
    ('sint-y1-esquema','w',1,'SINTETICO w1','homologada','2026-05-01'),
    ('sint-y1-esquema','w',2,'SINTETICO w2','homologada','2026-02-01');
  IF public.attribute_value_state_on('sint-y1-esquema','v',1,'2025-12-31') <> 'nao-definido'
     OR public.attribute_value_state_on('sint-y1-esquema','v',1,'2026-01-01') <> 'vigente'
     OR public.attribute_value_state_on('sint-y1-esquema','v',1,'2026-06-30') <> 'vigente'
     OR public.attribute_value_state_on('sint-y1-esquema','v',1,'2026-07-01') <> 'nao-vigente'
     OR public.attribute_value_state_on('sint-y1-esquema','v',2,'2026-06-30') <> 'nao-vigente'
     OR public.attribute_value_state_on('sint-y1-esquema','v',2,'2026-07-01') <> 'vigente'
     OR public.attribute_value_state_on('sint-y1-esquema','w',1,'2026-06-01') <> 'ambiguo' THEN RAISE EXCEPTION 'falha: vigência do valor'; END IF;
  ok := false; BEGIN PERFORM public.attribute_value_state_on('sint-y1-esquema','v',1,NULL); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:effective-date-required'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: data nula'; END IF;
  _ok := _ok || 'value-validity ';

  -- ===== Pessoas e atuações sintéticas (rede) =====
  INSERT INTO public.institutional_persons(display_name) VALUES ('SINTETICO autor') RETURNING id INTO p1;
  INSERT INTO public.institutional_persons(display_name) VALUES ('SINTETICO homologador') RETURNING id INTO p2;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (u1, p1), (u2, p2);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, valid_from, scope_level) VALUES
    (p1, 'gestao-pedagogica-da-rede', '2020-01-01', 'rede'), (p2, 'gestao-pedagogica-da-rede', '2020-01-01', 'rede');
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', u1, 'role','authenticated')::text, true);

  -- ===== vigência dos vínculos na data efetiva da edição =====
  ok := false; BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-y1','Fonte SINTETICA','Orgao SINTETICO','e0',NULL,'2025-12-01',sha4,NULL,NULL,2,items1);
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM LIKE 'reference:binding-unknown:SINT-1:%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: vínculo antes do início'; END IF;
  ok := false; BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-y1','Fonte SINTETICA','Orgao SINTETICO','e0',NULL,'2026-08-01',sha4,NULL,NULL,2,items1);
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM LIKE 'reference:binding-nao-vigente:SINT-1:%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: vínculo após o fim'; END IF;
  ok := false; BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-y1','Fonte SINTETICA','Orgao SINTETICO','e0',NULL,'2026-06-01',sha4,NULL,NULL,1,
    '[{"code":"X","kind":"k1","official_text":"SINTETICO x","bindings":[{"scheme_id":"sint-y1-esquema","value_id":"w","value_version":2}]}]');
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM LIKE 'reference:binding-ambiguo:X:%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: vínculo ambíguo'; END IF;
  _ok := _ok || 'binding-validity ';

  -- ===== fonte → edição → itens/hierarquia; idempotência por conteúdo =====
  r := public.record_curricular_reference_edition_v2('sint-y1','Fonte SINTETICA','Orgao SINTETICO','e1',NULL,'2026-03-01',sha1,NULL,NULL,2,items1);
  ed1 := (r->>'id')::uuid; m1 := r->>'manifest_sha256';
  IF (r->>'idempotent')::boolean OR (r->>'revision_no')::int <> 1 OR m1 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'falha: raiz'; END IF;
  r := public.record_curricular_reference_edition_v2('sint-y1','Fonte SINTETICA','Orgao SINTETICO','e1',NULL,'2026-03-01',sha1,NULL,NULL,2,items1);
  IF NOT (r->>'idempotent')::boolean OR (r->>'id')::uuid <> ed1 OR r->>'manifest_sha256' <> m1 THEN RAISE EXCEPTION 'falha: idempotência'; END IF;
  -- mesmo conteúdo em outra ordem de chaves JSON ⇒ mesmo manifesto
  r := public.record_curricular_reference_edition_v2('sint-y1','Fonte SINTETICA','Orgao SINTETICO','e1',NULL,'2026-03-01',sha1,NULL,NULL,2,
    '[{"official_text":"SINTETICO raiz","kind":"area","code":"SINT-R"},
      {"parent_code":"SINT-R","official_text":"SINTETICO item um","kind":"habilidade","code":"SINT-1","locator":"p. 1",
       "bindings":[{"value_version":1,"value_id":"v","scheme_id":"sint-y1-esquema"}]}]');
  IF NOT (r->>'idempotent')::boolean THEN RAISE EXCEPTION 'falha: manifesto não canônico'; END IF;
  ok := false; BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-y1','Fonte SINTETICA','Orgao SINTETICO','e1',NULL,'2026-03-01',sha1,NULL,NULL,2,items2);
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:hash-context-conflict'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: mesmo hash, conteúdo divergente'; END IF;
  ok := false; BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-y1','Fonte SINTETICA','Orgao SINTETICO','e1',NULL,'2026-03-01',sha3,NULL,ed1,2,items2);
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:edition-label-conflict'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: mesmo rótulo, conteúdo divergente'; END IF;
  ok := false; BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-y1','Fonte SINTETICA','Orgao SINTETICO','e1',NULL,'2026-03-01',sha3,NULL,ed1,2,items1);
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM IN ('reference:edition-label-conflict','reference:manifest-already-recorded'); END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: mesmo manifesto sob outro hash'; END IF;
  -- mesmo hash em outra fonte: edição distinta, nenhuma equivalência
  r := public.record_curricular_reference_edition_v2('sint-y1-b','Fonte SINTETICA B','Orgao SINTETICO','e1',NULL,'2026-03-01',sha1,NULL,NULL,1,
    '[{"code":"SINT-B1","kind":"descritor","official_text":"SINTETICO descritor"}]');
  edB := (r->>'id')::uuid;
  IF edB = ed1 OR (r->>'idempotent')::boolean OR (r->>'revision_no')::int <> 1 THEN RAISE EXCEPTION 'falha: hash em contexto incompatível'; END IF;
  SELECT id INTO iB FROM public.curricular_reference_items WHERE edition_id = edB;
  _ok := _ok || 'hash-identity ';

  -- ===== nova edição, cadeia +1, regressão de vigência, histórico =====
  ok := false; BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-y1','Fonte SINTETICA','Orgao SINTETICO','e2',NULL,'2026-08-01',sha2,NULL,NULL,2,items2);
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:stale-head'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: stale head'; END IF;
  r := public.record_curricular_reference_edition_v2('sint-y1','Fonte SINTETICA','Orgao SINTETICO','e2',NULL,'2026-08-01',sha2,NULL,ed1,2,items2);
  ed2 := (r->>'id')::uuid;
  IF (r->>'revision_no')::int <> 2 OR (r->>'supersedes_id')::uuid <> ed1 THEN RAISE EXCEPTION 'falha: sucessor +1'; END IF;
  ok := false; BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-y1','Fonte SINTETICA','Orgao SINTETICO','e3',NULL,'2026-04-01',sha3,NULL,ed2,1,
    '[{"code":"Z","kind":"k1","official_text":"SINTETICO z"}]');
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:edition-validity-regression'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: regressão de vigência'; END IF;
  IF (SELECT array_agg(revision_no ORDER BY revision_no) FROM public.curricular_reference_edition_chain('sint-y1', now())) <> ARRAY[1,2]
     OR (SELECT array_agg(edition_id ORDER BY revision_no) FROM public.curricular_reference_edition_chain('sint-y1', now())) <> ARRAY[ed1, ed2]
     OR EXISTS (SELECT 1 FROM public.curricular_reference_edition_chain('sint-y1', now() - interval '1 second')) THEN RAISE EXCEPTION 'falha: cadeia ordenada'; END IF;
  IF (SELECT result_kind FROM public.curricular_reference_edition_applicable_on('sint-y1','2026-02-28', now())) <> 'nao-definido'
     OR (SELECT edition_id FROM public.curricular_reference_edition_applicable_on('sint-y1','2026-03-01', now())) <> ed1
     OR (SELECT edition_id FROM public.curricular_reference_edition_applicable_on('sint-y1','2026-07-31', now())) <> ed1
     OR (SELECT edition_id FROM public.curricular_reference_edition_applicable_on('sint-y1','2026-08-01', now())) <> ed2
     OR (SELECT result_kind FROM public.curricular_reference_edition_applicable_on('sint-inexistente','2026-08-01', now())) <> 'nao-definido' THEN RAISE EXCEPTION 'falha: edição aplicável'; END IF;
  SELECT id INTO i1 FROM public.curricular_reference_items WHERE edition_id = ed1 AND code = 'SINT-1';
  SELECT id INTO i2 FROM public.curricular_reference_items WHERE edition_id = ed2 AND code = 'SINT-1';
  IF (SELECT official_text FROM public.curricular_reference_items WHERE id = i1) <> 'SINTETICO item um'
     OR (SELECT parent_item_id FROM public.curricular_reference_items WHERE id = i1) IS NULL THEN RAISE EXCEPTION 'falha: edição histórica'; END IF;
  IF (SELECT state FROM public.curricular_reference_item_bindings_on(i1, '2026-04-01')) <> 'vigente'
     OR (SELECT state FROM public.curricular_reference_item_bindings_on(i1, '2026-08-15')) <> 'nao-vigente'
     OR (SELECT state FROM public.curricular_reference_item_bindings_on(i2, '2026-08-15')) <> 'vigente' THEN RAISE EXCEPTION 'falha: vínculo na data-alvo'; END IF;
  _ok := _ok || 'chain ';

  -- ===== camada editorial, relação oficial × editorial, ausência, leitura knownAt =====
  s1 := public.record_curricular_reference_simplification_v2(i2, NULL, 'SINTETICO explicação simples', NULL, '2026-08-01');
  PERFORM public.record_curricular_reference_keywords(i2, NULL, ARRAY['SINTETICO-chave'], NULL, '2026-08-01');
  PERFORM public.record_curricular_reference_glossary_term('sint-y1-termo', NULL, 'SINTETICO termo', 'SINTETICO definição', 'explicacao-sigem', ed2, i2, NULL, NULL, '2026-08-01');
  rel := public.record_curricular_reference_relation_v2(i2, iB, 'editorial-sigem','parcial','de-para','SINTETICO justificativa',NULL,NULL,'2026-08-01');
  PERFORM public.record_curricular_reference_relation_v2(i2, iB, 'oficial-da-fonte','direta','de-para','SINTETICO publicado','{}','p. 9','2026-08-01');
  SELECT id INTO i1 FROM public.curricular_reference_items WHERE edition_id = ed2 AND code = 'SINT-R';
  nc := public.record_curricular_reference_no_correspondence(i1, 'sint-y1-b', NULL, 'SINTETICO sem correspondência', NULL, false, NULL, '2026-08-01');
  IF (SELECT official_text FROM public.curricular_reference_items WHERE id = i2) <> 'SINTETICO item um revisto' THEN RAISE EXCEPTION 'falha: editorial alterou oficial'; END IF;
  IF (SELECT count(DISTINCT origin) FROM public.curricular_reference_relations_at(i2, now())) <> 2 THEN RAISE EXCEPTION 'falha: oficial ≠ editorial'; END IF;
  IF (SELECT count(*) FROM public.curricular_reference_no_correspondence_at(i1, now())) <> 1 THEN RAISE EXCEPTION 'falha: ausência'; END IF;
  IF (SELECT simplified_text FROM public.curricular_reference_item_at(i2, now())) <> 'SINTETICO explicação simples'
     OR (SELECT result_kind FROM public.curricular_reference_item_at(i2, now() - interval '1 second')) <> 'absent' THEN RAISE EXCEPTION 'falha: knownAt'; END IF;
  _ok := _ok || 'editorial-relations ';

  -- ===== autoria × homologação =====
  ok := false; BEGIN PERFORM public.homologate_curricular_reference('edicao', ed2, 'homologada', NULL, NULL, '2026-08-01');
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:author-cannot-homologate'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: autor homologa'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', u2, 'role','authenticated')::text, true);
  h := public.homologate_curricular_reference('edicao', ed2, 'homologada', NULL, NULL, '2026-08-01');
  PERFORM public.homologate_curricular_reference('simplificacao', s1, 'homologada', NULL, NULL, '2026-08-01');
  PERFORM public.homologate_curricular_reference('relacao', rel, 'homologada', NULL, NULL, '2026-08-01');
  IF (SELECT edition_homologation FROM public.curricular_reference_item_at(i2, now())) <> 'homologada' THEN RAISE EXCEPTION 'falha: homologação'; END IF;
  _ok := _ok || 'homologation ';

  -- ===== banco recusa cadeia incoerente mesmo como dono; reader falha fechado =====
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  ok := false; BEGIN
    INSERT INTO public.curricular_reference_editions(source_id, source_label, authority, edition_label, valid_from, source_sha256, supersedes_id, revision_no, item_count, recorded_by, recorded_engagement)
    VALUES ('sint-y1','S','S','salto','2026-09-01',repeat('5',64),ed2,5,1,u1,gen_random_uuid());
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:edition-revision-invalid'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: salto de revisão'; END IF;
  ok := false; BEGIN
    INSERT INTO public.curricular_reference_editions(source_id, source_label, authority, edition_label, valid_from, source_sha256, supersedes_id, item_count, recorded_by, recorded_engagement)
    VALUES ('sint-y1','S','S','fork','2026-09-01',repeat('6',64),ed1,1,u1,gen_random_uuid());
  EXCEPTION WHEN raise_exception OR unique_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: bifurcação'; END IF;
  ok := false; BEGIN UPDATE public.curricular_reference_editions SET supersedes_id = ed2 WHERE id = ed1;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:append-only'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: ciclo por atualização'; END IF;
  ALTER TABLE public.curricular_reference_editions DISABLE TRIGGER cre_chain;
  INSERT INTO public.curricular_reference_editions(source_id, source_label, authority, edition_label, valid_from, source_sha256, supersedes_id, item_count, recorded_by, recorded_engagement)
    VALUES ('sint-y1','S','S','legado-sem-revisao','2026-09-01',repeat('7',64),ed2,1,u1,gen_random_uuid());
  ALTER TABLE public.curricular_reference_editions ENABLE TRIGGER cre_chain;
  ok := false; BEGIN PERFORM * FROM public.curricular_reference_edition_chain('sint-y1', now());
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:ambiguous-chain'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: histórico incoerente aceito'; END IF;
  ok := false; BEGIN PERFORM * FROM public.curricular_reference_edition_applicable_on('sint-y1', '2026-09-02', now());
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:ambiguous-chain'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: aplicável sobre histórico incoerente'; END IF;
  _ok := _ok || 'fail-closed-chain ';

  IF EXISTS (SELECT 1 FROM public.curricular_reference_items WHERE official_text NOT LIKE 'SINTETICO%')
     OR (SELECT count(*) FROM public.curricular_reference_items) - n_items <> 5 THEN RAISE EXCEPTION 'falha: conteúdo não sintético'; END IF;
  RAISE EXCEPTION 'y1-reference-tests-ok: % (edições antes=%, itens antes=%)', _ok, n_eds, n_items;
END $t$;
