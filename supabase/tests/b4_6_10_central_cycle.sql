-- B4.6.10 — ciclo central do calendário, reproduzível. Executa tudo e termina em RAISE 'b4610-cycle-ok': nada persiste.
-- Supervisão salva v1 → homologa → conta comum consulta (feriado/recesso com efeito real) → Supervisão retifica (v2) →
-- histórico com 2 versões → comum continua na v1 → base antiga recusada → homologa v2 → comum vê v2;
-- pendência de contexto só visível quando homologada; comum não grava; anônimo não executa os leitores.
DO $$
DECLARE sv uuid := '06cd106b-32f4-4434-b990-3ae3be2cf4a4'; other uuid := gen_random_uuid();
  pl jsonb := '{"year":2027,"title":"Ciclo B4.6.10","actRef":"ato do teste","reason":"teste",
    "periods":[{"key":"p1","name":"1º Bimestre","start":"2027-02-01","end":"2027-04-30"}],
    "dayTypes":[{"code":"T-LET","label":"Teste letivo","effect":true,"councilRole":null},
                {"code":"T-FER","label":"Teste feriado","effect":false,"councilRole":null},
                {"code":"T-REC","label":"Teste recesso","effect":false,"councilRole":null}],
    "days":[{"day":"2027-02-01","code":"T-LET"},{"day":"2027-02-02","code":"T-FER"},{"day":"2027-02-03","code":"T-REC"}],
    "events":[{"starts_on":"2027-02-02","ends_on":"2027-02-02","label":"Feriado de teste","code":"T-FER"}],
    "sourceKind":"edicao-institucional","sourceEntryId":"cal-ciclo-teste",
    "digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "raw":{"id":"cal-ciclo-teste"},"presentation":{"editorCalendar":{"id":"cal-ciclo-teste"}}}'::jsonb;
  s1 jsonb; s2 jsonb; r jsonb; ok boolean; n int; e1 text; e2 text; e3 text;
BEGIN
  -- Supervisão
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sv, 'role','authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  s1 := public.save_network_calendar('cal-ciclo-teste', NULL, pl);
  IF (s1->>'version')::int <> 1 THEN RAISE EXCEPTION 'v1: %', s1; END IF;
  PERFORM public.homologate_network_calendar((s1->>'versionId')::uuid, NULL, 'ato do teste', NULL);

  -- Conta comum: consulta homologada com efeitos reais
  PERFORM set_config('request.jwt.claims', json_build_object('sub', other, 'role','authenticated')::text, true);
  r := public.calendar_days_at(s1->>'calendarId', '2027-02-01', '2027-02-03', clock_timestamp());
  IF r->>'state' <> 'lido' THEN RAISE EXCEPTION 'dias comum: %', r; END IF;
  e1 := r->'days'->0->'rows'->0->>'school_day_effect'; e2 := r->'days'->1->'rows'->0->>'school_day_effect'; e3 := r->'days'->2->'rows'->0->>'school_day_effect';
  IF e1 IS DISTINCT FROM 'true' OR e2 IS DISTINCT FROM 'false' OR e3 IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'efeitos (letivo/feriado/recesso) errados: % % % — %', e1, e2, e3, left(r::text, 600); END IF;
  SELECT count(*) INTO n FROM public.calendar_version_context_pending WHERE version_id = (s1->>'versionId')::uuid;
  IF n <> 1 THEN RAISE EXCEPTION 'pendência da versão homologada deveria ser visível'; END IF;

  -- Supervisão retifica (v2: recesso vira letivo)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sv, 'role','authenticated')::text, true);
  s2 := public.save_network_calendar('cal-ciclo-teste', (s1->>'versionId')::uuid,
    jsonb_set(pl, '{days,2}', '{"day":"2027-02-03","code":"T-LET"}'));
  IF (s2->>'version')::int <> 2 THEN RAISE EXCEPTION 'v2: %', s2; END IF;
  r := public.calendar_list_at(clock_timestamp());
  SELECT count(*) INTO n FROM jsonb_array_elements(r->'versions') x WHERE x->>'calendarId' = s1->>'calendarId';
  IF n <> 2 THEN RAISE EXCEPTION 'histórico deveria ter 2 versões: %', n; END IF;
  ok := false;
  BEGIN PERFORM public.save_network_calendar('cal-ciclo-teste', (s1->>'versionId')::uuid, pl);
  EXCEPTION WHEN others THEN IF SQLERRM LIKE '%base-superseded%' THEN ok := true; ELSE RAISE; END IF; END;
  IF NOT ok THEN RAISE EXCEPTION 'base antiga não recusada'; END IF;

  -- Comum: ainda só a v1; pendência da v2 (não homologada) invisível
  PERFORM set_config('request.jwt.claims', json_build_object('sub', other, 'role','authenticated')::text, true);
  r := public.calendar_list_at(clock_timestamp());
  SELECT count(*) INTO n FROM jsonb_array_elements(r->'versions') x WHERE x->>'calendarId' = s1->>'calendarId';
  IF r->>'audience' <> 'homologados' OR n <> 1 THEN RAISE EXCEPTION 'comum antes da v2: %', r; END IF;
  SELECT count(*) INTO n FROM public.calendar_version_context_pending WHERE version_id = (s2->>'versionId')::uuid;
  IF n <> 0 THEN RAISE EXCEPTION 'pendência de rascunho vazou para conta comum'; END IF;
  ok := false;
  BEGIN PERFORM public.save_network_calendar('x', NULL, pl); EXCEPTION WHEN others THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'comum gravou'; END IF;

  -- Supervisão homologa v2; comum passa a ver v2 e o efeito novo
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sv, 'role','authenticated')::text, true);
  PERFORM public.homologate_network_calendar((s2->>'versionId')::uuid, NULL, 'ato do teste', NULL);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', other, 'role','authenticated')::text, true);
  r := public.calendar_days_at(s1->>'calendarId', '2027-02-03', '2027-02-03', clock_timestamp());
  IF r->'days'->0->'rows'->0->>'school_day_effect' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'v2 não aplicada: %', left(r::text, 600); END IF;

  -- Anônimo: sem execução
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'anon', true);
  ok := false;
  BEGIN PERFORM public.calendar_network_sources_at(NULL); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'anônimo executou leitor de fontes'; END IF;

  RAISE EXCEPTION 'b4610-cycle-ok';
END $$;
