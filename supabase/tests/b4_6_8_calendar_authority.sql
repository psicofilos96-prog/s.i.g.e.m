-- B4.6.8 — autoridade do calendário por designação explícita. Executa tudo e termina em RAISE: nada persiste.
DO $$
DECLARE sv uuid := '06cd106b-32f4-4434-b990-3ae3be2cf4a4'; other uuid := gen_random_uuid();
  r jsonb; t1 jsonb; t2 jsonb; n int;
BEGIN
  -- Supervisão (designada)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sv, 'role','authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO n FROM public.effective_capabilities() WHERE policy_id IS NULL;
  IF n <> 5 THEN RAISE EXCEPTION 'esperava 5 capacidades designadas, veio %', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities() WHERE capability_id = 'homologar-calendario-da-rede' AND scope_level = 'rede') THEN RAISE EXCEPTION 'sv sem homologar'; END IF;
  IF EXISTS (SELECT 1 FROM public.effective_scope_capabilities() WHERE capability_id = 'manter-cadastro-unidade-escolar') THEN RAISE EXCEPTION 'designação vazou para escolas'; END IF;
  -- escrita + sucessão (alteração por nova versão com histórico)
  t1 := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Teste B468', true, 'ato teste', NULL);
  t2 := public.record_calendar_day_type_version(t1->>'day_type_id', (t1->>'version_id')::uuid, 'sucessao', 'Teste B468 v2', false, 'ato teste', 'alteração');
  IF (t2->>'version')::int <> 2 THEN RAISE EXCEPTION 'sucessão falhou'; END IF;
  r := public.calendar_list_at(clock_timestamp());
  IF r->>'audience' <> 'construcao' THEN RAISE EXCEPTION 'sv não vê construção'; END IF;

  -- Conta comum autenticada (sem designação)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', other, 'role','authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM public.effective_scope_capabilities() WHERE capability_id = 'construir-calendario-da-rede') THEN RAISE EXCEPTION 'comum ganhou construir'; END IF;
  r := public.calendar_list_at(clock_timestamp());
  IF r->>'audience' <> 'homologados' THEN RAISE EXCEPTION 'comum deveria ver só homologados'; END IF;
  BEGIN
    PERFORM public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'X', true, 'ato', NULL);
    RAISE EXCEPTION 'comum gravou';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  SELECT count(*) INTO n FROM public.calendar_authority_designations;
  IF n <> 0 THEN RAISE EXCEPTION 'comum leu designação alheia'; END IF;

  RAISE EXCEPTION 'b468-tests-ok';
END $$;
