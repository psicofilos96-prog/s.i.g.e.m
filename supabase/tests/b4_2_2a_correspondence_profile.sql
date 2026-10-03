DO $t$
DECLARE
  _p1 text := 'ccp-' || gen_random_uuid()::text; _p2 text := 'ccp-' || gen_random_uuid()::text;
  _v1 uuid; _v1r uuid; _v2 uuid; _h uuid; _t0 timestamptz; _t1 timestamptz; _n integer; _s text; _ok text := '';
  _e uuid := gen_random_uuid(); _u uuid := gen_random_uuid();
BEGIN
  -- ACL / RLS / ausência de writer
  IF has_table_privilege('anon','public.curricular_correspondence_profile_versions','SELECT') THEN RAISE EXCEPTION 'acl anon'; END IF;
  IF has_table_privilege('authenticated','public.curricular_correspondence_profile_versions','INSERT')
    OR has_table_privilege('authenticated','public.curricular_correspondence_profile_nature_gates','INSERT')
    OR has_table_privilege('authenticated','public.curricular_correspondence_profile_homologations','INSERT') THEN RAISE EXCEPTION 'acl dml'; END IF;
  IF has_function_privilege('anon','public.curricular_correspondence_profiles_at(date, timestamptz)','EXECUTE')
    OR has_function_privilege('anon','public.homologated_correspondence_profile_at(date, timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'acl exec'; END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname LIKE 'curricular_correspondence_profile%' AND relkind='r' AND NOT relrowsecurity) THEN RAISE EXCEPTION 'rls'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname ~ '^(record|homologate)_.*correspondence_profile') THEN RAISE EXCEPTION 'writer exists'; END IF;
  IF (SELECT bool_or(prosecdef) FROM pg_proc WHERE proname IN ('curricular_correspondence_profiles_at','homologated_correspondence_profile_at')) THEN RAISE EXCEPTION 'definer'; END IF;
  IF (SELECT count(*) FROM public.curricular_correspondence_profile_versions) <> 0 THEN RAISE EXCEPTION 'pre-rows'; END IF;
  _ok := _ok || 'acl ';

  -- ausência
  IF EXISTS (SELECT 1 FROM public.homologated_correspondence_profile_at(DATE '2026-03-01', clock_timestamp())) THEN RAISE EXCEPTION 'ausencia'; END IF;
  _ok := _ok || 'ausencia ';

  -- perfil fictício em rascunho (inserção direta privilegiada; sem writer)
  INSERT INTO public.curricular_correspondence_profiles(id) VALUES (_p1), (_p2);
  INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, change_kind, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_p1, 1, 'constituicao', DATE '2026-01-01', 'ato-ficticio', _u, _e) RETURNING id INTO _v1;
  INSERT INTO public.curricular_correspondence_profile_position_keys VALUES (_v1, 'esq-ficticio-a');
  INSERT INTO public.curricular_correspondence_profile_nature_axis VALUES (_v1, 'esq-ficticio-n');
  INSERT INTO public.curricular_correspondence_profile_nature_gates VALUES (_v1, 'esq-ficticio-n', 'val-x', 1, 'matching-regular');
  BEGIN INSERT INTO public.curricular_correspondence_profile_nature_gates VALUES (_v1, 'esq-ficticio-n', 'val-y', 1, 'incluir'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO public.curricular_correspondence_profile_nature_gates VALUES (_v1, 'outro-esq', 'val-z', 1, 'fora-de-correspondencia'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN INSERT INTO public.curricular_correspondence_profile_position_keys VALUES (_v1, 'cand:x'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  _t0 := clock_timestamp();
  SELECT homologation_state INTO _s FROM public.curricular_correspondence_profiles_at(DATE '2026-03-01', _t0) WHERE profile_id = _p1;
  IF _s <> 'nao-homologada' THEN RAISE EXCEPTION 'rascunho: %', _s; END IF;
  IF EXISTS (SELECT 1 FROM public.homologated_correspondence_profile_at(DATE '2026-03-01', _t0)) THEN RAISE EXCEPTION 'rascunho efetivo'; END IF;
  _ok := _ok || 'rascunho constraints ';

  -- cadeia de versões
  BEGIN INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, supersedes_id, change_kind, valid_from, originating_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
    VALUES (_p2, 2, _v1, 'retificacao', DATE '2026-01-01', 'ato', 'm', _u, _e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'profile:predecessor-other-profile' THEN RAISE; END IF; END;
  BEGIN INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, supersedes_id, change_kind, valid_from, originating_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
    VALUES (_p1, 3, _v1, 'retificacao', DATE '2026-01-01', 'ato', 'm', _u, _e); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'profile:version-gap' THEN RAISE; END IF; END;
  _ok := _ok || 'cadeia ';

  -- homologação (inserção direta de fixture) e knownAt
  PERFORM pg_sleep(0.01);
  INSERT INTO public.curricular_correspondence_profile_homologations(profile_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v1, 1, 'homologada', DATE '2026-02-01', 'ato-h', 'cap-ficticia', _u, _e) RETURNING id INTO _h;
  _t1 := clock_timestamp();
  SELECT count(*) INTO _n FROM public.homologated_correspondence_profile_at(DATE '2026-03-01', _t1);
  IF _n <> 1 THEN RAISE EXCEPTION 'homologado: %', _n; END IF;
  IF EXISTS (SELECT 1 FROM public.homologated_correspondence_profile_at(DATE '2026-01-15', _t1)) THEN RAISE EXCEPTION 'efeito futuro'; END IF;
  IF EXISTS (SELECT 1 FROM public.homologated_correspondence_profile_at(DATE '2026-03-01', _t0)) THEN RAISE EXCEPTION 'knownat'; END IF;
  IF (SELECT nature_gates->0->>'effect' FROM public.homologated_correspondence_profile_at(DATE '2026-03-01', _t1)) <> 'matching-regular' THEN RAISE EXCEPTION 'gates'; END IF;
  IF (SELECT applicability_rule FROM public.homologated_correspondence_profile_at(DATE '2026-03-01', _t1)) IS NOT NULL THEN RAISE EXCEPTION 'aplicabilidade presumida'; END IF;
  _ok := _ok || 'homologado knownat ';

  -- retificação oculta a retificada (sem homologação própria ⇒ volta a não homologado)
  PERFORM pg_sleep(0.01);
  INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, supersedes_id, change_kind, valid_from, originating_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
  VALUES (_p1, 2, _v1, 'retificacao', DATE '2026-01-01', 'ato-r', 'correcao ficticia', _u, _e) RETURNING id INTO _v1r;
  IF (SELECT version_id FROM public.curricular_correspondence_profiles_at(DATE '2026-03-01', clock_timestamp()) WHERE profile_id = _p1) <> _v1r THEN RAISE EXCEPTION 'retificacao'; END IF;
  IF EXISTS (SELECT 1 FROM public.homologated_correspondence_profile_at(DATE '2026-03-01', clock_timestamp())) THEN RAISE EXCEPTION 'retificada herdou homologacao'; END IF;
  IF (SELECT count(*) FROM public.homologated_correspondence_profile_at(DATE '2026-03-01', _t1)) <> 1 THEN RAISE EXCEPTION 'passado reescrito'; END IF;
  _ok := _ok || 'retificacao ';

  -- dois perfis homologados vigentes ⇒ ambiguidade
  INSERT INTO public.curricular_correspondence_profile_homologations(profile_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v1r, 1, 'homologada', DATE '2026-02-01', 'ato-h2', 'cap-ficticia', _u, _e);
  INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, change_kind, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_p2, 1, 'constituicao', DATE '2026-01-01', 'ato-2', _u, _e) RETURNING id INTO _v2;
  INSERT INTO public.curricular_correspondence_profile_homologations(profile_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_v2, 1, 'homologada', DATE '2026-02-01', 'ato-h3', 'cap-ficticia', _u, _e);
  BEGIN PERFORM * FROM public.homologated_correspondence_profile_at(DATE '2026-03-01', clock_timestamp()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'profile:ambiguous-homologated' THEN RAISE; END IF; END;
  _ok := _ok || 'ambiguidade ';

  -- legado inválido ⇒ falha fechada
  ALTER TABLE public.curricular_correspondence_profile_versions DISABLE TRIGGER ccp_versions_chain;
  INSERT INTO public.curricular_correspondence_profile_versions(profile_id, version, supersedes_id, change_kind, valid_from, originating_act_ref, change_reason, recorded_by, recorded_via_engagement_id)
  VALUES (_p2, 4, _v2, 'sucessao', DATE '2026-09-01', 'ato', 'm', _u, _e);
  ALTER TABLE public.curricular_correspondence_profile_versions ENABLE TRIGGER ccp_versions_chain;
  BEGIN PERFORM * FROM public.curricular_correspondence_profiles_at(DATE '2026-03-01', clock_timestamp()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'profile:ambiguous-chain' THEN RAISE; END IF; END;
  _ok := _ok || 'legado ';

  -- imutabilidade
  BEGIN UPDATE public.curricular_correspondence_profile_nature_gates SET effect = 'fora-de-correspondencia' WHERE profile_version_id = _v1; RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'x' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.curricular_correspondence_profile_versions WHERE id = _v2; RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'x' THEN RAISE; END IF; END;
  _ok := _ok || 'append-only';

  RAISE EXCEPTION 'b422a-tests-ok: %', _ok;
END $t$;
