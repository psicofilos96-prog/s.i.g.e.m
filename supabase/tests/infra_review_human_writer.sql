-- Revisão da Infraestrutura: writers humanos com dados temporários. Termina em RAISE: nada persiste.
-- Capacidade dada só dentro da transação. Cobre ambiente (inteiro), condição (catálogo), acessibilidade (sim/não),
-- histórico (nova observação preserva a anterior), zero ≠ ausente, catálogo desconhecido, sem capacidade, append-only.
DO $t$
DECLARE ua uuid := gen_random_uuid(); ux uuid := gen_random_uuid(); pa uuid; px uuid; ea uuid; sa text; n int; r record; msg text;
  h text := repeat('c',64); att text := 'rev-' || substr(md5(random()::text),1,8);
BEGIN
  SET LOCAL statement_timeout = '55s';
  SELECT s.id INTO sa FROM public.institutional_schools s ORDER BY s.id LIMIT 1;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('REV Infra', 'pessoa-natural') RETURNING id INTO pa;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('REV Sem cap', 'pessoa-natural') RETURNING id INTO px;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (ua, pa), (ux, px);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES (pa, 'rev-e2e', NULL, '2026-01-01', 'rede') RETURNING id INTO ea;
  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_rev_original;
  EXECUTE format($s$CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT 'manter-cadastro-unidade-escolar', %L::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 1, 'rede', NULL::text WHERE auth.uid() = %L::uuid $b$$s$, ea, ua);
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated';
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ua, 'role','authenticated')::text, true);
  PERFORM public.record_school_infrastructure_attribute(att || '-salas', 'REV Salas de aula', 'integer', NULL);
  PERFORM public.record_school_infrastructure_attribute(att || '-cond', 'REV Condição do telhado', 'catalog', ARRAY['Informada A','Informada B']);
  PERFORM public.record_school_infrastructure_attribute(att || '-rampa', 'REV Rampa de acesso', 'boolean', NULL);
  PERFORM public.record_school_infrastructure_observation(sa, att || '-salas', '0'::jsonb, '2027-02-01', h, 'rev');
  PERFORM public.record_school_infrastructure_observation(sa, att || '-salas', '6'::jsonb, '2027-03-01', h, 'rev');
  PERFORM public.record_school_infrastructure_observation(sa, att || '-cond', '"Informada A"'::jsonb, '2027-02-01', h, 'rev');
  PERFORM public.record_school_infrastructure_observation(sa, att || '-rampa', 'false'::jsonb, '2027-02-01', h, 'rev');
  SELECT count(*) INTO n FROM public.school_infrastructure_observations WHERE attribute_id = att || '-salas'; IF n <> 2 THEN RAISE EXCEPTION 'FAIL historico %', n; END IF;
  SELECT * INTO r FROM public.school_infrastructure_observations WHERE attribute_id = att || '-salas' AND valid_from = '2027-02-01'; IF r.value_integer IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'FAIL zero'; END IF;
  SELECT * INTO r FROM public.school_infrastructure_observations WHERE attribute_id = att || '-rampa'; IF r.value_boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'FAIL false'; END IF;
  BEGIN PERFORM public.record_school_infrastructure_observation(sa, att || '-cond', '"Inventada"'::jsonb, '2027-02-01', h, 'rev'); RAISE EXCEPTION 'FAIL catalog';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'infra:catalog-value-unknown' THEN RAISE EXCEPTION 'FAIL catalog %', msg; END IF; END;
  BEGIN PERFORM public.record_school_infrastructure_observation(sa, att || '-rampa', 'null'::jsonb, '2027-02-01', h, 'rev'); RAISE EXCEPTION 'FAIL null';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'infra:value-absent-is-not-informed' THEN RAISE EXCEPTION 'FAIL null %', msg; END IF; END;
  BEGIN UPDATE public.school_infrastructure_observations SET value_integer = 9 WHERE attribute_id = att || '-salas'; RAISE EXCEPTION 'FAIL immut';
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg LIKE 'FAIL%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ux, 'role','authenticated')::text, true);
  BEGIN PERFORM public.record_school_infrastructure_observation(sa, att || '-salas', '1'::jsonb, '2027-04-01', h, 'rev'); RAISE EXCEPTION 'FAIL nocap';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg NOT LIKE 'capability:%' THEN RAISE EXCEPTION 'FAIL nocap %', msg; END IF; END;
  RAISE EXCEPTION 'infra-review-ok';
END $t$;
