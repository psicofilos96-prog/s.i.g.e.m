-- Prova completa de execução SQL no banco efêmero do CI, sempre com ROLLBACK.
BEGIN;
SET ROLE authenticated;

DO $positive$
DECLARE
  writer constant uuid := '11111111-1111-4111-8111-111111111111';
  gabinete constant uuid := '22222222-2222-4222-8222-222222222222';
  stranger constant uuid := '33333333-3333-4333-8333-333333333333';
  day_ date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  visit1 uuid; visit2 uuid; action1 uuid; doc jsonb;
  denied boolean; count_ integer; status_ text;
  request_ constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  actions_ constant jsonb := '[{"description":"Organizar o acervo escolar","responsible":"Direção","request":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}]'::jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', writer, 'role', 'authenticated')::text, true);
  -- Uma visita e uma ação são gravadas juntas.
  visit1 := public.record_school_institutional_followup_bundle(
    'school-a', day_, 'Diagnóstico de teste', 'Equipe engajada',
    'Acervo desorganizado', 'Reorganizar a biblioteca', request_, actions_);
  doc := public.school_institutional_followup_school('school-a');
  IF jsonb_array_length(doc->'visits') <> 1 OR jsonb_array_length(doc->'actions') <> 1
    THEN RAISE EXCEPTION 'followup-positive:bundle-incomplete'; END IF;
  action1 := (doc->'actions'->0->>'id')::uuid;
  IF action1 IS NULL OR (doc->'actions'->0->>'author_name') <> 'Servidor de Prova'
    THEN RAISE EXCEPTION 'followup-positive:author-absent'; END IF;

  -- Retentativa idêntica reaproveita os identificadores e não cria duplicatas.
  visit2 := public.record_school_institutional_followup_bundle(
    'school-a', day_, 'Diagnóstico de teste', 'Equipe engajada',
    'Acervo desorganizado', 'Reorganizar a biblioteca', request_, actions_);
  IF visit2 IS DISTINCT FROM visit1 THEN RAISE EXCEPTION 'followup-positive:not-idempotent'; END IF;
  doc := public.school_institutional_followup_school('school-a');
  IF jsonb_array_length(doc->'visits') <> 1 OR jsonb_array_length(doc->'actions') <> 1
    THEN RAISE EXCEPTION 'followup-positive:duplicate-records'; END IF;

  -- Mesma chave com conteúdo novo nunca pode produzir sucesso silencioso.
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_bundle(
      'school-a', day_, 'Diagnóstico alterado!', 'Equipe engajada',
      'Acervo desorganizado', 'Reorganizar a biblioteca', request_, actions_);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:request-conflict' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:changed-payload-accepted'; END IF;

  -- Se a segunda medida é inválida, nem a visita nem a primeira medida persistem.
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_bundle(
      'school-a', day_, 'Visita que deve reverter', '', '', '',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
      jsonb_build_array(
        jsonb_build_object('description','Ação válida da transação falha',
          'request','ffffffff-ffff-4fff-8fff-ffffffffffff'),
        jsonb_build_object('description','Ação com prazo anterior à visita',
          'due',(day_ - 1)::text,
          'request','11111111-aaaa-4aaa-8aaa-111111111111')
      )
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:due-before-visit' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:partial-bundle-accepted'; END IF;
  doc := public.school_institutional_followup_school('school-a');
  IF jsonb_array_length(doc->'visits') <> 1 OR jsonb_array_length(doc->'actions') <> 1
    THEN RAISE EXCEPTION 'followup-positive:partial-bundle-persisted'; END IF;

  -- Atualizações preservam a sequência, e a projeção reflete a última situação.
  PERFORM public.record_school_institutional_followup_update(
    action1, visit1, day_, 'em andamento', 'Materiais separados', NULL,
    NULL, 'Continuar a organização', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid);
  PERFORM public.record_school_institutional_followup_update(
    action1, visit1, day_, 'concluída', 'Acervo reorganizado', NULL,
    'Biblioteca acessível', 'Monitorar conservação', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid);
  doc := public.school_institutional_followup_school('school-a');
  IF jsonb_array_length(doc->'updates') <> 2
    THEN RAISE EXCEPTION 'followup-positive:update-history-lost'; END IF;
  IF (doc->'updates'->0->>'author_name') <> 'Servidor de Prova'
    THEN RAISE EXCEPTION 'followup-positive:update-author-missing'; END IF;
  SELECT situation INTO status_ FROM public.school_institutional_followup_statuses() LIMIT 1;
  IF status_ <> 'concluída' THEN RAISE EXCEPTION 'followup-positive:wrong-current-status %', status_; END IF;

  -- O banco rejeita valores fora do catálogo e conserva o histórico existente.
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_update(
      action1, NULL, day_, 'inventada', '', '', '', '', gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:situation-invalid' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:unknown-situation-accepted'; END IF;
  doc := public.school_institutional_followup_school('school-a');
  IF jsonb_array_length(doc->'updates') <> 2
    THEN RAISE EXCEPTION 'followup-positive:invalid-situation-persisted'; END IF;

  -- Escola fora do escopo de escrita e leitura do servidor permanece isolada.
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_bundle(
      'school-b', day_, 'Fora do escopo', '', '', '', gen_random_uuid(), '[]'::jsonb);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:recording-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:cross-school-write'; END IF;
  denied := false;
  BEGIN
    PERFORM public.school_institutional_followup_school('school-b');
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:read-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:cross-school-read'; END IF;
  SELECT count(*) INTO count_ FROM public.school_institutional_followup_network(day_, day_);
  IF count_ <> 1 THEN RAISE EXCEPTION 'followup-positive:writer-network-scope'; END IF;
  SELECT coalesce(sum(visits),0) INTO count_ FROM public.school_institutional_followup_monthly(day_,day_);
  IF count_ <> 1 THEN RAISE EXCEPTION 'followup-positive:wrong-monthly-count'; END IF;

  -- Gabinete vê as duas unidades e os registros, mas é incapaz de escrever.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', gabinete, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO count_ FROM public.school_institutional_followup_network(day_,day_);
  IF count_ <> 2 THEN RAISE EXCEPTION 'followup-positive:gabinete-no-network'; END IF;
  doc := public.school_institutional_followup_school('school-a');
  IF jsonb_array_length(doc->'actions') <> 1 THEN
    RAISE EXCEPTION 'followup-positive:gabinete-no-read'; END IF;
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_update(
      action1, NULL, day_, 'suspensa', '', '', '', '', gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:recording-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:gabinete-can-write'; END IF;

  -- Conta sem designação não pode ler mesmo que conheça o ID da unidade.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO count_ FROM public.school_institutional_followup_network(day_,day_);
  IF count_ <> 0 THEN RAISE EXCEPTION 'followup-positive:outsider-leak'; END IF;
  denied := false;
  BEGIN
    PERFORM public.school_institutional_followup_school('school-a');
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:read-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:outsider-direct-read'; END IF;

  RAISE NOTICE 'FOLLOWUP_0613_POSITIVE_AND_NEGATIVE_OK';
END $positive$;

RESET ROLE;
ROLLBACK;
