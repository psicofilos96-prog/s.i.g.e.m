-- N4.3 (0211) — prova no banco; termina em RAISE (nada persiste). Dados sintéticos.
DO $t$
DECLARE s text; m uuid; ok boolean; conf uuid;
BEGIN
  SELECT id INTO s FROM public.institutional_schools ORDER BY id LIMIT 1;
  -- Regra com exigência da competência anterior
  INSERT INTO public.map_competence_rules(id, version, status, homologation_act_ref, valid_from, valid_until, definition)
  VALUES ('n43', 1, 'homologada', 'sintetico-n43', '2099-01-01', '2099-12-31', jsonb_build_object('coveredSchoolIds', jsonb_build_array(s), 'snapshotDate', '{"kind":"dia-fixo-do-mes","day":15}'::jsonb,
    'cells', '[]'::jsonb, 'blockingCellIds', '[]'::jsonb, 'adjustableCellIds', '["turmas"]'::jsonb, 'requirePreviousCompetenceOfficial', true));
  -- Próxima competência: ausência de mapa anterior não vale aprovação (se o mês anterior for operacional)
  IF public.map_year_state_on('2099-02-01') = 'operacional' THEN
    IF public.map_previous_competence_issue(s, 2099, 3, 'n43', 1) <> 'map:previous-competence-missing' THEN RAISE EXCEPTION 'falha: ausência inferida como aprovação'; END IF;
  END IF;
  INSERT INTO public.statistical_maps(school_id, competence_year, competence_month, rule_id, rule_version, opened_by)
  VALUES (s, 2099, 2, 'n43', 1, gen_random_uuid()) RETURNING id INTO m;
  IF public.map_year_state_on('2099-02-01') = 'operacional' AND public.map_previous_competence_issue(s, 2099, 3, 'n43', 1) <> 'map:previous-competence-not-official' THEN
    RAISE EXCEPTION 'falha: mapa não oficial aceito'; END IF;
  -- Janeiro olha dezembro do ano anterior (virada de ano)
  IF public.map_year_state_on('2098-12-01') <> 'operacional' AND public.map_previous_competence_issue(s, 2099, 1, 'n43', 1) IS NOT NULL THEN
    RAISE EXCEPTION 'falha: primeiro mês operacional bloqueado'; END IF;
  -- Ajustes são append-only
  INSERT INTO public.statistical_map_cell_adjustments(map_id, cell_id, kind, calculated_value, adjusted_value, reason, actor_side, recorded_by, principal_id)
  VALUES (m, 'turmas', 'ajuste', '10', '12', 'sintetico', 'escola', gen_random_uuid(), gen_random_uuid());
  ok := false; BEGIN UPDATE public.statistical_map_cell_adjustments SET adjusted_value = '99' WHERE map_id = m; EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'map:adjustment-append-only'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: ajuste alterável'; END IF;
  -- Devolução exige motivo (constraint) e envio
  INSERT INTO public.statistical_map_events(map_id, kind, fingerprint, payload, recorded_by) VALUES (m, 'conferencia', 'f', '{}'::jsonb, gen_random_uuid()) RETURNING id INTO conf;
  ok := false; BEGIN INSERT INTO public.statistical_map_events(map_id, kind, payload, recorded_by, principal_id) VALUES (m, 'devolucao', jsonb_build_object('conferenceEventId', conf), gen_random_uuid(), gen_random_uuid());
    EXCEPTION WHEN check_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: devolução sem motivo'; END IF;
  -- ACL
  IF has_function_privilege('anon','public.return_statistical_map(uuid,uuid,text)','EXECUTE')
     OR has_function_privilege('service_role','public.return_statistical_map(uuid,uuid,text)','EXECUTE')
     OR has_function_privilege('anon','public.record_map_cell_adjustment(uuid,text,uuid,jsonb,jsonb,text,boolean)','EXECUTE')
     OR has_function_privilege('authenticated','public.map_previous_competence_issue(text,integer,integer,text,integer)','EXECUTE')
     OR has_table_privilege('authenticated','public.statistical_map_cell_adjustments','INSERT')
     OR has_table_privilege('authenticated','public.statistical_map_cell_adjustments','UPDATE')
     THEN RAISE EXCEPTION 'falha: acl'; END IF;
  -- Conta autenticada sem capability (ou com escola adulterada) é recusada antes de escrever
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ok := false; BEGIN PERFORM public.return_statistical_map(m, conf, 'x'); EXCEPTION WHEN raise_exception THEN ok := SQLERRM LIKE 'session:%' OR SQLERRM IN ('map:capability-missing','map:not-found'); END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: devolução sem capability'; END IF;
  ok := false; BEGIN PERFORM public.record_map_cell_adjustment(m, 'turmas', NULL, '10', '12', 'x', false); EXCEPTION WHEN raise_exception THEN ok := SQLERRM LIKE 'session:%' OR SQLERRM IN ('map:capability-missing','map:not-found'); END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: ajuste sem capability'; END IF;
  ok := false; BEGIN PERFORM * FROM public.map_mediation_projection_at(s, '2099-02-15'); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'map:capability-missing'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: mediação sem capability'; END IF;
  RESET ROLE;
  RAISE EXCEPTION 'n43-map-tests-ok';
END $t$;
