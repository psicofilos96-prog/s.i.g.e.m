-- AH — E2E transacional sintético de Educação Inclusiva/AEE/Mediação. Termina em RAISE: nada persiste.
-- Cobre: AEE entidade própria (agenda, sessões, frequência AEE separada do Diário), mediador M e outro mediador,
-- troca/encerramento com histórico, vigência, escola B, não inferência, IDOR uniforme, rede só agregada,
-- elegibilidade pendente, papéis técnicos e imutabilidade.
-- Executado em 2026-10-06 após 0167–0169: ah-e2e-ok (todas as etapas), rollback sem resíduos.
DO $t$
DECLARE
  un uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); um uuid := gen_random_uuid(); um2 uuid := gen_random_uuid();
  unet uuid := gen_random_uuid(); uq uuid := gen_random_uuid();
  sa text; sb text; y text := 'ano-ah-e2e-sintetico'; cls text := 'turma-ah-e2e';
  pm uuid; pm2 uuid; pn uuid; em uuid; em2 uuid; eold uuid; eresp uuid; erespb uuid;
  st text; stb text; en text; svc uuid; svc2 uuid; sess uuid; sess2 uuid; svl uuid; med uuid; med2 uuid; medend uuid; rec uuid;
  att_before bigint; att_after bigint; n int; j jsonb; ok text := '';
BEGIN
  SET LOCAL statement_timeout = '55s'; SET LOCAL lock_timeout = '5s';
  SELECT s.id INTO sa FROM public.institutional_schools s ORDER BY s.id LIMIT 1;
  SELECT s.id INTO sb FROM public.institutional_schools s WHERE s.id <> sa ORDER BY s.id LIMIT 1;
  SELECT count(*) INTO att_before FROM public.attendance_record_versions;
  INSERT INTO public.institutional_academic_years(id) VALUES (y);
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from, originating_act_ref, technical_operation_id)
    VALUES (y, 1, 'AH Ano Sintético', '2026-08-01', '2026-12-31', true, '2026-08-01', 'ah-e2e', (SELECT o.id FROM public.technical_execution_operations o ORDER BY o.id LIMIT 1));
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance) VALUES (y, 1, 'operacional', 'ah-e2e', 'ah-e2e');
  INSERT INTO public.institutional_classes(id, school_id, school_label_snapshot, academic_year_id, academic_year_label, name, valid_from)
    VALUES (cls, sa, 'A', y, 'AH', 'AH Turma', '2026-08-01');
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AH NEI', 'pessoa-natural') RETURNING id INTO pn;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AH Mediador M', 'pessoa-natural') RETURNING id INTO pm;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AH Mediador 2', 'pessoa-natural') RETURNING id INTO pm2;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (un, pn), (um, pm), (um2, pm2);
  WITH p AS (INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AH Escola B', 'pessoa-natural'), ('AH Rede', 'pessoa-natural'), ('AH Órgão', 'orgao-institucional') RETURNING id, display_name)
  INSERT INTO public.user_person_links(user_id, person_id) SELECT CASE p.display_name WHEN 'AH Escola B' THEN ub WHEN 'AH Rede' THEN unet ELSE uq END, p.id FROM p;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pm, 'ah-e2e-atuacao', sa, '2026-08-01', 'escola') RETURNING id INTO em;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pm2, 'ah-e2e-atuacao', sa, '2026-08-01', 'escola') RETURNING id INTO em2;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, valid_until, scope_level) VALUES (pm2, 'ah-e2e-atuacao', sa, '2026-01-01', '2026-02-01', 'escola') RETURNING id INTO eold;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pn, 'ah-e2e-atuacao', sa, '2026-08-01', 'escola') RETURNING id INTO eresp;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pn, 'ah-e2e-atuacao', sb, '2026-08-01', 'escola') RETURNING id INTO erespb;
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status) VALUES ('ah-e2e-presenca', 'compareceu', 1, 'Compareceu', 'homologada'), ('ah-e2e-presenca', 'rascunho', 1, 'Rascunho', 'rascunho');

  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_ah_original;
  EXECUTE format($s$CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT c, %L::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, 1, 'escola', %L
        FROM unnest(ARRAY['cadastrar-estudante-na-escola','manter-matricula-e-enturmacao','consultar-matricula-e-movimentacao',
          'organizar-atendimento-aee','registrar-sessao-aee','consultar-apoio-inclusivo','registrar-apoio-inclusivo','manter-mediacao-escolar']) c WHERE auth.uid() = %L::uuid
      UNION ALL SELECT c, %L::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, 1, 'escola', %L
        FROM unnest(ARRAY['cadastrar-estudante-na-escola','manter-matricula-e-enturmacao','organizar-atendimento-aee','registrar-sessao-aee','consultar-apoio-inclusivo']) c WHERE auth.uid() = %L::uuid
      UNION ALL SELECT 'acompanhar-educacao-inclusiva-rede', '00000000-0000-0000-0000-0000000000a9'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, 1, 'rede', NULL WHERE auth.uid() IN (%L::uuid, %L::uuid)
      UNION ALL SELECT 'organizar-atendimento-aee', '00000000-0000-0000-0000-0000000000a8'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, 1, 'escola', %L WHERE auth.uid() = %L::uuid $b$$s$,
      eresp, sa, un, erespb, sb, ub, unet, uq, sa, uq);
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated';

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', un, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  st := public.register_student_for_school(sa, 'AH Aluno A', '52998224725', '');
  en := public.enroll_student_in_school_year(st, sa, y, '2026-08-03', NULL);
  PERFORM public.secretariat_allocate_to_class(en, cls, '2026-08-03', NULL);

  -- Não inferência: matrícula/turma não criam AEE nem mediação; elegibilidade não é calculada.
  SELECT count(*) INTO n FROM public.aee_services_at(sa, st, NULL); IF n <> 0 THEN RAISE EXCEPTION 'aee inferido'; END IF;
  SELECT count(*) INTO n FROM public.inclusion_mediations_at(sa, NULL) m WHERE m.student_id = st; IF n <> 0 THEN RAISE EXCEPTION 'mediacao inferida'; END IF;
  BEGIN PERFORM public.record_inclusion_record(NULL, 'registro', 'atendimento-aee', sa, st, NULL, NULL, 'p', 'b', '2026-08-05', NULL, false, NULL); RAISE EXCEPTION 'aee generico';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'inclusion:aee-is-own-entity%' THEN RAISE; END IF; END;
  ok := ok || 'nao-inferencia(aee,mediacao,tipo-generico); ';

  -- AEE: organização + agenda, overlap, responsável inativo, slots inválidos
  BEGIN PERFORM public.record_aee_service(NULL, 'registro', sa, st, eold, '2026-08-05', NULL, '[]', NULL); RAISE EXCEPTION 'resp inativo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'inclusion:responsible-not-active-in-school%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_aee_service(NULL, 'registro', sa, st, eresp, '2026-08-05', NULL, '[{"weekday":9,"starts_at":"08:00","ends_at":"09:00"}]', NULL); RAISE EXCEPTION 'slot';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'inclusion:slots-invalid%' THEN RAISE; END IF; END;
  svc := public.record_aee_service(NULL, 'registro', sa, st, eresp, '2026-08-05', NULL, '[{"weekday":2,"starts_at":"14:00","ends_at":"15:00"}]', NULL);
  BEGIN PERFORM public.record_aee_service(NULL, 'registro', sa, st, eresp, '2026-09-01', NULL, '[]', NULL); RAISE EXCEPTION 'overlap aee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'inclusion:aee-overlap%' THEN RAISE; END IF; END;
  SELECT to_jsonb(a) INTO j FROM public.aee_services_at(sa, st, NULL) a;
  IF j->>'eligibility_status' <> 'regra-institucional-pendente' OR jsonb_array_length(j->'slots') <> 1 THEN RAISE EXCEPTION 'leitura aee: %', j; END IF;
  svl := (j->>'logical_id')::uuid;
  ok := ok || 'aee(entidade,agenda,resp-inativo,slot-invalido,overlap,elegibilidade-pendente); ';

  -- Sessões: frequência AEE própria, catálogo homologado, fora da vigência, duplicada, retificação, stale
  BEGIN PERFORM public.record_aee_session(NULL, 'registro', svl, '2026-08-11', 'ah-e2e-presenca', 'rascunho', NULL, NULL); RAISE EXCEPTION 'cat';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'inclusion:presence-not-homologated%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_aee_session(NULL, 'registro', svl, '2026-08-01', 'ah-e2e-presenca', 'compareceu', NULL, NULL); RAISE EXCEPTION 'fora';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'inclusion:session-outside-service%' THEN RAISE; END IF; END;
  sess := public.record_aee_session(NULL, 'registro', svl, '2026-08-11', 'ah-e2e-presenca', 'compareceu', 'Atividade de comunicação alternativa.', NULL);
  BEGIN PERFORM public.record_aee_session(NULL, 'registro', svl, '2026-08-11', 'ah-e2e-presenca', 'compareceu', NULL, NULL); RAISE EXCEPTION 'dup';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'inclusion:session-duplicate%' THEN RAISE; END IF; END;
  sess2 := public.record_aee_session(sess, 'retificacao', NULL, NULL, 'ah-e2e-presenca', 'compareceu', 'Nota corrigida.', 'Correção da nota');
  BEGIN PERFORM public.record_aee_session(sess, 'retificacao', NULL, NULL, 'ah-e2e-presenca', 'compareceu', NULL, 'x'); RAISE EXCEPTION 'stale sessao';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'inclusion:base-superseded%' THEN RAISE; END IF; END;
  SELECT count(*) INTO n FROM public.aee_sessions_at(svl, NULL) s WHERE s.version = 2;
  IF n <> 1 THEN RAISE EXCEPTION 'sessao v2'; END IF;
  ok := ok || 'sessoes(catalogo,fora-vigencia,duplicada,retificacao,stale); ';

  -- Mediação: M vigente; overlap mesmo mediador; atuação inativa; troca para outro mediador com encerramento
  BEGIN PERFORM public.record_inclusion_mediation(NULL, 'registro', sa, st, cls, eold, '2026-08-05', NULL, NULL); RAISE EXCEPTION 'med inativa';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'inclusion:mediator-engagement-not-active%' THEN RAISE; END IF; END;
  med := public.record_inclusion_mediation(NULL, 'registro', sa, st, cls, em, '2026-08-05', NULL, NULL);
  BEGIN PERFORM public.record_inclusion_mediation(NULL, 'registro', sa, st, cls, em, '2026-09-01', NULL, NULL); RAISE EXCEPTION 'overlap med';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'inclusion:mediation-overlap%' THEN RAISE; END IF; END;
  rec := public.record_inclusion_record(NULL, 'registro', 'plano-educacional', sa, st, NULL, NULL, 'Organizar apoio em sala', 'Estratégias pedagógicas.', '2026-08-05', NULL, true, NULL);
  PERFORM public.record_inclusion_record(NULL, 'registro', 'relatorio-pedagogico', sa, st, NULL, NULL, 'Relatório', 'Restrito à equipe.', '2026-08-05', NULL, false, NULL);

  -- Estação do mediador M: vê só o aluno vinculado e só o registro compartilhado
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', um, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.inclusion_my_mediated_students(CURRENT_DATE) WHERE student_id = st; IF n <> 1 THEN RAISE EXCEPTION 'meus alunos M'; END IF;
  SELECT count(*) INTO n FROM public.inclusion_records_at(sa, st, NULL, NULL); IF n <> 1 THEN RAISE EXCEPTION 'mediador ve % registros', n; END IF;
  SELECT count(*) INTO n FROM public.inclusion_my_mediated_students('2026-08-01'); IF n <> 0 THEN RAISE EXCEPTION 'antes da vigencia'; END IF;
  BEGIN PERFORM public.aee_services_at(sa, st, NULL); RAISE EXCEPTION 'mediador ve aee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_inclusion_mediation(NULL, 'registro', sa, st, cls, em, '2026-10-01', NULL, NULL); RAISE EXCEPTION 'mediador auto';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  -- Outro mediador: nada
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', um2, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.inclusion_my_mediated_students(CURRENT_DATE); IF n <> 0 THEN RAISE EXCEPTION 'outro mediador ve'; END IF;
  BEGIN PERFORM public.inclusion_records_at(sa, st, NULL, NULL); RAISE EXCEPTION 'outro mediador le';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  -- Professor/sem atribuição: nenhuma marcação
  SELECT count(*) INTO n FROM public.inclusion_teaching_support_flags(CURRENT_DATE); IF n <> 0 THEN RAISE EXCEPTION 'flags sem atribuicao'; END IF;
  ok := ok || 'mediador(vigente,inativo,overlap,meus-alunos,so-compartilhado,antes-vigencia,sem-aee,outro-mediador,professor-sem-atribuicao); ';

  -- Troca: encerra M em 2026-09-30 e vincula mediador 2 a partir de 2026-10-01; histórico preservado
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', un, 'role','authenticated')::text, true);
  medend := public.record_inclusion_mediation(med, 'encerramento', NULL, NULL, NULL, NULL, NULL, '2026-09-30', 'Troca de mediador');
  med2 := public.record_inclusion_mediation(NULL, 'registro', sa, st, cls, em2, '2026-10-01', NULL, NULL);
  RESET ROLE;
  SELECT count(*) INTO n FROM public.inclusion_mediation_assignments WHERE logical_id = (SELECT logical_id FROM public.inclusion_mediation_assignments WHERE id = med);
  IF n <> 2 THEN RAISE EXCEPTION 'historico mediacao %', n; END IF;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', um, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.inclusion_my_mediated_students(CURRENT_DATE); IF n <> 0 THEN RAISE EXCEPTION 'M apos encerramento'; END IF;
  BEGIN PERFORM public.inclusion_records_at(sa, st, NULL, NULL); RAISE EXCEPTION 'M le apos encerramento';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', um2, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.inclusion_my_mediated_students(CURRENT_DATE) WHERE student_id = st; IF n <> 1 THEN RAISE EXCEPTION 'mediador 2'; END IF;
  ok := ok || 'troca(encerramento,historico,M-perde-acesso,M2-ganha); ';

  -- Escola B: não lê, não organiza, não vê sessões (IDOR uniforme com inexistente)
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ub, 'role','authenticated')::text, true);
  BEGIN PERFORM public.aee_services_at(sa, st, NULL); RAISE EXCEPTION 'B le A';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.aee_sessions_at(svl, NULL); RAISE EXCEPTION 'B sessoes';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:consultar-apoio-inclusivo' THEN RAISE; END IF; END;
  BEGIN PERFORM public.aee_sessions_at(gen_random_uuid(), NULL); RAISE EXCEPTION 'inexistente';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:consultar-apoio-inclusivo' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_aee_service(svc, 'encerramento', NULL, NULL, NULL, NULL, '2026-12-01', NULL, 'x'); RAISE EXCEPTION 'B encerra A';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_aee_service(NULL, 'registro', sb, st, erespb, '2026-08-05', NULL, '[]', NULL); RAISE EXCEPTION 'aluno de A em B';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'inclusion:student-not-in-school%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.inclusion_network_overview(CURRENT_DATE); RAISE EXCEPTION 'B rede';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  ok := ok || 'escola-b(leitura,sessoes,idor-uniforme,encerrar,aluno-alheio,rede); ';

  -- Rede: só contagens, sem educando
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', unet, 'role','authenticated')::text, true);
  SELECT to_jsonb(o) INTO j FROM public.inclusion_network_overview(CURRENT_DATE) o WHERE o.school_id = sa;
  IF (j->>'active_aee_services')::int < 1 OR (j->>'active_mediations')::int < 1 OR j ? 'student_id' THEN RAISE EXCEPTION 'rede %', j; END IF;
  BEGIN PERFORM public.aee_services_at(sa, NULL, NULL); RAISE EXCEPTION 'rede ve detalhe';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  ok := ok || 'rede(agregado,sem-detalhe); ';

  -- Órgão institucional não pratica ato humano
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uq, 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_aee_service(NULL, 'registro', sa, st, eresp, '2027-01-10', NULL, '[]', NULL); RAISE EXCEPTION 'orgao';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'secretariat:natural-person-required%' THEN RAISE; END IF; END;

  -- DML direto e append-only
  BEGIN INSERT INTO public.aee_sessions(logical_id, version, event_kind, service_logical_id, school_id, student_id, session_date, presence_scheme_id, presence_value_id, presence_value_version, author_user_id, author_person_id, author_engagement)
    VALUES (gen_random_uuid(), 1, 'registro', gen_random_uuid(), sa, st, '2026-08-12', 'x', 'y', 1, un, pn, eresp); RAISE EXCEPTION 'dml auth';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  BEGIN UPDATE public.aee_services SET reason = 'x' WHERE id = svc; RAISE EXCEPTION 'append-only';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'append-only' THEN RAISE; END IF; END;
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.aee_services_at(sa, NULL, NULL); RAISE EXCEPTION 'anon';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE service_role;
  BEGIN PERFORM public.record_aee_service(NULL, 'registro', sa, st, eresp, '2027-01-10', NULL, '[]', NULL); RAISE EXCEPTION 'service writer';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.inclusion_records(logical_id, version, event_kind, record_type, school_id, student_id, educational_purpose, body, valid_from, author_user_id, author_engagement)
    VALUES (gen_random_uuid(), 1, 'registro', 'plano-educacional', sa, st, 'p', 'b', '2026-08-05', un, eresp); RAISE EXCEPTION 'service dml';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  ok := ok || 'tecnicos(orgao,dml,append-only,anon,service_role); ';

  -- Diário regular intacto
  SELECT count(*) INTO att_after FROM public.attendance_record_versions;
  IF att_after <> att_before THEN RAISE EXCEPTION 'diario alterado'; END IF;
  ok := ok || 'diario-regular-intacto';

  RAISE EXCEPTION 'ah-e2e-ok: %', ok;
END $t$;
