-- B4.6.4a — Writers do calendário. Teste transacional real: o bloco termina em RAISE, nada persiste.
-- Sucesso = 'b464a-tests-ok: ...'. Permissão positiva só por política SINTÉTICA homologada dentro do teste;
-- as políticas reais v1/v2 continuam draft. IDs, nomes e datas são fictícios e não representam norma.
DO $t$
DECLARE
  u_sup text := '{"sub":"00000000-0000-0000-0000-00000b464a01","role":"authenticated"}';
  u_bld text := '{"sub":"00000000-0000-0000-0000-00000b464a02","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-00000b464a03","role":"authenticated"}';
  p1 uuid := '00000000-0000-0000-0000-00000b464a91'; p2 uuid := '00000000-0000-0000-0000-00000b464a92';
  p3 uuid := '00000000-0000-0000-0000-00000b464a93';
  pol uuid := '00000000-0000-0000-0000-00000b464aa0';
  _yr text := 'ano-b464a'; _org text := 'org-b464a'; _per text := 'per-b464a'; _per_x text := 'per-b464a-x';
  _org_x text := 'org-b464a-x'; e1 uuid; r jsonb; t_on jsonb; t_off jsonb; t_null jsonb; c jsonb; c2 jsonb;
  _ok text := ''; _n integer; _s text; _calc integer; _v1 integer; _v2 integer;
BEGIN
  -- ACL / definer -------------------------------------------------------------
  IF has_function_privilege('anon', 'public.record_calendar_version(text,uuid,text,text,text,date,date,text,text,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.record_calendar_day_type_version(text,uuid,text,text,boolean,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.homologate_calendar_version(uuid,uuid,text,date,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.calendar_network_grant(text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.calendar_version_reference_issue(uuid,timestamptz)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.record_calendar_version(text,uuid,text,text,text,date,date,text,text,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE')
    OR has_table_privilege('authenticated', 'public.calendar_versions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.calendar_day_type_versions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.calendar_version_homologations', 'INSERT')
    OR has_table_privilege('anon', 'public.calendar_versions', 'SELECT')
    OR has_table_privilege('anon', 'public.calendar_day_types', 'INSERT')
  THEN RAISE EXCEPTION 'acl'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
             AND proname IN ('record_calendar_version','record_calendar_day_type_version','homologate_calendar_version','calendar_network_grant')
             AND (NOT prosecdef OR NOT proconfig @> ARRAY['search_path=""']))
  THEN RAISE EXCEPTION 'definer/search_path'; END IF;
  -- Regras reais: só na v2 draft; v1 intacta; nada homologado.
  SELECT count(*) INTO _v1 FROM capability_policy_rules r JOIN capability_policies p ON p.id = r.policy_id
    WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 1;
  SELECT count(*) INTO _v2 FROM capability_policy_rules r JOIN capability_policies p ON p.id = r.policy_id
    WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 2;
  SELECT count(*) INTO _calc FROM capability_policy_rules r JOIN capability_policies p ON p.id = r.policy_id
    WHERE r.capability_id IN ('construir-calendario-da-rede','homologar-calendario-da-rede')
      AND p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 2 AND p.status = 'draft'
      AND r.engagement_kind_id = 'gestao-pedagogica-da-rede' AND r.scope_dimensions = ARRAY['network'];
  IF _v1 <> 108 OR _v2 <> 119 OR _calc <> 2
    OR EXISTS (SELECT 1 FROM capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND status <> 'draft')
  THEN RAISE EXCEPTION 'policy-state % % %', _v1, _v2, _calc; END IF;
  _ok := _ok || 'acl policy-draft ';

  -- Fixtures fictícias --------------------------------------------------------
  INSERT INTO institutional_persons(id, display_name) VALUES (p1, 'S1'), (p2, 'S2'), (p3, 'S3');
  INSERT INTO user_person_links(user_id, person_id) VALUES
    ((u_sup::jsonb->>'sub')::uuid, p1), ((u_bld::jsonb->>'sub')::uuid, p2), ((u_none::jsonb->>'sub')::uuid, p3);
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, valid_from) VALUES
    (p1, 'teste-b464a-supervisao', 'rede', '2020-01-01'),
    (p2, 'teste-b464a-so-construir', 'rede', '2020-01-01'),
    (p3, 'teste-b464a-nada', 'rede', '2020-01-01');
  SELECT id INTO e1 FROM institutional_engagements WHERE person_id = p1;
  INSERT INTO capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b464a', 1, 'draft', '2020-01-01');
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'teste-b464a-supervisao', 'construir-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b464a-supervisao', 'homologar-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b464a-so-construir', 'construir-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b464a-nada', 'manter-matrizes-curriculares', ARRAY['network']);
  UPDATE capability_policies SET status = 'homologated' WHERE id = pol;
  INSERT INTO institutional_academic_years(id) VALUES (_yr);
  INSERT INTO institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_yr, 1, 'Ano ficticio', '2026-02-01', '2026-12-15', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_period_organizations(id, academic_year_id) VALUES (_org, _yr), (_org_x, _yr);
  INSERT INTO institutional_period_organization_versions(organization_id, version, official_name, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_org, 1, 'Org', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1),
         (_org_x, 1, 'Org X', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_academic_periods(id, academic_year_id, label, starts_on, ends_on, period_organization_id) VALUES
    (_per, _yr, 'P1', '2026-02-01', '2026-06-30', _org), (_per_x, _yr, 'PX', '2026-02-01', '2026-06-30', _org_x);
  INSERT INTO institutional_academic_period_versions(period_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_per, 1, 'P1', '2026-02-01', '2026-06-30', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1),
         (_per_x, 1, 'PX', '2026-02-01', '2026-06-30', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);

  -- Sem sessão / sem capacidade: recusa antes de qualquer leitura -----------------------------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  BEGIN PERFORM public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'X', true, 'ato', NULL); RAISE EXCEPTION 'no-session-accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar:session-required' THEN RAISE EXCEPTION 'no-session: %', SQLERRM; END IF; END;
  PERFORM set_config('request.jwt.claims', u_none, true);
  BEGIN PERFORM public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'X', true, 'ato', NULL); RAISE EXCEPTION 'no-cap-accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:construir-calendario-da-rede' THEN RAISE EXCEPTION 'no-cap: %', SQLERRM; END IF; END;
  -- Inexistente vs existente: mesma recusa (sem oráculo).
  BEGIN PERFORM public.homologate_calendar_version(gen_random_uuid(), NULL, 'homologada', '2026-02-01', 'ato', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:homologar-calendario-da-rede' THEN RAISE EXCEPTION 'no-cap-h: %', SQLERRM; END IF; END;
  -- Tabela direta negada.
  BEGIN INSERT INTO public.calendar_day_types(id) VALUES ('cdt-00000000-0000-0000-0000-000000000000'); RAISE EXCEPTION 'direct-insert-accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  _ok := _ok || 'deny ';

  -- Tipos de dia: true / false / NULL preservados -----------------------------------------
  PERFORM set_config('request.jwt.claims', u_sup, true);
  t_on := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Letivo ficticio', true, 'ato-t1', NULL);
  t_off := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Feriado ficticio', false, 'ato-t2', NULL);
  t_null := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Evento sem efeito', NULL, 'ato-t3', NULL);
  RESET ROLE;
  IF (SELECT school_day_effect FROM calendar_day_type_versions WHERE id = (t_off->>'version_id')::uuid) IS DISTINCT FROM false
    OR (SELECT school_day_effect FROM calendar_day_type_versions WHERE id = (t_null->>'version_id')::uuid) IS NOT NULL
    OR (SELECT recorded_by_person_id FROM calendar_day_type_versions WHERE id = (t_on->>'version_id')::uuid) <> p1
    OR (SELECT recorded_via_engagement_id FROM calendar_day_type_versions WHERE id = (t_on->>'version_id')::uuid) <> e1
  THEN RAISE EXCEPTION 'day-type-facts'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  -- Sucessão com base esperada; base obsoleta recusada; motivo exigido.
  r := public.record_calendar_day_type_version(t_on->>'day_type_id', (t_on->>'version_id')::uuid, 'sucessao', 'Letivo ficticio v2', true, 'ato-t1b', 'motivo');
  BEGIN PERFORM public.record_calendar_day_type_version(t_on->>'day_type_id', (t_on->>'version_id')::uuid, 'retificacao', 'Y', true, 'a', 'm'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-day-type:base-superseded' THEN RAISE EXCEPTION 'dt-base: %', SQLERRM; END IF; END;
  BEGIN PERFORM public.record_calendar_day_type_version(t_on->>'day_type_id', (r->>'version_id')::uuid, 'retificacao', 'Y', true, 'a', ''); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-day-type:reason-required' THEN RAISE EXCEPTION 'dt-reason: %', SQLERRM; END IF; END;
  _ok := _ok || 'day-types ';

  -- Calendário: constituição com filhos fixando versões de tipo -------------------------------
  c := public.record_calendar_version(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', NULL, 'ato-c1', NULL,
    jsonb_build_array(_per),
    jsonb_build_array(jsonb_build_object('starts_on','2026-02-02','ends_on','2026-06-30','day_type_version_id', t_on->>'version_id')),
    jsonb_build_array(jsonb_build_object('starts_on','2026-04-21','ends_on','2026-04-21','label','Evento','day_type_version_id', t_null->>'version_id')),
    jsonb_build_array(jsonb_build_object('day','2026-04-21','day_type_version_id', t_off->>'version_id')));
  IF (c->>'homologated')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'record-homologated'; END IF;
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM calendar_version_homologations WHERE calendar_version_id = (c->>'version_id')::uuid)
    OR (SELECT day_type_version_id FROM calendar_version_ranges WHERE version_id = (c->>'version_id')::uuid) <> (t_on->>'version_id')::uuid
    OR (SELECT recorded_via_engagement_id FROM calendar_versions WHERE id = (c->>'version_id')::uuid) <> e1
  THEN RAISE EXCEPTION 'calendar-facts'; END IF;
  PERFORM set_config('role', 'authenticated', true);

  -- Atomicidade: filho inválido (período de outra organização) ⇒ nada gravado.
  SELECT count(*) INTO _n FROM (SELECT 1) z; -- marcador
  BEGIN
    PERFORM public.record_calendar_version(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', NULL, 'ato', NULL,
      jsonb_build_array(_per_x), '[]', '[]', '[]'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar:period-outside-organization' THEN RAISE EXCEPTION 'atom: %', SQLERRM; END IF; END;
  -- Conteúdo fora do ano B2.4 recusado.
  BEGIN
    PERFORM public.record_calendar_version(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', NULL, 'ato', NULL, jsonb_build_array(_per),
      jsonb_build_array(jsonb_build_object('starts_on','2026-12-20','ends_on','2026-12-31','day_type_version_id', t_off->>'version_id')), '[]', '[]');
    RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar:reference-content-outside-year' THEN RAISE EXCEPTION 'outside-year: %', SQLERRM; END IF; END;
  -- Ano/organização incoerentes recusados pela FK.
  BEGIN
    PERFORM public.record_calendar_version(NULL, NULL, 'constituicao', 'ano-inexistente', _org, '2026-02-01', NULL, 'ato', NULL, '[]', '[]', '[]', '[]');
    RAISE EXCEPTION 'x';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  -- Versão de tipo inexistente recusada.
  BEGIN
    PERFORM public.record_calendar_version(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', NULL, 'ato', NULL, '[]',
      jsonb_build_array(jsonb_build_object('starts_on','2026-03-01','ends_on','2026-03-01','day_type_version_id', gen_random_uuid())), '[]', '[]');
    RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar:day-type-version-unknown-at-version' THEN RAISE EXCEPTION 'type: %', SQLERRM; END IF; END;
  RESET ROLE;
  SELECT count(*) INTO _n FROM institutional_calendars;
  IF _n <> 1 THEN RAISE EXCEPTION 'atomicity: % calendars', _n; END IF;
  PERFORM set_config('role', 'authenticated', true);
  _ok := _ok || 'constitute atomic b24 ';

  -- Sucessão/retificação: base esperada, motivo, sem reescrever v1.
  BEGIN PERFORM public.record_calendar_version(c->>'calendar_id', NULL, 'sucessao', _yr, _org, '2026-08-01', NULL, 'a', 'm', '[]','[]','[]','[]'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar:base-superseded' THEN RAISE EXCEPTION 'cal-base: %', SQLERRM; END IF; END;
  BEGIN PERFORM public.record_calendar_version(c->>'calendar_id', (c->>'version_id')::uuid, 'sucessao', _yr, _org, '2026-08-01', NULL, 'a', NULL, '[]','[]','[]','[]'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar:reason-required' THEN RAISE EXCEPTION 'cal-reason: %', SQLERRM; END IF; END;
  BEGIN PERFORM public.record_calendar_version(c->>'calendar_id', (c->>'version_id')::uuid, 'sucessao', _yr, _org_x, '2026-08-01', NULL, 'a', 'm', '[]','[]','[]','[]'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar:scope-immutable' THEN RAISE EXCEPTION 'cal-scope: %', SQLERRM; END IF; END;
  c2 := public.record_calendar_version(c->>'calendar_id', (c->>'version_id')::uuid, 'retificacao', _yr, _org, '2026-02-01', NULL, 'ato-c2', 'correcao',
    jsonb_build_array(_per), '[]', '[]',
    jsonb_build_array(jsonb_build_object('day','2026-04-21','day_type_version_id', r->>'version_id')));
  RESET ROLE;
  IF (SELECT count(*) FROM calendar_version_day_assignments WHERE version_id = (c->>'version_id')::uuid) <> 1
    OR (SELECT day_type_version_id FROM calendar_version_day_assignments WHERE version_id = (c->>'version_id')::uuid) <> (t_off->>'version_id')::uuid
    OR (SELECT supersedes_id FROM calendar_versions WHERE id = (c2->>'version_id')::uuid) <> (c->>'version_id')::uuid
  THEN RAISE EXCEPTION 'history-rewritten'; END IF;
  BEGIN UPDATE calendar_versions SET change_reason = 'x' WHERE id = (c->>'version_id')::uuid; RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'x' THEN RAISE EXCEPTION 'mutable'; END IF; END;
  PERFORM set_config('role', 'authenticated', true);
  _ok := _ok || 'succession-retification-immutable ';

  -- Homologação: competência distinta; quem só constrói é recusado; com competência, recusa D5 explícita.
  PERFORM set_config('request.jwt.claims', u_bld, true);
  BEGIN PERFORM public.homologate_calendar_version((c2->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-h', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:homologar-calendario-da-rede' THEN RAISE EXCEPTION 'h-builder: %', SQLERRM; END IF; END;
  PERFORM set_config('request.jwt.claims', u_sup, true);
  BEGIN PERFORM public.homologate_calendar_version((c2->>'version_id')::uuid, gen_random_uuid(), 'homologada', '2026-02-01', 'ato-h', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-homologation:base-superseded' THEN RAISE EXCEPTION 'h-base: %', SQLERRM; END IF; END;
  BEGIN PERFORM public.homologate_calendar_version((c2->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-h', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-homologation:blocked-applicability-undeclared-d5' THEN RAISE EXCEPTION 'h-d5: %', SQLERRM; END IF; END;
  -- Leitura pública continua negada.
  SELECT result_kind INTO _s FROM public.calendar_day_at(c->>'calendar_id', '2026-04-21', clock_timestamp()) LIMIT 1;
  IF _s IS DISTINCT FROM 'access-denied' THEN RAISE EXCEPTION 'reader-opened: %', _s; END IF;
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM calendar_version_homologations) THEN RAISE EXCEPTION 'homologation-written'; END IF;
  _ok := _ok || 'homologation-blocked-d5 reader-denied';

  RAISE EXCEPTION 'b464a-tests-ok: %', _ok;
END $t$;
