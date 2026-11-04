-- Prova completa de execução SQL no banco efêmero do CI, sempre com ROLLBACK.
BEGIN;
-- Escola B possui providência própria, usada para provar isolamento entre contas.
INSERT INTO public.school_institutional_followup_visits(
  id, logical_id, version, school_id, visit_date, diagnosis, author_user_id,
  author_person_id, request_key)
VALUES ('77777777-7777-4777-8777-777777777777'::uuid,
  'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'::uuid, 1, 'school-b',
  (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'Diagnóstico sentinela B',
  '22222222-2222-4222-8222-222222222222'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid, gen_random_uuid());
INSERT INTO public.school_institutional_followup_actions(
  school_id, visit_logical_id, description, responsible_label,
  due_on, author_user_id, author_person_id, request_key)
VALUES ('school-b', 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'::uuid,
  'Providência restrita à Escola B', 'Coordenação B',
  (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1,
  '22222222-2222-4222-8222-222222222222'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid, gen_random_uuid());
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

  -- O servidor da escola A não pode enxergar a providência sentinela da escola B.
  doc := public.school_institutional_followup_pending();
  IF jsonb_array_length(doc->'pending') <> 1
    OR doc->'pending'->0->>'school_id' <> 'school-a'
    OR doc->'pending'->0->>'situation' <> 'sem atualização'
    THEN RAISE EXCEPTION 'followup-positive:writer-pending-scope'; END IF;

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

  -- Mesmo diagnóstico, mas outra lista de medidas com a mesma chave: conflito.
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_bundle(
      'school-a', day_, 'Diagnóstico de teste', 'Equipe engajada',
      'Acervo desorganizado', 'Reorganizar a biblioteca', request_, '[]'::jsonb);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:request-conflict' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:changed-action-list-accepted'; END IF;

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

  doc := public.school_institutional_followup_pending();
  IF jsonb_array_length(doc->'pending') <> 0
    THEN RAISE EXCEPTION 'followup-positive:completed-still-pending'; END IF;

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

  -- O autor corrige uma visita por nova versão; diagnóstico e trilha anteriores sobrevivem.
  visit2 := public.record_school_institutional_followup_visit(
    'school-a', day_, 'Diagnóstico retificado', 'Equipe engajada',
    'Acervo desorganizado', 'Reorganizar a biblioteca',
    visit1, 'Correção de descrição no diagnóstico', '99999999-9999-4999-8999-999999999999'::uuid);
  doc := public.school_institutional_followup_school('school-a');
  IF jsonb_array_length(doc->'visits') <> 1
    OR jsonb_array_length(doc->'visit_history') <> 1
    OR (doc->'visits'->0->>'id')::uuid IS DISTINCT FROM visit2
    OR (doc->'visits'->0->>'can_correct')::boolean IS NOT TRUE
    OR (doc->'visit_history'->0->>'id')::uuid IS DISTINCT FROM visit1
    OR jsonb_array_length(doc->'actions') <> 1
    OR jsonb_array_length(doc->'updates') <> 2
    THEN RAISE EXCEPTION 'followup-positive:correction-history-invalid'; END IF;

  -- Versão substituída não pode ser corrigida novamente.
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_visit(
      'school-a', day_, 'Segunda correção inválida', '', '', '',
      visit1, 'Correção de base antiga', gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:base-superseded' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:stale-correction-accepted'; END IF;

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
  SELECT count(*) INTO count_ FROM public.school_institutional_followup_network(day_, day_)
    WHERE school_id = 'school-a' AND inep = '33000001';
  IF count_ <> 1 THEN RAISE EXCEPTION 'followup-positive:writer-inep-missing'; END IF;
  SELECT coalesce(sum(visits),0) INTO count_ FROM public.school_institutional_followup_monthly(day_,day_);
  IF count_ <> 1 THEN RAISE EXCEPTION 'followup-positive:wrong-monthly-count'; END IF;

  -- Gabinete vê as duas unidades e os registros, mas é incapaz de escrever.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', gabinete, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO count_ FROM public.school_institutional_followup_network(day_,day_);
  IF count_ <> 2 THEN RAISE EXCEPTION 'followup-positive:gabinete-no-network'; END IF;
  doc := public.school_institutional_followup_pending();
  IF jsonb_array_length(doc->'pending') <> 1
    OR doc->'pending'->0->>'school_id' <> 'school-b'
    OR doc->'pending'->0->>'description' <> 'Providência restrita à Escola B'
    THEN RAISE EXCEPTION 'followup-positive:gabinete-pending-scope'; END IF;
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
  doc := public.school_institutional_followup_pending();
  IF jsonb_array_length(doc->'pending') <> 0
    THEN RAISE EXCEPTION 'followup-positive:outsider-pending-leak'; END IF;
  denied := false;
  BEGIN
    PERFORM public.school_institutional_followup_school('school-a');
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:read-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:outsider-direct-read'; END IF;

  -- Após a visita, o servidor autorizado acrescenta nova medida ao plano já existente.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', writer, 'role', 'authenticated')::text, true);
  action1 := public.record_school_institutional_followup_action(
    visit2, 'Organizar material suplementar', 'Equipe escolar',
    day_ + 14, 'abababab-abab-4bab-8bab-abababababab'::uuid);
  IF public.record_school_institutional_followup_action(
    visit2, 'Organizar material suplementar', 'Equipe escolar',
    day_ + 14, 'abababab-abab-4bab-8bab-abababababab'::uuid) IS DISTINCT FROM action1
    THEN RAISE EXCEPTION 'followup-positive:late-action-not-idempotent'; END IF;
  doc := public.school_institutional_followup_school('school-a');
  IF jsonb_array_length(doc->'actions') <> 2 OR jsonb_array_length(doc->'visits') <> 1
    OR jsonb_array_length(doc->'visit_history') <> 1
    THEN RAISE EXCEPTION 'followup-positive:late-action-not-linked'; END IF;
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_action(
      visit2, 'Descrição diferente', 'Equipe escolar',
      day_ + 14, 'abababab-abab-4bab-8bab-abababababab'::uuid);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:request-conflict' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:late-action-request-reused'; END IF;

  -- Uma evolução não pode anteceder a visita que originou a medida.
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_update(
      action1, NULL, day_ - 1, 'prevista', '', '', '', '', gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:update-before-origin-visit' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:update-predates-visit'; END IF;

  -- Uma correção de data também não pode colocar uma evolução anterior à visita.
  visit1 := public.record_school_institutional_followup_visit(
    'school-a', day_ - 20, 'Histórico anterior', '', '', '', NULL, NULL, gen_random_uuid());
  action1 := public.record_school_institutional_followup_action(
    visit1, 'Conferir os acervos', 'Direção', NULL, gen_random_uuid());
  PERFORM public.record_school_institutional_followup_update(
    action1, NULL, day_ - 10, 'em andamento', 'Iniciado', '', '', '', gen_random_uuid());
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_visit(
      'school-a', day_ - 9, 'Diagnóstico retificado com data inconsistente',
      '', '', '', visit1, 'Ajuste de data', gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:date-after-action-update' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:correction-after-event'; END IF;

  -- A equipe identifica a visita de retorno; o PostgreSQL persiste seu vínculo lógico.
  visit2 := public.record_school_institutional_followup_visit(
    'school-a', day_ - 2, 'Visita de retorno', '', '', '', NULL, NULL, gen_random_uuid());
  PERFORM public.record_school_institutional_followup_update(
    action1, visit2, day_ - 1, 'em andamento', 'Retorno constatado', '', '', '', gen_random_uuid());
  doc := public.school_institutional_followup_school('school-a');
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(doc->'updates') u
    JOIN LATERAL jsonb_array_elements(doc->'visits') v ON v->>'id' = visit2::text
    WHERE u->>'action_id' = action1::text
      AND u->>'visit_logical_id' = v->>'logical_id'
      AND u->>'done_text' = 'Retorno constatado'
  ) THEN RAISE EXCEPTION 'followup-positive:return-visit-link-lost'; END IF;

  -- Data da evolução não pode anteceder a visita associada, mesmo após a origem.
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_update(
      action1, visit2, day_ - 3, 'prevista', '', '', '', '', gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:update-before-linked-visit' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:linked-visit-date-bypassed'; END IF;

  -- O ID físico da sentinela da outra escola é conhecido; não pode vincular-se à medida A.
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_update(
      action1, '77777777-7777-4777-8777-777777777777'::uuid, day_,
      'prevista', '', '', '', '', gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:visit-mismatch' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:foreign-visit-linked'; END IF;

  -- Objetivo e participantes são dados declarados, distintos da identidade do autor.
  visit2 := public.record_school_institutional_followup_bundle(
    'school-a', day_, 'Visita com participantes', '', '', '', gen_random_uuid(),
    '[]'::jsonb, 'Equipe Acompanhamento e Direção', 'Observar situação da biblioteca');
  doc := public.school_institutional_followup_school('school-a');
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(doc->'visits') v
    WHERE v->>'id' = visit2::text
      AND v->>'participants_note' = 'Equipe Acompanhamento e Direção'
      AND v->>'purpose_note' = 'Observar situação da biblioteca'
      AND v->>'author_name' = 'Servidor de Prova'
  ) THEN RAISE EXCEPTION 'followup-positive:visit-participant-or-purpose-missing'; END IF;

  -- Reutilização da chave da visita com participantes diferentes nunca deve ser silenciosa.
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_visit(
      'school-a', day_, 'Visita com participantes', '', '', '', NULL, NULL, request_,
      'Participantes alterados', 'Objetivo alterado');
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:request-conflict' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:visit-identity-payload-conflict'; END IF;

  RAISE NOTICE 'FOLLOWUP_0613_POSITIVE_AND_NEGATIVE_OK';
END $positive$;

RESET ROLE;

-- Identidade de órgão/setor não pode assinar registros, mesmo se uma regra
-- de autorização lhe conceder explicitamente a capacidade de escrita.
SET ROLE authenticated;
DO $nonhuman$
DECLARE
  denied boolean := false;
  doc jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', '44444444-4444-4444-8444-444444444444',
      'role', 'authenticated')::text, true);
  IF NOT public.school_institutional_followup_grant(
    'registrar-acompanhamento-institucional', 'school-a')
    THEN RAISE EXCEPTION 'followup-positive:nonhuman-fixture-not-authorized'; END IF;
  BEGIN
    PERFORM public.record_school_institutional_followup_visit(
      'school-a', (now() AT TIME ZONE 'America/Sao_Paulo')::date,
      'Diagnóstico que não deve existir', '', '', '', NULL, NULL, gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:natural-person-required' THEN
      denied := true;
    ELSE RAISE;
    END IF;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'followup-positive:nonhuman-writer-accepted'; END IF;
  doc := public.school_institutional_followup_school('school-a');
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(doc->'visits') v
    WHERE v->>'diagnosis' = 'Diagnóstico que não deve existir')
    THEN RAISE EXCEPTION 'followup-positive:nonhuman-visit-persisted'; END IF;
  RAISE NOTICE 'FOLLOWUP_0613_NONHUMAN_WRITER_DENIED_OK';
END $nonhuman$;
RESET ROLE;

-- O limite não pode ocultar visitas sem aviso e produzir uma leitura aparentemente integral.
INSERT INTO public.school_institutional_followup_visits(
  logical_id, version, school_id, visit_date, diagnosis, author_user_id,
  author_person_id, request_key)
SELECT gen_random_uuid(), 1, 'school-a', CURRENT_DATE,
  'Registro sintético para ensaio de limite',
  '11111111-1111-4111-8111-111111111111'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  gen_random_uuid()
FROM generate_series(1,1001);

SET ROLE authenticated;
DO $volume$
DECLARE denied boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.school_institutional_followup_school('school-a');
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:history-volume-exceeded' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:silent-history-truncation'; END IF;
  RAISE NOTICE 'FOLLOWUP_0613_VOLUME_FAIL_CLOSED_OK';
END $volume$;

RESET ROLE;

-- Mais de 5.000 medidas abertas não podem ser truncadas silenciosamente no Gabinete.
INSERT INTO public.school_institutional_followup_actions(
  school_id, visit_logical_id, description, author_user_id,
  author_person_id, request_key)
SELECT 'school-a', (SELECT logical_id FROM public.school_institutional_followup_visits
    WHERE school_id = 'school-a' ORDER BY recorded_at DESC LIMIT 1),
  'Medida sintética de carga', '11111111-1111-4111-8111-111111111111'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid, gen_random_uuid()
FROM generate_series(1,5001);

SET ROLE authenticated;
DO $pending_limit$
DECLARE denied boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.school_institutional_followup_pending();
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:network-pending-volume-exceeded' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-positive:silent-network-pending-truncation'; END IF;
  RAISE NOTICE 'FOLLOWUP_0613_PENDING_VOLUME_FAIL_CLOSED_OK';
END $pending_limit$;

RESET ROLE;
ROLLBACK;
