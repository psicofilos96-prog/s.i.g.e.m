-- Prova de reuso de login funcional / JWT antigo — EXCLUSIVO do PostgreSQL de CI.
-- Não usar contas reais. Nenhuma modificação sobrevive ao ROLLBACK.
BEGIN;

-- A conta sintética A torna-se o posto funcional 1. A ligação inicial foi
-- anterior à sessão válida, e o JWT velho precede esse vínculo.
UPDATE public.user_person_links
SET created_at = clock_timestamp() - interval '30 minutes'
WHERE user_id = '11111111-1111-4111-8111-111111111111'::uuid;
UPDATE auth.users
SET email = 'acomp1@sigem.itap.gov.br',
    raw_app_meta_data = '{"sigem_account":"followup-functional-pending","followup_seat":"acomp1"}'::jsonb
WHERE id = '11111111-1111-4111-8111-111111111111'::uuid;
INSERT INTO auth.sessions(id,user_id,created_at) VALUES
  ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111', clock_timestamp() - interval '1 hour'),
  ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
    '11111111-1111-4111-8111-111111111111', clock_timestamp() - interval '10 minutes');

SET ROLE authenticated;
DO $test$
DECLARE
  a CONSTANT uuid := '11111111-1111-4111-8111-111111111111';
  old_session CONSTANT uuid := 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
  current_session CONSTANT uuid := 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
  today_ date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  denied boolean;
  n integer;
BEGIN
  -- JWT autenticado ANTIGO não pode herdar o vínculo criado depois.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', a, 'role', 'authenticated', 'session_id', old_session)::text, true);
  SELECT count(*) INTO n FROM public.school_institutional_followup_network(today_,today_);
  IF n <> 0 THEN RAISE EXCEPTION 'followup-0614:old-session-network-leak'; END IF;
  denied := false;
  BEGIN
    PERFORM public.record_school_institutional_followup_bundle(
      'school-a', today_, 'JWT antigo não pode registrar', '', '', '',
      gen_random_uuid(), '[]'::jsonb);
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:recording-denied' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'followup-0614:old-session-write'; END IF;

  -- Nova autenticação após a ligação vigente pode usar o escopo canônico.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', a, 'role', 'authenticated', 'session_id', current_session)::text, true);
  SELECT count(*) INTO n FROM public.school_institutional_followup_network(today_,today_);
  IF n <> 1 THEN RAISE EXCEPTION 'followup-0614:current-session-read'; END IF;
  PERFORM public.record_school_institutional_followup_bundle(
    'school-a', today_, 'Autoria anterior ao remanejamento', '', '', '',
    gen_random_uuid(), '[]'::jsonb);
END $test$;
RESET ROLE;

-- A mutação direta de uma ligação funcional deve falhar antes de mudar
-- a pessoa: simples UPDATE deixaria JWT velho operar como a pessoa nova.
DO $test$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    UPDATE public.user_person_links
       SET person_id = '55555555-5555-4555-8555-555555555555'::uuid
     WHERE user_id = '11111111-1111-4111-8111-111111111111'::uuid;
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'followup:seat-rebind-requires-governance'
      THEN blocked := true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'followup-0614:update-accepted'; END IF;
END $test$;

-- Simulação exclusiva de DBA no CI: eliminação da ligação antiga seguida de
-- inserção de um novo vínculo. O gatilho grava a data efetiva de INSERT,
-- independentemente de tentativa de falsificá-la no parâmetro.
DELETE FROM public.user_person_links
WHERE user_id = '11111111-1111-4111-8111-111111111111'::uuid;
INSERT INTO public.user_person_links(user_id,person_id,created_at)
VALUES ('11111111-1111-4111-8111-111111111111'::uuid,
        '55555555-5555-4555-8555-555555555555'::uuid,
        '2020-01-01T00:00:00Z'::timestamptz);
DO $test$
DECLARE linked_at timestamptz;
BEGIN
  SELECT created_at INTO linked_at FROM public.user_person_links
  WHERE user_id = '11111111-1111-4111-8111-111111111111'::uuid;
  IF linked_at < clock_timestamp() - interval '5 minutes'
    THEN RAISE EXCEPTION 'followup-0614:backdated-link-was-accepted'; END IF;
END $test$;
INSERT INTO auth.sessions(id,user_id,created_at) VALUES
  ('cccccccc-3333-4333-8333-cccccccccccc',
    '11111111-1111-4111-8111-111111111111', clock_timestamp());

SET ROLE authenticated;
DO $test$
DECLARE
  a CONSTANT uuid := '11111111-1111-4111-8111-111111111111';
  preceding CONSTANT uuid := 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
  next_session CONSTANT uuid := 'cccccccc-3333-4333-8333-cccccccccccc';
  today_ date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  n integer;
BEGIN
  -- Até a sessão que estava válida ANTES da troca deve perder o poder
  -- imediatamente, independentemente da renovação do JWT / iat.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', a, 'role', 'authenticated', 'session_id', preceding)::text, true);
  SELECT count(*) INTO n FROM public.school_institutional_followup_network(today_,today_);
  IF n <> 0 THEN RAISE EXCEPTION 'followup-0614:reassigned-old-jwt-leak'; END IF;

  -- Uma autenticação posterior ao novo vínculo é a única aceita.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', a, 'role', 'authenticated', 'session_id', next_session)::text, true);
  SELECT count(*) INTO n FROM public.school_institutional_followup_network(today_,today_);
  IF n <> 1 THEN RAISE EXCEPTION 'followup-0614:new-session-was-denied'; END IF;
  PERFORM public.record_school_institutional_followup_bundle(
    'school-a', today_, 'Autoria posterior ao remanejamento', '', '', '',
    gen_random_uuid(), '[]'::jsonb);
END $test$;
RESET ROLE;

DO $test$
BEGIN
  IF (SELECT count(*) FROM public.school_institutional_followup_visits
      WHERE diagnosis = 'Autoria anterior ao remanejamento'
        AND author_person_id = '11111111-1111-4111-8111-111111111111'::uuid) <> 1
    OR (SELECT count(*) FROM public.school_institutional_followup_visits
      WHERE diagnosis = 'Autoria posterior ao remanejamento'
        AND author_person_id = '55555555-5555-4555-8555-555555555555'::uuid) <> 1
  THEN RAISE EXCEPTION 'followup-0614:historical-authorship-modified'; END IF;
  RAISE NOTICE 'FOLLOWUP_0614_SEAT_SESSION_ROTATION_OK';
END $test$;

ROLLBACK;
