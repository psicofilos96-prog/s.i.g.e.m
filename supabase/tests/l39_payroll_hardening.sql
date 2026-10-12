-- L39: prova de execução real do hardening da folha. Termina em RAISE ⇒ nada persiste.
-- Não cria pessoa, capability nem sessão humana; não imprime nome, data ou matrícula.
DO $t$
DECLARE r jsonb := '[]'::jsonb; base jsonb; sha text; pl jsonb; res jsonb; n0 int; n1 int; e text;
  lay jsonb := '["Matricula","Nome","Admissao","Horas mensais","Carga horária","CodCargo","Cargo","Nascimento"]';
  fake text := repeat('ab', 32); fake2 text := repeat('cd', 32); fake3 text := repeat('ef', 32);
  reg1 text;
BEGIN
  SELECT count(*) INTO n0 FROM public.payroll_functional_registrations;
  SELECT source_sha256 INTO sha FROM public.payroll_functional_registrations LIMIT 1;
  SELECT registration_raw INTO reg1 FROM public.payroll_functional_registrations ORDER BY row_no LIMIT 1;
  SELECT jsonb_agg(jsonb_build_object('row_no', row_no, 'registration_raw', registration_raw, 'full_name', full_name,
      'birth_date', birth_date::text, 'admission_date', admission_date::text, 'monthly_hours', monthly_hours,
      'weekly_workload_text', weekly_workload_text, 'cargo_code', cargo_code, 'cargo_label', cargo_label) ORDER BY row_no)
    INTO base FROM public.payroll_functional_registrations WHERE source_sha256 = sha;
  pl := jsonb_build_object('manifest', jsonb_build_object('source_hash', sha, 'source_ref', 'folha.xlsx', 'sheet', 'AGOSTO',
        'reference_period', '2026-08', 'row_count', jsonb_array_length(base), 'layout', lay), 'rows', base);

  -- T1 switch ausente ⇒ recusa
  BEGIN PERFORM public.technical_import_payroll_functional_registrations(sha, pl); r := r || '"T1 FAIL"';
  EXCEPTION WHEN OTHERS THEN r := r || to_jsonb('T1 ' || CASE WHEN SQLERRM LIKE '%payroll-import-disabled%' THEN 'PASS' ELSE 'FAIL '||SQLERRM END); END;

  INSERT INTO public.payroll_import_switch_events(enabled, decided_by, reason) VALUES (true, 'decisao-do-proprietario', 'teste isolado L39 (revertido)');

  -- T2 recarga do mesmo conteúdo ⇒ ja-carregado, sem duplicar
  res := public.technical_import_payroll_functional_registrations(sha, pl);
  SELECT count(*) INTO n1 FROM public.payroll_functional_registrations;
  r := r || to_jsonb('T2 ' || CASE WHEN res->>'status' = 'ja-carregado' AND n1 = n0 THEN 'PASS' ELSE 'FAIL '||res::text END);

  -- T3 mesmo hash, conteúdo diferente ⇒ recusa
  BEGIN PERFORM public.technical_import_payroll_functional_registrations(sha, jsonb_set(pl, '{rows,0,full_name}', '"X"')); r := r || '"T3 FAIL"';
  EXCEPTION WHEN OTHERS THEN r := r || to_jsonb('T3 ' || CASE WHEN SQLERRM LIKE '%payload-differs%' THEN 'PASS' ELSE 'FAIL '||SQLERRM END); END;

  -- T4 matrícula com letras (SM-MT) ⇒ rejeição individualizada, nada gravado
  BEGIN PERFORM public.technical_import_payroll_functional_registrations(fake, jsonb_build_object('manifest', jsonb_build_object('source_hash', fake, 'source_ref','t.xlsx','sheet','S','reference_period','2026-09','row_count',2,'layout',lay),
     'rows', jsonb_build_array(jsonb_build_object('row_no',2,'registration_raw','99999-1','full_name','Teste A'), jsonb_build_object('row_no',3,'registration_raw','SM-MT','full_name','Teste B')))); r := r || '"T4 FAIL"';
  EXCEPTION WHEN OTHERS THEN r := r || to_jsonb('T4 ' || CASE WHEN SQLERRM LIKE '%rows-rejected 1%matricula-nao-elegivel%' THEN 'PASS' ELSE 'FAIL '||SQLERRM END); END;

  -- T5 chave fora da allowlist (cpf) ⇒ recusa
  BEGIN PERFORM public.technical_import_payroll_functional_registrations(fake, jsonb_build_object('manifest', jsonb_build_object('source_hash', fake, 'source_ref','t.xlsx','sheet','S','reference_period','2026-09','row_count',1,'layout',lay),
     'rows', jsonb_build_array(jsonb_build_object('row_no',2,'registration_raw','99999-1','full_name','Teste A','cpf','x')))); r := r || '"T5 FAIL"';
  EXCEPTION WHEN OTHERS THEN r := r || to_jsonb('T5 ' || CASE WHEN SQLERRM LIKE '%row-key-not-allowed%' THEN 'PASS' ELSE 'FAIL '||SQLERRM END); END;

  -- T6 novo período: mesma matrícula de agosto + uma nova ⇒ histórico aceito (2 linhas)
  res := public.technical_import_payroll_functional_registrations(fake2, jsonb_build_object('manifest', jsonb_build_object('source_hash', fake2, 'source_ref','set.xlsx','sheet','S','reference_period','2026-09','row_count',2,'layout',lay),
     'rows', jsonb_build_array(jsonb_build_object('row_no',2,'registration_raw',reg1,'full_name','Teste A'), jsonb_build_object('row_no',3,'registration_raw','0099999-1','full_name','Teste B'))));
  SELECT count(*) INTO n1 FROM public.payroll_functional_registrations;
  r := r || to_jsonb('T6 ' || CASE WHEN res->>'status'='carregado' AND n1 = n0 + 2
       AND EXISTS (SELECT 1 FROM public.payroll_functional_registrations WHERE registration_norm = '00999991') THEN 'PASS' ELSE 'FAIL' END);

  -- T7 outro arquivo, mesmo período, mesma matrícula ⇒ recusa
  BEGIN PERFORM public.technical_import_payroll_functional_registrations(fake3, jsonb_build_object('manifest', jsonb_build_object('source_hash', fake3, 'source_ref','b.xlsx','sheet','S','reference_period','2026-09','row_count',1,'layout',lay),
     'rows', jsonb_build_array(jsonb_build_object('row_no',2,'registration_raw',reg1,'full_name','Teste A')))); r := r || '"T7 FAIL"';
  EXCEPTION WHEN OTHERS THEN r := r || to_jsonb('T7 ' || CASE WHEN SQLERRM LIKE '%registration-already-in-period%' THEN 'PASS' ELSE 'FAIL '||SQLERRM END); END;

  -- T8 matrícula repetida no próprio arquivo ⇒ recusa
  BEGIN PERFORM public.technical_import_payroll_functional_registrations(fake3, jsonb_build_object('manifest', jsonb_build_object('source_hash', fake3, 'source_ref','b.xlsx','sheet','S','reference_period','2026-10','row_count',2,'layout',lay),
     'rows', jsonb_build_array(jsonb_build_object('row_no',2,'registration_raw','88888-1','full_name','A'), jsonb_build_object('row_no',3,'registration_raw',' 88888-1 ','full_name','B')))); r := r || '"T8 FAIL"';
  EXCEPTION WHEN OTHERS THEN r := r || to_jsonb('T8 ' || CASE WHEN SQLERRM LIKE '%registration-repeated-in-source%' THEN 'PASS' ELSE 'FAIL '||SQLERRM END); END;

  -- T9 normalização estrita
  r := r || to_jsonb('T9 ' || CASE WHEN public.normalize_functional_registration('061725-3') = '0617253'
     AND public.normalize_functional_registration('SM-MT') IS NULL AND public.normalize_functional_registration('617253') IS NULL
     AND public.normalize_functional_registration('61.725-3') IS NULL AND public.functional_registration_format('617253') = 'numerica-sem-dv-ambigua' THEN 'PASS' ELSE 'FAIL' END);

  -- T10 privilégios: nenhum papel de aplicação escreve direto nem executa o carregador
  r := r || to_jsonb('T10 ' || CASE WHEN NOT has_table_privilege('service_role','public.payroll_functional_registrations','INSERT')
     AND NOT has_table_privilege('authenticated','public.payroll_functional_registrations','INSERT')
     AND NOT has_table_privilege('service_role','public.payroll_registration_person_links','INSERT')
     AND NOT has_table_privilege('service_role','public.payroll_import_switch_events','INSERT')
     AND NOT has_function_privilege('service_role','public.technical_import_payroll_functional_registrations(text,jsonb)','EXECUTE')
     AND NOT has_function_privilege('authenticated','public.technical_import_payroll_functional_registrations(text,jsonb)','EXECUTE')
     AND NOT has_function_privilege('anon','public.record_payroll_person_link(text,integer,text,uuid,text,text)','EXECUTE')
     AND NOT has_function_privilege('service_role','public.record_payroll_person_link(text,integer,text,uuid,text,text)','EXECUTE') THEN 'PASS' ELSE 'FAIL' END);

  -- T11 ligação sem sessão ⇒ recusa
  BEGIN PERFORM public.record_payroll_person_link('617253', 0, 'vincular', gen_random_uuid(), 'evidencia de teste', 'chave-teste-l39'); r := r || '"T11 FAIL"';
  EXCEPTION WHEN OTHERS THEN r := r || to_jsonb('T11 ' || CASE WHEN SQLERRM LIKE '%sem-sessao%' THEN 'PASS' ELSE 'FAIL '||SQLERRM END); END;

  -- T12 append-only mesmo para o dono
  BEGIN UPDATE public.payroll_functional_registrations SET full_name = full_name WHERE source_sha256 = sha AND row_no = 2; r := r || '"T12 FAIL"';
  EXCEPTION WHEN OTHERS THEN r := r || to_jsonb('T12 ' || CASE WHEN SQLERRM LIKE '%append-only%' THEN 'PASS' ELSE 'FAIL '||SQLERRM END); END;

  RAISE EXCEPTION 'L39-RESULT %', r;
END $t$;
