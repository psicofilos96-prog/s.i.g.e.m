-- R1: identidades técnicas isoladas (UUID aleatório, sem atuação, sem pessoa humana).
-- Executar como superusuário; termina em RAISE para nada persistir.
DO $$
DECLARE n bigint;
BEGIN
  -- Negativo: autenticado sem capability não lê nenhuma observação.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.school_infrastructure_observations;
  IF n <> 0 THEN RAISE EXCEPTION 'R1 FALHOU: autenticado sem capability leu % linhas', n; END IF;
  RESET ROLE;
  -- Negativo: anon sem privilégio.
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO n FROM public.school_infrastructure_observations;
    RAISE EXCEPTION 'R1 FALHOU: anon leu';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
  -- Positivo (relatórios legítimos) depende de atuação + política homologada com
  -- 'consultar-censo-escolar' ou 'manter-cadastro-unidade-escolar'; sem identidade
  -- funcional real não é personificado aqui.
  RAISE EXCEPTION 'R1 OK (rollback intencional)';
END $$;
