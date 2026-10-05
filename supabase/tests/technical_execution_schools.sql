-- Camada de execução técnica (0100): provas executáveis; o bloco termina em RAISE e nada persiste.
-- Pré-condição: carga das 55 unidades já executada (operação concluída no ledger).
DO $T$ DECLARE msg text; h text := 'fd2e288bf598fcedce527470a54601eabf96d46a19e85ce03672254954a3d494'; k text := 'technical_import_educacenso_2026_schools';
BEGIN
  IF (SELECT count(*) FROM public.technical_execution_operations WHERE operation_kind = k AND status = 'concluida') <> 1 THEN RAISE EXCEPTION 'FAIL ledger'; END IF;
  IF EXISTS (SELECT 1 FROM public.institutional_school_record_versions WHERE author_user_id IS NOT NULL OR author_person_id IS NOT NULL OR authorizing_engagement_id IS NOT NULL) THEN RAISE EXCEPTION 'FAIL authorship'; END IF;
  IF has_function_privilege('authenticated','public.technical_import_educacenso_2026_schools(text,text,date,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.technical_import_educacenso_2026_schools(text,text,date,jsonb)','EXECUTE')
     OR has_function_privilege('service_role','public.technical_import_educacenso_2026_schools(text,text,date,jsonb)','EXECUTE')
     OR has_table_privilege('authenticated','public.technical_execution_operations','SELECT') THEN RAISE EXCEPTION 'FAIL app-role access'; END IF;
  BEGIN PERFORM public.technical_import_educacenso_2026_schools('x',h,'2026-08-31','[]'); RAISE EXCEPTION 'FAIL kind'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:operation-kind-mismatch' THEN RAISE EXCEPTION 'FAIL kind %',msg; END IF; END;
  BEGIN PERFORM public.technical_import_educacenso_2026_schools(k,repeat('0',64),'2026-08-31','[]'); RAISE EXCEPTION 'FAIL hash'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:source-hash-mismatch' THEN RAISE EXCEPTION 'FAIL hash %',msg; END IF; END;
  BEGIN PERFORM public.technical_import_educacenso_2026_schools(k,h,'2026-08-31','[]'); RAISE EXCEPTION 'FAIL count'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:count-total' THEN RAISE EXCEPTION 'FAIL count %',msg; END IF; END;
  BEGIN UPDATE public.technical_execution_operations SET environment = 'x'; RAISE EXCEPTION 'FAIL appendonly'; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg LIKE 'FAIL%' THEN RAISE; END IF; END;
  INSERT INTO public.technical_automation_settings(setting_key, enabled, decided_by, reason) VALUES ('development_automation_enabled', false, 'teste', 'teste');
  BEGIN PERFORM public.technical_import_educacenso_2026_schools(k,h,'2026-08-31','[]'); RAISE EXCEPTION 'FAIL disabled'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:automation-disabled' THEN RAISE EXCEPTION 'FAIL disabled %',msg; END IF; END;
  RAISE EXCEPTION 'TEST-OK-ROLLBACK';
END $T$;
