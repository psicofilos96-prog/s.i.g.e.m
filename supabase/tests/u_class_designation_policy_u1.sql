-- Frente U.1 (0127/0128) — prova no banco; termina em RAISE (nada persiste). Dados sintéticos.
DO $t$
DECLARE y27 text := 'ano-500f63b6-b71d-4000-9762-bbb65c40d21d'; y26 text := 'ano-431ece00-be5c-41ed-a430-75ba853b0831';
  on27 date; ok boolean; n integer; ef1 uuid; ef2 uuid; eja uuid; old26 uuid; other uuid; t text; rid uuid;
  ef jsonb := '{"prefixes":{"ef-5-ano":"5"},"first_ordinal":0,"ordinal_width":2}'; ej jsonb := '{"prefixes":{"eja-fase-i":"9"},"first_ordinal":0,"ordinal_width":2}';
BEGIN
  -- 1) service_role sem DML direto nas quatro tabelas
  FOREACH t IN ARRAY ARRAY['class_designation_policy_versions','class_designation_policy_homologations','class_designation_category_versions','class_designation_reservations'] LOOP
    IF has_table_privilege('service_role', 'public.'||t, 'INSERT') OR has_table_privilege('service_role', 'public.'||t, 'UPDATE')
       OR has_table_privilege('service_role', 'public.'||t, 'DELETE') OR has_table_privilege('authenticated', 'public.'||t, 'INSERT')
        THEN RAISE EXCEPTION 'falha: dml %', t; END IF;
  END LOOP;
  IF has_function_privilege('service_role','public.assign_class_designation(text,integer,text)','EXECUTE')
     OR has_function_privilege('service_role','public.record_class_designation_category(text,text,integer,text)','EXECUTE')
     OR has_function_privilege('service_role','public.draft_class_designation_policy(text,integer,text,jsonb,date,date,text)','EXECUTE')
     OR has_function_privilege('anon','public.assign_class_designation(text,integer,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.designation_policies_for_category(text,date)','EXECUTE')
     OR has_function_privilege('authenticated','public.designation_year_valid_on(text)','EXECUTE')
     THEN RAISE EXCEPTION 'falha: acl writers'; END IF;

  -- 2) vigência pelo ano letivo canônico, não pelo relógio
  on27 := public.designation_year_valid_on(y27);
  IF on27 <> '2027-01-01' THEN RAISE EXCEPTION 'falha: data canônica %', on27; END IF;
  IF pg_get_functiondef('public.assign_class_designation(text,integer,text)'::regprocedure) LIKE '%CURRENT_DATE%' THEN RAISE EXCEPTION 'falha: CURRENT_DATE'; END IF;
  INSERT INTO public.class_designation_policy_versions(policy_key, version, criterion_type, criterion_params, valid_from, valid_until, drafted_by, drafted_by_person_id)
  VALUES ('u1-ef', 1, 'ordinal-por-categoria', ef, '2027-01-01', NULL, gen_random_uuid(), gen_random_uuid()) RETURNING id INTO ef1;
  INSERT INTO public.class_designation_policy_versions(policy_key, version, criterion_type, criterion_params, valid_from, valid_until, drafted_by, drafted_by_person_id)
  VALUES ('u1-ef-2026', 1, 'ordinal-por-categoria', ef, '2026-01-01', '2026-12-31', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO old26;
  -- draft nunca entra
  SELECT count(*) INTO n FROM public.designation_policies_for_category('ef-5-ano', on27);
  IF n <> 0 THEN RAISE EXCEPTION 'falha: rascunho entrou'; END IF;
  INSERT INTO public.class_designation_policy_homologations(policy_version_id, homologated_by, homologated_by_person_id, reason)
  VALUES (ef1, gen_random_uuid(), gen_random_uuid(), 'sintético'), (old26, gen_random_uuid(), gen_random_uuid(), 'sintético');
  -- política 2027 resolve hoje (2026) para a turma 2027; a de 2026 não nomeia 2027
  SELECT count(*) INTO n FROM public.designation_policies_for_category('ef-5-ano', on27) f WHERE (f.policy).id = ef1 AND f.chain_ok;
  IF n <> 1 THEN RAISE EXCEPTION 'falha: 2027 não resolve'; END IF;
  SELECT count(*) INTO n FROM public.designation_policies_for_category('ef-5-ano', on27) f WHERE (f.policy).id = old26;
  IF n <> 0 THEN RAISE EXCEPTION 'falha: política 2026 nomeia 2027'; END IF;
  -- ano histórico continua não gravável
  ok := false; BEGIN PERFORM public.designation_year_writable(y26); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'designation:year-not-writable'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: 2026 gravável'; END IF;

  -- 3) ambiguidade por categoria
  INSERT INTO public.class_designation_policy_versions(policy_key, version, criterion_type, criterion_params, valid_from, drafted_by, drafted_by_person_id)
  VALUES ('u1-eja', 1, 'ordinal-por-categoria', ej, '2027-01-01', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO eja;
  INSERT INTO public.class_designation_policy_homologations(policy_version_id, homologated_by, homologated_by_person_id, reason) VALUES (eja, gen_random_uuid(), gen_random_uuid(), 'sintético');
  SELECT count(*) INTO n FROM public.designation_policies_for_category('ef-5-ano', on27);
  IF n <> 1 THEN RAISE EXCEPTION 'falha: EJA tornou EF ambíguo'; END IF;
  SELECT count(*) INTO n FROM public.designation_policies_for_category('ei-maternal', on27);
  IF n <> 0 THEN RAISE EXCEPTION 'falha: categoria sem política'; END IF;
  -- versão sucessora da mesma chave não é falsa ambiguidade
  INSERT INTO public.class_designation_policy_versions(policy_key, version, supersedes_id, criterion_type, criterion_params, valid_from, drafted_by, drafted_by_person_id)
  VALUES ('u1-ef', 2, ef1, 'ordinal-por-categoria', ef, '2027-01-01', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO ef2;
  INSERT INTO public.class_designation_policy_homologations(policy_version_id, homologated_by, homologated_by_person_id, reason) VALUES (ef2, gen_random_uuid(), gen_random_uuid(), 'sintético');
  SELECT count(*) INTO n FROM public.designation_policies_for_category('ef-5-ano', on27) f WHERE f.chain_ok;
  IF n <> 1 OR NOT EXISTS (SELECT 1 FROM public.designation_policies_for_category('ef-5-ano', on27) f WHERE (f.policy).id = ef2) THEN RAISE EXCEPTION 'falha: sucessora ambígua'; END IF;
  -- designação registrada preserva a versão usada quando a política muda
  INSERT INTO public.class_designation_reservations(class_id, class_sequence, school_id, academic_year_id, category_id, ordinal, designation, policy_version_id, reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  SELECT c.id, 1, c.school_id, y27, 'ef-5-ano', 0, '500', ef1, 'sintético', gen_random_uuid(), gen_random_uuid(), gen_random_uuid() FROM public.institutional_classes c LIMIT 1 RETURNING id INTO rid;
  IF (SELECT policy_version_id FROM public.class_designation_reservations WHERE id = rid) <> ef1 THEN RAISE EXCEPTION 'falha: histórico'; END IF;
  -- duas chaves distintas cobrindo ef-5-ano ⇒ duas linhas (writer recusa ambiguous-policies)
  INSERT INTO public.class_designation_policy_versions(policy_key, version, criterion_type, criterion_params, valid_from, drafted_by, drafted_by_person_id)
  VALUES ('u1-ef-outra', 1, 'ordinal-por-categoria', ef, '2027-01-01', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO other;
  INSERT INTO public.class_designation_policy_homologations(policy_version_id, homologated_by, homologated_by_person_id, reason) VALUES (other, gen_random_uuid(), gen_random_uuid(), 'sintético');
  SELECT count(*) INTO n FROM public.designation_policies_for_category('ef-5-ano', on27);
  IF n <> 2 THEN RAISE EXCEPTION 'falha: ambiguidade não detectada'; END IF;
  IF pg_get_functiondef('public.assign_class_designation(text,integer,text)'::regprocedure) NOT LIKE '%_n > 1 THEN RAISE EXCEPTION ''designation:ambiguous-policies''%' THEN RAISE EXCEPTION 'falha: writer sem ambiguidade'; END IF;

  -- 4) cadeia: raiz v1, mesma chave, +1, sem bifurcação
  ok := false; BEGIN INSERT INTO public.class_designation_policy_versions(policy_key, version, criterion_type, criterion_params, valid_from, drafted_by, drafted_by_person_id) VALUES ('u1-x', 2, 'ordinal-por-categoria', ef, '2027-01-01', gen_random_uuid(), gen_random_uuid()); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'designation:chain-root-not-v1'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: raiz'; END IF;
  ok := false; BEGIN INSERT INTO public.class_designation_policy_versions(policy_key, version, supersedes_id, criterion_type, criterion_params, valid_from, drafted_by, drafted_by_person_id) VALUES ('u1-x', 2, ef1, 'ordinal-por-categoria', ef, '2027-01-01', gen_random_uuid(), gen_random_uuid()); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'designation:chain-foreign-predecessor'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: outra chave'; END IF;
  ok := false; BEGIN INSERT INTO public.class_designation_policy_versions(policy_key, version, supersedes_id, criterion_type, criterion_params, valid_from, drafted_by, drafted_by_person_id) VALUES ('u1-ef', 4, ef2, 'ordinal-por-categoria', ef, '2027-01-01', gen_random_uuid(), gen_random_uuid()); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'designation:chain-version-gap'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: salto'; END IF;
  ok := false; BEGIN INSERT INTO public.class_designation_policy_versions(policy_key, version, supersedes_id, criterion_type, criterion_params, valid_from, drafted_by, drafted_by_person_id) VALUES ('u1-ef', 2, ef1, 'ordinal-por-categoria', ef, '2027-01-01', gen_random_uuid(), gen_random_uuid()); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'designation:chain-fork'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: bifurcação'; END IF;
  ok := false; BEGIN INSERT INTO public.class_designation_policy_versions(policy_key, version, criterion_type, criterion_params, valid_from, drafted_by, drafted_by_person_id) VALUES ('u1-ef', 1, 'ordinal-por-categoria', ef, '2027-01-01', gen_random_uuid(), gen_random_uuid()); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'designation:chain-second-root'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: segunda raiz'; END IF;
  -- legado inconsistente simulado (gatilho desligado só nesta transação) ⇒ resolver sinaliza chain_ok = false
  ALTER TABLE public.class_designation_policy_versions DISABLE TRIGGER class_designation_policy_chain;
  INSERT INTO public.class_designation_policy_versions(policy_key, version, criterion_type, criterion_params, valid_from, drafted_by, drafted_by_person_id) VALUES ('u1-eja', 3, 'ordinal-por-categoria', ej, '2027-01-01', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO rid;
  ALTER TABLE public.class_designation_policy_versions ENABLE TRIGGER class_designation_policy_chain;
  INSERT INTO public.class_designation_policy_homologations(policy_version_id, homologated_by, homologated_by_person_id, reason) VALUES (rid, gen_random_uuid(), gen_random_uuid(), 'sintético');
  IF NOT EXISTS (SELECT 1 FROM public.designation_policies_for_category('eja-fase-i', on27) f WHERE NOT f.chain_ok) THEN RAISE EXCEPTION 'falha: legado inconsistente aceito'; END IF;

  -- authenticated sem pessoa recusa antes de escrever
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ok := false; BEGIN PERFORM public.assign_class_designation('x', 0, 'x'); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'designation:no-person'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: sem pessoa'; END IF;
  RESET ROLE;
  RAISE EXCEPTION 'u1-designation-tests-ok';
END $t$;
