-- NCONC.2 (E) — corrida no calendário. Política de capacidades SINTÉTICA homologada só dentro da transação
-- (mesmo padrão de b4_6_4a). Termina em RAISE: nada persiste.
-- Resultado registrado (2026-10-08): PARCIAL. Tipo de dia: 'calendar-day-type:base-superseded' (PASS).
-- Versão do calendário: o writer vigente (record_calendar_version_with_windowed_applicability) exige uma escola ATIVA
-- na janela do alcance; a escola real escolhida não tem registro vigente em 2026 e esta prova não fabrica escola
-- -> RECURSO_INDISPONIVEL; coberto só pela invariante estática NCONC.1 (trava antes de 'calendar:base-superseded').
DO $t$
DECLARE
  u_sup text := '{"sub":"00000000-0000-0000-0000-0000000c0c01","role":"authenticated"}';
  p1 uuid := '00000000-0000-0000-0000-0000000c0c91'; pol uuid := '00000000-0000-0000-0000-0000000c0ca0';
  _yr text := 'ano-nconc2'; _org text := 'org-nconc2'; _per text := 'per-nconc2'; e1 uuid; t_on jsonb; r jsonb; c jsonb; ok text := ''; s text; ap jsonb;
BEGIN
  SELECT id INTO s FROM institutional_schools ORDER BY id LIMIT 1;
  ap := jsonb_build_array(jsonb_build_object('scope_key','r','window_from','2026-02-01','window_until','2026-12-15','conditions', jsonb_build_array(jsonb_build_object('kind','escola','school_id', s))));
  INSERT INTO institutional_persons(id, display_name) VALUES (p1, 'NCONC2 S1');
  INSERT INTO user_person_links(user_id, person_id) VALUES ((u_sup::jsonb->>'sub')::uuid, p1);
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, scope_level, valid_from) VALUES (p1, 'teste-nconc2-supervisao', 'rede', '2020-01-01') RETURNING id INTO e1;
  INSERT INTO capability_policies(id, logical_policy_id, version, status, valid_from) VALUES (pol, 'teste-nconc2', 1, 'draft', '2020-01-01');
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (pol, 'teste-nconc2-supervisao', 'construir-calendario-da-rede', ARRAY['network']),
    (pol, 'teste-nconc2-supervisao', 'homologar-calendario-da-rede', ARRAY['network']);
  UPDATE capability_policies SET status = 'homologated' WHERE id = pol;
  INSERT INTO institutional_academic_years(id) VALUES (_yr);
  INSERT INTO institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_yr, 1, 'Ano ficticio', '2026-02-01', '2026-12-15', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_period_organizations(id, academic_year_id) VALUES (_org, _yr);
  INSERT INTO institutional_period_organization_versions(organization_id, version, official_name, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_org, 1, 'Org', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  INSERT INTO institutional_academic_periods(id, academic_year_id, label, starts_on, ends_on, period_organization_id) VALUES (_per, _yr, 'P1', '2026-02-01', '2026-06-30', _org);
  INSERT INTO institutional_academic_period_versions(period_id, version, official_name, starts_on, ends_on, is_active, valid_from,
    originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_per, 1, 'P1', '2026-02-01', '2026-06-30', true, '2020-01-01', 'ato', (u_sup::jsonb->>'sub')::uuid, p1, e1);
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', u_sup, true);
  t_on := public.record_calendar_day_type_version(NULL, NULL, 'constituicao', 'Letivo ficticio', true, 'ato-t1', NULL);
  r := public.record_calendar_day_type_version(t_on->>'day_type_id', (t_on->>'version_id')::uuid, 'sucessao', 'Sessão 1', true, 'ato', 'motivo 1');
  BEGIN PERFORM public.record_calendar_day_type_version(t_on->>'day_type_id', (t_on->>'version_id')::uuid, 'sucessao', 'Sessão 2', false, 'ato', 'motivo 2'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar-day-type:base-superseded' THEN RAISE EXCEPTION 'dt: %', SQLERRM; END IF; END;
  ok := ok || 'tipo-de-dia:calendar-day-type:base-superseded ';
  BEGIN
    c := public.record_calendar_version_with_windowed_applicability(NULL, NULL, 'constituicao', _yr, _org, '2026-02-01', '2026-12-15', 'ato-c1', NULL, jsonb_build_array(_per),
      jsonb_build_array(jsonb_build_object('starts_on','2026-03-02','ends_on','2026-03-06','day_type_version_id', r->>'version_id')), '[]', '[]', ap);
  EXCEPTION WHEN raise_exception THEN RAISE EXCEPTION 'NCONC2-CALENDARIO-PARCIAL % versao-nao-constituida:%', ok, SQLERRM; END;
  PERFORM public.record_calendar_version_with_windowed_applicability(c->>'calendar_id', (c->>'version_id')::uuid, 'retificacao', _yr, _org, '2026-02-01', '2026-12-15', 'ato-s1', 'Sessão 1', jsonb_build_array(_per), '[]', '[]', '[]', ap);
  BEGIN PERFORM public.record_calendar_version_with_windowed_applicability(c->>'calendar_id', (c->>'version_id')::uuid, 'retificacao', _yr, _org, '2026-02-01', '2026-12-15', 'ato-s2', 'Sessão 2', jsonb_build_array(_per), '[]', '[]', '[]', ap); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'calendar:base-superseded' THEN RAISE EXCEPTION 'cal: %', SQLERRM; END IF; END;
  ok := ok || 'versao:calendar:base-superseded ';
  RESET ROLE;
  RAISE EXCEPTION 'NCONC2-CALENDARIO-PASS %', ok;
END $t$;
