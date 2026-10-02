-- Run after the B2.5.3 migration in the SAME transaction; caller issues ROLLBACK.
-- Assertions raise on failure. No migration history or official data is written.
CREATE TEMP TABLE b253_results (n integer PRIMARY KEY, scenario text NOT NULL, result text NOT NULL);
GRANT SELECT, INSERT ON b253_results TO authenticated;
DO $b253$
DECLARE
  school_claim text := '{"sub":"00000000-0000-0000-0000-00000000c561","role":"authenticated"}';
  other_claim text := '{"sub":"00000000-0000-0000-0000-00000000c562","role":"authenticated"}';
  test_policy_id uuid := '00000000-0000-0000-0000-00000000c571';
  test_class_id text; inactive_class_id text; base_id uuid; switch_id uuid; correction_id uuid;
  class_version_id uuid; known_before timestamptz; crossing_class_id text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id LIKE 'turma-b253-%')
    OR EXISTS (SELECT 1 FROM public.capability_policies p WHERE p.id = test_policy_id)
  THEN RAISE EXCEPTION 'b253:fixture-collision'; END IF;
  INSERT INTO public.institutional_persons(id,display_name) VALUES
    ('00000000-0000-0000-0000-00000000c551','Secretaria A'),
    ('00000000-0000-0000-0000-00000000c552','Secretaria B');
  INSERT INTO public.user_person_links(user_id,person_id) VALUES
    ('00000000-0000-0000-0000-00000000c561','00000000-0000-0000-0000-00000000c551'),
    ('00000000-0000-0000-0000-00000000c562','00000000-0000-0000-0000-00000000c552');
  INSERT INTO public.institutional_schools(id) VALUES ('esc-b253-a'),('esc-b253-b');
  INSERT INTO public.institutional_school_record_versions
    (school_id,version_number,official_name,active,valid_from,originating_act_ref)
  VALUES ('esc-b253-a',1,'Escola A',true,'2020-01-01','ato-a'),
         ('esc-b253-b',1,'Escola B',true,'2020-01-01','ato-b');
  INSERT INTO public.institutional_engagements
    (id,person_id,engagement_kind_id,scope_level,school_id,valid_from,valid_until)
  VALUES
    ('00000000-0000-0000-0000-00000000c581','00000000-0000-0000-0000-00000000c551',
     'secretaria-escolar','escola','esc-b253-a','2020-01-01',NULL),
    ('00000000-0000-0000-0000-00000000c582','00000000-0000-0000-0000-00000000c552',
     'secretaria-escolar','escola','esc-b253-b','2020-01-01',NULL);
  INSERT INTO public.institutional_academic_years(id) VALUES ('ano-b253-a'),('ano-b253-b');
  INSERT INTO public.institutional_academic_year_versions
    (academic_year_id,version,official_name,starts_on,ends_on,is_active,valid_from,
     originating_act_ref,recorded_by,recorded_by_person_id,recorded_via_engagement_id)
  VALUES
    ('ano-b253-a',1,'Ano A','2026-01-01','2026-12-31',true,'2020-01-01','ato-ano-a',
     '00000000-0000-0000-0000-00000000c561','00000000-0000-0000-0000-00000000c551','00000000-0000-0000-0000-00000000c581'),
    ('ano-b253-b',1,'Ano B','2026-01-01','2026-12-31',true,'2020-01-01','ato-ano-b',
     '00000000-0000-0000-0000-00000000c562','00000000-0000-0000-0000-00000000c552','00000000-0000-0000-0000-00000000c582');
  INSERT INTO public.institutional_period_organizations(id,academic_year_id) VALUES
    ('org-b253-a','ano-b253-a'),('org-b253-b','ano-b253-a'),
    ('org-b253-c','ano-b253-a'),('org-b253-other','ano-b253-b'),
    ('org-b253-inactive','ano-b253-a');
  INSERT INTO public.institutional_period_organization_versions
    (organization_id,version,official_name,is_active,valid_from,originating_act_ref,
     recorded_by,recorded_by_person_id,recorded_via_engagement_id)
  SELECT o.id,1,o.id,o.id <> 'org-b253-inactive','2020-01-01','ato-org',
    '00000000-0000-0000-0000-00000000c561','00000000-0000-0000-0000-00000000c551',
    '00000000-0000-0000-0000-00000000c581'
  FROM public.institutional_period_organizations o WHERE o.id LIKE 'org-b253-%';
  INSERT INTO public.institutional_academic_periods
    (id,academic_year_id,label,starts_on,ends_on,period_organization_id)
  VALUES ('period-b253-a','ano-b253-a','A 1','2026-01-01','2026-03-31','org-b253-a'),
         ('period-b253-a2','ano-b253-a','A 2','2026-04-01','2026-06-30','org-b253-a'),
         ('period-b253-b','ano-b253-a','B','2026-07-01','2026-12-31','org-b253-b'),
         ('period-b253-c','ano-b253-a','C','2026-04-01','2026-06-30','org-b253-c');
  INSERT INTO public.institutional_academic_period_versions
    (period_id,version,official_name,starts_on,ends_on,is_active,valid_from,
     originating_act_ref,recorded_by,recorded_by_person_id,recorded_via_engagement_id)
  VALUES
    ('period-b253-a',1,'A 1','2026-01-01','2026-03-31',true,'2020-01-01','ato-period-a',
     '00000000-0000-0000-0000-00000000c561','00000000-0000-0000-0000-00000000c551','00000000-0000-0000-0000-00000000c581'),
    ('period-b253-a2',1,'A 2','2026-04-01','2026-06-30',true,'2020-01-01','ato-period-a2',
     '00000000-0000-0000-0000-00000000c561','00000000-0000-0000-0000-00000000c551','00000000-0000-0000-0000-00000000c581'),
    ('period-b253-b',1,'B','2026-07-01','2026-12-31',true,'2020-01-01','ato-period-b',
     '00000000-0000-0000-0000-00000000c561','00000000-0000-0000-0000-00000000c551','00000000-0000-0000-0000-00000000c581'),
    ('period-b253-c',1,'C','2026-04-01','2026-06-30',true,'2020-01-01','ato-period-c',
     '00000000-0000-0000-0000-00000000c561','00000000-0000-0000-0000-00000000c551','00000000-0000-0000-0000-00000000c581');
  INSERT INTO public.capability_policies(id,logical_policy_id,version,status,valid_from)
    VALUES (test_policy_id,'teste-b253',1,'draft','2020-01-01');
  INSERT INTO public.capability_policy_rules
    (policy_id,engagement_kind_id,capability_id,scope_dimensions)
  VALUES
    (test_policy_id,'secretaria-escolar','manter-cadastro-de-turmas',ARRAY['school']::text[]),
    (test_policy_id,'secretaria-escolar','manter-organizacao-de-periodos-da-turma',ARRAY['school']::text[]);
  UPDATE public.capability_policies SET status='homologated' WHERE id=test_policy_id;

  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claims',school_claim,true);
  test_class_id := public.register_institutional_class('esc-b253-a','ano-b253-a','A','Turma A',
    'ativa','2026-01-01','2026-12-31','ato-class-a');
  IF EXISTS (SELECT 1 FROM public.class_period_organization_at(test_class_id,'2026-03-01',NULL))
  THEN RAISE EXCEPTION 'b253:absence'; END IF;
  INSERT INTO b253_results VALUES (1,'Ausência falha fechada','PASS');
  base_id := public.record_class_period_organization_version(test_class_id,NULL,'register',
    'org-b253-a','2026-01-01',NULL,'ato inicial','ato-link-a');
  IF (SELECT v.organization_id FROM public.class_period_organization_at(test_class_id,'2026-03-01',NULL) v) IS DISTINCT FROM 'org-b253-a'
  THEN RAISE EXCEPTION 'b253:first-association'; END IF;
  INSERT INTO b253_results VALUES (2,'Primeira associação A','PASS');
  BEGIN
    PERFORM public.record_class_period_organization_version(test_class_id,base_id,'switch',
      'org-b253-b','2026-06-15',NULL,'troca inválida','ato-cut');
    RAISE EXCEPTION 'b253:cut-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:boundary-cuts-official-period%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.institutional_class_period_organization_versions v WHERE v.class_id=test_class_id) <> 1
  THEN RAISE EXCEPTION 'b253:cut-left-residue'; END IF;
  INSERT INTO b253_results VALUES (3,'Troca no meio do período recusada sem resíduo','PASS');
  switch_id := public.record_class_period_organization_version(test_class_id,base_id,'switch',
    'org-b253-b','2026-07-01',NULL,'troca na fronteira','ato-switch');
  IF (SELECT v.organization_id FROM public.class_period_organization_at(test_class_id,'2026-06-30',NULL) v) IS DISTINCT FROM 'org-b253-a'
    OR (SELECT v.organization_id FROM public.class_period_organization_at(test_class_id,'2026-07-01',NULL) v) IS DISTINCT FROM 'org-b253-b'
  THEN RAISE EXCEPTION 'b253:switch-boundary'; END IF;
  INSERT INTO b253_results VALUES (4,'Troca A para B na fronteira e história de A','PASS');
  known_before := clock_timestamp();
  PERFORM pg_sleep(0.005);
  -- A cabeça atual de A é a versão fechada pela troca.
  SELECT v.id INTO base_id FROM public.institutional_class_period_organization_versions v
    WHERE v.class_id=test_class_id AND v.organization_id='org-b253-a' AND v.version=2;
  BEGIN
    PERFORM public.record_class_period_organization_version(test_class_id,base_id,'correct',
      'org-b253-c','2026-05-01','2026-05-31','retificação que corta A','ato-correct-cut');
    RAISE EXCEPTION 'b253:retro-cut-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:boundary-cuts-official-period%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.institutional_class_period_organization_versions v
      WHERE v.class_id=test_class_id) <> 3
    OR (SELECT v.organization_id FROM public.class_period_organization_at(test_class_id,'2026-05-15',known_before) v) IS DISTINCT FROM 'org-b253-a'
    OR (SELECT v.organization_id FROM public.class_period_organization_at(test_class_id,'2026-05-15',NULL) v) IS DISTINCT FROM 'org-b253-a'
    OR (SELECT v.id FROM public.class_period_organization_at(test_class_id,'2026-05-15',NULL) v) IS DISTINCT FROM base_id
    OR (SELECT v.organization_id FROM public.class_period_organization_at(test_class_id,'2026-07-15',NULL) v) IS DISTINCT FROM 'org-b253-b'
    OR (SELECT v.id FROM public.class_period_organization_at(test_class_id,'2026-07-15',NULL) v) IS DISTINCT FROM switch_id
  THEN RAISE EXCEPTION 'b253:retro-cut-left-residue-or-changed-reader'; END IF;
  INSERT INTO b253_results VALUES (5,'Retificação que corta A recusada; história e leitor intactos','PASS');
  BEGIN
    PERFORM public.record_class_period_organization_version(test_class_id,base_id,'correct',
      'org-b253-c','2026-04-01','2026-05-31','direita corta A','ato-correct-right-cut');
    RAISE EXCEPTION 'b253:right-cut-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:boundary-cuts-official-period%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.institutional_class_period_organization_versions v
      WHERE v.class_id=test_class_id) <> 3
    OR (SELECT v.organization_id FROM public.class_period_organization_at(test_class_id,'2026-05-15',NULL) v) IS DISTINCT FROM 'org-b253-a'
  THEN RAISE EXCEPTION 'b253:right-cut-residue'; END IF;
  INSERT INTO b253_results VALUES (22,'Peça direita com segunda fronteira inválida recusada','PASS');
  correction_id := public.record_class_period_organization_version(test_class_id,base_id,'correct',
    'org-b253-c','2026-04-01','2026-06-30','retificação na fronteira','ato-correct-valid');
  IF (SELECT v.organization_id FROM public.class_period_organization_at(test_class_id,'2026-05-15',known_before) v) IS DISTINCT FROM 'org-b253-a'
    OR (SELECT v.organization_id FROM public.class_period_organization_at(test_class_id,'2026-05-15',NULL) v) IS DISTINCT FROM 'org-b253-c'
    OR (SELECT v.organization_id FROM public.class_period_organization_at(test_class_id,'2026-03-15',NULL) v) IS DISTINCT FROM 'org-b253-a'
    OR (SELECT v.organization_id FROM public.class_period_organization_at(test_class_id,'2026-07-15',NULL) v) IS DISTINCT FROM 'org-b253-b'
  THEN RAISE EXCEPTION 'b253:valid-retro-correction'; END IF;
  INSERT INTO b253_results VALUES (23,'Retificação válida nas fronteiras e knownAt','PASS');
  BEGIN
    PERFORM public.record_class_period_organization_version(test_class_id,base_id,'correct',
      'org-b253-c','2026-06-01','2026-06-15','base substituída','ato-stale');
    RAISE EXCEPTION 'b253:stale-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:base-superseded%' THEN RAISE; END IF;
  END;
  INSERT INTO b253_results VALUES (6,'Base substituída recusada','PASS');
  BEGIN
    PERFORM public.record_class_period_organization_version(test_class_id,switch_id,'correct',
      'org-b253-other','2026-08-01','2026-08-31','outro ano','ato-wrong-year');
    RAISE EXCEPTION 'b253:other-year-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:organization-year-mismatch%' THEN RAISE; END IF;
  END;
  INSERT INTO b253_results VALUES (7,'Organização de outro ano recusada','PASS');
  BEGIN
    PERFORM public.record_class_period_organization_version(test_class_id,switch_id,'correct',
      'org-b253-inactive','2026-08-01','2026-08-31','inativa','ato-inactive');
    RAISE EXCEPTION 'b253:inactive-org-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:organization-inactive-or-unavailable%' THEN RAISE; END IF;
  END;
  INSERT INTO b253_results VALUES (8,'Organização inativa recusada','PASS');
  BEGIN
    PERFORM public.record_class_period_organization_version(test_class_id,switch_id,'correct',
      'org-b253-missing','2026-08-01','2026-08-31','inexistente','ato-missing');
    RAISE EXCEPTION 'b253:missing-org-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:organization-not-found%' THEN RAISE; END IF;
  END;
  INSERT INTO b253_results VALUES (9,'Organização inexistente recusada','PASS');
  BEGIN
    PERFORM public.record_class_period_organization_version('turma-b253-missing',NULL,'register',
      'org-b253-a','2026-01-01',NULL,'turma inexistente','ato-missing');
    RAISE EXCEPTION 'b253:missing-class-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:class-not-found%' THEN RAISE; END IF;
  END;
  INSERT INTO b253_results VALUES (10,'Turma inexistente recusada','PASS');
  PERFORM set_config('request.jwt.claims',other_claim,true);
  BEGIN
    PERFORM public.record_class_period_organization_version(test_class_id,switch_id,'correct',
      'org-b253-c','2026-08-01','2026-08-31','fora de escopo','ato-scope');
    RAISE EXCEPTION 'b253:wrong-school-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:school-capability-required%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims',school_claim,true);
  INSERT INTO b253_results VALUES (11,'Escola fora de alcance recusada','PASS');
  inactive_class_id := public.register_institutional_class('esc-b253-a','ano-b253-a','I','Turma inativa',
    'inativa','2026-01-01','2026-12-31','ato-inactive-class');
  BEGIN
    PERFORM public.record_class_period_organization_version(inactive_class_id,NULL,'register',
      'org-b253-a','2026-01-01',NULL,'turma inativa','ato-inactive-class-link');
    RAISE EXCEPTION 'b253:inactive-class-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:class-inactive-or-unavailable%' THEN RAISE; END IF;
  END;
  INSERT INTO b253_results VALUES (12,'Turma inativa recusada','PASS');
  -- Direct DML and TRUNCATE are refused even though the writer is SECURITY DEFINER.
  IF has_table_privilege('authenticated','public.institutional_class_period_organization_versions','INSERT')
    OR has_table_privilege('authenticated','public.institutional_class_period_organization_versions','TRUNCATE')
    OR has_table_privilege('service_role','public.institutional_class_period_organization_versions','INSERT')
    OR has_table_privilege('service_role','public.institutional_class_period_organization_versions','TRUNCATE')
  THEN RAISE EXCEPTION 'b253:direct-dml-grant'; END IF;
  INSERT INTO b253_results VALUES (13,'DML direto e TRUNCATE sem privilégio','PASS');
  IF (SELECT count(*) FROM public.institutional_class_period_organization_versions v WHERE v.class_id=test_class_id) <> 5
  THEN RAISE EXCEPTION 'b253:rejected-operation-residue'; END IF;
  INSERT INTO b253_results VALUES (14,'Recusas sem resíduos','PASS');

  -- A class that becomes inactive in July cannot receive a January-December link.
  crossing_class_id := public.register_institutional_class('esc-b253-a','ano-b253-a','C','Turma futura inativa',
    'ativa','2026-01-01','2026-12-31','ato-crossing-class');
  SELECT v.id INTO class_version_id FROM public.institutional_class_record_versions v
    WHERE v.class_id = crossing_class_id AND v.version = 1;
  PERFORM public.record_institutional_class_version(crossing_class_id,class_version_id,'inactivate',
    NULL,NULL,NULL,'2026-07-01',NULL,'inativação futura','ato-crossing-inactive');
  BEGIN
    PERFORM public.record_class_period_organization_version(crossing_class_id,NULL,'register',
      'org-b253-a','2026-01-01','2026-12-31','atravessa inatividade','ato-crossing-link');
    RAISE EXCEPTION 'b253:class-crossing-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:class-inactive-or-unavailable%' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.institutional_class_period_organization_versions v WHERE v.class_id=crossing_class_id)
  THEN RAISE EXCEPTION 'b253:class-crossing-residue'; END IF;
  INSERT INTO b253_results VALUES (15,'Vínculo atravessando inatividade conhecida da turma recusado','PASS');

  -- Privileged fixture of a later organization version; frozen B2.4 writer is untouched.
  PERFORM set_config('role','none',true);
  INSERT INTO public.institutional_period_organization_versions
    (organization_id,version,supersedes_id,official_name,is_active,valid_from,change_reason,
     originating_act_ref,recorded_by,recorded_by_person_id,recorded_via_engagement_id)
  SELECT 'org-b253-c',2,v.id,'Organização C inativa',false,'2026-09-01','inativação futura',
    'ato-org-c-inactive','00000000-0000-0000-0000-00000000c561',
    '00000000-0000-0000-0000-00000000c551','00000000-0000-0000-0000-00000000c581'
  FROM public.institutional_period_organization_versions v
  WHERE v.organization_id='org-b253-c' AND v.version=1;
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claims',school_claim,true);
  BEGIN
    PERFORM public.record_class_period_organization_version(test_class_id,switch_id,'correct',
      'org-b253-c','2026-08-01','2026-10-01','atravessa inatividade','ato-org-crossing');
    RAISE EXCEPTION 'b253:org-crossing-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:organization-inactive-or-unavailable%' THEN RAISE; END IF;
  END;
  INSERT INTO b253_results VALUES (16,'Vínculo atravessando inatividade conhecida da organização recusado','PASS');

  -- No application role can bypass the writer, including via TRUNCATE.
  IF has_table_privilege('anon','public.institutional_class_period_organization_versions','INSERT,UPDATE,DELETE,TRUNCATE')
    OR has_table_privilege('authenticated','public.institutional_class_period_organization_versions','INSERT,UPDATE,DELETE,TRUNCATE')
    OR has_table_privilege('service_role','public.institutional_class_period_organization_versions','INSERT,UPDATE,DELETE,TRUNCATE')
    OR (EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sandbox_exec')
      AND has_table_privilege('sandbox_exec','public.institutional_class_period_organization_versions','INSERT,UPDATE,DELETE,TRUNCATE'))
  THEN RAISE EXCEPTION 'b253:role-has-direct-dml'; END IF;
  IF has_function_privilege('authenticated','public.class_period_link_context(text,text,date,date)','EXECUTE')
    OR has_function_privilege('authenticated','public.class_period_link_boundary(text,text,date)','EXECUTE')
  THEN RAISE EXCEPTION 'b253:internal-helper-exposed'; END IF;
  INSERT INTO b253_results VALUES (17,'ACL de anon/authenticated/service_role/sandbox_exec e helpers','PASS');
  BEGIN
    INSERT INTO public.institutional_class_period_organization_versions
      (class_id,segment_id,version,organization_id,valid_from,change_reason,originating_act_ref,
       recorded_by,recorded_by_person_id,recorded_via_engagement_id,authorizing_policy_id)
    VALUES (test_class_id,gen_random_uuid(),99,'org-b253-a','2026-11-01','DML direto','ato-direct',
      '00000000-0000-0000-0000-00000000c561','00000000-0000-0000-0000-00000000c551',
      '00000000-0000-0000-0000-00000000c581',test_policy_id);
    RAISE EXCEPTION 'b253:direct-insert-accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.institutional_class_period_organization_versions v SET change_reason='mutação'
    WHERE v.class_id=test_class_id;
    RAISE EXCEPTION 'b253:direct-update-accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.institutional_class_period_organization_versions v WHERE v.class_id=test_class_id;
    RAISE EXCEPTION 'b253:direct-delete-accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    TRUNCATE public.institutional_class_period_organization_versions;
    RAISE EXCEPTION 'b253:direct-truncate-accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO b253_results VALUES (18,'INSERT UPDATE DELETE TRUNCATE diretos recusados','PASS');

  -- A privileged insert cannot create an overlapping current root.
  PERFORM set_config('role','none',true);
  BEGIN
    INSERT INTO public.institutional_class_period_organization_versions
      (class_id,segment_id,version,organization_id,valid_from,valid_until,change_reason,
       originating_act_ref,recorded_by,recorded_by_person_id,recorded_via_engagement_id,authorizing_policy_id)
    VALUES (test_class_id,gen_random_uuid(),99,'org-b253-a','2026-05-15','2026-05-20',
      'tentativa privilegiada','ato-overlap',
      '00000000-0000-0000-0000-00000000c561','00000000-0000-0000-0000-00000000c551',
      '00000000-0000-0000-0000-00000000c581',test_policy_id);
    SET CONSTRAINTS class_period_link_no_overlap IMMEDIATE;
    RAISE EXCEPTION 'b253:privileged-overlap-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:overlapping-current-segments%' THEN RAISE; END IF;
  END;
  SET CONSTRAINTS class_period_link_no_overlap DEFERRED;
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claims',school_claim,true);
  IF (SELECT count(*) FROM public.institutional_class_period_organization_versions v WHERE v.class_id=test_class_id) <> 5
  THEN RAISE EXCEPTION 'b253:privileged-overlap-residue'; END IF;
  INSERT INTO b253_results VALUES (19,'Ambiguidade privilegiada bloqueada sem resíduo','PASS');

  -- No active grant for an unrelated/expired identity, even in the same school.
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000c599","role":"authenticated"}',true);
  BEGIN
    PERFORM public.record_class_period_organization_version(test_class_id,switch_id,'correct',
      'org-b253-c','2026-08-01','2026-08-31','sem capacidade','ato-no-capability');
    RAISE EXCEPTION 'b253:no-capability-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class-period:school-capability-required%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims',school_claim,true);
  INSERT INTO b253_results VALUES (20,'Capacidade ausente recusada','PASS');
  IF (SELECT count(*) FROM public.institutional_class_period_organization_versions v WHERE v.class_id=test_class_id) <> 5
  THEN RAISE EXCEPTION 'b253:final-residue'; END IF;
  INSERT INTO b253_results VALUES (21,'Todas as recusas atômicas; A e B preservadas','PASS');
END $b253$;
SELECT n, scenario, result FROM b253_results ORDER BY n;
