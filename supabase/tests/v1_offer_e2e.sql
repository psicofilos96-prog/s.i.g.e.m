-- Frente V.1 — E2E sintético POSITIVO + recusas + lacunas temporais (0129–0132 + 0143).
-- Termina em RAISE: nada persiste. Dados sintéticos sem PII; nenhuma pessoa real, nenhum ato real.
-- Dublê ÚNICO: class_curricular_matrices_at (resolvedor U/E1–E4, provado nas suítes próprias) é
-- substituído DENTRO da transação por um resolvedor controlado, para provar a cadeia V sem fabricar
-- homologações curriculares. O dublê é desfeito pelo rollback.
-- Sucesso = 'v1-offer-e2e-ok: ...'.
DO $t$
DECLARE _ok text := ''; _e text; r jsonb; n int;
  y27 text := 'ano-500f63b6-b71d-4000-9762-bbb65c40d21d'; s1 text; s2 text; pol uuid;
  c27 text := 'tur-v1-' || gen_random_uuid()::text;
  pd uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); eng_dir uuid;
  pt uuid := gen_random_uuid(); ut uuid := gen_random_uuid(); eng_t uuid; fl_t uuid := gen_random_uuid();
  ps uuid := gen_random_uuid(); eng_s uuid; fl_s uuid := gen_random_uuid();
  px uuid := gen_random_uuid(); eng_x uuid; fl_x uuid := gen_random_uuid();
  mid text := 'mat-' || gen_random_uuid()::text; mv uuid; jh uuid; sh uuid; ta text; tah uuid; sub text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.academic_year_operational_state_at(y27)) THEN RAISE EXCEPTION 'falha: 2027 já tem estado real'; END IF;
  SELECT id INTO s1 FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.institutional_schools WHERE id <> s1 ORDER BY id LIMIT 1;
  SELECT id INTO pol FROM public.capability_policies WHERE status = 'homologated' ORDER BY version DESC LIMIT 1;

  -- Cadeia sintética mínima (rollback)
  INSERT INTO public.institutional_persons(id, display_name) VALUES (pd,'Direção sintética V1'),(pt,'Titular sintético V1'),
    (ps,'Substituto sintético V1'),(px,'Outra pessoa sintética V1');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (ud, pd), (ut, pt);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (pd,'direcao-escolar','Direção (sintético)', s1,'2027-01-01','teste-v1','escola') RETURNING id INTO eng_dir;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (pt,'professor','Professor (sintético)', s1,'2027-01-01','teste-v1','escola') RETURNING id INTO eng_t;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (ps,'professor','Professor (sintético)', s1,'2027-01-01','teste-v1','escola') RETURNING id INTO eng_s;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, school_id, valid_from, originating_act_ref, scope_level)
    VALUES (px,'professor','Professor (sintético)', s1,'2027-01-01','teste-v1','escola') RETURNING id INTO eng_x;
  INSERT INTO public.professional_functional_links(logical_id, version, person_id, link_nature_id, link_nature_version, valid_from)
    VALUES (fl_t,1,pt,'sintetico',1,'2027-01-01'),(fl_s,1,ps,'sintetico',1,'2027-01-01'),(fl_x,1,px,'sintetico',1,'2027-01-01');
  INSERT INTO public.professional_postings(logical_id, version, functional_link_logical_id, school_id, valid_from, valid_until)
    VALUES (gen_random_uuid(),1,fl_t,s1,'2027-01-01',NULL),(gen_random_uuid(),1,fl_s,s1,'2027-01-01',NULL),
           (gen_random_uuid(),1,fl_x,s1,'2027-01-01','2027-04-15');  -- lotação que termina no meio da janela
  INSERT INTO public.institutional_classes(id, school_id, school_label_snapshot, academic_year_id, academic_year_label, name, valid_from)
    VALUES (c27, s1, 'Escola (sintético)', y27, '2027', 'Turma sintética V1', '2027-02-01');
  INSERT INTO public.institutional_class_record_versions(class_id, segment_id, version, name, administrative_status, valid_from,
      originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id, authorizing_policy_id, created_at)
    VALUES (c27, gen_random_uuid(), 1, 'Turma sintética V1', 'ativa', '2027-02-01', 'teste-v1', ud, pd, eng_dir, pol, now() - interval '1 minute');
  INSERT INTO public.institutional_curricular_components(id, label) VALUES ('comp-v1-sintetico', 'Componente sintético V1');
  INSERT INTO public.institutional_curricular_matrices(id) VALUES (mid);
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, recorded_by, recorded_via_engagement_id)
    VALUES (mid, 1, 'constituicao', 'Matriz sintética V1', '2027-01-01', ud, eng_dir) RETURNING id INTO mv;
  INSERT INTO public.curricular_matrix_items(matrix_version_id, item_key, position, component_id, component_label_snapshot)
    VALUES (mv, 'k1', 1, 'comp-v1-sintetico', 'Elemento sintético');
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance)
    VALUES (y27, 1, 'em-preparacao', 'teste sintético V1 (rollback)', 'teste-v1-rollback');

  -- Dublê do resolvedor curricular U: aplica a matriz sintética à turma sintética, exceto na lacuna configurada.
  EXECUTE $s$CREATE OR REPLACE FUNCTION public.class_curricular_matrices_at(_school text, _class_id text, _on date, _known_at timestamptz)
   RETURNS TABLE(result_kind text, class_id text, valid_on date, known_at timestamptz, context_state text, gate_effect text, state text,
     matrix_id text, matrix_version_id uuid, matrix_homologation_id uuid, allocation_count integer, total_allocations integer,
     resolved_allocations integer, column_keys text[], correspondence_ids text[], association_id text, association_version_id uuid,
     association_homologation_id uuid) LANGUAGE plpgsql STABLE SET search_path TO '' AS $b$
  BEGIN
    IF _class_id = current_setting('v1.class', true) AND NOT (_on BETWEEN
         coalesce(nullif(current_setting('v1.gap_from', true), '')::date, 'infinity'::date)
     AND coalesce(nullif(current_setting('v1.gap_to', true), '')::date, 'infinity'::date)) THEN
      result_kind := 'matrix'; class_id := _class_id; valid_on := _on; matrix_version_id := current_setting('v1.mv')::uuid; RETURN NEXT;
    END IF;
  END $b$$s$;
  PERFORM set_config('v1.class', c27, true); PERFORM set_config('v1.mv', mv::text, true);

  -- anon / service_role: nunca executam writers humanos
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.record_class_journey_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL, '[]');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE; SET LOCAL ROLE service_role;
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c27, NULL, NULL, 'constituicao', '2027-02-01', NULL, eng_t, fl_t, mv, 'k1', NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  _ok := _ok || 'anon/service_role-negados ';

  -- Professor sem capability de escola: não organiza jornada
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ut, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.record_class_journey_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL, '[{"weekday":1,"starts_at":"07:00","ends_at":"12:00"}]');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'capability:manter-jornada-da-turma' THEN RAISE EXCEPTION 'falha professor sem capability: %', _e; END IF; END;
  RESET ROLE;
  _ok := _ok || 'sem-capability ';

  -- ===== Caminho positivo como Direção da própria escola =====
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := public.record_class_journey_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL,
         '[{"weekday":1,"starts_at":"07:00","ends_at":"12:00"},{"weekday":2,"starts_at":"07:00","ends_at":"12:00"}]');
  jh := (r->>'version_id')::uuid;
  _ok := _ok || 'jornada ';
  -- Bloco fora da jornada: recusado
  BEGIN PERFORM public.record_class_schedule_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL,
      jsonb_build_array(jsonb_build_object('block_key','b1','weekday',1,'starts_at','12:30','ends_at','13:20','matrix_version_id',mv,'item_key','k1')));
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'schedule:block-outside-journey' THEN RAISE EXCEPTION 'falha fora jornada: %', _e; END IF; END;
  -- Item inexistente: recusado
  BEGIN PERFORM public.record_class_schedule_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL,
      jsonb_build_array(jsonb_build_object('block_key','b1','weekday',1,'starts_at','07:00','ends_at','07:50','matrix_version_id',mv,'item_key','nao-existe')));
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'schedule:element-not-in-matrix' THEN RAISE EXCEPTION 'falha item: %', _e; END IF; END;
  -- Lacuna intermediária da matriz (início e fim válidos, meio não): recusada
  PERFORM set_config('v1.gap_from', '2027-06-10', true); PERFORM set_config('v1.gap_to', '2027-06-12', true);
  BEGIN PERFORM public.record_class_schedule_version(c27, NULL, 'constituicao', '2027-02-01', '2027-12-31', NULL, NULL,
      jsonb_build_array(jsonb_build_object('block_key','b1','weekday',1,'starts_at','07:00','ends_at','07:50','matrix_version_id',mv,'item_key','k1')));
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'schedule:matrix-not-applicable' THEN RAISE EXCEPTION 'falha lacuna matriz grade: %', _e; END IF; END;
  -- Fronteira adjacente: janela terminando no dia anterior à lacuna é aceita depois (sem lacuna configurada abaixo)
  PERFORM set_config('v1.gap_from', '', true); PERFORM set_config('v1.gap_to', '', true);
  r := public.record_class_schedule_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL,
      jsonb_build_array(jsonb_build_object('block_key','b1','weekday',1,'starts_at','07:00','ends_at','07:50','matrix_version_id',mv,'item_key','k1'),
                        jsonb_build_object('block_key','b2','weekday',2,'starts_at','07:00','ends_at','07:50','matrix_version_id',mv,'item_key','k1')));
  sh := (r->>'version_id')::uuid;
  IF (r->>'blocks')::int <> 2 THEN RAISE EXCEPTION 'falha: blocos gravados'; END IF;
  -- stale-head
  BEGIN PERFORM public.record_class_schedule_version(c27, NULL, 'constituicao', '2027-02-01', NULL, NULL, NULL,
      jsonb_build_array(jsonb_build_object('block_key','b1','weekday',1,'starts_at','07:00','ends_at','07:50','matrix_version_id',mv,'item_key','k1')));
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'schedule:stale-head' THEN RAISE EXCEPTION 'falha stale grade: %', _e; END IF; END;
  _ok := _ok || 'grade lacuna-matriz-grade stale-head ';

  -- Atribuição: recusas
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c27, NULL, NULL, 'constituicao', '2027-02-01', NULL, eng_t, fl_s, mv, 'k1', NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'assignment:functional-link-not-of-person' THEN RAISE EXCEPTION 'falha vínculo outra pessoa: %', _e; END IF; END;
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c27, NULL, NULL, 'constituicao', '2027-02-01', '2027-06-30', eng_x, fl_x, mv, 'k1', NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'assignment:no-school-posting-throughout' THEN RAISE EXCEPTION 'falha lotação parcial: %', _e; END IF; END;
  PERFORM set_config('v1.gap_from', '2027-09-01', true); PERFORM set_config('v1.gap_to', '2027-09-01', true);
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c27, NULL, NULL, 'constituicao', '2027-02-01', '2027-11-30', eng_t, fl_t, mv, 'k1', NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'assignment:matrix-not-applicable' THEN RAISE EXCEPTION 'falha lacuna matriz atribuição: %', _e; END IF; END;
  -- Fronteira adjacente: janela que termina no dia anterior à lacuna é aceita
  r := public.record_teaching_assignment_version_v2(c27, NULL, NULL, 'constituicao', '2027-02-01', '2027-08-31', eng_t, fl_t, mv, 'k1', NULL, NULL, NULL, NULL, NULL);
  ta := r->>'assignment_id'; tah := (r->>'version_id')::uuid;
  PERFORM set_config('v1.gap_from', '', true); PERFORM set_config('v1.gap_to', '', true);
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c27, ta, NULL, 'retificacao', '2027-02-01', NULL, eng_t, fl_t, mv, 'k1', NULL, NULL, NULL, NULL, 'x');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'assignment:stale-head' THEN RAISE EXCEPTION 'falha stale atribuição: %', _e; END IF; END;
  r := public.record_teaching_assignment_version_v2(c27, ta, tah, 'retificacao', '2027-02-01', NULL, eng_t, fl_t, mv, 'k1', NULL, NULL, NULL, NULL, 'ampliação sintética');
  tah := (r->>'version_id')::uuid;
  BEGIN PERFORM public.record_teaching_assignment_version_v2(c27, NULL, NULL, 'constituicao', '2027-03-01', NULL, eng_t, fl_t, mv, 'k1', NULL, NULL, NULL, NULL, NULL);
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'assignment:overlap' THEN RAISE EXCEPTION 'falha duplicidade: %', _e; END IF; END;
  _ok := _ok || 'atribuicao vinculo lotacao-parcial lacuna-matriz-atribuicao fronteira-adjacente stale-head duplicidade ';

  -- Substituição
  BEGIN PERFORM public.record_teaching_substitution_version(ta, NULL, NULL, 'constituicao', '2027-04-01', '2027-04-30', eng_t, fl_t, false, NULL, 'licença sintética');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'substitution:substitute-is-titular' THEN RAISE EXCEPTION 'falha titular=substituto: %', _e; END IF; END;
  BEGIN PERFORM public.record_teaching_substitution_version(ta, NULL, NULL, 'constituicao', '2027-04-01', '2027-04-30', eng_x, fl_x, false, NULL, 'licença sintética');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'substitution:no-school-posting-throughout' THEN RAISE EXCEPTION 'falha lotação substituto: %', _e; END IF; END;
  BEGIN PERFORM public.record_teaching_substitution_version(ta, NULL, NULL, 'constituicao', '2027-04-01', '2027-04-30', eng_s, fl_s, false, NULL, '  ');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'substitution:reason-required' THEN RAISE EXCEPTION 'falha motivo: %', _e; END IF; END;
  r := public.record_teaching_substitution_version(ta, NULL, NULL, 'constituicao', '2027-04-01', '2027-04-30', eng_s, fl_s, false, NULL, 'licença sintética');
  sub := r->>'substitution_id';
  BEGIN PERFORM public.record_teaching_substitution_version(ta, NULL, NULL, 'constituicao', '2027-04-20', '2027-05-10', eng_x, fl_x, false, NULL, 'outra');
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e NOT IN ('substitution:overlap','substitution:no-school-posting-throughout') THEN RAISE EXCEPTION 'falha sobreposição: %', _e; END IF; END;
  _ok := _ok || 'substituicao ';

  -- Readers: titular fora da janela, substituto dentro; titular permanece
  IF NOT EXISTS (SELECT 1 FROM public.school_teaching_schedule_at(s1, '2027-04-05', now()) x WHERE x.class_id = c27 AND x.origin = 'substituicao' AND x.engagement_id = eng_s)
     OR NOT EXISTS (SELECT 1 FROM public.school_teaching_schedule_at(s1, '2027-04-05', now()) x WHERE x.class_id = c27 AND x.origin = 'titular' AND x.engagement_id = eng_t)
     OR EXISTS (SELECT 1 FROM public.school_teaching_schedule_at(s1, '2027-05-03', now()) x WHERE x.class_id = c27 AND x.origin = 'substituicao')
  THEN RAISE EXCEPTION 'falha: projeção do horário'; END IF;
  SELECT count(*) INTO n FROM public.class_schedule_at(c27, '2027-04-05', now()) x WHERE x.result_kind = 'block' AND eng_s = ANY(x.engagement_ids) AND eng_t = ANY(x.engagement_ids);
  IF n < 1 THEN RAISE EXCEPTION 'falha: class_schedule_at responsáveis (%)', n; END IF;
  IF EXISTS (SELECT 1 FROM public.school_teaching_load_at(s1, '2027-04-05', now()) l WHERE l.result_kind = 'load' AND l.balance_state <> 'nao-calculavel') THEN
    RAISE EXCEPTION 'falha: saldo calculado sem fonte contratual'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_diary_readiness_at(c27, '2027-04-05', now()) x WHERE x.scope = 'resultado' AND x.state <> 'ready')
     OR NOT EXISTS (SELECT 1 FROM public.class_diary_readiness_at(c27, '2027-04-05', now()) x WHERE x.code = 'ano-em-preparacao:organizacao-permitida-diario-nao')
  THEN RAISE EXCEPTION 'falha: prontidão em preparação'; END IF;
  SELECT string_agg(x.code || '=' || x.state, ',' ORDER BY x.code) INTO _e FROM public.class_diary_readiness_at(c27, '2027-04-05', now()) x;
  _ok := _ok || 'readers saldo-nao-calculavel prontidao[' || coalesce(_e,'') || '] ';

  -- Lacuna intermediária da JORNADA: jan–mai + ago–dez; grade mar–dez recusada (0129 aceitava: início, fim e início de versão válidos)
  r := public.record_class_journey_version(c27, jh, 'retificacao', '2027-02-01', '2027-05-31', NULL, 'recorte sintético',
         '[{"weekday":1,"starts_at":"07:00","ends_at":"12:00"},{"weekday":2,"starts_at":"07:00","ends_at":"12:00"}]');
  r := public.record_class_journey_version(c27, (r->>'version_id')::uuid, 'sucessao', '2027-08-01', NULL, NULL, 'retomada sintética',
         '[{"weekday":1,"starts_at":"07:00","ends_at":"12:00"},{"weekday":2,"starts_at":"07:00","ends_at":"12:00"}]');
  BEGIN PERFORM public.record_class_schedule_version(c27, sh, 'sucessao', '2027-03-01', NULL, NULL, 'teste lacuna',
      jsonb_build_array(jsonb_build_object('block_key','b1','weekday',1,'starts_at','07:00','ends_at','07:50','matrix_version_id',mv,'item_key','k1')));
    RAISE EXCEPTION 'aberto'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _e = MESSAGE_TEXT;
    IF _e <> 'schedule:journey-absent' THEN RAISE EXCEPTION 'falha lacuna jornada: %', _e; END IF; END;
  -- Parcialmente coberto (só até o fim do primeiro trecho): aceito
  r := public.record_class_schedule_version(c27, sh, 'sucessao', '2027-03-01', '2027-05-31', NULL, 'trecho coberto',
      jsonb_build_array(jsonb_build_object('block_key','b1','weekday',1,'starts_at','07:00','ends_at','07:50','matrix_version_id',mv,'item_key','k1')));
  RESET ROLE;
  _ok := _ok || 'lacuna-jornada trecho-coberto ';

  RAISE EXCEPTION 'v1-offer-e2e-ok: %', _ok;
END $t$;
