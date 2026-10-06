-- Executado em 2026-10-06: ac2-e2e-ok (todas as etapas).
-- AC.2 — E2E transacional sintético do Portal da Família. Termina em RAISE: nada persiste.
DO $t$
DECLARE
  us uuid := gen_random_uuid(); ug uuid := gen_random_uuid(); ux uuid := gen_random_uuid(); uo uuid := gen_random_uuid();
  ps uuid; pg uuid; px uuid; po uuid; sch text; other_sch text; stu text; stu2 text; a1 uuid; a2 uuid; a3 uuid; r record; j jsonb; n int; ok text := '';
  cpf text := '52998224725';
BEGIN
  SET LOCAL statement_timeout = '50s'; SET LOCAL lock_timeout = '5s';
  SELECT e.school_id, e.student_id INTO sch, stu FROM public.school_enrollments e ORDER BY e.id LIMIT 1;
  SELECT e.student_id INTO stu2 FROM public.school_enrollments e WHERE e.school_id = sch AND e.student_id <> stu ORDER BY e.id LIMIT 1;
  SELECT s.id INTO other_sch FROM public.institutional_schools s WHERE s.id <> sch ORDER BY s.id LIMIT 1;
  INSERT INTO public.institutional_persons(display_name) VALUES ('AC2 Equipe Sintética') RETURNING id INTO ps;
  INSERT INTO public.institutional_persons(display_name) VALUES ('AC2 Responsável Sintético') RETURNING id INTO pg;
  INSERT INTO public.institutional_persons(display_name) VALUES ('AC2 Outra Pessoa') RETURNING id INTO px;
  INSERT INTO public.institutional_persons(display_name) VALUES ('AC2 Equipe Outra Escola') RETURNING id INTO po;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (us, ps), (ug, pg), (ux, px), (uo, po);
  INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value) VALUES (pg, 'cpf-hmac', public.technical_cpf_hmac(cpf));
  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_ac2_original;
  EXECUTE format($s$CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT 'manter-autorizacao-de-responsavel', '00000000-0000-0000-0000-0000000000a2'::uuid, '00000000-0000-0000-0000-0000000000a2'::uuid, 1, 'escola', %L
       WHERE auth.uid() = %L::uuid
      UNION ALL
      SELECT 'manter-autorizacao-de-responsavel', '00000000-0000-0000-0000-0000000000a3'::uuid, '00000000-0000-0000-0000-0000000000a2'::uuid, 1, 'escola', %L
       WHERE auth.uid() = %L::uuid $b$$s$, sch, us, other_sch, uo);
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated';

  -- equipe da escola
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT * INTO r FROM public.locate_guardian_person_exact(sch, 'cpf', '529.982.247-25');
  IF r.outcome <> 'encontrado' OR r.person_id <> pg OR r.account_state <> 'conta-unica' THEN RAISE EXCEPTION 'lookup: %', r; END IF;
  SELECT * INTO r FROM public.locate_guardian_person_exact(sch, 'cpf', '11111111111');
  IF r.outcome <> 'entrada-invalida' THEN RAISE EXCEPTION 'cpf invalido: %', r; END IF;
  a1 := public.record_guardian_authorization_v3(NULL, 'constituicao', stu, pg, sch, NULL, NULL, ARRAY['matricula','frequencia'], CURRENT_DATE - 1, NULL, 'Sintético', NULL);
  SELECT count(*) INTO n FROM public.guardian_authorization_chain(sch, stu) c WHERE c.id = a1 AND c.is_head;
  IF n <> 1 THEN RAISE EXCEPTION 'cadeia'; END IF;
  BEGIN PERFORM public.record_guardian_authorization_v3(NULL, 'constituicao', stu, ps, sch, NULL, NULL, ARRAY['matricula'], CURRENT_DATE, NULL, NULL, NULL); RAISE EXCEPTION 'auto';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'family:guardian-invalid%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_guardian_authorization_v3(NULL, 'constituicao', stu, pg, sch, NULL, NULL, '{}', CURRENT_DATE, NULL, NULL, NULL); RAISE EXCEPTION 'secoes';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'family:sections-required%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_guardian_authorization_v3(NULL, 'constituicao', stu, pg, sch, 'grau-de-parentesco', 'inventado', ARRAY['matricula'], CURRENT_DATE, NULL, NULL, NULL); RAISE EXCEPTION 'parentesco';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'family:relation-not-homologated%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_guardian_authorization_v3(NULL, 'constituicao', stu, gen_random_uuid(), sch, NULL, NULL, ARRAY['matricula'], CURRENT_DATE, NULL, NULL, NULL); RAISE EXCEPTION 'sem conta';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'family:guardian-account-missing%' THEN RAISE; END IF; END;
  ok := ok || 'concessao+recusas(auto,secoes,parentesco,sem-conta); ';

  -- responsável vê só o próprio educando e só as seções concedidas
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ug, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.family_students(); IF n <> 1 THEN RAISE EXCEPTION 'lista: %', n; END IF;
  j := public.family_student_summary(stu);
  IF NOT (j->'sections') ? 'matricula' OR (j->'sections') ? 'avaliacao' OR j ? 'grades' THEN RAISE EXCEPTION 'secoes: %', j->'sections'; END IF;
  IF j->'documents' IS NOT NULL AND j->'documents' <> 'null'::jsonb THEN RAISE EXCEPTION 'documentos não concedidos vazaram'; END IF;
  BEGIN PERFORM public.family_student_summary(stu2); RAISE EXCEPTION 'idor';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'family:not-authorized%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.family_student_summary('inexistente-ac2'); RAISE EXCEPTION 'idor2';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'family:not-authorized%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.guardian_authorization_chain(sch, stu); RAISE EXCEPTION 'responsavel leu cadeia';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_guardian_authorization_v3(NULL, 'constituicao', stu2, pg, sch, NULL, NULL, ARRAY['matricula'], CURRENT_DATE, NULL, NULL, NULL); RAISE EXCEPTION 'auto-concessao';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'family:natural-person-required%' AND SQLERRM NOT LIKE 'capability:%' AND SQLERRM NOT LIKE 'family:guardian-invalid%' THEN RAISE; END IF; END;
  BEGIN PERFORM 1 FROM public.guardian_authorizations; RAISE EXCEPTION 'tabela legivel';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ok := ok || 'familia(lista=1,secoes,idor-uniforme,sem-cadeia,sem-autoconcessao,sem-tabela); ';

  -- outra pessoa e outra escola
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ux, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.family_students(); IF n <> 0 THEN RAISE EXCEPTION 'outra pessoa ve'; END IF;
  BEGIN PERFORM public.family_student_summary(stu); RAISE EXCEPTION 'outra pessoa idor';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'family:not-authorized%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uo, 'role','authenticated')::text, true);
  BEGIN PERFORM public.guardian_authorization_chain(sch, stu); RAISE EXCEPTION 'outra escola leu';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_guardian_authorization_v3(a1, 'revogacao', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'x', NULL); RAISE EXCEPTION 'outra escola revogou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  ok := ok || 'outra-pessoa/outra-escola negadas; ';

  -- substituição, base desatualizada, revogação, reconcessão impossível sobre revogada
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  a2 := public.record_guardian_authorization_v3(a1, 'substituicao', NULL, NULL, NULL, NULL, NULL, ARRAY['matricula'], CURRENT_DATE - 1, NULL, 'Reduz seções', NULL);
  BEGIN PERFORM public.record_guardian_authorization_v3(a1, 'revogacao', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'x', NULL); RAISE EXCEPTION 'stale';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'family:base-superseded%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ug, 'role','authenticated')::text, true);
  IF (public.family_student_summary(stu)->'sections') ? 'frequencia' THEN RAISE EXCEPTION 'substituicao nao aplicada'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  a3 := public.record_guardian_authorization_v3(a2, 'revogacao', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Encerrada', NULL);
  BEGIN PERFORM public.record_guardian_authorization_v3(a3, 'substituicao', NULL, NULL, NULL, NULL, NULL, ARRAY['matricula'], CURRENT_DATE, NULL, NULL, NULL); RAISE EXCEPTION 'reabriu';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'family:already-revoked%' THEN RAISE; END IF; END;
  SELECT count(*) INTO n FROM public.guardian_authorization_chain(sch, stu) c WHERE c.logical_id = (SELECT logical_id FROM public.guardian_authorization_chain(sch, stu) WHERE id = a1);
  IF n <> 3 THEN RAISE EXCEPTION 'historia preservada: %', n; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ug, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.family_students(); IF n <> 0 THEN RAISE EXCEPTION 'revogada ainda visivel'; END IF;
  BEGIN PERFORM public.family_student_summary(stu); RAISE EXCEPTION 'revogada idor';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'family:not-authorized%' THEN RAISE; END IF; END;
  ok := ok || 'substituicao, stale, revogacao, historia=3, revogada=nao-autorizado; ';

  RESET ROLE; SET LOCAL ROLE anon;
  BEGIN PERFORM public.record_guardian_authorization_v3(NULL,'constituicao',stu,pg,sch,NULL,NULL,ARRAY['matricula'],CURRENT_DATE,NULL,NULL,NULL); RAISE EXCEPTION 'anon';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE service_role;
  BEGIN PERFORM public.record_guardian_authorization_v3(NULL,'constituicao',stu,pg,sch,NULL,NULL,ARRAY['matricula'],CURRENT_DATE,NULL,NULL,NULL); RAISE EXCEPTION 'service';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.locate_guardian_person_exact(sch,'cpf',cpf); RAISE EXCEPTION 'service lookup';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.guardian_authorizations(logical_id, version, event_kind, student_id, guardian_user_id, school_id, sections, valid_from, recorded_by)
    VALUES (gen_random_uuid(), 1, 'constituicao', stu, ug, sch, ARRAY['matricula'], CURRENT_DATE, ug); RAISE EXCEPTION 'service dml';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_guardian_authorization(NULL,'constituicao',stu,ug,sch,NULL,NULL,ARRAY['matricula'],CURRENT_DATE,NULL,NULL,NULL); RAISE EXCEPTION 'v1';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  ok := ok || 'anon/service/DML/v1 negados';
  RAISE EXCEPTION 'ac2-e2e-ok: %', ok;
END $t$;
