-- Frente Z.2 — E2E sintético POSITIVO do Planejamento + recusas. Termina em RAISE: nada persiste.
-- Cadeia: ano → organização/período versionado → turma → alunos/alocações/posições → pessoas/atuações/lotações → regência → plano
-- → referência Y sintética → multietapa (posições distintas) → cópia da própria estrutura → vínculo explícito com aula W.
-- Dublês transacionais (resolvedor curricular U, calendário) desfeitos pelo rollback; nenhum ato humano real; 2027 nunca aberto.
-- Sucesso = 'z2-planning-e2e-ok: ...'.
DO $t$
DECLARE _ok text := ''; _e text; r jsonb; ok boolean;
  y27 text := 'ano-500f63b6-b71d-4000-9762-bbb65c40d21d'; s1 text; pol uuid;
  c27 text := 'tur-z2-' || gen_random_uuid()::text; org text := 'org-z2-'||gen_random_uuid(); per text := 'per-z2-'||gen_random_uuid(); per2 text := 'per-z2b-'||gen_random_uuid();
  st1 text := 'stu-z2-'||gen_random_uuid(); st2 text := 'stu-z2-'||gen_random_uuid(); en1 text := 'enr-z2-'||gen_random_uuid(); en2 text := 'enr-z2-'||gen_random_uuid();
  al1 text := 'al-z2-'||gen_random_uuid(); al2 text := 'al-z2-'||gen_random_uuid(); posA text := 'pos-z2-a-'||gen_random_uuid(); posB text := 'pos-z2-b-'||gen_random_uuid();
  pd uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); eng_dir uuid;
  pt uuid := gen_random_uuid(); ut uuid := gen_random_uuid(); eng_t uuid; fl_t uuid := gen_random_uuid();
  px uuid := gen_random_uuid(); ux uuid := gen_random_uuid(); eng_x uuid; fl_x uuid := gen_random_uuid();
  mid text := 'mat-' || gen_random_uuid()::text; mv uuid; mv2 uuid; ta text; blk uuid; ed uuid; ed2 uuid; it uuid; it2 uuid;
  P1 uuid; P2 uuid; P3 uuid; L1 uuid; LK uuid; LK2 uuid; n0 int; l0 int; a0 int; k0 int; refs jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.academic_year_operational_state_at(y27)) THEN RAISE EXCEPTION 'falha: 2027 já tem estado real'; END IF;
  SELECT id INTO s1 FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO pol FROM public.capability_policies WHERE status = 'homologated' ORDER BY version DESC LIMIT 1;
  SELECT count(*) INTO n0 FROM public.teaching_plan_versions; SELECT count(*) INTO l0 FROM public.lesson_record_versions;
  SELECT count(*) INTO a0 FROM public.attendance_record_versions; SELECT count(*) INTO k0 FROM public.teaching_plan_lesson_links;

  INSERT INTO public.institutional_persons(id, display_name) VALUES (pd,'Direção sintética Z2'),(pt,'Professor sintético Z2'),(px,'Outro professor sintético Z2');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (ud, pd), (ut, pt), (ux, px);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (pd,'direcao-escolar','Direção (sintético)', s1,'2027-01-01','teste-z2','escola') RETURNING id INTO eng_dir;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (pt,'professor','Professor (sintético)', s1,'2027-01-01','teste-z2','escola') RETURNING id INTO eng_t;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (px,'professor','Professor (sintético)', s1,'2027-01-01','teste-z2','escola') RETURNING id INTO eng_x;
  INSERT INTO public.professional_functional_links(logical_id, version, person_id, link_nature_id, link_nature_version, valid_from)
    VALUES (fl_t,1,pt,'sintetico',1,'2027-01-01'),(fl_x,1,px,'sintetico',1,'2027-01-01');
  INSERT INTO public.professional_postings(logical_id, version, functional_link_logical_id, school_id, valid_from, valid_until)
    VALUES (gen_random_uuid(),1,fl_t,s1,'2027-01-01',NULL),(gen_random_uuid(),1,fl_x,s1,'2027-01-01',NULL);
  INSERT INTO public.institutional_classes(id, school_id, school_label_snapshot, academic_year_id, academic_year_label, name, valid_from)
    VALUES (c27, s1, 'Escola (sintético)', y27, '2027', 'Turma multietapa sintética Z2', '2027-02-01');
  INSERT INTO public.institutional_class_record_versions(class_id, segment_id, version, name, administrative_status, valid_from,
      originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id, authorizing_policy_id, created_at)
    VALUES (c27, gen_random_uuid(), 1, 'Turma multietapa sintética Z2', 'ativa', '2027-02-01', 'teste-z2', ud, pd, eng_dir, pol, now() - interval '1 minute');
  INSERT INTO public.institutional_curricular_components(id, label) VALUES ('comp-z2-sintetico', 'Componente sintético Z2');
  INSERT INTO public.curricular_component_versions(component_id, version, official_name, is_active, valid_from, recorded_by, recorded_via_engagement_id, created_at)
    VALUES ('comp-z2-sintetico', 1, 'Componente sintético Z2', true, '2027-01-01', ud, eng_dir, now() - interval '1 minute');
  INSERT INTO public.institutional_curricular_matrices(id) VALUES (mid);
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, recorded_by, recorded_via_engagement_id)
    VALUES (mid, 1, 'constituicao', 'Matriz sintética Z2', '2027-01-01', ud, eng_dir) RETURNING id INTO mv;
  INSERT INTO public.curricular_matrix_items(matrix_version_id, item_key, position, component_id, component_label_snapshot)
    VALUES (mv, 'k1', 1, 'comp-z2-sintetico', 'Elemento sintético'), (mv, 'k2', 2, 'comp-z2-sintetico', 'Outro elemento');
  mv2 := gen_random_uuid();   -- versão de matriz inexistente/alheia
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    VALUES (y27, 1, 'em-preparacao', 'teste sintético Z2 (rollback)', 'teste-z2-rollback');

  EXECUTE $s$CREATE OR REPLACE FUNCTION public.class_curricular_matrices_at(_school text, _class_id text, _on date, _known_at timestamptz)
   RETURNS TABLE(result_kind text, class_id text, valid_on date, known_at timestamptz, context_state text, gate_effect text, state text,
     matrix_id text, matrix_version_id uuid, matrix_homologation_id uuid, allocation_count integer, total_allocations integer,
     resolved_allocations integer, column_keys text[], correspondence_ids text[], association_id text, association_version_id uuid,
     association_homologation_id uuid) LANGUAGE plpgsql STABLE SET search_path TO '' AS $b$
  BEGIN IF _class_id = current_setting('v1.class', true) THEN
      result_kind := 'matrix'; state := 'resolvida-por-posicao'; matrix_id := current_setting('v1.mid'); class_id := _class_id; valid_on := _on; matrix_version_id := current_setting('v1.mv')::uuid; RETURN NEXT; END IF; END $b$$s$;
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.calendar_applicability_candidates(_on date, _known_at timestamptz, _school text, _allocation text, _position text, _axis jsonb)
    RETURNS TABLE(resolution text, calendar_id text, version_id uuid, scope_key text) LANGUAGE sql STABLE SET search_path TO '' AS
    $b$ SELECT 'candidato'::text, 'cal-z2'::text, NULL::uuid, 'escola'::text $b$$s$;
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.calendar_day_declarations(_calendar_id text, _date date, _known_at timestamptz)
    RETURNS TABLE(day_state text, version_id uuid, reference_issue text, homologation_state text, declaration_kind text, declaration_id text,
      starts_on date, ends_on date, event_label text, day_type_id text, day_type_version_id uuid, day_type_version integer, day_type_label text, school_day_effect boolean)
    LANGUAGE sql STABLE SET search_path TO '' AS
    $b$ SELECT 'declarado'::text, NULL::uuid, NULL::text, 'homologada'::text, 'dia'::text, 'd'::text, _date, _date, NULL::text, 't'::text, NULL::uuid, 1, 'Dia'::text, true $b$$s$;
  PERFORM set_config('v1.class', c27, true); PERFORM set_config('v1.mv', mv::text, true); PERFORM set_config('v1.mid', mid, true);

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := public.record_class_journey_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"12:00"}]');
  r := public.record_class_schedule_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL,
      jsonb_build_array(jsonb_build_object('block_key','b1','weekday',1,'starts_at','07:00','ends_at','07:50','matrix_version_id',mv,'item_key','k1')));
  r := public.record_teaching_assignment_version_v2(c27, NULL, NULL, 'constituicao', '2027-02-01', '2027-06-30', eng_t, fl_t, mv, 'k1', NULL, NULL, NULL, NULL, NULL);
  ta := r->>'assignment_id';
  RESET ROLE;
  SELECT b.id INTO blk FROM public.class_schedule_blocks b JOIN public.class_schedule_versions v ON v.id = b.version_id JOIN public.class_schedules s ON s.id = v.schedule_id WHERE s.class_id = c27 LIMIT 1;

  -- Organização + DOIS períodos; a versão 2 do P1 encurta a janela (prova: janela vem da versão, não da base)
  INSERT INTO public.institutional_period_organizations(id, academic_year_id) VALUES (org, y27);
  INSERT INTO public.institutional_academic_periods(id, academic_year_id, label, starts_on, ends_on, period_organization_id)
    VALUES (per, y27, 'P1 base antiga', '2027-02-01', '2027-06-30', org), (per2, y27, 'P2', '2027-05-01', '2027-06-30', org);
  INSERT INTO public.institutional_academic_period_versions(period_id, version, official_name, starts_on, ends_on, is_active, valid_from, recorded_by, recorded_by_person_id, recorded_via_engagement_id, created_at)
    VALUES (per, 1, 'P1', '2027-02-01', '2027-06-30', true, '2027-02-01', ud, pd, eng_dir, now() - interval '2 minute'),
           (per, 2, 'P1 retificado', '2027-02-01', '2027-04-30', true, '2027-02-01', ud, pd, eng_dir, now() - interval '1 minute'),
           (per2, 1, 'P2', '2027-05-01', '2027-06-30', true, '2027-05-01', ud, pd, eng_dir, now() - interval '1 minute');
  INSERT INTO public.institutional_class_period_organization_versions(class_id, version, organization_id, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id, segment_id, authorizing_policy_id, created_at)
    VALUES (c27, 1, org, '2027-02-01', 'teste-z2', ud, pd, eng_dir, gen_random_uuid(), pol, now() - interval '1 minute');
  -- Alunos, alocações e posições curriculares distintas (multietapa)
  INSERT INTO public.institutional_students(id, display_name) VALUES (st1, 'Aluno sintético A'), (st2, 'Aluno sintético B');
  INSERT INTO public.school_enrollments(id, student_id, school_id, opened_on, academic_year_id) VALUES (en1, st1, s1, '2027-02-01', y27), (en2, st2, s1, '2027-02-01', y27);
  INSERT INTO public.class_enrollment_episodes(id, logical_id, enrollment_id, student_id, school_id, class_id, class_label_snapshot, valid_from)
    VALUES (al1, al1, en1, st1, s1, c27, 'Turma sintética', '2027-02-01'), (al2, al2, en2, st2, s1, c27, 'Turma sintética', '2027-02-01');
  INSERT INTO public.allocation_curricular_positions(position_logical_id, version, allocation_logical_id, school_id, class_id, valid_from, recorded_by, created_at)
    VALUES (posA, 1, al1, s1, c27, '2027-02-01', ud, now() - interval '1 minute'), (posB, 1, al2, s1, c27, '2027-02-01', ud, now() - interval '1 minute');
  -- Referência Y sintética: duas edições (fixture; nada oficial)
  INSERT INTO public.curricular_reference_editions(source_id, source_label, authority, edition_label, source_sha256, item_count, recorded_by, recorded_engagement)
    VALUES ('fonte-z2-sintetica', 'Fonte sintética Z2', 'sintetico', 'ed1', repeat('a',64), 1, ud, eng_dir) RETURNING id INTO ed;
  INSERT INTO public.curricular_reference_editions(source_id, source_label, authority, edition_label, source_sha256, item_count, recorded_by, recorded_engagement)
    VALUES ('fonte-z2-sintetica-b', 'Fonte sintética Z2 B', 'sintetico', 'ed1', repeat('b',64), 1, ud, eng_dir) RETURNING id INTO ed2;
  INSERT INTO public.curricular_reference_items(edition_id, code, item_kind, official_text) VALUES (ed, 'Z2-01', 'habilidade', 'Texto sintético') RETURNING id INTO it;
  INSERT INTO public.curricular_reference_items(edition_id, code, item_kind, official_text) VALUES (ed2, 'Z2-02', 'habilidade', 'Texto sintético B') RETURNING id INTO it2;

  -- anon / service_role / sem pessoa natural
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-03-01',NULL,NULL,NULL,'[]','[]','rascunho',NULL,NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE service_role;
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-03-01',NULL,NULL,NULL,'[]','[]','rascunho',NULL,NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.link_lesson_to_plan('x', gen_random_uuid(), NULL); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.teaching_plan_versions(plan_id) VALUES ('x'); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_teaching_plan_version(NULL,NULL,ta,'t',NULL,NULL,NULL,'[]','[]','rascunho',NULL,NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  _ok := _ok || 'anon/service_role/v1/dml-negados ';

  -- Titular
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);
  IF (SELECT count(*) FROM public.plan_periods_for_assignment(ta, '2027-03-01')) <> 2
     OR (SELECT ends_on FROM public.plan_periods_for_assignment(ta, '2027-03-01') WHERE period_id = per) <> '2027-04-30' THEN RAISE EXCEPTION 'falha: períodos versionados'; END IF;
  -- Recusas de janela
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-03-01',per,'2027-03-01','2027-05-15','[]','[]','rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:interval-outside-period' THEN RAISE EXCEPTION 'falha período versionado: %', _e; END IF; END;
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-04-20',per,'2027-03-01','2027-03-31','[]','[]','rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:target-date-outside-plan' THEN RAISE EXCEPTION 'falha target fora do plano: %', _e; END IF; END;
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-07-05',NULL,NULL,NULL,'[]','[]','rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:assignment-not-current' THEN RAISE EXCEPTION 'falha target fora da atribuição: %', _e; END IF; END;
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-03-01',NULL,'2027-03-01','2027-08-31','[]','[]','rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:interval-outside-assignment' THEN RAISE EXCEPTION 'falha plano fora da atribuição: %', _e; END IF; END;
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-03-01','per-inexistente','2027-03-01','2027-03-31','[]','[]','rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:period-not-of-class-organization' THEN RAISE EXCEPTION 'falha período alheio: %', _e; END IF; END;
  _ok := _ok || 'periodo-versionado target-fora plano-fora-atribuicao periodo-alheio ';
  -- Recusas de referência
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-03-01',per,'2027-03-01','2027-03-31','[]','[{"kind":"matrix-item","item_key":"k2"}]','rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:matrix-item-not-of-assignment' THEN RAISE EXCEPTION 'falha item errado: %', _e; END IF; END;
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-03-01',per,'2027-03-01','2027-03-31','[]',
      jsonb_build_array(jsonb_build_object('kind','matrix-item','item_key','k1','matrix_version_id',mv2)),'rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:matrix-version-mismatch' THEN RAISE EXCEPTION 'falha matriz errada: %', _e; END IF; END;
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-03-01',per,'2027-03-01','2027-03-31','[]',
      jsonb_build_array(jsonb_build_object('kind','reference-item','item_id',it,'edition_id',ed2)),'rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:reference-edition-mismatch' THEN RAISE EXCEPTION 'falha edição incompatível: %', _e; END IF; END;
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-03-01',per,'2027-03-01','2027-03-31','[]',
      jsonb_build_array(jsonb_build_object('kind','reference-item','item_id',it,'position_key','pos-alheia')),'rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:position-not-in-class' THEN RAISE EXCEPTION 'falha posição alheia: %', _e; END IF; END;
  _ok := _ok || 'item-errado matriz-errada edicao-incompativel posicao-alheia ';

  -- Positivo: plano em preparação com item da matriz + Y por posições distintas (multietapa)
  P1 := public.record_teaching_plan_version_v2('pln-z2-1',NULL,ta,'Plano sintético P1',NULL,'2027-03-01',per,'2027-03-01','2027-03-31',
    '[{"kindValueId":null,"heading":"Objetivos","body":"sintético"}]',
    jsonb_build_array(jsonb_build_object('kind','matrix-item','item_key','k1','matrix_version_id',mv),
                      jsonb_build_object('kind','reference-item','item_id',it,'position_key',posA),
                      jsonb_build_object('kind','reference-item','item_id',it2,'position_key',posB)),'publicado',NULL,NULL);
  SELECT curricular_refs INTO refs FROM public.teaching_plan_versions WHERE id = P1;
  IF NOT (refs @> jsonb_build_array(jsonb_build_object('kind','matrix-item','item_key','k1','matrix_version_id',mv))
      AND refs @> jsonb_build_array(jsonb_build_object('item_id',it::text,'edition_id',ed,'position_key',posA))
      AND refs @> jsonb_build_array(jsonb_build_object('item_id',it2::text,'edition_id',ed2,'position_key',posB)))
    OR (SELECT matrix_version_id FROM public.teaching_plan_versions WHERE id = P1) <> mv THEN RAISE EXCEPTION 'falha: refs normalizadas %', refs; END IF;
  _ok := _ok || 'plano-positivo edicao-preservada matriz-versao multietapa-posicoes ';
  -- Stale-head e nova versão
  BEGIN PERFORM public.record_teaching_plan_version_v2('pln-z2-1',NULL,ta,'x',NULL,'2027-03-01',per,'2027-03-01','2027-03-31','[]','[]','rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:stale-head' THEN RAISE EXCEPTION 'falha stale: %', _e; END IF; END;
  P2 := public.record_teaching_plan_version_v2('pln-z2-1',P1,ta,'Plano sintético P1 v2',NULL,'2027-03-01',per,'2027-03-01','2027-03-31','[]',refs,'publicado',NULL,'ajuste');
  BEGIN PERFORM public.record_teaching_plan_version_v2('pln-z2-1',P1,ta,'x',NULL,'2027-03-01',per,'2027-03-01','2027-03-31','[]','[]','rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:stale-head' THEN RAISE EXCEPTION 'falha stale v2: %', _e; END IF; END;
  -- Cópia da própria estrutura (P2 → novo plano), sem herdar identidade
  P3 := public.record_teaching_plan_version_v2(NULL,NULL,ta,'Cópia sintética',NULL,'2027-05-03',per2,'2027-05-03','2027-05-31','[]',refs,'rascunho',P2,NULL);
  IF (SELECT plan_id FROM public.teaching_plan_versions WHERE id = P3) = 'pln-z2-1' OR (SELECT copied_from_version_id FROM public.teaching_plan_versions WHERE id = P3) <> P2
    THEN RAISE EXCEPTION 'falha: cópia'; END IF;
  _ok := _ok || 'stale-head versao copia-propria ';
  -- Plano ≠ aula: salvar plano não criou aula/frequência
  IF (SELECT count(*) FROM public.lesson_record_versions) <> l0 OR (SELECT count(*) FROM public.attendance_record_versions) <> a0 THEN RAISE EXCEPTION 'falha: plano criou aula'; END IF;

  -- Outro professor: não grava, não copia, não vincula, não vê rascunho
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ux, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-03-01',NULL,NULL,NULL,'[]','[]','rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:assignment-not-current' THEN RAISE EXCEPTION 'falha outro professor: %', _e; END IF; END;
  BEGIN PERFORM public.link_lesson_to_plan('aula:z2-1', P2, NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:not-author' THEN RAISE EXCEPTION 'falha outro vincula: %', _e; END IF; END;
  IF EXISTS (SELECT 1 FROM public.teaching_plan_versions WHERE id = P3) THEN RAISE EXCEPTION 'falha: rascunho visível a outro'; END IF;
  _ok := _ok || 'outro-professor rascunho-oculto ';

  -- Acompanhamento SOMENTE LEITURA (Direção): vê só compartilhados vigentes, não escreve
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role', 'authenticated')::text, true);
  IF (SELECT count(*) FROM public.teaching_plans_overview_at(s1, '2027-03-10') o WHERE o.result_kind = 'plan' AND o.class_id = c27) <> 1
     OR EXISTS (SELECT 1 FROM public.teaching_plans_overview_at(s1, '2027-05-10') o WHERE o.plan_version_id = P3) THEN RAISE EXCEPTION 'falha: acompanhamento'; END IF;
  BEGIN PERFORM public.record_teaching_plan_version_v2(NULL,NULL,ta,'t',NULL,'2027-03-01',NULL,NULL,NULL,'[]','[]','rascunho',NULL,NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:assignment-not-current' THEN RAISE EXCEPTION 'falha direção escreve: %', _e; END IF; END;
  _ok := _ok || 'acompanhamento-somente-leitura ';
  RESET ROLE;

  -- Aula W (ano operacional) e vínculo EXPLÍCITO plano↔aula; revogar não apaga
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, supersedes_id, reason, technical_provenance)
    SELECT y27, 2, 'operacional', id, 'teste sintético Z2 (rollback)', 'teste-z2-rollback' FROM public.academic_year_operational_states WHERE academic_year_id = y27 AND sequence = 1;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);
  L1 := public.record_lesson_version_v2('aula:z2-1', ta, NULL, '2027-03-08', NULL, '{"content":"Aula sintética"}', ARRAY[blk], '{}', NULL, NULL, 'z2-l1');
  IF EXISTS (SELECT 1 FROM public.teaching_plan_lesson_links WHERE lesson_logical_record_id = 'aula:z2-1') THEN RAISE EXCEPTION 'falha: vínculo implícito'; END IF;
  LK := public.link_lesson_to_plan('aula:z2-1', P2, NULL);
  BEGIN PERFORM public.link_lesson_to_plan('aula:z2-1', P2, NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:link-exists' THEN RAISE EXCEPTION 'falha vínculo duplicado: %', _e; END IF; END;
  BEGIN PERFORM public.link_lesson_to_plan('aula:inexistente', P2, NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:lesson-not-own-assignment' THEN RAISE EXCEPTION 'falha aula alheia: %', _e; END IF; END;
  LK2 := public.link_lesson_to_plan(NULL, NULL, LK);
  BEGIN PERFORM public.link_lesson_to_plan(NULL, NULL, LK);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'plan:stale-head' THEN RAISE EXCEPTION 'falha revogação dupla: %', _e; END IF; END;
  RESET ROLE;
  IF NOT EXISTS (SELECT 1 FROM public.teaching_plan_versions WHERE id = P2) OR NOT EXISTS (SELECT 1 FROM public.lesson_record_versions WHERE id = L1)
     OR (SELECT count(*) FROM public.teaching_plan_lesson_links WHERE lesson_logical_record_id = 'aula:z2-1') <> 2 THEN RAISE EXCEPTION 'falha: revogar apagou'; END IF;
  _ok := _ok || 'vinculo-explicito duplicado-recusado aula-alheia revogacao-evento nada-apagado ';

  -- Estrutura: sem current_date, search_path vazio, plano não insere aula
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('record_teaching_plan_version_v2','link_lesson_to_plan','plan_period_window','plan_periods_for_assignment','teaching_plans_overview_at')
      AND (prosrc ILIKE '%current_date%' OR NOT proconfig @> ARRAY['search_path=""'])) THEN RAISE EXCEPTION 'falha: current_date/search_path'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE (proname LIKE '%teaching_plan%' OR proname LIKE 'plan\_%' OR proname = 'link_lesson_to_plan')
      AND prosrc ~* 'insert\s+into\s+public\.(lesson_record_versions|attendance_record_versions)') THEN RAISE EXCEPTION 'falha: plano grava aula'; END IF;
  _ok := _ok || 'sem-current-date plano-nao-insere-aula planos-na-transacao=' || ((SELECT count(*) FROM public.teaching_plan_versions) - n0) || ' ';
  RAISE EXCEPTION 'z2-planning-e2e-ok: %', _ok;
END $t$;
