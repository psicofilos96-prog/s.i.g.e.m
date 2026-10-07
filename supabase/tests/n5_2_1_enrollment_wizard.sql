-- N5.2.1 — prova ponta a ponta da matrícula guiada com contas setoriais REAIS (Secretaria A e B,
-- Direção A, OP A, CIECE), simuladas por JWT dentro de UMA transação que termina em RAISE: nada persiste.
-- Fixture revertida: o ano 2026 recebe estado "operacional" só dentro da transação, porque nenhum ano está
-- aberto na base (2026 = histórico importado; 2027 sem ato de abertura e sem turmas).
DO $$
DECLARE
  yr text := 'ano-431ece00-be5c-41ed-a430-75ba853b0831';
  sa text; sb text; ua uuid; ub uuid; udir uuid; uop uuid; uciece uuid;
  ca text; cb text; d1 uuid := gen_random_uuid(); d2 uuid := gen_random_uuid(); d3 uuid := gen_random_uuid(); d4 uuid := gen_random_uuid();
  seq int; res jsonb; res2 jsonb; n int; ok text := ''; cpf text := '52998224725'; loc record; st_before int; enr_before int; ep_before int;
  PROCEDURE_dummy int;
BEGIN
  SELECT school_id, auth_user_id INTO sa, ua FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id LIMIT 1;
  SELECT school_id, auth_user_id INTO sb, ub FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id OFFSET 1 LIMIT 1;
  SELECT auth_user_id INTO udir FROM public.institutional_sector_principals WHERE station_code = 'direcao_escolar' AND school_id = sa;
  SELECT auth_user_id INTO uop FROM public.institutional_sector_principals WHERE station_code = 'orientacao_pedagogica' AND school_id = sa;
  SELECT auth_user_id INTO uciece FROM public.institutional_sector_principals WHERE station_code = 'ciece';
  SELECT id INTO ca FROM public.institutional_classes WHERE school_id = sa AND academic_year_id = yr ORDER BY id LIMIT 1;
  SELECT id INTO cb FROM public.institutional_classes WHERE school_id = sb AND academic_year_id = yr ORDER BY id LIMIT 1;
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    VALUES (yr, 2, 'operacional', 'FIXTURE REVERTIDA N5.2.1', 'technical:n5-2-1-rollback');
  SELECT count(*) INTO st_before FROM public.institutional_students;
  SELECT count(*) INTO enr_before FROM public.school_enrollments;
  SELECT count(*) INTO ep_before FROM public.class_enrollment_episodes;

  -- ===== A) Secretaria A: novo aluno, rascunho, "sair", retomar, concluir, enturmar, ficha =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT * INTO loc FROM public.locate_student_exact(sa, 'cpf', cpf, yr);
  IF loc.outcome <> 'nao-encontrado' THEN RAISE EXCEPTION 'A: CPF de teste já existe (%), prova inválida', loc.outcome; END IF;
  seq := public.enrollment_draft_save(d1, sa, 0, 1, '{"aluno":{"nome":"FIXTURE N521 ALUNO"}}'::jsonb, cpf, NULL, NULL);
  seq := public.enrollment_draft_save(d1, sa, seq, 3, '{"aluno":{"nome":"FIXTURE N521 ALUNO"},"responsaveis":[{"nome":"FIXTURE RESP","telefone":"22999990000"}],"endereco":{"logradouro":"Rua Fixture"}}'::jsonb, NULL, NULL, NULL);
  -- "fechar o navegador": nada no cliente; a retomada vem só do banco
  SELECT count(*) INTO n FROM public.enrollment_drafts_open(sa) o WHERE o.draft_id = d1 AND o.step = 3 AND o.has_cpf AND o.cpf_hint = '25' AND o.payload #>> '{endereco,logradouro}' = 'Rua Fixture';
  IF n <> 1 THEN RAISE EXCEPTION 'A: retomada falhou'; END IF;
  IF EXISTS (SELECT 1 FROM public.enrollment_wizard_draft_events WHERE draft_id = d1 AND payload::text LIKE '%' || cpf || '%') THEN RAISE EXCEPTION 'A: CPF em texto no rascunho'; END IF;
  BEGIN PERFORM public.enrollment_draft_save(d1, sa, 1, 4, '{}'::jsonb, NULL, NULL, NULL); RAISE EXCEPTION 'A: stale aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%draft:stale-head%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.enrollment_draft_save(d1, sa, seq, 4, '{"cpf":"x"}'::jsonb, NULL, NULL, NULL); RAISE EXCEPTION 'A: cpf no payload aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%draft:payload-invalid%' THEN RAISE; END IF; END;
  seq := public.enrollment_draft_save(d1, sa, seq, 8, '{"aluno":{"nome":"FIXTURE N521 ALUNO"},"responsaveis":[{"nome":"FIXTURE RESP","telefone":"22999990000"}],"endereco":{"logradouro":"Rua Fixture"}}'::jsonb, NULL, NULL, NULL);
  -- C) turma da outra escola: recusa e nada parcial; rascunho continua aberto
  BEGIN PERFORM public.enrollment_draft_complete(d1, seq, yr, '2026-03-02', cb); RAISE EXCEPTION 'C: turma de outra escola aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%secretariat:class-invalid%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.institutional_students) <> st_before OR (SELECT count(*) FROM public.school_enrollments) <> enr_before THEN RAISE EXCEPTION 'C: fato parcial'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.enrollment_drafts_open(sa) o WHERE o.draft_id = d1) THEN RAISE EXCEPTION 'C: rascunho perdido'; END IF;
  -- D) falha no passo final (data fora do ano): nada gravado, histórico consistente
  BEGIN PERFORM public.enrollment_draft_complete(d1, seq, yr, '2030-01-01', ca); RAISE EXCEPTION 'D: data fora do ano aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%secretariat:outside-year%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.institutional_students) <> st_before OR (SELECT count(*) FROM public.school_enrollments) <> enr_before
     OR (SELECT count(*) FROM public.class_enrollment_episodes) <> ep_before THEN RAISE EXCEPTION 'D: fato parcial após falha'; END IF;
  IF (SELECT max(sequence) FROM public.enrollment_wizard_draft_events WHERE draft_id = d1) <> seq THEN RAISE EXCEPTION 'D: histórico do rascunho alterado'; END IF;
  res := public.enrollment_draft_complete(d1, seq, yr, '2026-03-02', ca);
  IF NOT (res->>'student_created')::boolean OR res->>'episode_id' IS NULL THEN RAISE EXCEPTION 'A: conclusão incompleta %', res; END IF;
  IF EXISTS (SELECT 1 FROM public.enrollment_drafts_open(sa) o WHERE o.draft_id = d1) THEN RAISE EXCEPTION 'A: rascunho não encerrado'; END IF;
  SELECT count(*) INTO n FROM public.student_school_life(sa, res->>'student_id') l WHERE l.kind IN ('vinculo-anual','turma');
  IF n <> 2 THEN RAISE EXCEPTION 'A: ficha não reflete matrícula+turma (%)', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.enrollment_form_for_student(sa, res->>'student_id') f WHERE f.payload #>> '{responsaveis,0,nome}' = 'FIXTURE RESP') THEN RAISE EXCEPTION 'A: ficha complementar ausente'; END IF;
  IF (SELECT author_actor_kind FROM public.enrollment_wizard_draft_events WHERE draft_id = d1 AND kind = 'concluido') <> 'institutional' THEN RAISE EXCEPTION 'A: ator não registrado'; END IF;
  BEGIN PERFORM public.enrollment_draft_complete(d1, seq + 1, yr, '2026-03-02', ca); RAISE EXCEPTION 'A: conclusão dupla aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%draft:closed%' THEN RAISE; END IF; END;
  ok := ok || 'A,C,D ';

  -- ===== B) dedupe: mesmo CPF encontra o cadastro e reutiliza a pessoa, sem duplicar estudante =====
  SELECT * INTO loc FROM public.locate_student_exact(sa, 'cpf', cpf, yr);
  IF loc.outcome <> 'encontrado' OR loc.student_id <> res->>'student_id' OR NOT loc.active_here THEN RAISE EXCEPTION 'B: dedupe não encontrou'; END IF;
  seq := public.enrollment_draft_save(d2, sa, 0, 1, '{}'::jsonb, NULL, NULL, loc.student_id);
  SELECT count(*) INTO n FROM public.institutional_students;
  res2 := public.enrollment_draft_complete(d2, seq, yr, '2026-03-02', NULL);
  IF res2->>'student_id' <> res->>'student_id' OR res2->>'enrollment_id' <> res->>'enrollment_id' OR (res2->>'student_created')::boolean THEN RAISE EXCEPTION 'B: duplicou %', res2; END IF;
  IF (SELECT count(*) FROM public.institutional_students) <> n THEN RAISE EXCEPTION 'B: estudante duplicado'; END IF;
  -- novo rascunho com o mesmo CPF sem escolher o cadastro existente: conclusão recusa (nunca mescla)
  seq := public.enrollment_draft_save(d4, sa, 0, 1, '{"aluno":{"nome":"OUTRO NOME"}}'::jsonb, cpf, NULL, NULL);
  BEGIN PERFORM public.enrollment_draft_complete(d4, seq, yr, '2026-03-02', NULL); RAISE EXCEPTION 'B: mescla silenciosa';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%identity:already-registered-use-search%' THEN RAISE; END IF; END;
  ok := ok || 'B ';

  -- ===== E) Secretaria B não vê nem altera nada da escola A; school_id adulterado falha =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM public.enrollment_drafts_open(sb) o WHERE o.draft_id IN (d1, d2, d4)) THEN RAISE EXCEPTION 'E: B vê rascunho de A'; END IF;
  BEGIN PERFORM public.enrollment_drafts_open(sa); RAISE EXCEPTION 'E: B lista A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%draft:capability-missing%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.enrollment_draft_save(d3, sa, 0, 1, '{}'::jsonb, NULL, NULL, NULL); RAISE EXCEPTION 'E: B grava em A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%draft:capability-missing%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.enrollment_draft_save(d4, sb, 2, 2, '{}'::jsonb, NULL, NULL, NULL); RAISE EXCEPTION 'E: troca de escola aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%draft:school-immutable%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.enrollment_draft_complete(d4, 1, yr, '2026-03-02', NULL); RAISE EXCEPTION 'E: B conclui A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%draft:not-found%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.enrollment_form_for_student(sa, res->>'student_id'); RAISE EXCEPTION 'E: B lê ficha de A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%secretariat:not-found%' THEN RAISE; END IF; END;
  seq := public.enrollment_draft_save(d3, sb, 0, 1, '{"aluno":{"nome":"FIXTURE N521 B"}}'::jsonb, NULL, '123456789012', NULL);
  res2 := public.enrollment_draft_complete(d3, seq, yr, '2026-03-02', cb);
  IF res2->>'episode_id' IS NULL THEN RAISE EXCEPTION 'E: B não conclui na própria escola'; END IF;
  ok := ok || 'E ';

  -- ===== Direção, OP e CIECE não ganham writer =====
  FOREACH ua IN ARRAY ARRAY[udir, uop, uciece] LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    BEGIN PERFORM public.enrollment_draft_save(gen_random_uuid(), sa, 0, 1, '{}'::jsonb, NULL, NULL, NULL); RAISE EXCEPTION 'Perfil sem capability gravou';
    EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%draft:capability-missing%' THEN RAISE; END IF; END;
    BEGIN PERFORM public.enrollment_draft_complete(d4, 1, yr, '2026-03-02', NULL); RAISE EXCEPTION 'Perfil sem capability concluiu';
    EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%draft:not-found%' THEN RAISE; END IF; END;
  END LOOP;
  ok := ok || 'DIR/OP/CIECE ';
  -- tabela de rascunho não é acessível diretamente
  BEGIN PERFORM 1 FROM public.enrollment_wizard_draft_events LIMIT 1; RAISE EXCEPTION 'tabela legível diretamente';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ok := ok || 'ACL';
  RAISE EXCEPTION 'N521-PROOF-PASS %', ok;
END $$;
