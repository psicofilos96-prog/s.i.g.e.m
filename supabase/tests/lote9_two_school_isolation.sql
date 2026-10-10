-- LOTE 9 — isolamento escola×escola. Teste autorizado com fixtures EFÊMERAS (domínio bo-fixture.invalid),
-- nunca pessoa real: o bloco termina em RAISE e nada persiste. Executar só por conexão técnica
-- de ambiente (scripts/harness-gate.mjs); o psql restrito do sandbox não roda este arquivo.
-- Prova: conta A (atuação escolar em S1) não lê episódios de S2, e vice-versa.
DO $$
DECLARE s1 text; s2 text; ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); n int;
BEGIN
  SELECT id INTO s1 FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.institutional_schools ORDER BY id OFFSET 1 LIMIT 1;
  PERFORM public.bo_fixture_prepare(ua, s1);
  PERFORM public.bo_fixture_prepare(ub, s2);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.class_enrollment_episodes e JOIN public.institutional_classes c ON c.id = e.class_id WHERE c.school_id = s2;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: conta de % leu % episódios de %', s1, n, s2; END IF;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.class_enrollment_episodes e JOIN public.institutional_classes c ON c.id = e.class_id WHERE c.school_id = s1;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: conta de % leu % episódios de %', s2, n, s1; END IF;
  RESET ROLE;

  RAISE EXCEPTION 'PASS (rollback intencional): isolamento % × %', s1, s2;
END $$;
