-- B4.2.1 — teste transacional: termina em RAISE EXCEPTION 'b421-tests-ok: ...'; nada persiste.
-- Fixtures fictícias inseridas diretamente (o papel do teste é privilegiado); nenhuma é dado real.
DO $t$
DECLARE
  _m text := 'mat-' || gen_random_uuid()::text;
  _v uuid; _h1 uuid; _h2 uuid; _t0 timestamptz; _t1 timestamptz; _t2 timestamptz;
  _s text; _n integer; _ok text := '';
BEGIN
  -- schema / ACL
  IF has_table_privilege('anon', 'public.curricular_matrix_version_homologations', 'SELECT') THEN RAISE EXCEPTION 'acl: anon select'; END IF;
  IF has_table_privilege('authenticated', 'public.curricular_matrix_version_homologations', 'INSERT')
     OR has_table_privilege('authenticated', 'public.curricular_matrix_version_homologations', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.curricular_matrix_version_homologations', 'DELETE') THEN RAISE EXCEPTION 'acl: authenticated dml'; END IF;
  IF NOT has_table_privilege('authenticated', 'public.curricular_matrix_version_homologations', 'SELECT') THEN RAISE EXCEPTION 'acl: authenticated select'; END IF;
  IF has_function_privilege('anon', 'public.curricular_matrix_homologation_state_at(date, timestamptz)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.curricular_matrix_homologation_history(uuid, timestamptz)', 'EXECUTE') THEN RAISE EXCEPTION 'acl: anon execute'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.curricular_matrix_version_homologations'::regclass) THEN RAISE EXCEPTION 'rls off'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname ~ 'homologate_curricular_matrix|record_curricular_matrix_homologation') THEN RAISE EXCEPTION 'writer must not exist before R5'; END IF;
  IF (SELECT bool_or(prosecdef) FROM pg_proc WHERE proname IN ('curricular_matrix_homologation_state_at','curricular_matrix_homologation_history')) THEN RAISE EXCEPTION 'reader must be invoker'; END IF;
  IF (SELECT count(*) FROM public.curricular_matrix_version_homologations) <> 0 THEN RAISE EXCEPTION 'pre-existing rows'; END IF;
  _ok := _ok || 'acl ';

  -- fixture: versão construída
  INSERT INTO public.institutional_curricular_matrices(id) VALUES (_m);
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_m, 1, 'constituicao', 'zz-teste-b421', DATE '2026-01-01', 'ato-ficticio', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO _v;
  _t0 := clock_timestamp();

  -- ausência: construída ≠ homologada
  SELECT homologation_state INTO _s FROM public.curricular_matrix_homologation_state_at(DATE '2026-03-01', _t0) WHERE version_id = _v;
  IF _s IS DISTINCT FROM 'nao-homologada' THEN RAISE EXCEPTION 'ausencia: %', _s; END IF;
  _ok := _ok || 'ausencia ';

  -- argumentos obrigatórios
  BEGIN PERFORM * FROM public.curricular_matrix_homologation_state_at(NULL, _t0); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:valid-on-required' THEN RAISE; END IF; END;
  BEGIN PERFORM * FROM public.curricular_matrix_homologation_state_at(DATE '2026-03-01', NULL); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:known-at-required' THEN RAISE; END IF; END;
  _ok := _ok || 'argumentos ';

  -- constraints
  BEGIN INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
    VALUES (_v, 1, 'homologada', DATE '2026-02-01', ' ', 'cap-ficticia', gen_random_uuid(), gen_random_uuid()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
    VALUES (_v, 1, 'aprovada', DATE '2026-02-01', 'ato', 'cap-ficticia', gen_random_uuid(), gen_random_uuid()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
    VALUES (_v, 1, 'homologada', DATE '2026-02-01', 'ato', 'cand:x', gen_random_uuid(), gen_random_uuid()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  _ok := _ok || 'constraints ';

  -- histórico: homologação com efeito em 02-01, depois revogação com efeito em 06-01
  PERFORM pg_sleep(0.01);
  INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v, 1, 'homologada', DATE '2026-02-01', 'ato-homolog-ficticio', 'cap-ficticia', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO _h1;
  _t1 := clock_timestamp();
  BEGIN INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
    VALUES (_v, 2, _h1, 'revogada', DATE '2026-06-01', 'ato-rev', 'cap-ficticia', gen_random_uuid(), gen_random_uuid()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END; -- revogação sem motivo
  PERFORM pg_sleep(0.01);
  INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v, 2, _h1, 'revogada', DATE '2026-06-01', 'ato-rev-ficticio', 'motivo ficticio', 'cap-ficticia', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO _h2;
  _t2 := clock_timestamp();

  SELECT homologation_state INTO _s FROM public.curricular_matrix_homologation_state_at(DATE '2026-01-15', _t2) WHERE version_id = _v;
  IF _s <> 'nao-homologada' THEN RAISE EXCEPTION 'antes do efeito: %', _s; END IF;
  SELECT homologation_state INTO _s FROM public.curricular_matrix_homologation_state_at(DATE '2026-03-01', _t2) WHERE version_id = _v;
  IF _s <> 'homologada' THEN RAISE EXCEPTION 'homologada: %', _s; END IF;
  SELECT homologation_state INTO _s FROM public.curricular_matrix_homologation_state_at(DATE '2026-07-01', _t2) WHERE version_id = _v;
  IF _s <> 'revogada' THEN RAISE EXCEPTION 'revogada: %', _s; END IF;
  _ok := _ok || 'vigencia ';

  -- knownAt: revogação posterior não reescreve o passado
  SELECT homologation_state INTO _s FROM public.curricular_matrix_homologation_state_at(DATE '2026-07-01', _t1) WHERE version_id = _v;
  IF _s <> 'homologada' THEN RAISE EXCEPTION 'knownat t1: %', _s; END IF;
  SELECT homologation_state INTO _s FROM public.curricular_matrix_homologation_state_at(DATE '2026-07-01', _t0) WHERE version_id = _v;
  IF _s <> 'nao-homologada' THEN RAISE EXCEPTION 'knownat t0: %', _s; END IF;
  SELECT count(*) INTO _n FROM public.curricular_matrix_homologation_history(_v, _t1);
  IF _n <> 1 THEN RAISE EXCEPTION 'history t1: %', _n; END IF;
  SELECT count(*) INTO _n FROM public.curricular_matrix_homologation_history(_v, _t2);
  IF _n <> 2 THEN RAISE EXCEPTION 'history t2: %', _n; END IF;
  _ok := _ok || 'knownat ';

  -- append-only
  BEGIN UPDATE public.curricular_matrix_version_homologations SET reason = 'x' WHERE id = _h2; RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'x' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.curricular_matrix_version_homologations WHERE id = _h1; RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'x' THEN RAISE; END IF; END;
  BEGIN INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_via_engagement_id)
    VALUES (_v, 3, _h1, 'homologada', DATE '2026-08-01', 'ato', 'm', 'cap-ficticia', gen_random_uuid(), gen_random_uuid()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN unique_violation THEN NULL; WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:sequence-gap' THEN RAISE; END IF; END; -- bifurcação (B4.2.1.1: trigger recusa antes do UNIQUE)
  _ok := _ok || 'append-only';

  RAISE EXCEPTION 'b421-tests-ok: %', _ok;
END $t$;
