DO $t$
DECLARE
  _ma text := 'mat-' || gen_random_uuid()::text; _mb text := 'mat-' || gen_random_uuid()::text;
  _va uuid; _vb uuid; _ha uuid; _hb uuid; _ok text := '';
BEGIN
  INSERT INTO public.institutional_curricular_matrices(id) VALUES (_ma), (_mb);
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_ma, 1, 'constituicao', 'zz-b4211-a', DATE '2026-01-01', 'ato-ficticio', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO _va;
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
  VALUES (_mb, 1, 'constituicao', 'zz-b4211-b', DATE '2026-01-01', 'ato-ficticio', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO _vb;
  INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_va, 1, 'homologada', DATE '2026-02-01', 'ato-a', 'cap-ficticia', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO _ha;
  INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, decision, effective_from, homologation_act_ref, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_vb, 1, 'homologada', DATE '2026-02-01', 'ato-b', 'cap-ficticia', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO _hb;

  -- predecessor de outra versão
  BEGIN INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_via_engagement_id)
    VALUES (_vb, 2, _ha, 'revogada', DATE '2026-03-01', 'ato', 'm', 'cap-ficticia', gen_random_uuid(), gen_random_uuid()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:predecessor-other-version' THEN RAISE; END IF; END;
  _ok := _ok || 'outra-versao ';
  -- salto de sequência
  BEGIN INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_via_engagement_id)
    VALUES (_va, 3, _ha, 'revogada', DATE '2026-03-01', 'ato', 'm', 'cap-ficticia', gen_random_uuid(), gen_random_uuid()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:sequence-gap' THEN RAISE; END IF; END;
  _ok := _ok || 'salto ';
  -- sucessão válida continua aceita
  INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_va, 2, _ha, 'revogada', DATE '2026-03-01', 'ato', 'm', 'cap-ficticia', gen_random_uuid(), gen_random_uuid());
  IF (SELECT homologation_state FROM public.curricular_matrix_homologation_state_at(DATE '2026-04-01', clock_timestamp()) WHERE version_id = _va) <> 'revogada' THEN RAISE EXCEPTION 'sucessao valida'; END IF;
  _ok := _ok || 'valida ';

  -- legado inválido (trigger desligado só nesta transação): reader falha fechado
  ALTER TABLE public.curricular_matrix_version_homologations DISABLE TRIGGER curricular_matrix_version_homologations_chain;
  INSERT INTO public.curricular_matrix_version_homologations(matrix_version_id, sequence, supersedes_id, decision, effective_from, homologation_act_ref, reason, exercised_capability_id, recorded_by, recorded_via_engagement_id)
  VALUES (_vb, 5, _hb, 'revogada', DATE '2026-03-01', 'ato', 'm', 'cap-ficticia', gen_random_uuid(), gen_random_uuid());
  ALTER TABLE public.curricular_matrix_version_homologations ENABLE TRIGGER curricular_matrix_version_homologations_chain;
  BEGIN PERFORM * FROM public.curricular_matrix_homologation_state_at(DATE '2026-04-01', clock_timestamp()); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:ambiguous-chain' THEN RAISE; END IF; END;
  _ok := _ok || 'legado-fail-closed';

  RAISE EXCEPTION 'b4211-tests-ok: %', _ok;
END $t$;
