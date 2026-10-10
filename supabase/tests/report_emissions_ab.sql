-- Prova técnica A/B (identidades sintéticas, sem login humano) da trilha 0288. Termina em RAISE 'AB_PASS': nada persiste.
-- Verifica: A vê só a própria; B não vê, não reemite e não reaproveita chave de A; anon só verifica (sem params/actor) e não emite.
-- (corpo idêntico ao executado em 2026-10-10; ver docs/rotina-de-verificacao.md)
DO $$
DECLARE a uuid := '00000000-0000-4000-8000-0000000000a1'; b uuid := '00000000-0000-4000-8000-0000000000b1'; e record; n int; v jsonb; ok boolean := false;
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  SELECT * INTO e FROM public.record_report_emission('teste-ab',1,'Teste A/B','pdf','{}'::jsonb,3,repeat('a',64),null,'ab-test-key-1');
  SELECT count(*) INTO n FROM public.report_emissions; IF n < 1 THEN RAISE EXCEPTION 'A nao ve a propria'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.report_emissions WHERE id = e.emission_id; IF n <> 0 THEN RAISE EXCEPTION 'B ve emissao de A'; END IF;
  BEGIN PERFORM public.record_report_emission('teste-ab',1,'x','pdf','{}',3,repeat('a',64),e.emission_id,'ab-test-key-2'); EXCEPTION WHEN others THEN ok := SQLERRM = 'REISSUE_NOT_ALLOWED'; END;
  IF NOT ok THEN RAISE EXCEPTION 'B reemitiu de A'; END IF;
  ok := false;
  BEGIN PERFORM public.record_report_emission('teste-ab',1,'x','pdf','{}',3,repeat('a',64),null,'ab-test-key-1'); EXCEPTION WHEN others THEN ok := SQLERRM = 'IDEMPOTENCY_CONFLICT'; END;
  IF NOT ok THEN RAISE EXCEPTION 'B reutilizou chave de A'; END IF;
  PERFORM set_config('role','anon',true); PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
  v := public.verify_report_emission(e.verification_code);
  IF v->>'status' <> 'emitido' OR v ? 'params' OR v ? 'actor_id' THEN RAISE EXCEPTION 'verificacao anon incorreta %', v; END IF;
  ok := false;
  BEGIN PERFORM public.record_report_emission('t',1,'x','pdf','{}',0,repeat('a',64),null,'ab-test-key-3'); EXCEPTION WHEN others THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'anon emitiu'; END IF;
  RAISE EXCEPTION 'AB_PASS';
END $$;
