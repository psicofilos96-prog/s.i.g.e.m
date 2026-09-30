-- B2.4. Executar em ambiente de testes: o relatório final causa rollback integral.
DO $test$
DECLARE
  report text := E'\n'; year_id text; org_id text; other_org text; test_period_id text;
  year_v1 uuid; period_v1 uuid; period_v2 uuid; n integer; actor uuid;
  v1 uuid; v2 uuid;
  temporal_org text; a_id text; b_id text; a_v1 uuid; a_v2 uuid; b_v1 uuid; b_v2 uuid;
  network_claim text := '{"sub":"00000000-0000-0000-0000-00000000b241","role":"authenticated"}';
  expired_claim text := '{"sub":"00000000-0000-0000-0000-00000000b242","role":"authenticated"}';
  school_claim text := '{"sub":"00000000-0000-0000-0000-00000000b243","role":"authenticated"}';
  no_cap_claim text := '{"sub":"00000000-0000-0000-0000-00000000b244","role":"authenticated"}';
BEGIN
  SELECT id INTO v1 FROM capability_policies WHERE logical_policy_id='politica-capacidades-diario' AND version=1;
  SELECT id INTO v2 FROM capability_policies WHERE logical_policy_id='politica-capacidades-diario' AND version=2;
  IF (SELECT count(*) FROM capability_policy_rules WHERE policy_id=v1) <> 108
    OR (SELECT count(*) FROM capability_policy_rules WHERE policy_id=v2) <> 114
    OR (SELECT count(*) FROM capability_policies WHERE logical_policy_id='politica-capacidades-diario') <> 2
    OR (SELECT count(*) FROM capability_policies WHERE id IN (v1,v2) AND status='draft') <> 2
  THEN RAISE EXCEPTION 'policy:version-count-or-status'; END IF;
  IF (SELECT count(*) FROM capability_policy_rules WHERE policy_id=v2 AND capability_id='manter-anos-e-periodos-letivos'
      AND engagement_kind_id='cadastro-institucional-da-rede' AND scope_dimensions=ARRAY['network']) <> 1
    OR EXISTS (SELECT 1 FROM capability_policy_rules WHERE policy_id=v1 AND capability_id='manter-anos-e-periodos-letivos')
    OR EXISTS (SELECT 1 FROM capability_policy_rules WHERE policy_id=v2 GROUP BY engagement_kind_id,capability_id,scope_dimensions HAVING count(*)>1)
  THEN RAISE EXCEPTION 'policy:scope-or-duplicate'; END IF;
  report := report || E'política v1 108 draft, v2 114 draft, sem duplicatas\n';

  INSERT INTO institutional_persons(id,display_name) VALUES
    ('00000000-0000-0000-0000-00000000b251','Rede'),
    ('00000000-0000-0000-0000-00000000b252','Vencida'),
    ('00000000-0000-0000-0000-00000000b253','Escola'),
    ('00000000-0000-0000-0000-00000000b254','Sem capacidade');
  INSERT INTO user_person_links(user_id,person_id) VALUES
    ('00000000-0000-0000-0000-00000000b241','00000000-0000-0000-0000-00000000b251'),
    ('00000000-0000-0000-0000-00000000b242','00000000-0000-0000-0000-00000000b252'),
    ('00000000-0000-0000-0000-00000000b243','00000000-0000-0000-0000-00000000b253'),
    ('00000000-0000-0000-0000-00000000b244','00000000-0000-0000-0000-00000000b254');
  INSERT INTO institutional_schools(id) VALUES ('esc-b24');
  INSERT INTO institutional_engagements(person_id,engagement_kind_id,scope_level,school_id,valid_from,valid_until) VALUES
    ('00000000-0000-0000-0000-00000000b251','cadastro-institucional-da-rede','rede',NULL,'2020-01-01',NULL),
    ('00000000-0000-0000-0000-00000000b252','cadastro-institucional-da-rede','rede',NULL,'2020-01-01','2021-01-01'),
    ('00000000-0000-0000-0000-00000000b253','cadastro-institucional-da-rede','escola','esc-b24','2020-01-01',NULL),
    ('00000000-0000-0000-0000-00000000b254','professor','escola','esc-b24','2020-01-01',NULL);
  -- A política real continua em rascunho. Homologação artificial só nesta transação de teste.
  INSERT INTO capability_policies(id,logical_policy_id,version,status,valid_from)
    VALUES ('00000000-0000-0000-0000-00000000b255','teste-b24',1,'draft','2020-01-01');
  INSERT INTO capability_policy_rules(policy_id,engagement_kind_id,capability_id,scope_dimensions)
    VALUES ('00000000-0000-0000-0000-00000000b255','cadastro-institucional-da-rede','manter-anos-e-periodos-letivos',ARRAY['network']);
  UPDATE capability_policies SET status='homologated' WHERE id='00000000-0000-0000-0000-00000000b255';

  PERFORM set_config('request.jwt.claims', no_cap_claim, true);
  BEGIN PERFORM register_academic_year_version(NULL,NULL,'Teste','2026-01-01','2026-12-31',true,'2020-01-01','', 'ato');
    RAISE EXCEPTION 'test:missing-capability-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', expired_claim, true);
  BEGIN PERFORM register_academic_year_version(NULL,NULL,'Teste','2026-01-01','2026-12-31',true,'2020-01-01','', 'ato');
    RAISE EXCEPTION 'test:expired-engagement-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', school_claim, true);
  BEGIN PERFORM register_academic_year_version(NULL,NULL,'Teste','2026-01-01','2026-12-31',true,'2020-01-01','', 'ato');
    RAISE EXCEPTION 'test:school-scope-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  report := report || E'autorização: sem capacidade, atuação vencida e alcance escola recusados\n';

  PERFORM set_config('request.jwt.claims', network_claim, true);
  BEGIN PERFORM register_academic_year_version(NULL,NULL,'Inválido','2026-12-31','2026-01-01',true,'2020-01-01','', 'ato');
    RAISE EXCEPTION 'test:inverted-year-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%invalid-dates%' THEN RAISE; END IF; END;
  year_id := register_academic_year_version(NULL,NULL,'Ano institucional','2026-01-01','2026-12-31',true,'2020-01-01','', 'ato-1');
  SELECT id, recorded_via_engagement_id INTO year_v1, actor FROM institutional_academic_year_versions
    WHERE academic_year_id=year_id AND version=1;
  IF year_id NOT LIKE 'ano-%' OR year_v1 IS NULL OR actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM institutional_academic_year_versions WHERE id=year_v1
      AND recorded_by='00000000-0000-0000-0000-00000000b241'
      AND recorded_by_person_id='00000000-0000-0000-0000-00000000b251'
      AND originating_act_ref='ato-1') THEN RAISE EXCEPTION 'year:identity-or-provenance'; END IF;
  PERFORM register_academic_year_version(year_id,year_v1,'Ano letivo oficial','2026-01-01','2026-12-31',true,'2021-01-01','correção','ato-2');
  IF (SELECT official_name FROM institutional_academic_year_versions WHERE id=year_v1) <> 'Ano institucional'
    OR (SELECT count(*) FROM institutional_academic_year_versions WHERE academic_year_id=year_id) <> 2
  THEN RAISE EXCEPTION 'year:version-history'; END IF;
  BEGIN PERFORM register_academic_year_version(year_id,year_v1,'Antigo','2026-01-01','2026-12-31',true,'2022-01-01','motivo','ato');
    RAISE EXCEPTION 'test:stale-year-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%base-superseded%' THEN RAISE; END IF; END;

  org_id := register_period_organization_version(NULL,year_id,NULL,'Organização oficial',true,'2020-01-01','','ato-3');
  other_org := register_period_organization_version(NULL,year_id,NULL,'Outra organização',true,'2020-01-01','','ato-4');
  BEGIN PERFORM register_academic_period_version(NULL,'org-inexistente',NULL,'Falha','2026-01-01','2026-02-01',true,'2020-01-01','','ato');
    RAISE EXCEPTION 'test:period-without-org-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%organization-not-found%' THEN RAISE; END IF; END;
  BEGIN PERFORM register_academic_period_version(NULL,org_id,NULL,'Falha','2026-12-31','2026-01-01',true,'2020-01-01','','ato');
    RAISE EXCEPTION 'test:inverted-period-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%invalid-dates%' THEN RAISE; END IF; END;
  BEGIN PERFORM register_academic_period_version(NULL,org_id,NULL,'Falha','2025-12-31','2026-02-01',true,'2020-01-01','','ato');
    RAISE EXCEPTION 'test:outside-year-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%outside-year%' THEN RAISE; END IF; END;

  test_period_id := register_academic_period_version(NULL,org_id,NULL,'Primeiro período','2026-01-01','2026-03-31',true,'2020-01-01','','ato-5');
  SELECT pv.id INTO period_v1 FROM institutional_academic_period_versions pv WHERE pv.period_id=test_period_id AND pv.version=1;
  IF test_period_id NOT LIKE 'per-%' OR period_v1 IS NULL OR NOT EXISTS (
    SELECT 1 FROM institutional_academic_periods p WHERE p.id=test_period_id AND p.academic_year_id=year_id AND p.period_organization_id=org_id)
    OR NOT EXISTS (SELECT 1 FROM institutional_academic_period_versions WHERE id=period_v1
      AND recorded_by_person_id='00000000-0000-0000-0000-00000000b251' AND recorded_via_engagement_id=actor)
  THEN RAISE EXCEPTION 'period:identity-or-provenance'; END IF;
  BEGIN PERFORM register_academic_period_version(NULL,org_id,NULL,'Sobreposto','2026-03-31','2026-06-30',true,'2020-01-01','','ato');
    RAISE EXCEPTION 'test:same-organization-overlap-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%overlap%' THEN RAISE; END IF; END;
  PERFORM register_academic_period_version(NULL,other_org,NULL,'Coexistente','2026-03-31','2026-06-30',true,'2020-01-01','','ato');
  PERFORM register_academic_period_version(test_period_id,org_id,period_v1,'Período corrigido','2026-01-01','2026-03-30',true,'2021-01-01','correção','ato-6');
  SELECT pv.id INTO period_v2 FROM institutional_academic_period_versions pv WHERE pv.period_id=test_period_id AND pv.version=2;
  IF (SELECT official_name FROM institutional_academic_period_versions WHERE id=period_v1) <> 'Primeiro período'
    OR period_v2 IS NULL THEN RAISE EXCEPTION 'period:history-not-preserved'; END IF;
  BEGIN PERFORM register_academic_period_version(test_period_id,org_id,period_v1,'Desatualizado','2026-01-01','2026-03-30',true,'2022-01-01','motivo','ato');
    RAISE EXCEPTION 'test:stale-period-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%base-superseded%' THEN RAISE; END IF; END;
  BEGIN UPDATE institutional_academic_period_versions SET official_name='Mutação' WHERE id=period_v1;
    RAISE EXCEPTION 'test:historic-mutation-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM = 'test:historic-mutation-accepted' THEN RAISE; END IF; END;
  BEGIN DELETE FROM institutional_academic_period_versions WHERE id=period_v1;
    RAISE EXCEPTION 'test:historic-deletion-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM = 'test:historic-deletion-accepted' THEN RAISE; END IF; END;
  SELECT count(*) INTO n FROM institutional_academic_period_versions pv WHERE pv.period_id=test_period_id;
  IF n<>2 THEN RAISE EXCEPTION 'period:version-count'; END IF;

  -- Intervalos inclusivos: [valid_from, proxima vigencia) para cada versão;
  -- [starts_on, ends_on] para as datas do período.
  temporal_org := register_period_organization_version(NULL,year_id,NULL,'Organização temporal',true,'2020-01-01','','ato-temporal');
  a_id := register_academic_period_version(NULL,temporal_org,NULL,'A','2026-01-01','2026-03-31',true,'2020-01-01','','ato-a1');
  b_id := register_academic_period_version(NULL,temporal_org,NULL,'B','2026-04-01','2026-06-30',true,'2020-01-01','','ato-b1');
  SELECT pv.id INTO a_v1 FROM institutional_academic_period_versions pv WHERE pv.period_id=a_id AND pv.version=1;
  SELECT pv.id INTO b_v1 FROM institutional_academic_period_versions pv WHERE pv.period_id=b_id AND pv.version=1;
  -- 1 e 8: dois períodos não sobrepostos; 31/03 e 01/04 são limites adjacentes.
  IF a_v1 IS NULL OR b_v1 IS NULL THEN RAISE EXCEPTION 'temporal:adjacent-periods'; END IF;
  -- 2: a mesma data de limite em ambos os períodos é conflito.
  BEGIN PERFORM register_academic_period_version(NULL,temporal_org,NULL,'Conflito','2026-03-31','2026-04-15',true,'2020-01-01','','ato-conflito');
    RAISE EXCEPTION 'test:contemporary-overlap-accepted';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%period:overlap%' THEN RAISE; END IF; END;
  -- 3: a organização delimita o conjunto; outra organização pode coincidir.
  PERFORM register_academic_period_version(NULL,other_org,NULL,'Paralelo','2026-01-01','2026-03-30',true,'2020-01-01','','ato-paralelo');
  -- 4: versão futura de A não invalida a versão atual de B.
  PERFORM register_academic_period_version(a_id,temporal_org,a_v1,'A futuro','2026-01-01','2026-02-28',true,'2027-01-01','correção futura','ato-a2');
  SELECT pv.id INTO a_v2 FROM institutional_academic_period_versions pv WHERE pv.period_id=a_id AND pv.version=2;
  IF a_v2 IS NULL THEN RAISE EXCEPTION 'temporal:future-a'; END IF;
  -- 5: A só encolhe em 2027; B iniciado em 2026 ainda colidiria com A vigente.
  BEGIN PERFORM register_academic_period_version(b_id,temporal_org,b_v1,'B prematuro','2026-03-01','2026-06-30',true,'2026-07-01','correção','ato-b-prematuro');
    RAISE EXCEPTION 'test:future-a-masked-current-overlap';
  EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%period:overlap%' THEN RAISE; END IF; END;
  -- 6: correções sucessivas, cada uma válida apenas a partir de seu próprio ato.
  PERFORM register_academic_period_version(b_id,temporal_org,b_v1,'B futuro','2026-03-01','2026-06-30',true,'2027-01-01','correção','ato-b2');
  SELECT pv.id INTO b_v2 FROM institutional_academic_period_versions pv WHERE pv.period_id=b_id AND pv.version=2;
  PERFORM register_academic_period_version(b_id,temporal_org,b_v2,'B novamente','2026-04-01','2026-06-30',true,'2028-01-01','nova correção','ato-b3');
  PERFORM register_academic_period_version(a_id,temporal_org,a_v2,'A novamente','2026-01-01','2026-03-15',true,'2029-01-01','nova correção','ato-a3');
  -- 7: consulta as-of prova que versões futuras não reescrevem o passado.
  IF (SELECT pv.starts_on FROM institutional_academic_period_versions pv WHERE pv.period_id=b_id AND pv.valid_from <= '2026-12-31' ORDER BY pv.version DESC LIMIT 1) <> '2026-04-01'
    OR (SELECT pv.ends_on FROM institutional_academic_period_versions pv WHERE pv.period_id=a_id AND pv.valid_from <= '2026-12-31' ORDER BY pv.version DESC LIMIT 1) <> '2026-03-31'
    OR (SELECT pv.starts_on FROM institutional_academic_period_versions pv WHERE pv.period_id=b_id AND pv.valid_from <= '2027-06-01' ORDER BY pv.version DESC LIMIT 1) <> '2026-03-01'
    OR (SELECT pv.ends_on FROM institutional_academic_period_versions pv WHERE pv.period_id=a_id AND pv.valid_from <= '2027-06-01' ORDER BY pv.version DESC LIMIT 1) <> '2026-02-28'
    OR (SELECT pv.starts_on FROM institutional_academic_period_versions pv WHERE pv.period_id=b_id AND pv.valid_from <= '2028-06-01' ORDER BY pv.version DESC LIMIT 1) <> '2026-04-01'
    OR (SELECT count(*) FROM institutional_academic_period_versions pv WHERE pv.period_id IN (a_id,b_id)) <> 6
  THEN RAISE EXCEPTION 'temporal:historic-query-or-version-chain'; END IF;
  report := report || E'sobreposição por vigência, organizações independentes, limites e histórico verificados\n';
  report := report || E'ano, organização, período, versão, referências e limites temporais verificados\n';
  RAISE EXCEPTION 'RELATORIO:%',report;
END $test$;
