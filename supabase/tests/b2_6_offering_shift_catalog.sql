-- B2.6 — Oferta, Turno e Catálogos Institucionais.
-- Rodar após a migration B2.6 numa transação descartada (ROLLBACK ou RAISE final).
-- Asserções levantam exceção na falha. Nenhum dado oficial permanece.
DO $b26t$
DECLARE
  u_off text := '{"sub":"00000000-0000-0000-0000-0000000b2601","role":"authenticated"}';
  u_shf text := '{"sub":"00000000-0000-0000-0000-0000000b2602","role":"authenticated"}';
  u_both text := '{"sub":"00000000-0000-0000-0000-0000000b2603","role":"authenticated"}';
  u_none text := '{"sub":"00000000-0000-0000-0000-0000000b2604","role":"authenticated"}';
  u_cat text := '{"sub":"00000000-0000-0000-0000-0000000b2605","role":"authenticated"}';
  u_sec text := '{"sub":"00000000-0000-0000-0000-0000000b2606","role":"authenticated"}';
  u_other text := '{"sub":"00000000-0000-0000-0000-0000000b2607","role":"authenticated"}';
  pol uuid := '00000000-0000-0000-0000-0000000b26a0';
  cls text; cls_short text; o1 uuid; o2 uuid; s1 uuid; s2 uuid; v integer; t0 timestamptz; n integer;
  ok text := '';
BEGIN
  -- Fixture (privilegiado) ------------------------------------------------
  INSERT INTO public.institutional_persons(id, display_name)
  SELECT ('00000000-0000-0000-0000-0000000b25' || lpad(i::text, 2, '0'))::uuid, 'Pessoa ' || i FROM generate_series(1, 7) i;
  INSERT INTO public.user_person_links(user_id, person_id)
  SELECT ('00000000-0000-0000-0000-0000000b26' || lpad(i::text, 2, '0'))::uuid,
         ('00000000-0000-0000-0000-0000000b25' || lpad(i::text, 2, '0'))::uuid FROM generate_series(1, 7) i;
  INSERT INTO public.institutional_schools(id) VALUES ('esc-b26-a'), ('esc-b26-b');
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, official_name, active, valid_from, originating_act_ref)
  VALUES ('esc-b26-a', 1, 'Escola A', true, '2020-01-01', 'ato'), ('esc-b26-b', 1, 'Escola B', true, '2020-01-01', 'ato');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from) VALUES
    ('00000000-0000-0000-0000-0000000b2501', 'teste-b26-oferta', 'escola', 'esc-b26-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b2502', 'teste-b26-turno', 'escola', 'esc-b26-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b2503', 'teste-b26-oferta', 'escola', 'esc-b26-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b2503', 'teste-b26-turno', 'escola', 'esc-b26-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b2504', 'teste-b26-nada', 'escola', 'esc-b26-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b2505', 'cadastro-institucional-da-rede', 'rede', NULL, '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b2506', 'secretaria-escolar', 'escola', 'esc-b26-a', '2020-01-01'),
    ('00000000-0000-0000-0000-0000000b2507', 'teste-b26-oferta', 'escola', 'esc-b26-b', '2020-01-01');
  INSERT INTO public.institutional_academic_years(id) VALUES ('ano-b26');
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  SELECT 'ano-b26', 1, 'Ano', '2026-01-01', '2026-12-31', true, '2020-01-01', 'ato',
    '00000000-0000-0000-0000-0000000b2606', '00000000-0000-0000-0000-0000000b2506', e.id
  FROM public.institutional_engagements e WHERE e.person_id = '00000000-0000-0000-0000-0000000b2506';
  INSERT INTO public.capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-b26', 1, 'draft', '2020-01-01');
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'teste-b26-oferta', 'manter-organizacao-da-oferta-da-turma', ARRAY['school']),
    (pol, 'teste-b26-turno', 'manter-turno-da-turma', ARRAY['school']),
    (pol, 'cadastro-institucional-da-rede', 'manter-catalogos-institucionais', ARRAY['network']),
    (pol, 'secretaria-escolar', 'manter-cadastro-de-turmas', ARRAY['school']);
  UPDATE public.capability_policies SET status = 'homologated' WHERE id = pol;

  PERFORM set_config('role', 'authenticated', true);

  -- ACL ---------------------------------------------------------------------
  IF has_table_privilege('authenticated', 'public.class_shift_versions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.class_offering_versions', 'INSERT')
    OR has_table_privilege('authenticated', 'public.attribute_value_definitions', 'INSERT')
    OR has_table_privilege('sandbox_exec', 'public.class_shift_versions', 'INSERT')
    OR has_table_privilege('anon', 'public.class_offering_axis_values', 'SELECT')
  THEN RAISE EXCEPTION 'b26:direct-dml-present'; END IF;
  IF has_function_privilege('anon', 'public.record_class_shift_version(text,uuid,text,text,integer,date,date,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.record_attribute_value_version(text,text,integer,text,text,date,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.class_offering_at(text,date,timestamptz)', 'EXECUTE')
  THEN RAISE EXCEPTION 'b26:anon-execute-present'; END IF;
  ok := ok || ' ' || 'acl';

  -- Catálogo ----------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', u_cat, true);
  IF EXISTS (SELECT 1 FROM public.homologated_attribute_values('turno', '2026-03-01')) THEN RAISE EXCEPTION 'b26:catalog-not-empty'; END IF;
  ok := ok || ' ' || 'catalogo-vazio';
  BEGIN PERFORM public.record_attribute_value_version('turno', 'manha', NULL, 'Manhã', 'homologada', '2020-01-01', NULL, NULL);
    RAISE EXCEPTION 'b26:homologation-without-act';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%catalog:homologation-act-required%' THEN RAISE; END IF; END;
  ok := ok || ' ' || 'homologacao-sem-ato-recusada';
  v := public.record_attribute_value_version('turno', 'manha', NULL, 'Manhã', 'rascunho', '2020-01-01', NULL, NULL);
  IF v <> 1 THEN RAISE EXCEPTION 'b26:draft-version'; END IF;
  ok := ok || ' ' || 'rascunho';
  BEGIN PERFORM public.record_attribute_value_version('turno', 'manha', 0, 'x', 'rascunho', NULL, NULL, 'stale');
    RAISE EXCEPTION 'b26:stale-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%catalog:base-superseded%' THEN RAISE; END IF; END;
  v := public.record_attribute_value_version('turno', 'manha', 1, 'Manhã', 'homologada', '2020-01-01', 'ato-hom-1', 'homologação');
  IF v <> 2 OR (SELECT count(*) FROM public.attribute_value_definitions WHERE scheme_id = 'turno' AND value_id = 'manha') <> 2
  THEN RAISE EXCEPTION 'b26:versioning'; END IF;
  ok := ok || ' ' || 'versionamento' || 'homologacao-com-ato' || 'base-stale-recusada';
  PERFORM public.record_attribute_value_version('turno', 'tarde', NULL, 'Tarde', 'homologada', '2020-01-01', 'ato-hom-2', NULL);
  PERFORM public.record_attribute_value_version('turno', 'noite', NULL, 'Noite', 'rascunho', '2020-01-01', NULL, NULL);
  PERFORM public.record_attribute_value_version('etapa', 'e1', NULL, 'Etapa 1', 'homologada', '2020-01-01', 'ato-hom-3', NULL);
  PERFORM public.record_attribute_value_version('modalidade', 'm1', NULL, 'Modalidade 1', 'homologada', '2020-01-01', 'ato-hom-4', NULL);
  BEGIN UPDATE public.attribute_value_definitions SET label = 'x' WHERE scheme_id = 'turno';
    RAISE EXCEPTION 'b26:update-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'b26:%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', u_off, true);
  BEGIN PERFORM public.record_attribute_value_version('turno', 'x', NULL, 'X', 'rascunho', NULL, NULL, NULL);
    RAISE EXCEPTION 'b26:catalog-school-accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%catalog:network-capability-required%' THEN RAISE; END IF; END;
  ok := ok || ' ' || 'catalogo-exige-rede';

  -- Turma -------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', u_sec, true);
  cls := public.register_institutional_class('esc-b26-a', 'ano-b26', 'A', 'Turma A', 'ativa', '2026-01-01', '2026-12-31', 'ato-t');
  cls_short := public.register_institutional_class('esc-b26-a', 'ano-b26', 'B', 'Turma B', 'ativa', '2026-01-01', '2026-06-30', 'ato-t2');
  IF EXISTS (SELECT 1 FROM public.class_offering_at(cls, '2026-03-01')) OR EXISTS (SELECT 1 FROM public.class_shift_at(cls, '2026-03-01'))
  THEN RAISE EXCEPTION 'b26:zero'; END IF;
  ok := ok || ' ' || 'zero-resultado';

  -- Capacidades independentes ------------------------------------------------
  PERFORM set_config('request.jwt.claims', u_off, true);
  BEGIN PERFORM public.record_class_shift_version('s-x', NULL, cls, 'tarde', 1, '2026-02-01', NULL, NULL, 'a');
    RAISE EXCEPTION 'b26:offer-cap-wrote-shift';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%shift:school-capability-required%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', u_shf, true);
  BEGIN PERFORM public.record_class_offering_version('o-x', NULL, cls, '[{"scheme":"etapa","value":"e1","version":1}]', '2026-02-01', NULL, NULL, 'a');
    RAISE EXCEPTION 'b26:shift-cap-wrote-offer';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%offering:school-capability-required%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', u_none, true);
  BEGIN PERFORM public.record_class_shift_version('s-y', NULL, cls, 'tarde', 1, '2026-02-01', NULL, NULL, 'a');
    RAISE EXCEPTION 'b26:none-wrote';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%shift:school-capability-required%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', u_other, true);
  BEGIN PERFORM public.record_class_offering_version('o-y', NULL, cls, '[{"scheme":"etapa","value":"e1","version":1}]', '2026-02-01', NULL, NULL, 'a');
    RAISE EXCEPTION 'b26:other-school-wrote';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%offering:school-capability-required%' THEN RAISE; END IF; END;
  ok := ok || ' ' || 'capacidades-independentes' || 'escopo-escolar';

  -- Turno -------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', u_shf, true);
  BEGIN PERFORM public.record_class_shift_version('s-1', NULL, cls, 'tarde', 1, NULL, NULL, NULL, 'a');
    RAISE EXCEPTION 'b26:shift-null-from';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%shift:valid-from-required%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_shift_version('s-1', NULL, cls, 'noite', 1, '2026-02-01', NULL, NULL, 'a');
    RAISE EXCEPTION 'b26:draft-shift';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%shift:value-not-homologated%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_shift_version('s-1', NULL, cls, 'e1', 1, '2026-02-01', NULL, NULL, 'a');
    RAISE EXCEPTION 'b26:shift-other-scheme';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%shift:value-not-homologated%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_shift_version('s-1', NULL, cls, 'tarde', 1, '2025-12-01', NULL, NULL, 'a');
    RAISE EXCEPTION 'b26:shift-before-class';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%class-fact:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_shift_version('s-1', NULL, cls_short, 'tarde', 1, '2026-02-01', '2026-09-30', NULL, 'a');
    RAISE EXCEPTION 'b26:shift-after-class';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%class-fact:class-inactive-or-unavailable%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_class_shift_version('s-1', NULL, cls, 'tarde', 1, '2026-02-01', '2027-02-01', NULL, 'a');
    RAISE EXCEPTION 'b26:shift-after-year';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%class-fact:%' THEN RAISE; END IF; END;
  ok := ok || ' ' || 'valid-from-obrigatorio' || 'nao-homologado-recusado' || 'turno-so-scheme-turno' || 'vigencia-turma' || 'vigencia-ano';
  s1 := public.record_class_shift_version('s-1', NULL, cls, 'tarde', 1, '2026-02-01', NULL, NULL, 'ato-s1');
  BEGIN PERFORM public.record_class_shift_version('s-2', NULL, cls, 'tarde', 1, '2026-05-01', NULL, NULL, 'ato-s2');
    RAISE EXCEPTION 'b26:shift-overlap-other-logical';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%shift:overlap%' THEN RAISE; END IF; END;
  ok := ok || ' ' || 'overlap-entre-logicos';
  s2 := public.record_class_shift_version('s-2', s1, cls, 'manha', 2, '2026-07-01', NULL, 'troca', 'ato-troca');
  IF (SELECT value_id FROM public.class_shift_at(cls, '2026-03-01')) <> 'tarde'
    OR (SELECT value_id FROM public.class_shift_at(cls, '2026-08-01')) <> 'manha'
    OR (SELECT count(*) FROM public.class_shift_versions WHERE class_id = cls) <> 3
  THEN RAISE EXCEPTION 'b26:shift-switch'; END IF;
  BEGIN PERFORM public.record_class_shift_version('s-1', s1, cls, 'manha', 2, '2026-02-01', NULL, 'corr', 'a');
    RAISE EXCEPTION 'b26:stale-shift';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%shift:base-superseded%' THEN RAISE; END IF; END;
  ok := ok || ' ' || 'troca' || 'concorrencia-base-substituida';

  -- Oferta multi-eixo + bitemporal ----------------------------------------
  PERFORM set_config('request.jwt.claims', u_off, true);
  BEGIN PERFORM public.record_class_offering_version('o-1', NULL, cls, '[]', '2026-02-01', NULL, NULL, 'a');
    RAISE EXCEPTION 'b26:no-axis';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%offering:axis-required%' THEN RAISE; END IF; END;
  o1 := public.record_class_offering_version('o-1', NULL, cls,
    '[{"scheme":"etapa","value":"e1","version":1},{"scheme":"modalidade","value":"m1","version":1}]', '2026-02-01', NULL, NULL, 'ato-o1');
  IF (SELECT count(*) FROM public.class_offering_at(cls, '2026-03-01')) <> 2 THEN RAISE EXCEPTION 'b26:multi-axis'; END IF;
  ok := ok || ' ' || 'oferta-multi-eixo';
  RESET ROLE;
  -- Simula correção conhecida depois (transação posterior).
  t0 := now();
  INSERT INTO public.class_offering_versions(class_id, logical_id, version, supersedes_id, valid_from, valid_until, correction_reason, originating_act_ref, recorded_by, created_at)
  VALUES (cls, 'o-1', 2, o1, '2026-02-01', NULL, 'retificação', 'ato-corr', '00000000-0000-0000-0000-0000000b2601', t0 + interval '1 hour') RETURNING id INTO o2;
  INSERT INTO public.class_offering_axis_values VALUES (o2, 'etapa', 'e1', 1);
  PERFORM set_config('role', 'authenticated', true);
  IF (SELECT count(*) FROM public.class_offering_at(cls, '2026-03-01', t0)) <> 2
    OR (SELECT count(*) FROM public.class_offering_at(cls, '2026-03-01', t0 + interval '2 hours')) <> 1
    OR (SELECT count(*) FROM public.class_offering_at(cls, '2026-03-01')) <> 1
  THEN RAISE EXCEPTION 'b26:offering-bitemporal'; END IF;
  ok := ok || ' ' || 'bitemporal-antes-depois-da-correcao';

  RAISE EXCEPTION 'b26-tests-ok:%', ok;
END $b26t$;
