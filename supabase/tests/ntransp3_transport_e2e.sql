-- NTRANSP.3 — E2E transacional sintético do Transporte escolar. Termina em RAISE: nada persiste.
-- Capacidade concedida só dentro da transação (função de capacidades substituída e desfeita no rollback);
-- produção continua sem capability atribuída (ASSIGNMENT_PENDING).
-- Cobre: rota → ponto → vínculo estudante↔ponto, vigência, revogação (nova versão), base alterada,
-- rota/ponto de outra escola, estudante sem matrícula, outra escola sem leitura, sem capacidade, append-only.
DO $t$
DECLARE
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ux uuid := gen_random_uuid();
  sa text; sb text; st text; pa uuid; pb uuid; px uuid; ea uuid; eb uuid; ex uuid;
  rota uuid := gen_random_uuid(); ponto uuid := gen_random_uuid(); vinc uuid := gen_random_uuid(); rotab uuid := gen_random_uuid();
  n int; ok text := '';
BEGIN
  SET LOCAL statement_timeout = '55s'; SET LOCAL lock_timeout = '5s';
  SELECT e.school_id, e.student_id INTO sa, st FROM public.school_enrollments e ORDER BY e.school_id, e.student_id LIMIT 1;
  IF sa IS NULL THEN RAISE EXCEPTION 'ntransp3:sem-matricula-para-referencia'; END IF;
  SELECT s.id INTO sb FROM public.institutional_schools s WHERE s.id <> sa ORDER BY s.id LIMIT 1;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('NT3 Escola A', 'pessoa-natural') RETURNING id INTO pa;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('NT3 Escola B', 'pessoa-natural') RETURNING id INTO pb;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('NT3 Sem capacidade', 'pessoa-natural') RETURNING id INTO px;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (ua, pa), (ub, pb), (ux, px);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pa, 'nt3-e2e', sa, '2026-01-01', 'escola') RETURNING id INTO ea;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pb, 'nt3-e2e', sb, '2026-01-01', 'escola') RETURNING id INTO eb;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (px, 'nt3-e2e', sa, '2026-01-01', 'escola') RETURNING id INTO ex;

  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_nt3_original;
  EXECUTE format($s$CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT 'manter-transporte-escolar', %L::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 1, 'escola', %L WHERE auth.uid() = %L::uuid
      UNION ALL SELECT 'manter-transporte-escolar', %L::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 1, 'escola', %L WHERE auth.uid() = %L::uuid $b$$s$,
      ea, sa, ua, eb, sb, ub);
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated';
  SET LOCAL ROLE authenticated;

  -- Escola A: rota, ponto, vínculo.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ua, 'role','authenticated')::text, true);
  PERFORM public.record_school_transport_fact(sa, 'rota', rota, 0, NULL, NULL, NULL, 'NT3 Rota', '2027-02-01', NULL, false);
  PERFORM public.record_school_transport_fact(sa, 'ponto', ponto, 0, rota, NULL, NULL, 'NT3 Ponto', '2027-02-01', NULL, false);
  PERFORM public.record_school_transport_fact(sa, 'vinculo-estudante', vinc, 0, NULL, ponto, st, NULL, '2027-02-01', '2027-06-30', false);
  BEGIN PERFORM public.record_school_transport_fact(sa, 'rota', rota, 0, NULL, NULL, NULL, 'x', '2027-02-01', NULL, false); RAISE EXCEPTION 'stale aceito'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'transporte:base-alterada' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_school_transport_fact(sa, 'vinculo-estudante', gen_random_uuid(), 0, NULL, ponto, 'nt3-inexistente', NULL, '2027-02-01', NULL, false); RAISE EXCEPTION 'sem matricula aceito'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'transporte:estudante-sem-matricula-na-escola' THEN RAISE; END IF; END;
  -- Revogação = nova versão; histórico preservado.
  PERFORM public.record_school_transport_fact(sa, 'vinculo-estudante', vinc, 1, NULL, ponto, st, NULL, '2027-02-01', '2027-06-30', true);
  SELECT count(*) INTO n FROM public.school_transport_facts WHERE logical_id = vinc; IF n <> 2 THEN RAISE EXCEPTION 'historico perdido'; END IF;
  BEGIN UPDATE public.school_transport_facts SET label = 'x' WHERE logical_id = rota; RAISE EXCEPTION 'update aceito'; EXCEPTION WHEN raise_exception OR insufficient_privilege THEN IF SQLERRM NOT IN ('transporte:append-only') AND SQLSTATE <> '42501' THEN RAISE; END IF; END;
  ok := ok || 'chain ';

  -- Escola B: não lê A, não grava ponto em rota de A.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ub, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.school_transport_facts WHERE school_id = sa; IF n <> 0 THEN RAISE EXCEPTION 'escola B leu A'; END IF;
  BEGIN PERFORM public.record_school_transport_fact(sb, 'ponto', gen_random_uuid(), 0, rota, NULL, NULL, 'x', '2027-02-01', NULL, false); RAISE EXCEPTION 'rota alheia aceita'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'transporte:rota-de-outra-escola' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_school_transport_fact(sa, 'rota', rotab, 0, NULL, NULL, NULL, 'x', '2027-02-01', NULL, false); RAISE EXCEPTION 'escola alheia aceita'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'transporte:sem-autorizacao' THEN RAISE; END IF; END;
  ok := ok || 'idor ';

  -- Sem capacidade: nem lê nem grava.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ux, 'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.school_transport_facts WHERE school_id = sa; IF n <> 0 THEN RAISE EXCEPTION 'sem capacidade leu'; END IF;
  BEGIN PERFORM public.record_school_transport_fact(sa, 'rota', gen_random_uuid(), 0, NULL, NULL, NULL, 'x', '2027-02-01', NULL, false); RAISE EXCEPTION 'sem capacidade gravou'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'transporte:sem-autorizacao' THEN RAISE; END IF; END;
  ok := ok || 'nocap ';

  RAISE EXCEPTION 'ntransp3-e2e-ok: %', ok;
END $t$;
