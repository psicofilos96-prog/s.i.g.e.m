-- BQ.1C — prova transacional (owner) do principal setorial. Termina em ROLLBACK; nada persiste.
-- Execução: psql -v ON_ERROR_STOP=1 -f supabase/tests/bq1c_sector_principal.sql (como owner das funções).
BEGIN;
DO $$
DECLARE ciece uuid; ciece_p uuid; sec uuid; sec_school text; other text; rid uuid; rec record; n int; err text;
BEGIN
  SELECT auth_user_id, id INTO ciece, ciece_p FROM public.institutional_sector_principals WHERE station_code = 'ciece';
  SELECT auth_user_id, school_id INTO sec, sec_school FROM public.institutional_sector_principals WHERE station_code = 'secretaria_escolar' ORDER BY school_id LIMIT 1;
  SELECT id INTO other FROM public.institutional_schools WHERE id <> sec_school LIMIT 1;
  IF (SELECT count(*) FROM public.sector_admin_coverage_issues()) <> 0 THEN RAISE EXCEPTION 'admin-coverage-incomplete'; END IF;

  -- Sem sessão: nada.
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF public.current_principal_id() IS NOT NULL OR EXISTS (SELECT 1 FROM public.sector_station_grants()) THEN RAISE EXCEPTION 'anon-has-grants'; END IF;

  -- INSTITUTIONAL_ACTOR_ALLOWED: CIECE registra revisão de qualidade; autoria = principal, pessoa NULL.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ciece, 'role', 'authenticated')::text, true);
  SELECT * INTO rec FROM public.current_actor();
  IF rec.actor_kind <> 'institutional' OR rec.person_id IS NOT NULL OR rec.institutional_principal_id <> ciece_p THEN RAISE EXCEPTION 'actor-wrong'; END IF;
  rid := public.record_data_quality_review('bq1c:probe', repeat('a',64), 'bq1c-probe', 1, NULL, 'revisado', 'prova BQ.1C', NULL);
  SELECT * INTO rec FROM public.data_quality_review_events WHERE id = rid;
  IF rec.recorded_by_principal <> ciece_p OR rec.recorded_by_person IS NOT NULL OR rec.recorded_by <> ciece THEN RAISE EXCEPTION 'authorship-wrong'; END IF;

  -- HUMAN_ONLY: writer que exige pessoa recusa a conta setorial mesmo com a capability.
  IF NOT public.has_network_capability('manter-regra-de-competencia-do-mapa') THEN RAISE EXCEPTION 'ciece-lacks-cap'; END IF;
  BEGIN PERFORM public.record_map_competence_rule_draft('bq1c-probe', 0, DATE '2027-01-01', NULL, '{}'::jsonb); err := 'none';
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err <> 'session:person-required' THEN RAISE EXCEPTION 'human-only-not-enforced: %', err; END IF;

  -- Escola: só a própria; nunca rede; escola adulterada recusa.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sec, 'role', 'authenticated')::text, true);
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', sec_school) THEN RAISE EXCEPTION 'own-school-denied'; END IF;
  IF public.has_school_capability('manter-matricula-e-enturmacao', other) THEN RAISE EXCEPTION 'foreign-school-allowed'; END IF;
  IF public.has_network_capability('manter-matricula-e-enturmacao') THEN RAISE EXCEPTION 'school-escalated-to-network'; END IF;
  SELECT count(*) INTO n FROM public.effective_capabilities() WHERE school_id IS DISTINCT FROM sec_school;
  IF n <> 0 THEN RAISE EXCEPTION 'class-rows-outside-school'; END IF;

  -- Revogação: vale na hora, sem logout.
  INSERT INTO public.institutional_sector_principal_revocations VALUES ((SELECT id FROM public.institutional_sector_principals WHERE auth_user_id = sec), CURRENT_DATE, 'prova BQ.1C', now());
  IF public.current_principal_id() IS NOT NULL OR EXISTS (SELECT 1 FROM public.effective_scope_capabilities()) THEN RAISE EXCEPTION 'revoked-still-active'; END IF;

  -- Imutabilidade.
  BEGIN UPDATE public.institutional_sector_principals SET station_code = 'ciece' WHERE auth_user_id = sec; err := 'none';
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err <> 'sector-principal:immutable' THEN RAISE EXCEPTION 'principal-mutable'; END IF;

  -- Provisionamento: divergência recusada; escola sem INEP recusada; rede com escola recusada.
  BEGIN PERFORM public.provision_sector_principal(ciece, 'avaliacao', NULL, 'probe'); err := 'none'; EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err <> 'sector-principal:divergent-existing' THEN RAISE EXCEPTION 'divergence-accepted'; END IF;
  BEGIN PERFORM public.provision_sector_principal(gen_random_uuid(), 'ciece', sec_school, 'probe'); err := 'none'; EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err <> 'sector-principal:network-with-school' THEN RAISE EXCEPTION 'network-with-school-accepted'; END IF;
  BEGIN PERFORM public.provision_sector_principal(gen_random_uuid(), 'direcao_escolar', NULL, 'probe'); err := 'none'; EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err <> 'sector-principal:school-ineligible' THEN RAISE EXCEPTION 'school-without-inep-accepted'; END IF;
  RAISE NOTICE 'BQ1C SQL PASS';
END $$;
ROLLBACK;
