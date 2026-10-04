-- B1.1: invariante administrativa da instalação. Sessão simulada da conta designada;
-- rollback integral pelo RAISE final. Nenhuma instalação persiste.
DO $t$
DECLARE v2 uuid; fp text; bad text; act uuid; n_before int; n_after int;
BEGIN
  INSERT INTO auth.users(id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) VALUES ('00000000-0000-0000-0000-0000000b1101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@sigem.itap.gov.br', now(), now(), now()); -- B1.3: fixture da conta designada
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000b1101','role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b1101', true);
  SELECT id INTO v2 FROM public.capability_policies WHERE version = 2 AND status = 'draft';
  IF v2 IS NULL THEN RAISE EXCEPTION 't:v2-not-draft'; END IF;
  fp := public.sigem_policy_fingerprint(v2);
  SELECT count(*) INTO n_before FROM public.institutional_engagements;

  -- 1) gestao-pedagogica-da-rede: recusada pela nova invariante
  BEGIN
    PERFORM public.install_sigem_reviewed('teste', 'orgao-institucional', 'Supervisão Escolar', NULL, 'gestao-pedagogica-da-rede', NULL, v2, fp, true);
    RAISE EXCEPTION 't:gestao-installed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'install:initial-engagement-lacks-administration:%' THEN RAISE EXCEPTION 't:gestao-wrong-error: %', SQLERRM; END IF;
  END;
  -- 2) secretaria-escolar (escopo escola): recusada
  BEGIN
    PERFORM public.install_sigem_reviewed('teste', 'orgao-institucional', 'Supervisão Escolar', NULL, 'secretaria-escolar', NULL, v2, fp, true);
    RAISE EXCEPTION 't:secretaria-installed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'install:initial-engagement-lacks-administration:%' THEN RAISE EXCEPTION 't:secretaria-wrong-error: %', SQLERRM; END IF;
  END;
  -- 3) fingerprint incorreto continua recusado
  bad := repeat('0', 64);
  BEGIN
    PERFORM public.install_sigem_reviewed('teste', 'orgao-institucional', 'Supervisão Escolar', NULL, 'cadastro-institucional-da-rede', NULL, v2, bad, true);
    RAISE EXCEPTION 't:stale-installed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'install:review-stale' THEN RAISE EXCEPTION 't:stale-wrong-error: %', SQLERRM; END IF;
  END;
  -- 3b) revisão não confirmada continua recusada
  BEGIN
    PERFORM public.install_sigem_reviewed('teste', 'orgao-institucional', 'Supervisão Escolar', NULL, 'cadastro-institucional-da-rede', NULL, v2, fp, false);
    RAISE EXCEPTION 't:unconfirmed-installed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'install:review-not-confirmed' THEN RAISE EXCEPTION 't:unconfirmed-wrong-error: %', SQLERRM; END IF;
  END;
  IF (SELECT state FROM public.sigem_installation_state) <> 'nao-instalado' THEN RAISE EXCEPTION 't:partial-state'; END IF;
  SELECT count(*) INTO n_after FROM public.institutional_engagements;
  IF n_after <> n_before OR (SELECT count(*) FROM public.sigem_installation_acts) <> 0
    OR (SELECT status FROM public.capability_policies WHERE id = v2) <> 'draft'
    THEN RAISE EXCEPTION 't:partial-effects'; END IF;

  -- 4) cadastro-institucional-da-rede satisfaz a pré-condição (efeitos só nesta transação)
  act := public.install_sigem_reviewed('teste B1.1 com rollback', 'orgao-institucional', 'Supervisão Escolar', NULL, 'cadastro-institucional-da-rede', NULL, v2, fp, true);
  IF act IS NULL OR (SELECT state FROM public.sigem_installation_state) <> 'instalado'
    OR (SELECT status FROM public.capability_policies WHERE id = v2) <> 'homologated'
    OR NOT EXISTS (SELECT 1 FROM public.institutional_engagements WHERE engagement_kind_id = 'cadastro-institucional-da-rede' AND scope_level = 'rede')
    THEN RAISE EXCEPTION 't:valid-path-effects-missing'; END IF;

  RAISE EXCEPTION 'b1-1-tests-ok: gestao-refused secretaria-refused stale-refused unconfirmed-refused no-partial-effects valid-path-in-transaction';
END $t$;
