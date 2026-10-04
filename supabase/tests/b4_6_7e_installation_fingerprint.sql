-- B4.6.7e — impressão digital canônica da revisão da instalação (0038).
-- Reproduzível; rollback total por RAISE final (nada persiste). Atores fictícios apenas:
-- um usuário fictício em auth.users com e-mail @test.invalid (NUNCA o e-mail designado), removido pelo rollback.
-- O positivo de instalação NÃO é exercitado: exigiria identidade com o e-mail designado, que não é forjada.
-- Prova-se que impressão válida passa a verificação e só então install_sigem recusa o não-instalador.
DO $$
DECLARE r jsonb; _pid uuid; _fp text; _fp2 text; _rule uuid; _cap text; _u uuid := '00000000-0000-0000-0000-00000000b46e';
BEGIN
  IF has_function_privilege('authenticated','public.install_sigem_reviewed(text,text,text,text,text,uuid,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'E0 assinatura sem natureza aberta'; END IF;
  -- ACL
  IF has_function_privilege('authenticated','public.install_sigem_reviewed(text,text,text,text,text,uuid,integer,boolean)','EXECUTE') THEN RAISE EXCEPTION 'E1 contagem aberta'; END IF;
  IF has_function_privilege('anon','public.install_sigem_reviewed(text,text,text,text,text,text,uuid,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'E2 anon'; END IF;
  IF NOT has_function_privilege('authenticated','public.install_sigem_reviewed(text,text,text,text,text,text,uuid,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'E3 sem porta'; END IF;
  IF has_function_privilege('authenticated','public.sigem_policy_fingerprint(uuid)','EXECUTE') THEN RAISE EXCEPTION 'E4 fp público'; END IF;
  IF has_function_privilege('authenticated','public.install_sigem(text,text,text,text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'E5 porta antiga'; END IF;

  SELECT p.id INTO _pid FROM public.capability_policies p WHERE p.status = 'draft'
    AND EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE policy_id = p.id) ORDER BY p.version LIMIT 1;
  IF _pid IS NULL THEN RAISE EXCEPTION 'E6 sem política draft'; END IF;
  _fp := public.sigem_policy_fingerprint(_pid);
  IF _fp !~ '^[0-9a-f]{64}$' OR _fp <> public.sigem_policy_fingerprint(_pid) THEN RAISE EXCEPTION 'E7 fp não determinística'; END IF;

  -- não autenticado
  PERFORM set_config('request.jwt.claims', '', true); PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.install_sigem_reviewed('a','orgao-institucional','n','i','k','l', _pid, _fp, true); RAISE EXCEPTION 'E8 anon executou';
  EXCEPTION WHEN others THEN IF SQLERRM = 'E8 anon executou' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);

  -- usuário fictício SEM confirmação
  INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
    VALUES (_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ficticio-b46e@test.invalid', NULL, now(), now());
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN PERFORM public.install_sigem_reviewed('a','orgao-institucional','n','i','k','l', _pid, _fp, true); RAISE EXCEPTION 'E9';  -- não-instalador sem caixa postal confirmada: recusado pela designação, nunca por e-mail
  EXCEPTION WHEN others THEN IF SQLERRM IN ('E9','install:email-not-confirmed') THEN RAISE EXCEPTION 'E9 caixa postal exigida ou instalou: %', SQLERRM; END IF; END;
  r := public.installation_review();
  IF r <> '{"contract":"b4.6.7e/1","state":"access-denied"}'::jsonb THEN RAISE EXCEPTION 'E10 oracle %', r; END IF;
  PERFORM set_config('role', 'postgres', true);
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = _u;
  PERFORM set_config('role', 'authenticated', true);

  -- confirmação de revisão ausente / impressão malformada
  BEGIN PERFORM public.install_sigem_reviewed('a','orgao-institucional','n','i','k','l', _pid, _fp, false); RAISE EXCEPTION 'E11';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'install:review-not-confirmed' THEN RAISE EXCEPTION 'E11 %', SQLERRM; END IF; END;
  BEGIN PERFORM public.install_sigem_reviewed('a','orgao-institucional','n','i','k','l', _pid, '123', true); RAISE EXCEPTION 'E12';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'install:fingerprint-invalid' THEN RAISE EXCEPTION 'E12 %', SQLERRM; END IF; END;

  -- impressão válida passa a verificação; não-instalador é recusado por install_sigem
  BEGIN PERFORM public.install_sigem_reviewed('a','orgao-institucional','n','i','k','l', _pid, _fp, true); RAISE EXCEPTION 'E13 instalou';
  EXCEPTION WHEN others THEN IF SQLERRM IN ('E13 instalou','install:review-stale','install:fingerprint-invalid') THEN RAISE EXCEPTION 'E13 %', SQLERRM; END IF; END;

  -- revisão alterada com a MESMA contagem: troca de capability de uma regra
  PERFORM set_config('role', 'postgres', true);
  SELECT id, capability_id INTO _rule, _cap FROM public.capability_policy_rules WHERE policy_id = _pid ORDER BY id LIMIT 1;
  UPDATE public.capability_policy_rules SET capability_id = _cap || '-trocada' WHERE id = _rule;
  _fp2 := public.sigem_policy_fingerprint(_pid);
  IF _fp2 = _fp THEN RAISE EXCEPTION 'E14 fp insensível a capability'; END IF;
  PERFORM set_config('role', 'authenticated', true);
  BEGIN PERFORM public.install_sigem_reviewed('a','orgao-institucional','n','i','k','l', _pid, _fp, true); RAISE EXCEPTION 'E15';
  EXCEPTION WHEN others THEN IF SQLERRM <> 'install:review-stale' THEN RAISE EXCEPTION 'E15 %', SQLERRM; END IF; END;
  -- troca de atuação e de alcance também mudam a impressão
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.capability_policy_rules SET capability_id = _cap, engagement_kind_id = engagement_kind_id || '-x' WHERE id = _rule;
  IF public.sigem_policy_fingerprint(_pid) IN (_fp, _fp2) THEN RAISE EXCEPTION 'E16 atuação'; END IF;
  UPDATE public.capability_policy_rules SET engagement_kind_id = left(engagement_kind_id, length(engagement_kind_id) - 2),
    scope_dimensions = scope_dimensions || '{alcance-trocado}'::text[] WHERE id = _rule;
  IF public.sigem_policy_fingerprint(_pid) = _fp THEN RAISE EXCEPTION 'E17 alcance'; END IF;

  IF (SELECT state FROM public.sigem_installation_state) <> 'nao-instalado' THEN RAISE EXCEPTION 'E18 estado'; END IF;
  IF EXISTS (SELECT 1 FROM public.capability_policies WHERE status <> 'draft') THEN RAISE EXCEPTION 'E19 homologada'; END IF;
  RAISE EXCEPTION 'B467E-OK';
END $$;
