-- Prova 0107 (turmas, profissionais, jornadas). Termina em RAISE: nada persiste.
DO $$ DECLARE msg text; f text; r text;
BEGIN
  -- Nenhum app role executa núcleo ou operação técnica.
  FOREACH f IN ARRAY ARRAY['public.technical_import_educacenso_2026_classes(text,text,date,jsonb)',
    'public.technical_import_educacenso_2026_professionals(text,text,date,jsonb)',
    'public.technical_import_educacenso_2026_professional_schedules(text,text,date,jsonb)',
    'public.institutional_class_register_core(text,text,text,text,text,date,date,text,uuid,uuid,uuid,uuid,uuid)',
    'public.technical_cpf_hmac(text)'] LOOP
    FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF has_function_privilege(r, f, 'EXECUTE') THEN RAISE EXCEPTION 'FAIL privilege % %', r, f; END IF;
    END LOOP;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_table_privilege(r, 'public.institutional_person_identifiers', 'SELECT') OR has_table_privilege(r, 'public.technical_identity_secrets', 'SELECT')
       OR has_table_privilege(r, 'public.technical_payload_staging', 'SELECT') OR has_table_privilege(r, 'public.class_census_declarations', 'INSERT')
    THEN RAISE EXCEPTION 'FAIL table privilege %', r; END IF;
  END LOOP;
  -- Kind errado e hash inválido.
  BEGIN PERFORM public.technical_import_educacenso_2026_classes('x', repeat('a',64), '2026-07-31', '{}'); RAISE EXCEPTION 'FAIL kind';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:operation-kind-mismatch' THEN RAISE EXCEPTION 'FAIL kind %', msg; END IF; END;
  BEGIN PERFORM public.technical_import_educacenso_2026_professionals('technical_import_educacenso_2026_professionals', 'xyz', '2026-07-31', '{}'); RAISE EXCEPTION 'FAIL hash';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:source-hash-invalid' THEN RAISE EXCEPTION 'FAIL hash %', msg; END IF; END;
  -- CPF inválido nunca cria pessoa.
  IF public.technical_cpf_valid('11111111111') OR public.technical_cpf_valid('12345678900') THEN RAISE EXCEPTION 'FAIL cpf'; END IF;
  -- Append-only.
  BEGIN UPDATE public.class_census_declarations SET value_text = 'x' WHERE true; RAISE EXCEPTION 'FAIL append-only';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg LIKE 'FAIL%' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.institutional_person_identifiers WHERE true; RAISE EXCEPTION 'FAIL append-only ids';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg LIKE 'FAIL%' THEN RAISE; END IF; END;
  -- Autoria XOR: versão sem humano e sem operação é recusada.
  BEGIN
    INSERT INTO public.institutional_class_record_versions(class_id, segment_id, version, name, administrative_status, valid_from)
    SELECT id, gen_random_uuid(), 99, 'x', 'ativa', valid_from FROM public.institutional_classes LIMIT 1;
    RAISE EXCEPTION 'FAIL xor';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- Nenhuma autoria humana falsificada pela carga.
  IF EXISTS (SELECT 1 FROM public.institutional_class_record_versions WHERE technical_operation_id IS NOT NULL AND recorded_by IS NOT NULL) THEN RAISE EXCEPTION 'FAIL author'; END IF;
  IF EXISTS (SELECT 1 FROM public.professional_functional_links WHERE technical_operation_id IS NOT NULL AND author_user_id IS NOT NULL) THEN RAISE EXCEPTION 'FAIL author link'; END IF;
  -- Automação desligada ⇒ recusa.
  INSERT INTO public.technical_automation_settings(setting_key, enabled, decided_by, reason) VALUES ('development_automation_enabled', false, 'decisao-do-proprietario', 'prova');
  BEGIN PERFORM public.technical_import_educacenso_2026_classes('technical_import_educacenso_2026_classes', repeat('a',64), '2026-07-31', '{}'); RAISE EXCEPTION 'FAIL disabled';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:automation-disabled' THEN RAISE EXCEPTION 'FAIL disabled %', msg; END IF; END;
  RAISE EXCEPTION 'OK educacenso_2026_c_d_e (rollback)';
END $$;
