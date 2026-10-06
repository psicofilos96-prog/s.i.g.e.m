-- AI — E2E transacional sintético da Alimentação Escolar. Termina em RAISE: nada persiste.
-- Cobre: unidade/cozinha atendente, cardápio planejado → previsão → serviço realizado (zero explícito ≠ não informado)
-- → retificação → leitura escola/rede → publicação/retirada → leitura família; estoque com catálogo pendente;
-- outra escola, família sem vínculo, papéis técnicos e imutabilidade recusados.
DO $t$
DECLARE
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); unet uuid := gen_random_uuid(); uf uuid := gen_random_uuid(); ux uuid := gen_random_uuid();
  sa text; sb text; pa uuid; pb uuid; pnet uuid; ea uuid; eb uuid; enet uuid;
  k uuid; lk uuid; menu uuid; menu2 uuid; svc uuid; svc2 uuid; svz uuid; n int; r record; j text; ok text := '';
  slot text := 'ai-e2e-almoco'; prep text := 'ai-e2e-prep'; st text := 'ai-e2e-estudante';
  d date := CURRENT_DATE - 2;
BEGIN
  SET LOCAL statement_timeout = '55s'; SET LOCAL lock_timeout = '5s';
  SELECT s.id INTO sa FROM public.institutional_schools s ORDER BY s.id LIMIT 1;
  SELECT s.id INTO sb FROM public.institutional_schools s WHERE s.id <> sa ORDER BY s.id LIMIT 1;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AI Cozinha A', 'pessoa-natural') RETURNING id INTO pa;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AI Escola B', 'pessoa-natural') RETURNING id INTO pb;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AI Rede', 'pessoa-natural') RETURNING id INTO pnet;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (ua, pa), (ub, pb), (unet, pnet);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pa, 'ai-e2e', sa, '2026-01-01', 'escola') RETURNING id INTO ea;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pb, 'ai-e2e', sb, '2026-01-01', 'escola') RETURNING id INTO eb;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pnet, 'ai-e2e', NULL, '2026-01-01', 'rede') RETURNING id INTO enet;
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status)
    VALUES ('refeicao-escolar', slot, 1, 'AI almoço', 'homologada'), ('preparacao-alimentar', prep, 1, 'AI preparação', 'homologada');
  INSERT INTO public.guardian_authorizations(logical_id, version, event_kind, student_id, guardian_user_id, school_id, relation_scheme_id, relation_value_id, sections, valid_from, reason, recorded_by)
    VALUES (gen_random_uuid(), 1, 'registro', st, uf, sa, 'ai-e2e', 'ai-e2e', ARRAY['calendario'], '2026-01-01', 'ai-e2e', ua);

  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_ai_original;
  EXECUTE format($s$CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT c, %L::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 1, 'escola', %L
        FROM unnest(ARRAY['manter-cardapio-escolar','registrar-execucao-alimentacao','consultar-alimentacao-escolar','publicar-cardapio-escolar','registrar-estoque-alimentar']) c WHERE auth.uid() = %L::uuid
      UNION ALL SELECT 'consultar-alimentacao-escolar', %L::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 1, 'escola', %L WHERE auth.uid() = %L::uuid
      UNION ALL SELECT c, %L::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 1, 'rede', NULL
        FROM unnest(ARRAY['manter-unidades-de-alimentacao','acompanhar-alimentacao-rede']) c WHERE auth.uid() = %L::uuid $b$$s$,
      ea, sa, ua, eb, sb, ub, enet, unet);
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated';
  SET LOCAL ROLE authenticated;

  -- Rede: unidade/cozinha e escola atendida (uma unidade por vez).
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', unet, 'role','authenticated')::text, true);
  k := public.record_meal_kitchen(NULL, NULL, 'AI Cozinha Sintética', sa, '2026-01-01', NULL, NULL);
  lk := public.record_meal_kitchen_link(NULL, 'registro', k, sa, '2026-01-01', NULL, NULL);
  BEGIN PERFORM public.record_meal_kitchen_link(NULL, 'registro', k, sa, '2026-03-01', NULL, NULL); RAISE EXCEPTION 'dup link'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'meal:school-already-served' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_meal_kitchen(k, 9, 'x', NULL, '2026-01-01', NULL, 'x'); RAISE EXCEPTION 'stale'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'meal:stale' THEN RAISE; END IF; END;
  ok := ok || 'kitchen ';

  -- Escola A: cardápio planejado, previsão, serviço (zero explícito e não informado separados), retificação.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ua, 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_meal_kitchen(NULL, NULL, 'x', NULL, '2026-01-01', NULL, NULL); RAISE EXCEPTION 'escola criou unidade'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  SELECT count(*) INTO n FROM public.meal_kitchens_at(CURRENT_DATE) x WHERE x.kitchen_id = k AND x.served_schools = ARRAY[sa]; IF n <> 1 THEN RAISE EXCEPTION 'cozinha nao vista pela escola'; END IF;
  menu := public.record_meal_menu(NULL, 'registro', sa, NULL, d, d + 1, jsonb_build_array(jsonb_build_object('date', d, 'slot', slot, 'preparations', jsonb_build_array(prep))), NULL);
  BEGIN PERFORM public.record_meal_menu(NULL, 'registro', sa, NULL, d, d, jsonb_build_array(jsonb_build_object('date', d, 'slot', slot, 'preparations', jsonb_build_array('inventada'))), NULL); RAISE EXCEPTION 'prep inventada'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'meal:value-not-homologated' THEN RAISE; END IF; END;
  PERFORM public.record_meal_forecast(NULL, 'registro', sa, d, slot, 100, 'previsão declarada sintética', NULL);
  svc := public.record_meal_service(NULL, 'registro', sa, d, slot, 90, 80, 'ai-e2e', NULL);
  svz := public.record_meal_service(NULL, 'registro', sa, d + 1, slot, NULL, 0, 'ai-e2e zero explicito', NULL);
  BEGIN PERFORM public.record_meal_service(NULL, 'registro', sa, d, slot, 1, 1, 'dup', NULL); RAISE EXCEPTION 'dup servico'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'meal:duplicate-use-rectification' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_meal_service(NULL, 'registro', sa, CURRENT_DATE + 5, slot, 1, 1, 'fut', NULL); RAISE EXCEPTION 'futuro'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'meal:service-in-future' THEN RAISE; END IF; END;
  svc2 := public.record_meal_service(svc, 'retificacao', NULL, NULL, NULL, 90, 85, 'ai-e2e', 'contagem conferida');
  SELECT count(*) INTO n FROM public.meal_services_at(sa, d, d + 1, NULL) s WHERE s.served_count IN (85, 0); IF n <> 2 THEN RAISE EXCEPTION 'servico vigente'; END IF;
  SELECT count(*) INTO n FROM public.meal_service_records WHERE logical_id = (SELECT logical_id FROM public.meal_service_records WHERE id = svc); IF n <> 2 THEN RAISE EXCEPTION 'historia'; END IF;
  -- Estoque: sem catálogo homologado ⇒ INVENTORY_CATALOG_PENDING.
  BEGIN PERFORM public.record_meal_inventory_movement(NULL, 'registro', sa, 'arroz', 'kg', 'entrada', 10, d, NULL, NULL); RAISE EXCEPTION 'estoque inventado'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'meal:inventory-catalog-pending' THEN RAISE; END IF; END;
  -- Publicação.
  BEGIN PERFORM public.record_meal_menu_publication(menu, 0, 'retirada', 'x'); RAISE EXCEPTION 'retirar nao publicado'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'meal:not-published' THEN RAISE; END IF; END;
  PERFORM public.record_meal_menu_publication(menu, 0, 'publicacao', NULL);
  BEGIN PERFORM public.record_meal_menu_publication(menu, 0, 'publicacao', NULL); RAISE EXCEPTION 'stale pub'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'meal:stale' THEN RAISE; END IF; END;
  ok := ok || 'school ';

  -- Família vinculada vê só o publicado; retificar o cardápio retira da família até republicar.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uf, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.family_published_menus(st, d); IF n <> 1 THEN RAISE EXCEPTION 'familia publicado %', n; END IF;
  BEGIN PERFORM public.meal_menus_at(sa, d, d, NULL, NULL); RAISE EXCEPTION 'familia leu interno'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ua, 'role','authenticated')::text, true);
  menu2 := public.record_meal_menu(menu, 'retificacao', NULL, NULL, d, d + 1, jsonb_build_array(jsonb_build_object('date', d + 1, 'slot', slot, 'preparations', jsonb_build_array(prep))), 'troca de data');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uf, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.family_published_menus(st, d); IF n <> 0 THEN RAISE EXCEPTION 'versao nao publicada vazou'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ux, 'role','authenticated')::text, true);
  BEGIN PERFORM public.family_published_menus(st, d); RAISE EXCEPTION 'familia sem vinculo'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'family:not-authorized' THEN RAISE; END IF; END;
  ok := ok || 'family ';

  -- Escola B não lê nem grava A; não enxerga a cozinha de A.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ub, 'role','authenticated')::text, true);
  BEGIN PERFORM public.meal_services_at(sa, d, d, NULL); RAISE EXCEPTION 'idor B'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_meal_service(svc2, 'retificacao', NULL, NULL, NULL, 1, 1, 'x', 'x'); RAISE EXCEPTION 'idor write'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.meal_network_overview(d, d); RAISE EXCEPTION 'B rede'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  SELECT count(*) INTO n FROM public.meal_kitchens_at(CURRENT_DATE) x WHERE x.kitchen_id = k; IF n <> 0 THEN RAISE EXCEPTION 'B viu cozinha A'; END IF;
  ok := ok || 'idor ';

  -- Rede: grandezas separadas; dia com zero explícito conta como informado; escola sem registro não aparece como zero.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', unet, 'role','authenticated')::text, true);
  SELECT * INTO r FROM public.meal_network_overview(d, d + 1) o WHERE o.school_id = sa;
  IF r.forecast_total <> 100 OR r.served_total <> 85 OR r.served_days <> 2 OR r.forecast_days <> 1 THEN RAISE EXCEPTION 'rede %', row_to_json(r); END IF;
  SELECT count(*) INTO n FROM public.meal_network_overview(d, d + 1) o WHERE o.school_id = sb; IF n <> 0 THEN RAISE EXCEPTION 'unknown virou zero'; END IF;
  ok := ok || 'network ';

  -- Papéis técnicos e imutabilidade.
  RESET ROLE;
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.meal_network_overview(d, d); RAISE EXCEPTION 'anon'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE service_role;
  BEGIN PERFORM public.record_meal_menu_publication(menu2, 1, 'publicacao', NULL); RAISE EXCEPTION 'service_role writer'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.meal_service_records(logical_id, version, event_kind, school_id, served_on, meal_slot_value_id, served_count, author_user_id, author_engagement)
        VALUES (gen_random_uuid(), 1, 'registro', sa, d, slot, 1, ux, ea); RAISE EXCEPTION 'service_role DML'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  BEGIN UPDATE public.meal_kitchen_school_links SET school_id = sb WHERE id = lk; RAISE EXCEPTION 'mutavel'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'mutavel' THEN RAISE; END IF; END;
  ok := ok || 'roles ';

  RAISE EXCEPTION 'ai-e2e-ok: %', ok;
END $t$;
