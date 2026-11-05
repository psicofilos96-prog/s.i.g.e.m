-- Aceite sintético de duas pessoas naturais com escolas distintas e Gabinete leitor.
-- Executar apenas no PostgreSQL efêmero do CI, após a fixture e a migration 0613.
-- Não usa contas reais, não concede capabilities e reverte todos os fatos criados.
BEGIN;
SET ROLE authenticated;

DO $two_visitors$
DECLARE
  visitor_a CONSTANT uuid := '11111111-1111-4111-8111-111111111111';
  visitor_b CONSTANT uuid := '55555555-5555-4555-8555-555555555555';
  cabinet   CONSTANT uuid := '22222222-2222-4222-8222-222222222222';
  outsider  CONSTANT uuid := '33333333-3333-4333-8333-333333333333';
  today_ date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  visit_a uuid;
  visit_b uuid;
  action_a uuid;
  action_b uuid;
  doc jsonb;
  denied boolean;
  n integer;
BEGIN
  -- Cada servidor só tem a capability de registrar em sua própria escola.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', visitor_a, 'role', 'authenticated')::text, true);
  IF NOT public.school_institutional_followup_grant(
    'registrar-acompanhamento-institucional', 'school-a')
    OR public.school_institutional_followup_grant(
      'registrar-acompanhamento-institucional', 'school-b')
  THEN RAISE EXCEPTION 'followup-two-visitors:visitor-a-grant'; END IF;

  visit_a := public.record_school_institutional_followup_bundle(
    'school-a', today_, 'Diagnóstico A', '', '', '',
    gen_random_uuid(), jsonb_build_array(jsonb_build_object(
      'description', 'Providência da escola A', 'request', gen_random_uuid())));
  doc := public.school_institutional_followup_school('school-a');
  IF jsonb_array_length(doc->'visits') <> 1
    OR jsonb_array_length(doc->'actions') <> 1
    OR doc->'visits'->0->>'author_name' <> 'Servidor de Prova'
    OR (doc->'visits'->0->>'can_correct')::boolean IS NOT TRUE
  THEN RAISE EXCEPTION 'followup-two-visitors:visitor-a-record'; END IF;
  action_a := (doc->'actions'->0->>'id')::uuid;

  -- O segundo servidor registra independentemente na escola B.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', visitor_b, 'role', 'authenticated')::text, true);
  IF NOT public.school_institutional_followup_grant(
    'registrar-acompanhamento-institucional', 'school-b')
    OR public.school_institutional_followup_grant(
      'registrar-acompanhamento-institucional', 'school-a')
  THEN RAISE EXCEPTION 'followup-two-visitors:visitor-b-grant'; END IF;

  visit_b := public.record_school_institutional_followup_bundle(
    'school-b', today_, 'Diagnóstico B', '', '', '',
    gen_random_uuid(), jsonb_build_array(jsonb_build_object(
      'description', 'Providência da escola B', 'request', gen_random_uuid())));
  doc := public.school_institutional_followup_school('school-b');
  IF jsonb_array_length(doc->'visits') <> 1
    OR jsonb_array_length(doc->'actions') <> 1
    OR doc->'visits'->0->>'author_name' <> 'Segundo Servidor de Prova'
    OR doc->'actions'->0->>'author_name' <> 'Segundo Servidor de Prova'
    OR (doc->'visits'->0->>'can_correct')::boolean IS NOT TRUE
  THEN RAISE EXCEPTION 'followup-two-visitors:visitor-b-record'; END IF;
  action_b := (doc->'actions'->0->>'id')::uuid;

  SELECT count(*) INTO n
    FROM public.school_institutional_followup_network(today_, today_)
    WHERE school_id = 'school-b' AND inep = '33000002' AND visits = 1 AND actions = 1;
  IF n <> 1 THEN RAISE EXCEPTION 'followup-two-visitors:visitor-b-network'; END IF;
  SELECT count(*) INTO n FROM public.school_institutional_followup_network(today_, today_);
  IF n <> 1 THEN RAISE EXCEPTION 'followup-two-visitors:visitor-b-network-leak'; END IF;
  doc := public.school_institutional_followup_pending();
  IF jsonb_array_length(doc->'pending') <> 1
    OR doc->'pending'->0->>'school_id' <> 'school-b'
  THEN RAISE EXCEPTION 'followup-two-visitors:visitor-b-pending-leak'; END IF;

  denied := false;
  BEGIN PERFORM public.school_institutional_followup_school('school-a');
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:read-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-two-visitors:visitor-b-read-a'; END IF;

  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_bundle(
      'school-a', today_, 'Tentativa sobre A', '', '', '',
      gen_random_uuid(), '[]'::jsonb);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:recording-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-two-visitors:visitor-b-write-a'; END IF;

  -- Conhecer o identificador de uma medida não autoriza evoluí-la.
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_update(
      action_a, NULL, today_, 'em andamento', 'Teste indevido', '', '', '',
      gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:recording-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-two-visitors:visitor-b-update-a'; END IF;

  -- Exercitar também o isolamento no sentido inverso.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', visitor_a, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.school_institutional_followup_network(today_, today_);
  IF n <> 1 THEN RAISE EXCEPTION 'followup-two-visitors:visitor-a-network-leak'; END IF;
  doc := public.school_institutional_followup_pending();
  IF jsonb_array_length(doc->'pending') <> 1
    OR doc->'pending'->0->>'school_id' <> 'school-a'
  THEN RAISE EXCEPTION 'followup-two-visitors:visitor-a-pending-leak'; END IF;
  denied := false;
  BEGIN PERFORM public.school_institutional_followup_school('school-b');
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:read-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-two-visitors:visitor-a-read-b'; END IF;
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_update(
      action_b, NULL, today_, 'em andamento', '', '', '', '', gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:recording-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-two-visitors:visitor-a-update-b'; END IF;

  -- A pessoa autorizada do Gabinete consulta ambas, mas não registra fatos.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', cabinet, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.school_institutional_followup_network(today_, today_);
  IF n <> 2 THEN RAISE EXCEPTION 'followup-two-visitors:cabinet-network'; END IF;
  doc := public.school_institutional_followup_pending();
  IF jsonb_array_length(doc->'pending') <> 2
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(doc->'pending') a WHERE a->>'school_id' = 'school-a'
    )
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(doc->'pending') b WHERE b->>'school_id' = 'school-b'
    )
  THEN RAISE EXCEPTION 'followup-two-visitors:cabinet-pending'; END IF;
  IF jsonb_array_length(public.school_institutional_followup_school('school-a')->'visits') <> 1
    OR jsonb_array_length(public.school_institutional_followup_school('school-b')->'visits') <> 1
  THEN RAISE EXCEPTION 'followup-two-visitors:cabinet-school-read'; END IF;
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_bundle(
      'school-b', today_, 'Gabinete não escreve', '', '', '',
      gen_random_uuid(), '[]'::jsonb);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:recording-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-two-visitors:cabinet-write'; END IF;

  -- Conta sem designação vê a rede vazia e não acessa IDs conhecidos.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', outsider, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM public.school_institutional_followup_network(today_, today_);
  IF n <> 0 THEN RAISE EXCEPTION 'followup-two-visitors:outsider-network'; END IF;
  doc := public.school_institutional_followup_pending();
  IF jsonb_array_length(doc->'pending') <> 0
  THEN RAISE EXCEPTION 'followup-two-visitors:outsider-pending'; END IF;
  denied := false;
  BEGIN PERFORM public.school_institutional_followup_school('school-b');
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:read-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-two-visitors:outsider-read'; END IF;

  -- A auditoria da autoria é persistida na tabela, nunca inferida dos participantes.
  RESET ROLE; -- Não necessário para o writer: consulta final sob privilégio do fixture.
  IF NOT EXISTS (
    SELECT 1 FROM public.school_institutional_followup_visits
    WHERE id = visit_a AND author_user_id = visitor_a AND author_person_id = visitor_a
  ) OR NOT EXISTS (
    SELECT 1 FROM public.school_institutional_followup_visits
    WHERE id = visit_b AND author_user_id = visitor_b AND author_person_id = visitor_b
  ) THEN RAISE EXCEPTION 'followup-two-visitors:authorship-mismatch'; END IF;
  RAISE NOTICE 'FOLLOWUP_0613_TWO_VISITORS_OK';
END $two_visitors$;

ROLLBACK;
