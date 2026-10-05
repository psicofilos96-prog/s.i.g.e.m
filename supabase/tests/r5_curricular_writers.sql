-- R5 — writers E1–E4 + política v4 (homologada por decisão do proprietário, 0061). Termina em RAISE 'r5-tests-ok: ...'; nada persiste.
-- Exige 0059/0060/0061 aplicadas. Fixtures fictícias (conta, pessoa, atuação, catálogo, matriz, turma) só dentro do bloco.
-- Referência documental é opcional: NULL é o caso comum; quando fornecida, deve ser preservada.
DO $t$
DECLARE
  _v3 uuid; _v4 uuid; u uuid := gen_random_uuid(); other uuid := gen_random_uuid(); _p uuid; _p2 uuid; _eng uuid; _eng2 uuid;
  _school text := 'esc-r5-' || gen_random_uuid()::text; _year text := 'ano-r5-' || gen_random_uuid()::text; _cls text := 'turma-r5-' || gen_random_uuid()::text;
  _m text := 'mat-' || gen_random_uuid()::text; _mv uuid; r jsonb; r2 jsonb; r3 jsonb; h jsonb; _ok text := ''; n int; _t0 timestamptz;
  _f text; _sig text;
BEGIN
  -- v4: contagens, supersessão, homologada por decisão do proprietário, sem ato; v3 histórica intacta
  SELECT id INTO _v3 FROM public.capability_policies WHERE logical_policy_id='politica-capacidades-diario' AND version=3;
  SELECT id INTO _v4 FROM public.capability_policies WHERE logical_policy_id='politica-capacidades-diario' AND version=4;
  IF _v4 IS NULL THEN RAISE EXCEPTION 'v4 ausente'; END IF;
  IF (SELECT status FROM public.capability_policies WHERE id=_v4) <> 'homologated' THEN RAISE EXCEPTION 'v4 não homologada'; END IF;
  IF (SELECT homologation_act_ref FROM public.capability_policies WHERE id=_v4) IS NOT NULL THEN RAISE EXCEPTION 'v4 com ato'; END IF;
  IF (SELECT homologation_origin FROM public.capability_policies WHERE id=_v4) <> 'decisao-do-proprietario' THEN RAISE EXCEPTION 'v4 origem'; END IF;
  IF (SELECT valid_from FROM public.capability_policies WHERE id=_v4) <> DATE '2026-10-04' THEN RAISE EXCEPTION 'v4 vigência'; END IF;
  IF (SELECT status || '|' || homologation_origin || '|' || valid_from::text FROM public.capability_policies WHERE id=_v3) <> 'homologated|ativacao-inicial|2026-10-04'
     OR (SELECT homologation_act_ref FROM public.capability_policies WHERE id=_v3) IS NOT NULL THEN RAISE EXCEPTION 'v3 histórica alterada'; END IF;
  BEGIN UPDATE public.capability_policies SET valid_until = DATE '2030-01-01' WHERE id=_v4; RAISE EXCEPTION 'v4 mutável';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Versão homologada é imutável%' THEN RAISE; END IF; END;
  IF has_function_privilege('anon', 'public.capability_policy_homologation_issues(uuid,date)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.capability_policy_homologation_issues(uuid,date)', 'EXECUTE') THEN RAISE EXCEPTION 'issues aberto'; END IF;
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
           ('zz-r5-ano', 'zz-rasc', 1, 'zz', 'rascunho', DATE '2020-01-01');
  INSERT INTO public.institutional_curricular_matrices(id) VALUES (_m);
  INSERT INTO public.curricular_matrix_versions(matrix_id, version, change_kind, official_name, valid_from, originating_act_ref, recorded_by, recorded_via_engagement_id)
    VALUES (_m, 1, 'constituicao', 'zz-r5', DATE '2027-01-01', 'ato-ficticio', u, gen_random_uuid()) RETURNING id INTO _mv;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- homologação de política continua exigindo capability própria (sem ato não vira bypass)
  BEGIN PERFORM public.homologate_capability_policy(_v4, NULL, CURRENT_DATE); RAISE EXCEPTION 'política sem capability';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'capability:homologar-politica-de-capacidades' THEN RAISE; END IF; END;
  _ok := _ok || 'politica-gate ';

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
  -- E1 homologação sem ato (decisão interna), effective_from obrigatório, stale, já homologada, revogação sem ato, knownAt/validOn
  BEGIN PERFORM public.homologate_curricular_matrix_version(_mv, NULL, 'homologada', NULL, NULL, NULL); RAISE EXCEPTION 'sem efeito passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:effective-from-required' THEN RAISE; END IF; END;
  _t0 := clock_timestamp();
  h := public.homologate_curricular_matrix_version(_mv, NULL, 'homologada', DATE '2027-02-01', '  ', NULL);
  IF (SELECT homologation_act_ref FROM public.curricular_matrix_version_homologations WHERE id=(h->>'homologation_id')::uuid) IS NOT NULL THEN RAISE EXCEPTION 'e1 ref vazia não virou NULL'; END IF;
  IF (SELECT recorded_by::text || recorded_via_engagement_id::text || exercised_capability_id FROM public.curricular_matrix_version_homologations WHERE id=(h->>'homologation_id')::uuid)
     <> u::text || _eng::text || 'homologar-matrizes-curriculares' THEN RAISE EXCEPTION 'e1 proveniência'; END IF;
  IF (h->>'sequence')::int <> 1 THEN RAISE EXCEPTION 'e1 seq'; END IF;
  BEGIN PERFORM public.homologate_curricular_matrix_version(_mv, NULL, 'revogada', DATE '2027-03-01', 'ato', 'x'); RAISE EXCEPTION 'stale passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:stale-head' THEN RAISE; END IF; END;
  BEGIN PERFORM public.homologate_curricular_matrix_version(_mv, (h->>'homologation_id')::uuid, 'homologada', DATE '2027-03-01', 'ato', 'x'); RAISE EXCEPTION 'dupla passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:already-homologated' THEN RAISE; END IF; END;
  IF (SELECT homologation_state FROM public.curricular_matrix_homologation_state_at(DATE '2027-01-15', clock_timestamp()) WHERE version_id=_mv) <> 'nao-homologada' THEN RAISE EXCEPTION 'validOn antes do efeito'; END IF;
  IF (SELECT homologation_state FROM public.curricular_matrix_homologation_state_at(DATE '2027-02-15', _t0) WHERE version_id=_mv) <> 'nao-homologada' THEN RAISE EXCEPTION 'knownAt anterior'; END IF;
  IF (SELECT homologation_state FROM public.curricular_matrix_homologation_state_at(DATE '2027-02-15', clock_timestamp()) WHERE version_id=_mv) <> 'homologada' THEN RAISE EXCEPTION 'e1 reader'; END IF;
  BEGIN PERFORM public.homologate_curricular_matrix_version(_mv, (h->>'homologation_id')::uuid, 'revogada', DATE '2027-04-01', NULL, NULL); RAISE EXCEPTION 'revogação sem motivo passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'matrix-homologation:reason-required' THEN RAISE; END IF; END;
  r := public.homologate_curricular_matrix_version(_mv, (h->>'homologation_id')::uuid, 'revogada', DATE '2027-04-01', NULL, 'teste');
  IF (r->>'sequence')::int <> 2 THEN RAISE EXCEPTION 'e1 revogação'; END IF;
  IF (SELECT count(*) FROM public.curricular_matrix_homologation_history(_mv, clock_timestamp()) WHERE homologation_act_ref IS NULL) <> 2 THEN RAISE EXCEPTION 'e1 histórico sem ato'; END IF;
  r := public.homologate_curricular_matrix_version(_mv, (r->>'homologation_id')::uuid, 'homologada', DATE '2027-05-01', 'Deliberação documental zz', 'fonte real');
  IF (SELECT homologation_act_ref FROM public.curricular_matrix_version_homologations WHERE id=(r->>'homologation_id')::uuid) <> 'Deliberação documental zz' THEN RAISE EXCEPTION 'e1 ref real perdida'; END IF;
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
  r := public.record_correspondence_profile_version(NULL, NULL, 'constituicao', DATE '2027-01-01', NULL, NULL, NULL, ARRAY['zz-r5-ano'], NULL, '[]', NULL);
  IF (SELECT originating_act_ref FROM public.curricular_correspondence_profile_versions WHERE id=(r->>'version_id')::uuid) IS NOT NULL THEN RAISE EXCEPTION 'e2 ref'; END IF;
  BEGIN PERFORM public.record_correspondence_profile_version(NULL, NULL, 'constituicao', DATE '2027-06-01', NULL, NULL, 'ato', ARRAY['zz-r5-ano'], NULL, '[]', NULL); RAISE EXCEPTION 'overlap perfil passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'profile:overlaps-other-profile' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_correspondence_profile_version(r->>'profile_id', NULL, 'sucessao', DATE '2027-06-01', NULL, 'm', 'ato', ARRAY['zz-r5-ano'], NULL, '[]', NULL); RAISE EXCEPTION 'stale perfil passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'profile:base-superseded' THEN RAISE; END IF; END;
  r3 := public.record_correspondence_profile_version(r->>'profile_id', (r->>'version_id')::uuid, 'sucessao', DATE '2028-01-01', NULL, 'sucessao futura', 'fonte-documental-e2', ARRAY['zz-r5-ano'], NULL, '[]', NULL);
  BEGIN PERFORM public.record_correspondence_profile_version(NULL, NULL, 'constituicao', DATE '2027-07-01', DATE '2027-07-31', NULL, 'ato', ARRAY['zz-r5-ano'], NULL, '[]', NULL); RAISE EXCEPTION 'overlap histórico perfil passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'profile:overlaps-other-profile' THEN RAISE; END IF; END;
  IF (SELECT originating_act_ref FROM public.curricular_correspondence_profile_versions WHERE id=(r3->>'version_id')::uuid) <> 'fonte-documental-e2' THEN RAISE EXCEPTION 'e2 ref real perdida'; END IF;
  h := public.homologate_correspondence_profile_version((r->>'version_id')::uuid, NULL, 'homologada', DATE '2027-01-01', NULL, NULL);
  IF (SELECT count(*) FROM public.homologated_correspondence_profile_at(DATE '2027-03-01', clock_timestamp())) <> 1 THEN RAISE EXCEPTION 'e2 reader'; END IF;
  IF (SELECT homologation_state FROM public.curricular_correspondence_profiles_at(DATE '2027-03-01', clock_timestamp()) WHERE version_id=(r->>'version_id')::uuid) <> 'homologada' THEN RAISE EXCEPTION 'e2 reader estado'; END IF;
  PERFORM public.homologate_correspondence_profile_version((r->>'version_id')::uuid, (h->>'homologation_id')::uuid, 'revogada', DATE '2027-02-01', NULL, 'revogação interna');
  PERFORM public.homologate_correspondence_profile_version((r->>'version_id')::uuid,
    (SELECT id FROM public.curricular_correspondence_profile_homologations WHERE profile_version_id=(r->>'version_id')::uuid ORDER BY sequence DESC LIMIT 1),
    'homologada', DATE '2027-02-15', NULL, 'nova homologação');
  _ok := _ok || 'e2 ';

  -- E3: chave incompleta/divergente recusada; happy path; overlap mesma chave
  BEGIN PERFORM public.record_position_matrix_correspondence_version(NULL, r->>'profile_id', NULL, 'constituicao', DATE '2027-01-01', NULL, NULL, 'ato', _m, 'col-a',
      '[{"scheme":"zz-outro","value":"zz-um","version":1}]'); RAISE EXCEPTION 'chave divergente passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT IN ('correspondence:key-value-not-homologated','correspondence:key-schemes-mismatch') THEN RAISE; END IF; END;
  r2 := public.record_position_matrix_correspondence_version(NULL, r->>'profile_id', NULL, 'constituicao', DATE '2027-01-01', NULL, NULL, NULL, _m, 'col-a',
      '[{"scheme":"zz-r5-ano","value":"zz-um","version":1}]');
  BEGIN PERFORM public.record_position_matrix_correspondence_version(NULL, r->>'profile_id', NULL, 'constituicao', DATE '2027-05-01', NULL, NULL, 'ato', _m, 'col-b',
      '[{"scheme":"zz-r5-ano","value":"zz-um","version":1}]'); RAISE EXCEPTION 'overlap e3 passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'correspondence:overlap' THEN RAISE; END IF; END;
  r3 := public.record_position_matrix_correspondence_version(r2->>'correspondence_id', r->>'profile_id', (r2->>'version_id')::uuid, 'sucessao', DATE '2028-01-01', NULL, 'sucessao futura', 'ato-ficticio-e3-v2', _m, 'col-a',
      '[{"scheme":"zz-r5-ano","value":"zz-um","version":1}]');
  BEGIN PERFORM public.record_position_matrix_correspondence_version(NULL, r->>'profile_id', NULL, 'constituicao', DATE '2027-07-01', DATE '2027-07-31', NULL, 'ato', _m, 'col-b',
      '[{"scheme":"zz-r5-ano","value":"zz-um","version":1}]'); RAISE EXCEPTION 'overlap histórico e3 passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'correspondence:overlap' THEN RAISE; END IF; END;
  h := public.homologate_position_matrix_correspondence_version((r2->>'version_id')::uuid, NULL, 'homologada', DATE '2027-01-01', NULL, NULL);
  PERFORM public.homologate_position_matrix_correspondence_version((r2->>'version_id')::uuid, (h->>'homologation_id')::uuid, 'revogada', DATE '2027-02-01', '', 'revogação interna');
  IF (SELECT count(*) FROM public.curricular_position_matrix_correspondence_homologations WHERE correspondence_version_id=(r2->>'version_id')::uuid AND homologation_act_ref IS NULL) <> 2 THEN RAISE EXCEPTION 'e3 sem ato'; END IF;
  IF (SELECT originating_act_ref FROM public.curricular_position_matrix_correspondence_versions WHERE id=(r3->>'version_id')::uuid) <> 'ato-ficticio-e3-v2' THEN RAISE EXCEPTION 'e3 ref real perdida'; END IF;
  PERFORM 1 FROM public.curricular_position_matrix_correspondences_at(DATE '2027-03-01', clock_timestamp());
  _ok := _ok || 'e3 ';

  -- E4: turma sintética em rollback, happy path e overlap; turma inexistente também é recusada.
  BEGIN PERFORM public.record_class_specific_matrix_association_version(NULL, 'zz-inexistente', NULL, 'constituicao', DATE '2027-01-01', NULL, NULL, 'ato', _m, NULL); RAISE EXCEPTION 'turma inexistente passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'association:class-not-found' THEN RAISE; END IF; END;
  r := public.record_class_specific_matrix_association_version(NULL, _cls, NULL, 'constituicao', DATE '2027-01-01', NULL, NULL, NULL, _m, NULL);
  BEGIN PERFORM public.record_class_specific_matrix_association_version(NULL, _cls, NULL, 'constituicao', DATE '2027-03-01', NULL, NULL, 'ato', _m, NULL); RAISE EXCEPTION 'overlap e4 passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'association:overlap' THEN RAISE; END IF; END;
  r3 := public.record_class_specific_matrix_association_version(r->>'association_id', _cls, (r->>'version_id')::uuid, 'sucessao', DATE '2028-01-01', NULL, 'sucessao futura', 'ato-ficticio-e4-v2', _m, NULL);
  BEGIN PERFORM public.record_class_specific_matrix_association_version(NULL, _cls, NULL, 'constituicao', DATE '2027-07-01', DATE '2027-07-31', NULL, 'ato', _m, NULL); RAISE EXCEPTION 'overlap histórico e4 passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'association:overlap' THEN RAISE; END IF; END;
  h := public.homologate_class_specific_matrix_association_version((r->>'version_id')::uuid, NULL, 'homologada', DATE '2027-01-01', NULL, NULL);
  PERFORM public.homologate_class_specific_matrix_association_version((r->>'version_id')::uuid, (h->>'homologation_id')::uuid, 'revogada', DATE '2027-02-01', NULL, 'revogação interna');
  IF (SELECT specific_act_ref FROM public.class_specific_matrix_association_versions WHERE id=(r->>'version_id')::uuid) IS NOT NULL THEN RAISE EXCEPTION 'e4 ref'; END IF;
  IF (SELECT specific_act_ref FROM public.class_specific_matrix_association_versions WHERE id=(r3->>'version_id')::uuid) <> 'ato-ficticio-e4-v2' THEN RAISE EXCEPTION 'e4 ref real perdida'; END IF;
  PERFORM 1 FROM public.class_specific_matrix_associations_at(DATE '2027-03-01', clock_timestamp());
  _ok := _ok || 'e4 overlap-historico sem-ato ref-documental-preservada ';

  RAISE EXCEPTION 'r5-tests-ok: %', _ok;
END $t$;