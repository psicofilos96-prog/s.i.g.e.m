-- Contrato isolado de designações por posto; nenhum dado sobrevive.
-- CI PostgreSQL 17 apenas; nunca executar na base institucional publicada.
BEGIN;

INSERT INTO auth.users(id,email,raw_app_meta_data,email_confirmed_at) VALUES
 ('66666666-6666-4666-8666-666666666666','acomp1@sigem.itap.gov.br',
  '{"sigem_account":"followup-functional-pending","followup_seat":"acomp1"}',now()),
 ('77777777-7777-4777-8777-777777777777','gab@sigem.itap.gov.br',
  '{"sigem_account":"followup-functional-pending","followup_seat":"gab"}',now());

-- Os helpers privados não são RPCs públicas. Os writers governados e o
-- reader de autoridade só podem ser chamados por usuários autenticados.
DO $security$
BEGIN
  IF has_function_privilege('authenticated','public.followup_seat_active_assignment()','EXECUTE')
    OR has_function_privilege('authenticated','public.followup_seat_effective_grants(date)','EXECUTE')
    OR has_function_privilege('authenticated','public.followup_seat_is_account(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.followup_seat_authority(date)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.followup_seat_authority(date)','EXECUTE')
  THEN RAISE EXCEPTION 'followup-0615:rpc-grants-incorrect'; END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('followup_seat_assignments','followup_seat_revocations')) <> 0
  THEN RAISE EXCEPTION 'followup-0615:unintended-rls-policy'; END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN (
      'followup_seat_assignments','followup_seat_revocations'
    ) AND c.relrowsecurity) <> 2
  THEN RAISE EXCEPTION 'followup-0615:rls-not-enabled'; END IF;
END $security$;

-- As contas de posto não podem ser vinculadas à identidade global nem
-- receber principal setorial, mesmo com privilégio SQL do teste.
DO $negative$
DECLARE blocked boolean;
BEGIN
  blocked:=false;
  BEGIN
    INSERT INTO public.user_person_links(user_id,person_id)
      VALUES ('66666666-6666-4666-8666-666666666666'::uuid,
        '11111111-1111-4111-8111-111111111111'::uuid);
  EXCEPTION WHEN others THEN
    IF SQLERRM='followup-seat:global-person-link-forbidden'
      THEN blocked:=true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'followup-0615:global-link-accepted'; END IF;

  blocked:=false;
  BEGIN
    INSERT INTO public.institutional_sector_principals(auth_user_id)
      VALUES ('77777777-7777-4777-8777-777777777777'::uuid);
  EXCEPTION WHEN others THEN
    IF SQLERRM='followup-seat:sector-principal-forbidden'
      THEN blocked:=true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'followup-0615:sector-principal-accepted'; END IF;
END $negative$;

-- O velho JWT foi aberto antes da designação, portanto jamais a herda.
INSERT INTO auth.sessions(id,user_id,created_at) VALUES
 ('aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa',
  '66666666-6666-4666-8666-666666666666',clock_timestamp() - interval '1 hour');
SET ROLE authenticated;
DO $designate$
DECLARE
  a uuid;
  cab uuid;
  n integer;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub','99999999-9999-4999-8999-999999999999',
      'role','authenticated')::text,true);
  SELECT public.designate_followup_seat(
    'acomp1','66666666-6666-4666-8666-666666666666'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,'Ato de teste n. 1',
    '11111111-aaaa-4aaa-8aaa-111111111111'::uuid) INTO a;
  IF a IS NULL THEN RAISE EXCEPTION 'followup-0615:assignment-not-created'; END IF;
  PERFORM set_config('sigem.test_followup_seat_assignment',a::text,true);
  -- Retry idempotente devolve a mesma designação.
  IF public.designate_followup_seat(
    'acomp1','66666666-6666-4666-8666-666666666666'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,'Ato de teste n. 1',
    '11111111-aaaa-4aaa-8aaa-111111111111'::uuid) IS DISTINCT FROM a
  THEN RAISE EXCEPTION 'followup-0615:idempotency-mismatch'; END IF;
  SELECT public.designate_followup_seat(
    'gab','77777777-7777-4777-8777-777777777777'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,'Ato de teste Gabinete',
    '22222222-aaaa-4aaa-8aaa-222222222222'::uuid) INTO cab;
  IF cab IS NULL THEN RAISE EXCEPTION 'followup-0615:cabinet-not-designated'; END IF;

  -- Um login sem capacidade administrativa não pode escolher ocupante.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub','33333333-3333-4333-8333-333333333333',
      'role','authenticated')::text,true);
  n:=0;
  BEGIN
    PERFORM public.designate_followup_seat(
      'acomp2','66666666-6666-4666-8666-666666666666'::uuid,
      '55555555-5555-4555-8555-555555555555'::uuid,'Ato indevido',
      gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM='followup-seat:admin-denied' THEN n:=1; ELSE RAISE; END IF;
  END;
  IF n<>1 THEN RAISE EXCEPTION 'followup-0615:unauthorized-admin'; END IF;
END $designate$;

-- Antes da nova autenticação nem o antigo refresh JWT nem o mesmo iat
-- pós-designação conseguem autorizar um posto.
DO $old$
DECLARE n integer; today_ date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub','66666666-6666-4666-8666-666666666666',
      'role','authenticated','session_id','aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa',
      'iat',extract(epoch FROM now()+interval '1 hour')::bigint)::text,true);
  SELECT count(*) INTO n FROM public.followup_seat_authority(today_);
  IF n<>0 THEN RAISE EXCEPTION 'followup-0615:old-session-authority'; END IF;
  SELECT count(*) INTO n FROM public.school_institutional_followup_network(today_,today_);
  IF n<>0 THEN RAISE EXCEPTION 'followup-0615:old-session-read'; END IF;
END $old$;
RESET ROLE;

INSERT INTO auth.sessions(id,user_id,created_at) VALUES
 ('bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb',
  '66666666-6666-4666-8666-666666666666',clock_timestamp()),
 ('cccccccc-7777-4777-8777-cccccccccccc',
  '77777777-7777-4777-8777-777777777777',clock_timestamp());

SET ROLE authenticated;
DO $authorized$
DECLARE
  today_ date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;
  n integer;
  denied boolean;
BEGIN
  -- Dois postos usam identidades próprias, sem user_person_links.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub','66666666-6666-4666-8666-666666666666',
      'role','authenticated','session_id','bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb')::text,true);
  SELECT count(*) INTO n FROM public.followup_seat_authority(today_)
    WHERE capability_id='registrar-acompanhamento-institucional'
      AND person_id='11111111-1111-4111-8111-111111111111'::uuid;
  IF n<>1 THEN RAISE EXCEPTION 'followup-0615:writer-authority-not-found'; END IF;
  SELECT count(*) INTO n FROM public.followup_seat_authority(today_);
  IF n<>1 THEN RAISE EXCEPTION 'followup-0615:inherited-extra-capabilities'; END IF;
  SELECT count(*) INTO n FROM public.school_institutional_followup_network(today_,today_);
  IF n<>1 THEN RAISE EXCEPTION 'followup-0615:writer-scope'; END IF;
  PERFORM public.record_school_institutional_followup_bundle(
    'school-a',today_,'Visita do posto A antes da troca','','','',
    gen_random_uuid(),'[]'::jsonb);

  -- Gabinete só vê a rede, mesmo que a política de teste contenha
  -- propositalmente uma regra de escrita na mesma atuação.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub','77777777-7777-4777-8777-777777777777',
      'role','authenticated','session_id','cccccccc-7777-4777-8777-cccccccccccc')::text,true);
  SELECT count(*) INTO n FROM public.followup_seat_authority(today_)
    WHERE capability_id='consultar-acompanhamento-institucional';
  IF n<>1 THEN RAISE EXCEPTION 'followup-0615:cabinet-reader'; END IF;
  SELECT count(*) INTO n FROM public.followup_seat_authority(today_);
  IF n<>1 THEN RAISE EXCEPTION 'followup-0615:cabinet-unexpected-capability'; END IF;
  SELECT count(*) INTO n FROM public.school_institutional_followup_network(today_,today_);
  IF n<>2 THEN RAISE EXCEPTION 'followup-0615:cabinet-scope'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.record_school_institutional_followup_bundle(
      'school-a',today_,'Gabinete sem permissão','','','',
      gen_random_uuid(),'[]'::jsonb);
  EXCEPTION WHEN others THEN
    IF SQLERRM='followup:recording-denied' THEN denied:=true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-0615:cabinet-write'; END IF;
END $authorized$;
RESET ROLE;

-- Reivindicar um ato de revogação interrompe acesso imediatamente,
-- sem aguardar expiração do JWT. Nova designação exige sessão nova.
SET ROLE authenticated;
DO $revoke$
DECLARE
  a uuid; rid uuid; n integer;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub','99999999-9999-4999-8999-999999999999',
      'role','authenticated')::text,true);
  -- A leitura direta está proibida por RLS; usar apenas o ID recebido
  -- do writer governado na primeira etapa da mesma transação sintética.
  a:=current_setting('sigem.test_followup_seat_assignment')::uuid;
  SELECT public.revoke_followup_seat(a,'Substituição formal de teste',
    '33333333-aaaa-4aaa-8aaa-333333333333'::uuid) INTO rid;
  IF rid IS NULL THEN RAISE EXCEPTION 'followup-0615:revocation-missing'; END IF;
  SELECT public.designate_followup_seat(
    'acomp1','66666666-6666-4666-8666-666666666666'::uuid,
    '55555555-5555-4555-8555-555555555555'::uuid,'Novo ato de teste',
    '44444444-aaaa-4aaa-8aaa-444444444444'::uuid) INTO a;
  IF a IS NULL THEN RAISE EXCEPTION 'followup-0615:replacement-missing'; END IF;
END $revoke$;

DO $stale$
DECLARE today_ date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date; n integer;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub','66666666-6666-4666-8666-666666666666',
      'role','authenticated','session_id','bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb')::text,true);
  SELECT count(*) INTO n FROM public.followup_seat_authority(today_);
  IF n<>0 THEN RAISE EXCEPTION 'followup-0615:old-session-reassignment'; END IF;
  SELECT count(*) INTO n FROM public.school_institutional_followup_network(today_,today_);
  IF n<>0 THEN RAISE EXCEPTION 'followup-0615:old-session-kept-data'; END IF;
END $stale$;
RESET ROLE;

-- Mesmo que o novo operador também receba permissão para a escola A,
-- ele NÃO se torna autor da visita antiga registrada ali.
INSERT INTO public.institutional_engagements
  (person_id,engagement_kind_id,scope_level,school_id,valid_from)
VALUES ('55555555-5555-4555-8555-555555555555',
  'test-followup-writer','escola','school-a',CURRENT_DATE-30);

INSERT INTO auth.sessions(id,user_id,created_at) VALUES
 ('dddddddd-6666-4666-8666-dddddddddddd',
  '66666666-6666-4666-8666-666666666666',clock_timestamp());
SET ROLE authenticated;
DO $new$
DECLARE
  today_ date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;
  n integer; original_visit uuid; doc jsonb; denied boolean:=false;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub','66666666-6666-4666-8666-666666666666',
      'role','authenticated','session_id','dddddddd-6666-4666-8666-dddddddddddd')::text,true);
  SELECT count(*) INTO n FROM public.followup_seat_authority(today_)
    WHERE person_id='55555555-5555-4555-8555-555555555555'::uuid
      AND school_id='school-b';
  IF n<>1 THEN RAISE EXCEPTION 'followup-0615:new-holder-authority'; END IF;
  PERFORM public.record_school_institutional_followup_bundle(
    'school-b',today_,'Visita do posto A após troca','','','',
    gen_random_uuid(),'[]'::jsonb);

  SELECT id INTO original_visit FROM public.school_institutional_followup_visits
    WHERE diagnosis='Visita do posto A antes da troca';
  doc:=public.school_institutional_followup_school('school-a');
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(doc->'visits') visit
    WHERE visit->>'id'=original_visit::text
      AND (visit->>'can_correct')::boolean IS DISTINCT FROM false
  ) THEN RAISE EXCEPTION 'followup-0615:old-visit-correct-button'; END IF;
  BEGIN
    PERFORM public.record_school_institutional_followup_visit(
      'school-a',today_,'Retificação por outra pessoa','','','',
      original_visit,'Tentativa de alteração de autoria',gen_random_uuid());
  EXCEPTION WHEN others THEN
    IF SQLERRM='followup:only-author-corrects'
      THEN denied:=true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-0615:reassigned-user-corrected-old-visit'; END IF;
END $new$;
RESET ROLE;

DO $audit$
BEGIN
  IF (SELECT count(*) FROM public.school_institutional_followup_visits
    WHERE diagnosis='Visita do posto A antes da troca'
      AND author_person_id='11111111-1111-4111-8111-111111111111'::uuid)<>1
   OR (SELECT count(*) FROM public.school_institutional_followup_visits
    WHERE diagnosis='Visita do posto A após troca'
      AND author_person_id='55555555-5555-4555-8555-555555555555'::uuid)<>1
  THEN RAISE EXCEPTION 'followup-0615:authorship-incorrect'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_person_links l
    WHERE l.user_id IN ('66666666-6666-4666-8666-666666666666'::uuid,
      '77777777-7777-4777-8777-777777777777'::uuid))
  THEN RAISE EXCEPTION 'followup-0615:global-link-leak'; END IF;
  RAISE NOTICE 'FOLLOWUP_0615_FUNCTIONAL_SEATS_SEGREGATED_OK';
END $audit$;

ROLLBACK;
