-- Frente S (0113/0115/0116) — testes reais no banco numa transação descartada.
-- Só dados sintéticos. O bloco termina com RAISE: nada persiste.
-- Sucesso = erro final 's-tests-ok: ...'; qualquer outro erro é falha.
DO $st$
DECLARE
  u_sec text := '{"sub":"00000000-0000-0000-0000-00000005e101","role":"authenticated"}';
  u_secb text := '{"sub":"00000000-0000-0000-0000-00000005e102","role":"authenticated"}';
  u_dir text := '{"sub":"00000000-0000-0000-0000-00000005e103","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-00000005e104","role":"authenticated"}';
  u_adm text := '{"sub":"00000000-0000-0000-0000-00000005e105","role":"authenticated"}';
  u_noperson text := '{"sub":"00000000-0000-0000-0000-00000005e1ff","role":"authenticated"}';
  cpf1 text := '52998224725'; cpf2 text := '11144477735'; inep_x text := '900000000001'; inep_y text := '900000000002';
  r record; d1 uuid; d2 uuid; enr text; enr2 text; sid text; sid2 text; n int; n2 int; n3 int; k int; lk uuid := '00000000-0000-0000-0000-00000005e900';
  ok text := '';
  b boolean;
BEGIN
  -- Fixture sintética (privilegiada) ------------------------------------------------
  INSERT INTO public.institutional_persons(id, display_name)
  SELECT ('00000000-0000-0000-0000-00000005e0' || lpad(i::text, 2, '0'))::uuid, 'Pessoa sintética ' || i FROM generate_series(1, 9) i;
  INSERT INTO public.user_person_links(user_id, person_id)
  SELECT ('00000000-0000-0000-0000-00000005e1' || lpad(i::text, 2, '0'))::uuid, ('00000000-0000-0000-0000-00000005e0' || lpad(i::text, 2, '0'))::uuid FROM generate_series(1, 5) i;
  INSERT INTO public.institutional_schools(id) VALUES ('esc-st-a'), ('esc-st-b');
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, official_name, active, valid_from)
  VALUES ('esc-st-a', 1, 'Escola sintética A', true, '2020-01-01'), ('esc-st-b', 1, 'Escola sintética B', true, '2020-01-01');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    ('00000000-0000-0000-0000-00000005e001', 'secretaria-escolar', 'escola', 'esc-st-a', '2020-01-01'),
    ('00000000-0000-0000-0000-00000005e002', 'secretaria-escolar', 'escola', 'esc-st-b', '2020-01-01'),
    ('00000000-0000-0000-0000-00000005e003', 'direcao-escolar', 'escola', 'esc-st-a', '2020-01-01'),
    ('00000000-0000-0000-0000-00000005e004', 'teste-st-nada', 'escola', 'esc-st-a', '2020-01-01'),
    ('00000000-0000-0000-0000-00000005e005', 'administrador-geral-do-sigem', 'rede', NULL, '2020-01-01');
  INSERT INTO public.institutional_academic_years(id) VALUES ('ano-st-from'), ('ano-st-to'), ('ano-st-closed');
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
  VALUES ('ano-st-from', 1, 'historico-importado', 'fixture', 'teste');
  INSERT INTO public.institutional_students(id, display_name) VALUES ('est-st-1', 'Aluno sintético 1'), ('est-st-2', 'Aluno sintético 2'), ('est-st-3', 'Aluno sintético 3');
  INSERT INTO public.institutional_student_persons(student_id, person_id) VALUES
    ('est-st-1', '00000000-0000-0000-0000-00000005e006'), ('est-st-3', '00000000-0000-0000-0000-00000005e007');
  INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value) VALUES
    ('00000000-0000-0000-0000-00000005e006', 'cpf-hmac', public.technical_cpf_hmac(cpf1)),
    ('00000000-0000-0000-0000-00000005e007', 'inep-pessoa', inep_x),
    ('00000000-0000-0000-0000-00000005e008', 'inep-pessoa', inep_y),
    ('00000000-0000-0000-0000-00000005e009', 'qp-mec', 'QPST01');
  INSERT INTO public.school_enrollments(id, student_id, school_id, academic_year_id, logical_id) VALUES
    ('mat-st-1', 'est-st-1', 'esc-st-a', 'ano-st-from', 'mat-st-1'),
    ('mat-st-2', 'est-st-2', 'esc-st-a', 'ano-st-from', 'mat-st-2'),
    ('mat-st-3', 'est-st-3', 'esc-st-b', 'ano-st-to', 'mat-st-3');
  INSERT INTO public.professional_functional_links(logical_id, version, person_id, functional_registration, link_nature_id, link_nature_version)
  VALUES (lk, 1, '00000000-0000-0000-0000-00000005e009', 'MATST01', 'efetivo', 1);

  -- ACL: app roles e service_role sem DML direto nem executor ------------------------
  IF has_table_privilege('authenticated', 'public.year_transition_decisions', 'INSERT') OR has_table_privilege('service_role', 'public.year_transition_decisions', 'INSERT')
    OR has_table_privilege('anon', 'public.year_transition_decisions', 'SELECT') OR has_table_privilege('anon', 'public.school_staff_presence', 'INSERT')
    OR has_table_privilege('authenticated', 'public.school_staff_presence', 'INSERT') OR has_table_privilege('service_role', 'public.school_staff_presence', 'INSERT')
    OR has_table_privilege('authenticated', 'public.student_registration_events', 'INSERT') OR has_table_privilege('service_role', 'public.student_registration_events', 'INSERT')
    OR has_table_privilege('authenticated', 'public.exact_lookup_events', 'SELECT') OR has_table_privilege('anon', 'public.exact_lookup_events', 'SELECT')
    OR has_table_privilege('service_role', 'public.exact_lookup_events', 'INSERT')
    OR has_table_privilege('authenticated', 'public.school_enrollments', 'INSERT') OR has_table_privilege('authenticated', 'public.institutional_person_identifiers', 'SELECT')
  THEN RAISE EXCEPTION 'st:direct-dml-present'; END IF;
  IF has_function_privilege('anon', 'public.record_year_transition_decision(text,text,text,text,text,integer,date,text)', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.record_year_transition_decision(text,text,text,text,text,integer,date,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.locate_student_exact(text,text,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.locate_professional_exact(text,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.register_student_for_school(text,text,text,text)', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.register_student_for_school(text,text,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.register_student_with_exact_identity(text,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.record_school_staff_presence(uuid,text,text,text,integer,date,text)', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.record_academic_year_operational_state(text,text,integer,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.s_enroll_core(text,text,text,date,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.technical_cpf_hmac(text)', 'EXECUTE')
  THEN RAISE EXCEPTION 'st:execute-acl'; END IF;
  ok := ok || 'acl ';

  -- 1. Sem sessão --------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.record_year_transition_decision('esc-st-a','est-st-1','ano-st-from','ano-st-to','renovou',0,NULL,NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'session:person-required' THEN RAISE EXCEPTION 'st:no-session %', SQLERRM; END IF; END;
  BEGIN PERFORM public.locate_student_exact('esc-st-a','cpf',cpf1,'ano-st-to'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'session:person-required' THEN RAISE EXCEPTION 'st:no-session-lookup %', SQLERRM; END IF; END;
  BEGIN PERFORM public.record_academic_year_operational_state('ano-st-to','em-preparacao',0,'m'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'year-state:no-session' THEN RAISE EXCEPTION 'st:no-session-year %', SQLERRM; END IF; END;
  -- 2. Sessão sem pessoa
  PERFORM set_config('request.jwt.claims', u_noperson, true);
  BEGIN PERFORM public.register_student_for_school('esc-st-a','Novo',cpf2,''); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'session:person-required' THEN RAISE EXCEPTION 'st:no-person %', SQLERRM; END IF; END;
  ok := ok || 'sessao ';

  -- 3. Ano não aberto: ausência de estado = fechado para atos ----------------------------
  PERFORM set_config('request.jwt.claims', u_sec, true);
  BEGIN PERFORM public.record_year_transition_decision('esc-st-a','est-st-1','ano-st-from','ano-st-to','renovou',0,NULL,NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'transition:target-year-not-open' THEN RAISE EXCEPTION 'st:year-closed %', SQLERRM; END IF; END;
  -- Secretaria não abre ano; Direção também não; Administrador Geral sim (com motivo e base)
  BEGIN PERFORM public.record_academic_year_operational_state('ano-st-to','em-preparacao',0,'m'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'year-state:capability' THEN RAISE EXCEPTION 'st:sec-opens-year %', SQLERRM; END IF; END;
  PERFORM set_config('request.jwt.claims', u_adm, true);
  BEGIN PERFORM public.record_academic_year_operational_state('ano-st-to','em-preparacao',0,'  '); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'year-state:reason-required' THEN RAISE EXCEPTION 'st:year-reason %', SQLERRM; END IF; END;
  PERFORM public.record_academic_year_operational_state('ano-st-to','em-preparacao',0,'abertura sintética');
  BEGIN PERFORM public.record_academic_year_operational_state('ano-st-to','operacional',0,'m'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'year-state:stale-head' THEN RAISE EXCEPTION 'st:year-stale %', SQLERRM; END IF; END;
  ok := ok || 'ano ';

  -- 4. Sem capability / fora do escopo (IDOR) ------------------------------------------
  PERFORM set_config('request.jwt.claims', u_none, true);
  BEGIN PERFORM public.record_year_transition_decision('esc-st-a','est-st-1','ano-st-from','ano-st-to','renovou',0,NULL,NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'transition:capability-missing' THEN RAISE EXCEPTION 'st:no-cap %', SQLERRM; END IF; END;
  PERFORM set_config('request.jwt.claims', u_secb, true);
  BEGIN PERFORM public.year_transition_candidates('esc-st-a','ano-st-from','ano-st-to'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'transition:capability-missing' THEN RAISE EXCEPTION 'st:idor-candidates %', SQLERRM; END IF; END;
  BEGIN PERFORM public.record_year_transition_decision('esc-st-a','est-st-1','ano-st-from','ano-st-to','renovou',0,NULL,NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'transition:capability-missing' THEN RAISE EXCEPTION 'st:idor-decision %', SQLERRM; END IF; END;
  PERFORM set_config('request.jwt.claims', u_dir, true);
  BEGIN PERFORM public.record_school_staff_presence(lk,'esc-st-a','ano-st-to','confirmada',0,NULL,NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'presence:capability-missing' THEN RAISE EXCEPTION 'st:dir-maintains %', SQLERRM; END IF; END;
  PERFORM 1 FROM public.professional_school_observations_2026('esc-st-a'); -- Direção consulta
  BEGIN PERFORM public.professional_school_observations_2026('esc-st-b'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'baseline:capability-missing' THEN RAISE EXCEPTION 'st:dir-idor %', SQLERRM; END IF; END;
  ok := ok || 'escopo ';

  -- 5. Candidatos, renovação idempotente, base esperada -----------------------------------
  PERFORM set_config('request.jwt.claims', u_sec, true);
  SELECT count(*) INTO n FROM public.year_transition_candidates('esc-st-a','ano-st-from','ano-st-to') WHERE decision IS NULL;
  IF n <> 2 THEN RAISE EXCEPTION 'st:candidates %', n; END IF;
  SELECT count(*) INTO n FROM public.school_enrollments WHERE academic_year_id = 'ano-st-to' AND school_id = 'esc-st-a';
  IF n <> 0 THEN RAISE EXCEPTION 'st:auto-copy'; END IF;
  BEGIN PERFORM public.record_year_transition_decision('esc-st-a','est-st-3','ano-st-from','ano-st-to','renovou',0,NULL,NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'transition:not-a-candidate' THEN RAISE EXCEPTION 'st:not-candidate %', SQLERRM; END IF; END;
  d1 := public.record_year_transition_decision('esc-st-a','est-st-1','ano-st-from','ano-st-to','renovou',0,NULL,NULL);
  SELECT resulting_enrollment_id INTO enr FROM public.year_transition_decisions WHERE id = d1;
  IF enr IS NULL OR (SELECT opened_on FROM public.school_enrollments WHERE id = enr) IS NOT NULL THEN RAISE EXCEPTION 'st:renew-date-invented'; END IF;
  IF (SELECT count(*) FROM public.institutional_students WHERE id = 'est-st-1') <> 1 THEN RAISE EXCEPTION 'st:student-dup'; END IF;
  BEGIN PERFORM public.record_year_transition_decision('esc-st-a','est-st-1','ano-st-from','ano-st-to','nao-renovou',0,NULL,'motivo'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'transition:stale-base' THEN RAISE EXCEPTION 'st:stale %', SQLERRM; END IF; END;
  BEGIN PERFORM public.record_year_transition_decision('esc-st-a','est-st-1','ano-st-from','ano-st-to','nao-renovou',1,NULL,NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'transition:rectification-reason-required' THEN RAISE EXCEPTION 'st:rect-reason %', SQLERRM; END IF; END;
  BEGIN PERFORM public.record_year_transition_decision('esc-st-a','est-st-1','ano-st-from','ano-st-to','nao-renovou',1,NULL,'retificação'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'transition:renewed-enrollment-must-be-ended-first' THEN RAISE EXCEPTION 'st:rect-renewed %', SQLERRM; END IF; END;
  enr2 := public.enroll_student_in_school_year('est-st-1','esc-st-a','ano-st-to',NULL,NULL);
  IF enr2 <> enr THEN RAISE EXCEPTION 'st:enroll-not-idempotent'; END IF;
  d2 := public.record_year_transition_decision('esc-st-a','est-st-2','ano-st-from','ano-st-to','transferido-saida',0,NULL,NULL);
  IF EXISTS (SELECT 1 FROM public.school_enrollments WHERE student_id = 'est-st-2' AND academic_year_id = 'ano-st-to') THEN RAISE EXCEPTION 'st:exit-created-enrollment'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments WHERE id = 'mat-st-2') THEN RAISE EXCEPTION 'st:history-lost'; END IF;
  ok := ok || 'transicao ';

  -- 6. Ativo em outra escola exige transferência --------------------------------------
  BEGIN PERFORM public.enroll_student_in_school_year('est-st-3','esc-st-a','ano-st-to',NULL,NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'enrollment:active-elsewhere-requires-transfer' THEN RAISE EXCEPTION 'st:silent-move %', SQLERRM; END IF; END;
  ok := ok || 'transferencia ';

  -- 7. Busca exata, sem valor na trilha, sem enumeração ---------------------------------
  SELECT * INTO r FROM public.locate_student_exact('esc-st-a','cpf','529.982.247-25','ano-st-to');
  IF r.outcome <> 'encontrado' OR r.student_id <> 'est-st-1' OR r.active_here IS NOT TRUE THEN RAISE EXCEPTION 'st:lookup-cpf'; END IF;
  SELECT * INTO r FROM public.locate_student_exact('esc-st-a','inep',inep_x,'ano-st-to');
  IF r.outcome <> 'encontrado' OR r.active_elsewhere IS NOT TRUE OR r.active_here IS NOT FALSE THEN RAISE EXCEPTION 'st:lookup-inep'; END IF;
  SELECT * INTO r FROM public.locate_student_exact('esc-st-a','cpf','Aluno sintético 1','ano-st-to');
  IF r.outcome <> 'entrada-invalida' OR r.student_id IS NOT NULL OR r.display_name IS NOT NULL THEN RAISE EXCEPTION 'st:lookup-name'; END IF;
  SELECT * INTO r FROM public.locate_student_exact('esc-st-a','inep','9000000000','ano-st-to');
  IF r.outcome <> 'entrada-invalida' THEN RAISE EXCEPTION 'st:lookup-prefix'; END IF;
  SELECT * INTO r FROM public.locate_student_exact('esc-st-a','inep',inep_y,'ano-st-to'); -- pessoa existe, mas não é aluno
  IF r.outcome <> 'nao-encontrado' OR r.display_name IS NOT NULL THEN RAISE EXCEPTION 'st:lookup-nonstudent-leak'; END IF;
  IF EXISTS (SELECT 1 FROM public.exact_lookup_events e WHERE row_to_json(e)::text ~ (cpf1 || '|' || inep_x || '|' || inep_y || '|529\.982')) THEN RAISE EXCEPTION 'st:value-logged'; END IF;
  SELECT count(*) INTO n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exact_lookup_events' AND column_name ~ 'value|cpf|inep';
  IF n <> 0 THEN RAISE EXCEPTION 'st:value-column'; END IF;
  ok := ok || 'busca ';

  -- 8. Cadastro novo, reuso seguro, conflito fail-closed --------------------------------
  BEGIN PERFORM public.register_student_for_school('esc-st-a','Conflito',cpf1,inep_y); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'identity:conflict' THEN RAISE EXCEPTION 'st:conflict %', SQLERRM; END IF;
    IF SQLERRM ~ '[0-9]{11}' THEN RAISE EXCEPTION 'st:pii-in-error'; END IF; END;
  BEGIN PERFORM public.register_student_for_school('esc-st-a','Repetido',cpf1,''); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'identity:already-registered-use-search' THEN RAISE EXCEPTION 'st:dup-student %', SQLERRM; END IF; END;
  SELECT count(*) INTO n FROM public.institutional_persons;
  sid := public.register_student_for_school('esc-st-a','Aluno sintético reusado','',inep_y); -- reusa pessoa existente
  SELECT count(*) INTO n2 FROM public.institutional_persons;
  IF n2 <> n OR (SELECT person_id FROM public.institutional_student_persons WHERE student_id = sid) <> '00000000-0000-0000-0000-00000005e008' THEN RAISE EXCEPTION 'st:reuse'; END IF;
  sid2 := public.register_student_for_school('esc-st-a','Aluno sintético novo',cpf2,'');
  IF (SELECT count(*) FROM public.institutional_persons) <> n2 + 1 THEN RAISE EXCEPTION 'st:new-person'; END IF;
  IF (SELECT count(*) FROM public.student_registration_events WHERE student_id IN (sid, sid2) AND school_id = 'esc-st-a' AND author_person_id = '00000000-0000-0000-0000-00000005e001') <> 2 THEN RAISE EXCEPTION 'st:registration-audit'; END IF;
  PERFORM set_config('request.jwt.claims', u_dir, true);
  BEGIN PERFORM public.register_student_for_school('esc-st-a','X','','900000000003'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'student:capability-missing' THEN RAISE EXCEPTION 'st:dir-registers %', SQLERRM; END IF; END;
  ok := ok || 'cadastro ';

  -- 9. Servidor por matrícula/QP-MEC; lotação ≠ regência ≠ registro funcional -------------
  PERFORM set_config('request.jwt.claims', u_sec, true);
  SELECT * INTO r FROM public.locate_professional_exact('esc-st-a','matricula','MATST01');
  IF r.outcome <> 'encontrado' OR NOT (lk = ANY (r.functional_link_logical_ids)) THEN RAISE EXCEPTION 'st:prof-mat'; END IF;
  SELECT * INTO r FROM public.locate_professional_exact('esc-st-a','qp-mec','QPST01');
  IF r.outcome <> 'encontrado' THEN RAISE EXCEPTION 'st:prof-qp'; END IF;
  SELECT * INTO r FROM public.locate_professional_exact('esc-st-a','matricula','Pessoa sintética');
  IF r.outcome <> 'entrada-invalida' AND r.outcome <> 'nao-encontrado' THEN RAISE EXCEPTION 'st:prof-name'; END IF;
  IF r.display_name IS NOT NULL THEN RAISE EXCEPTION 'st:prof-name-leak'; END IF;
  SELECT count(*) INTO n FROM public.teaching_assignment_versions;
  SELECT count(*) INTO n2 FROM public.professional_functional_links;
  SELECT count(*) INTO n3 FROM public.professional_postings;
  PERFORM public.record_school_staff_presence(lk,'esc-st-a','ano-st-to','confirmada',0,NULL,NULL);
  PERFORM public.record_school_staff_presence(lk,'esc-st-a','ano-st-to','confirmada',1,NULL,NULL); -- idempotente
  PERFORM set_config('request.jwt.claims', u_secb, true);
  PERFORM public.record_school_staff_presence(lk,'esc-st-b','ano-st-to','confirmada',0,NULL,NULL); -- múltiplas lotações
  IF (SELECT count(*) FROM public.school_staff_presence WHERE functional_link_logical_id = lk) <> 2 THEN RAISE EXCEPTION 'st:multi-posting'; END IF;
  IF (SELECT count(*) FROM public.teaching_assignment_versions) <> n OR (SELECT count(*) FROM public.professional_functional_links) <> n2
     OR (SELECT count(*) FROM public.professional_postings) <> n3 THEN RAISE EXCEPTION 'st:posting-side-effects'; END IF;
  BEGIN PERFORM public.record_school_staff_presence(lk,'esc-st-a','ano-st-to','encerrada',1,NULL,'x'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'presence:capability-missing' THEN RAISE EXCEPTION 'st:presence-idor %', SQLERRM; END IF; END;
  BEGIN PERFORM public.record_school_staff_presence(lk,'esc-st-b','ano-st-closed','confirmada',0,NULL,NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'presence:year-not-open' THEN RAISE EXCEPTION 'st:presence-year %', SQLERRM; END IF; END;
  -- Secretaria não ganha manutenção do registro funcional central
  IF public.has_school_capability('manter-registro-funcional', 'esc-st-b') THEN RAISE EXCEPTION 'st:school-gets-central'; END IF;
  ok := ok || 'servidor ';

  -- 10. Limite de busca (anti-enumeração) ---------------------------------------------
  PERFORM set_config('request.jwt.claims', u_sec, true);
  SELECT count(*) INTO n FROM public.exact_lookup_events WHERE user_id = '00000000-0000-0000-0000-00000005e101';
  FOR k IN 1 .. (20 - n) LOOP PERFORM public.locate_student_exact('esc-st-a','inep', (900000000100 + k)::text, 'ano-st-to'); END LOOP;
  BEGIN PERFORM public.locate_student_exact('esc-st-a','inep','900000000999','ano-st-to'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'lookup:rate-limited' THEN RAISE EXCEPTION 'st:rate %', SQLERRM; END IF; END;
  ok := ok || 'limite ';

  -- 11. Append-only ------------------------------------------------------------------
  BEGIN UPDATE public.year_transition_decisions SET decision = 'nao-renovou' WHERE id = d1; RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM = 'x' THEN RAISE EXCEPTION 'st:decision-mutable'; END IF; END;
  BEGIN DELETE FROM public.school_staff_presence WHERE functional_link_logical_id = lk; RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM = 'x' THEN RAISE EXCEPTION 'st:presence-mutable'; END IF; END;
  BEGIN DELETE FROM public.exact_lookup_events WHERE user_id IS NOT NULL; RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM = 'x' THEN RAISE EXCEPTION 'st:lookup-mutable'; END IF; END;
  BEGIN UPDATE public.academic_year_operational_states SET state = 'operacional' WHERE academic_year_id = 'ano-st-to'; RAISE EXCEPTION 'x';
  EXCEPTION WHEN others THEN IF SQLERRM = 'x' THEN RAISE EXCEPTION 'st:year-mutable'; END IF; END;
  ok := ok || 'append-only ';

  -- 12. Indicadores coerentes --------------------------------------------------------
  SELECT (j->>'candidatos')::int = (j->>'renovados')::int + (j->>'transferidos_saidas')::int + (j->>'nao_renovados')::int + (j->>'pendentes')::int
     AND (j->>'renovados')::int = 1 AND (j->>'pendentes')::int = 0 AND (j->>'servidores_lotados_ano_destino')::int = 1
    INTO b FROM (SELECT public.year_preparation_summary('esc-st-a','ano-st-from','ano-st-to') j) s;
  IF b IS NOT TRUE THEN RAISE EXCEPTION 'st:summary'; END IF;
  ok := ok || 'indicadores ';

  RAISE EXCEPTION 's-tests-ok: %', ok;
END $st$;
