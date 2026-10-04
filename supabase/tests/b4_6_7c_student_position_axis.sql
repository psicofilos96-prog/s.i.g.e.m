-- B4.6.7c — Eixo do ESTUDANTE (posição B3.3) decide a aplicabilidade (0036). Transacional: termina em RAISE, nada persiste.
-- Sucesso = 'b467c-tests-ok: ...'. Fixtures 100% sintéticas; política sintética homologada só dentro da transação.
DO $t$
DECLARE
  u_sup text := '{"sub":"00000000-0000-0000-0000-0000000b4661","role":"authenticated"}';
  u_cal text := '{"sub":"00000000-0000-0000-0000-0000000b4662","role":"authenticated"}';
  u_sec text := '{"sub":"00000000-0000-0000-0000-0000000b4664","role":"authenticated"}';
  u_any text := '{"sub":"00000000-0000-0000-0000-0000000b4665","role":"authenticated"}';
  p1 uuid := '00000000-0000-0000-0000-0000000b4691'; p2 uuid := '00000000-0000-0000-0000-0000000b4692';
  p4 uuid := '00000000-0000-0000-0000-0000000b4694'; p5 uuid := '00000000-0000-0000-0000-0000000b4695';
  pol uuid := '00000000-0000-0000-0000-0000000b46a0';
  _yr text := 'ano-b466'; _org text := 'org-b466'; _per text := 'per-b466'; e1 uuid; cls text;
  tl jsonb; tn jsonb; tx jsonb; ca jsonb; cb jsonb; cc jsonb; nv jsonb; nh jsonb; r jsonb; k1 timestamptz; k2 timestamptz;
  ok text := ''; ra jsonb; rb jsonb; sx jsonb; _v1 integer; _v2 integer; sa jsonb := '{"kind":"escola","school_id":"esc-b466"}'; f text; _ha jsonb;
BEGIN
  -- Fixtures (dono) ----------------------------------------------------------------------
  INSERT INTO institutional_persons(id, display_name) VALUES (p1,'S1'),(p2,'S2'),(p4,'S4'),(p5,'S5');
  INSERT INTO user_person_links(user_id, person_id) VALUES ((u_sup::jsonb->>'sub')::uuid, p1), ((u_cal::jsonb->>'sub')::uuid, p2),
    ((u_sec::jsonb->>'sub')::uuid, p4), ((u_any::jsonb->>'sub')::uuid, p5);
  INSERT INTO institutional_schools(id) VALUES ('esc-b466');
  INSERT INTO institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
    VALUES ('esc-b466', 1, 'Escola', true, '2020-01-01', 'ato');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    (p1, 'teste-b466-super', 'rede', NULL, '2020-01-01'), (p2, 'teste-b466-cal', 'rede', NULL, '2020-01-01'),
    (p4, 'secretaria-escolar', 'escola', 'esc-b466', '2020-01-01'), (p5, 'teste-b466-nada', 'rede', NULL, '2020-01-01');
  SELECT id INTO e1 FROM institutional_engagements WHERE person_id = p1;
  INSERT INTO capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b466', 1, 'draft', '2020-01-01');
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'teste-b466-super', 'construir-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b466-super', 'homologar-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b466-super', 'construir-norma-composicao-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b466-super', 'homologar-norma-composicao-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b466-cal', 'construir-calendario-da-rede', ARRAY['network']),
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']),
    (pol, 'secretaria-escolar', 'manter-matricula-e-enturmacao', ARRAY['school']),
    (pol, 'secretaria-escolar', 'consultar-matricula-e-movimentacao', ARRAY['school']);
  UPDATE capability_policies SET status = 'homologated' WHERE id = pol;
  INSERT INTO institutional_academic_years(id) VALUES (_yr);
  INSERT INTO institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id) VALUES
    (_yr, 1, 'Ano ficticio', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_period_organizations(id, academic_year_id) VALUES (_org, _yr);
  INSERT INTO institutional_period_organization_versions(organization_id, version, official_name, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_org, 1, 'Org', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_academic_periods(id, academic_year_id, label, starts_on, ends_on, period_organization_id)
    VALUES (_per, _yr, 'P1', '2026-02-01', '2026-06-30', _org);
  INSERT INTO institutional_academic_period_versions(period_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_per, 1, 'P1', '2026-02-01', '2026-06-30', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_students(id, display_name) VALUES ('est-b466-1','E1'),('est-b466-2','E2');
  INSERT INTO attribute_value_definitions(scheme_id, value_id, version, label, status, homologation_act_ref, valid_from) VALUES
    ('natureza-da-participacao-educacional', 'nat-b466', 1, 'Natureza teste', 'homologada', 'ato', '2020-01-01'),
    ('etapa-b467c', 'iniciais', 1, 'Anos iniciais (teste)', 'homologada', 'ato', '2020-01-01'),
    ('etapa-b467c', 'eja', 1, 'EJA (teste)', 'homologada', 'ato', '2020-01-01');

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  cls := public.register_institutional_class('esc-b466', _yr, 'A', 'Turma multietapa', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  PERFORM public.constitute_cycle_enrollment('m-b466-1', 'est-b466-1', 'esc-b466', _yr, '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-b466-2', 'est-b466-2', 'esc-b466', _yr, '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.declare_cycle_participation('pt-b466-1', NULL, 'm-b466-1', 'nat-b466', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.declare_cycle_participation('pt-b466-2', NULL, 'm-b466-2', 'nat-b466', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.record_class_allocation('a-b466-reg', 'pt-b466-1', cls, '2026-02-01', 'ato', NULL, NULL);
  PERFORM public.record_class_allocation('a-b466-eja', 'pt-b466-2', cls, '2026-02-01', 'ato', NULL, NULL);

  -- Posições B3.3 do ESTUDANTE na MESMA turma (etapas diferentes); a turma não declara etapa.
  PERFORM set_config('request.jwt.claims', u_sec, true);
  PERFORM public.record_allocation_curricular_position('pos-b467c-1', NULL, 'a-b466-reg', '2026-02-01', NULL,
    '[{"scheme":"etapa-b467c","value":"iniciais","version":1}]', 'ato', NULL, false);
  PERFORM public.record_allocation_curricular_position('pos-b467c-2', NULL, 'a-b466-eja', '2026-02-01', NULL,
    '[{"scheme":"etapa-b467c","value":"eja","version":1}]', 'ato', NULL, false);

  PERFORM set_config('request.jwt.claims', u_sup, true);
  tl := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Letivo', true, 'ato-t', NULL);
  tn := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Feriado', false, 'ato-t', NULL);
  -- Calendário "Regular": SÓ por valor de eixo da posição (iniciais); 04-21 feriado. "EJA": valor eja; 04-21 letivo.
  ca := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-ca', NULL, '[]', jsonb_build_array(jsonb_build_object('starts_on','2026-02-01','ends_on','2026-12-15','day_type_version_id', tl->>'version_id')),
    '[]', jsonb_build_array(jsonb_build_object('day','2026-04-21','day_type_version_id', tn->>'version_id')),
    jsonb_build_array(jsonb_build_object('scope_key','iniciais','window_from','2026-02-01','window_until','2026-12-15','conditions',
      jsonb_build_array(sa, '{"kind":"valor-de-eixo","scheme_id":"etapa-b467c","value_id":"iniciais","value_version":1}'::jsonb))));
  cb := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-cb', NULL, '[]', jsonb_build_array(jsonb_build_object('starts_on','2026-02-01','ends_on','2026-12-15','day_type_version_id', tl->>'version_id')),
    '[]', '[]',
    jsonb_build_array(jsonb_build_object('scope_key','eja','window_from','2026-02-01','window_until','2026-12-15','conditions',
      jsonb_build_array('{"kind":"valor-de-eixo","scheme_id":"etapa-b467c","value_id":"eja","value_version":1}'::jsonb))));
  nv := public.record_calendar_composition_norm_version(NULL, NULL, 'constituicao', '2026-01-01', NULL, 'ato-n', NULL, 'exigir-exclusividade', '[]',
    '[{"dimensionId":"efeito-dia","effectPrimitive":"school_day_effect","effectContractVersion":1}]');
  PERFORM public.homologate_calendar_composition_norm((nv->>'versionId')::uuid, NULL, 'homologada', '2026-01-01', 'ato-hn', NULL);
  PERFORM public.homologate_calendar_version((ca->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-ha', NULL);
  PERFORM public.homologate_calendar_version((cb->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-hb', NULL);
  k1 := clock_timestamp();

  -- Leitura pela Secretaria (consultar-matricula-e-movimentacao na escola).
  PERFORM set_config('request.jwt.claims', u_sec, true);
  ra := public.calendar_composed_days_at('a-b466-reg', '2026-04-20', '2026-04-21', k1);
  rb := public.calendar_composed_days_at('a-b466-eja', '2026-04-20', '2026-04-21', k1);
  IF ra->>'state' <> 'lido' OR ra->'days'->1->>'result' <> 'nao-letivo' OR ra->'days'->1->>'calendarId' <> ca->>'calendar_id'
     OR ra->'days'->0->>'result' <> 'letivo' THEN RAISE EXCEPTION 'reg-position %', ra; END IF;
  IF rb->'days'->1->>'result' <> 'letivo' OR rb->'days'->1->>'calendarId' <> cb->>'calendar_id' THEN RAISE EXCEPTION 'eja-position %', rb; END IF;
  IF ra->'days'->0->'context'->'positionAxis'->0->>'value' <> 'iniciais' OR ra->'days'->0->'context'->'positionAxis'->0->>'source' <> 'posicao'
     OR jsonb_array_length(ra->'days'->0->'context'->'offeringAxis') <> 0 THEN RAISE EXCEPTION 'axis-provenance %', ra->'days'->0->'context'; END IF;
  ok := ok || 'same-class-different-positions different-calendars holiday-only-for-own-calendar axis-source-posicao ';

  -- knownAt anterior às posições: nenhum eixo ⇒ nenhum candidato (nunca a etapa da turma).
  sx := public.calendar_composed_days_at('a-b466-reg', '2026-04-21', '2026-04-21', k1 - interval '1 hour');
  IF sx->'days'->0->>'result' NOT IN ('sem-calendario-aplicavel', 'norma-indisponivel', 'contexto-indisponivel') THEN RAISE EXCEPTION 'old-known-at %', sx; END IF;
  ok := ok || 'old-known-at-no-inference ';

  -- Oferta da turma declara o MESMO esquema com outro valor ⇒ colisão explícita, sem dominante.
  PERFORM public.record_class_offering_version('of-b467c', NULL, cls, '[{"scheme":"etapa-b467c","value":"eja","version":1}]', '2026-02-01', NULL, NULL, 'ato-of');
  ra := public.calendar_composed_days_at('a-b466-reg', '2026-04-21', '2026-04-21', clock_timestamp());
  rb := public.calendar_composed_days_at('a-b466-eja', '2026-04-21', '2026-04-21', clock_timestamp());
  IF ra->'days'->0->>'result' <> 'contexto-indisponivel' OR ra->'days'->0->>'detail' <> 'ambigua:eixo-posicao-oferta:etapa-b467c'
     OR ra->'days'->0 ? 'schoolDayEffect' AND ra->'days'->0->'schoolDayEffect' <> 'null'::jsonb THEN RAISE EXCEPTION 'collision %', ra; END IF;
  -- Mesma etapa na oferta e na posição: concordância, resultado preservado.
  IF rb->'days'->0->>'result' <> 'letivo' THEN RAISE EXCEPTION 'agree %', rb; END IF;
  ok := ok || 'offering-collision-explicit offering-agree ';

  -- Anônimo: sem acesso.
  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.calendar_composed_days_at('a-b466-reg', '2026-04-21', '2026-04-21', k1); RAISE EXCEPTION 'anon-exec';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ok := ok || 'anon-denied ';
  RAISE EXCEPTION 'b467c-tests-ok: %', ok;
END $t$;
