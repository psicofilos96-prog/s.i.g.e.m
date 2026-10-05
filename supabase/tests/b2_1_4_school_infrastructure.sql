-- 0105: infraestrutura como fatos versionados. Payload sintético. Termina em RAISE; nada persiste.
DO $T$ DECLARE h1 text := repeat('a',64); h2 text := repeat('b',64); p jsonb; op uuid; op2 uuid; msg text; c int; r record;
BEGIN
  p := jsonb_build_object(
    'manifest', jsonb_build_object('source_hash',h1,'source_ref','sintetico.xlsx','attribute_count',3,'observation_count',4,'school_count',2),
    'attributes', jsonb_build_array(
      jsonb_build_object('attribute_id','agua-potavel','label','Água potável','value_type','boolean','source_field','IN_AGUA_POTAVEL'),
      jsonb_build_object('attribute_id','salas-utilizadas','label','Salas utilizadas','value_type','integer'),
      jsonb_build_object('attribute_id','abastecimento-agua','label','Abastecimento','value_type','catalog','catalog_values',jsonb_build_array('Rede pública','Poço'))),
    'observations', jsonb_build_array(
      jsonb_build_object('inep','33094756','attribute_id','agua-potavel','value',false,'source_locator','linha 2'),
      jsonb_build_object('inep','33094756','attribute_id','salas-utilizadas','value',0),
      jsonb_build_object('inep','33100012','attribute_id','salas-utilizadas','value',7),
      jsonb_build_object('inep','33100012','attribute_id','abastecimento-agua','value','Poço')));
  -- payload/hash inválidos
  BEGIN PERFORM public.technical_import_educacenso_2026_infrastructure('technical_import_educacenso_2026_infrastructure','xyz','2026-08-31',p); RAISE EXCEPTION 'FAIL hash';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:source-hash-invalid' THEN RAISE EXCEPTION 'FAIL hash %', msg; END IF; END;
  BEGIN PERFORM public.technical_import_educacenso_2026_infrastructure('technical_import_educacenso_2026_infrastructure',h2,'2026-08-31',p); RAISE EXCEPTION 'FAIL manifest';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:manifest-hash-mismatch' THEN RAISE EXCEPTION 'FAIL manifest %', msg; END IF; END;
  BEGIN PERFORM public.technical_import_educacenso_2026_infrastructure('technical_import_educacenso_2026_infrastructure',h1,'2026-08-31',jsonb_set(p,'{manifest,observation_count}','5')); RAISE EXCEPTION 'FAIL count';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:count-observations' THEN RAISE EXCEPTION 'FAIL count %', msg; END IF; END;
  -- escola inexistente
  BEGIN PERFORM public.technical_import_educacenso_2026_infrastructure('technical_import_educacenso_2026_infrastructure',h1,'2026-08-31',
    jsonb_set(p,'{observations,0,inep}','"99999999"')); RAISE EXCEPTION 'FAIL school';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg NOT IN ('technical:school-not-found','technical:count-schools') THEN RAISE EXCEPTION 'FAIL school %', msg; END IF; END;
  -- INEP+atributo duplicado
  BEGIN PERFORM public.technical_import_educacenso_2026_infrastructure('technical_import_educacenso_2026_infrastructure',h1,'2026-08-31',
    jsonb_set(jsonb_set(p,'{observations,1,attribute_id}','"agua-potavel"'),'{observations,1,value}','true')); RAISE EXCEPTION 'FAIL dup';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:duplicate-inep-attribute' THEN RAISE EXCEPTION 'FAIL dup %', msg; END IF; END;
  -- atributo não declarado
  BEGIN PERFORM public.technical_import_educacenso_2026_infrastructure('technical_import_educacenso_2026_infrastructure',h1,'2026-08-31',
    jsonb_set(p,'{observations,0,attribute_id}','"inexistente"')); RAISE EXCEPTION 'FAIL attr';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:attribute-undeclared' THEN RAISE EXCEPTION 'FAIL attr %', msg; END IF; END;
  -- primeira carga
  op := public.technical_import_educacenso_2026_infrastructure('technical_import_educacenso_2026_infrastructure',h1,'2026-08-31',p);
  SELECT count(*) INTO c FROM public.school_infrastructure_observations WHERE technical_operation_id = op; IF c <> 4 THEN RAISE EXCEPTION 'FAIL first %', c; END IF;
  -- false e 0 gravados; ausente não gera linha
  SELECT * INTO r FROM public.school_infrastructure_observations WHERE school_id='inep-33094756' AND attribute_id='agua-potavel';
  IF r.value_boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'FAIL false'; END IF;
  SELECT * INTO r FROM public.school_infrastructure_observations WHERE school_id='inep-33094756' AND attribute_id='salas-utilizadas';
  IF r.value_integer IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'FAIL zero'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_infrastructure_observations WHERE school_id='inep-33100012' AND attribute_id='agua-potavel') THEN RAISE EXCEPTION 'FAIL absent'; END IF;
  -- nenhuma autoria humana
  IF EXISTS (SELECT 1 FROM public.school_infrastructure_observations WHERE technical_operation_id=op AND num_nonnulls(author_user_id,author_person_id,authorizing_engagement_id)>0) THEN RAISE EXCEPTION 'FAIL authorship'; END IF;
  -- retry idempotente
  op2 := public.technical_import_educacenso_2026_infrastructure('technical_import_educacenso_2026_infrastructure',h1,'2026-08-31',p);
  IF op2 <> op THEN RAISE EXCEPTION 'FAIL idem'; END IF;
  SELECT count(*) INTO c FROM public.school_infrastructure_observations; IF c <> 4 THEN RAISE EXCEPTION 'FAIL idem rows %', c; END IF;
  BEGIN PERFORM public.technical_import_educacenso_2026_infrastructure('technical_import_educacenso_2026_infrastructure',h1,'2026-08-31',jsonb_set(p,'{observations,2,value}','8')); RAISE EXCEPTION 'FAIL differs';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:payload-differs-from-recorded-operation' THEN RAISE EXCEPTION 'FAIL differs %', msg; END IF; END;
  -- mudança entre snapshots: nova fonte, nova observação; anterior intacta
  PERFORM public.school_infrastructure_observation_core('inep-33100012','salas-utilizadas','9'::jsonb,'2026-09-30',h2,'outro.xlsx',NULL,NULL,NULL,NULL,NULL);
  SELECT count(*) INTO c FROM public.school_infrastructure_observations WHERE school_id='inep-33100012' AND attribute_id='salas-utilizadas'; IF c <> 2 THEN RAISE EXCEPTION 'FAIL snapshot'; END IF;
  -- tipos e catálogo
  BEGIN PERFORM public.school_infrastructure_observation_core('inep-33100012','abastecimento-agua','"Cisterna"'::jsonb,'2026-09-30',h2,'x',NULL,NULL,NULL,NULL,NULL); RAISE EXCEPTION 'FAIL catalog';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'infra:catalog-value-unknown' THEN RAISE EXCEPTION 'FAIL catalog %', msg; END IF; END;
  BEGIN PERFORM public.school_infrastructure_observation_core('inep-33100012','agua-potavel','null'::jsonb,'2026-09-30',h2,'x',NULL,NULL,NULL,NULL,NULL); RAISE EXCEPTION 'FAIL null';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'infra:value-absent-is-not-informed' THEN RAISE EXCEPTION 'FAIL null %', msg; END IF; END;
  BEGIN PERFORM public.school_infrastructure_observation_core('inep-33100012','inexistente','1'::jsonb,'2026-09-30',h2,'x',NULL,NULL,NULL,NULL,NULL); RAISE EXCEPTION 'FAIL unknown';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'infra:attribute-unknown' THEN RAISE EXCEPTION 'FAIL unknown %', msg; END IF; END;
  -- append-only
  BEGIN UPDATE public.school_infrastructure_observations SET value_integer = 1 WHERE technical_operation_id = op; RAISE EXCEPTION 'FAIL immut';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg LIKE 'FAIL%' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.technical_execution_operations WHERE id = op; RAISE EXCEPTION 'FAIL ledger';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg LIKE 'FAIL%' THEN RAISE; END IF; END;
  -- app roles sem acesso técnico; writer humano sem sessão recusa (outro escopo/sem capability)
  IF has_function_privilege('authenticated','public.technical_import_educacenso_2026_infrastructure(text,text,date,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.technical_import_educacenso_2026_infrastructure(text,text,date,jsonb)','EXECUTE')
     OR has_function_privilege('service_role','public.technical_import_educacenso_2026_infrastructure(text,text,date,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.school_infrastructure_observation_core(text,text,jsonb,date,text,text,text,uuid,uuid,uuid,uuid)','EXECUTE')
     OR has_table_privilege('service_role','public.school_infrastructure_observations','INSERT')
     OR has_table_privilege('authenticated','public.school_infrastructure_observations','INSERT')
     OR has_table_privilege('anon','public.school_infrastructure_observations','SELECT') THEN RAISE EXCEPTION 'FAIL privileges'; END IF;
  BEGIN PERFORM public.record_school_infrastructure_observation('inep-33100012','salas-utilizadas','3'::jsonb,'2026-10-01',h2,'x'); RAISE EXCEPTION 'FAIL session';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'Sessão ausente' THEN RAISE EXCEPTION 'FAIL session %', msg; END IF; END;
  -- automação desabilitada
  INSERT INTO public.technical_automation_settings(setting_key, enabled, decided_by, reason) VALUES ('development_automation_enabled', false, 'teste', 'teste');
  BEGIN PERFORM public.technical_import_educacenso_2026_infrastructure('technical_import_educacenso_2026_infrastructure',h2,'2026-08-31',p); RAISE EXCEPTION 'FAIL disabled';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:automation-disabled' THEN RAISE EXCEPTION 'FAIL disabled %', msg; END IF; END;
  RAISE EXCEPTION 'TEST-OK b2_1_4 (rollback)';
END $T$;
