-- B4.6.4d — Janelas temporais por recorte de aplicabilidade. Teste transacional real: termina em RAISE, nada persiste.
-- Sucesso = 'b464d-tests-ok: ...'. Permissões positivas só por política SINTÉTICA homologada dentro do teste;
-- v1/v2 reais continuam draft. IDs, nomes, catálogos e datas são fictícios e não representam norma.
DO $t$
DECLARE
  u_sup text := '{"sub":"00000000-0000-0000-0000-00000b464d01","role":"authenticated"}';
  u_bld text := '{"sub":"00000000-0000-0000-0000-00000b464d02","role":"authenticated"}';
  u_sec text := '{"sub":"00000000-0000-0000-0000-00000b464d04","role":"authenticated"}';
  p1 uuid := '00000000-0000-0000-0000-00000b464d91'; p2 uuid := '00000000-0000-0000-0000-00000b464d92';
  p4 uuid := '00000000-0000-0000-0000-00000b464d94'; pol uuid := '00000000-0000-0000-0000-00000b464da0';
  sig_new text := 'public.record_calendar_version_with_windowed_applicability(text,uuid,text,text,text,date,date,text,text,jsonb,jsonb,jsonb,jsonb,jsonb)';
  sig_mid text := 'public.record_calendar_version_with_applicability(text,uuid,text,text,text,date,date,text,text,jsonb,jsonb,jsonb,jsonb,jsonb)';
  sig_old text := 'public.record_calendar_version(text,uuid,text,text,text,date,date,text,text,jsonb,jsonb,jsonb,jsonb)';
  sig_res text := 'public.calendar_applicability_candidates(date,timestamptz,text,text,text,jsonb)';
  _yr text := 'ano-b464d'; _org text := 'org-b464d'; _per text := 'per-b464d';
  e1 uuid; cls text; cls2 text; cls_x text; t jsonb; c1 jsonb; c1r jsonb; c2 jsonb; c3 jsonb; t_before timestamptz;
  ok text := ''; n integer; s text; k text; _v1 integer; _v2 integer; sc jsonb; w jsonb; d date; want text;
  sc_a jsonb := '[{"kind":"escola","school_id":"esc-b464d-a"}]';
BEGIN
  -- ACL ----------------------------------------------------------------------
  IF has_function_privilege('authenticated', sig_old, 'EXECUTE') OR has_function_privilege('authenticated', sig_mid, 'EXECUTE')
    OR has_function_privilege('anon', sig_mid, 'EXECUTE')
    OR NOT has_function_privilege('authenticated', sig_new, 'EXECUTE') OR has_function_privilege('anon', sig_new, 'EXECUTE')
    OR has_function_privilege('authenticated', sig_res, 'EXECUTE') OR has_function_privilege('anon', sig_res, 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.calendar_window_year_issue(text,date,date)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.guard_calendar_applicability_window()', 'EXECUTE')
    OR has_table_privilege('authenticated', 'public.calendar_version_applicability_scope_windows', 'SELECT')
    OR has_table_privilege('authenticated', 'public.calendar_version_applicability_scope_windows', 'INSERT')
    OR has_table_privilege('anon', 'public.calendar_version_applicability_scope_windows', 'SELECT')
    OR has_table_privilege('authenticated', 'public.calendar_version_applicability_scopes', 'INSERT')
  THEN RAISE EXCEPTION 'acl'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = sig_new::regprocedure AND prosecdef AND proconfig @> ARRAY['search_path=""'])
    OR EXISTS (SELECT 1 FROM pg_proc WHERE oid = sig_res::regprocedure AND prosecdef)
  THEN RAISE EXCEPTION 'definer'; END IF;
  SELECT count(*) INTO _v1 FROM capability_policy_rules r JOIN capability_policies p ON p.id = r.policy_id
    WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 1;
  SELECT count(*) INTO _v2 FROM capability_policy_rules r JOIN capability_policies p ON p.id = r.policy_id
    WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 2;
  IF _v1 <> 108 OR _v2 <> 119
    OR EXISTS (SELECT 1 FROM capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND status <> 'draft')
  THEN RAISE EXCEPTION 'policy-state % %', _v1, _v2; END IF;
  ok := ok || 'acl policy-draft ';

  -- Fixtures fictícias ---------------------------------------------------------
  INSERT INTO institutional_persons(id, display_name) VALUES (p1,'S1'),(p2,'S2'),(p4,'S4');
  INSERT INTO user_person_links(user_id, person_id) VALUES
    ((u_sup::jsonb->>'sub')::uuid, p1), ((u_bld::jsonb->>'sub')::uuid, p2), ((u_sec::jsonb->>'sub')::uuid, p4);
  INSERT INTO institutional_schools(id) VALUES ('esc-b464d-a'), ('esc-b464d-b'), ('esc-b464d-c');
  INSERT INTO institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref) VALUES
    ('esc-b464d-a', 1, 'Escola A', true, '2020-01-01', 'ato'), ('esc-b464d-b', 1, 'Escola B', true, '2020-01-01', 'ato'),
    ('esc-b464d-c', 1, 'Escola C', true, '2020-01-01', 'ato'), ('esc-b464d-c', 2, 'Escola C', false, '2026-05-01', 'ato-inativa');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    (p1, 'teste-b464d-supervisao', 'rede', NULL, '2020-01-01'),
    (p2, 'teste-b464d-so-construir', 'rede', NULL, '2020-01-01'),
    (p4, 'secretaria-escolar', 'escola', 'esc-b464d-a', '2020-01-01');
  SELECT id INTO e1 FROM institutional_engagements WHERE person_id = p1;
  INSERT INTO capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b464d', 1, 'draft', '2020-01-01');
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'teste-b464d-supervisao', 'construir-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b464d-supervisao', 'homologar-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b464d-so-construir', 'construir-calendario-da-rede', ARRAY['network']),
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']),
    (pol, 'secretaria-escolar', 'manter-matricula-e-enturmacao', ARRAY['school']),
    (pol, 'secretaria-escolar', 'consultar-matricula-e-movimentacao', ARRAY['school']);
  UPDATE capability_policies SET status = 'homologated' WHERE id = pol;
  INSERT INTO institutional_academic_years(id) VALUES (_yr), ('ano-b464d-x');
  INSERT INTO institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id) VALUES
    (_yr, 1, 'Ano ficticio', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1),
    ('ano-b464d-x', 1, 'Outro ano', '2027-01-01', '2027-12-31', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_period_organizations(id, academic_year_id) VALUES (_org, _yr);
  INSERT INTO institutional_period_organization_versions(organization_id, version, official_name, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_org, 1, 'Org', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_academic_periods(id, academic_year_id, label, starts_on, ends_on, period_organization_id)
    VALUES (_per, _yr, 'P1', '2026-02-01', '2026-06-30', _org);
  INSERT INTO institutional_academic_period_versions(period_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_per, 1, 'P1', '2026-02-01', '2026-06-30', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_students(id, display_name) VALUES
    ('est-b464d-1','E1'),('est-b464d-2','E2'),('est-b464d-3','E3'),('est-b464d-4','E4'),('est-b464d-5','E5');
  INSERT INTO attribute_value_definitions(scheme_id, value_id, version, label, status, homologation_act_ref, valid_from) VALUES
    ('natureza-da-participacao-educacional', 'nat-b464d', 1, 'Natureza teste', 'homologada', 'ato', '2020-01-01'),
    ('eixo-b464d-a', 'val-1', 1, 'V1', 'homologada', 'ato', '2020-01-01'),
    ('eixo-b464d-a', 'val-2', 1, 'V2', 'homologada', 'ato', '2020-01-01'),
    ('eixo-b464d-a', 'val-2', 2, 'V2', 'rascunho', 'ato-rev', '2026-05-01');

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  cls := public.register_institutional_class('esc-b464d-a', _yr, 'A', 'Turma A', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  cls2 := public.register_institutional_class('esc-b464d-a', _yr, 'B', 'Turma B', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  cls_x := public.register_institutional_class('esc-b464d-a', 'ano-b464d-x', 'X', 'Turma outro ano', 'ativa', '2027-01-01', '2027-12-31', 'ato-t');
  -- E1: ano todo; E2: entrada tardia em 04/05; E3: remanejamento A→B em 30/06→01/07; E4: outro ano; E5: posição de outro estudante.
  PERFORM public.constitute_cycle_enrollment('m-b464d-1', 'est-b464d-1', 'esc-b464d-a', _yr, '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-b464d-2', 'est-b464d-2', 'esc-b464d-a', _yr, '2026-05-04', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-b464d-3', 'est-b464d-3', 'esc-b464d-a', _yr, '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-b464d-4', 'est-b464d-4', 'esc-b464d-a', 'ano-b464d-x', '2027-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-b464d-5', 'est-b464d-5', 'esc-b464d-a', _yr, '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.declare_cycle_participation('pt-b464d-1', NULL, 'm-b464d-1', 'nat-b464d', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.declare_cycle_participation('pt-b464d-2', NULL, 'm-b464d-2', 'nat-b464d', 1, '2026-05-04', NULL, 'ato', NULL);
  PERFORM public.declare_cycle_participation('pt-b464d-3', NULL, 'm-b464d-3', 'nat-b464d', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.declare_cycle_participation('pt-b464d-4', NULL, 'm-b464d-4', 'nat-b464d', 1, '2027-02-01', NULL, 'ato', NULL);
  PERFORM public.declare_cycle_participation('pt-b464d-5', NULL, 'm-b464d-5', 'nat-b464d', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.record_class_allocation('a-b464d-1', 'pt-b464d-1', cls, '2026-02-01', 'ato', NULL, NULL);
  PERFORM public.record_class_allocation('a-b464d-late', 'pt-b464d-2', cls, '2026-05-04', 'ato', NULL, NULL);
  PERFORM public.record_class_allocation('a-b464d-r1', 'pt-b464d-3', cls, '2026-02-01', 'ato', NULL, NULL, '2026-06-30', 'remanejamento');
  PERFORM public.record_class_allocation('a-b464d-r2', 'pt-b464d-3', cls2, '2026-07-01', 'ato', NULL, NULL);
  PERFORM public.record_class_allocation('a-b464d-x', 'pt-b464d-4', cls_x, '2027-02-01', 'ato', NULL, NULL);
  PERFORM public.record_class_allocation('a-b464d-5', 'pt-b464d-5', cls, '2026-02-01', 'ato', NULL, NULL);
  PERFORM public.record_allocation_curricular_position('pos-b464d-1', NULL, 'a-b464d-1', '2026-02-01', NULL,
    jsonb_build_array(jsonb_build_object('scheme','eixo-b464d-a','value','val-1','version',1)), 'ato', NULL);
  PERFORM public.record_allocation_curricular_position('pos-b464d-5', NULL, 'a-b464d-5', '2026-02-01', NULL,
    jsonb_build_array(jsonb_build_object('scheme','eixo-b464d-a','value','val-1','version',1)), 'ato', NULL);
  PERFORM set_config('request.jwt.claims', u_sup, true);
  t := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Letivo ficticio', true, 'ato-t', NULL);

  -- Contorno pelos writers antigos (papel authenticated) -------------------------
  PERFORM set_config('request.jwt.claims', u_bld, true);
  BEGIN PERFORM public.record_calendar_version_with_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
      'ato', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(jsonb_build_object('scope_key','r','conditions', sc_a)));
    RAISE EXCEPTION 'mid-writer-accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.record_calendar_version(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15', 'ato', NULL, '[]', '[]', '[]', '[]');
    RAISE EXCEPTION 'old-writer-accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ok := ok || 'old-writers-denied ';

  -- Rejeições atômicas: janela e referências ao longo da janela -------------------
  FOR s, w, sc IN SELECT * FROM (VALUES
    ('calendar-applicability:window-required', '{}'::jsonb, '[{"kind":"escola","school_id":"esc-b464d-a"}]'::jsonb),
    ('calendar-applicability:window-required', '{"window_from":"2026-02-01"}', '[{"kind":"escola","school_id":"esc-b464d-a"}]'),
    ('calendar-applicability:window-inverted', '{"window_from":"2026-06-01","window_until":"2026-05-01"}', '[{"kind":"escola","school_id":"esc-b464d-a"}]'),
    ('calendar-applicability:window-outside-version', '{"window_from":"2026-01-31","window_until":"2026-03-01"}', '[{"kind":"escola","school_id":"esc-b464d-a"}]'),
    ('calendar-applicability:window-outside-version', '{"window_from":"2026-12-01","window_until":"2026-12-16"}', '[{"kind":"escola","school_id":"esc-b464d-a"}]'),
    ('calendar-applicability:allocation-not-valid-in-window', '{"window_from":"2026-02-01","window_until":"2026-12-15"}', '[{"kind":"escola","school_id":"esc-b464d-a"},{"kind":"alocacao","allocation_logical_id":"a-b464d-late"}]'),
    ('calendar-applicability:allocation-not-valid-in-window', '{"window_from":"2026-05-03","window_until":"2026-12-15"}', '[{"kind":"escola","school_id":"esc-b464d-a"},{"kind":"alocacao","allocation_logical_id":"a-b464d-late"}]'),
    ('calendar-applicability:allocation-not-valid-in-window', '{"window_from":"2026-02-01","window_until":"2026-07-01"}', '[{"kind":"escola","school_id":"esc-b464d-a"},{"kind":"alocacao","allocation_logical_id":"a-b464d-r1"}]'),
    ('calendar-applicability:allocation-not-valid-in-window', '{"window_from":"2026-06-30","window_until":"2026-12-15"}', '[{"kind":"escola","school_id":"esc-b464d-a"},{"kind":"alocacao","allocation_logical_id":"a-b464d-r2"}]'),
    ('calendar-applicability:school-inactive-in-window', '{"window_from":"2026-02-01","window_until":"2026-05-01"}', '[{"kind":"escola","school_id":"esc-b464d-c"}]'),
    ('calendar-applicability:value-not-homologated-in-window', '{"window_from":"2026-04-01","window_until":"2026-05-01"}', '[{"kind":"valor-de-eixo","scheme_id":"eixo-b464d-a","value_id":"val-2","value_version":1}]'),
    ('calendar-applicability:allocation-other-academic-year', '{"window_from":"2026-02-01","window_until":"2026-03-01"}', '[{"kind":"alocacao","allocation_logical_id":"a-b464d-x"}]'),
    ('calendar-applicability:allocation-not-found', '{"window_from":"2026-02-01","window_until":"2026-03-01"}', '[{"kind":"alocacao","allocation_logical_id":"a-inexistente"}]'),
    ('calendar-applicability:position-not-found', '{"window_from":"2026-02-01","window_until":"2026-03-01"}', '[{"kind":"posicao-curricular","position_logical_id":"pos-inexistente"}]'),
    ('calendar-applicability:cross-school-reference', '{"window_from":"2026-02-01","window_until":"2026-03-01"}', '[{"kind":"escola","school_id":"esc-b464d-b"},{"kind":"alocacao","allocation_logical_id":"a-b464d-1"}]'),
    ('calendar-applicability:allocation-position-contradiction', '{"window_from":"2026-02-01","window_until":"2026-03-01"}', '[{"kind":"escola","school_id":"esc-b464d-a"},{"kind":"alocacao","allocation_logical_id":"a-b464d-1"},{"kind":"posicao-curricular","position_logical_id":"pos-b464d-5"}]'),
    ('calendar-applicability:conflicting-conditions-in-scope', '{"window_from":"2026-02-01","window_until":"2026-03-01"}', '[{"kind":"escola","school_id":"esc-b464d-a"},{"kind":"escola","school_id":"esc-b464d-b"}]')
  ) v(e, w, c) LOOP
    BEGIN PERFORM public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
        'ato', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(jsonb_build_object('scope_key','r','conditions', sc) || w)); RAISE EXCEPTION 'x';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM <> s THEN RAISE EXCEPTION 'expected % got % (%)', s, SQLERRM, w; END IF; END;
  END LOOP;
  BEGIN PERFORM public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
      'ato', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(
        jsonb_build_object('scope_key','r1','conditions', sc_a, 'window_from','2026-02-01','window_until','2026-04-30'),
        jsonb_build_object('scope_key','r2','conditions', sc_a, 'window_from','2026-04-30','window_until','2026-12-15')));
    RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-applicability:duplicate-scope' THEN RAISE EXCEPTION 'dup: %', SQLERRM; END IF; END;
  BEGIN PERFORM public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
      'ato', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(jsonb_build_object('scope_key','r','conditions', sc_a,
        'window_from','2026-02-30','window_until','2026-03-01'))); RAISE EXCEPTION 'x';
  EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN NULL; END;
  RESET ROLE;
  IF public.calendar_window_year_issue(_yr, '2026-12-01', '2027-01-10') IS DISTINCT FROM 'window-outside-academic-year'
    OR public.calendar_window_year_issue(_yr, '2025-12-31', '2026-01-10') IS DISTINCT FROM 'window-outside-academic-year'
    OR public.calendar_window_year_issue(_yr, '2026-01-01', '2026-12-31') IS NOT NULL
    OR public.calendar_window_year_issue('ano-inexistente', '2026-02-01', '2026-03-01') IS NULL
  THEN RAISE EXCEPTION 'year-window'; END IF;
  IF EXISTS (SELECT 1 FROM institutional_calendars) OR EXISTS (SELECT 1 FROM calendar_version_applicability_scopes)
    OR EXISTS (SELECT 1 FROM calendar_version_applicability_scope_windows)
  THEN RAISE EXCEPTION 'atomicity'; END IF;
  ok := ok || 'window-required/inverted/outside invalid-refs-in-window year-bound contradiction duplicate-overlap atomic ';

  -- Constituição com janelas: ano todo, entrada tardia, remanejamento, limites inclusivos, escola até inativação ---------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_bld, true);
  c1 := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-c1', NULL, jsonb_build_array(_per), '[]', '[]',
    jsonb_build_array(jsonb_build_object('day','2026-04-01','day_type_version_id', t->>'version_id')),
    jsonb_build_array(
      jsonb_build_object('scope_key','ano-todo','window_from','2026-02-01','window_until','2026-12-15','conditions',
        '[{"kind":"escola","school_id":"esc-b464d-a"},{"kind":"alocacao","allocation_logical_id":"a-b464d-1"},{"kind":"posicao-curricular","position_logical_id":"pos-b464d-1"}]'::jsonb),
      jsonb_build_object('scope_key','tardia','window_from','2026-05-04','window_until','2026-12-15','conditions',
        '[{"kind":"escola","school_id":"esc-b464d-a"},{"kind":"alocacao","allocation_logical_id":"a-b464d-late"}]'::jsonb),
      jsonb_build_object('scope_key','rem-1','window_from','2026-02-01','window_until','2026-06-30','conditions',
        '[{"kind":"escola","school_id":"esc-b464d-a"},{"kind":"alocacao","allocation_logical_id":"a-b464d-r1"}]'::jsonb),
      jsonb_build_object('scope_key','rem-2','window_from','2026-07-01','window_until','2026-12-15','conditions',
        '[{"kind":"escola","school_id":"esc-b464d-a"},{"kind":"alocacao","allocation_logical_id":"a-b464d-r2"}]'::jsonb),
      jsonb_build_object('scope_key','esc-c','window_from','2026-02-01','window_until','2026-04-30','conditions',
        '[{"kind":"escola","school_id":"esc-b464d-c"}]'::jsonb),
      jsonb_build_object('scope_key','val-2-ate-abril','window_from','2026-02-01','window_until','2026-04-30','conditions',
        '[{"kind":"escola","school_id":"esc-b464d-b"},{"kind":"valor-de-eixo","scheme_id":"eixo-b464d-a","value_id":"val-2","value_version":1}]'::jsonb),
      jsonb_build_object('scope_key','esc-a-1','window_from','2026-02-01','window_until','2026-03-31','conditions', sc_a),
      jsonb_build_object('scope_key','esc-a-2','window_from','2026-04-01','window_until','2026-12-15','conditions', sc_a)));
  IF (c1->>'applicability_scopes')::int <> 8 OR (c1->>'homologated')::boolean OR c1->>'composition_rule' <> 'nao-homologada'
  THEN RAISE EXCEPTION 'c1 %', c1; END IF;
  RESET ROLE;
  -- Histórico sem janela: versão 0025/0026 (recorte sem janela, escola B) e versão sem aplicabilidade; simuladas pelo dono.
  PERFORM set_config('request.jwt.claims', u_bld, true);
  c2 := public.record_calendar_version_with_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-c2', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(jsonb_build_object('scope_key','legado-b','conditions',
      '[{"kind":"escola","school_id":"esc-b464d-b"}]'::jsonb)));
  c3 := public.record_calendar_version(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15', 'ato-c3', NULL, '[]', '[]', '[]', '[]');
  IF EXISTS (SELECT 1 FROM calendar_version_applicability_scope_windows w JOIN calendar_version_applicability_scopes s ON s.id = w.scope_id
             WHERE s.version_id = (c2->>'version_id')::uuid)
    OR (SELECT count(*) FROM calendar_version_applicability_scope_windows w JOIN calendar_version_applicability_scopes s ON s.id = w.scope_id
        WHERE s.version_id = (c1->>'version_id')::uuid) <> 8
  THEN RAISE EXCEPTION 'windows-stored'; END IF;
  BEGIN UPDATE calendar_version_applicability_scope_windows SET window_until = '2026-12-01'; RAISE EXCEPTION 'mutable';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'mutable' THEN RAISE; END IF; END;
  BEGIN DELETE FROM calendar_version_applicability_scope_windows; RAISE EXCEPTION 'mutable';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'mutable' THEN RAISE; END IF; END;
  -- Janela tardia por cliente: sem privilégio de tabela (o marcador de abertura é por transação; fora dela o guard recusa).
  PERFORM set_config('role', 'authenticated', true);
  BEGIN INSERT INTO calendar_version_applicability_scope_windows(scope_id, window_from, window_until)
      VALUES ('00000000-0000-0000-0000-000000000000', '2026-02-01', '2026-12-15');
    RAISE EXCEPTION 'late-window-insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  ok := ok || 'late-entry remanejamento inclusive-bounds legacy-without-window immutable ';

  -- Resolver privado (dono): janela por data -----------------------------------------
  t_before := clock_timestamp();
  FOR d, s, k, want IN SELECT * FROM (VALUES
    ('2026-05-03'::date, 'a-b464d-late', 'tardia', 'no'), ('2026-05-04', 'a-b464d-late', 'tardia', 'yes'),
    ('2026-12-15', 'a-b464d-late', 'tardia', 'yes'), ('2026-12-16', 'a-b464d-late', 'tardia', 'no'),
    ('2026-02-01', 'a-b464d-r1', 'rem-1', 'yes'), ('2026-06-30', 'a-b464d-r1', 'rem-1', 'yes'), ('2026-07-01', 'a-b464d-r1', 'rem-1', 'no'),
    ('2026-06-30', 'a-b464d-r2', 'rem-2', 'no'), ('2026-07-01', 'a-b464d-r2', 'rem-2', 'yes'),
    ('2026-03-31', NULL, 'esc-a-1', 'yes'), ('2026-04-01', NULL, 'esc-a-1', 'no'), ('2026-04-01', NULL, 'esc-a-2', 'yes'),
    ('2026-01-31', NULL, 'esc-a-1', 'no')
  ) v(d, a, k, w) LOOP
    SELECT count(*) INTO n FROM public.calendar_applicability_candidates(d, t_before, 'esc-b464d-a', s, NULL, '[]')
      WHERE resolution = 'candidato' AND scope_key = k;
    IF n <> (CASE want WHEN 'yes' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'window % % % expected % got %', d, s, k, want, n; END IF;
  END LOOP;
  SELECT count(*) INTO n FROM public.calendar_applicability_candidates('2026-04-30', t_before, 'esc-b464d-c', NULL, NULL, NULL) WHERE scope_key = 'esc-c';
  SELECT n + count(*) * 10 INTO n FROM public.calendar_applicability_candidates('2026-05-01', t_before, 'esc-b464d-c', NULL, NULL, NULL) WHERE scope_key = 'esc-c';
  IF n <> 1 THEN RAISE EXCEPTION 'school-window %', n; END IF;
  -- Múltiplos candidatos preservados, bloqueio sem dominante.
  SELECT count(*) FILTER (WHERE resolution = 'candidato'), string_agg(resolution, ',') FILTER (WHERE calendar_id IS NULL)
    INTO n, s FROM public.calendar_applicability_candidates('2026-04-01', t_before, 'esc-b464d-a', 'a-b464d-1', 'pos-b464d-1', '[]');
  IF n <> 2 OR s <> 'bloqueado:regra-de-selecao-composicao-nao-homologada' THEN RAISE EXCEPTION 'multi % %', n, s; END IF;
  -- Contexto ausente nunca corresponde (hardening 0026 preservado).
  SELECT count(*) INTO n FROM public.calendar_applicability_candidates('2026-04-01', t_before, NULL, NULL, NULL, NULL) WHERE resolution = 'candidato';
  IF n <> 0 THEN RAISE EXCEPTION 'null-ctx %', n; END IF;
  SELECT count(*) INTO n FROM public.calendar_applicability_candidates('2026-04-01', t_before, NULL, 'a-b464d-1', 'pos-b464d-1', '[]') WHERE resolution = 'candidato';
  IF n <> 0 THEN RAISE EXCEPTION 'no-school %', n; END IF;
  SELECT count(*) INTO n FROM public.calendar_applicability_candidates('2026-04-01', t_before, 'esc-b464d-a', 'a-b464d-1', NULL, '[]') WHERE scope_key = 'ano-todo';
  IF n <> 0 THEN RAISE EXCEPTION 'no-position %', n; END IF;
  SELECT count(*) INTO n FROM public.calendar_applicability_candidates('2026-04-01', t_before, 'esc-b464d-b', NULL, NULL, '[]') WHERE scope_key = 'val-2-ate-abril';
  IF n <> 0 THEN RAISE EXCEPTION 'no-axis %', n; END IF;
  SELECT count(*) INTO n FROM public.calendar_applicability_candidates('2026-04-01', t_before, 'esc-b464d-b', NULL, NULL,
    '[{"scheme":"eixo-b464d-a","value":"val-2","version":1}]') WHERE resolution = 'candidato' AND scope_key = 'val-2-ate-abril';
  IF n <> 1 THEN RAISE EXCEPTION 'axis %', n; END IF;
  -- Legado sem janela: nunca candidato nem janela inferida; final explicitamente indeterminado.
  SELECT count(*) FILTER (WHERE resolution = 'janela-nao-registrada' AND scope_key = 'legado-b' AND calendar_id = c2->>'calendar_id'),
         count(*) FILTER (WHERE resolution = 'candidato'), string_agg(resolution, ',') FILTER (WHERE calendar_id IS NULL)
    INTO n, _v1, s FROM public.calendar_applicability_candidates('2026-06-01', t_before, 'esc-b464d-b', NULL, NULL, '[]');
  IF n <> 1 OR _v1 <> 0 OR s <> 'indeterminado:janela-nao-registrada' THEN RAISE EXCEPTION 'legacy-window % % %', n, _v1, s; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.calendar_applicability_candidates('2026-04-01', t_before, 'esc-b464d-a', NULL, NULL, NULL)
                 WHERE resolution = 'aplicabilidade-nao-registrada' AND calendar_id = c3->>'calendar_id')
  THEN RAISE EXCEPTION 'legacy-no-applicability'; END IF;
  SELECT string_agg(resolution, ',') FILTER (WHERE calendar_id IS NULL) INTO s
    FROM public.calendar_applicability_candidates('2026-04-01', t_before, 'esc-sem-recorte', NULL, NULL, NULL);
  IF s <> 'sem-candidato' THEN RAISE EXCEPTION 'none %', s; END IF;
  BEGIN PERFORM * FROM public.calendar_applicability_candidates(NULL, t_before, 'esc-b464d-a', NULL, NULL, NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-applicability:snapshot-required' THEN RAISE; END IF; END;
  ok := ok || 'resolver-window-bounds multi-kept missing-context-never-matches legacy-indeterminate ';

  -- Retificação: janelas da predecessora preservadas; consulta histórica por knownAt ------------
  PERFORM pg_sleep(0.01);
  t_before := clock_timestamp();
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_bld, true);
  c1r := public.record_calendar_version_with_windowed_applicability(c1->>'calendar_id', (c1->>'version_id')::uuid, 'retificacao', _yr, _org,
    '2026-03-01', '2026-12-15', 'ato-c1r', 'correcao do recorte', jsonb_build_array(_per), '[]', '[]', '[]',
    jsonb_build_array(jsonb_build_object('scope_key','unico','window_from','2026-03-01','window_until','2026-12-15','conditions',
      '[{"kind":"escola","school_id":"esc-b464d-b"}]'::jsonb)));
  BEGIN PERFORM public.record_calendar_version_with_windowed_applicability(c1->>'calendar_id', (c1r->>'version_id')::uuid, 'sucessao', _yr, _org,
      '2026-08-01', '2026-12-15', 'ato-s', 'sucessao', '[]', '[]', '[]', '[]',
      jsonb_build_array(jsonb_build_object('scope_key','s','window_from','2026-07-31','window_until','2026-12-15','conditions', sc_a)));
    RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-applicability:window-outside-version' THEN RAISE EXCEPTION 'succ %', SQLERRM; END IF; END;
  RESET ROLE;
  IF (SELECT count(*) FROM calendar_version_applicability_scope_windows w JOIN calendar_version_applicability_scopes s ON s.id = w.scope_id
      WHERE s.version_id = (c1->>'version_id')::uuid) <> 8
    OR (SELECT count(*) FROM calendar_version_applicability_scope_windows w JOIN calendar_version_applicability_scopes s ON s.id = w.scope_id
        WHERE s.version_id = (c1r->>'version_id')::uuid) <> 1
  THEN RAISE EXCEPTION 'retification-rewrote'; END IF;
  -- knownAt anterior à retificação: c1 continua efetiva e seus recortes respondem como antes.
  SELECT count(*) INTO n FROM public.calendar_applicability_candidates('2026-04-01', t_before, 'esc-b464d-a', NULL, NULL, '[]')
    WHERE resolution = 'candidato' AND scope_key = 'esc-a-2' AND version_id = (c1->>'version_id')::uuid;
  IF n <> 1 THEN RAISE EXCEPTION 'historical-before %', n; END IF;
  SELECT count(*) FILTER (WHERE version_id = (c1->>'version_id')::uuid), count(*) FILTER (WHERE resolution = 'candidato' AND scope_key = 'unico')
    INTO n, _v1 FROM public.calendar_applicability_candidates('2026-04-01', clock_timestamp(), 'esc-b464d-b', NULL, NULL, '[]');
  IF n <> 0 OR _v1 <> 1 THEN RAISE EXCEPTION 'historical-after % %', n, _v1; END IF;
  ok := ok || 'retification-preserves historical-knownAt ';

  -- Homologação bloqueada; resolver privado; leitor público negado (papel authenticated) -----------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sup, true);
  BEGIN PERFORM public.homologate_calendar_version((c1r->>'version_id')::uuid, NULL, 'homologada', '2026-03-01', 'ato-h', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-homologation:blocked-applicability-composition-rule-not-homologated' THEN RAISE EXCEPTION 'h: %', SQLERRM; END IF; END;
  BEGIN PERFORM public.homologate_calendar_version((c3->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-h', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-homologation:blocked-applicability-undeclared-d5' THEN RAISE EXCEPTION 'h3: %', SQLERRM; END IF; END;
  BEGIN PERFORM * FROM public.calendar_applicability_candidates('2026-04-01', clock_timestamp(), 'esc-b464d-a', NULL, NULL, NULL); RAISE EXCEPTION 'resolver-open';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM public.calendar_version_applicability_scope_windows; RAISE EXCEPTION 'windows-open';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT result_kind INTO s FROM public.calendar_day_at(c1->>'calendar_id', '2026-04-01', clock_timestamp()) LIMIT 1;
  IF s IS DISTINCT FROM 'access-denied' THEN RAISE EXCEPTION 'reader-opened: %', s; END IF;
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM calendar_version_homologations) THEN RAISE EXCEPTION 'homologation-written'; END IF;
  ok := ok || 'homologation-blocked resolver-private windows-private reader-denied';

  RAISE EXCEPTION 'b464d-tests-ok: %', ok;
END $t$;
