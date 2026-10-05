-- Frente Y (0133/0134) — prova no banco. Dados SINTÉTICOS ("SINTETICO-*"); termina em RAISE: nada persiste.
-- Sucesso = 'y-reference-tests-ok: ...'.
DO $t$
DECLARE ok boolean; e text; _ok text := '';
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  p1 uuid; p2 uuid; p3 uuid; r jsonb; ed1 uuid; ed2 uuid; edS uuid; i1 uuid; i2 uuid; ib uuid; ib2 uuid; s1 uuid; s2 uuid; rel uuid; rv uuid; h uuid; nc uuid;
  sha1 text := repeat('a', 64); sha2 text := repeat('b', 64); sha3 text := repeat('c', 64);
  items jsonb := '[{"code":"SINT-R","kind":"area","official_text":"SINTETICO raiz"},
                   {"code":"SINT-1","kind":"habilidade","official_text":"SINTETICO comparar quantidades","parent_code":"SINT-R","locator":"p. 1"}]';
  n_before int; n_after int;
BEGIN
  SELECT count(*) INTO n_before FROM public.curricular_reference_items;
  -- ===== ACL =====
  IF has_table_privilege('service_role','public.curricular_reference_items','INSERT') OR has_table_privilege('service_role','public.curricular_reference_editions','UPDATE')
     OR has_table_privilege('authenticated','public.curricular_reference_relations','INSERT') OR has_table_privilege('anon','public.curricular_reference_items','SELECT')
     OR has_table_privilege('service_role','public.curricular_reference_homologations','INSERT')
     OR has_function_privilege('service_role','public.record_curricular_reference_edition_v2(text,text,text,text,date,date,text,text,uuid,integer,jsonb)','EXECUTE')
     OR has_function_privilege('service_role','public.homologate_curricular_reference(text,uuid,text,uuid,text,date)','EXECUTE')
     OR has_function_privilege('anon','public.curricular_reference_search(text,text,uuid,text,jsonb,boolean,timestamptz,integer)','EXECUTE')
     OR has_function_privilege('authenticated','public.reference_actor(text,date)','EXECUTE')
  THEN RAISE EXCEPTION 'falha: acl'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('record_curricular_reference_edition_v2','record_curricular_reference_relation_v2','record_curricular_reference_simplification_v2',
      'homologate_curricular_reference','reference_actor') AND (prosrc ILIKE '%current_date%' OR NOT proconfig @> ARRAY['search_path=""'])) THEN RAISE EXCEPTION 'falha: current_date/search_path'; END IF;
  _ok := _ok || 'acl ';

  -- ===== Pessoas e atuações sintéticas (rede) =====
  INSERT INTO public.institutional_persons(display_name) VALUES ('SINTETICO autor') RETURNING id INTO p1;
  INSERT INTO public.institutional_persons(display_name) VALUES ('SINTETICO homologador') RETURNING id INTO p2;
  INSERT INTO public.institutional_persons(display_name) VALUES ('SINTETICO sem atuacao') RETURNING id INTO p3;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (u1, p1), (u2, p2), (u3, p3);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, valid_from, scope_level) VALUES
    (p1, 'gestao-pedagogica-da-rede', '2020-01-01', 'rede'), (p2, 'gestao-pedagogica-da-rede', '2020-01-01', 'rede');

  -- ===== sem sessão / sem pessoa / sem capacidade =====
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-a','S','S','e1',NULL,'2026-10-05',sha1,NULL,NULL,2,items); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'session-required'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: sem sessão'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-a','S','S','e1',NULL,'2026-10-05',sha1,NULL,NULL,2,items); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'person-required'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: sem pessoa'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', u3, 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-a','S','S','e1',NULL,'2026-10-05',sha1,NULL,NULL,2,items); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'capability:construir-referencia-curricular'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: sem capacidade'; END IF;
  _ok := _ok || 'fail-closed ';

  -- ===== importação: validações =====
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', u1, 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-a','S','S','e1',NULL,'2026-10-05',sha1,NULL,NULL,3,items); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:item-count-mismatch'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: contagem'; END IF;
  BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-a','S','S','e1',NULL,'2026-10-05',sha1,NULL,NULL,2,
    '[{"code":"X","kind":"k1","official_text":"t"},{"code":"X","kind":"k1","official_text":"t"}]'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:duplicate-code:X'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: código duplicado'; END IF;
  BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-a','S','S','e1',NULL,'2026-10-05',sha1,NULL,NULL,1,
    '[{"code":"X","kind":"k1","official_text":"t","parent_code":"NAO"}]'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:parent-missing:X'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: parent inexistente'; END IF;
  BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-a','S','S','e1',NULL,'2026-10-05',sha1,NULL,NULL,2,
    '[{"code":"A","kind":"k1","official_text":"t","parent_code":"B"},{"code":"B","kind":"k1","official_text":"t","parent_code":"A"}]'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:parent-cycle'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: ciclo'; END IF;
  BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-a','S','S','e1',NULL,'2026-10-05',sha1,NULL,NULL,1,
    '[{"code":"A","kind":"k1","official_text":"t","bindings":[{"scheme_id":"posicao-curricular-individual","value_id":"inexistente","value_version":1}]}]'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM LIKE 'reference:binding-unknown:A:%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: binding desconhecido'; END IF;
  BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-a','S','S','e1',NULL,'2026-10-05',sha1,NULL,NULL,1,
    '[{"code":"A","kind":"k1","official_text":"  "}]'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:official-text-required:A'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: texto vazio'; END IF;
  _ok := _ok || 'import-validation ';

  -- ===== gravação, idempotência, stale head, edição histórica =====
  r := public.record_curricular_reference_edition_v2('sint-a','Fonte SINTETICA A','Orgao SINTETICO','e1',NULL,'2026-10-05',sha1,NULL,NULL,2,items);
  ed1 := (r->>'id')::uuid;
  IF (r->>'idempotent')::boolean THEN RAISE EXCEPTION 'falha: primeira não idempotente'; END IF;
  r := public.record_curricular_reference_edition_v2('sint-a','Fonte SINTETICA A','Orgao SINTETICO','e1',NULL,'2026-10-05',sha1,NULL,NULL,2,items);
  IF NOT (r->>'idempotent')::boolean OR (r->>'id')::uuid <> ed1 THEN RAISE EXCEPTION 'falha: idempotência por hash'; END IF;
  BEGIN PERFORM public.record_curricular_reference_edition_v2('sint-a','S','S','e2',NULL,'2026-10-05',sha2,NULL,NULL,2,items); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:stale-head'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: stale head edição'; END IF;
  r := public.record_curricular_reference_edition_v2('sint-a','Fonte SINTETICA A','Orgao SINTETICO','e2',NULL,'2026-10-05',sha2,NULL,ed1,2,
    '[{"code":"SINT-R","kind":"area","official_text":"SINTETICO raiz"},{"code":"SINT-1","kind":"habilidade","official_text":"SINTETICO texto alterado na e2","parent_code":"SINT-R"}]');
  ed2 := (r->>'id')::uuid;
  SELECT id INTO i1 FROM public.curricular_reference_items WHERE edition_id = ed1 AND code = 'SINT-1';
  SELECT id INTO i2 FROM public.curricular_reference_items WHERE edition_id = ed2 AND code = 'SINT-1';
  IF (SELECT official_text FROM public.curricular_reference_items WHERE id = i1) <> 'SINTETICO comparar quantidades' THEN RAISE EXCEPTION 'falha: edição histórica alterada'; END IF;
  IF (SELECT parent_item_id FROM public.curricular_reference_items WHERE id = i1) IS NULL THEN RAISE EXCEPTION 'falha: hierarquia'; END IF;
  -- segunda fonte com MESMO código
  r := public.record_curricular_reference_edition_v2('sint-b','Fonte SINTETICA B','Orgao SINTETICO','e1',NULL,'2026-10-05',sha3,NULL,NULL,2,
    '[{"code":"SINT-1","kind":"descritor","official_text":"SINTETICO descritor B"},{"code":"SINT-2","kind":"descritor","official_text":"SINTETICO outro B"}]');
  edS := (r->>'id')::uuid;
  SELECT id INTO ib FROM public.curricular_reference_items WHERE edition_id = edS AND code = 'SINT-1';
  SELECT id INTO ib2 FROM public.curricular_reference_items WHERE edition_id = edS AND code = 'SINT-2';
  _ok := _ok || 'edition-chain-idempotent ';

  -- ===== cadeia inválida negada pelo banco (mesmo como dono) =====
  RESET ROLE;
  ok := false; BEGIN
    INSERT INTO public.curricular_reference_editions(source_id, source_label, authority, edition_label, source_sha256, supersedes_id, item_count, recorded_by, recorded_engagement)
    VALUES ('sint-a','S','S','fork',repeat('d',64),ed1,1,u1,gen_random_uuid());
  EXCEPTION WHEN raise_exception OR unique_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: bifurcação de edição'; END IF;
  ok := false; BEGIN
    INSERT INTO public.curricular_reference_editions(source_id, source_label, authority, edition_label, source_sha256, supersedes_id, item_count, recorded_by, recorded_engagement)
    VALUES ('sint-a','S','S','root2',repeat('e',64),NULL,1,u1,gen_random_uuid());
  EXCEPTION WHEN raise_exception OR unique_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: segunda raiz'; END IF;
  ok := false; BEGIN
    INSERT INTO public.curricular_reference_editions(source_id, source_label, authority, edition_label, source_sha256, supersedes_id, item_count, recorded_by, recorded_engagement)
    VALUES ('sint-b','S','S','x',repeat('f',64),ed2,1,u1,gen_random_uuid());
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:edition-chain-other-source'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: cadeia de outra fonte'; END IF;
  ok := false; BEGIN UPDATE public.curricular_reference_items SET official_text = 'x' WHERE id = i1; EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:append-only'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: texto oficial editável'; END IF;
  _ok := _ok || 'db-chain ';

  -- ===== simplificação =====
  SET LOCAL ROLE authenticated;
  s1 := public.record_curricular_reference_simplification_v2(i2, NULL, 'SINTETICO jeito simples', NULL, '2026-10-05');
  BEGIN PERFORM public.record_curricular_reference_simplification_v2(i2, NULL, 'outra', 'r', '2026-10-05'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:stale-head'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: stale head simplificação'; END IF;
  s2 := public.record_curricular_reference_simplification_v2(i2, s1, 'SINTETICO jeito simples v2', 'revisão', '2026-10-05');
  IF (SELECT official_text FROM public.curricular_reference_items WHERE id = i2) <> 'SINTETICO texto alterado na e2' THEN RAISE EXCEPTION 'falha: simplificação alterou oficial'; END IF;
  RESET ROLE;
  ok := false; BEGIN
    INSERT INTO public.curricular_reference_simplifications(item_id, version_no, supersedes_id, simplified_text, reason, recorded_by, recorded_engagement)
    VALUES (i2, 5, s1, 'salto', 'r', u1, gen_random_uuid());
  EXCEPTION WHEN raise_exception OR unique_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: cadeia de simplificação inválida'; END IF;
  SET LOCAL ROLE authenticated;
  PERFORM public.record_curricular_reference_keywords(i2, NULL, ARRAY['SINTETICO-palavra','contar'], NULL, '2026-10-05');
  _ok := _ok || 'simplification-keywords ';

  -- ===== busca não confunde oficial × simplificação; mesma chave em fontes distintas =====
  IF NOT EXISTS (SELECT 1 FROM public.curricular_reference_search('jeito simples', NULL, NULL, NULL, NULL, true, now(), 50) x
                 WHERE x.item_id = i2 AND x.matched_in = ARRAY['simplificacao']) THEN RAISE EXCEPTION 'falha: busca simplificação'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.curricular_reference_search('alterado', NULL, NULL, NULL, NULL, true, now(), 50) x
                 WHERE x.item_id = i2 AND x.matched_in = ARRAY['texto-oficial']) THEN RAISE EXCEPTION 'falha: busca oficial'; END IF;
  IF (SELECT count(*) FROM public.curricular_reference_search('SINT-1', NULL, NULL, NULL, NULL, true, now(), 50)) <> 2 THEN RAISE EXCEPTION 'falha: código igual em fontes'; END IF;
  IF EXISTS (SELECT 1 FROM public.curricular_reference_search('comparar', NULL, NULL, NULL, NULL, true, now(), 50)) THEN RAISE EXCEPTION 'falha: edição substituída na busca vigente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.curricular_reference_search('comparar', NULL, NULL, NULL, NULL, false, now(), 50)) THEN RAISE EXCEPTION 'falha: edição histórica inacessível'; END IF;
  IF (SELECT result_kind FROM public.curricular_reference_item_at(i2, now())) <> 'item'
     OR (SELECT result_kind FROM public.curricular_reference_item_at(gen_random_uuid(), now())) <> 'absent' THEN RAISE EXCEPTION 'falha: item_at'; END IF;
  _ok := _ok || 'search ';

  -- ===== relações N:N, self, natureza, revogação =====
  BEGIN PERFORM public.record_curricular_reference_relation_v2(i2, i2, 'editorial-sigem','direta','de-para','j',NULL,NULL,'2026-10-05'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:relation-self'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: auto-relação'; END IF;
  BEGIN PERFORM public.record_curricular_reference_relation_v2(i2, ib, 'editorial-sigem','sem-correspondencia-identificada','de-para','j',NULL,NULL,'2026-10-05'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:editorial-nature-invalid'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: natureza editorial'; END IF;
  BEGIN PERFORM public.record_curricular_reference_relation_v2(i2, ib, 'oficial-da-fonte','direta','de-para','j',NULL,NULL,'2026-10-05'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:official-locator-required'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: oficial sem localizador'; END IF;
  rel := public.record_curricular_reference_relation_v2(i2, ib, 'editorial-sigem','parcial','de-para','SINTETICO justificativa','{"operacao-cognitiva":"comparar"}',NULL,'2026-10-05');
  PERFORM public.record_curricular_reference_relation_v2(i2, ib2, 'editorial-sigem','indireta-complementar','de-para','SINTETICO j2',NULL,NULL,'2026-10-05');
  PERFORM public.record_curricular_reference_relation_v2(i2, ib, 'oficial-da-fonte','direta','de-para','SINTETICO publicado','{}','p. 9','2026-10-05');
  IF (SELECT count(*) FROM public.curricular_reference_relations_at(i2, now())) <> 3 THEN RAISE EXCEPTION 'falha: N:N'; END IF;
  IF (SELECT count(DISTINCT origin) FROM public.curricular_reference_relations_at(i2, now())) <> 2 THEN RAISE EXCEPTION 'falha: oficial ≠ editorial'; END IF;
  BEGIN PERFORM public.record_curricular_reference_relation_v2(i2, ib, 'editorial-sigem','parcial','de-para','dup',NULL,NULL,'2026-10-05'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:relation-already-active'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: relação duplicada'; END IF;
  rv := public.revoke_curricular_reference_relation(rel, 'SINTETICO revisão', '2026-10-05');
  BEGIN PERFORM public.revoke_curricular_reference_relation(rel, 'de novo', '2026-10-05'); ok := false;
  EXCEPTION WHEN unique_violation THEN ok := true; WHEN raise_exception THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: revogação duplicada'; END IF;
  BEGIN PERFORM public.revoke_curricular_reference_relation(rv, 'revogar revogação', '2026-10-05'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:cannot-revoke-revocation'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: revogar revogação'; END IF;
  IF (SELECT count(*) FROM public.curricular_reference_relations_at(i2, now())) <> 2 THEN RAISE EXCEPTION 'falha: revogada ainda ativa'; END IF;
  _ok := _ok || 'relations ';

  -- ===== sem correspondência: sem item fictício; conflito com relação ativa =====
  BEGIN PERFORM public.record_curricular_reference_no_correspondence(i2, 'sint-b', NULL, 'j', NULL, false, NULL, '2026-10-05'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:conflicts-with-active-relation'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: ausência com relação ativa'; END IF;
  SELECT id INTO i1 FROM public.curricular_reference_items WHERE edition_id = ed2 AND code = 'SINT-R';
  nc := public.record_curricular_reference_no_correspondence(i1, 'sint-b', NULL, 'SINTETICO nenhuma correspondência identificada', '{"contexto":"x"}', false, NULL, '2026-10-05');
  IF (SELECT count(*) FROM public.curricular_reference_no_correspondence_at(i1, now())) <> 1 THEN RAISE EXCEPTION 'falha: leitura ausência'; END IF;
  BEGIN PERFORM public.record_curricular_reference_relation_v2(i1, ib, 'editorial-sigem','direta','de-para','j',NULL,NULL,'2026-10-05'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:conflicts-with-no-correspondence'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: relação contra ausência'; END IF;
  _ok := _ok || 'no-correspondence ';

  -- ===== homologação: autor ≠ homologador =====
  BEGIN PERFORM public.homologate_curricular_reference('edicao', ed2, 'homologada', NULL, NULL, '2026-10-05'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:author-cannot-homologate'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: autor homologa'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', u2, 'role','authenticated')::text, true);
  h := public.homologate_curricular_reference('edicao', ed2, 'homologada', NULL, NULL, '2026-10-05');
  BEGIN PERFORM public.homologate_curricular_reference('edicao', ed2, 'revogada', NULL, 'x', '2026-10-05'); ok := false;
  EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'reference:stale-head'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: stale head homologação'; END IF;
  IF (SELECT edition_homologation FROM public.curricular_reference_item_at(i2, now())) <> 'homologada' THEN RAISE EXCEPTION 'falha: estado homologado'; END IF;
  PERFORM public.homologate_curricular_reference('simplificacao', s2, 'homologada', NULL, NULL, '2026-10-05');
  _ok := _ok || 'homologation ';
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  SELECT count(*) INTO n_after FROM public.curricular_reference_items WHERE official_text NOT LIKE 'SINTETICO%';
  IF n_after <> n_before THEN RAISE EXCEPTION 'falha: conteúdo não sintético'; END IF;
  RAISE EXCEPTION 'y-reference-tests-ok: %', _ok;
END $t$;
