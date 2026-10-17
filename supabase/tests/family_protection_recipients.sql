-- Camada SQL transacional com claims autenticadas; não prova login/navegador.
-- Executar somente após scripts/harness-gate.mjs. Nada persiste (subtransação revertida).
DO $test$
DECLARE sec uuid := 'b909f2d6-9122-4491-b80b-e2cd4e6022ae';
 g uuid:=gen_random_uuid(); other_g uuid:=gen_random_uuid(); person uuid; person2 uuid;
 a uuid:=gen_random_uuid(); a2 uuid:=gen_random_uuid(); m uuid; st text; seq0 integer; old_due date; result boolean;
BEGIN
 BEGIN
  SELECT student_id INTO st FROM public.school_enrollments WHERE school_id='inep-99999901' AND public.family_enrollment_school(student_id,current_date)='inep-99999901' LIMIT 1;
  IF st IS NULL THEN RAISE EXCEPTION 'missing-test-student'; END IF;
  INSERT INTO public.institutional_persons(display_name) VALUES('TESTE RESPONSAVEL INDICADO') RETURNING id INTO person;
  INSERT INTO public.institutional_persons(display_name) VALUES('TESTE RESPONSAVEL NAO INDICADO') RETURNING id INTO person2;
  INSERT INTO public.user_person_links(user_id,person_id) VALUES(g,person),(other_g,person2);
  INSERT INTO public.guardian_authorizations(logical_id,version,event_kind,student_id,guardian_user_id,school_id,sections,valid_from,recorded_by,recorded_engagement,guardian_person_id)
  VALUES(a,1,'constituicao',st,g,'inep-99999901',ARRAY['matricula'],current_date,sec,gen_random_uuid(),person),
        (a2,1,'constituicao',st,other_g,'inep-99999901',ARRAY['matricula'],current_date,sec,gen_random_uuid(),person2);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',sec,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  m:=public.secretariat_record_protection('inep-99999901',st,NULL,'registrar','impedimento-de-retirada','PESSOA SIGILOSA',current_date,NULL,'TEOR SIGILOSO',NULL,NULL,0);
  PERFORM public.record_protection_recipient('inep-99999901',st,m,a,'indicar','Teste reversível',0,1);
  BEGIN PERFORM public.record_protection_recipient('inep-99999901',st,m,a,'indicar','Teste concorrência',0,1); RAISE EXCEPTION 'stale-accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'protection:stale-base%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',g,'role','authenticated')::text,true);
  result:=public.family_protection_notice(st); IF result IS DISTINCT FROM true THEN RAISE EXCEPTION 'indicated-no-notice'; END IF;
  BEGIN PERFORM public.family_protection_notice('inexistente-teste'); RAISE EXCEPTION 'idor-accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'family:not-authorized%' THEN RAISE; END IF; END;
  BEGIN PERFORM 1 FROM public.student_protection_events; RAISE EXCEPTION 'judicial-table-readable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.student_protection_detail('inep-99999901',m); RAISE EXCEPTION 'judicial-detail-readable';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'protection:capability-missing%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_g,'role','authenticated')::text,true);
  IF public.family_protection_notice(st) IS DISTINCT FROM false THEN RAISE EXCEPTION 'non-recipient-notice'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',sec,'role','authenticated')::text,true);
  PERFORM public.record_protection_recipient('inep-99999901',st,m,a,'retirar','Teste retirada',1,1);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',g,'role','authenticated')::text,true);
  IF public.family_protection_notice(st) IS DISTINCT FROM false THEN RAISE EXCEPTION 'withdrawn-notice'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',sec,'role','authenticated')::text,true);
  PERFORM public.record_protection_recipient('inep-99999901',st,m,a,'indicar','Teste nova indicação',2,1);
  PERFORM public.secretariat_record_protection('inep-99999901',st,m,'corrigir','impedimento-de-retirada','PESSOA SIGILOSA',current_date,NULL,NULL,NULL,'Teste correção',1);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',g,'role','authenticated')::text,true);
  IF public.family_protection_notice(st) IS DISTINCT FROM false THEN RAISE EXCEPTION 'old-version-notice'; END IF;
  RESET ROLE;
  SELECT coalesce(max(sequence),0) INTO seq0 FROM public.student_vaccination_status_events WHERE school_id='inep-99999901' AND student_id=st;
  SELECT due_on INTO old_due FROM public.student_vaccination_status_events WHERE school_id='inep-99999901' AND student_id=st ORDER BY sequence DESC LIMIT 1;
  -- Alteração do catálogo confinada à subtransação; não cria decisão institucional global.
  UPDATE public.sector_parameter_catalog SET default_value='45'::jsonb WHERE key='secretaria.prazo-vacinacao';
  IF EXISTS(SELECT 1 FROM public.sector_parameter_versions WHERE key='secretaria.prazo-vacinacao') THEN RAISE EXCEPTION 'configured-value-requires-separate-fixture'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',sec,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  PERFORM public.secretariat_record_vaccination('inep-99999901',st,'pendente',current_date,NULL,seq0);
  RESET ROLE;
  IF NOT EXISTS(SELECT 1 FROM public.student_vaccination_status_events WHERE school_id='inep-99999901' AND student_id=st AND sequence=seq0+1 AND due_on=current_date+45) THEN RAISE EXCEPTION 'deadline-not-applied'; END IF;
  IF (SELECT due_on FROM public.student_vaccination_status_events WHERE school_id='inep-99999901' AND student_id=st AND sequence=seq0) IS DISTINCT FROM old_due THEN RAISE EXCEPTION 'old-deadline-changed'; END IF;
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='TEST_ROLLBACK_SUCCESS';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'TEST_ROLLBACK_SUCCESS' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'PASS: indicação/retirada/correção/IDOR/sigilo; prazo 45 dias e preservação. Nenhuma fixture persistida.';
END $test$;
