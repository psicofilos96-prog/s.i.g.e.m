-- B4.6.6 — Fim a fim autorizado (0032/0033). Teste transacional real: termina em RAISE, nada persiste.
-- Sucesso = 'b466-tests-ok: ...'. Fixtures 100% sintéticas; política sintética homologada só dentro da transação.
-- Não representa norma/calendário institucional. Políticas reais v1/v2 continuam draft (108/121).
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
  ok text := ''; _v1 integer; _v2 integer; sa jsonb := '{"kind":"escola","school_id":"esc-b466"}'; f text; _ha jsonb;
BEGIN
  -- ACL ---------------------------------------------------------------------------------
  FOREACH f IN ARRAY ARRAY['public.calendar_at(text,date,timestamptz)','public.calendar_day_at(text,date,timestamptz)',
    'public.calendar_days_at(text,date,date,timestamptz)','public.calendar_list_at(timestamptz)','public.calendar_day_types_at(timestamptz)',
    'public.calendar_composition_norm_at(date,timestamptz)','public.calendar_composed_days_at(text,date,date,timestamptz)',
    'public.record_calendar_composition_norm_version(text,uuid,text,date,date,text,text,text,jsonb,jsonb)',
    'public.homologate_calendar_composition_norm(uuid,uuid,text,date,text,text)','public.homologate_calendar_version(uuid,uuid,text,date,text,text)'] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE') OR NOT has_function_privilege('authenticated', f, 'EXECUTE')
      OR NOT (SELECT prosecdef AND coalesce(proconfig @> ARRAY['search_path=""'], false) FROM pg_proc WHERE oid = f::regprocedure)
    THEN RAISE EXCEPTION 'acl %', f; END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.calendar_composed_day_private(date,timestamptz,text)','public.calendar_has_network_capability(text)',
    'public.calendar_snapshot_issue(date,date,timestamptz)','public.calendar_composition_evidence_at(date,timestamptz,text)'] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE') OR has_function_privilege('authenticated', f, 'EXECUTE') THEN RAISE EXCEPTION 'private-acl %', f; END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY['calendar_versions','calendar_version_homologations','calendar_composition_norm_versions','calendar_composition_norm_homologations',
    'calendar_composition_norm_effect_bindings','calendar_day_type_versions'] LOOP
    IF has_table_privilege('authenticated', 'public.' || f, 'SELECT') OR has_table_privilege('anon', 'public.' || f, 'SELECT')
      OR has_table_privilege('authenticated', 'public.' || f, 'INSERT') THEN RAISE EXCEPTION 'table-acl %', f; END IF;
  END LOOP;
  SELECT count(*) INTO _v1 FROM capability_policy_rules r JOIN capability_policies p ON p.id = r.policy_id WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 1;
  SELECT count(*) INTO _v2 FROM capability_policy_rules r JOIN capability_policies p ON p.id = r.policy_id WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 2;
  IF _v1 <> 108 OR _v2 <> 121 OR EXISTS (SELECT 1 FROM capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND status <> 'draft')
    OR (SELECT count(*) FROM capability_policy_rules r JOIN capability_policies p ON p.id = r.policy_id WHERE p.version = 2
        AND p.logical_policy_id = 'politica-capacidades-diario' AND r.engagement_kind_id = 'gestao-pedagogica-da-rede'
        AND r.capability_id IN ('construir-norma-composicao-calendario-da-rede','homologar-norma-composicao-calendario-da-rede')) <> 2
  THEN RAISE EXCEPTION 'policy-state'; END IF;
  IF EXISTS (SELECT 1 FROM calendar_composition_norms) OR EXISTS (SELECT 1 FROM institutional_calendars) THEN RAISE EXCEPTION 'seeded'; END IF;
  ok := ok || 'acl definer-search-path private-helpers tables-closed policy-108-121-draft no-seed ';

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
    ('natureza-da-participacao-educacional', 'nat-b466', 1, 'Natureza teste', 'homologada', 'ato', '2020-01-01');

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  cls := public.register_institutional_class('esc-b466', _yr, 'A', 'Turma multietapa', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  PERFORM public.constitute_cycle_enrollment('m-b466-1', 'est-b466-1', 'esc-b466', _yr, '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.constitute_cycle_enrollment('m-b466-2', 'est-b466-2', 'esc-b466', _yr, '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.declare_cycle_participation('pt-b466-1', NULL, 'm-b466-1', 'nat-b466', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.declare_cycle_participation('pt-b466-2', NULL, 'm-b466-2', 'nat-b466', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.record_class_allocation('a-b466-reg', 'pt-b466-1', cls, '2026-02-01', 'ato', NULL, NULL);
  PERFORM public.record_class_allocation('a-b466-eja', 'pt-b466-2', cls, '2026-02-01', 'ato', NULL, NULL);
  -- Secretaria não constrói calendário nem norma (capacidade exata).
  BEGIN PERFORM public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'x', true, 'ato', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:construir-calendario-da-rede' THEN RAISE; END IF; END;

  -- Construção (Supervisão sintética) -----------------------------------------------------
  PERFORM set_config('request.jwt.claims', u_sup, true);
  tl := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Feriado (rótulo enganoso)', true, 'ato-t', NULL);
  tn := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Letivo (rótulo enganoso)', false, 'ato-t', NULL);
  tx := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Sem efeito', NULL, 'ato-t', NULL);
  -- "Regular": recorte da alocação reg (+ escola, multietapa = dois recortes do mesmo calendário). "EJA": alocação eja.
  ca := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-ca', NULL, '[]', jsonb_build_array(jsonb_build_object('starts_on','2026-02-01','ends_on','2026-12-15','day_type_version_id', tl->>'version_id')),
    jsonb_build_array(jsonb_build_object('starts_on','2026-04-21','ends_on','2026-04-21','label','Evento','day_type_version_id', tn->>'version_id')),
    jsonb_build_array(jsonb_build_object('day','2026-04-22','day_type_version_id', tx->>'version_id')),
    jsonb_build_array(jsonb_build_object('scope_key','reg-1','window_from','2026-02-01','window_until','2026-12-15','conditions',
                        jsonb_build_array(sa, '{"kind":"alocacao","allocation_logical_id":"a-b466-reg"}'::jsonb)),
                      jsonb_build_object('scope_key','reg-2','window_from','2026-02-01','window_until','2026-12-15','conditions',
                        jsonb_build_array('{"kind":"alocacao","allocation_logical_id":"a-b466-reg"}'::jsonb))));
  cb := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-cb', NULL, '[]', jsonb_build_array(jsonb_build_object('starts_on','2026-02-01','ends_on','2026-11-30','day_type_version_id', tn->>'version_id')),
    '[]', jsonb_build_array(jsonb_build_object('day','2026-12-01','day_type_version_id', tx->>'version_id')),
    jsonb_build_array(jsonb_build_object('scope_key','eja','window_from','2026-02-01','window_until','2026-12-15','conditions',
                        jsonb_build_array('{"kind":"alocacao","allocation_logical_id":"a-b466-eja"}'::jsonb))));

  -- Sem norma: homologação do calendário recusa sem gravar.
  BEGIN PERFORM public.homologate_calendar_version((ca->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-h', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-homologation:blocked-composition-norm-sem-norma' THEN RAISE; END IF; END;
  ok := ok || 'secretaria-cannot-build calendar-homologation-blocked-without-norm ';

  -- Norma: competência exata, forma estrita, configuração coerente -------------------------
  PERFORM set_config('request.jwt.claims', u_cal, true);
  BEGIN PERFORM public.record_calendar_composition_norm_version(NULL, NULL, 'constituicao', '2026-01-01', NULL, 'ato-n', NULL, 'exigir-exclusividade', '[]',
    '[{"dimensionId":"efeito-dia","effectPrimitive":"school_day_effect","effectContractVersion":1}]'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:construir-norma-composicao-calendario-da-rede' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', u_sup, true);
  BEGIN PERFORM public.record_calendar_composition_norm_version(NULL, NULL, 'constituicao', '2026-01-01', NULL, 'ato-n', NULL, 'exigir-exclusividade', '[]',
    '[{"dimensionId":"efeito-dia","effectPrimitive":"school_day_effect","effectContractVersion":1,"autorizado":true}]'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm:effect-binding-shape' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_calendar_composition_norm_version(NULL, NULL, 'constituicao', '2026-01-01', NULL, 'ato-n', NULL, 'exigir-exclusividade',
    '[{"dimensionId":"efeito-dia","operation":"exigir-concordancia","onAbsence":"indeterminado"}]', '[]'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm:configuration-incoerente:exclusividade-com-regras-de-dimensao' THEN RAISE; END IF; END;
  nv := public.record_calendar_composition_norm_version(NULL, NULL, 'constituicao', '2026-01-01', NULL, 'ato-n', NULL, 'exigir-exclusividade', '[]',
    '[{"dimensionId":"efeito-dia","effectPrimitive":"school_day_effect","effectContractVersion":1}]');
  -- Não homologada: demais autenticados não veem metadado; construtor vê.
  PERFORM set_config('request.jwt.claims', u_any, true);
  IF public.calendar_composition_norm_at('2026-04-01', clock_timestamp())->>'state' <> 'access-denied' THEN RAISE EXCEPTION 'norm-draft-visible'; END IF;
  PERFORM set_config('request.jwt.claims', u_cal, true);
  BEGIN PERFORM public.homologate_calendar_composition_norm((nv->>'versionId')::uuid, NULL, 'homologada', '2026-01-01', 'ato-hn', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:homologar-norma-composicao-calendario-da-rede' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', u_sup, true);
  r := public.calendar_composition_norm_at('2026-04-01', clock_timestamp());
  IF r->>'audience' <> 'norma' OR r->'versions'->0->>'state' <> 'nao-homologada' THEN RAISE EXCEPTION 'norm-builder-view %', r; END IF;
  nh := public.homologate_calendar_composition_norm((nv->>'versionId')::uuid, NULL, 'homologada', '2026-01-01', 'ato-hn', NULL);
  BEGIN PERFORM public.homologate_calendar_composition_norm((nv->>'versionId')::uuid, NULL, 'revogada', '2026-03-01', 'ato', 'motivo'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm-homologation:base-superseded' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT exercised_capability_id || '|' || recorded_by_person_id FROM calendar_composition_norm_homologations WHERE id = (nh->>'recordId')::uuid)
     IS DISTINCT FROM 'homologar-norma-composicao-calendario-da-rede|' || p1 THEN RAISE EXCEPTION 'norm-ledger'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_any, true);
  r := public.calendar_composition_norm_at('2026-04-01', clock_timestamp());
  IF r->>'audience' <> 'homologados' OR r->>'finalState' <> 'norma-homologada' OR r->'versions'->0->>'multiplicity' <> 'exigir-exclusividade' THEN RAISE EXCEPTION 'norm-public %', r; END IF;
  ok := ok || 'norm-cap-exact strict-shape exclusivity-coherent norm-draft-hidden norm-homologate-cap-exact base-expected norm-ledger norm-homologated-visible ';

  -- Homologação do calendário funcional --------------------------------------------------
  PERFORM set_config('request.jwt.claims', u_cal, true);
  BEGIN PERFORM public.homologate_calendar_version((ca->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-h', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:homologar-calendario-da-rede' THEN RAISE; END IF; END;
  -- Rascunho: anônimo-de-capacidade não vê; construtor vê estado.
  PERFORM set_config('request.jwt.claims', u_any, true);
  IF (SELECT result_kind FROM public.calendar_at(ca->>'calendar_id', '2026-04-01', clock_timestamp())) <> 'access-denied'
    OR (SELECT result_kind FROM public.calendar_at('cal-00000000-0000-0000-0000-000000000000', '2026-04-01', clock_timestamp())) <> 'access-denied'
    OR public.calendar_days_at(ca->>'calendar_id', '2026-04-01', '2026-04-02', clock_timestamp())->>'state' <> 'access-denied'
    OR jsonb_array_length(public.calendar_list_at(clock_timestamp())->'versions') <> 0
    OR public.calendar_day_types_at(clock_timestamp())->>'state' <> 'access-denied' THEN RAISE EXCEPTION 'draft-visible'; END IF;
  PERFORM set_config('request.jwt.claims', u_cal, true);
  IF (SELECT result_kind FROM public.calendar_at(ca->>'calendar_id', '2026-04-01', clock_timestamp())) <> 'nao-homologada'
    OR (SELECT result_kind FROM public.calendar_at('cal-00000000-0000-0000-0000-000000000000', '2026-04-01', clock_timestamp())) <> 'sem-versao-vigente'
    OR jsonb_array_length(public.calendar_list_at(clock_timestamp())->'versions') <> 2
    OR public.calendar_day_types_at(clock_timestamp())->>'state' <> 'lido' THEN RAISE EXCEPTION 'builder-view'; END IF;
  PERFORM set_config('request.jwt.claims', u_sup, true);
  _ha := public.homologate_calendar_version((ca->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-ha', NULL);
  PERFORM public.homologate_calendar_version((cb->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-hb', NULL);
  BEGIN PERFORM public.homologate_calendar_version((ca->>'version_id')::uuid, (_ha->>'recordId')::uuid, 'revogada', '2026-05-01', 'ato', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-homologation:reason-required' THEN RAISE; END IF; END;
  BEGIN PERFORM public.homologate_calendar_version((ca->>'version_id')::uuid, (_ha->>'recordId')::uuid, 'homologada', '2026-05-01', 'ato', 'x'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-homologation:repeated-decision' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT exercised_capability_id || '|' || recorded_by_person_id || '|' || recorded_via_engagement_id FROM calendar_version_homologations WHERE id = (_ha->>'recordId')::uuid)
     IS DISTINCT FROM 'homologar-calendario-da-rede|' || p1 || '|' || e1 THEN RAISE EXCEPTION 'cal-ledger'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  k1 := clock_timestamp();
  ok := ok || 'calendar-homologate-cap-exact draft-hidden-no-oracle builder-sees-draft calendar-homologated revoke-needs-reason repeated-decision ledger-audit ';

  -- Leitura de homologados por qualquer autenticado ------------------------------------------
  PERFORM set_config('request.jwt.claims', u_any, true);
  IF (SELECT result_kind FROM public.calendar_at(ca->>'calendar_id', '2026-04-01', k1)) <> 'homologada' THEN RAISE EXCEPTION 'homologated-read'; END IF;
  r := public.calendar_days_at(ca->>'calendar_id', '2026-01-30', '2026-02-01', k1);
  IF r->>'audience' <> 'homologados' OR r->'days'->0->>'state' <> 'nao-homologado-na-data' OR r->'days'->0 ? 'rows'
    OR r->'days'->2->>'state' <> 'homologada' THEN RAISE EXCEPTION 'days-read %', r; END IF;
  IF public.calendar_days_at(ca->>'calendar_id', '2026-01-01', '2027-03-01', k1)->>'detail' <> 'intervalo-maior-que-400-dias'
    OR public.calendar_days_at(ca->>'calendar_id', '2026-04-02', '2026-04-01', k1)->>'detail' <> 'intervalo-invertido'
    OR public.calendar_days_at(ca->>'calendar_id', '2026-04-01', '2026-04-01', clock_timestamp() + interval '1 hour')->>'detail' <> 'known-at-no-futuro'
  THEN RAISE EXCEPTION 'snapshot-validation'; END IF;
  -- Alocações: sem capacidade ⇒ mesma resposta que inexistente (sem oráculo).
  IF public.calendar_composed_days_at('a-b466-reg', '2026-04-01', '2026-04-01', k1) <> '{"contract":"b4.6.6/1","state":"access-denied"}'::jsonb
    OR public.calendar_composed_days_at('nao-existe', '2026-04-01', '2026-04-01', k1) <> '{"contract":"b4.6.6/1","state":"access-denied"}'::jsonb
  THEN RAISE EXCEPTION 'alloc-oracle'; END IF;
  PERFORM set_config('request.jwt.claims', u_sec, true);
  IF public.calendar_composed_days_at('nao-existe', '2026-04-01', '2026-04-01', k1) <> '{"contract":"b4.6.6/1","state":"access-denied"}'::jsonb THEN RAISE EXCEPTION 'alloc-oracle-2'; END IF;
  ok := ok || 'homologated-read-by-any-auth day-level-homologation batch-limits future-known-at alloc-no-oracle ';

  -- Efeito final no servidor (exclusividade) ----------------------------------------------
  r := public.calendar_composed_days_at('a-b466-reg', '2026-04-20', '2026-04-22', k1);
  IF r->>'authorizes' <> 'false' OR r->'days'->0->>'result' <> 'letivo' OR r->'days'->0->>'calendarId' <> ca->>'calendar_id'
    OR jsonb_array_length(r->'days'->0->'candidates') <> 1 OR jsonb_array_length(r->'days'->0->'candidates'->0->'scopes') <> 2
    OR r->'days'->1->>'result' <> 'conflito' OR r->'days'->1->'schoolDayEffect' <> 'null'::jsonb
    OR r->'days'->2->>'result' <> 'letivo' THEN RAISE EXCEPTION 'reg-days %', r; END IF;
  r := public.calendar_composed_days_at('a-b466-eja', '2026-04-20', '2026-04-20', k1);
  IF r->'days'->0->>'result' <> 'nao-letivo' OR r->'days'->0->>'calendarId' <> cb->>'calendar_id' OR (r->'days'->0->>'schoolDayEffect')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'eja-false %', r; END IF;
  r := public.calendar_composed_days_at('a-b466-eja', '2026-12-01', '2026-12-02', k1);
  IF r->'days'->0->>'result' <> 'efeito-nao-declarado' OR r->'days'->1->>'result' <> 'efeito-nao-declarado' THEN RAISE EXCEPTION 'eja-null %', r; END IF;
  r := public.calendar_composed_days_at('a-b466-reg', '2026-01-15', '2026-01-15', k1);
  IF r->'days'->0->>'result' <> 'contexto-indisponivel' THEN RAISE EXCEPTION 'out-of-alloc %', r; END IF;
  ok := ok || 'server-true server-false conflict-not-resolved null-not-false regular-eja-disjoint multistage-one-candidate context-gated ';

  -- Terceiro calendário de escola homologado ⇒ exclusividade violada; knownAt anterior preservado.
  PERFORM set_config('request.jwt.claims', u_sup, true);
  cc := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-cc', NULL, '[]', jsonb_build_array(jsonb_build_object('starts_on','2026-02-01','ends_on','2026-12-15','day_type_version_id', tl->>'version_id')),
    '[]', '[]', jsonb_build_array(jsonb_build_object('scope_key','escola','window_from','2026-02-01','window_until','2026-12-15','conditions', jsonb_build_array(sa))));
  PERFORM set_config('request.jwt.claims', u_sec, true);
  r := public.calendar_composed_days_at('a-b466-reg', '2026-04-20', '2026-04-20', clock_timestamp());
  IF r->'days'->0->>'result' <> 'letivo' OR jsonb_array_length(r->'days'->0->'candidates') <> 1 THEN RAISE EXCEPTION 'draft-not-operational %', r; END IF;
  PERFORM set_config('request.jwt.claims', u_sup, true);
  PERFORM public.homologate_calendar_version((cc->>'version_id')::uuid, NULL, 'homologada', '2026-02-01', 'ato-hc', NULL);
  k2 := clock_timestamp();
  PERFORM set_config('request.jwt.claims', u_sec, true);
  r := public.calendar_composed_days_at('a-b466-reg', '2026-04-20', '2026-04-20', k2);
  IF r->'days'->0->>'result' <> 'exclusividade-violada' OR jsonb_array_length(r->'days'->0->'candidates') <> 2 OR r->'days'->0 ? 'calendarId' THEN RAISE EXCEPTION 'exclusivity %', r; END IF;
  r := public.calendar_composed_days_at('a-b466-reg', '2026-04-20', '2026-04-20', k1);
  IF r->'days'->0->>'result' <> 'letivo' THEN RAISE EXCEPTION 'old-known-at %', r; END IF;
  ok := ok || 'draft-not-candidate exclusivity-violated-no-dominant old-known-at-preserved ';

  -- Anônimo: sem EXECUTE.
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  BEGIN PERFORM public.calendar_at(ca->>'calendar_id', '2026-04-01', k1); RAISE EXCEPTION 'x';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.calendar_composed_days_at('a-b466-reg', '2026-04-01', '2026-04-01', k1); RAISE EXCEPTION 'x';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('role', 'postgres', true);
  ok := ok || 'anon-no-execute ';

  RAISE EXCEPTION 'b466-tests-ok: %', ok;
END $t$;
