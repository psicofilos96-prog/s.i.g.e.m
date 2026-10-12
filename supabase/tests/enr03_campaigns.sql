-- Matrículas L03: prova das campanhas persistidas. Tudo dentro de transação revertida; nada persiste.
BEGIN;
DO $$
DECLARE _c uuid; _ok boolean;
BEGIN
  -- RLS ligada e sem DML direta para authenticated/anon
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname IN ('enr_campaigns','enr_campaign_versions','enr_campaign_events') AND NOT relrowsecurity) THEN RAISE EXCEPTION 'FAIL rls'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants WHERE table_name LIKE 'enr_campaign%' AND grantee IN ('authenticated','anon') AND privilege_type IN ('INSERT','UPDATE','DELETE')) THEN RAISE EXCEPTION 'FAIL dml'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants WHERE table_name LIKE 'enr_campaign%' AND grantee = 'anon') THEN RAISE EXCEPTION 'FAIL anon'; END IF;
  IF has_function_privilege('anon','public.record_enr_campaign_event(uuid,int,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'FAIL anon exec'; END IF;
  IF has_function_privilege('authenticated','public.record_enr_campaign_version(uuid,int,text[],text[],uuid[],date,date,uuid,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'FAIL old overload'; END IF;
  -- Sem sessão (sem pessoa) o writer falha fechado
  BEGIN PERFORM public.create_enr_campaign(2027,'anual','matricula-inicial','k-proof'); RAISE EXCEPTION 'FAIL no-person accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'enr:%' THEN RAISE; END IF; END;
  -- Append-only
  INSERT INTO public.enr_campaigns(cycle_year,cycle_term,kind,author_person,idempotency_key) VALUES (2027,'anual','matricula-inicial',gen_random_uuid(),'k-ao') RETURNING id INTO _c;
  IF public.enr_campaign_state(_c) <> 'rascunho' THEN RAISE EXCEPTION 'FAIL initial state'; END IF;
  _ok := false; BEGIN UPDATE public.enr_campaigns SET kind='x' WHERE id=_c; EXCEPTION WHEN OTHERS THEN _ok := true; END;
  IF NOT _ok THEN RAISE EXCEPTION 'FAIL update allowed'; END IF;
  _ok := false; BEGIN INSERT INTO public.enr_campaign_events(campaign_id,seq,action,to_state,on_version,reason,person_id,idempotency_key)
    VALUES (_c,1,'publicar','homologada',1,'motivo suficiente',gen_random_uuid(),'k-bad'); EXCEPTION WHEN check_violation THEN _ok := true; END;
  IF NOT _ok THEN RAISE EXCEPTION 'FAIL unknown state accepted'; END IF;
  RAISE NOTICE 'enr03 PASS';
END $$;
ROLLBACK;
