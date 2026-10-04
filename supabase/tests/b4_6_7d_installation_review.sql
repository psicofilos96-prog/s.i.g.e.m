-- B4.6.7 Fatia 4 — teste reproduzível (rollback por RAISE final; nada persiste).
-- Positivo real exige a conta legítima supervisao@sigem.itap.gov.br confirmada: não é simulado aqui
-- (nenhuma linha fictícia em auth.users, nenhuma impersonação).
DO $$
DECLARE r jsonb; ok boolean;
BEGIN
  -- designação única, preservada, com origem auditada
  IF (SELECT count(*) FROM public.sigem_installer_designation) <> 1 THEN RAISE EXCEPTION 'T1 designação'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sigem_installer_designation_origins WHERE outcome IN ('designacao-registrada','designacao-existente-preservada')) THEN RAISE EXCEPTION 'T2 origem'; END IF;
  BEGIN UPDATE public.sigem_installer_designation SET installer_email = 'x@x' WHERE singleton; RAISE EXCEPTION 'T3 mutável';
  EXCEPTION WHEN others THEN IF SQLERRM = 'T3 mutável' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.sigem_installer_designation_origins WHERE outcome IS NOT NULL; RAISE EXCEPTION 'T4 origem mutável';
  EXCEPTION WHEN others THEN IF SQLERRM = 'T4 origem mutável' THEN RAISE; END IF; END;
  -- privilégios
  IF has_function_privilege('anon','public.installation_review()','EXECUTE') THEN RAISE EXCEPTION 'T5 anon review'; END IF;
  IF has_function_privilege('anon','public.install_sigem_reviewed(text,text,text,text,text,text,uuid,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'T6 anon install'; END IF;
  IF has_function_privilege('authenticated','public.install_sigem(text,text,text,text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'T7 porta antiga aberta'; END IF;
  -- usuário autenticado não designado (uid sem conta) ⇒ access-denied, sem metadados
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b467","role":"authenticated"}', true);
  PERFORM set_config('role', 'authenticated', true);
  r := public.installation_review();
  IF r <> '{"contract":"b4.6.7e/1","state":"access-denied"}'::jsonb THEN RAISE EXCEPTION 'T8 oracle %', r; END IF;
  BEGIN PERFORM public.install_sigem_reviewed('a','orgao-institucional','n','i','k','l', gen_random_uuid(), repeat('a',64), true); RAISE EXCEPTION 'T9 instalou';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'install:unauthenticated' THEN RAISE EXCEPTION 'T9 % ', SQLERRM; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT state FROM public.sigem_installation_state) <> 'nao-instalado' THEN RAISE EXCEPTION 'T10 estado'; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policies WHERE status <> 'draft') THEN RAISE EXCEPTION 'T11 política homologada'; END IF;
  RAISE EXCEPTION 'B467D-OK';
END $$;
