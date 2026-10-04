-- B4.6.4e — Revalidação bitemporal das referências dos recortes na resolução. Teste transacional real: termina em RAISE,
-- nada persiste. Sucesso = 'b464e-tests-ok: ...'. Permissões positivas só por política SINTÉTICA dentro do teste;
-- v1/v2 reais continuam draft. IDs, nomes, catálogos e datas são fictícios e não representam norma.
-- Simulação de conhecimento posterior: vários writers gravam created_at = now() (instante da TRANSAÇÃO), então todas as
-- correções do teste teriam o mesmo instante dos fatos originais. Para provar knownAt distintos, o dono desliga os
-- triggers de usuário só dentro desta transação e desloca o instante de gravação das CORREÇÕES para now()+1h;
-- K0 (antes) = clock_timestamp() após os fatos originais, K1 (depois) = now()+2h. Tudo é revertido no RAISE final.
DO $t$
DECLARE
  u_sup text := '{"sub":"00000000-0000-0000-0000-00000b464e01","role":"authenticated"}';
  u_bld text := '{"sub":"00000000-0000-0000-0000-00000b464e02","role":"authenticated"}';
  u_sec text := '{"sub":"00000000-0000-0000-0000-00000b464e04","role":"authenticated"}';
  p1 uuid := '00000000-0000-0000-0000-00000b464e91'; p2 uuid := '00000000-0000-0000-0000-00000b464e92';
  p4 uuid := '00000000-0000-0000-0000-00000b464e94'; pol uuid := '00000000-0000-0000-0000-00000b464ea0';
  sig_res text := 'public.calendar_applicability_candidates(date,timestamptz,text,text,text,jsonb)';
  _yr text := 'ano-b464e'; _org text := 'org-b464e'; _per text := 'per-b464e';
  e1 uuid; cls text; cls_x text; t jsonb; c1 jsonb; c2 jsonb; k0 timestamptz; k1 timestamptz; k_pre timestamptz;
  ok text := ''; n integer; m integer; s text; _v1 integer; _v2 integer; d date; ctx_a text; ctx_p text; k text; want text; kn text;
  _sc integer; _cn integer; _wn integer; pos_id uuid; a3_id text; cond public.calendar_version_applicability_conditions;
  sa jsonb := '{"kind":"escola","school_id":"esc-b464e-a"}'; sb jsonb := '{"kind":"escola","school_id":"esc-b464e-b"}';
BEGIN
  -- ACL e estado das políticas -------------------------------------------------------
  IF has_function_privilege('authenticated', sig_res, 'EXECUTE') OR has_function_privilege('anon', sig_res, 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.calendar_allocation_state_at(text,text,text,date,timestamptz)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.calendar_allocation_state_at(text,text,text,date,timestamptz)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.calendar_condition_state_at(calendar_version_applicability_conditions,text,text,text,date,timestamptz)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.calendar_condition_state_at(calendar_version_applicability_conditions,text,text,text,date,timestamptz)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.calendar_year_state_at(text,date,timestamptz)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.calendar_year_state_at(text,date,timestamptz)', 'EXECUTE')
  THEN RAISE EXCEPTION 'acl'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace WHERE ns.nspname = 'public'
             AND p.proname IN ('calendar_applicability_candidates','calendar_allocation_state_at','calendar_condition_state_at','calendar_year_state_at')
             AND (p.prosecdef OR NOT coalesce(p.proconfig @> ARRAY['search_path=""'], false)))
  THEN RAISE EXCEPTION 'invoker-search-path'; END IF;
  SELECT count(*) INTO _v1 FROM capability_policy_rules r JOIN capability_policies p ON p.id = r.policy_id
    WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 1;
  SELECT count(*) INTO _v2 FROM capability_policy_rules r JOIN capability_policies p ON p.id = r.policy_id
    WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 2;
  IF _v1 <> 108 OR _v2 <> 119
    OR EXISTS (SELECT 1 FROM capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND status <> 'draft')
  THEN RAISE EXCEPTION 'policy-state % %', _v1, _v2; END IF;
  ok := ok || 'acl invoker policy-draft ';

  -- Fixtures fictícias -----------------------------------------------------------------
  INSERT INTO institutional_persons(id, display_name) VALUES (p1,'S1'),(p2,'S2'),(p4,'S4');
  INSERT INTO user_person_links(user_id, person_id) VALUES
    ((u_sup::jsonb->>'sub')::uuid, p1), ((u_bld::jsonb->>'sub')::uuid, p2), ((u_sec::jsonb->>'sub')::uuid, p4);
  INSERT INTO institutional_schools(id) VALUES ('esc-b464e-a'), ('esc-b464e-b');
  INSERT INTO institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref) VALUES
    ('esc-b464e-a', 1, 'Escola A', true, '2020-01-01', 'ato'), ('esc-b464e-b', 1, 'Escola B', true, '2020-01-01', 'ato');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    (p1, 'teste-b464e-supervisao', 'rede', NULL, '2020-01-01'),
    (p2, 'teste-b464e-so-construir', 'rede', NULL, '2020-01-01'),
    (p4, 'secretaria-escolar', 'escola', 'esc-b464e-a', '2020-01-01');
  SELECT id INTO e1 FROM institutional_engagements WHERE person_id = p1;
  INSERT INTO capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b464e', 1, 'draft', '2020-01-01');
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'teste-b464e-supervisao', 'construir-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b464e-supervisao', 'homologar-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-b464e-so-construir', 'construir-calendario-da-rede', ARRAY['network']),
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']),
    (pol, 'secretaria-escolar', 'manter-matricula-e-enturmacao', ARRAY['school']),
    (pol, 'secretaria-escolar', 'consultar-matricula-e-movimentacao', ARRAY['school']);
  UPDATE capability_policies SET status = 'homologated' WHERE id = pol;
  INSERT INTO institutional_academic_years(id) VALUES (_yr), ('ano-b464e-x');
  INSERT INTO institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id) VALUES
    (_yr, 1, 'Ano ficticio', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1),
    ('ano-b464e-x', 1, 'Outro ano', '2027-01-01', '2027-12-31', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_period_organizations(id, academic_year_id) VALUES (_org, _yr);
  INSERT INTO institutional_period_organization_versions(organization_id, version, official_name, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_org, 1, 'Org', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_academic_periods(id, academic_year_id, label, starts_on, ends_on, period_organization_id)
    VALUES (_per, _yr, 'P1', '2026-02-01', '2026-06-30', _org);
  INSERT INTO institutional_academic_period_versions(period_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_per, 1, 'P1', '2026-02-01', '2026-06-30', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_students(id, display_name) VALUES ('est-b464e-1','E1'),('est-b464e-2','E2'),('est-b464e-3','E3'),('est-b464e-4','E4');
  INSERT INTO attribute_value_definitions(scheme_id, value_id, version, label, status, homologation_act_ref, valid_from) VALUES
    ('natureza-da-participacao-educacional', 'nat-b464e', 1, 'Natureza teste', 'homologada', 'ato', '2020-01-01'),
    ('eixo-b464e-a', 'val-1', 1, 'V1', 'homologada', 'ato', '2020-01-01'),
    ('eixo-b464e-a', 'val-2', 1, 'V2', 'homologada', 'ato', '2020-01-01');

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  cls := public.register_institutional_class('esc-b464e-a', _yr, 'A', 'Turma multietapa', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  -- a1: posição val-1 (será anulada); a2: será encerrada em 15/04; a3: será corrigida para começar em 01/06; a4: posição val-2.
  FOR n IN 1..4 LOOP
    PERFORM public.constitute_cycle_enrollment('m-b464e-' || n, 'est-b464e-' || n, 'esc-b464e-a', _yr, '2026-02-01', NULL, 'ato', NULL, NULL);
    PERFORM public.declare_cycle_participation('pt-b464e-' || n, NULL, 'm-b464e-' || n, 'nat-b464e', 1, '2026-02-01', NULL, 'ato', NULL);
    PERFORM public.record_class_allocation('a-b464e-' || n, 'pt-b464e-' || n, cls, '2026-02-01', 'ato', NULL, NULL);
  END LOOP;
  PERFORM public.record_allocation_curricular_position('pos-b464e-1', NULL, 'a-b464e-1', '2026-02-01', NULL,
    '[{"scheme":"eixo-b464e-a","value":"val-1","version":1}]', 'ato', NULL);
  PERFORM public.record_allocation_curricular_position('pos-b464e-4', NULL, 'a-b464e-4', '2026-02-01', NULL,
    '[{"scheme":"eixo-b464e-a","value":"val-2","version":1}]', 'ato', NULL);
  PERFORM set_config('request.jwt.claims', u_sup, true);
  t := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Letivo ficticio', true, 'ato-t', NULL);
  PERFORM set_config('request.jwt.claims', u_bld, true);
  c1 := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-c1', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(
      jsonb_build_object('scope_key','esc-a','window_from','2026-02-01','window_until','2026-12-15','conditions', jsonb_build_array(sa)),
      jsonb_build_object('scope_key','aloc-1','window_from','2026-02-01','window_until','2026-12-15','conditions', jsonb_build_array(sa,
        '{"kind":"alocacao","allocation_logical_id":"a-b464e-1"}'::jsonb, '{"kind":"posicao-curricular","position_logical_id":"pos-b464e-1"}'::jsonb)),
      jsonb_build_object('scope_key','aloc-2','window_from','2026-02-01','window_until','2026-12-15','conditions', jsonb_build_array(sa,
        '{"kind":"alocacao","allocation_logical_id":"a-b464e-2"}'::jsonb)),
      jsonb_build_object('scope_key','aloc-3','window_from','2026-02-01','window_until','2026-12-15','conditions', jsonb_build_array(sa,
        '{"kind":"alocacao","allocation_logical_id":"a-b464e-3"}'::jsonb)),
      jsonb_build_object('scope_key','pos-4','window_from','2026-02-01','window_until','2026-05-31','conditions', jsonb_build_array(sa,
        '{"kind":"posicao-curricular","position_logical_id":"pos-b464e-4"}'::jsonb)),
      jsonb_build_object('scope_key','val-1','window_from','2026-02-01','window_until','2026-12-15','conditions', jsonb_build_array(sa,
        '{"kind":"valor-de-eixo","scheme_id":"eixo-b464e-a","value_id":"val-1","value_version":1}'::jsonb)),
      jsonb_build_object('scope_key','esc-b','window_from','2026-02-01','window_until','2026-12-15','conditions', jsonb_build_array(sb))));
  RESET ROLE;
  -- Origem antiga sem janela (writer 0025/0026, só o dono ainda executa).
  c2 := public.record_calendar_version_with_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-c2', NULL, '[]', '[]', '[]', '[]', jsonb_build_array(jsonb_build_object('scope_key','legado-a','conditions', jsonb_build_array(sa))));
  SELECT count(*) INTO _sc FROM calendar_version_applicability_scopes;
  SELECT count(*) INTO _cn FROM calendar_version_applicability_conditions;
  SELECT count(*) INTO _wn FROM calendar_version_applicability_scope_windows;
  PERFORM pg_sleep(0.01);
  k0 := clock_timestamp();
  PERFORM pg_sleep(0.01);

  -- Correções posteriores (writers reais, papel authenticated) -------------------------------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  SELECT id INTO pos_id FROM allocation_curricular_positions WHERE position_logical_id = 'pos-b464e-1';
  PERFORM public.record_allocation_curricular_position('pos-b464e-1', pos_id, 'a-b464e-1', NULL, NULL, NULL, 'ato-anul', 'anulacao ficticia', true);
  PERFORM public.record_class_allocation_ending('a-b464e-2', NULL, '2026-04-15', 'saida ficticia', 'ato-fim', NULL);
  SELECT id INTO a3_id FROM class_enrollment_episodes WHERE logical_id = 'a-b464e-3';
  PERFORM public.record_class_allocation('a-b464e-3-v2', 'pt-b464e-3', cls, '2026-06-01', 'ato-corr', a3_id, 'inicio corrigido');
  RESET ROLE;
  IF (SELECT count(DISTINCT logical_id) FROM class_enrollment_episodes WHERE logical_id = 'a-b464e-3') <> 1
    OR (SELECT count(*) FROM class_enrollment_episodes WHERE logical_id = 'a-b464e-3') <> 2
  THEN RAISE EXCEPTION 'correction-shape'; END IF;
  INSERT INTO institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
    VALUES ('esc-b464e-b', 2, 'Escola B', false, '2026-05-01', 'ato-inativa');
  INSERT INTO attribute_value_definitions(scheme_id, value_id, version, label, status, homologation_act_ref, valid_from)
    VALUES ('eixo-b464e-a', 'val-1', 2, 'V1', 'rascunho', 'ato-rev', '2026-05-01');
  -- Deslocamento do instante de gravação das correções (ver cabeçalho).
  ALTER TABLE class_enrollment_episodes DISABLE TRIGGER USER;
  ALTER TABLE class_allocation_ending_versions DISABLE TRIGGER USER;
  ALTER TABLE allocation_curricular_positions DISABLE TRIGGER USER;
  ALTER TABLE institutional_school_record_versions DISABLE TRIGGER USER;
  ALTER TABLE attribute_value_definitions DISABLE TRIGGER USER;
  UPDATE class_enrollment_episodes SET created_at = now() + interval '1 hour' WHERE id = 'a-b464e-3-v2';
  UPDATE class_allocation_ending_versions SET created_at = now() + interval '1 hour' WHERE allocation_logical_id = 'a-b464e-2';
  UPDATE allocation_curricular_positions SET created_at = now() + interval '1 hour' WHERE position_logical_id = 'pos-b464e-1' AND version = 2;
  UPDATE institutional_school_record_versions SET registered_at = now() + interval '1 hour' WHERE school_id = 'esc-b464e-b' AND version_number = 2;
  UPDATE attribute_value_definitions SET created_at = now() + interval '1 hour' WHERE scheme_id = 'eixo-b464e-a' AND value_id = 'val-1' AND version = 2;
  ALTER TABLE class_enrollment_episodes ENABLE TRIGGER USER;
  ALTER TABLE class_allocation_ending_versions ENABLE TRIGGER USER;
  ALTER TABLE allocation_curricular_positions ENABLE TRIGGER USER;
  ALTER TABLE institutional_school_record_versions ENABLE TRIGGER USER;
  ALTER TABLE attribute_value_definitions ENABLE TRIGGER USER;
  k1 := now() + interval '2 hours';
  ok := ok || 'fixtures corrections-by-real-writers ';

  -- Antes × depois da correção (mesma data, knownAt distintos) ----------------------------------
  FOR d, ctx_a, ctx_p, s, kn, k, want IN SELECT * FROM (VALUES
    -- posição anulada
    ('2026-04-01'::date, 'a-b464e-1', 'pos-b464e-1', 'esc-b464e-a', 'k0', 'aloc-1', 'candidato'),
    ('2026-04-01', 'a-b464e-1', 'pos-b464e-1', 'esc-b464e-a', 'k1', 'aloc-1', 'referencia-invalida:posicao-anulada'),
    -- encerramento da alocação (fim inclusivo)
    ('2026-05-01', 'a-b464e-2', NULL, 'esc-b464e-a', 'k0', 'aloc-2', 'candidato'),
    ('2026-05-01', 'a-b464e-2', NULL, 'esc-b464e-a', 'k1', 'aloc-2', 'referencia-invalida:alocacao-encerrada-na-data'),
    ('2026-04-15', 'a-b464e-2', NULL, 'esc-b464e-a', 'k1', 'aloc-2', 'candidato'),
    ('2026-04-16', 'a-b464e-2', NULL, 'esc-b464e-a', 'k1', 'aloc-2', 'referencia-invalida:alocacao-encerrada-na-data'),
    -- correção do início da alocação
    ('2026-05-01', 'a-b464e-3', NULL, 'esc-b464e-a', 'k0', 'aloc-3', 'candidato'),
    ('2026-05-01', 'a-b464e-3', NULL, 'esc-b464e-a', 'k1', 'aloc-3', 'referencia-invalida:alocacao-fora-de-vigencia-na-data'),
    ('2026-06-01', 'a-b464e-3', NULL, 'esc-b464e-a', 'k1', 'aloc-3', 'candidato'),
    -- inativação posterior da escola
    ('2026-05-02', NULL, NULL, 'esc-b464e-b', 'k0', 'esc-b', 'candidato'),
    ('2026-05-02', NULL, NULL, 'esc-b464e-b', 'k1', 'esc-b', 'referencia-invalida:escola-inativa-na-data'),
    ('2026-04-30', NULL, NULL, 'esc-b464e-b', 'k1', 'esc-b', 'candidato'),
    -- valor fixado perde homologação vigente
    ('2026-05-02', NULL, NULL, 'esc-b464e-a', 'k0', 'val-1', 'candidato'),
    ('2026-05-02', NULL, NULL, 'esc-b464e-a', 'k1', 'val-1', 'referencia-invalida:valor-sem-homologacao-vigente-na-data'),
    ('2026-04-30', NULL, NULL, 'esc-b464e-a', 'k1', 'val-1', 'candidato'),
    -- limite inclusivo da janela (multietapa: posição val-2)
    ('2026-05-31', 'a-b464e-4', 'pos-b464e-4', 'esc-b464e-a', 'k1', 'pos-4', 'candidato'),
    ('2026-06-01', 'a-b464e-4', 'pos-b464e-4', 'esc-b464e-a', 'k1', 'pos-4', 'ausente')
  ) v(d, a, p, sch, kn, k, w) LOOP
    SELECT count(*), max(resolution) INTO n, want FROM (SELECT want) z, LATERAL (SELECT 1) y WHERE false; -- reset
    SELECT count(*), max(r.resolution) INTO n, s FROM public.calendar_applicability_candidates(d,
      CASE kn WHEN 'k0' THEN k0 ELSE k1 END, s, ctx_a, ctx_p,
      CASE k WHEN 'val-1' THEN '[{"scheme":"eixo-b464e-a","value":"val-1","version":1}]'::jsonb ELSE '[]'::jsonb END) r
      WHERE r.scope_key = k;
    NULL;
  END LOOP;
  RAISE EXCEPTION 'unreachable-placeholder';
END $t$;
