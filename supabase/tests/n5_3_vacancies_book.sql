-- N5.3 — prova de Vagas + Livro de Matrícula com contas setoriais REAIS (Secretaria A/B, Direção A, OP A, CIECE)
-- numa ÚNICA transação que termina em RAISE: nada persiste. Fixture revertida: ano 2026 "operacional" e capacidade 1 na turma A.
DO $$
DECLARE
  yr text := 'ano-431ece00-be5c-41ed-a430-75ba853b0831'; dt date := '2026-09-01';
  sa text; sb text; ua uuid; ub uuid; udir uuid; uop uuid; uciece uuid; ca text; ca2 text;
  d1 uuid := gen_random_uuid(); d2 uuid := gen_random_uuid(); seq int; res jsonb; n int; st text; ok text := '';
  st0 int; en0 int; ep0 int; book0 int;
BEGIN
  SELECT school_id, auth_user_id INTO sa, ua FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id LIMIT 1;
  SELECT school_id, auth_user_id INTO sb, ub FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id OFFSET 1 LIMIT 1;
  SELECT auth_user_id INTO udir FROM public.institutional_sector_principals WHERE station_code = 'direcao_escolar' AND school_id = sa;
  SELECT auth_user_id INTO uop FROM public.institutional_sector_principals WHERE station_code = 'orientacao_pedagogica' AND school_id = sa;
  SELECT auth_user_id INTO uciece FROM public.institutional_sector_principals WHERE station_code = 'ciece';
  SELECT c.id INTO ca FROM public.institutional_classes c WHERE c.school_id = sa AND c.academic_year_id = yr
    AND EXISTS (SELECT 1 FROM public.class_at(c.id, dt, NULL) a WHERE a.administrative_status = 'ativa') ORDER BY c.id LIMIT 1;
  SELECT c.id INTO ca2 FROM public.institutional_classes c WHERE c.school_id = sa AND c.academic_year_id = yr AND c.id <> ca
    AND EXISTS (SELECT 1 FROM public.class_at(c.id, dt, NULL) a WHERE a.administrative_status = 'ativa') ORDER BY c.id LIMIT 1;
  IF ca IS NULL OR ca2 IS NULL THEN RAISE EXCEPTION 'fixture: escola A sem duas turmas ativas'; END IF;
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    VALUES (yr, 2, 'operacional', 'FIXTURE REVERTIDA N5.3', 'technical:n5-3-rollback');
  INSERT INTO public.class_capacity_records(logical_id, version, class_id, school_id, reference_limit, valid_from, basis_text, change_reason, recorded_by)
    VALUES ('cap-fixture-n53', 1, ca, sa, 1, '2026-01-01', 'FIXTURE REVERTIDA N5.3', 'fixture', ua);
  SELECT count(*) INTO st0 FROM public.institutional_students; SELECT count(*) INTO en0 FROM public.school_enrollments; SELECT count(*) INTO ep0 FROM public.class_enrollment_episodes;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  -- D/E) capacidade informada = "ha-vaga"; ausente = "capacidade-nao-informada" e vagas NULL (nunca zero)
  SELECT v.vacancy_state INTO st FROM public.secretariat_class_vacancies_at(sa, yr, dt) v WHERE v.class_id = ca;
  IF st <> 'ha-vaga' THEN RAISE EXCEPTION 'D: esperado ha-vaga, veio %', st; END IF;
  SELECT count(*) INTO n FROM public.secretariat_class_vacancies_at(sa, yr, dt) v WHERE v.class_id = ca2 AND v.vacancy_state = 'capacidade-nao-informada' AND v.capacity IS NULL AND v.available IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'E: ausência de capacidade não honesta'; END IF;
  SELECT count(*) INTO book0 FROM public.secretariat_enrollment_book_at(sa, yr, NULL);
  -- matrícula 1 ocupa a única vaga
  seq := public.enrollment_draft_save(d1, sa, 0, 8, '{"aluno":{"nome":"FIXTURE N53 UM"}}'::jsonb, '11144477735', NULL, NULL);
  res := public.enrollment_draft_complete(d1, seq, yr, dt, ca);
  SELECT v.vacancy_state INTO st FROM public.secretariat_class_vacancies_at(sa, yr, dt) v WHERE v.class_id = ca;
  IF st <> 'lotada' THEN RAISE EXCEPTION 'D: esperado lotada, veio %', st; END IF;
  -- H/I) Livro reflete a matrícula canônica; leitura em knownAt anterior é reproduzível (sem a linha nova)
  SELECT count(*) INTO n FROM public.secretariat_enrollment_book_at(sa, yr, NULL) b
    WHERE b.enrollment_id = res->>'enrollment_id' AND b.student_name = 'FIXTURE N53 UM' AND b.situation = 'ativa' AND b.class_label IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'H: Livro não reflete matrícula %', res; END IF;
  IF (SELECT count(*) FROM public.secretariat_enrollment_book_at(sa, yr, NULL)) <> book0 + 1 THEN RAISE EXCEPTION 'H: Livro duplicou'; END IF;
  IF (SELECT count(*) FROM public.secretariat_enrollment_book_at(sa, yr, now() - interval '1 day')) > book0 THEN RAISE EXCEPTION 'I: knownAt não reproduz'; END IF;
  -- F) segunda matrícula na turma lotada: recusa sem fato parcial; rascunho permanece
  seq := public.enrollment_draft_save(d2, sa, 0, 8, '{"aluno":{"nome":"FIXTURE N53 DOIS"}}'::jsonb, '52998224725', NULL, NULL);
  PERFORM set_config('role', 'postgres', true);
  SELECT count(*) INTO st0 FROM public.institutional_students; SELECT count(*) INTO en0 FROM public.school_enrollments; SELECT count(*) INTO ep0 FROM public.class_enrollment_episodes;
  PERFORM set_config('role', 'authenticated', true);
  BEGIN PERFORM public.enrollment_draft_complete(d2, seq, yr, dt, ca); RAISE EXCEPTION 'F: turma lotada aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%secretariat:class-full%' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT count(*) FROM public.institutional_students) <> st0 OR (SELECT count(*) FROM public.school_enrollments) <> en0
     OR (SELECT count(*) FROM public.class_enrollment_episodes) <> ep0 THEN RAISE EXCEPTION 'F: fato parcial'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  IF NOT EXISTS (SELECT 1 FROM public.enrollment_drafts_open(sa) o WHERE o.draft_id = d2) THEN RAISE EXCEPTION 'F: rascunho perdido'; END IF;
  -- capacidade não informada não bloqueia
  res := public.enrollment_draft_complete(d2, seq, yr, dt, ca2);
  IF res->>'episode_id' IS NULL THEN RAISE EXCEPTION 'E: capacidade ausente bloqueou'; END IF;
  ok := 'D,E,F,H,I ';
  -- K) Secretaria B não lê vagas nem Livro de A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.secretariat_class_vacancies_at(sa, yr, dt); RAISE EXCEPTION 'K: B leu vagas de A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%not-authorized%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.secretariat_enrollment_book_at(sa, yr, NULL); RAISE EXCEPTION 'K: B leu Livro de A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%not-authorized%' THEN RAISE; END IF; END;
  ok := ok || 'K ';
  -- L) Direção/OP/CIECE: nenhum writer de enturmação; leitura conforme capability já existente
  DECLARE u uuid; lbl text; i int := 0;
  BEGIN
    FOREACH u IN ARRAY ARRAY[udir, uop, uciece] LOOP
      i := i + 1; lbl := (ARRAY['direcao','op','ciece'])[i];
      CONTINUE WHEN u IS NULL;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      BEGIN PERFORM public.secretariat_allocate_to_class(res->>'enrollment_id', ca, dt, NULL); RAISE EXCEPTION 'L: % enturmou', lbl;
      EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'L:%' THEN RAISE; END IF; END;
      BEGIN PERFORM public.secretariat_enrollment_book_at(sa, yr, NULL); ok := ok || lbl || '-le ';
      EXCEPTION WHEN OTHERS THEN ok := ok || lbl || '-sem-leitura '; END;
    END LOOP;
  END;
  RAISE EXCEPTION 'N53-PROOF-PASS %', ok;
END $$;
