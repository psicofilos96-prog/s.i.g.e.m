-- AL — Supervisão Escolar: E2E transacional sintético. Termina em RAISE ⇒ rollback integral.
-- Duas escolas; supervisor autorizado só na escola A; visita → retificação → anulação; escola fora de escopo;
-- escola A vê só o visível; professor/família/automação recusados; zero (acesso, sem registros) ≠ recusa.
-- Executado em 2026-10-06 após 0174–0177 (via ferramenta privilegiada; sandbox não grava catálogo): al-e2e-ok: zero visit rectify out-of-scope school-visible teacher family automation; rollback sem resíduos.
DO $t$
DECLARE
  us uuid := gen_random_uuid(); uv uuid := gen_random_uuid(); ut uuid := gen_random_uuid(); uf uuid := gen_random_uuid();
  sa text; sb text; ps uuid; pv uuid; pt uuid; es uuid; ev uuid; r1 uuid; r2 uuid; r3 uuid; hid uuid; n int; n0 bigint; ok text := '';
BEGIN
  SET LOCAL statement_timeout = '55s';
  SELECT count(*) INTO n0 FROM public.school_supervision_records;
  SELECT x.id INTO sa FROM public.institutional_schools x ORDER BY x.id LIMIT 1;
  SELECT x.id INTO sb FROM public.institutional_schools x WHERE x.id <> sa ORDER BY x.id LIMIT 1;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AL Supervisor', 'pessoa-natural') RETURNING id INTO ps;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AL Direção A', 'pessoa-natural') RETURNING id INTO pv;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AL Professor', 'pessoa-natural') RETURNING id INTO pt;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (us, ps), (uv, pv), (ut, pt);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (ps, 'al-e2e', sa, '2026-08-01', 'escola') RETURNING id INTO es;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pv, 'al-e2e', sa, '2026-08-01', 'escola') RETURNING id INTO ev;
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status) VALUES
    ('modalidade-de-acompanhamento-da-supervisao','al-visita',1,'Visita sintética','homologada'),
    ('modalidade-de-acompanhamento-da-supervisao','al-rascunho',1,'Rascunho','rascunho'),
    ('situacao-de-acompanhamento-da-supervisao','al-aberto',1,'Aberto sintético','homologada');
  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_al_original;
  EXECUTE format($s$CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT c, %L::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, 1, 'escola', %L
        FROM unnest(ARRAY['registrar-acompanhamento-da-supervisao','consultar-acompanhamento-da-supervisao']) c WHERE auth.uid() = %L::uuid
      UNION ALL SELECT 'consultar-supervisao-da-propria-escola', %L::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, 1, 'escola', %L WHERE auth.uid() = %L::uuid $b$$s$,
      es, sa, us, ev, sa, uv);
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated';

  -- Supervisor
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.school_supervision_records_at(sa, NULL, NULL);
  IF n <> 0 THEN RAISE EXCEPTION 'zero esperado'; END IF; ok := ok || 'zero ';
  BEGIN PERFORM public.record_school_supervision(NULL,'registro',sa,'al-rascunho','x',DATE '2026-09-01',NULL,NULL,NULL,NULL,false,NULL); RAISE EXCEPTION 'leak draft';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
  r1 := public.record_school_supervision(NULL,'registro',sa,'al-visita','Visita de acompanhamento',DATE '2026-09-01','Encaminhar à coordenação','Coordenação',DATE '2026-09-20','al-aberto',false,NULL);
  r2 := public.record_school_supervision(NULL,'registro',sa,'al-visita','Contato visível',DATE '2026-09-02',NULL,NULL,NULL,NULL,true,NULL);
  BEGIN PERFORM public.record_school_supervision(r1,'retificacao',NULL,'al-visita','y',DATE '2026-09-01',NULL,NULL,NULL,NULL,false,''); RAISE EXCEPTION 'leak noreason';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
  r3 := public.record_school_supervision(r1,'retificacao',NULL,'al-visita','Visita (corrigida)',DATE '2026-09-01','Encaminhar à coordenação','Coordenação',DATE '2026-09-25','al-aberto',false,'Prazo corrigido');
  BEGIN PERFORM public.record_school_supervision(r1,'retificacao',NULL,'al-visita','z',DATE '2026-09-01',NULL,NULL,NULL,NULL,false,'dup'); RAISE EXCEPTION 'leak superseded';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
  SELECT count(*) INTO n FROM public.school_supervision_records_at(sa, NULL, NULL); IF n <> 2 THEN RAISE EXCEPTION 'heads %', n; END IF;
  SELECT count(*) INTO n FROM public.school_supervision_records_at(sa, NULL, (SELECT logical_id FROM public.school_supervision_records_at(sa,NULL,NULL) WHERE id = r3));
  IF n <> 2 THEN RAISE EXCEPTION 'history %', n; END IF; ok := ok || 'visit rectify ';
  BEGIN PERFORM public.record_school_supervision(NULL,'registro',sb,'al-visita','fora',DATE '2026-09-01',NULL,NULL,NULL,NULL,false,NULL); RAISE EXCEPTION 'leak sb write';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
  BEGIN PERFORM * FROM public.school_supervision_records_at(sb, NULL, NULL); RAISE EXCEPTION 'leak sb read';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END; ok := ok || 'out-of-scope ';
  BEGIN UPDATE public.school_supervision_records SET subject = 'x'; RAISE EXCEPTION 'leak update';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.school_supervision_records(logical_id,version,event_kind,school_id,modality_value_id,modality_value_version,subject,occurred_on,author_user_id,author_person_id,author_engagement)
    VALUES (gen_random_uuid(),1,'registro',sa,'al-visita',1,'x','2026-09-01',us,ps,es); RAISE EXCEPTION 'leak insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.record_school_supervision(r2,'anulacao',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Registro em duplicidade');
  RESET ROLE;

  -- Escola A: só registros visíveis (o anulado é visível como anulação; o interno não aparece)
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uv, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.school_supervision_records_at(sa, NULL, NULL) WHERE NOT school_visible; IF n <> 0 THEN RAISE EXCEPTION 'leak internal to school'; END IF;
  SELECT count(*) INTO n FROM public.school_supervision_records_at(sa, NULL, NULL); IF n <> 1 THEN RAISE EXCEPTION 'school view %', n; END IF;
  BEGIN PERFORM public.record_school_supervision(NULL,'registro',sa,'al-visita','x',DATE '2026-09-01',NULL,NULL,NULL,NULL,false,NULL); RAISE EXCEPTION 'leak school write';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END; ok := ok || 'school-visible ';
  RESET ROLE;

  -- Professor e família
  FOREACH hid IN ARRAY ARRAY[ut, uf] LOOP
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', hid, 'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN PERFORM * FROM public.school_supervision_records_at(sa, NULL, NULL); RAISE EXCEPTION 'leak teacher/family read';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
    BEGIN PERFORM public.record_school_supervision(NULL,'registro',sa,'al-visita','x',DATE '2026-09-01',NULL,NULL,NULL,NULL,false,NULL); RAISE EXCEPTION 'leak teacher/family write';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
    BEGIN SELECT count(*) INTO n FROM public.school_supervision_records; RAISE EXCEPTION 'leak table read';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
  END LOOP; ok := ok || 'teacher family ';

  -- Automação
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','service_role')::text, true);
  SET LOCAL ROLE service_role;
  BEGIN PERFORM public.record_school_supervision(NULL,'registro',sa,'al-visita','x',DATE '2026-09-01',NULL,NULL,NULL,NULL,false,NULL); RAISE EXCEPTION 'leak automation';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
  BEGIN INSERT INTO public.school_supervision_records(logical_id,version,event_kind,school_id,modality_value_id,modality_value_version,subject,occurred_on,author_user_id,author_person_id,author_engagement)
    VALUES (gen_random_uuid(),1,'registro',sa,'al-visita',1,'x','2026-09-01',us,ps,es); RAISE EXCEPTION 'leak automation insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; ok := ok || 'automation';

  -- Imutabilidade mesmo para o dono
  BEGIN DELETE FROM public.school_supervision_records WHERE id = r1; RAISE EXCEPTION 'leak delete';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'leak%' THEN RAISE; END IF; END;
  RAISE EXCEPTION 'al-e2e-ok: %', ok;
END $t$;
