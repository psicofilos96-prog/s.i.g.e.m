-- B4.6.1 — Estrutura do calendário institucional. Teste transacional real: termina em RAISE, nada persiste.
-- Sucesso = 'b46-tests-ok: ...'. Sem writer: fixtures inseridas pelo papel privilegiado do teste.
-- Provas de CONTEÚDO/TEMPORALIDADE usam helpers privados com papel privilegiado: provam o núcleo técnico,
-- NÃO autorização institucional nem uso público. A fronteira pública (calendar_at/calendar_day_at) nega tudo.
-- IDs, rótulos e datas são fictícios e não representam norma.
DO $t$
DECLARE
  u_me text := '{"sub":"00000000-0000-0000-0000-0000000b4601","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-0000000b4609","role":"authenticated"}';
  p1 uuid := '00000000-0000-0000-0000-0000000b4691'; p2 uuid := '00000000-0000-0000-0000-0000000b4692';
  _rb uuid := '00000000-0000-0000-0000-0000000b4601';
  _sch text := 'esc-b46'; _yr text := 'ano-b46'; _yr2 text := 'ano-b46-b'; _org text := 'org-b46'; _org2 text := 'org-b46-b';
  _per text := 'per-b46-1'; _per2 text := 'per-b46-x'; _eng uuid;
  _cal text := 'cal-' || gen_random_uuid()::text; _cal2 text := 'cal-' || gen_random_uuid()::text;
  _ta text := 'cdt-' || gen_random_uuid()::text; _tb text := 'cdt-' || gen_random_uuid()::text; _tc text := 'cdt-' || gen_random_uuid()::text;
  _ta1 uuid := gen_random_uuid(); _ta2 uuid := gen_random_uuid(); _tb1 uuid := gen_random_uuid(); _tc1 uuid := gen_random_uuid();
  _v1 uuid := gen_random_uuid(); _v2 uuid := gen_random_uuid(); _v3 uuid := gen_random_uuid(); _vx uuid;
  _h1 uuid := gen_random_uuid(); _h2 uuid := gen_random_uuid();
  _t0 timestamptz; _t1 timestamptz; _t2 timestamptz; _t3 timestamptz;
  _ok text := ''; _n integer; _s text; _u uuid; r record;
BEGIN
  -- ACL / ausência de writer/capability ---------------------------------------------------------
  IF has_function_privilege('anon', 'public.calendar_at(text,date,timestamptz)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.calendar_day_at(text,date,timestamptz)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.calendar_at(text,date,timestamptz)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.calendar_day_at(text,date,timestamptz)', 'EXECUTE')
  THEN RAISE EXCEPTION 'acl readers'; END IF;
  FOR r IN SELECT unnest(ARRAY['public.calendar_version_reference_issue(uuid,timestamptz)','public.calendar_effective_version(text,date,timestamptz)',
      'public.calendar_version_homologation_state(uuid,date,timestamptz)','public.calendar_day_declarations(text,date,timestamptz)',
      'public.guard_calendar_version()','public.guard_calendar_version_child()','public.guard_calendar_day_type_version()',
      'public.guard_calendar_homologation_chain()']) AS f LOOP
    IF has_function_privilege('anon', r.f, 'EXECUTE') OR has_function_privilege('authenticated', r.f, 'EXECUTE') OR has_function_privilege('public', r.f, 'EXECUTE')
    THEN RAISE EXCEPTION 'acl helper %', r.f; END IF;
  END LOOP;
  FOR r IN SELECT unnest(ARRAY['institutional_calendars','calendar_versions','calendar_version_periods','calendar_day_types',
      'calendar_day_type_versions','calendar_version_ranges','calendar_version_events','calendar_version_day_assignments',
      'calendar_version_homologations']) AS t LOOP
    IF has_table_privilege('anon', 'public.' || r.t, 'SELECT') OR has_table_privilege('authenticated', 'public.' || r.t, 'SELECT')
      OR has_table_privilege('authenticated', 'public.' || r.t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || r.t, 'UPDATE')
      OR has_table_privilege('authenticated', 'public.' || r.t, 'DELETE') OR has_table_privilege('public', 'public.' || r.t, 'SELECT')
      OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || r.t)::regclass)
      OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = ('public.' || r.t)::regclass)
    THEN RAISE EXCEPTION 'acl table %', r.t; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname ~ 'calendar'
             AND proname !~ '^guard_' AND (prosecdef OR NOT proconfig @> ARRAY['search_path=""']))
  THEN RAISE EXCEPTION 'definer/search_path'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname ~ '(record|register|constitute|maintain|create|homologate|publish|write).*calendar')
  THEN RAISE EXCEPTION 'writer exists'; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE capability_id ~* 'calend') THEN RAISE EXCEPTION 'unexpected capability'; END IF;
  IF (SELECT count(*) FROM public.institutional_calendars) + (SELECT count(*) FROM public.calendar_day_types) <> 0 THEN RAISE EXCEPTION 'pre-existing data'; END IF;
  _ok := _ok || 'acl helpers-privados no-writer no-capability ';

  -- Fixtures B2.4 fictícias -------------------------------------------------------------------
  INSERT INTO public.institutional_persons(id, display_name) VALUES (p1, 'P1'), (p2, 'P2');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (_rb, p1);
  INSERT INTO public.institutional_schools(id) VALUES (_sch);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from)
  VALUES (p1, 'teste-b46', 'escola', _sch, '2020-01-01') RETURNING id INTO _eng;
  INSERT INTO public.institutional_academic_years(id) VALUES (_yr), (_yr2);
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_yr, 1, 'Ano', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato', _rb, p1, _eng),
         (_yr2, 1, 'Ano B', '2027-01-01', '2027-12-31', true, '2020-01-01', 'ato', _rb, p1, _eng);
  INSERT INTO public.institutional_period_organizations(id, academic_year_id) VALUES (_org, _yr), (_org2, _yr2);
  INSERT INTO public.institutional_period_organization_versions(organization_id, version, official_name, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_org, 1, 'Org', true, '2020-01-01', 'ato', _rb, p1, _eng), (_org2, 1, 'Org B', true, '2020-01-01', 'ato', _rb, p1, _eng);
  INSERT INTO public.institutional_academic_periods(id, academic_year_id, label, starts_on, ends_on, period_organization_id)
  VALUES (_per, _yr, 'P', '2026-02-01', '2026-06-30', _org), (_per2, _yr2, 'PX', '2027-02-01', '2027-06-30', _org2);
  INSERT INTO public.institutional_academic_period_versions(period_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_per, 1, 'P', '2026-02-01', '2026-06-30', true, '2020-01-01', 'ato', _rb, p1, _eng);

  -- Tipos abertos: efeito NULL (não declarado), true, false; versão 2 de A muda efeito ----------
  INSERT INTO public.calendar_day_types(id) VALUES (_ta), (_tb), (_tc);
  INSERT INTO public.calendar_day_type_versions(id, day_type_id, version, change_kind, label, school_day_effect, originating_act_ref, recorded_by)
  VALUES (_ta1, _ta, 1, 'constituicao', 'Tipo A', true, 'ato', _rb),
         (_tb1, _tb, 1, 'constituicao', 'Tipo B', false, 'ato', _rb),
         (_tc1, _tc, 1, 'constituicao', 'Tipo C', NULL, 'ato', _rb);
  INSERT INTO public.calendar_day_type_versions(id, day_type_id, version, supersedes_id, change_kind, label, school_day_effect, originating_act_ref, change_reason, recorded_by)
  VALUES (_ta2, _ta, 2, _ta1, 'retificacao', 'Tipo A', false, 'ato', 'correcao', _rb);
  BEGIN
    INSERT INTO public.calendar_day_type_versions(day_type_id, version, supersedes_id, change_kind, label, originating_act_ref, change_reason, recorded_by)
    VALUES (_tb, 3, _tb1, 'sucessao', 'x', 'ato', 'r', _rb);
    RAISE EXCEPTION 'type chain gap accepted';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'calendar-day-type:invalid-chain' THEN RAISE; END IF;
  END;
  _ok := _ok || 'tipos-abertos ';

  -- Versão 1 com conteúdo; tipo fixado = _ta1 (não a última _ta2) ----------------------------------
  INSERT INTO public.institutional_calendars(id) VALUES (_cal), (_cal2);
  INSERT INTO public.calendar_versions(id, calendar_id, version, change_kind, academic_year_id, period_organization_id, valid_from, valid_until, originating_act_ref, recorded_by)
  VALUES (_v1, _cal, 1, 'constituicao', _yr, _org, '2026-01-01', '2026-12-31', 'ato-cal', _rb);
  INSERT INTO public.calendar_version_periods(version_id, period_id) VALUES (_v1, _per);
  INSERT INTO public.calendar_version_ranges(version_id, starts_on, ends_on, day_type_version_id) VALUES (_v1, '2026-02-01', '2026-02-28', _ta1);
  INSERT INTO public.calendar_version_events(version_id, starts_on, ends_on, label, day_type_version_id) VALUES
    (_v1, '2026-02-10', '2026-02-10', 'Evento informativo', _tc1),   -- efeito não declarado: coexiste
    (_v1, '2026-02-11', '2026-02-11', 'Evento mesmo efeito', _ta1),   -- mesmo efeito: sem conflito
    (_v1, '2026-07-15', '2026-07-15', 'Fora de período avaliativo', _tc1); -- dentro do ano: válido
  INSERT INTO public.calendar_version_day_assignments(version_id, day, day_type_version_id) VALUES (_v1, '2026-02-12', _tb1); -- true × false
  BEGIN
    INSERT INTO public.calendar_version_periods(version_id, period_id) VALUES (_v1, _per2);
    RAISE EXCEPTION 'foreign period accepted';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'calendar:period-outside-organization' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.calendar_versions(calendar_id, version, change_kind, academic_year_id, period_organization_id, valid_from, originating_act_ref, recorded_by)
    VALUES (_cal2, 1, 'constituicao', _yr, _org2, '2026-01-01', 'ato', _rb);
    RAISE EXCEPTION 'incompatible organization accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.calendar_versions(calendar_id, version, change_kind, academic_year_id, period_organization_id, valid_from, originating_act_ref, recorded_by)
    VALUES (_cal2, 1, 'constituicao', 'ano-inexistente', 'org-inexistente', '2026-01-01', 'ato', _rb);
    RAISE EXCEPTION 'missing B2.4 accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.calendar_versions(calendar_id, version, change_kind, academic_year_id, period_organization_id, valid_from, originating_act_ref, recorded_by)
    VALUES (_cal2, 1, 'constituicao', _yr, _org, '2026-01-01', ' ', _rb);
    RAISE EXCEPTION 'blank act accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  _ok := _ok || 'refs-b2-4 provenance ';

  -- Append-only (filhos inclusive) ----------------------------------------------------------------
  FOR r IN SELECT unnest(ARRAY['UPDATE public.calendar_versions SET originating_act_ref = ''x'' WHERE id = $1',
      'DELETE FROM public.calendar_version_ranges WHERE version_id = $1',
      'UPDATE public.calendar_version_events SET label = ''x'' WHERE version_id = $1',
      'DELETE FROM public.calendar_version_day_assignments WHERE version_id = $1',
      'DELETE FROM public.calendar_version_periods WHERE version_id = $1']) AS q LOOP
    BEGIN
      EXECUTE r.q USING _v1;
      RAISE EXCEPTION 'mutation accepted: %', r.q;
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s LIKE 'mutation accepted%' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN UPDATE public.calendar_day_type_versions SET school_day_effect = true WHERE id = _tc1; RAISE EXCEPTION 'type mutated';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s = 'type mutated' THEN RAISE; END IF; END;
  _ok := _ok || 'append-only ';

  _t0 := clock_timestamp();

  -- Declarações cruas (helper privado) --------------------------------------------------------------
  IF (SELECT day_state FROM public.calendar_day_declarations(_cal, '2026-03-05', _t0)) <> 'nao-declarado' THEN RAISE EXCEPTION 'undeclared'; END IF;
  -- 2026-03-07 é sábado: ausência NÃO vira fim de semana
  IF (SELECT day_state FROM public.calendar_day_declarations(_cal, '2026-03-07', _t0)) <> 'nao-declarado' THEN RAISE EXCEPTION 'weekend inferred'; END IF;
  SELECT count(*) INTO _n FROM public.calendar_day_declarations(_cal, '2026-02-10', _t0) WHERE day_state = 'declarado';
  IF _n <> 2 THEN RAISE EXCEPTION 'informative coexist %', _n; END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_day_declarations(_cal, '2026-02-10', _t0) WHERE declaration_kind = 'evento' AND school_day_effect IS NOT NULL)
  THEN RAISE EXCEPTION 'null effect coerced'; END IF;
  IF (SELECT DISTINCT day_state FROM public.calendar_day_declarations(_cal, '2026-02-11', _t0)) <> 'declarado' THEN RAISE EXCEPTION 'same effect conflict'; END IF;
  IF (SELECT DISTINCT day_state FROM public.calendar_day_declarations(_cal, '2026-02-12', _t0)) <> 'conflito-sem-regra' THEN RAISE EXCEPTION 'conflict missed'; END IF;
  SELECT count(*) INTO _n FROM public.calendar_day_declarations(_cal, '2026-02-12', _t0);
  IF _n <> 2 THEN RAISE EXCEPTION 'conflict must return all declarations'; END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_day_declarations(_cal, '2026-02-05', _t0) WHERE day_type_version_id <> _ta1 OR school_day_effect IS DISTINCT FROM true)
  THEN RAISE EXCEPTION 'type version not pinned'; END IF;
  IF (SELECT day_state FROM public.calendar_day_declarations(_cal, '2026-07-15', _t0)) <> 'declarado' THEN RAISE EXCEPTION 'event outside assessment period rejected'; END IF;
  IF (SELECT day_state FROM public.calendar_day_declarations(_cal, '2025-06-01', _t0)) <> 'sem-versao-vigente' THEN RAISE EXCEPTION 'outside validity'; END IF;
  IF (SELECT day_state FROM public.calendar_day_declarations(_cal2, '2026-03-01', _t0)) <> 'sem-versao-vigente' THEN RAISE EXCEPTION 'empty calendar'; END IF;
  _ok := _ok || 'nao-declarado sem-fds coexistencia conflito-so-efeitos tipo-fixado fora-periodo-ok ';

  -- Homologação: ledger + revogação + restauração por novos fatos ------------------------------------
  IF public.calendar_version_homologation_state(_v1, '2026-03-01', _t0) <> 'nao-homologada' THEN RAISE EXCEPTION 'homolog default'; END IF;
  INSERT INTO public.calendar_version_homologations(id, calendar_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_h1, _v1, 1, 'homologada', '2026-02-01', 'ato-h', 'teste-b46', _rb, _eng);
  _t1 := clock_timestamp();
  INSERT INTO public.calendar_version_homologations(id, calendar_version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_h2, _v1, 2, _h1, 'revogada', '2026-05-01', 'ato-r', 'revogacao', 'teste-b46', _rb, _eng);
  INSERT INTO public.calendar_version_homologations(calendar_version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v1, 3, _h2, 'homologada', '2026-08-01', 'ato-res', 'restauracao', 'teste-b46', _rb, _eng);
  IF public.calendar_version_homologation_state(_v1, '2026-03-01', clock_timestamp()) <> 'homologada'
    OR public.calendar_version_homologation_state(_v1, '2026-06-01', clock_timestamp()) <> 'revogada'
    OR public.calendar_version_homologation_state(_v1, '2026-09-01', clock_timestamp()) <> 'homologada'
    OR public.calendar_version_homologation_state(_v1, '2026-06-01', _t1) <> 'homologada'
    OR public.calendar_version_homologation_state(_v1, '2026-01-15', clock_timestamp()) <> 'nao-homologada'
  THEN RAISE EXCEPTION 'homologation states'; END IF;
  BEGIN
    INSERT INTO public.calendar_version_homologations(calendar_version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_via_engagement_id)
    VALUES (_v1, 5, _h2, 'homologada', '2026-08-01', 'a', 'gap', 'teste-b46', _rb, _eng);
    RAISE EXCEPTION 'homolog gap accepted';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'calendar-homologation:sequence-gap' THEN RAISE; END IF;
  END;
  BEGIN UPDATE public.calendar_version_homologations SET decision = 'revogada' WHERE id = _h1; RAISE EXCEPTION 'homolog mutated';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s = 'homolog mutated' THEN RAISE; END IF; END;
  _ok := _ok || 'homologacao-ledger revogacao restauracao ';

  -- Retificação conhecida depois preserva leitura anterior por knownAt -----------------------------
  _t2 := clock_timestamp();
  INSERT INTO public.calendar_versions(id, calendar_id, version, supersedes_id, change_kind, academic_year_id, period_organization_id, valid_from, valid_until, originating_act_ref, change_reason, recorded_by)
  VALUES (_v2, _cal, 2, _v1, 'retificacao', _yr, _org, '2026-01-01', '2026-12-31', 'ato-ret', 'erro material', _rb);
  INSERT INTO public.calendar_version_day_assignments(version_id, day, day_type_version_id) VALUES (_v2, '2026-03-05', _ta2);
  IF (SELECT day_state FROM public.calendar_day_declarations(_cal, '2026-03-05', _t2)) <> 'nao-declarado'
    OR (SELECT version_id FROM public.calendar_day_declarations(_cal, '2026-03-05', _t2)) <> _v1 THEN RAISE EXCEPTION 'knownAt past rewritten'; END IF;
  IF (SELECT version_id FROM public.calendar_day_declarations(_cal, '2026-03-05', clock_timestamp())) <> _v2
    OR (SELECT school_day_effect FROM public.calendar_day_declarations(_cal, '2026-03-05', clock_timestamp())) IS DISTINCT FROM false
  THEN RAISE EXCEPTION 'retification not applied'; END IF;
  IF public.calendar_version_homologation_state(_v2, '2026-03-05', clock_timestamp()) <> 'nao-homologada' THEN RAISE EXCEPTION 'homologation leaked to new version'; END IF;
  -- Sucessão: predecessora vale antes do início da sucessora
  INSERT INTO public.calendar_versions(id, calendar_id, version, supersedes_id, change_kind, academic_year_id, period_organization_id, valid_from, valid_until, originating_act_ref, change_reason, recorded_by)
  VALUES (_v3, _cal, 3, _v2, 'sucessao', _yr, _org, '2026-09-01', '2026-12-31', 'ato-suc', 'nova deliberacao', _rb);
  IF public.calendar_effective_version(_cal, '2026-08-31', clock_timestamp()) <> _v2 OR public.calendar_effective_version(_cal, '2026-09-01', clock_timestamp()) <> _v3
  THEN RAISE EXCEPTION 'succession'; END IF;
  BEGIN
    INSERT INTO public.calendar_versions(calendar_id, version, supersedes_id, change_kind, academic_year_id, period_organization_id, valid_from, originating_act_ref, change_reason, recorded_by)
    VALUES (_cal, 4, _v3, 'sucessao', _yr2, _org2, '2026-10-01', 'ato', 'r', _rb);
    RAISE EXCEPTION 'scope changed';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'calendar:scope-immutable' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.calendar_versions(calendar_id, version, supersedes_id, change_kind, academic_year_id, period_organization_id, valid_from, originating_act_ref, change_reason, recorded_by)
    VALUES (_cal, 5, _v3, 'sucessao', _yr, _org, '2026-10-01', 'ato', 'r', _rb);
    RAISE EXCEPTION 'version gap';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'calendar:invalid-chain' THEN RAISE; END IF;
  END;
  -- simula transação posterior: a janela da versão é marcador transacional definido pelo guard
  PERFORM set_config('sigem.calendar_open_' || replace(_v1::text, '-', ''), '', true);
  BEGIN
    INSERT INTO public.calendar_version_ranges(version_id, starts_on, ends_on, day_type_version_id) VALUES (_v1, '2026-04-01', '2026-04-02', _ta1);
    RAISE EXCEPTION 'child after close';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS _s = MESSAGE_TEXT; IF _s <> 'calendar:child-after-version-closed' THEN RAISE; END IF;
  END;
  _ok := _ok || 'retificacao-knownAt sucessao escopo-imutavel cadeia filho-fora-da-janela ';

  -- Referência B2.4: mudança intermediária (período inativo em julho) e knownAt ------------------------
  _t3 := clock_timestamp();
  -- B2.4 grava created_at = now() (início da transação); no teste o instante conhecido é explícito.
  INSERT INTO public.institutional_academic_period_versions(period_id, version, supersedes_id, official_name, starts_on, ends_on, is_active, valid_from,
    change_reason, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id, created_at)
  SELECT _per, 2, id, 'P', '2026-02-01', '2026-06-30', false, '2026-07-01', 'encerrado', 'ato', _rb, p1, _eng, _t3 + interval '1 second'
  FROM public.institutional_academic_period_versions WHERE period_id = _per AND version = 1;
  IF public.calendar_version_reference_issue(_v1, _t3) IS NOT NULL THEN RAISE EXCEPTION 'knownAt before b2.4 change'; END IF;
  IF public.calendar_version_reference_issue(_v1, _t3 + interval '2 second') <> 'period-inactive' THEN RAISE EXCEPTION 'intermediate change missed'; END IF;
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, supersedes_id, official_name, starts_on, ends_on, is_active, valid_from,
    change_reason, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id, created_at)
  SELECT _yr, 2, id, 'Ano', '2026-03-10', '2026-12-31', true, '2026-04-01', 'ano encurtado', 'ato', _rb, p1, _eng, _t3 + interval '3 second'
  FROM public.institutional_academic_year_versions WHERE academic_year_id = _yr AND version = 1;
  IF public.calendar_version_reference_issue(_v3, _t3 + interval '4 second') IS NOT NULL THEN RAISE EXCEPTION 'v3 has no early content'; END IF;
  IF (SELECT day_state FROM public.calendar_day_declarations(_cal, '2026-03-05', _t3 + interval '4 second')) <> 'referencia-b2-4-invalida'
    OR (SELECT day_state FROM public.calendar_day_declarations(_cal, '2026-03-05', _t3)) <> 'declarado' THEN RAISE EXCEPTION 'v2 period ref'; END IF;
  _ok := _ok || 'b2-4-mudanca-intermediaria b2-4-knownAt ';

  -- Fronteira pública: nega tudo, igual para existente/inexistente/NULL ----------------------------------
  PERFORM set_config('role', 'authenticated', true);
  FOREACH _s IN ARRAY ARRAY[u_me, u_none] LOOP
    PERFORM set_config('request.jwt.claims', _s, true);
    SELECT count(*) INTO _n FROM (
      SELECT * FROM public.calendar_at(_cal, '2026-03-05', now()) UNION ALL
      SELECT * FROM public.calendar_at('cal-00000000-0000-0000-0000-000000000000', '2026-03-05', now()) UNION ALL
      SELECT * FROM public.calendar_at(NULL, NULL, NULL) UNION ALL
      SELECT * FROM public.calendar_day_at(_cal, '2026-02-12', now()) UNION ALL
      SELECT * FROM public.calendar_day_at('qualquer', '2026-02-12', now())) x WHERE x.result_kind = 'access-denied';
    IF _n <> 5 THEN RAISE EXCEPTION 'public reader not denied'; END IF;
    IF (SELECT count(*) FROM public.calendar_at(_cal, '2026-03-05', now())) <> 1 THEN RAISE EXCEPTION 'single row'; END IF;
    BEGIN PERFORM 1 FROM public.calendar_versions; RAISE EXCEPTION 'table readable';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN PERFORM public.calendar_effective_version(_cal, '2026-03-05', now()); RAISE EXCEPTION 'helper callable';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN PERFORM * FROM public.calendar_day_declarations(_cal, '2026-03-05', now()); RAISE EXCEPTION 'helper callable';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN INSERT INTO public.institutional_calendars(id) VALUES ('cal-' || gen_random_uuid()::text); RAISE EXCEPTION 'insert allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM * FROM public.calendar_at(_cal, '2026-03-05', now()); RAISE EXCEPTION 'anon executes';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  _ok := _ok || 'public-denied-uniforme conta-com/sem-pessoa tabelas-negadas helpers-negados anon-negado ';

  RAISE EXCEPTION 'b46-tests-ok: %', _ok;
END $t$;
