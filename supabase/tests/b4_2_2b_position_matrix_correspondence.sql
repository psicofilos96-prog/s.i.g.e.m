-- B4.2.2b — teste transacional: termina em RAISE (rollback), nada persiste.
DO $t$
DECLARE
  _p text := 'ccp-' || gen_random_uuid()::text; _p2 text := 'ccp-' || gen_random_uuid()::text;
  _m1 text := 'mat-' || gen_random_uuid()::text; _m2 text := 'mat-' || gen_random_uuid()::text;
  _c1 text := 'cpm-' || gen_random_uuid()::text; _c2 text := 'cpm-' || gen_random_uuid()::text;
  _c3 text := 'cpm-' || gen_random_uuid()::text; _c4 text := 'cpm-' || gen_random_uuid()::text;
  _mv1 uuid; _mv1b uuid; _mv2 uuid; _v1 uuid; _v1r uuid; _v2 uuid; _v3 uuid; _v4 uuid;
  _t0 timestamptz; _t1 timestamptz; _s text; _n integer; _ok text := '';
  _e uuid := gen_random_uuid(); _u uuid := gen_random_uuid();
  _ka jsonb := '[{"scheme":"esq-ficticio-a","value":"val-1","version":1}]';
  _kb jsonb := '[{"scheme":"esq-ficticio-a","value":"val-2","version":1}]';
BEGIN
  -- ACL / RLS / ausência de writer / zero linhas
  IF has_table_privilege('anon','public.curricular_position_matrix_correspondence_versions','SELECT') THEN RAISE EXCEPTION 'acl anon'; END IF;
  IF has_table_privilege('authenticated','public.curricular_position_matrix_correspondence_versions','INSERT')
    OR has_table_privilege('authenticated','public.curricular_position_matrix_correspondence_keys','INSERT')
    OR has_table_privilege('authenticated','public.curricular_position_matrix_correspondence_homologations','INSERT') THEN RAISE EXCEPTION 'acl dml'; END IF;
  IF has_function_privilege('anon','public.curricular_position_matrix_correspondences_at(date, timestamptz)','EXECUTE')
    OR has_function_privilege('anon','public.resolve_position_matrix_correspondence_at(text, jsonb, date, timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'acl exec'; END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname LIKE 'curricular_position_matrix_correspondence%' AND relkind='r' AND NOT relrowsecurity) THEN RAISE EXCEPTION 'rls'; END IF;
  IF has_function_privilege('anon', 'public.record_position_matrix_correspondence_version(text,text,uuid,text,date,date,text,text,text,text,jsonb)', 'EXECUTE') OR has_function_privilege('anon', 'public.homologate_position_matrix_correspondence_version(uuid,uuid,text,date,text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'R5 writer anon'; END IF;
  IF (SELECT bool_or(prosecdef) FROM pg_proc WHERE proname IN ('curricular_position_matrix_correspondences_at','resolve_position_matrix_correspondence_at')) THEN RAISE EXCEPTION 'definer'; END IF;
  IF (SELECT count(*) FROM public.curricular_position_matrix_correspondence_versions) <> 0 THEN RAISE EXCEPTION 'pre-rows'; END IF;
  _ok := _ok || 'acl ';

  -- fixtures fictícias: perfil, duas matrizes; m1 tem coluna col-a; m2 tem col-x
  INSERT INTO public.curricular_correspondence_profiles(id) VALUES (_p), (_p2);
  INSERT INTO public.institutional_curricular_matrices(id) VALUES (_m1), (_m2);
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_m1, 1, 'constituicao', 'Matriz ficticia 1', DATE '2026-01-01', 'ato-m1', _u, _e) RETURNING id INTO _mv1;
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_m2, 1, 'constituicao', 'Matriz ficticia 2', DATE '2026-01-01', 'ato-m2', _u, _e) RETURNING id INTO _mv2;
  INSERT INTO public.curricular_matrix_layouts(matrix_version_id, source_locator) VALUES (_mv1, 'fonte-ficticia'), (_mv2, 'fonte-ficticia');
  INSERT INTO public.curricular_matrix_layout_columns(matrix_version_id, column_key, position, header_text) VALUES (_mv1, 'col-a', 0, 'A'), (_mv2, 'col-x', 0, 'X');

  -- rascunho; coluna inexistente aceita no registro
  INSERT INTO public.curricular_position_matrix_correspondences(id, profile_id) VALUES (_c1, _p), (_c2, _p), (_c3, _p), (_c4, _p2);
  INSERT INTO public.curricular_position_matrix_correspondence_versions(correspondence_id, version, change_kind, valid_from, target_matrix_id, target_column_key, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_c1, 1, 'constituicao', DATE '2026-01-01', _m1, 'col-a', 'ato-c1', _u, _e) RETURNING id INTO _v1;
  INSERT INTO public.curricular_position_matrix_correspondence_keys VALUES (_v1, 'esq-ficticio-a', 'val-1', 1);
  INSERT INTO public.curricular_position_matrix_correspondence_versions(correspondence_id, version, change_kind, valid_from, target_matrix_id, target_column_key, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_c2, 1, 'constituicao', DATE '2026-01-01', _m2, 'col-inexistente', 'ato-c2', _u, _e) RETURNING id INTO _v2;
  INSERT INTO public.curricular_position_matrix_correspondence_keys VALUES (_v2, 'esq-ficticio-a', 'val-2', 1);
  BEGIN INSERT INTO public.curricular_position_matrix_correspondence_keys VALUES (_v1, 'esq-ficticio-a', 'val-9', 1); RAISE EXCEPTION 'x';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN INSERT INTO public.curricular_position_matrix_correspondence_keys VALUES (_v1, 'cand:x', 'v', 1); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  _t0 := clock_timestamp();
  SELECT homologation_state INTO _s FROM public.curricular_position_matrix_correspondences_at(DATE '2026-03-01', _t0) WHERE correspondence_id = _c1;
  IF _s <> 'nao-homologada' THEN RAISE EXCEPTION 'rascunho: %', _s; END IF;
  IF EXISTS (SELECT 1 FROM public.resolve_position_matrix_correspondence_at(_p, _ka, DATE '2026-03-01', _t0)) THEN RAISE EXCEPTION 'rascunho resolvido'; END IF;
  _ok := _ok || 'rascunho ';

  -- entrada inválida
  BEGIN PERFORM * FROM public.resolve_position_matrix_correspondence_at(_p, '[]', DATE '2026-03-01', _t0); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'correspondence:position-key-required' THEN RAISE; END IF; END;
  BEGIN PERFORM * FROM public.resolve_position_matrix_correspondence_at(_p, '[{"scheme":"a","value":"b","version":1},{"scheme":"a","value":"c","version":1}]', DATE '2026-03-01', _t0); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'correspondence:position-key-malformed' THEN RAISE; END IF; END;
  BEGIN PERFORM * FROM public.curricular_position_matrix_correspondences_at(NULL, _t0); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'correspondence:valid-on-required' THEN RAISE; END IF; END;
  _ok := _ok || 'entrada ';

  -- homologação (fixture direta), knownAt, efeito futuro, coluna validada na resolução
  PERFORM pg_sleep(0.01);
  INSERT INTO public.curricular_position_matrix_correspondence_homologations(correspondence_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v1, 1, 'homologada', DATE '2026-02-01', 'ato-h1', 'cap-ficticia', _u, _e), (_v2, 1, 'homologada', DATE '2026-02-01', 'ato-h2', 'cap-ficticia', _u, _e);
  _t1 := clock_timestamp();
  SELECT column_state INTO _s FROM public.resolve_position_matrix_correspondence_at(_p, _ka, DATE '2026-03-01', _t1);
  IF _s IS DISTINCT FROM 'coluna-presente' THEN RAISE EXCEPTION 'resolvida: %', _s; END IF;
  SELECT column_state INTO _s FROM public.resolve_position_matrix_correspondence_at(_p, _kb, DATE '2026-03-01', _t1);
  IF _s IS DISTINCT FROM 'bloqueada:coluna-inexistente' THEN RAISE EXCEPTION 'coluna: %', _s; END IF;
  IF EXISTS (SELECT 1 FROM public.resolve_position_matrix_correspondence_at(_p, _ka, DATE '2026-01-15', _t1)) THEN RAISE EXCEPTION 'efeito futuro'; END IF;
  IF EXISTS (SELECT 1 FROM public.resolve_position_matrix_correspondence_at(_p, _ka, DATE '2026-03-01', _t0)) THEN RAISE EXCEPTION 'knownat'; END IF;
  IF EXISTS (SELECT 1 FROM public.resolve_position_matrix_correspondence_at(_p2, _ka, DATE '2026-03-01', _t1)) THEN RAISE EXCEPTION 'outro perfil'; END IF;
  IF EXISTS (SELECT 1 FROM public.resolve_position_matrix_correspondence_at(_p, '[{"scheme":"esq-ficticio-a","value":"val-1","version":2}]', DATE '2026-03-01', _t1)) THEN RAISE EXCEPTION 'versao do valor'; END IF;
  -- múltiplas matrizes na mesma data (chaves distintas → matrizes distintas)
  SELECT count(DISTINCT target_matrix_id) INTO _n FROM public.curricular_position_matrix_correspondences_at(DATE '2026-03-01', _t1) WHERE profile_id = _p AND homologation_state = 'homologada';
  IF _n <> 2 THEN RAISE EXCEPTION 'multiplas matrizes: %', _n; END IF;
  _ok := _ok || 'homologada knownat coluna multiplas ';

  -- sucessão da matriz sem a coluna: correspondência permanece; bloqueio só na data nova
  PERFORM pg_sleep(0.01);
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, supersedes_id, change_kind, official_name, valid_from, change_reason, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_m1, 2, _mv1, 'sucessao', 'Matriz ficticia 1', DATE '2026-07-01', 'nova deliberacao ficticia', 'ato-m1b', _u, _e) RETURNING id INTO _mv1b;
  INSERT INTO public.curricular_matrix_layouts(matrix_version_id, source_locator) VALUES (_mv1b, 'fonte-ficticia');
  INSERT INTO public.curricular_matrix_layout_columns(matrix_version_id, column_key, position, header_text) VALUES (_mv1b, 'col-outra', 0, 'O');
  SELECT column_state INTO _s FROM public.resolve_position_matrix_correspondence_at(_p, _ka, DATE '2026-08-01', clock_timestamp());
  IF _s IS DISTINCT FROM 'bloqueada:coluna-inexistente' THEN RAISE EXCEPTION 'sucessao: %', _s; END IF;
  SELECT column_state INTO _s FROM public.resolve_position_matrix_correspondence_at(_p, _ka, DATE '2026-03-01', clock_timestamp());
  IF _s IS DISTINCT FROM 'coluna-presente' THEN RAISE EXCEPTION 'passado: %', _s; END IF;
  _ok := _ok || 'sucessao-matriz ';

  -- retificação oculta a retificada e não herda homologação; passado preservado
  PERFORM pg_sleep(0.01);
  INSERT INTO public.curricular_position_matrix_correspondence_versions(correspondence_id, version, supersedes_id, change_kind, valid_from, target_matrix_id, target_column_key, originating_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
  VALUES (_c1, 2, _v1, 'retificacao', DATE '2026-01-01', _m1, 'col-a', 'ato-r', 'correcao ficticia', _u, _e) RETURNING id INTO _v1r;
  INSERT INTO public.curricular_position_matrix_correspondence_keys VALUES (_v1r, 'esq-ficticio-a', 'val-1', 1);
  IF EXISTS (SELECT 1 FROM public.resolve_position_matrix_correspondence_at(_p, _ka, DATE '2026-03-01', clock_timestamp())) THEN RAISE EXCEPTION 'herdou homologacao'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.resolve_position_matrix_correspondence_at(_p, _ka, DATE '2026-03-01', _t1)) THEN RAISE EXCEPTION 'passado reescrito'; END IF;
  _ok := _ok || 'retificacao ';

  -- cadeia
  BEGIN INSERT INTO public.curricular_position_matrix_correspondence_versions(correspondence_id, version, supersedes_id, change_kind, valid_from, target_matrix_id, target_column_key, originating_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
    VALUES (_c2, 2, _v1r, 'sucessao', DATE '2026-09-01', _m1, 'col-a', 'a', 'm', _u, _e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'correspondence:predecessor-other-correspondence' THEN RAISE; END IF; END;
  BEGIN INSERT INTO public.curricular_position_matrix_correspondence_versions(correspondence_id, version, supersedes_id, change_kind, valid_from, target_matrix_id, target_column_key, originating_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
    VALUES (_c2, 3, _v2, 'sucessao', DATE '2026-09-01', _m1, 'col-a', 'a', 'm', _u, _e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'correspondence:version-gap' THEN RAISE; END IF; END;
  _ok := _ok || 'cadeia ';

  -- duas correspondências homologadas com a mesma chave ⇒ falha fechada legada; desliga o guard R5.1 para fabricar ambiguidade.
  ALTER TABLE public.curricular_position_matrix_correspondence_keys DISABLE TRIGGER r5_correspondence_effective_overlap;
  INSERT INTO public.curricular_position_matrix_correspondence_homologations(correspondence_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v1r, 1, 'homologada', DATE '2026-02-01', 'ato-h1r', 'cap-ficticia', _u, _e);
  INSERT INTO public.curricular_position_matrix_correspondence_versions(correspondence_id, version, change_kind, valid_from, target_matrix_id, target_column_key, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_c3, 1, 'constituicao', DATE '2026-01-01', _m2, 'col-x', 'ato-c3', _u, _e) RETURNING id INTO _v3;
  INSERT INTO public.curricular_position_matrix_correspondence_keys VALUES (_v3, 'esq-ficticio-a', 'val-1', 1);
  INSERT INTO public.curricular_position_matrix_correspondence_homologations(correspondence_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v3, 1, 'homologada', DATE '2026-02-01', 'ato-h3', 'cap-ficticia', _u, _e);
  BEGIN PERFORM * FROM public.resolve_position_matrix_correspondence_at(_p, _ka, DATE '2026-03-01', clock_timestamp()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'correspondence:ambiguous-homologated' THEN RAISE; END IF; END;
  -- rascunho com a mesma chave não gera ambiguidade
  INSERT INTO public.curricular_position_matrix_correspondence_versions(correspondence_id, version, change_kind, valid_from, target_matrix_id, target_column_key, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_c4, 1, 'constituicao', DATE '2026-01-01', _m2, 'col-x', 'ato-c4', _u, _e) RETURNING id INTO _v4;
  INSERT INTO public.curricular_position_matrix_correspondence_keys VALUES (_v4, 'esq-ficticio-a', 'val-2', 1);
  SELECT count(*) INTO _n FROM public.resolve_position_matrix_correspondence_at(_p, _kb, DATE '2026-03-01', clock_timestamp());
  IF _n <> 1 THEN RAISE EXCEPTION 'rascunho gerou ambiguidade: %', _n; END IF;
  _ok := _ok || 'ambiguidade ';

  -- imutabilidade
  BEGIN UPDATE public.curricular_position_matrix_correspondence_versions SET target_column_key = 'col-z' WHERE id = _v1; RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'x' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.curricular_position_matrix_correspondence_keys WHERE correspondence_version_id = _v1; RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'x' THEN RAISE; END IF; END;
  _ok := _ok || 'append-only ';

  -- legado inválido ⇒ falha fechada
  ALTER TABLE public.curricular_position_matrix_correspondence_versions DISABLE TRIGGER cpm_versions_chain;
  INSERT INTO public.curricular_position_matrix_correspondence_versions(correspondence_id, version, supersedes_id, change_kind, valid_from, target_matrix_id, target_column_key, originating_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
  VALUES (_c4, 5, _v4, 'sucessao', DATE '2026-09-01', _m2, 'col-x', 'a', 'm', _u, _e);
  ALTER TABLE public.curricular_position_matrix_correspondence_versions ENABLE TRIGGER cpm_versions_chain;
  BEGIN PERFORM * FROM public.curricular_position_matrix_correspondences_at(DATE '2026-03-01', clock_timestamp()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'correspondence:ambiguous-chain' THEN RAISE; END IF; END;
  _ok := _ok || 'legado';
  ALTER TABLE public.curricular_position_matrix_correspondence_keys ENABLE TRIGGER r5_correspondence_effective_overlap;

  RAISE EXCEPTION 'b422b-tests-ok: %', _ok;
END $t$;
