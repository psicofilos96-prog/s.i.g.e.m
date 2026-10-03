-- B4.2.3 — teste transacional: termina em RAISE (rollback), nada persiste.
DO $t$
DECLARE
  _sch text := 'sch-' || gen_random_uuid()::text; _yr text := 'yr-' || gen_random_uuid()::text;
  _k1 text := 'cls-' || gen_random_uuid()::text; _k2 text := 'cls-' || gen_random_uuid()::text; _k3 text := 'cls-' || gen_random_uuid()::text;
  _mh text := 'mat-' || gen_random_uuid()::text; _mn text := 'mat-' || gen_random_uuid()::text; _mz text := 'mat-' || gen_random_uuid()::text;
  _a1 text := 'csa-' || gen_random_uuid()::text; _a2 text := 'csa-' || gen_random_uuid()::text;
  _a3 text := 'csa-' || gen_random_uuid()::text; _a4 text := 'csa-' || gen_random_uuid()::text; _a5 text := 'csa-' || gen_random_uuid()::text;
  _mvh uuid; _mvn uuid; _v1 uuid; _v1r uuid; _v2 uuid; _v3 uuid; _v4 uuid; _v5 uuid;
  _t0 timestamptz; _t1 timestamptz; _s text; _n integer; _ok text := '';
  _e uuid := gen_random_uuid(); _u uuid := gen_random_uuid(); _on date := DATE '2026-03-01';
BEGIN
  -- ACL / RLS / ausência de writer / zero linhas
  IF has_table_privilege('anon','public.class_specific_matrix_association_versions','SELECT') THEN RAISE EXCEPTION 'acl anon'; END IF;
  IF has_table_privilege('authenticated','public.class_specific_matrix_associations','INSERT')
    OR has_table_privilege('authenticated','public.class_specific_matrix_association_versions','INSERT')
    OR has_table_privilege('authenticated','public.class_specific_matrix_association_homologations','INSERT')
    OR has_table_privilege('authenticated','public.class_specific_matrix_association_versions','UPDATE') THEN RAISE EXCEPTION 'acl dml'; END IF;
  IF has_function_privilege('anon','public.class_specific_matrix_associations_at(date, timestamptz)','EXECUTE')
    OR has_function_privilege('anon','public.resolve_class_specific_matrix_association_at(text, date, timestamptz)','EXECUTE')
    OR has_function_privilege('authenticated','public.guard_class_specific_association_version_chain()','EXECUTE') THEN RAISE EXCEPTION 'acl exec'; END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname LIKE 'class_specific_matrix_association%' AND relkind='r' AND NOT relrowsecurity) THEN RAISE EXCEPTION 'rls'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname ~ '^(record|homologate|create)_.*(specific|association)') THEN RAISE EXCEPTION 'writer exists'; END IF;
  IF (SELECT bool_or(prosecdef) FROM pg_proc WHERE proname IN ('class_specific_matrix_associations_at','resolve_class_specific_matrix_association_at')) THEN RAISE EXCEPTION 'definer'; END IF;
  IF (SELECT count(*) FROM public.class_specific_matrix_association_versions) <> 0 THEN RAISE EXCEPTION 'pre-rows'; END IF;
  _ok := _ok || 'acl ';

  -- fixtures fictícias: escola, ano, 3 turmas; matriz H (homologada, col-a), N (não homologada), Z (sem versão)
  INSERT INTO public.institutional_schools(id) VALUES (_sch);
  INSERT INTO public.institutional_academic_years(id) VALUES (_yr);
  INSERT INTO public.institutional_classes(id, school_id, school_label_snapshot, academic_year_id, academic_year_label, name, valid_from)
  VALUES (_k1, _sch, 'E', _yr, 'A', 'T1', DATE '2026-01-01'), (_k2, _sch, 'E', _yr, 'A', 'T2', DATE '2026-01-01'), (_k3, _sch, 'E', _yr, 'A', 'T3', DATE '2026-01-01');
  INSERT INTO public.institutional_curricular_matrices(id) VALUES (_mh), (_mn), (_mz);
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_mh, 1, 'constituicao', 'Matriz especifica ficticia', DATE '2026-01-01', 'ato-mh', _u, _e) RETURNING id INTO _mvh;
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_mn, 1, 'constituicao', 'Matriz nao homologada ficticia', DATE '2026-01-01', 'ato-mn', _u, _e) RETURNING id INTO _mvn;
  INSERT INTO public.curricular_matrix_layouts(matrix_version_id, source_locator) VALUES (_mvh, 'fonte-ficticia');
  INSERT INTO public.curricular_matrix_layout_columns(matrix_version_id, column_key, position, header_text) VALUES (_mvh, 'col-a', 0, 'A');
  INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_mvh, 1, 'homologada', DATE '2026-01-01', 'ato-hm', 'cap-ficticia', _u, _e);

  -- ausência
  IF EXISTS (SELECT 1 FROM public.resolve_class_specific_matrix_association_at(_k1, _on, clock_timestamp())) THEN RAISE EXCEPTION 'ausencia'; END IF;
  BEGIN PERFORM * FROM public.resolve_class_specific_matrix_association_at(NULL, _on, clock_timestamp()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'association:class-required' THEN RAISE; END IF; END;
  _ok := _ok || 'ausencia ';

  -- rascunho sem column_key (válido) não resolve
  INSERT INTO public.class_specific_matrix_associations(id, class_id) VALUES (_a1, _k1), (_a2, _k2), (_a3, _k2), (_a4, _k3), (_a5, _k3);
  INSERT INTO public.class_specific_matrix_association_versions(association_id, version, change_kind, valid_from, target_matrix_id, specific_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_a1, 1, 'constituicao', DATE '2026-01-01', _mh, 'ato-especifico-ficticio', _u, _e) RETURNING id INTO _v1;
  BEGIN INSERT INTO public.class_specific_matrix_association_versions(association_id, version, change_kind, valid_from, target_matrix_id, specific_act_ref, recorded_by, recorded_via_engagement_id)
    VALUES (_a2, 1, 'constituicao', DATE '2026-01-01', _mh, ' ', _u, _e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  _t0 := clock_timestamp();
  IF (SELECT homologation_state FROM public.class_specific_matrix_associations_at(_on, _t0) WHERE association_id = _a1) <> 'nao-homologada' THEN RAISE EXCEPTION 'rascunho estado'; END IF;
  IF EXISTS (SELECT 1 FROM public.resolve_class_specific_matrix_association_at(_k1, _on, _t0)) THEN RAISE EXCEPTION 'rascunho resolvido'; END IF;
  _ok := _ok || 'rascunho sem-coluna ';

  -- homologada + matriz homologada, sem column_key ⇒ vínculo vigente
  PERFORM pg_sleep(0.01);
  INSERT INTO public.class_specific_matrix_association_homologations(association_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v1, 1, 'homologada', DATE '2026-02-01', 'ato-h1', 'cap-ficticia', _u, _e);
  _t1 := clock_timestamp();
  SELECT association_state INTO _s FROM public.resolve_class_specific_matrix_association_at(_k1, _on, _t1);
  IF _s IS DISTINCT FROM 'vinculo-especifico-vigente' THEN RAISE EXCEPTION 'homologada: %', _s; END IF;
  IF EXISTS (SELECT 1 FROM public.resolve_class_specific_matrix_association_at(_k1, DATE '2026-01-15', _t1)) THEN RAISE EXCEPTION 'efeito futuro'; END IF;
  IF EXISTS (SELECT 1 FROM public.resolve_class_specific_matrix_association_at(_k1, _on, _t0)) THEN RAISE EXCEPTION 'knownat'; END IF;
  _ok := _ok || 'homologada knownat ';

  -- coluna inexistente; coluna válida; matriz não homologada; matriz sem versão
  INSERT INTO public.class_specific_matrix_association_versions(association_id, version, change_kind, valid_from, target_matrix_id, target_column_key, specific_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_a2, 1, 'constituicao', DATE '2026-01-01', _mh, 'col-inexistente', 'ato-2', _u, _e) RETURNING id INTO _v2;
  INSERT INTO public.class_specific_matrix_association_homologations(association_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v2, 1, 'homologada', DATE '2026-02-01', 'ato-h2', 'cap-ficticia', _u, _e);
  SELECT association_state INTO _s FROM public.resolve_class_specific_matrix_association_at(_k2, _on, clock_timestamp());
  IF _s IS DISTINCT FROM 'bloqueada:elemento-da-fonte-inexistente' THEN RAISE EXCEPTION 'coluna inexistente: %', _s; END IF;

  INSERT INTO public.class_specific_matrix_association_versions(association_id, version, change_kind, valid_from, target_matrix_id, target_column_key, specific_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_a4, 1, 'constituicao', DATE '2026-01-01', _mn, NULL, 'ato-4', _u, _e) RETURNING id INTO _v4;
  INSERT INTO public.class_specific_matrix_association_homologations(association_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v4, 1, 'homologada', DATE '2026-02-01', 'ato-h4', 'cap-ficticia', _u, _e);
  SELECT association_state INTO _s FROM public.resolve_class_specific_matrix_association_at(_k3, _on, clock_timestamp());
  IF _s IS DISTINCT FROM 'bloqueada:matriz-nao-homologada' THEN RAISE EXCEPTION 'matriz nao homologada: %', _s; END IF;
  _ok := _ok || 'coluna-inexistente matriz-nao-homologada ';

  -- retificação de a2 para coluna válida: passado preservado, nova sem homologação não resolve; homologada resolve
  PERFORM pg_sleep(0.01);
  _t1 := clock_timestamp();
  INSERT INTO public.class_specific_matrix_association_versions(association_id, version, supersedes_id, change_kind, valid_from, target_matrix_id, target_column_key, specific_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
  VALUES (_a2, 2, _v2, 'retificacao', DATE '2026-01-01', _mh, 'col-a', 'ato-2r', 'correcao ficticia', _u, _e) RETURNING id INTO _v1r;
  IF EXISTS (SELECT 1 FROM public.resolve_class_specific_matrix_association_at(_k2, _on, clock_timestamp())) THEN RAISE EXCEPTION 'herdou homologacao'; END IF;
  SELECT association_state INTO _s FROM public.resolve_class_specific_matrix_association_at(_k2, _on, _t1);
  IF _s IS DISTINCT FROM 'bloqueada:elemento-da-fonte-inexistente' THEN RAISE EXCEPTION 'passado reescrito: %', _s; END IF;
  INSERT INTO public.class_specific_matrix_association_homologations(association_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v1r, 1, 'homologada', DATE '2026-02-01', 'ato-h2r', 'cap-ficticia', _u, _e);
  SELECT association_state INTO _s FROM public.resolve_class_specific_matrix_association_at(_k2, _on, clock_timestamp());
  IF _s IS DISTINCT FROM 'vinculo-especifico-vigente' THEN RAISE EXCEPTION 'coluna valida: %', _s; END IF;
  _ok := _ok || 'retificacao coluna-valida ';

  -- matriz sem versão: turma k3 via sucessão de a4 apontando para Z
  INSERT INTO public.class_specific_matrix_association_versions(association_id, version, supersedes_id, change_kind, valid_from, target_matrix_id, specific_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
  VALUES (_a4, 2, _v4, 'sucessao', DATE '2026-06-01', _mz, 'ato-4s', 'sucessao ficticia', _u, _e) RETURNING id INTO _v3;
  INSERT INTO public.class_specific_matrix_association_homologations(association_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v3, 1, 'homologada', DATE '2026-06-01', 'ato-h4s', 'cap-ficticia', _u, _e);
  SELECT association_state INTO _s FROM public.resolve_class_specific_matrix_association_at(_k3, DATE '2026-07-01', clock_timestamp());
  IF _s IS DISTINCT FROM 'bloqueada:matriz-sem-versao-vigente' THEN RAISE EXCEPTION 'sem versao: %', _s; END IF;
  SELECT association_state INTO _s FROM public.resolve_class_specific_matrix_association_at(_k3, _on, clock_timestamp());
  IF _s IS DISTINCT FROM 'bloqueada:matriz-nao-homologada' THEN RAISE EXCEPTION 'sucessao reescreveu: %', _s; END IF;
  _ok := _ok || 'matriz-sem-versao ';

  -- revogação da associação ⇒ não resolve
  INSERT INTO public.class_specific_matrix_association_homologations(association_version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  SELECT _v1, 2, h.id, 'revogada', DATE '2026-04-01', 'ato-rev', 'revogacao ficticia', 'cap-ficticia', _u, _e FROM public.class_specific_matrix_association_homologations h WHERE h.association_version_id = _v1;
  IF EXISTS (SELECT 1 FROM public.resolve_class_specific_matrix_association_at(_k1, DATE '2026-05-01', clock_timestamp())) THEN RAISE EXCEPTION 'revogada resolve'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.resolve_class_specific_matrix_association_at(_k1, _on, clock_timestamp())) THEN RAISE EXCEPTION 'revogacao retroativa'; END IF;
  _ok := _ok || 'revogacao ';

  -- duas homologadas vigentes na mesma turma ⇒ falha fechada; rascunho não gera ambiguidade
  INSERT INTO public.class_specific_matrix_association_versions(association_id, version, change_kind, valid_from, target_matrix_id, specific_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_a3, 1, 'constituicao', DATE '2026-01-01', _mh, 'ato-3', _u, _e) RETURNING id INTO _v5;
  SELECT count(*) INTO _n FROM public.resolve_class_specific_matrix_association_at(_k2, _on, clock_timestamp());
  IF _n <> 1 THEN RAISE EXCEPTION 'rascunho gerou ambiguidade'; END IF;
  INSERT INTO public.class_specific_matrix_association_homologations(association_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v5, 1, 'homologada', DATE '2026-02-01', 'ato-h3', 'cap-ficticia', _u, _e);
  BEGIN PERFORM * FROM public.resolve_class_specific_matrix_association_at(_k2, _on, clock_timestamp()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'association:ambiguous-homologated' THEN RAISE; END IF; END;
  _ok := _ok || 'ambiguidade ';

  -- cadeia
  BEGIN INSERT INTO public.class_specific_matrix_association_versions(association_id, version, supersedes_id, change_kind, valid_from, target_matrix_id, specific_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
    VALUES (_a5, 2, _v1, 'sucessao', DATE '2026-09-01', _mh, 'a', 'm', _u, _e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'association:predecessor-other-association' THEN RAISE; END IF; END;
  BEGIN INSERT INTO public.class_specific_matrix_association_versions(association_id, version, supersedes_id, change_kind, valid_from, target_matrix_id, specific_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
    VALUES (_a1, 3, _v1, 'sucessao', DATE '2026-09-01', _mh, 'a', 'm', _u, _e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'association:version-gap' THEN RAISE; END IF; END;
  _ok := _ok || 'cadeia ';

  -- append-only
  BEGIN UPDATE public.class_specific_matrix_association_versions SET target_column_key = 'col-z' WHERE id = _v1; RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'x' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.class_specific_matrix_association_homologations WHERE association_version_id = _v1; RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'x' THEN RAISE; END IF; END;
  _ok := _ok || 'append-only ';

  -- legado inválido ⇒ falha fechada
  ALTER TABLE public.class_specific_matrix_association_versions DISABLE TRIGGER csa_versions_chain;
  INSERT INTO public.class_specific_matrix_association_versions(association_id, version, supersedes_id, change_kind, valid_from, target_matrix_id, specific_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
  VALUES (_a5, 7, _v5, 'sucessao', DATE '2026-09-01', _mh, 'a', 'm', _u, _e);
  ALTER TABLE public.class_specific_matrix_association_versions ENABLE TRIGGER csa_versions_chain;
  BEGIN PERFORM * FROM public.class_specific_matrix_associations_at(_on, clock_timestamp()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'association:ambiguous-chain' THEN RAISE; END IF; END;
  _ok := _ok || 'legado';

  RAISE EXCEPTION 'b423-tests-ok: %', _ok;
END $t$;
