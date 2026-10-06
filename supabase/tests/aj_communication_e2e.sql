-- AJ — E2E transacional sintético da comunicação escola ↔ família. Termina em RAISE: nada persiste.
-- Cobre: rascunho invisível → publicação → família autorizada lê/registra ciência → retificação (rascunho não vaza;
-- republicação) → cancelamento → revogação da autorização; outro educando, outra escola, professor fora/dentro do
-- escopo, IDOR, papéis técnicos e imutabilidade.
DO $t$
DECLARE
  us uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ut uuid := gen_random_uuid(); uf uuid := gen_random_uuid(); uf2 uuid := gen_random_uuid();
  sa text; sb text; y text := 'ano-aj-e2e-sintetico'; cls text := 'turma-aj-e2e'; cls2 text := 'turma-aj-e2e-2';
  ps uuid; pb uuid; pt uuid; es uuid; eb uuid; et uuid; st text; st2 text; en text; en2 text; ga uuid; ta text := 'ta-' || gen_random_uuid();
  c uuid; c2 uuid; ct uuid; v1 uuid; n int; s text; ok text := '';
BEGIN
  SET LOCAL statement_timeout = '55s'; SET LOCAL lock_timeout = '5s';
  SELECT x.id INTO sa FROM public.institutional_schools x ORDER BY x.id LIMIT 1;
  SELECT x.id INTO sb FROM public.institutional_schools x WHERE x.id <> sa ORDER BY x.id LIMIT 1;
  INSERT INTO public.institutional_academic_years(id) VALUES (y);
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from, originating_act_ref, technical_operation_id)
    VALUES (y, 1, 'AJ Ano Sintético', '2026-08-01', '2026-12-31', true, '2026-08-01', 'aj-e2e', (SELECT o.id FROM public.technical_execution_operations o ORDER BY o.id LIMIT 1));
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance) VALUES (y, 1, 'operacional', 'aj-e2e', 'aj-e2e');
  INSERT INTO public.institutional_classes(id, school_id, school_label_snapshot, academic_year_id, academic_year_label, name, valid_from)
    VALUES (cls, sa, 'A', y, 'AJ', 'AJ Turma 1', '2026-08-01'), (cls2, sa, 'A', y, 'AJ', 'AJ Turma 2', '2026-08-01');
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AJ Secretaria', 'pessoa-natural') RETURNING id INTO ps;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AJ Escola B', 'pessoa-natural') RETURNING id INTO pb;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AJ Professor', 'pessoa-natural') RETURNING id INTO pt;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (us, ps), (ub, pb), (ut, pt);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (ps, 'aj-e2e', sa, '2026-08-01', 'escola') RETURNING id INTO es;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pb, 'aj-e2e', sb, '2026-08-01', 'escola') RETURNING id INTO eb;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pt, 'aj-e2e', sa, '2026-08-01', 'escola') RETURNING id INTO et;

  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_aj_original;
  EXECUTE format($s$CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT c, %L::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid, 1, 'escola', %L
        FROM unnest(ARRAY['cadastrar-estudante-na-escola','manter-matricula-e-enturmacao','publicar-comunicacao-escolar']) c WHERE auth.uid() = %L::uuid
      UNION ALL SELECT c, %L::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid, 1, 'escola', %L
        FROM unnest(ARRAY['publicar-comunicacao-escolar','consultar-comunicacao-escolar']) c WHERE auth.uid() = %L::uuid
      UNION ALL SELECT 'comunicar-turma-atribuida', %L::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid, 1, 'escola', %L WHERE auth.uid() = %L::uuid $b$$s$,
      es, sa, us, eb, sb, ub, et, sa, ut);
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated';

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  st := public.register_student_for_school(sa, 'AJ Aluno 1', '52998224725', '');
  en := public.enroll_student_in_school_year(st, sa, y, '2026-08-03', NULL);
  PERFORM public.secretariat_allocate_to_class(en, cls, '2026-08-03', NULL);
  st2 := public.register_student_for_school(sa, 'AJ Aluno 2', '11144477735', '');
  en2 := public.enroll_student_in_school_year(st2, sa, y, '2026-08-03', NULL);
  PERFORM public.secretariat_allocate_to_class(en2, cls2, '2026-08-03', NULL);
  RESET ROLE;
  -- Família 1 autorizada (comunicados) para o aluno 1; família 2 para o aluno 2. Autorização sintética desfeita no rollback.
  INSERT INTO public.guardian_authorizations(logical_id, version, event_kind, student_id, guardian_user_id, school_id, relation_scheme_id, relation_value_id, sections, valid_from, reason, recorded_by, recorded_engagement)
    VALUES (gen_random_uuid(), 1, 'constituicao', st, uf, sa, 'aj-e2e', 'aj-e2e', ARRAY['comunicados'], '2026-01-01', 'aj-e2e', us, es) RETURNING id INTO ga;
  INSERT INTO public.guardian_authorizations(logical_id, version, event_kind, student_id, guardian_user_id, school_id, relation_scheme_id, relation_value_id, sections, valid_from, reason, recorded_by, recorded_engagement)
    VALUES (gen_random_uuid(), 1, 'constituicao', st2, uf2, sa, 'aj-e2e', 'aj-e2e', ARRAY['comunicados'], '2026-01-01', 'aj-e2e', us, es);
  SET LOCAL ROLE authenticated;

  -- Rascunho → publicação.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  c := public.record_school_communication_version(NULL, NULL, sa, 'Reunião', 'Reunião de pais na sexta.', 'familias-da-escola', NULL, true, NULL);
  c2 := public.record_school_communication_version(NULL, NULL, sa, 'Turma 1', 'Aviso só da turma 1.', 'familias-da-turma', cls, false, NULL);
  BEGIN PERFORM public.record_school_communication_version(NULL, NULL, sa, 'x', 'y', 'familias-da-turma', 'inexistente', false, NULL); RAISE EXCEPTION 'turma fora'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'comm:class-outside-school' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uf, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.family_communications(st); IF n <> 0 THEN RAISE EXCEPTION 'rascunho vazou'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_school_communication_act(c, 0, 'cancelamento', 'x'); RAISE EXCEPTION 'cancelar rascunho'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'comm:not-published' THEN RAISE; END IF; END;
  PERFORM public.record_school_communication_act(c, 0, 'publicacao', NULL);
  PERFORM public.record_school_communication_act(c2, 0, 'publicacao', NULL);
  BEGIN PERFORM public.record_school_communication_act(c, 0, 'publicacao', NULL); RAISE EXCEPTION 'stale'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'comm:stale' THEN RAISE; END IF; END;
  ok := ok || 'publish ';

  -- Família 1 vê escola + turma 1; família 2 vê só o da escola; leitura e ciência distintas.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uf, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.family_communications(st); IF n <> 2 THEN RAISE EXCEPTION 'familia 1 viu %', n; END IF;
  SELECT f.version_id INTO v1 FROM public.family_communications(st) f WHERE f.communication_id = c;
  PERFORM public.record_family_communication_receipt(st, v1, 'leitura');
  PERFORM public.record_family_communication_receipt(st, v1, 'leitura');
  SELECT count(*) INTO n FROM public.family_communications(st) f WHERE f.communication_id = c AND f.read_at IS NOT NULL AND f.acknowledged_at IS NULL; IF n <> 1 THEN RAISE EXCEPTION 'leitura!=ciencia'; END IF;
  PERFORM public.record_family_communication_receipt(st, v1, 'ciencia');
  BEGIN PERFORM public.record_family_communication_receipt(st, (SELECT f.version_id FROM public.family_communications(st) f WHERE f.communication_id = c2), 'ciencia'); RAISE EXCEPTION 'ciencia nao pedida'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'comm:acknowledgement-not-requested' THEN RAISE; END IF; END;
  BEGIN PERFORM public.family_communications(st2); RAISE EXCEPTION 'idor filho'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'family:not-authorized' THEN RAISE; END IF; END;
  BEGIN PERFORM public.school_communications_at(sa); RAISE EXCEPTION 'familia leu equipe'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uf2, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.family_communications(st2); IF n <> 1 THEN RAISE EXCEPTION 'familia 2 viu %', n; END IF;
  BEGIN PERFORM public.record_family_communication_receipt(st2, (SELECT v.id FROM public.school_communication_versions v WHERE v.communication_id = c2), 'leitura'); RAISE EXCEPTION 'idor recibo'; EXCEPTION WHEN insufficient_privilege OR raise_exception THEN IF SQLERRM NOT IN ('comm:not-available') AND SQLSTATE <> '42501' THEN RAISE; END IF; END;
  ok := ok || 'family ';

  -- Retificação: nova versão em rascunho não vaza; família continua vendo a publicada até republicar.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  PERFORM public.record_school_communication_version(c, 1, NULL, 'Reunião (nova data)', 'Reunião de pais na segunda.', 'familias-da-escola', NULL, true, 'data alterada');
  SELECT x.state INTO s FROM public.school_communications_at(sa) x WHERE x.communication_id = c; IF s <> 'retificacao-em-rascunho' THEN RAISE EXCEPTION 'estado %', s; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uf, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.family_communications(st) f WHERE f.communication_id = c AND f.version = 1; IF n <> 1 THEN RAISE EXCEPTION 'retificacao vazou'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  PERFORM public.record_school_communication_act(c, 1, 'publicacao', NULL);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uf, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.family_communications(st) f WHERE f.communication_id = c AND f.version = 2 AND f.rectified AND f.acknowledged_at IS NULL; IF n <> 1 THEN RAISE EXCEPTION 'republicacao'; END IF;
  ok := ok || 'rectify ';

  -- Cancelamento some da família; histórico preservado.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_school_communication_act(c2, 1, 'cancelamento', ' '); RAISE EXCEPTION 'motivo'; EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM public.record_school_communication_act(c2, 1, 'cancelamento', 'enviado por engano');
  BEGIN PERFORM public.record_school_communication_version(c2, 1, NULL, 'x', 'y', 'familias-da-turma', cls, false, 'x'); RAISE EXCEPTION 'editar cancelado'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'comm:cancelled' THEN RAISE; END IF; END;
  SELECT count(*) INTO n FROM public.school_communication_history(c); IF n <> 4 THEN RAISE EXCEPTION 'historia %', n; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uf, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.family_communications(st); IF n <> 1 THEN RAISE EXCEPTION 'cancelado visivel'; END IF;
  ok := ok || 'cancel ';

  -- Escola B e professor fora do escopo.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ub, 'role','authenticated')::text, true);
  BEGIN PERFORM public.school_communications_at(sa); RAISE EXCEPTION 'B leu A'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_school_communication_act(c, 3, 'cancelamento', 'x'); RAISE EXCEPTION 'B agiu em A'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.school_communication_history(c); RAISE EXCEPTION 'B historico'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' AND SQLERRM <> 'comm:not-available' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_school_communication_version(NULL, NULL, sa, 'x', 'y', 'familias-da-escola', NULL, false, NULL); RAISE EXCEPTION 'prof escola'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_school_communication_version(NULL, NULL, sa, 'x', 'y', 'familias-da-turma', cls, false, NULL); RAISE EXCEPTION 'prof sem atribuicao'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  SELECT count(*) INTO n FROM public.school_communications_at(sa); IF n <> 0 THEN RAISE EXCEPTION 'prof viu de outros'; END IF;
  ok := ok || 'scope ';

  -- Professor com atribuição vigente na turma 1 (atribuição sintética; guarda de matriz suspensa só nesta transação).
  RESET ROLE;
  SET LOCAL session_replication_role = replica;
  INSERT INTO public.teaching_assignments(id, class_id) VALUES (ta, cls);
  INSERT INTO public.teaching_assignment_versions(assignment_id, version, change_kind, valid_from, engagement_id, matrix_id, matrix_version_id, item_key, recorded_by, recorded_via_engagement_id)
    VALUES (ta, 1, 'constituicao', '2026-08-01', et, 'aj-e2e', gen_random_uuid(), 'aj-e2e', us, es);
  SET LOCAL session_replication_role = origin;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role','authenticated')::text, true);
  ct := public.record_school_communication_version(NULL, NULL, sa, 'Tarefa', 'Trazer material.', 'familias-da-turma', cls, false, NULL);
  BEGIN PERFORM public.record_school_communication_version(NULL, NULL, sa, 'x', 'y', 'familias-da-turma', cls2, false, NULL); RAISE EXCEPTION 'prof outra turma'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  PERFORM public.record_school_communication_act(ct, 0, 'publicacao', NULL);
  SELECT count(*) INTO n FROM public.school_communications_at(sa); IF n <> 1 THEN RAISE EXCEPTION 'prof ve so os seus %', n; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uf2, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.family_communications(st2) f WHERE f.communication_id = ct; IF n <> 0 THEN RAISE EXCEPTION 'turma 1 vazou p/ turma 2'; END IF;
  ok := ok || 'teacher ';

  -- Revogação impede acesso futuro.
  RESET ROLE;
  INSERT INTO public.guardian_authorizations(logical_id, version, supersedes_id, event_kind, student_id, guardian_user_id, school_id, relation_scheme_id, relation_value_id, sections, valid_from, reason, recorded_by, recorded_engagement)
    SELECT a.logical_id, 2, a.id, 'revogacao', a.student_id, a.guardian_user_id, a.school_id, a.relation_scheme_id, a.relation_value_id, a.sections, a.valid_from, 'aj-e2e revoga', us, es FROM public.guardian_authorizations a WHERE a.id = ga;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uf, 'role','authenticated')::text, true);
  BEGIN PERFORM public.family_communications(st); RAISE EXCEPTION 'revogado leu'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'family:not-authorized' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_family_communication_receipt(st, v1, 'leitura'); RAISE EXCEPTION 'revogado recibo'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'family:not-authorized' THEN RAISE; END IF; END;
  ok := ok || 'revoke ';

  -- Papéis técnicos e imutabilidade.
  RESET ROLE; SET LOCAL ROLE anon;
  BEGIN PERFORM public.family_communications(st); RAISE EXCEPTION 'anon'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE service_role;
  BEGIN PERFORM public.record_school_communication_act(c, 3, 'cancelamento', 'x'); RAISE EXCEPTION 'service_role writer'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.school_communication_acts(communication_id, sequence, act, version_id, author_user_id, author_person_id, author_engagement)
        SELECT c, 9, 'publicacao', v1, us, ps, es; RAISE EXCEPTION 'service_role DML'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  BEGIN UPDATE public.school_communication_versions SET body = 'adulterado' WHERE id = v1; RAISE EXCEPTION 'mutavel'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'mutavel' THEN RAISE; END IF; END;
  ok := ok || 'roles ';

  RAISE EXCEPTION 'aj-e2e-ok: %', ok;
END $t$;
