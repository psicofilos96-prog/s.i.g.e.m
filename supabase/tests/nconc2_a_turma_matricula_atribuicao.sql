-- NCONC.2 (A) — corrida de duas gravações com a MESMA cabeça lida, nos writers de turma (composição),
-- matrícula guiada/enturmação, atribuição docente e jornada. Mesmo mecanismo das provas N5.3.x:
-- uma única transação, contas setoriais REAIS como sessão e fixture revertida; termina em RAISE: nada persiste.
-- "Sessão 1" e "Sessão 2" leem a mesma cabeça; a 1 grava; a 2 chega depois com a cabeça antiga e deve ser recusada
-- com código próprio (nunca sobrescrever, nunca erro bruto). Duas conexões simultâneas não existem neste
-- mecanismo: a serialização entre conexões é garantida pela trava adquirida ANTES da comparação (invariante NCONC.1).
DO $$
DECLARE
  yr text := 'ano-431ece00-be5c-41ed-a430-75ba853b0831'; dt date := '2026-09-15';
  sa text; ua uuid; r jsonb; c1 text; c2 text; ok text := ''; h uuid; h2 uuid; seq int; seq2 int; d uuid := gen_random_uuid();
  res jsonb; ep text; pp1 uuid := gen_random_uuid(); e1 uuid; l1 uuid := gen_random_uuid(); mv uuid; a1 text; e text;
  P1 jsonb := '{"scheme":"fixture-nconc2-posicao","value":"ano-1","version":1}';
  P2 jsonb := '{"scheme":"fixture-nconc2-posicao","value":"ano-2","version":1}';
BEGIN
  SELECT school_id, auth_user_id INTO sa, ua FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id LIMIT 1;
  IF sa IS NULL THEN RAISE EXCEPTION 'NCONC2-A-RECURSO-INDISPONIVEL: sem principal da Secretaria'; END IF;
  -- ===== fixture (postgres, revertida) =====
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status, valid_from, change_reason) VALUES
    ('fixture-nconc2-posicao','ano-1',1,'1º ano (fixture)','homologada','2026-01-01','FIXTURE REVERTIDA NCONC.2'),
    ('fixture-nconc2-posicao','ano-2',1,'2º ano (fixture)','homologada','2026-01-01','FIXTURE REVERTIDA NCONC.2');
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    VALUES (yr, 2, 'operacional', 'FIXTURE REVERTIDA NCONC.2', 'technical:nconc2-rollback');
  INSERT INTO public.institutional_persons(id, display_name, actor_nature) VALUES (pp1, 'FIXTURE NCONC2 Professora', 'pessoa-natural');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, scope_level, valid_from, originating_act_ref)
    VALUES (pp1, 'fixture-nconc2-docente', sa, 'escola', '2026-01-01', 'FIXTURE') RETURNING id INTO e1;
  INSERT INTO public.professional_functional_links(logical_id, version, person_id, functional_registration, link_nature_id, link_nature_version, valid_from, originating_act_ref)
    VALUES (l1, 1, pp1, 'FX-NC2-1', 'fixture-efetivo', 1, '2026-01-01', 'FIXTURE');
  INSERT INTO public.professional_postings(logical_id, version, functional_link_logical_id, school_id, valid_from, originating_act_ref)
    VALUES (gen_random_uuid(), 1, l1, sa, '2026-01-01', 'FIXTURE');
  INSERT INTO public.institutional_curricular_components(id, label) VALUES ('fixture-nconc2-lp', 'Língua Portuguesa (fixture)');
  INSERT INTO public.institutional_curricular_matrices(id) VALUES ('mat-0992');
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, recorded_by, recorded_via_engagement_id)
    VALUES ('mat-0992', 1, 'constituicao', 'Matriz FIXTURE NCONC2', '2026-01-01', ua, e1) RETURNING id INTO mv;
  INSERT INTO public.curricular_matrix_items(matrix_version_id, item_key, position, component_id, component_label_snapshot)
    VALUES (mv, 'lp', 1, 'fixture-nconc2-lp', 'Língua Portuguesa (fixture)');
  CREATE OR REPLACE FUNCTION public.offer_matrix_applicable_throughout(_school text, _class_id text, _mv uuid, _from date, _until date)
    RETURNS boolean LANGUAGE sql STABLE SET search_path TO '' AS $f$ SELECT _mv IS NOT NULL AND _from IS NOT NULL $f$;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  r := public.secretariat_create_class(sa, yr, NULL, 'FIXTURE NCONC2 T1', '2026-09-01', NULL, jsonb_build_array(P1), NULL, 2, NULL); c1 := r->>'class_id';
  r := public.secretariat_create_class(sa, yr, NULL, 'FIXTURE NCONC2 T2', '2026-09-01', NULL, jsonb_build_array(P1), NULL, 2, NULL); c2 := r->>'class_id';

  -- TURMA: composição
  SELECT version_id INTO h FROM public.class_composition_at(c1, dt, clock_timestamp());
  PERFORM public.record_class_composition(c1, h, jsonb_build_array(P1, P2), '2026-09-01', NULL, 'Sessão 1');
  BEGIN PERFORM public.record_class_composition(c1, h, jsonb_build_array(P2), '2026-09-01', NULL, 'Sessão 2'); RAISE EXCEPTION 'TURMA: sessão 2 sobrescreveu';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%composition:stale-head%' THEN RAISE; END IF; END;
  IF (SELECT jsonb_array_length(positions) FROM public.class_composition_at(c1, dt, clock_timestamp())) <> 2 THEN RAISE EXCEPTION 'TURMA: vencedora perdida'; END IF;
  ok := ok || 'turma:composition:stale-head ';

  -- MATRÍCULA GUIADA: duas sessões salvam o rascunho a partir da mesma sequência
  seq := public.enrollment_draft_save(d, sa, 0, 8, '{"aluno":{"nome":"FIXTURE NCONC2 ALUNO"}}'::jsonb, '11144477735', NULL, NULL);
  seq2 := public.enrollment_draft_save(d, sa, seq, 8, '{"aluno":{"nome":"FIXTURE NCONC2 ALUNO S1"}}'::jsonb, '11144477735', NULL, NULL);
  BEGIN PERFORM public.enrollment_draft_save(d, sa, seq, 8, '{"aluno":{"nome":"FIXTURE NCONC2 ALUNO S2"}}'::jsonb, '11144477735', NULL, NULL); RAISE EXCEPTION 'RASCUNHO: sessão 2 sobrescreveu';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%draft:stale-head%' THEN RAISE; END IF; END;
  -- conclusão dupla: a 2ª chega com a sequência já consumida
  res := public.enrollment_draft_complete(d, seq2, yr, dt, c2);
  ep := res->>'episode_id';
  IF ep IS NULL THEN RAISE EXCEPTION 'MATRICULA: %', res; END IF;
  BEGIN PERFORM public.enrollment_draft_complete(d, seq2, yr, dt, c2); RAISE EXCEPTION 'MATRICULA: conclusão dupla aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'MATRICULA:%' THEN RAISE; END IF; e := SQLERRM; END;
  IF (SELECT count(*) FROM public.class_enrollment_episodes WHERE class_id = c2) <> 1 THEN RAISE EXCEPTION 'MATRICULA: enturmação duplicada'; END IF;
  ok := ok || 'rascunho:draft:stale-head conclusao-dupla:' || e || ' ';

  -- ENTURMAÇÃO: duas sessões remanejam o mesmo episódio
  PERFORM public.secretariat_reassign_class(ep, c1, '2026-09-20', 'Sessão 1');
  BEGIN PERFORM public.secretariat_reassign_class(ep, c1, '2026-09-20', 'Sessão 2'); RAISE EXCEPTION 'ENTURMACAO: remanejamento duplo aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ENTURMACAO:%' THEN RAISE; END IF; e := SQLERRM; END;
  ok := ok || 'remanejamento-duplo:' || e || ' ';

  -- ATRIBUIÇÃO DOCENTE
  r := public.record_teaching_assignment_version_v2(c1, NULL, NULL, 'constituicao', '2026-09-01', NULL, e1, l1, mv, 'lp', NULL, NULL, NULL, NULL, NULL);
  a1 := r->>'assignment_id';
  PERFORM set_config('role', 'postgres', true);
  SELECT id INTO h FROM public.teaching_assignment_versions WHERE assignment_id = a1 ORDER BY version DESC LIMIT 1;
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.record_teaching_assignment_version_v2(c1, a1, h, 'retificacao', '2026-09-01', '2026-11-30', e1, l1, mv, 'lp', NULL, NULL, NULL, NULL, 'Sessão 1');
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c1, a1, h, 'retificacao', '2026-09-01', '2026-10-31', e1, l1, mv, 'lp', NULL, NULL, NULL, NULL, 'Sessão 2'); RAISE EXCEPTION 'ATRIB: sessão 2 sobrescreveu';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%assignment:stale-head%' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT count(*) FROM public.teaching_assignment_versions WHERE assignment_id = a1) <> 2 THEN RAISE EXCEPTION 'ATRIB: versões %', 'inesperadas'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  ok := ok || 'atribuicao:assignment:stale-head ';

  -- JORNADA: duas constituições simultâneas (cabeça nula) e duas sucessões da mesma cabeça
  PERFORM public.record_class_journey_version(c1, NULL, 'constituicao', '2026-09-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"11:30"}]'::jsonb);
  BEGIN PERFORM public.record_class_journey_version(c1, NULL, 'constituicao', '2026-09-01', NULL, NULL, NULL, '[{"weekday":2,"starts_at":"07:00","ends_at":"11:30"}]'::jsonb); RAISE EXCEPTION 'JORNADA: 2ª constituição aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%journey:stale-head%' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  SELECT v.id INTO h2 FROM public.class_journey_versions v JOIN public.class_journeys j ON j.id = v.journey_id WHERE j.class_id = c1 ORDER BY v.version DESC LIMIT 1;
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.record_class_journey_version(c1, h2, 'sucessao', '2026-10-01', NULL, NULL, 'Sessão 1', '[{"weekday":3,"starts_at":"07:00","ends_at":"11:00"}]'::jsonb);
  BEGIN PERFORM public.record_class_journey_version(c1, h2, 'sucessao', '2026-10-01', NULL, NULL, 'Sessão 2', '[{"weekday":4,"starts_at":"07:00","ends_at":"11:00"}]'::jsonb); RAISE EXCEPTION 'JORNADA: sessão 2 sobrescreveu';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%journey:stale-head%' THEN RAISE; END IF; END;
  ok := ok || 'jornada:journey:stale-head(constituicao+sucessao)';

  RAISE EXCEPTION 'NCONC2-A-PASS %', ok;
END $$;
