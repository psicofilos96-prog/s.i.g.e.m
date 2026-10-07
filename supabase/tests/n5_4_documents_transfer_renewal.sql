-- N5.4 — prova de Documentos, Remanejamento, Transferência (interna/externa) e Renovação operados pela conta
-- da Secretaria Escolar (principal setorial). Uma única transação que termina em RAISE: nada persiste.
-- Fixture revertida: estado operacional do ano, ano destino sintético, tipo de movimentação sintético e modelo
-- de documento sintético (o texto institucional real NÃO existe no acervo: TEMPLATE_INSTITUCIONAL_PENDENTE).
DO $$
DECLARE
  yr text := 'ano-431ece00-be5c-41ed-a430-75ba853b0831'; y2 text := 'ano-00000540-0000-4000-8000-000000000540';
  y3 text := 'ano-00000540-0000-4000-8000-000000000541';
  dt date := '2026-09-15'; dt2 date := '2026-09-20';
  sa text; sb text; ua uuid; ub uuid; pa uuid; udir uuid; uop uuid;
  r jsonb; ca1 text; ca2 text; ok text := ''; n int; d uuid; seq int; res jsonb;
  st1 text; st2 text; st3 text; en1 text; en2 text; en3 text; ep1 text; ep2 text; ep1b text;
  tv uuid; tvt uuid; em1 jsonb; em2 jsonb; rep jsonb; sha1 text; mid uuid; enrB text; ren uuid; enrY2 text; students_before int;
BEGIN
  SELECT school_id, auth_user_id, id INTO sa, ua, pa FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id LIMIT 1;
  SELECT school_id, auth_user_id INTO sb, ub FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id OFFSET 1 LIMIT 1;
  SELECT auth_user_id INTO udir FROM public.institutional_sector_principals WHERE station_code = 'direcao_escolar' AND school_id = sa;
  SELECT auth_user_id INTO uop FROM public.institutional_sector_principals WHERE station_code = 'orientacao_pedagogica' AND school_id = sa;
  -- ===== fixture (postgres) =====
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    SELECT yr, coalesce(max(sequence), 0) + 1, 'operacional', 'FIXTURE REVERTIDA N5.4', 'technical:n5-4-rollback' FROM public.academic_year_operational_states WHERE academic_year_id = yr;
  INSERT INTO public.institutional_academic_years(id) VALUES (y2), (y3);
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    VALUES (y2, 1, 'em-preparacao', 'FIXTURE REVERTIDA N5.4', 'technical:n5-4-rollback');  -- y3 fica fechado
  INSERT INTO public.movement_type_definitions(id, version, label, status, valid_from)
    VALUES ('fixture-n54-transferencia', 1, 'Transferência (fixture)', 'homologada', '2026-01-01');
  INSERT INTO public.school_document_templates(id, document_kind, created_by) VALUES ('fixture-n54-decl', 'declaracao-escolar', ua), ('fixture-n54-transf', 'declaracao-de-transferencia', ua);
  INSERT INTO public.school_document_template_versions(template_id, version_no, title, blocks, recorded_by, recorded_by_engagement)
    VALUES ('fixture-n54-decl', 1, 'Declaração (FIXTURE)', '[{"kind":"field","label":"Aluno","fact":"aluno.nome"},{"kind":"field","label":"Turma","fact":"turma.rotulo"}]', ua, gen_random_uuid())
    RETURNING id INTO tv;
  INSERT INTO public.school_document_template_versions(template_id, version_no, title, blocks, recorded_by, recorded_by_engagement)
    VALUES ('fixture-n54-transf', 1, 'Transferência (FIXTURE)', '[]', ua, gen_random_uuid()) RETURNING id INTO tvt;
  SELECT count(*) INTO students_before FROM public.institutional_students;

  -- ===== Secretaria A (principal setorial) =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  ca1 := public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N54 A1', '2026-09-01', NULL, NULL, NULL, 5, NULL)->>'class_id';
  ca2 := public.secretariat_create_class(sa, yr, NULL, 'FIXTURE N54 A2', '2026-09-01', NULL, NULL, NULL, 1, NULL)->>'class_id';
  FOR i IN 1..3 LOOP
    d := gen_random_uuid();
    seq := public.enrollment_draft_save(d, sa, 0, 8, jsonb_build_object('aluno', jsonb_build_object('nome', 'FIXTURE N54 ALUNO ' || i)), (ARRAY['11144477735','52998224725','39053344705'])[i], NULL, NULL);
    res := public.enrollment_draft_complete(d, seq, yr, dt, ca1);
    IF i = 1 THEN st1 := res->>'student_id'; en1 := res->>'enrollment_id'; ep1 := res->>'episode_id';
    ELSIF i = 2 THEN st2 := res->>'student_id'; en2 := res->>'enrollment_id'; ep2 := res->>'episode_id';
    ELSE st3 := res->>'student_id'; en3 := res->>'enrollment_id'; END IF;
  END LOOP;

  -- A) emitir documento com modelo; autor = principal, sem pessoa/atuação
  em1 := public.emit_school_document_v2(tv, sa, st1, dt, NULL, NULL, NULL);
  sha1 := em1->>'snapshot_sha256';
  PERFORM set_config('role', 'postgres', true);
  IF NOT EXISTS (SELECT 1 FROM public.school_document_emissions WHERE id = (em1->>'id')::uuid AND emitted_by_principal_id = pa AND emitted_by_engagement IS NULL AND emitted_by_person IS NULL)
    THEN RAISE EXCEPTION 'A: autoria documental não setorial'; END IF;
  IF (SELECT snapshot #>> '{fields,turma.rotulo}' FROM public.school_document_emissions WHERE id = (em1->>'id')::uuid) <> 'FIXTURE N54 A1' THEN RAISE EXCEPTION 'A: snapshot sem turma'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  ok := 'A ';

  -- L) remanejamento A1 → A2 em dt2: A1 termina na véspera, A2 começa na data
  ep1b := public.secretariat_reassign_class(ep1, ca2, dt2, 'Ajuste pedagógico');
  SELECT count(*) INTO n FROM public.class_allocations_at(sa, ca1, dt2) x WHERE x.student_id = st1;
  IF n <> 0 THEN RAISE EXCEPTION 'L: ainda vigente na turma antiga'; END IF;
  SELECT count(*) INTO n FROM public.class_allocations_at(sa, ca1, dt2 - 1) x WHERE x.student_id = st1;
  IF n <> 1 THEN RAISE EXCEPTION 'L: véspera perdida'; END IF;
  SELECT count(*) INTO n FROM public.class_allocations_at(sa, ca2, dt2) x WHERE x.student_id = st1;
  IF n <> 1 THEN RAISE EXCEPTION 'L: não entrou na nova turma'; END IF;
  -- N) vagas atualizadas
  SELECT count(*) INTO n FROM public.secretariat_class_vacancies_at(sa, yr, dt2) v WHERE (v.class_id = ca1 AND v.occupancy = 2) OR (v.class_id = ca2 AND v.occupancy = 1);
  IF n <> 2 THEN RAISE EXCEPTION 'N: vagas não refletem remanejamento'; END IF;
  -- R) turma lotada recusada (A2 capacidade 1)
  BEGIN PERFORM public.secretariat_reassign_class(ep2, ca2, dt2, 'teste'); RAISE EXCEPTION 'R: lotada aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'R:%' OR SQLERRM NOT LIKE '%full%' THEN RAISE; END IF; END;
  ok := ok || 'L,N,R ';

  -- B/C) cadastro (turma) mudou: novo documento mostra A2; o antigo continua reproduzível com A1 e mesma impressão
  em2 := public.emit_school_document_v2(tv, sa, st1, dt2, NULL, NULL, NULL);
  rep := public.emit_school_document_v2(NULL, sa, st1, NULL, (em1->>'id')::uuid, NULL, NULL);
  IF rep->>'snapshot_sha256' <> sha1 THEN RAISE EXCEPTION 'C: reprodução divergente'; END IF;
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT snapshot #>> '{fields,turma.rotulo}' FROM public.school_document_emissions WHERE id = (em2->>'id')::uuid) <> 'FIXTURE N54 A2'
     OR (SELECT snapshot #>> '{fields,turma.rotulo}' FROM public.school_document_emissions WHERE id = (rep->>'id')::uuid) <> 'FIXTURE N54 A1'
  THEN RAISE EXCEPTION 'C: snapshot não congelado'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  -- D) retificar e cancelar
  PERFORM public.emit_school_document_v2(tv, sa, st1, dt2, NULL, (em2->>'id')::uuid, 'Correção do nome da turma');
  PERFORM public.cancel_school_document_emission((em1->>'id')::uuid, 'Emitido por engano');
  BEGIN PERFORM public.cancel_school_document_emission((em1->>'id')::uuid, 'de novo'); RAISE EXCEPTION 'D: duplo cancelamento';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%base-superseded%' THEN RAISE; END IF; END;
  SELECT count(*) INTO n FROM public.student_document_emissions(sa, st1) WHERE event_kind IS NOT NULL;
  IF n <> 2 THEN RAISE EXCEPTION 'D: histórico de eventos %', n; END IF;
  -- E) tipo sem modelo institucional não emite
  BEGIN PERFORM public.emit_school_document_v2(tvt, sa, st1, dt2, NULL, NULL, NULL); RAISE EXCEPTION 'E: tipo pendente emitido';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%document:not-ready%' THEN RAISE; END IF; END;
  ok := ok || 'B,C,D,E ';

  -- F/J) saída por transferência interna (A → B): origem encerrada, trajetória preservada
  mid := public.secretariat_record_exit(en2, dt2, 'fixture-n54-transferencia', 1, sb, 'Mudança de endereço');
  SELECT count(*) INTO n FROM public.class_allocations_at(sa, ca1, dt2 + 1) x WHERE x.student_id = st2;
  IF n <> 0 THEN RAISE EXCEPTION 'F: segue na turma após a saída'; END IF;
  PERFORM set_config('role', 'postgres', true);
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments WHERE id = en2) OR NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes WHERE id = ep2)
  THEN RAISE EXCEPTION 'J: trajetória apagada'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  -- I) Secretaria A não matricula na escola B
  BEGIN PERFORM public.enroll_student_in_school_year(st2, sb, yr, dt2 + 1, mid::text); RAISE EXCEPTION 'I: A escreveu em B';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'I:%' THEN RAISE; END IF; END;
  -- H) saída externa: destino só como proveniência textual, sem school_id inventado
  PERFORM public.secretariat_record_exit(en3, dt2, 'fixture-n54-transferencia', 1, NULL, 'Destino externo: rede estadual (declarado pela família)');
  ok := ok || 'F,J,I,H ';

  -- G) Secretaria B recebe: mesma identidade, nova matrícula, ligada à saída
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  enrB := public.enroll_student_in_school_year(st2, sb, yr, dt2 + 1, mid::text);
  BEGIN PERFORM public.secretariat_reassign_class(ep1b, ca1, dt2 + 5, 'B mexe em A'); RAISE EXCEPTION 'B: remanejou em A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%secretariat:not-found%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.emit_school_document_v2(tv, sa, st1, dt2, NULL, NULL, NULL); RAISE EXCEPTION 'B: emitiu em A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%capability:emitir-documento-escolar%' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT count(*) FROM public.institutional_students) <> students_before + 3 THEN RAISE EXCEPTION 'G: estudante duplicado'; END IF;
  IF (SELECT originating_act_ref FROM public.school_enrollments WHERE id = enrB) <> mid::text THEN RAISE EXCEPTION 'G: entrada sem vínculo com a saída'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  ok := ok || 'G,B-isolada ';

  -- O/P/Q/T) renovação de st1 para y2 pela Secretaria A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  ren := public.record_year_transition_decision(sa, st1, yr, y2, 'renovou', 0, '2026-10-01', NULL);
  PERFORM set_config('role', 'postgres', true);
  SELECT resulting_enrollment_id INTO enrY2 FROM public.year_transition_decisions WHERE id = ren;
  IF enrY2 IS NULL OR enrY2 = en1 OR (SELECT student_id FROM public.school_enrollments WHERE id = enrY2) <> st1 THEN RAISE EXCEPTION 'O: nova matrícula'; END IF;
  IF (SELECT author_principal_id FROM public.year_transition_decisions WHERE id = ren) IS DISTINCT FROM pa THEN RAISE EXCEPTION 'O: autoria'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_enrollment_endings WHERE enrollment_id = en1) OR NOT public.af_enrollment_current(en1) THEN RAISE EXCEPTION 'P: ano anterior alterado'; END IF;
  IF EXISTS (SELECT 1 FROM public.class_enrollment_episodes WHERE enrollment_id = enrY2) THEN RAISE EXCEPTION 'Q: turma inferida'; END IF;
  IF EXISTS (SELECT 1 FROM public.allocation_curricular_positions p JOIN public.class_enrollment_episodes c ON c.logical_id = p.allocation_logical_id WHERE c.enrollment_id = enrY2)
    THEN RAISE EXCEPTION 'Q: posição inferida'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.record_year_transition_decision(sa, st1, yr, y2, 'renovou', 1, '2026-10-02', 'Reconfirmação');
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT count(*) FROM public.school_enrollments WHERE student_id = st1 AND academic_year_id = y2) <> 1 THEN RAISE EXCEPTION 'T: matrícula duplicada'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  -- S) ano destino fechado
  BEGIN PERFORM public.record_year_transition_decision(sa, st1, yr, y3, 'renovou', 0, '2026-10-01', NULL); RAISE EXCEPTION 'S: ano fechado aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%target-year-not-open%' THEN RAISE; END IF; END;
  ok := ok || 'O,P,Q,T,S ';

  -- U) Livro; X) linha do tempo
  SELECT count(*) INTO n FROM public.secretariat_enrollment_book_at(sa, yr, clock_timestamp()) b WHERE b.student_id IN (st1, st2, st3);
  IF n < 3 THEN RAISE EXCEPTION 'U: livro %', n; END IF;
  SELECT count(*) INTO n FROM public.student_school_life(sa, st1) WHERE kind IN ('turma','saida-turma');
  IF n <> 3 THEN RAISE EXCEPTION 'X: linha do tempo %', n; END IF;
  ok := ok || 'U,X ';

  -- Direção/OP: sem writers
  DECLARE u uuid; k int := 0; lbl text;
  BEGIN
    FOREACH u IN ARRAY ARRAY[udir, uop] LOOP
      k := k + 1; lbl := (ARRAY['direcao','op'])[k];
      CONTINUE WHEN u IS NULL;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      BEGIN PERFORM public.secretariat_reassign_class(ep1b, ca1, dt2 + 5, 'x'); RAISE EXCEPTION 'K: % remanejou', lbl; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'K:%' THEN RAISE; END IF; END;
      BEGIN PERFORM public.secretariat_record_exit(en1, dt2 + 5, 'fixture-n54-transferencia', 1, NULL, 'x'); RAISE EXCEPTION 'K: % transferiu', lbl; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'K:%' THEN RAISE; END IF; END;
      BEGIN PERFORM public.record_year_transition_decision(sa, st3, yr, y2, 'renovou', 0, '2026-10-01', NULL); RAISE EXCEPTION 'K: % renovou', lbl; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'K:%' THEN RAISE; END IF; END;
      BEGIN PERFORM public.emit_school_document_v2(tv, sa, st1, dt2, NULL, NULL, NULL); RAISE EXCEPTION 'K: % emitiu', lbl; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'K:%' THEN RAISE; END IF; END;
      ok := ok || lbl || '-sem-writer ';
    END LOOP;
  END;
  PERFORM set_config('role', 'postgres', true);
  IF has_table_privilege('authenticated', 'public.school_document_emissions', 'INSERT') OR has_table_privilege('authenticated', 'public.year_transition_decisions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.class_enrollment_episode_endings', 'INSERT') OR has_table_privilege('anon', 'public.school_document_emissions', 'SELECT')
     OR has_function_privilege('anon', 'public.secretariat_reassign_class(text, text, date, text)', 'EXECUTE')
  THEN RAISE EXCEPTION 'DML: privilégio indevido'; END IF;
  ok := ok || 'sem-DML-direto';
  RAISE EXCEPTION 'N54-PROOF-PASS %', ok;
END $$;
