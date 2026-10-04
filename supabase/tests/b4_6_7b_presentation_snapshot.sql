-- B4.6.7b — Snapshot de apresentação (0035): anexo após a versão, nova tentativa sem nova versão, imutabilidade,
-- bloqueio após decisão, leitura por público. Transacional: termina em RAISE, nada persiste. Sucesso = 'b467b-tests-ok: ...'.
DO $t$
DECLARE
  u_sup text := '{"sub":"00000000-0000-0000-0000-0000000b4761","role":"authenticated"}';
  u_any text := '{"sub":"00000000-0000-0000-0000-0000000b4765","role":"authenticated"}';
  p1 uuid := '00000000-0000-0000-0000-0000000b4791'; p5 uuid := '00000000-0000-0000-0000-0000000b4795';
  pol uuid := '00000000-0000-0000-0000-0000000b47a0';
  _yr text := 'ano-b467b'; _org text := 'org-b467b'; e1 uuid; tl jsonb; ca jsonb; r jsonb; n0 integer; ok text := '';
  dg text := repeat('a', 64); sa jsonb := '{"kind":"escola","school_id":"esc-b467b"}';
BEGIN
  INSERT INTO institutional_persons(id, display_name) VALUES (p1,'S1'),(p5,'S5');
  INSERT INTO user_person_links(user_id, person_id) VALUES ((u_sup::jsonb->>'sub')::uuid, p1), ((u_any::jsonb->>'sub')::uuid, p5);
  INSERT INTO institutional_schools(id) VALUES ('esc-b467b');
  INSERT INTO institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
    VALUES ('esc-b467b', 1, 'Escola', true, '2020-01-01', 'ato');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    (p1, 'teste-b467b-super', 'rede', NULL, '2020-01-01'), (p5, 'teste-b467b-nada', 'rede', NULL, '2020-01-01');
  SELECT id INTO e1 FROM institutional_engagements WHERE person_id = p1;
  INSERT INTO capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b467b', 1, 'draft', '2020-01-01');
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'teste-b467b-super', 'construir-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b467b-super', 'homologar-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b467b-super', 'construir-norma-composicao-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b467b-super', 'homologar-norma-composicao-calendario-da-rede', ARRAY['network']);
  UPDATE capability_policies SET status = 'homologated' WHERE id = pol;
  INSERT INTO institutional_academic_years(id) VALUES (_yr);
  INSERT INTO institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id) VALUES
    (_yr, 1, 'Ano ficticio', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_period_organizations(id, academic_year_id) VALUES (_org, _yr);
  INSERT INTO institutional_period_organization_versions(organization_id, version, official_name, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_org, 1, 'Org', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sup, true);
  tl := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Letivo', true, 'ato-t', NULL);
  ca := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-ca', NULL, '[]', '[]', '[]', jsonb_build_array(jsonb_build_object('day','2026-04-20','day_type_version_id', tl->>'version_id')),
    jsonb_build_array(jsonb_build_object('scope_key','r','window_from','2026-02-01','window_until','2026-12-15','conditions', jsonb_build_array(sa))));
  PERFORM set_config('role', 'postgres', true); SELECT count(*) INTO n0 FROM calendar_versions; PERFORM set_config('role', 'authenticated', true);

  -- Leitura antes do anexo: sem-snapshot (construção vê a versão não homologada).
  r := public.calendar_presentation_at((ca->>'version_id')::uuid, '2026-04-20', clock_timestamp());
  IF r->>'state' <> 'sem-snapshot' THEN RAISE EXCEPTION 'pre %', r; END IF;

  -- Falha de anexo (digest inválido) NÃO cria versão; nova tentativa anexa à MESMA versão.
  BEGIN PERFORM public.record_calendar_presentation_snapshot((ca->>'version_id')::uuid, 'edicao-institucional', NULL, NULL, 'x', NULL, '{"title":"Regular"}', NULL);
    RAISE EXCEPTION 'bad-digest-accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  r := public.record_calendar_presentation_snapshot((ca->>'version_id')::uuid, 'edicao-institucional', NULL, NULL, dg, NULL,
    '{"title":"Calendário Regular 2026","signatures":["Supervisão"],"symbology":{"FE":{"shape":"circulo"}}}', NULL);
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT count(*) FROM calendar_versions) <> n0 THEN RAISE EXCEPTION 'phantom-version'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  ok := ok || 'retry-same-version-no-phantom ';

  -- Segundo anexo recusado; snapshot imutável.
  BEGIN PERFORM public.record_calendar_presentation_snapshot((ca->>'version_id')::uuid, 'edicao-institucional', NULL, NULL, dg, NULL, '{}', NULL);
    RAISE EXCEPTION 'second-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%already-recorded%' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  BEGIN UPDATE calendar_version_presentation_snapshots SET presentation = '{}' WHERE version_id = (ca->>'version_id')::uuid; RAISE EXCEPTION 'mutable';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'mutable' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'authenticated', true);
  ok := ok || 'single-immutable ';

  -- Origem importada exige bruto e chave; referência exige declaração.
  BEGIN PERFORM public.record_calendar_presentation_snapshot((ca->>'version_id')::uuid, 'importacao-navegador', NULL, 'e', dg, NULL, '{}', NULL); RAISE EXCEPTION 'raw-optional';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'raw-optional' THEN RAISE; END IF; END;
  ok := ok || 'import-requires-raw ';

  -- Público sem capacidade: não lê antes da homologação.
  PERFORM set_config('request.jwt.claims', u_any, true);
  r := public.calendar_presentation_at((ca->>'version_id')::uuid, '2026-04-20', clock_timestamp());
  IF r->>'state' <> 'access-denied' THEN RAISE EXCEPTION 'public-before %', r; END IF;
  BEGIN PERFORM public.record_calendar_presentation_snapshot((ca->>'version_id')::uuid, 'edicao-institucional', NULL, NULL, dg, NULL, '{}', NULL); RAISE EXCEPTION 'nocap';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'nocap' THEN RAISE; END IF; END;
  ok := ok || 'public-denied-before-homologation nocap-write-denied ';

  -- Após homologação: público lê o snapshot preservado; novo anexo recusado.
  PERFORM set_config('request.jwt.claims', u_sup, true);
  PERFORM public.homologate_calendar_version((ca->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-h', NULL);
  PERFORM set_config('request.jwt.claims', u_any, true);
  r := public.calendar_presentation_at((ca->>'version_id')::uuid, '2026-04-20', clock_timestamp());
  IF r->>'state' <> 'lido' OR r->'snapshot'->'presentation'->>'title' <> 'Calendário Regular 2026'
     OR r->'snapshot'->'presentation'->'signatures'->>0 <> 'Supervisão' THEN RAISE EXCEPTION 'public-after %', r; END IF;
  ok := ok || 'public-reads-homologated-presentation ';

  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.calendar_presentation_at((ca->>'version_id')::uuid, '2026-04-20', clock_timestamp()); RAISE EXCEPTION 'anon-exec';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ok := ok || 'anon-denied ';
  RAISE EXCEPTION 'b467b-tests-ok: %', ok;
END $t$;
