-- B4.6.7f — Papel de conselho por versão (0039) e agenda por alocação. Transacional: termina em RAISE, nada persiste.
-- Sucesso = 'b467f-tests-ok: ...'. Fixtures sintéticas (mesma montagem da b4_6_7c); nenhum usuário real.
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
  tl jsonb; tn jsonb; tx jsonb; tc jsonb; ag jsonb; cf jsonb; ca jsonb; cb jsonb; cc jsonb; nv jsonb; nh jsonb; r jsonb; k1 timestamptz; k2 timestamptz;
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
    (pol, 'secretaria-escolar', 'consultar-matricula-e-movimentacao', ARRAY['school']),
    (pol, 'secretaria-escolar', 'manter-organizacao-da-oferta-da-turma', ARRAY['school']);
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
  tc := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Conselho de Classe', true, 'ato-t', NULL);
  ca := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-ca', NULL, '[]', jsonb_build_array(jsonb_build_object('starts_on','2026-02-01','ends_on','2026-04-20','day_type_version_id', tl->>'version_id'),
      jsonb_build_object('starts_on','2026-04-22','ends_on','2026-12-15','day_type_version_id', tl->>'version_id')),
    '[]', jsonb_build_array(jsonb_build_object('day','2026-04-21','day_type_version_id', tn->>'version_id'),
      jsonb_build_object('day','2026-04-24','day_type_version_id', tc->>'version_id')),
    jsonb_build_array(jsonb_build_object('scope_key','iniciais','window_from','2026-02-01','window_until','2026-12-15','conditions',
      jsonb_build_array(sa, '{"kind":"valor-de-eixo","scheme_id":"etapa-b467c","value_id":"iniciais","value_version":1}'::jsonb))));
  cb := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-cb', NULL, '[]', jsonb_build_array(jsonb_build_object('starts_on','2026-02-01','ends_on','2026-12-15','day_type_version_id', tl->>'version_id')),
    '[]', '[]',
    jsonb_build_array(jsonb_build_object('scope_key','eja','window_from','2026-02-01','window_until','2026-12-15','conditions',
      jsonb_build_array('{"kind":"valor-de-eixo","scheme_id":"etapa-b467c","value_id":"eja","value_version":1}'::jsonb))));

  -- Sem capacidade de construção: recusado.
  PERFORM set_config('request.jwt.claims', u_any, true);
  BEGIN PERFORM public.record_calendar_council_configuration((ca->>'version_id')::uuid, jsonb_build_array(jsonb_build_object('dayTypeId', tc->>'day_type_id','role','Conselho de Classe')), 'ato');
    RAISE EXCEPTION 'nocap-accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'nocap-accepted' THEN RAISE; END IF; END;
  ok := ok || 'nocap-write-denied ';
  PERFORM set_config('request.jwt.claims', u_sup, true);
  -- Tipo não declarado na versão: recusado (sem inferência por nome).
  BEGIN PERFORM public.record_calendar_council_configuration((cb->>'version_id')::uuid, jsonb_build_array(jsonb_build_object('dayTypeId', tc->>'day_type_id','role','Conselho')), 'ato');
    RAISE EXCEPTION 'foreign-type'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%type-not-in-version%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_calendar_council_configuration((ca->>'version_id')::uuid, jsonb_build_array(jsonb_build_object('dayTypeId', tc->>'day_type_id','role',' ')), 'ato');
    RAISE EXCEPTION 'blank-role'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%role-required%' THEN RAISE; END IF; END;
  ok := ok || 'type-must-be-in-version role-required ';
  cf := public.record_calendar_council_configuration((ca->>'version_id')::uuid,
    jsonb_build_array(jsonb_build_object('dayTypeId', tc->>'day_type_id','role','Conselho de Classe','sourceProposal','CC')), 'ato-cons');
  BEGIN PERFORM public.record_calendar_council_configuration((ca->>'version_id')::uuid, '[]', 'ato'); RAISE EXCEPTION 'second';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%already-recorded%' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  BEGIN UPDATE calendar_version_council_roles SET role_label = 'x'; RAISE EXCEPTION 'mutable';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'mutable' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'authenticated', true);
  ok := ok || 'single-immutable ';

  nv := public.record_calendar_composition_norm_version(NULL, NULL, 'constituicao', '2026-01-01', NULL, 'ato-n', NULL, 'exigir-exclusividade', '[]',
    '[{"dimensionId":"efeito-dia","effectPrimitive":"school_day_effect","effectContractVersion":1}]');
  PERFORM public.homologate_calendar_composition_norm((nv->>'versionId')::uuid, NULL, 'homologada', '2026-01-01', 'ato-hn', NULL);
  PERFORM public.homologate_calendar_version((ca->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-ha', NULL);
  PERFORM public.homologate_calendar_version((cb->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-hb', NULL);
  k1 := clock_timestamp();
  -- Após a decisão: configuração não pode mais ser anexada.
  BEGIN PERFORM public.record_calendar_council_configuration((cb->>'version_id')::uuid, '[]', 'ato'); RAISE EXCEPTION 'after-decision';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%already-decided%' THEN RAISE; END IF; END;
  ok := ok || 'frozen-after-homologation ';

  PERFORM set_config('request.jwt.claims', u_sec, true);
  ag := public.calendar_council_agenda_at('a-b466-reg', '2026-04-23', '2026-04-24', k1);
  IF ag->>'state' <> 'lido' OR ag->'days'->1->>'state' <> 'configurada' OR jsonb_array_length(ag->'days'->1->'items') <> 1
     OR ag->'days'->1->'items'->0->>'role' <> 'Conselho de Classe' OR ag->'days'->1->'items'->0->'schoolDayEffect' <> 'true'::jsonb
     OR jsonb_array_length(ag->'days'->0->'items') <> 0 THEN RAISE EXCEPTION 'agenda-reg %', ag; END IF;
  ok := ok || 'agenda-by-allocation effect-true-preserved ';
  ag := public.calendar_council_agenda_at('a-b466-eja', '2026-04-24', '2026-04-24', k1);
  IF ag->'days'->0->>'state' <> 'nao-configurada' THEN RAISE EXCEPTION 'agenda-eja %', ag; END IF;
  ok := ok || 'other-calendar-not-configured-not-zero ';
  ag := public.calendar_council_agenda_at('a-b466-reg', '2026-04-24', '2026-04-24', k1 - interval '1 hour');
  IF ag->'days'->0->>'state' <> 'pendente' THEN RAISE EXCEPTION 'agenda-old %', ag; END IF;
  ok := ok || 'old-known-at-pending ';
  -- Configuração lida por quem não constrói, só com versão homologada.
  r := public.calendar_council_configuration_at((ca->>'version_id')::uuid, '2026-04-24', k1);
  IF r->>'state' <> 'configurada' OR r->'roles'->0->>'sourceProposal' <> 'CC' THEN RAISE EXCEPTION 'config-read %', r; END IF;
  PERFORM set_config('request.jwt.claims', u_any, true);
  ag := public.calendar_council_agenda_at('a-b466-reg', '2026-04-24', '2026-04-24', k1);
  IF ag->>'state' <> 'access-denied' OR ag ? 'days' THEN RAISE EXCEPTION 'unauth %', ag; END IF;
  ok := ok || 'config-read-homologated unauthorized-allocation-denied ';
  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.calendar_council_agenda_at('a-b466-reg', '2026-04-24', '2026-04-24', k1); RAISE EXCEPTION 'anon-exec';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ok := ok || 'anon-denied ';
  RAISE EXCEPTION 'b467f-tests-ok: %', ok;
END $t$;
