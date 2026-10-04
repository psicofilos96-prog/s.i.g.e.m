-- B4.6.5c — Evidência privada de composição (0031). Teste transacional real: termina em RAISE, nada persiste.
-- Sucesso = 'b465c-tests-ok: ...'. Fixtures 100% sintéticas; norma e homologações inseridas pelo DONO (não há writer).
-- Não representa norma institucional. Políticas reais v1/v2 continuam draft.
DO $t$
DECLARE
  u_sup text := '{"sub":"00000000-0000-0000-0000-00000b465c01","role":"authenticated"}';
  u_sec text := '{"sub":"00000000-0000-0000-0000-00000b465c04","role":"authenticated"}';
  p1 uuid := '00000000-0000-0000-0000-00000b465c91'; p4 uuid := '00000000-0000-0000-0000-00000b465c94';
  pol uuid := '00000000-0000-0000-0000-00000b465ca0';
  _yr text := 'ano-b465c'; _org text := 'org-b465c'; _per text := 'per-b465c';
  e1 uuid; cls text; tl jsonb; tn jsonb; tx jsonb; c1 jsonb; c2 jsonb; nv uuid; k0 timestamptz; k_pre timestamptz;
  ev jsonb; ok text := ''; _v1 integer; _v2 integer; sa jsonb := '{"kind":"escola","school_id":"esc-b465c-a"}';
  sig text := 'public.calendar_composition_evidence_at(date,timestamptz,text)';
BEGIN
  -- ACL ---------------------------------------------------------------------------------
  IF has_function_privilege('authenticated', sig, 'EXECUTE') OR has_function_privilege('anon', sig, 'EXECUTE')
    OR EXISTS (SELECT 1 FROM pg_proc WHERE oid = sig::regprocedure AND (prosecdef OR NOT coalesce(proconfig @> ARRAY['search_path=""'], false)))
  THEN RAISE EXCEPTION 'fn-acl'; END IF;
  IF has_table_privilege('authenticated', 'public.calendar_composition_norm_effect_bindings', 'SELECT')
    OR has_table_privilege('anon', 'public.calendar_composition_norm_effect_bindings', 'SELECT')
    OR has_table_privilege('authenticated', 'public.calendar_composition_norm_effect_bindings', 'INSERT')
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.calendar_composition_norm_effect_bindings'::regclass)
    OR EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calendar_composition_norm_effect_bindings')
  THEN RAISE EXCEPTION 'table-acl'; END IF;
  IF EXISTS (SELECT 1 FROM calendar_composition_norm_effect_bindings) OR EXISTS (SELECT 1 FROM calendar_composition_norms) THEN RAISE EXCEPTION 'seeded'; END IF;
  SELECT count(*) INTO _v1 FROM capability_policy_rules r JOIN capability_policies p ON p.id = r.policy_id WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 1;
  SELECT count(*) INTO _v2 FROM capability_policy_rules r JOIN capability_policies p ON p.id = r.policy_id WHERE p.logical_policy_id = 'politica-capacidades-diario' AND p.version = 2;
  IF _v1 <> 108 OR _v2 <> 119 OR EXISTS (SELECT 1 FROM capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND status <> 'draft')
  THEN RAISE EXCEPTION 'policy-state'; END IF;
  ok := ok || 'acl rls no-seed policy-draft ';

  -- Fixtures ------------------------------------------------------------------------------
  INSERT INTO institutional_persons(id, display_name) VALUES (p1,'S1'),(p4,'S4');
  INSERT INTO user_person_links(user_id, person_id) VALUES ((u_sup::jsonb->>'sub')::uuid, p1), ((u_sec::jsonb->>'sub')::uuid, p4);
  INSERT INTO institutional_schools(id) VALUES ('esc-b465c-a');
  INSERT INTO institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
    VALUES ('esc-b465c-a', 1, 'Escola A', true, '2020-01-01', 'ato');
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    (p1, 'teste-b465c-supervisao', 'rede', NULL, '2020-01-01'), (p4, 'secretaria-escolar', 'escola', 'esc-b465c-a', '2020-01-01');
  SELECT id INTO e1 FROM institutional_engagements WHERE person_id = p1;
  INSERT INTO capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b465c', 1, 'draft', '2020-01-01');
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'teste-b465c-supervisao', 'construir-calendario-da-rede', ARRAY['network']),
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
  INSERT INTO institutional_students(id, display_name) VALUES ('est-b465c-1','E1');
  INSERT INTO attribute_value_definitions(scheme_id, value_id, version, label, status, homologation_act_ref, valid_from) VALUES
    ('natureza-da-participacao-educacional', 'nat-b465c', 1, 'Natureza teste', 'homologada', 'ato', '2020-01-01');

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sec, true);
  cls := public.register_institutional_class('esc-b465c-a', _yr, 'A', 'Turma', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  PERFORM public.constitute_cycle_enrollment('m-b465c-1', 'est-b465c-1', 'esc-b465c-a', _yr, '2026-02-01', NULL, 'ato', NULL, NULL);
  PERFORM public.declare_cycle_participation('pt-b465c-1', NULL, 'm-b465c-1', 'nat-b465c', 1, '2026-02-01', NULL, 'ato', NULL);
  PERFORM public.record_class_allocation('a-b465c-1', 'pt-b465c-1', cls, '2026-02-01', 'ato', NULL, NULL);
  -- Cliente autenticado não alcança a evidência.
  BEGIN PERFORM public.calendar_composition_evidence_at('2026-04-01', clock_timestamp(), 'a-b465c-1'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM public.calendar_composition_norm_effect_bindings; RAISE EXCEPTION 'x';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claims', u_sup, true);
  -- Rótulos propositalmente enganosos: efeito vem só de school_day_effect.
  tl := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Feriado (rótulo enganoso)', true, 'ato-t', NULL);
  tn := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Letivo (rótulo enganoso)', false, 'ato-t', NULL);
  tx := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Efeito não declarado', NULL, 'ato-t', NULL);
  c1 := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-c1', NULL, '[]', jsonb_build_array(jsonb_build_object('starts_on','2026-02-01','ends_on','2026-12-15','day_type_version_id', tl->>'version_id')),
    jsonb_build_array(jsonb_build_object('starts_on','2026-04-21','ends_on','2026-04-21','label','Evento','day_type_version_id', tn->>'version_id')),
    jsonb_build_array(jsonb_build_object('day','2026-04-22','day_type_version_id', tx->>'version_id')),
    jsonb_build_array(jsonb_build_object('scope_key','esc-a','window_from','2026-02-01','window_until','2026-12-15','conditions', jsonb_build_array(sa)),
                      jsonb_build_object('scope_key','aloc-1','window_from','2026-02-01','window_until','2026-12-15','conditions',
                        jsonb_build_array(sa, '{"kind":"alocacao","allocation_logical_id":"a-b465c-1"}'::jsonb))));
  c2 := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15',
    'ato-c2', NULL, '[]', jsonb_build_array(jsonb_build_object('starts_on','2026-02-01','ends_on','2026-12-15','day_type_version_id', tl->>'version_id')),
    '[]', '[]',
    jsonb_build_array(jsonb_build_object('scope_key','eixo','window_from','2026-02-01','window_until','2026-12-15','conditions',
      jsonb_build_array('{"kind":"valor-de-eixo","scheme_id":"eixo-inexistente","value_id":"v","value_version":1}'::jsonb))));
  PERFORM set_config('role', 'postgres', true);
  ok := ok || 'fixtures-real-writers ';

  -- Sem norma: evidência devolve estado, nunca evidência inventada.
  k0 := clock_timestamp();
  ev := public.calendar_composition_evidence_at('2026-04-01', k0, 'a-b465c-1');
  IF ev->'norm' <> '{"state":"sem-norma"}'::jsonb THEN RAISE EXCEPTION 'no-norm %', ev->'norm'; END IF;
  IF ev->'context'->>'school' <> 'esc-b465c-a' OR ev->'context'->>'class' <> cls OR ev->'context'->>'axis' <> 'nao-derivado' THEN RAISE EXCEPTION 'ctx %', ev->'context'; END IF;
  -- Calendário 1 não homologado ⇒ linhas do dia carregam o estado (motor bloqueia). Mesmo calendário, dois recortes ⇒ UM candidato.
  IF jsonb_array_length(ev->'candidates') <> 1 OR jsonb_array_length(ev->'candidates'->0->'scopes') <> 2
    OR ev->'candidates'->0->>'calendarId' <> c1->>'calendar_id' THEN RAISE EXCEPTION 'cands %', ev->'candidates'; END IF;
  IF (ev->'candidates'->0->'dayRows'->0->>'homologation_state') = 'homologada' THEN RAISE EXCEPTION 'unhomologated-visible'; END IF;
  ok := ok || 'no-norm db-derived-context same-version-two-scopes-one-candidate axis-never-matches ';

  -- Homologação sintética do calendário 1 (dono).
  INSERT INTO calendar_version_homologations(calendar_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES ((c1->>'version_id')::uuid, 1, 'homologada', '2026-02-01', 'ato-h-sint', 'capacidade-sintetica', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  -- Norma sintética: exclusividade + vínculo explícito.
  INSERT INTO calendar_composition_norms(id) VALUES ('ccn-b465c');
  INSERT INTO calendar_composition_norm_versions(norm_id, version, change_kind, valid_from, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES ('ccn-b465c', 1, 'constituicao', '2026-01-01', 'ato-n-sint', (u_sup::jsonb->>'sub')::uuid, p1, e1) RETURNING id INTO nv;
  INSERT INTO calendar_composition_norm_multiplicity VALUES (nv, 'exigir-exclusividade');
  INSERT INTO calendar_composition_norm_effect_bindings(version_id, dimension_id, effect_primitive, effect_contract_version) VALUES (nv, 'efeito-dia', 'school_day_effect', 1);
  BEGIN INSERT INTO calendar_composition_norm_effect_bindings(version_id, dimension_id, effect_primitive, effect_contract_version) VALUES (nv, 'outra', 'school_day_effect', 1); RAISE EXCEPTION 'x';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN INSERT INTO calendar_composition_norm_effect_bindings(version_id, dimension_id, effect_primitive, effect_contract_version) VALUES (nv, 'cor', 'cor_do_dia', 1); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO calendar_composition_norm_configuration_records(version_id) VALUES (nv);
  BEGIN INSERT INTO calendar_composition_norm_effect_bindings(version_id, dimension_id, effect_primitive, effect_contract_version) VALUES (nv, 'tarde', 'school_day_effect', 1); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'composition-norm:configuration-already-recorded' THEN RAISE; END IF; END;
  BEGIN UPDATE calendar_composition_norm_effect_bindings SET dimension_id = 'x' WHERE version_id = nv; RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'x' THEN RAISE; END IF; END;
  INSERT INTO calendar_composition_norm_homologations(version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES (nv, 1, 'homologada', '2026-01-01', 'ato-hn-sint', 'capacidade-sintetica', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  ok := ok || 'binding-unique binding-closed-primitive binding-closed-after-record binding-immutable ';

  ev := public.calendar_composition_evidence_at('2026-04-01', clock_timestamp(), 'a-b465c-1');
  IF ev->'norm'->>'state' <> 'norma-homologada' OR ev->'norm'->'effectBindings' <> '[{"dimensionId":"efeito-dia","effectPrimitive":"school_day_effect","effectContractVersion":1}]'::jsonb
    OR ev->'norm'->'configuration'->>'multiplicity' <> 'exigir-exclusividade' THEN RAISE EXCEPTION 'norm-ev %', ev->'norm'; END IF;
  IF ev->'candidates'->0->'dayRows'->0->>'homologation_state' <> 'homologada' OR (ev->'candidates'->0->'dayRows'->0->>'school_day_effect')::boolean IS NOT TRUE
    OR ev->'candidates'->0->'dayRows'->0->>'day_type_label' <> 'Feriado (rótulo enganoso)' THEN RAISE EXCEPTION 'day-rows %', ev->'candidates'; END IF;
  -- 21/04: faixa true + evento false ⇒ conflito (as duas declarações chegam); 22/04: efeito NULL preservado (não false).
  ev := public.calendar_composition_evidence_at('2026-04-21', clock_timestamp(), 'a-b465c-1');
  IF jsonb_array_length(ev->'candidates'->0->'dayRows') <> 2 OR ev->'candidates'->0->'dayRows'->0->>'day_state' <> 'conflito-sem-regra' THEN RAISE EXCEPTION 'conflict %', ev; END IF;
  ev := public.calendar_composition_evidence_at('2026-04-22', clock_timestamp(), 'a-b465c-1');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(ev->'candidates'->0->'dayRows') r WHERE r->'school_day_effect' = 'null'::jsonb) THEN RAISE EXCEPTION 'null-effect %', ev; END IF;
  ok := ok || 'homologated-synthetic-norm-evidence label-not-effect conflict-preserved null-preserved ';

  -- knownAt anterior à norma: sem norma; anterior à alocação: contexto desconhecido.
  ev := public.calendar_composition_evidence_at('2026-04-01', k0, 'a-b465c-1');
  IF ev->'norm' <> '{"state":"sem-norma"}'::jsonb THEN RAISE EXCEPTION 'past-known %', ev->'norm'; END IF;
  k_pre := now() - interval '1 second';
  ev := public.calendar_composition_evidence_at('2026-04-01', k_pre, 'a-b465c-1');
  IF ev->'context'->>'state' <> 'alocacao-desconhecida-no-instante' OR ev ? 'candidates' THEN RAISE EXCEPTION 'pre-alloc %', ev; END IF;
  -- Fora da vigência da alocação / alocação inexistente / snapshot nulo.
  ev := public.calendar_composition_evidence_at('2026-01-15', clock_timestamp(), 'a-b465c-1');
  IF ev->'context'->>'state' <> 'alocacao-fora-de-vigencia-na-data' THEN RAISE EXCEPTION 'out-of-validity %', ev; END IF;
  ev := public.calendar_composition_evidence_at('2026-04-01', clock_timestamp(), 'nao-existe');
  IF ev->'context'->>'state' <> 'alocacao-desconhecida-no-instante' THEN RAISE EXCEPTION 'unknown-alloc'; END IF;
  BEGIN PERFORM public.calendar_composition_evidence_at(NULL, clock_timestamp(), 'a-b465c-1'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-composition-evidence:snapshot-and-allocation-required' THEN RAISE; END IF; END;
  ok := ok || 'known-at-past-no-future context-unknown-before-fact allocation-validity unknown-allocation snapshot-required ';

  -- Leitores públicos continuam negados; homologação de calendário continua bloqueada pelo writer.
  IF EXISTS (SELECT 1 FROM public.calendar_at(c1->>'calendar_id', '2026-04-01', clock_timestamp()) r WHERE r.result_kind <> 'access-denied') THEN RAISE EXCEPTION 'reader-open'; END IF;
  ok := ok || 'public-readers-denied ';

  RAISE EXCEPTION 'b465c-tests-ok: %', ok;
END $t$;
