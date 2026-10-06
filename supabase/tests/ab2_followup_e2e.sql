-- Frente AB.2 — E2E sintético da ficha longitudinal e do acompanhamento. Termina em RAISE: nada persiste.
-- Cadeia: escola s1/turma → aluno A (alocação, aula/chamada, resultado zero) → transferência para s2 → intervenção autorizada → timeline por papel.
-- Dublês transacionais (rollback): calendário/matriz (W.2) e uma capacidade sintética de acompanhamento só para Orientação s1 e Supervisão;
-- nenhuma política real é alterada. Sucesso = 'ab2-followup-e2e-ok: ...'.
DO $t$
DECLARE _ok text := ''; j jsonb; rec uuid; rec2 uuid; st9 text := 'stu-ab2-'||gen_random_uuid(); en9 text := 'enr-ab2-'||gen_random_uuid(); en1b text := 'enr-ab2-'||gen_random_uuid(); al1 text;
  po uuid := gen_random_uuid(); uo uuid := gen_random_uuid(); psec uuid := gen_random_uuid(); usec uuid := gen_random_uuid(); psup uuid := gen_random_uuid(); usup uuid := gen_random_uuid(); pd2 uuid := gen_random_uuid(); ud2 uuid := gen_random_uuid(); eng_o uuid; ins text := 'ins-aa2-'||gen_random_uuid(); ev uuid; fp text; fp2 text; cf uuid; g jsonb; v1 uuid; v2 uuid; e0 int; st1 text := 'stu-w2-'||gen_random_uuid(); st2 text := 'stu-w2-'||gen_random_uuid(); en1 text := 'enr-w2-'||gen_random_uuid(); en2 text := 'enr-w2-'||gen_random_uuid(); al2 text := 'al-w2-'||gen_random_uuid(); org text := 'org-w2-'||gen_random_uuid(); per text := 'per-w2-'||gen_random_uuid(); blk uuid; L1 uuid; L2 uuid; A1 uuid; A2 uuid; n0 int; n1 int; m0 int; ok boolean; _e text; r jsonb; n int;
  y27 text := 'ano-500f63b6-b71d-4000-9762-bbb65c40d21d'; s1 text; s2 text; pol uuid;
  c27 text := 'tur-w2-' || gen_random_uuid()::text;
  pd uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); eng_dir uuid;
  pt uuid := gen_random_uuid(); ut uuid := gen_random_uuid(); eng_t uuid; fl_t uuid := gen_random_uuid();
  ps uuid := gen_random_uuid(); us uuid := gen_random_uuid(); ux uuid := gen_random_uuid(); eng_s uuid; fl_s uuid := gen_random_uuid();
  px uuid := gen_random_uuid(); eng_x uuid; fl_x uuid := gen_random_uuid();
  mid text := 'mat-' || gen_random_uuid()::text; mv uuid; jh uuid; sh uuid; ta text; tah uuid; sub text;
BEGIN
  al1 := 'al-ab2-a-'||gen_random_uuid();
  IF EXISTS (SELECT 1 FROM public.academic_year_operational_state_at(y27)) THEN RAISE EXCEPTION 'falha: 2027 já tem estado real'; END IF;
  SELECT id INTO s1 FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.institutional_schools WHERE id <> s1 ORDER BY id LIMIT 1;
  SELECT id INTO pol FROM public.capability_policies WHERE status = 'homologated' ORDER BY version DESC LIMIT 1;

  -- Cadeia sintética mínima (rollback)
  INSERT INTO public.institutional_persons(id, display_name) VALUES (pd,'Direção sintética W2'),(pt,'Titular sintético W2'),
    (ps,'Substituto sintético W2'),(px,'Outra pessoa sintética W2');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (ud, pd), (ut, pt), (us, ps), (ux, px);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (pd,'direcao-escolar','Direção (sintético)', s1,'2027-01-01','teste-w2','escola') RETURNING id INTO eng_dir;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (pt,'professor','Professor (sintético)', s1,'2027-01-01','teste-w2','escola') RETURNING id INTO eng_t;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (ps,'professor','Professor (sintético)', s1,'2027-01-01','teste-w2','escola') RETURNING id INTO eng_s;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (px,'professor','Professor (sintético)', s1,'2027-01-01','teste-w2','escola') RETURNING id INTO eng_x;
  INSERT INTO public.professional_functional_links(logical_id, version, person_id, link_nature_id, link_nature_version, valid_from)
    VALUES (fl_t,1,pt,'sintetico',1,'2027-01-01'),(fl_s,1,ps,'sintetico',1,'2027-01-01'),(fl_x,1,px,'sintetico',1,'2027-01-01');
  INSERT INTO public.professional_postings(logical_id, version, functional_link_logical_id, school_id, valid_from, valid_until)
    VALUES (gen_random_uuid(),1,fl_t,s1,'2027-01-01',NULL),(gen_random_uuid(),1,fl_s,s1,'2027-01-01',NULL),
           (gen_random_uuid(),1,fl_x,s1,'2027-01-01',NULL);
  INSERT INTO public.institutional_classes(id, school_id, school_label_snapshot, academic_year_id, academic_year_label, name, valid_from)
    VALUES (c27, s1, 'Escola (sintético)', y27, '2027', 'Turma sintética W2', '2027-02-01');
  INSERT INTO public.institutional_class_record_versions(class_id, segment_id, version, name, administrative_status, valid_from,
      originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id, authorizing_policy_id, created_at)
    VALUES (c27, gen_random_uuid(), 1, 'Turma sintética W2', 'ativa', '2027-02-01', 'teste-w2', ud, pd, eng_dir, pol, now() - interval '1 minute');
  INSERT INTO public.institutional_curricular_components(id, label) VALUES ('comp-v1-sintetico', 'Componente sintético W2');
  INSERT INTO public.curricular_component_versions(component_id, version, official_name, is_active, valid_from, recorded_by, recorded_via_engagement_id, created_at)
    VALUES ('comp-v1-sintetico', 1, 'Componente sintético W2', true, '2027-01-01', ud, eng_dir, now() - interval '1 minute');
  INSERT INTO public.institutional_curricular_matrices(id) VALUES (mid);
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, recorded_by, recorded_via_engagement_id)
    VALUES (mid, 1, 'constituicao', 'Matriz sintética W2', '2027-01-01', ud, eng_dir) RETURNING id INTO mv;
  INSERT INTO public.curricular_matrix_items(matrix_version_id, item_key, position, component_id, component_label_snapshot)
    VALUES (mv, 'k1', 1, 'comp-v1-sintetico', 'Elemento sintético');
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    VALUES (y27, 1, 'em-preparacao', 'teste sintético W2 (rollback)', 'teste-w2-rollback');

  SELECT count(*) INTO n0 FROM public.lesson_record_versions; SELECT count(*) INTO m0 FROM public.attendance_record_versions;
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.class_curricular_matrices_at(_school text, _class_id text, _on date, _known_at timestamptz)
   RETURNS TABLE(result_kind text, class_id text, valid_on date, known_at timestamptz, context_state text, gate_effect text, state text,
     matrix_id text, matrix_version_id uuid, matrix_homologation_id uuid, allocation_count integer, total_allocations integer,
     resolved_allocations integer, column_keys text[], correspondence_ids text[], association_id text, association_version_id uuid,
     association_homologation_id uuid) LANGUAGE plpgsql STABLE SET search_path TO '' AS $b$
  BEGIN IF _class_id = current_setting('v1.class', true) THEN
      result_kind := 'matrix'; state := 'resolvida-por-posicao'; matrix_id := current_setting('v1.mid'); class_id := _class_id; valid_on := _on; matrix_version_id := current_setting('v1.mv')::uuid; RETURN NEXT; END IF; END $b$$s$;
  -- Dublês do calendário (sem fabricar homologação real): um calendário aplicável; dia letivo salvo a data em w2.nonschool.
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.calendar_applicability_candidates(_on date, _known_at timestamptz, _school text, _allocation text, _position text, _axis jsonb)
    RETURNS TABLE(resolution text, calendar_id text, version_id uuid, scope_key text) LANGUAGE sql STABLE SET search_path TO '' AS
    $b$ SELECT 'candidato'::text, 'cal-w2'::text, NULL::uuid, 'escola'::text $b$$s$;
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.calendar_day_declarations(_calendar_id text, _date date, _known_at timestamptz)
    RETURNS TABLE(day_state text, version_id uuid, reference_issue text, homologation_state text, declaration_kind text, declaration_id text,
      starts_on date, ends_on date, event_label text, day_type_id text, day_type_version_id uuid, day_type_version integer, day_type_label text, school_day_effect boolean)
    LANGUAGE sql STABLE SET search_path TO '' AS
    $b$ SELECT 'declarado'::text, NULL::uuid, NULL::text, 'homologada'::text, 'dia'::text, 'd'::text, _date, _date, NULL::text, 't'::text, NULL::uuid, 1, 'Dia'::text,
        (_date::text IS DISTINCT FROM current_setting('w2.nonschool', true)) $b$$s$;
  PERFORM set_config('v1.class', c27, true); PERFORM set_config('v1.mv', mv::text, true); PERFORM set_config('w2.nonschool', '2027-03-15', true); PERFORM set_config('v1.mid', mid, true);

  -- Direção organiza: jornada, grade (segunda-feira), atribuição do titular, substituição de abril
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := public.record_class_journey_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"12:00"}]');
  r := public.record_class_schedule_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL,
      jsonb_build_array(jsonb_build_object('block_key','b1','weekday',1,'starts_at','07:00','ends_at','07:50','matrix_version_id',mv,'item_key','k1')));
  r := public.record_teaching_assignment_version_v2(c27, NULL, NULL, 'constituicao', '2027-02-01', '2027-06-30', eng_t, fl_t, mv, 'k1', NULL, NULL, NULL, NULL, NULL);
  ta := r->>'assignment_id';
  r := public.record_teaching_substitution_version(ta, NULL, NULL, 'constituicao', '2027-04-01', '2027-04-30', eng_s, fl_s, false, NULL, 'licença sintética');
  sub := r->>'substitution_id';
  RESET ROLE;
  SELECT b.id INTO blk FROM public.class_schedule_blocks b JOIN public.class_schedule_versions v ON v.id = b.version_id JOIN public.class_schedules s ON s.id = v.schedule_id
   WHERE s.class_id = c27 LIMIT 1;

  -- Período, alunos e alocações (fixtures de fatos de origem, rollback)
  INSERT INTO public.institutional_period_organizations(id, academic_year_id) VALUES (org, y27);
  INSERT INTO public.institutional_academic_periods(id, academic_year_id, label, starts_on, ends_on, period_organization_id) VALUES (per, y27, 'P1 sintético', '2027-02-01', '2027-06-30', org);
  INSERT INTO public.institutional_academic_period_versions(period_id, version, official_name, starts_on, ends_on, is_active, valid_from, recorded_by, recorded_by_person_id, recorded_via_engagement_id, created_at)
    VALUES (per, 1, 'P1 sintético', '2027-02-01', '2027-06-30', true, '2027-02-01', ud, pd, eng_dir, now() - interval '1 minute');
  INSERT INTO public.institutional_class_period_organization_versions(class_id, version, organization_id, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id, segment_id, authorizing_policy_id, created_at)
    VALUES (c27, 1, org, '2027-02-01', 'teste-w2', ud, pd, eng_dir, gen_random_uuid(), pol, now() - interval '1 minute');
  INSERT INTO public.institutional_students(id, display_name) VALUES (st1, 'Aluno sintético A'), (st2, 'Aluno sintético B');
  INSERT INTO public.school_enrollments(id, student_id, school_id, opened_on, academic_year_id) VALUES (en1, st1, s1, '2027-02-01', y27), (en2, st2, s1, '2027-02-01', y27);
  INSERT INTO public.class_enrollment_episodes(id, logical_id, enrollment_id, student_id, school_id, class_id, class_label_snapshot, valid_from)
    VALUES ('al-w2-'||gen_random_uuid(), al1, en1, st1, s1, c27, 'Turma sintética', '2027-02-01'),
           (al2, al2, en2, st2, s1, c27, 'Turma sintética', '2027-03-01');   -- B entra só em março
  INSERT INTO public.class_allocation_ending_versions(allocation_logical_id, school_id, class_id, version, ended_on, reason_text, recorded_by)
    VALUES (al2, s1, c27, 1, '2027-04-30', 'transferência sintética', ud);         -- B sai em 30/04

  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, supersedes_id, reason, technical_provenance)
    SELECT y27, 2, 'operacional', id, 'teste sintético AB2 (rollback)', 'teste-ab2-rollback' FROM public.academic_year_operational_states WHERE academic_year_id = y27 AND sequence = 1;
  -- Multi-escola: A transferido para s2 (saída de c27 em 31/03 + matrícula em s2); st9 só em s2 (alvo de IDOR)
  INSERT INTO public.class_allocation_ending_versions(allocation_logical_id, school_id, class_id, version, ended_on, reason_text, recorded_by)
    VALUES (al1, s1, c27, 1, '2027-03-31', 'texto livre que não pode vazar', ud);
  INSERT INTO public.institutional_students(id, display_name) VALUES (st9, 'Aluno sintético C');
  INSERT INTO public.school_enrollments(id, student_id, school_id, opened_on, academic_year_id) VALUES (en1b, st1, s2, '2027-04-01', y27), (en9, st9, s2, '2027-02-01', y27);
  -- Papéis sintéticos: Orientação s1, Secretaria s1, Direção s2, Supervisão (rede)
  INSERT INTO public.institutional_persons(id, display_name) VALUES (po,'Orientação sintética AB2'),(psec,'Secretaria sintética AB2'),(psup,'Supervisão sintética AB2'),(pd2,'Direção s2 sintética AB2');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (uo, po), (usec, psec), (usup, psup), (ud2, pd2);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (po,'orientacao-pedagogica','Orientação (sintético)', s1,'2027-01-01','teste-ab2','escola') RETURNING id INTO eng_o;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (psec,'secretaria-escolar','Secretaria (sintético)', s1,'2027-01-01','teste-ab2','escola'),
           (pd2,'direcao-escolar','Direção (sintético)', s2,'2027-01-01','teste-ab2','escola');
  -- Dublê transacional: capacidade de acompanhamento (não atribuída em nenhuma política real) concedida só a Orientação s1 e Supervisão rede
  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_ab2_original;
  EXECUTE $s$CREATE FUNCTION public.effective_scope_capabilities(_on date)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $b$
      SELECT * FROM public.esc_ab2_original(_on)
      UNION ALL
      SELECT x->>'cap', (x->>'eng')::uuid, (x->>'pol')::uuid, 1, x->>'scope', x->>'school'
        FROM pg_catalog.jsonb_array_elements(coalesce(nullif(pg_catalog.current_setting('ab2.extra', true),''),'[]')::jsonb) x
       WHERE (x->>'uid')::uuid = auth.uid() $b$$s$;
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated';
  PERFORM set_config('ab2.extra', jsonb_build_array(
    jsonb_build_object('uid',uo,'cap','consultar-acompanhamento-pedagogico','eng',eng_o,'pol',pol,'scope','escola','school',s1),
    jsonb_build_object('uid',uo,'cap','registrar-acompanhamento-pedagogico','eng',eng_o,'pol',pol,'scope','escola','school',s1),
    jsonb_build_object('uid',usup,'cap','consultar-acompanhamento-pedagogico','eng',gen_random_uuid(),'pol',pol,'scope','rede','school',NULL),
    jsonb_build_object('uid',usup,'cap','consultar-matricula-e-movimentacao','eng',gen_random_uuid(),'pol',pol,'scope','rede','school',NULL))::text, true);
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status) VALUES ('categoria-de-acompanhamento-pedagogico','ab2-sint',1,'Categoria sintética','homologada');

  -- Fatos brutos do professor: aula com chamada (A presente), aula com A sem marcação, resultado zero
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_lesson_version_v2('aula:ab2-1', ta, NULL, '2027-02-08', NULL, '{"content":"x"}', ARRAY[blk], '{}', NULL, NULL, 'ab2-l1');
  PERFORM public.record_attendance_version_v2('aula:ab2-1', NULL, jsonb_build_object('aula', jsonb_build_object(st1, 'Presente')), NULL, 'ab2-a1');
  PERFORM public.record_lesson_version_v2('aula:ab2-2', ta, NULL, '2027-03-08', NULL, '{"content":"y"}', ARRAY[blk], '{}', NULL, NULL, 'ab2-l2');
  PERFORM public.record_attendance_version_v2('aula:ab2-2', NULL, jsonb_build_object('aula', jsonb_build_object(st2, 'Presente')), NULL, 'ab2-a2');
  PERFORM public.create_assessment_instrument_v2('ins-ab2-'||ta, ta, per, 'prova', '{}', '2027-03-08', '{}');
  PERFORM public.apply_assessment_instrument_v2('ins-ab2-'||ta, NULL, '2027-03-10');
  PERFORM public.register_assessment_results_v2('ins-ab2-'||ta, 'ab2-r1', 'cfg', 0, NULL, jsonb_build_array(jsonb_build_object('studentId', st1, 'value', '{"kind":"numerica","value":0}'::jsonb)));

  -- Professor: só a própria turma/atribuição; matrícula e acompanhamento não autorizados; s2 invisível; outro aluno ⇒ access-denied
  j := public.student_trajectory_at(st1, '2027-03-10', NULL);
  IF j->>'result' <> 'ok' OR j->'domains'->>'matricula' <> 'nao-autorizado' OR j->'domains'->>'acompanhamento' <> 'nao-autorizado'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(j->'events') e WHERE e->>'school_id' = s2 OR e->>'domain' = 'matricula') THEN RAISE EXCEPTION 'falha professor escopo: %', j; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j->'events') e WHERE e->>'domain'='frequencia' AND e->>'mark'='Presente')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j->'events') e WHERE e->>'domain'='frequencia' AND e->'mark' = 'null'::jsonb AND e->>'label' LIKE '%pendente%')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j->'events') e WHERE e->>'domain'='avaliacao' AND e->'value'->>'value' = '0') THEN RAISE EXCEPTION 'falha pendente≠falta / zero real: %', j; END IF;
  IF j->'alerts'->>'state' <> 'bloqueado-sem-regra-homologada' OR jsonb_array_length(j->'alerts'->'items') <> 0 THEN RAISE EXCEPTION 'falha alerta'; END IF;
  IF public.student_trajectory_at(st9, '2027-03-10', NULL)->>'result' <> 'access-denied' OR public.student_trajectory_at('stu-inexistente', '2027-03-10', NULL) <> public.student_trajectory_at(st9, '2027-03-10', NULL)
    THEN RAISE EXCEPTION 'falha IDOR professor'; END IF;
  IF public.student_trajectory_at(st1, '2027-08-10', NULL)->>'result' <> 'access-denied' THEN RAISE EXCEPTION 'falha professor fora da atribuição'; END IF;
  BEGIN PERFORM public.record_school_pedagogical_record_v2(NULL, 'registro', s1, 'estudante', st1, 'ab2-sint', 'x', 'acompanhamento-da-escola', '2026-09-01', NULL, NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e NOT LIKE 'capability:%' THEN RAISE EXCEPTION 'falha professor intervém: %', _e; END IF; END;
  _ok := _ok || 'professor-propria-atribuicao professor-fora-negado pendente≠falta zero-real alertas-bloqueados idor-uniforme ';

  -- Orientação s1: intervenção autorizada, retificação stale recusada, catálogo não homologado recusado
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uo, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_school_pedagogical_record_v2(NULL, 'registro', s1, 'estudante', st1, 'inventada', 'x', 'acompanhamento-da-escola', '2026-09-01', NULL, NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'followup:category-not-homologated' THEN RAISE EXCEPTION 'falha catálogo: %', _e; END IF; END;
  BEGIN PERFORM public.record_school_pedagogical_record_v2(NULL, 'registro', s1, 'estudante', st1, 'ab2-sint', 'x', 'acompanhamento-da-escola', '2026-09-01', NULL, NULL, NULL, NULL, NULL, 'inventado'); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'followup:status-not-homologated' THEN RAISE EXCEPTION 'falha situação: %', _e; END IF; END;
  BEGIN PERFORM public.record_school_pedagogical_record_v2(NULL, 'registro', s1, 'estudante', st9, 'ab2-sint', 'x', 'acompanhamento-da-escola', '2026-09-01', NULL, NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'followup:subject-not-in-school' THEN RAISE EXCEPTION 'falha aluno de outra escola: %', _e; END IF; END;
  rec := public.record_school_pedagogical_record_v2(NULL, 'registro', s1, 'estudante', st1, 'ab2-sint', 'conteúdo restrito', 'acompanhamento-da-escola', '2026-09-01', NULL, 'Encaminhamento sintético', po, per, '2026-09-15', NULL);
  rec2 := public.record_school_pedagogical_record_v2(rec, 'retificacao', NULL, NULL, NULL, 'ab2-sint', 'retificado', 'acompanhamento-da-escola', '2026-09-01', 'correção', 'Encaminhamento', po, per, '2026-09-20', NULL);
  BEGIN PERFORM public.record_school_pedagogical_record_v2(rec, 'retificacao', NULL, NULL, NULL, 'ab2-sint', 'y', 'acompanhamento-da-escola', '2026-09-01', 'c', NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT; IF _e <> 'followup:base-superseded' THEN RAISE EXCEPTION 'falha stale-head: %', _e; END IF; END;
  j := public.student_trajectory_at(st1, '2027-05-01', NULL);
  IF j->'domains'->>'acompanhamento' <> 'com-fatos' OR (SELECT count(*) FROM jsonb_array_elements(j->'events') e WHERE e->>'domain'='acompanhamento') <> 1
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j->'events') e WHERE e->>'source_id' = rec2::text AND e->>'return_on' = '2026-09-20')
     OR j::text LIKE '%retificado%' OR j::text LIKE '%texto livre%' OR j::text LIKE '%Aluno sintético%'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(j->'events') e WHERE e->>'school_id' = s2) THEN RAISE EXCEPTION 'falha orientação/PII: %', j; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j->'events') e WHERE e->>'source'='class_allocation_ending_versions' AND e->>'on'='2027-03-31')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j->'events') e WHERE e->>'source'='attendance_record_versions')
     OR (SELECT count(*) FROM jsonb_array_elements(public.student_trajectory_at(st1, '2027-05-01', NULL, NULL, NULL, ARRAY['frequencia'])->'events')) <> 2 THEN RAISE EXCEPTION 'falha timeline/filtro: %', j; END IF;
  IF public.student_trajectory_at(st9, '2027-05-01', NULL)->>'result' <> 'access-denied' THEN RAISE EXCEPTION 'falha orientação outra escola'; END IF;
  _ok := _ok || 'catalogo-homologado situacao-homologada aluno-outra-escola intervencao retificacao stale-head orientacao-propria-escola pii-minima timeline filtros ';

  -- Secretaria s1: só domínios administrativos
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', usec, 'role', 'authenticated')::text, true);
  j := public.student_trajectory_at(st1, '2027-05-01', NULL);
  IF j->'domains'->>'matricula' <> 'com-fatos' OR j->'domains'->>'frequencia' <> 'nao-autorizado' OR j->'domains'->>'avaliacao' <> 'nao-autorizado' OR j->'domains'->>'acompanhamento' <> 'nao-autorizado'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(j->'events') e WHERE e->>'domain' IN ('frequencia','avaliacao','acompanhamento','fechamento') OR e->>'school_id' = s2) THEN RAISE EXCEPTION 'falha secretaria: %', j; END IF;
  -- Direção s2: só a parte s2 da história (matrícula de transferência), nada de s1
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud2, 'role', 'authenticated')::text, true);
  j := public.student_trajectory_at(st1, '2027-05-01', NULL);
  IF j->>'result' <> 'ok' OR EXISTS (SELECT 1 FROM jsonb_array_elements(j->'events') e WHERE e->>'school_id' = s1)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j->'events') e WHERE e->>'school_id' = s2 AND e->>'domain'='matricula') THEN RAISE EXCEPTION 'falha direção s2: %', j; END IF;
  -- Supervisão (rede): ambas as escolas, com proveniência
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', usup, 'role', 'authenticated')::text, true);
  j := public.student_trajectory_at(st1, '2027-05-01', NULL);
  IF (SELECT count(DISTINCT e->>'school_id') FROM jsonb_array_elements(j->'events') e WHERE e->>'domain'='matricula') <> 2
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(j->'events') e WHERE e->>'source' IS NULL OR e->>'source_id' IS NULL OR e->>'known_at' IS NULL) THEN RAISE EXCEPTION 'falha supervisão: %', j; END IF;
  -- knownAt: antes dos fatos, nada é conhecido
  IF public.student_trajectory_at(st1, '2027-05-01', now() - interval '1 day')->>'result' <> 'access-denied' THEN RAISE EXCEPTION 'falha knownAt'; END IF;
  _ok := _ok || 'secretaria-administrativa direcao-outra-escola-isolada supervisao-rede proveniencia known-at ';
  RESET ROLE;

  -- Papéis técnicos
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.student_trajectory_at(st1, '2027-05-01', NULL); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE service_role;
  BEGIN PERFORM public.student_trajectory_at(st1, '2027-05-01', NULL); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.record_school_pedagogical_record_v2(NULL, 'registro', s1, 'estudante', st1, 'ab2-sint', 'x', 'acompanhamento-da-escola', '2026-09-01', NULL, NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.school_pedagogical_records(logical_id) VALUES (gen_random_uuid()); RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_school_pedagogical_record(NULL, 'registro', s1, 'estudante', st1, 'ab2-sint', 'x', 'acompanhamento-da-escola', '2026-09-01', NULL); RAISE EXCEPTION 'aberto';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  _ok := _ok || 'anon/service_role/legado-negados ';
  RAISE EXCEPTION 'ab2-followup-e2e-ok: %', _ok;
END $t$;
