-- R5 — writers E1–E4 + política v4 draft. Termina em RAISE 'r5-tests-ok: ...'; nada persiste.
-- Exige a migration R5 aplicada. Fixtures fictícias (conta, pessoa, atuação, catálogo, matriz, turma) só dentro do bloco.
-- A homologação da v4 abaixo é FIXTURE de teste revertida; nunca ato real.
DO $t$
DECLARE
  _v3 uuid; _v4 uuid; u uuid := gen_random_uuid(); other uuid := gen_random_uuid(); _p uuid; _p2 uuid; _eng uuid; _eng2 uuid;
  _school text := 'esc-r5-' || gen_random_uuid()::text; _year text := 'ano-r5-' || gen_random_uuid()::text; _cls text := 'turma-r5-' || gen_random_uuid()::text;
  _m text := 'mat-' || gen_random_uuid()::text; _mv uuid; r jsonb; r2 jsonb; h jsonb; _ok text := ''; n int; _t0 timestamptz;
  _f text; _sig text;
BEGIN
  -- v4: contagens, supersessão, draft, completude
  SELECT id INTO _v3 FROM public.capability_policies WHERE logical_policy_id='politica-capacidades-diario' AND version=3;
  SELECT id INTO _v4 FROM public.capability_policies WHERE logical_policy_id='politica-capacidades-diario' AND version=4;
  IF _v4 IS NULL THEN RAISE EXCEPTION 'v4 ausente'; END IF;
  IF (SELECT status FROM public.capability_policies WHERE id=_v4) <> 'draft' THEN RAISE EXCEPTION 'v4 não draft'; END IF;
  IF (SELECT homologation_act_ref FROM public.capability_policies WHERE id=_v4) IS NOT NULL THEN RAISE EXCEPTION 'v4 com ato'; END IF;
  IF (SELECT supersedes_version_id FROM public.capability_policies WHERE id=_v4) <> _v3 THEN RAISE EXCEPTION 'v4 supersedes'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id=_v4) <> 213 THEN RAISE EXCEPTION 'v4 != 213'; END IF;
  IF (SELECT count(DISTINCT capability_id) FROM public.capability_policy_rules WHERE policy_id=_v4) <> 85 THEN RAISE EXCEPTION 'v4 != 85'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id=_v3) <> 199 THEN RAISE EXCEPTION 'v3 alterada'; END IF;
  IF EXISTS (SELECT engagement_kind_id, capability_id, scope_dimensions FROM public.capability_policy_rules WHERE policy_id=_v3
             EXCEPT SELECT engagement_kind_id, capability_id, scope_dimensions FROM public.capability_policy_rules WHERE policy_id=_v4) THEN RAISE EXCEPTION 'v4 perdeu regra de v3'; END IF;
  IF (SELECT count(*) FROM public.capability_policy_rules WHERE policy_id=_v4 AND capability_id = ANY (public.r5_capabilities())
        AND engagement_kind_id IN ('gestao-pedagogica-da-rede','administrador-geral-do-sigem') AND scope_dimensions = ARRAY['network']) <> 14 THEN RAISE EXCEPTION 'v4 r5 rules'; END IF;
  IF EXISTS (SELECT 1 FROM public.sigem_general_admin_coverage_issues(_v4)) THEN RAISE EXCEPTION 'v4 cobertura mestre'; END IF;
  _ok := _ok || 'v4 ';

  -- ACL: só authenticated executa; anon não; helpers privados fechados; nenhum DML direto
  FOREACH _f IN ARRAY ARRAY[
    'public.record_curricular_matrix_version(text,uuid,text,text,date,date,text,text,jsonb,jsonb)',
    'public.record_curricular_matrix_version(text,uuid,text,text,date,date,text,text,jsonb,jsonb,jsonb)',
    'public.homologate_curricular_matrix_version(uuid,uuid,text,date,text,text)',
    'public.homologate_correspondence_profile_version(uuid,uuid,text,date,text,text)',
    'public.homologate_position_matrix_correspondence_version(uuid,uuid,text,date,text,text)',
    'public.homologate_class_specific_matrix_association_version(uuid,uuid,text,date,text,text)',
    'public.record_correspondence_profile_version(text,uuid,text,date,date,text,text,text[],text,jsonb,jsonb)',
    'public.record_position_matrix_correspondence_version(text,text,uuid,text,date,date,text,text,text,text,jsonb)',
    'public.record_class_specific_matrix_association_version(text,text,uuid,text,date,date,text,text,text,text)'] LOOP
    IF has_function_privilege('anon', _f, 'EXECUTE') OR has_function_privilege('service_role', _f, 'EXECUTE') THEN RAISE EXCEPTION 'non-authenticated execute %', _f; END IF;
    IF NOT has_function_privilege('authenticated', _f, 'EXECUTE') THEN RAISE EXCEPTION 'authenticated sem execute %', _f; END IF;
    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = _f::regprocedure) THEN RAISE EXCEPTION 'não definer %', _f; END IF;
    IF NOT (SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = _f::regprocedure) THEN RAISE EXCEPTION 'search_path %', _f; END IF;
  END LOOP;
  FOREACH _f IN ARRAY ARRAY['public.r5_network_grant(text)','public.r5_record_homologation(text,uuid,uuid,text,date,text,text)',
    'public.r5_version_step(text,text,text,text,uuid,text,date,date,text)'] LOOP
    IF has_function_privilege('anon', _f, 'EXECUTE') OR has_function_privilege('authenticated', _f, 'EXECUTE') OR has_function_privilege('service_role', _f, 'EXECUTE') THEN RAISE EXCEPTION 'helper aberto %', _f; END IF;
  END LOOP;
  FOREACH _f IN ARRAY ARRAY[
    'institutional_curricular_matrices','curricular_matrix_versions','curricular_matrix_items','curricular_matrix_applicability',
    'curricular_matrix_layouts','curricular_matrix_layout_columns','curricular_matrix_layout_rows','curricular_matrix_layout_groups',
    'curricular_matrix_layout_cells','curricular_matrix_layout_notes','curricular_matrix_version_homologations',
    'curricular_correspondence_profiles','curricular_correspondence_profile_versions','curricular_correspondence_profile_position_keys',
    'curricular_correspondence_profile_nature_axis','curricular_correspondence_profile_nature_gates','curricular_correspondence_profile_homologations',
    'curricular_position_matrix_correspondences','curricular_position_matrix_correspondence_versions',
    'curricular_position_matrix_correspondence_keys','curricular_position_matrix_correspondence_homologations',
    'class_specific_matrix_associations','class_specific_matrix_association_versions','class_specific_matrix_association_homologations'] LOOP
    IF has_table_privilege('anon', 'public.'||_f, 'SELECT') THEN RAISE EXCEPTION 'anon select %', _f; END IF;
    IF has_table_privilege('authenticated', 'public.'||_f, 'INSERT') OR has_table_privilege('authenticated', 'public.'||_f, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.'||_f, 'DELETE') OR has_table_privilege('authenticated', 'public.'||_f, 'TRUNCATE')
       OR has_table_privilege('service_role', 'public.'||_f, 'INSERT') OR has_table_privilege('service_role', 'public.'||_f, 'UPDATE')
       OR has_table_privilege('service_role', 'public.'||_f, 'DELETE') OR has_table_privilege('service_role', 'public.'||_f, 'TRUNCATE') THEN RAISE EXCEPTION 'dml %', _f; END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.'||_f)::regclass) THEN RAISE EXCEPTION 'rls off %', _f; END IF;
  END LOOP;
  _ok := _ok || 'acl ';

  -- fixtures (privilegiadas, revertidas)
  INSERT INTO public.institutional_persons(display_name) VALUES ('zz-teste-r5-rede') RETURNING id INTO _p;
  INSERT INTO public.institutional_persons(display_name) VALUES ('zz-teste-r5-escola') RETURNING id INTO _p2;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (u, _p), (other, _p2);
  INSERT INTO public.institutional_schools(id) VALUES (_school);
  INSERT INTO public.institutional_school_record_versions(school_id,version_number,official_name,active,valid_from,originating_act_ref)
    VALUES (_school,1,'Escola sintética R5',true,DATE '2020-01-01','ato-ficticio-r5');
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from, originating_act_ref)
    VALUES (_p, 'gestao-pedagogica-da-rede', 'rede', NULL, CURRENT_DATE - 30, 'ato-ficticio-teste')
    RETURNING id INTO _eng;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from, originating_act_ref)
    VALUES (_p2, 'gestao-pedagogica-da-rede', 'escola', _school, CURRENT_DATE - 30, 'ato-ficticio-teste-escopo')
    RETURNING id INTO _eng2;
  INSERT INTO public.institutional_academic_years(id) VALUES (_year);
  INSERT INTO public.institutional_academic_year_versions
    (academic_year_id,version,official_name,starts_on,ends_on,is_active,valid_from,originating_act_ref,
     recorded_by,recorded_by_person_id,recorded_via_engagement_id)
    VALUES (_year,1,'Ano sintético R5',DATE '2027-01-01',DATE '2027-12-31',true,DATE '2020-01-01','ato-ficticio-r5',
      u,_p,_eng);
  INSERT INTO public.institutional_classes
    (id,school_id,school_label_snapshot,academic_year_id,academic_year_label,name,valid_from,originating_act_ref)
    VALUES (_cls,_school,'Escola sintética R5',_year,'2027','Turma sintética R5',DATE '2027-01-01','ato-ficticio-r5');
  INSERT INTO public.attribute_value_definitions(scheme_id, value_id, version, label, status, valid_from)
    VALUES ('zz-r5-ano', 'zz-um', 1, 'zz', 'homologada', DATE '2020-01-01'),
           ('zz-r5-ano', 'zz-rasc', 1, 'zz', 'draft', DATE '2020-01-01');
  INSERT INTO public.institutional_curricular_matrices(id) VALUES (_m);
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
    VALUES (_m, 1, 'constituicao', 'zz-r5', DATE '2027-01-01', 'ato-ficticio', u, gen_random_uuid()) RETURNING id INTO _mv;
  SELECT c.id INTO _cls FROM public.institutional_classes c LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- draft não autoriza: v4 draft ⇒ capability ausente
  BEGIN PERFORM public.homologate_curricular_matrix_version(_mv, NULL, 'homologada', DATE '2027-01-01', 'ato', NULL); RAISE EXCEPTION 'draft autorizou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:homologar-matrizes-curriculares' THEN RAISE; END IF; END;
  _ok := _ok || 'draft-nao-autoriza ';

  -- fixture: homologar v4 (revertido) como papel privilegiado
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.capability_policies SET status='homologated', homologated_at=now(), homologation_act_ref='ato-ficticio-teste', valid_from=CURRENT_DATE - 1 WHERE id=_v4;
  PERFORM set_config('role', 'authenticated', true);

  -- sem sessão
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.homologate_curricular_matrix_version(_mv, NULL, 'homologada', DATE '2027-01-01', 'ato', NULL); RAISE EXCEPTION 'sem sessão passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'r5:session-required' THEN RAISE; END IF; END;
  -- atuação correta, mas apenas em escopo de escola: não satisfaz capability [network]
  PERFORM set_config('request.jwt.claims', json_build_object('sub', other, 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_class_specific_matrix_association_version(NULL, _cls, NULL, 'constituicao', DATE '2027-01-01', NULL, NULL, 'ato', _m, NULL); RAISE EXCEPTION 'escopo escola passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:manter-associacoes-especificas-matriz' THEN RAISE; END IF; END;
  _ok := _ok || 'sessao escopo capability ';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, true);
  -- E1 homologação: ato ausente, happy path, stale, já homologada, revogação, knownAt/validOn
  BEGIN PERFORM public.homologate_curricular_matrix_version(_mv, NULL, 'homologada', DATE '2027-01-01', '  ', NULL); RAISE EXCEPTION 'sem ato passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:act-required' THEN RAISE; END IF; END;
  _t0 := clock_timestamp();
  h := public.homologate_curricular_matrix_version(_mv, NULL, 'homologada', DATE '2027-02-01', 'ato-ficticio-e1', NULL);
  IF (h->>'sequence')::int <> 1 THEN RAISE EXCEPTION 'e1 seq'; END IF;
  BEGIN PERFORM public.homologate_curricular_matrix_version(_mv, NULL, 'revogada', DATE '2027-03-01', 'ato', 'x'); RAISE EXCEPTION 'stale passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:stale-head' THEN RAISE; END IF; END;
  BEGIN PERFORM public.homologate_curricular_matrix_version(_mv, (h->>'homologation_id')::uuid, 'homologada', DATE '2027-03-01', 'ato', 'x'); RAISE EXCEPTION 'dupla passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:already-homologated' THEN RAISE; END IF; END;
  IF (SELECT homologation_state FROM public.curricular_matrix_homologation_state_at(DATE '2027-01-15', clock_timestamp()) WHERE version_id=_mv) <> 'nao-homologada' THEN RAISE EXCEPTION 'validOn antes do efeito'; END IF;
  IF (SELECT homologation_state FROM public.curricular_matrix_homologation_state_at(DATE '2027-02-15', _t0) WHERE version_id=_mv) <> 'nao-homologada' THEN RAISE EXCEPTION 'knownAt anterior'; END IF;
  IF (SELECT homologation_state FROM public.curricular_matrix_homologation_state_at(DATE '2027-02-15', clock_timestamp()) WHERE version_id=_mv) <> 'homologada' THEN RAISE EXCEPTION 'e1 reader'; END IF;
  r := public.homologate_curricular_matrix_version(_mv, (h->>'homologation_id')::uuid, 'revogada', DATE '2027-04-01', 'ato-ficticio-rev', 'teste');
  IF (r->>'sequence')::int <> 2 THEN RAISE EXCEPTION 'e1 revogação'; END IF;
  _ok := _ok || 'e1 ';

  -- append-only: DML direto negado
  BEGIN UPDATE public.curricular_matrix_version_homologations SET reason='x' WHERE matrix_version_id=_mv; RAISE EXCEPTION 'update passou';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.class_specific_matrix_association_versions(association_id, version, change_kind, valid_from, target_matrix_id, specific_act_ref, recorded_by, recorded_via_engagement_id)
    VALUES ('csa-0', 1, 'constituicao', CURRENT_DATE, _m, 'x', u, gen_random_uuid()); RAISE EXCEPTION 'insert passou';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  _ok := _ok || 'append-only ';

  -- E2: valor não homologado recusado; happy path; sucessão com base; stale; sobreposição com outro perfil
  BEGIN PERFORM public.record_correspondence_profile_version(NULL, NULL, 'constituicao', DATE '2027-01-01', NULL, NULL, 'ato', ARRAY['zz-r5-ano'], 'zz-r5-ano',
      '[{"value":"zz-rasc","version":1,"effect":"matching-regular"}]', NULL); RAISE EXCEPTION 'gate rascunho passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'profile:gate-value-not-homologated' THEN RAISE; END IF; END;
  r := public.record_correspondence_profile_version(NULL, NULL, 'constituicao', DATE '2027-01-01', NULL, NULL, 'ato-ficticio-e2', ARRAY['zz-r5-ano'], NULL, '[]', NULL);
  BEGIN PERFORM public.record_correspondence_profile_version(NULL, NULL, 'constituicao', DATE '2027-06-01', NULL, NULL, 'ato', ARRAY['zz-r5-ano'], NULL, '[]', NULL); RAISE EXCEPTION 'overlap perfil passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'profile:overlaps-other-profile' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_correspondence_profile_version(r->>'profile_id', NULL, 'sucessao', DATE '2027-06-01', NULL, 'm', 'ato', ARRAY['zz-r5-ano'], NULL, '[]', NULL); RAISE EXCEPTION 'stale perfil passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'profile:base-superseded' THEN RAISE; END IF; END;
  h := public.homologate_correspondence_profile_version((r->>'version_id')::uuid, NULL, 'homologada', DATE '2027-01-01', 'ato-ficticio-e2h', NULL);
  IF (SELECT count(*) FROM public.homologated_correspondence_profile_at(DATE '2027-03-01', clock_timestamp())) <> 1 THEN RAISE EXCEPTION 'e2 reader'; END IF;
  _ok := _ok || 'e2 ';

  -- E3: chave incompleta/divergente recusada; happy path; overlap mesma chave
  BEGIN PERFORM public.record_position_matrix_correspondence_version(NULL, r->>'profile_id', NULL, 'constituicao', DATE '2027-01-01', NULL, NULL, 'ato', _m, 'col-a',
      '[{"scheme":"zz-outro","value":"zz-um","version":1}]'); RAISE EXCEPTION 'chave divergente passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT IN ('correspondence:key-value-not-homologated','correspondence:key-schemes-mismatch') THEN RAISE; END IF; END;
  r2 := public.record_position_matrix_correspondence_version(NULL, r->>'profile_id', NULL, 'constituicao', DATE '2027-01-01', NULL, NULL, 'ato-ficticio-e3', _m, 'col-a',
      '[{"scheme":"zz-r5-ano","value":"zz-um","version":1}]');
  BEGIN PERFORM public.record_position_matrix_correspondence_version(NULL, r->>'profile_id', NULL, 'constituicao', DATE '2027-05-01', NULL, NULL, 'ato', _m, 'col-b',
      '[{"scheme":"zz-r5-ano","value":"zz-um","version":1}]'); RAISE EXCEPTION 'overlap e3 passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'correspondence:overlap' THEN RAISE; END IF; END;
  PERFORM public.homologate_position_matrix_correspondence_version((r2->>'version_id')::uuid, NULL, 'homologada', DATE '2027-01-01', 'ato-ficticio-e3h', NULL);
  _ok := _ok || 'e3 ';

  -- E4: turma sintética em rollback, happy path e overlap; turma inexistente também é recusada.
  BEGIN PERFORM public.record_class_specific_matrix_association_version(NULL, 'zz-inexistente', NULL, 'constituicao', DATE '2027-01-01', NULL, NULL, 'ato', _m, NULL); RAISE EXCEPTION 'turma inexistente passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'association:class-not-found' THEN RAISE; END IF; END;
  r := public.record_class_specific_matrix_association_version(NULL, _cls, NULL, 'constituicao', DATE '2027-01-01', NULL, NULL, 'ato-ficticio-e4', _m, NULL);
  BEGIN PERFORM public.record_class_specific_matrix_association_version(NULL, _cls, NULL, 'constituicao', DATE '2027-03-01', NULL, NULL, 'ato', _m, NULL); RAISE EXCEPTION 'overlap e4 passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'association:overlap' THEN RAISE; END IF; END;
  PERFORM public.homologate_class_specific_matrix_association_version((r->>'version_id')::uuid, NULL, 'homologada', DATE '2027-01-01', 'ato-ficticio-e4h', NULL);
  _ok := _ok || 'e4 ';

  RAISE EXCEPTION 'r5-tests-ok: %', _ok;
END $t$;