-- CAL.EXT.1 — prova do perfil visual externo (executar como owner das funções; sandbox não executa writer). Transação revertida; zero resíduo.
BEGIN;
DO $t$
DECLARE cal text; adm uuid; r jsonb; h uuid; before_v bigint; before_h bigint;
BEGIN
  SELECT count(*) INTO before_v FROM public.calendar_versions;
  SELECT count(*) INTO before_h FROM public.calendar_version_homologations;
  SELECT v.calendar_id INTO cal FROM public.calendar_versions v ORDER BY v.created_at LIMIT 1;
  SELECT l.user_id INTO adm FROM public.user_person_links l
    WHERE EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.person_id = l.person_id) LIMIT 1;
  IF adm IS NULL THEN RAISE EXCEPTION 'FALHA: conta com atuação não encontrada'; END IF;
  -- DML direto recusado: nenhum papel de app tem privilégio na tabela
  IF has_table_privilege('authenticated','public.calendar_external_profile_revisions','INSERT,UPDATE,DELETE,SELECT')
     OR has_table_privilege('anon','public.calendar_external_profile_revisions','INSERT,UPDATE,DELETE,SELECT') THEN RAISE EXCEPTION 'FALHA: DML direto concedido'; END IF;
  IF has_function_privilege('anon','public.record_calendar_external_profile(text,text,uuid,jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'FALHA: anon executa writer'; END IF;
  PERFORM set_config('request.jwt.claims', '', true);
  -- sem sessão
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'externo-mosaico', NULL, '{}', NULL); RAISE EXCEPTION 'FALHA: sem sessão aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'calendar:session-required%' THEN RAISE; END IF; END;
  IF public.calendar_external_profile_at(cal, 'externo-mosaico', CURRENT_DATE, now())->>'state' <> 'access-denied' THEN RAISE EXCEPTION 'FALHA: leitor sem sessão'; END IF;
  -- conta sem capacidade: writer recusa
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'externo-mosaico', NULL, '{}', NULL); RAISE EXCEPTION 'FALHA: sem capacidade aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  -- autoridade de construção
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  IF public.calendar_external_profile_at(cal, 'externo-mosaico', CURRENT_DATE, now())->>'state' <> 'padrao' THEN RAISE EXCEPTION 'FALHA: padrão'; END IF;
  r := public.record_calendar_external_profile(cal, 'externo-mosaico', NULL, '{"primary":"#123456"}', 'teste');
  h := (r->>'revisionId')::uuid;
  IF (r->>'revision')::int <> 1 THEN RAISE EXCEPTION 'FALHA: revisão 1'; END IF;
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'externo-mosaico', NULL, '{}', NULL); RAISE EXCEPTION 'FALHA: base obsoleta aceita';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'calendar-external:base-superseded%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'externo-mosaico', h, '{"coverImage":"data:image/svg+xml;base64,AAAA"}', NULL); RAISE EXCEPTION 'FALHA: svg aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'calendar-external:asset-invalid%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'externo-mosaico', h, jsonb_build_object('coverImage', 'data:image/png;base64,' || repeat('A', 1600000)), NULL); RAISE EXCEPTION 'FALHA: grande aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'calendar-external:asset-too-large%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'qualquer', NULL, '{}', NULL); RAISE EXCEPTION 'FALHA: template aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'calendar-external:invalid-template%' THEN RAISE; END IF; END;
  r := public.record_calendar_external_profile(cal, 'externo-mosaico', h, '{"primary":"#654321"}', NULL);
  IF (r->>'revision')::int <> 2 THEN RAISE EXCEPTION 'FALHA: revisão 2'; END IF;
  r := public.calendar_external_profile_at(cal, 'externo-mosaico', CURRENT_DATE, now());
  IF r->>'state' <> 'lido' OR r->'profile'->>'primary' <> '#654321' THEN RAISE EXCEPTION 'FALHA: leitura %', r; END IF;
  BEGIN UPDATE public.calendar_external_profile_revisions SET reason = 'x'; RAISE EXCEPTION 'FALHA: update aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.calendar_versions) <> before_v OR (SELECT count(*) FROM public.calendar_version_homologations) <> before_h THEN
    RAISE EXCEPTION 'FALHA: conteúdo acadêmico alterado'; END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE public) THEN RAISE EXCEPTION 'FALHA: bucket público'; END IF;
  RAISE NOTICE 'CAL.EXT.1 SQL OK';
END $t$;
ROLLBACK;
