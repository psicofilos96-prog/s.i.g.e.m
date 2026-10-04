-- B4.6.4b — Aplicabilidade explícita do calendário. Teste transacional real: o bloco termina em RAISE, nada persiste.
-- Sucesso = 'b464b-tests-ok: ...'. Permissão positiva só por política SINTÉTICA homologada dentro do teste;
-- as políticas reais v1/v2 continuam draft. IDs, nomes, catálogos e datas são fictícios e não representam norma.
DO $t$
DECLARE
  u_sup text := '{"sub":"00000000-0000-0000-0000-00000b464b01","role":"authenticated"}';
  u_bld text := '{"sub":"00000000-0000-0000-0000-00000b464b02","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-00000b464b03","role":"authenticated"}';
  u_sec text := '{"sub":"00000000-0000-0000-0000-00000b464b04","role":"authenticated"}';
  p1 uuid := '00000000-0000-0000-0000-00000b464b91'; p2 uuid := '00000000-0000-0000-0000-00000b464b92';
  p3 uuid := '00000000-0000-0000-0000-00000b464b93'; p4 uuid := '00000000-0000-0000-0000-00000b464b94';
  pol uuid := '00000000-0000-0000-0000-00000b464ba0';
  sig_new text := 'public.record_calendar_version_with_applicability(text,uuid,text,text,text,date,date,text,text,jsonb,jsonb,jsonb,jsonb,jsonb)';
  sig_old text := 'public.record_calendar_version(text,uuid,text,text,text,date,date,text,text,jsonb,jsonb,jsonb,jsonb)';
  sig_res text := 'public.calendar_applicability_candidates(date,timestamptz,text,text,text,jsonb)';
  _yr text := 'ano-b464b'; _org text := 'org-b464b'; _per text := 'per-b464b';
  e1 uuid; cls text; cls_x text; t jsonb; c1 jsonb; c1r jsonb; c2 jsonb; c3 jsonb; t_before timestamptz;
  ok text := ''; n integer; s text; _v1 integer; _v2 integer;
  sc_a jsonb; base_args text;
BEGIN
  -- ACL ----------------------------------------------------------------------
  IF has_function_privilege('authenticated', sig_old, 'EXECUTE')
    OR NOT has_function_privilege('authenticated', sig_new, 'EXECUTE')
    OR has_function_privilege('anon', sig_new, 'EXECUTE')
    OR has_function_privilege('authenticated', sig_res, 'EXECUTE') OR has_function_privilege('anon', sig_res, 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.calendar_applicability_condition_issue(public.calendar_version_applicability_conditions,text,date,date)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.guard_calendar_applicability_child()', 'EXECUTE')
    OR has_table_privilege('authenticated', 'public.calendar_version_applicability_scopes', 'INSERT')
    OR has_table_privilege('authenticated', 'public.calendar_version_applicability_conditions', 'SELECT')
    OR has_table_privilege('authenticated', 'public.calendar_version_applicability_records', 'INSERT')
    OR has_table_privilege('anon', 'public.calendar_version_applicability_scopes', 'SELECT')
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

  -- Fixtures fictícias (privilegiado) -------------------------------------------
  INSERT INTO institutional_persons(id, display_name) VALUES (p1,'S1'),(p2,'S2'),(p3,'S3'),(p4,'S4');
  INSERT INTO user_person_links(user_id, person_id) VALUES
    ((u_sup::jsonb->>'sub')::uuid, p1), ((u_bld::jsonb->>'sub')::uuid, p2),
    ((u_none::jsonb->>'sub')::uuid, p3), ((u_sec::jsonb->>'sub')::uuid, p4);
  INSERT INTO institutional_schools(id) VALUES ('esc-b464b-a'), ('esc-b464b-b'), ('esc-b464b-c');
  INSERT INTO institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref) VALUES
    ('esc-b464b-a', 1, 'Escola A', true, '2020-01-01', 'ato'), ('esc-b464b-b', 1, 'Escola B', true, '2020-01-01', 'ato'),
    ('esc-b464b-c', 1, 'Escola C', true, '2020-01-01', 'ato'), ('esc-b464b-c', 2, 'Escola C', false, '2026-05-01', 'ato-inativa');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    (p1, 'teste-b464b-supervisao', 'rede', NULL, '2020-01-01'),
    (p2, 'teste-b464b-so-construir', 'rede', NULL, '2020-01-01'),
    (p3, 'teste-b464b-nada', 'rede', NULL, '2020-01-01'),
    (p4, 'secretaria-escolar', 'escola', 'esc-b464b-a', '2020-01-01');
  SELECT id INTO e1 FROM institutional_engagements WHERE person_id = p1;
  INSERT INTO capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b464b', 1, 'draft', '2020-01-01');
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'teste-b464b-supervisao', 'construir-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b464b-supervisao', 'homologar-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b464b-so-construir', 'construir-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b464b-nada', 'manter-matrizes-curriculares', ARRAY['network']),
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']),
    (pol, 'secretaria-escolar', 'manter-matricula-e-enturmacao', ARRAY['school']),
    (pol, 'secretaria-escolar', 'consultar-matricula-e-movimentacao', ARRAY['school']);
  UPDATE capability_policies SET status = 'homologated' WHERE id = pol;
  INSERT INTO institutional_academic_years(id) VALUES (_yr), ('ano-b464b-x');
  INSERT INTO institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id) VALUES
    (_yr, 1, 'Ano ficticio', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1),
    ('ano-b464b-x', 1, 'Outro ano', '2027-01-01', '2027-12-31', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_period_organizations(id, academic_year_id) VALUES (_org, _yr);
  INSERT INTO institutional_period_organization_versions(organization_id, version, official_name, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_org, 1, 'Org', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_academic_periods(id, academic_year_id, label, starts_on, ends_on, period_organization_id)
    VALUES (_per, _yr, 'P1', '2026-02-01', '2026-06-30', _org);
  INSERT INTO institutional_academic_period_versions(period_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_per, 1, 'P1', '2026-02-01', '2026-06-30', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_students(id, display_name) VALUES ('est-b464b-1','E1'),('est-b464b-2','E2'),('est-b464b-3','E3');
  INSERT INTO attribute_value_definitions(scheme_id, value_id, version, label, status, homologation_act_ref, valid_from) VALUES
    ('natureza-da-participacao-educacional', 'nat-b464b', 1, 'Natureza teste', 'homologada', 'ato', '2020-01-01'),
    ('eixo-b464b-a', 'val-1', 1, 'V1', 'homologada', 'ato', '2020-01-01'),
    ('eixo-b464b-a', 'val-2', 1, 'V2', 'homologada', 'ato', '2020-01-01'),
    ('eixo-b464b-a', 'val-2', 2, 'V2', 'rascunho', 'ato-rev', '2026-05-01'),
    ('eixo-b464b-a', 'val-r', 1, 'VR', 'rascunho', NULL, '2020-01-01'),
    ('eixo-b464b-b', 'val-x', 1, 'VX', 'homologada', 'ato', '2020-01-01');

  -- Turma, alocações e posição pelos writers B3/B3.3 (secretaria sintética) --------------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  cls := public.register_institutional_class('esc-b464b-a', _yr, 'A', 'Turma multietapa', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  cls_x := public.register_institutional_class('esc-b464b-a', 'ano-b464b-x', 'X', 'Turma outro ano', 'ativa', '2027-01-01', '2027-12-31', 'ato-t');
  PERFORM public.constitute_cycle_enrollment('m-b464b-1', 'est-b464b-1', 'esc-b464b-a', _yr, '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-b464b-2', 'est-b464b-2', 'esc-b464b-a', _yr, '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-b464b-3', 'est-b464b-3', 'esc-b464b-a', 'ano-b464b-x', '2027-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.declare_cycle_participation('pt-b464b-1', NULL, 'm-b464b-1', 'nat-b464b', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.declare_cycle_participation('pt-b464b-2', NULL, 'm-b464b-2', 'nat-b464b', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.declare_cycle_participation('pt-b464b-3', NULL, 'm-b464b-3', 'nat-b464b', 1, '2027-02-01', NULL, 'ato', NULL);
  PERFORM public.record_class_allocation('a-b464b-1', 'pt-b464b-1', cls, '2026-02-01', 'ato', NULL, NULL);
  PERFORM public.record_class_allocation('a-b464b-2', 'pt-b464b-2', cls, '2026-02-01', 'ato', NULL, NULL, '2026-06-30', 'm');
  PERFORM public.record_class_allocation('a-b464b-x', 'pt-b464b-3', cls_x, '2027-02-01', 'ato', NULL, NULL);
  PERFORM public.record_allocation_curricular_position('pos-b464b-1', NULL, 'a-b464b-1', '2026-02-01', NULL,
    jsonb_build_array(jsonb_build_object('scheme','eixo-b464b-a','value','val-1','version',1)), 'ato', NULL);

  PERFORM set_config('request.jwt.claims', u_sup, true);
  t := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Letivo ficticio', true, 'ato-t', NULL);
  base_args := '';

  -- Sem capacidade / contorno pelo writer antigo ---------------------------------
  sc_a := jsonb_build_array(jsonb_build_object('scope_key','recorte-a','conditions',
            jsonb_build_array(jsonb_build_object('kind','escola','school_id','esc-b464b-a'))));
  PERFORM set_config('request.jwt.claims', u_none, true);
  BEGIN PERFORM public.record_calendar_version_with_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
      'ato', NULL, '[]', '[]', '[]', '[]', sc_a); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:construir-calendario-da-rede' THEN RAISE EXCEPTION 'no-cap: %', SQLERRM; END IF; END;
  PERFORM set_config('request.jwt.claims', u_bld, true);
  BEGIN PERFORM public.record_calendar_version(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15', 'ato', NULL, '[]', '[]', '[]', '[]');
    RAISE EXCEPTION 'old-overload-accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ok := ok || 'no-cap old-overload-denied ';

  -- Rejeições atômicas -----------------------------------------------------------
  BEGIN PERFORM public.record_calendar_version_with_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
      'ato', NULL, '[]', '[]', '[]', '[]', '[]'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-applicability:scopes-required' THEN RAISE EXCEPTION 'empty: %', SQLERRM; END IF; END;
  BEGIN PERFORM public.record_calendar_version_with_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
      'ato', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(jsonb_build_object('scope_key','r','conditions','[]'::jsonb))); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-applicability:conditions-required' THEN RAISE EXCEPTION 'no-cond: %', SQLERRM; END IF; END;
  BEGIN PERFORM public.record_calendar_version_with_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
      'ato', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(jsonb_build_object('scope_key','r','conditions',
        jsonb_build_array(jsonb_build_object('kind','escola','school_id','esc-inexistente'))))); RAISE EXCEPTION 'x';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN PERFORM public.record_calendar_version_with_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
      'ato', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(jsonb_build_object('scope_key','r','conditions',
        jsonb_build_array(jsonb_build_object('kind','etapa','school_id','esc-b464b-a'))))); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- (resultado, condição, erro esperado)
  FOR s, sc_a IN SELECT * FROM (VALUES
    ('calendar-applicability:school-inactive-in-window', '[{"kind":"escola","school_id":"esc-b464b-c"}]'::jsonb),
    ('calendar-applicability:value-not-homologated-in-window', '[{"kind":"valor-de-eixo","scheme_id":"eixo-b464b-a","value_id":"val-r","value_version":1}]'),
    ('calendar-applicability:value-not-homologated-in-window', '[{"kind":"valor-de-eixo","scheme_id":"eixo-b464b-a","value_id":"val-2","value_version":1}]'),
    ('calendar-applicability:allocation-not-valid-in-window', '[{"kind":"alocacao","allocation_logical_id":"a-b464b-2"}]'),
    ('calendar-applicability:allocation-other-academic-year', '[{"kind":"alocacao","allocation_logical_id":"a-b464b-x"}]'),
    ('calendar-applicability:allocation-not-found', '[{"kind":"alocacao","allocation_logical_id":"a-inexistente"}]'),
    ('calendar-applicability:position-not-found', '[{"kind":"posicao-curricular","position_logical_id":"pos-inexistente"}]'),
    ('calendar-applicability:cross-school-reference', '[{"kind":"escola","school_id":"esc-b464b-b"},{"kind":"alocacao","allocation_logical_id":"a-b464b-1"}]'),
    ('calendar-applicability:conflicting-conditions-in-scope', '[{"kind":"escola","school_id":"esc-b464b-a"},{"kind":"escola","school_id":"esc-b464b-b"}]')
  ) v(e, c) LOOP
    BEGIN PERFORM public.record_calendar_version_with_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
        'ato', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(jsonb_build_object('scope_key','r','conditions', sc_a))); RAISE EXCEPTION 'x';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM <> s THEN RAISE EXCEPTION 'expected % got %', s, SQLERRM; END IF; END;
  END LOOP;
  BEGIN PERFORM public.record_calendar_version_with_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
      'ato', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(
        jsonb_build_object('scope_key','r1','conditions', jsonb_build_array(jsonb_build_object('kind','escola','school_id','esc-b464b-a'))),
        jsonb_build_object('scope_key','r2','conditions', jsonb_build_array(jsonb_build_object('kind','escola','school_id','esc-b464b-a')))));
    RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-applicability:duplicate-scope' THEN RAISE EXCEPTION 'dup: %', SQLERRM; END IF; END;
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM institutional_calendars) OR EXISTS (SELECT 1 FROM calendar_version_applicability_scopes)
  THEN RAISE EXCEPTION 'atomicity'; END IF;
  ok := ok || 'invalid-refs-dates-catalogs-atomic ';

  -- Constituição multietapa: dois recortes na mesma turma, conservados, sem etapa única ---------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_bld, true);
  c1 := public.record_calendar_version_with_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-c1', NULL, jsonb_build_array(_per), '[]', '[]',
    jsonb_build_array(jsonb_build_object('day','2026-04-01','day_type_version_id', t->>'version_id')),
    jsonb_build_array(
      jsonb_build_object('scope_key','etapa-x','conditions', jsonb_build_array(
        jsonb_build_object('kind','escola','school_id','esc-b464b-a'),
        jsonb_build_object('kind','posicao-curricular','position_logical_id','pos-b464b-1'))),
      jsonb_build_object('scope_key','etapa-y','conditions', jsonb_build_array(
        jsonb_build_object('kind','escola','school_id','esc-b464b-a'),
        jsonb_build_object('kind','valor-de-eixo','scheme_id','eixo-b464b-b','value_id','val-x','value_version',1)))));
  IF (c1->>'applicability_scopes')::int <> 2 OR (c1->>'homologated')::boolean OR c1->>'composition_rule' <> 'nao-homologada'
  THEN RAISE EXCEPTION 'c1 %', c1; END IF;
  c2 := public.record_calendar_version_with_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-c2', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(jsonb_build_object('scope_key','escola-a','conditions',
      jsonb_build_array(jsonb_build_object('kind','escola','school_id','esc-b464b-a')))));
  -- Versão "anterior" sem aplicabilidade: o writer 0024 executado pelo dono simula o histórico pré-0025.
  RESET ROLE;
  c3 := public.record_calendar_version(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15', 'ato-c3', NULL, '[]', '[]', '[]', '[]');
  SELECT count(*) INTO n FROM calendar_version_applicability_conditions x JOIN calendar_version_applicability_scopes s ON s.id = x.scope_id
    WHERE s.version_id = (c1->>'version_id')::uuid;
  IF n <> 4 OR (SELECT count(*) FROM calendar_version_applicability_scopes WHERE version_id = (c1->>'version_id')::uuid) <> 2
    OR EXISTS (SELECT 1 FROM calendar_version_applicability_records WHERE version_id = (c3->>'version_id')::uuid)
  THEN RAISE EXCEPTION 'multistage %', n; END IF;
  BEGIN UPDATE calendar_version_applicability_scopes SET label = 'x' WHERE version_id = (c1->>'version_id')::uuid; RAISE EXCEPTION 'mutable';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'mutable' THEN RAISE; END IF; END;
  ok := ok || 'multistage-preserved legacy-not-registered immutable ';

  -- Retificação preserva recortes da predecessora --------------------------------
  t_before := clock_timestamp();
  PERFORM set_config('role', 'authenticated', true);
  c1r := public.record_calendar_version_with_applicability(c1->>'calendar_id', (c1->>'version_id')::uuid, 'retificacao', _yr, _org,
    '2026-02-01', '2026-12-15', 'ato-c1r', 'correcao do recorte', jsonb_build_array(_per), '[]', '[]', '[]',
    jsonb_build_array(jsonb_build_object('scope_key','unico','conditions',
      jsonb_build_array(jsonb_build_object('kind','escola','school_id','esc-b464b-b')))));
  RESET ROLE;
  IF (SELECT count(*) FROM calendar_version_applicability_scopes WHERE version_id = (c1->>'version_id')::uuid) <> 2
    OR (SELECT count(*) FROM calendar_version_applicability_scopes WHERE version_id = (c1r->>'version_id')::uuid) <> 1
  THEN RAISE EXCEPTION 'retification-rewrote'; END IF;
  ok := ok || 'retification-preserves ';

  -- Resolver privado (dono): candidatos + bloqueio; nunca dominante --------------------
  SELECT count(*) FILTER (WHERE resolution = 'candidato'),
         string_agg(resolution, ',' ORDER BY resolution) FILTER (WHERE calendar_id IS NULL)
    INTO n, s FROM public.calendar_applicability_candidates('2026-04-01', t_before, 'esc-b464b-a', 'a-b464b-1', 'pos-b464b-1',
      '[{"scheme":"eixo-b464b-b","value":"val-x","version":1}]');
  IF n <> 3 OR s <> 'bloqueado:regra-de-selecao-composicao-nao-homologada' THEN RAISE EXCEPTION 'resolver-before % %', n, s; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.calendar_applicability_candidates('2026-04-01', t_before, 'esc-b464b-a', NULL, NULL, NULL)
                 WHERE resolution = 'aplicabilidade-nao-registrada' AND calendar_id = c3->>'calendar_id')
  THEN RAISE EXCEPTION 'resolver-legacy'; END IF;
  SELECT count(*) FILTER (WHERE resolution = 'candidato'), string_agg(resolution, ',') FILTER (WHERE calendar_id IS NULL)
    INTO n, s FROM public.calendar_applicability_candidates('2026-04-01', clock_timestamp(), 'esc-b464b-a', 'a-b464b-1', 'pos-b464b-1', NULL);
  IF n <> 1 OR s <> 'bloqueado:regra-de-selecao-composicao-nao-homologada' THEN RAISE EXCEPTION 'resolver-single-not-dominant % %', n, s; END IF;
  SELECT string_agg(resolution, ',') FILTER (WHERE calendar_id IS NULL) INTO s
    FROM public.calendar_applicability_candidates('2026-04-01', clock_timestamp(), 'esc-sem-recorte', NULL, NULL, NULL);
  IF s <> 'sem-candidato' THEN RAISE EXCEPTION 'resolver-none %', s; END IF;
  ok := ok || 'resolver-blocked-multiple-kept ';

  -- Homologação: distinção entre não registrada e regra de composição não homologada -------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sup, true);
  BEGIN PERFORM public.homologate_calendar_version((c3->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-h', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-homologation:blocked-applicability-undeclared-d5' THEN RAISE EXCEPTION 'h-legacy: %', SQLERRM; END IF; END;
  BEGIN PERFORM public.homologate_calendar_version((c1r->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-h', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-homologation:blocked-applicability-composition-rule-not-homologated' THEN RAISE EXCEPTION 'h-rule: %', SQLERRM; END IF; END;
  BEGIN PERFORM * FROM public.calendar_applicability_candidates('2026-04-01', clock_timestamp(), 'esc-b464b-a', NULL, NULL, NULL); RAISE EXCEPTION 'resolver-open';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT result_kind INTO s FROM public.calendar_day_at(c2->>'calendar_id', '2026-04-01', clock_timestamp()) LIMIT 1;
  IF s IS DISTINCT FROM 'access-denied' THEN RAISE EXCEPTION 'reader-opened: %', s; END IF;
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM calendar_version_homologations) THEN RAISE EXCEPTION 'homologation-written'; END IF;
  ok := ok || 'homologation-blocked-distinct resolver-private reader-denied';

  RAISE EXCEPTION 'b464b-tests-ok: %', ok;
END $t$;
