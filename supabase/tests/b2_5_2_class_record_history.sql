-- B2.5.2: executar após a migration, numa conexão SQL que aceite transações.
-- O teste inteiro, incluindo política e identidades sintéticas, termina em ROLLBACK.
-- knownAt=T escolhe somente versões registradas até T; em cada segmento, a
-- cabeça conhecida é a versão sem sucessor também conhecido até T. Só então
-- se testa a vigência inclusiva para validOn. Duas cabeças aplicáveis são erro.
BEGIN;
CREATE TEMP TABLE b252_results (n integer PRIMARY KEY, scenario text NOT NULL, result text NOT NULL);
GRANT SELECT, INSERT ON b252_results TO authenticated;
DO $b252$
DECLARE
  school_claim text := '{"sub":"00000000-0000-0000-0000-00000000b561","role":"authenticated"}';
  other_claim text := '{"sub":"00000000-0000-0000-0000-00000000b562","role":"authenticated"}';
  expired_claim text := '{"sub":"00000000-0000-0000-0000-00000000b563","role":"authenticated"}';
  network_claim text := '{"sub":"00000000-0000-0000-0000-00000000b564","role":"authenticated"}';
  test_policy_id uuid := '00000000-0000-0000-0000-00000000b571';
  test_class_id text; initial_id uuid; march_id uuid; march2_id uuid;
  april_id uuid; future_id uuid; feb_inactive_id uuid; feb_active_id uuid;
  previous_id uuid; t1 timestamptz; t2 timestamptz; t3 timestamptz;
  actor_id uuid; rec public.institutional_class_record_versions%ROWTYPE;
BEGIN
  IF (SELECT count(*) FROM public.capability_policies p WHERE p.logical_policy_id='politica-capacidades-diario') <> 3
    OR (SELECT count(*) FROM public.capability_policies p WHERE p.logical_policy_id='politica-capacidades-diario' AND p.status='draft') <> 2
    OR (SELECT count(*) FROM public.capability_policy_rules r JOIN public.capability_policies p ON p.id=r.policy_id
        WHERE p.logical_policy_id='politica-capacidades-diario' AND p.version=1) <> 108
    OR (SELECT count(*) FROM public.capability_policy_rules r JOIN public.capability_policies p ON p.id=r.policy_id
        WHERE p.logical_policy_id='politica-capacidades-diario' AND p.version=2) <> 121
    OR (SELECT count(*) FROM public.capability_policy_rules r JOIN public.capability_policies p ON p.id=r.policy_id
        WHERE p.logical_policy_id='politica-capacidades-diario' AND p.version=3 AND p.status='homologated') <> 199
  THEN RAISE EXCEPTION 'b252:unexpected-policy-state'; END IF;
  IF EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id LIKE 'turma-b252-%')
    OR EXISTS (SELECT 1 FROM public.capability_policies p WHERE p.id=test_policy_id)
  THEN RAISE EXCEPTION 'b252:fixture-collision'; END IF;

  INSERT INTO public.institutional_persons(id,display_name) VALUES
    ('00000000-0000-0000-0000-00000000b551','Secretaria A'),
    ('00000000-0000-0000-0000-00000000b552','Secretaria B'),
    ('00000000-0000-0000-0000-00000000b553','Secretaria vencida'),
    ('00000000-0000-0000-0000-00000000b554','Atuação rede');
  INSERT INTO public.user_person_links(user_id,person_id) VALUES
    ('00000000-0000-0000-0000-00000000b561','00000000-0000-0000-0000-00000000b551'),
    ('00000000-0000-0000-0000-00000000b562','00000000-0000-0000-0000-00000000b552'),
    ('00000000-0000-0000-0000-00000000b563','00000000-0000-0000-0000-00000000b553'),
    ('00000000-0000-0000-0000-00000000b564','00000000-0000-0000-0000-00000000b554');
  INSERT INTO public.institutional_schools(id) VALUES ('esc-b252-a'),('esc-b252-b');
  INSERT INTO public.institutional_school_record_versions
    (school_id,version_number,official_name,active,valid_from,originating_act_ref)
  VALUES ('esc-b252-a',1,'Escola A',true,'2020-01-01','ato-escola-a'),
         ('esc-b252-b',1,'Escola B',true,'2020-01-01','ato-escola-b');
  INSERT INTO public.institutional_academic_years(id) VALUES ('ano-b252-a'),('ano-b252-b');
  INSERT INTO public.institutional_engagements
    (id,person_id,engagement_kind_id,scope_level,school_id,valid_from,valid_until)
  VALUES
    ('00000000-0000-0000-0000-00000000b581','00000000-0000-0000-0000-00000000b551',
     'secretaria-escolar','escola','esc-b252-a','2020-01-01',NULL),
    ('00000000-0000-0000-0000-00000000b582','00000000-0000-0000-0000-00000000b552',
     'secretaria-escolar','escola','esc-b252-b','2020-01-01',NULL),
    ('00000000-0000-0000-0000-00000000b583','00000000-0000-0000-0000-00000000b553',
     'secretaria-escolar','escola','esc-b252-a','2020-01-01','2021-01-01'),
    ('00000000-0000-0000-0000-00000000b584','00000000-0000-0000-0000-00000000b554',
     'secretaria-escolar','rede',NULL,'2020-01-01',NULL);
  INSERT INTO public.institutional_academic_year_versions
    (academic_year_id,version,official_name,starts_on,ends_on,is_active,valid_from,
     originating_act_ref,recorded_by,recorded_by_person_id,recorded_via_engagement_id)
  VALUES
    ('ano-b252-a',1,'Ano A','2026-01-01','2026-12-31',true,'2020-01-01',
     'ato-ano-a','00000000-0000-0000-0000-00000000b561',
     '00000000-0000-0000-0000-00000000b551',
     '00000000-0000-0000-0000-00000000b581'),
    ('ano-b252-b',1,'Ano B','2026-01-01','2026-12-31',true,'2020-01-01',
     'ato-ano-b','00000000-0000-0000-0000-00000000b562',
     '00000000-0000-0000-0000-00000000b552',
     '00000000-0000-0000-0000-00000000b582');

  -- 20. A política real em draft não confere escrita.
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claims',school_claim,true);
  BEGIN
    PERFORM public.register_institutional_class('esc-b252-a','ano-b252-a','A','Turma A',
      'ativa','2026-01-01','2026-12-31','ato-inicial');
    RAISE EXCEPTION 'b252:draft-was-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:school-capability-required%' THEN RAISE; END IF;
  END;
  PERFORM set_config('role','none',true);
  INSERT INTO public.capability_policies(id,logical_policy_id,version,status,valid_from)
    VALUES (test_policy_id,'teste-b252',1,'draft','2020-01-01');
  INSERT INTO public.capability_policy_rules
    (policy_id,engagement_kind_id,capability_id,scope_dimensions)
    VALUES (test_policy_id,'secretaria-escolar','manter-cadastro-de-turmas',ARRAY['school']::text[]);
  UPDATE public.capability_policies SET status='homologated' WHERE id=test_policy_id;
  INSERT INTO b252_results VALUES (20,'Política real draft sem grant','PASS');

  -- 1. Criação é atômica e usa a escola/ano oficiais.
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claims',school_claim,true);
  test_class_id := public.register_institutional_class('esc-b252-a','ano-b252-a','A','Turma A',
    'ativa','2026-01-01','2026-12-31','ato-inicial');
  SELECT v.id,v.created_at INTO initial_id,t1
    FROM public.institutional_class_record_versions v WHERE v.class_id=test_class_id AND v.version=1;
  IF test_class_id NOT LIKE 'turma-%' OR initial_id IS NULL
    OR (SELECT count(*) FROM public.institutional_classes c WHERE c.id=test_class_id
        AND c.school_id='esc-b252-a' AND c.academic_year_id='ano-b252-a'
        AND c.school_label_snapshot='Escola A' AND c.academic_year_label='Ano A') <> 1
    OR (SELECT count(*) FROM public.institutional_class_record_versions v WHERE v.class_id=test_class_id) <> 1
  THEN RAISE EXCEPTION 'b252:create-not-atomic'; END IF;
  INSERT INTO b252_results VALUES (1,'Criação atômica e fonte oficial','PASS');
  IF (SELECT v.name FROM public.class_at(test_class_id,'2026-01-01',NULL) v) <> 'Turma A'
    OR EXISTS (SELECT 1 FROM public.class_at(test_class_id,'2025-12-31',NULL))
    OR EXISTS (SELECT 1 FROM public.class_at(test_class_id,'2027-01-01',NULL))
  THEN RAISE EXCEPTION 'b252:current-query'; END IF;
  INSERT INTO b252_results VALUES (5,'Consulta vigente e ausência fora da vigência','PASS');

  -- 2 e 7. Correção retroativa parcial, sem editar a versão anterior.
  PERFORM pg_sleep(0.02);
  march_id := public.record_institutional_class_version(test_class_id,initial_id,'correct',
    'A2','Turma corrigida','ativa','2026-03-01','2026-03-31','retificação','ato-correcao-1');
  SELECT v.created_at INTO t2 FROM public.institutional_class_record_versions v WHERE v.id=march_id;
  SELECT v.id INTO april_id FROM public.institutional_class_record_versions v
    WHERE v.class_id=test_class_id AND v.valid_from='2026-04-01' AND v.supersedes_id IS NULL;
  IF t2 <= t1 OR april_id IS NULL
    OR (SELECT v.name FROM public.institutional_class_record_versions v WHERE v.id=initial_id) <> 'Turma A'
    OR (SELECT c.name FROM public.institutional_classes c WHERE c.id=test_class_id) <> 'Turma A'
    OR (SELECT c.code FROM public.institutional_classes c WHERE c.id=test_class_id) <> 'A'
    OR (SELECT count(*) FROM public.institutional_class_record_versions v WHERE v.class_id=test_class_id) <> 4
    OR (SELECT v.name FROM public.class_at(test_class_id,'2026-03-15',NULL) v) <> 'Turma corrigida'
  THEN RAISE EXCEPTION 'b252:correction-or-split'; END IF;
  INSERT INTO b252_results VALUES (2,'Correção append-only e divisão','PASS');
  IF (SELECT v.name FROM public.class_at(test_class_id,'2026-03-15',t1) v) <> 'Turma A'
    OR (SELECT v.name FROM public.class_at(test_class_id,'2026-03-15',t2) v) <> 'Turma corrigida'
  THEN RAISE EXCEPTION 'b252:retroactive-as-known'; END IF;
  INSERT INTO b252_results VALUES (7,'Correção retroativa preserva knownAt anterior','PASS');
  INSERT INTO b252_results VALUES (6,'Consulta histórica por knownAt','PASS');

  -- Matriz T1/T2/T3: mais uma correção registrada não reescreve as respostas anteriores.
  PERFORM pg_sleep(0.02);
  march2_id := public.record_institutional_class_version(test_class_id,march_id,'correct',
    'A3','Turma corrigida 2','ativa','2026-03-10','2026-03-20','nova retificação','ato-correcao-2');
  SELECT v.created_at INTO t3 FROM public.institutional_class_record_versions v WHERE v.id=march2_id;
  IF t3 <= t2 OR
    (SELECT v.name FROM public.class_at(test_class_id,'2026-03-15',t1) v) <> 'Turma A' OR
    (SELECT v.name FROM public.class_at(test_class_id,'2026-03-15',t2) v) <> 'Turma corrigida' OR
    (SELECT v.name FROM public.class_at(test_class_id,'2026-03-15',t3) v) <> 'Turma corrigida 2'
  THEN RAISE EXCEPTION 'b252:bitemporal-matrix'; END IF;
  INSERT INTO b252_results VALUES (19,'Matriz bitemporal T1/T2/T3','PASS');

  -- 8. Uma versão futura não oculta a vigente em 2026.
  future_id := public.record_institutional_class_version(test_class_id,april_id,'correct',
    'AF','Turma futura','ativa','2026-10-01','2026-12-31','programação futura','ato-futuro');
  IF (SELECT v.name FROM public.class_at(test_class_id,'2026-08-01',NULL) v) <> 'Turma A'
    OR (SELECT v.name FROM public.class_at(test_class_id,'2026-10-01',NULL) v) <> 'Turma futura'
  THEN RAISE EXCEPTION 'b252:future-masked-current'; END IF;
  INSERT INTO b252_results VALUES (8,'Versão futura sem mascarar a atual','PASS');

  -- 3 e 4. Estados são versões; término da faixa não significa inatividade.
  SELECT v.id INTO previous_id FROM public.institutional_class_record_versions v
    WHERE v.class_id=test_class_id AND v.valid_from='2026-01-01'
      AND NOT EXISTS (SELECT 1 FROM public.institutional_class_record_versions x WHERE x.supersedes_id=v.id);
  feb_inactive_id := public.record_institutional_class_version(test_class_id,previous_id,'inactivate',
    NULL,NULL,NULL,'2026-02-01',NULL,'inativação','ato-inativacao');
  IF (SELECT v.administrative_status FROM public.class_at(test_class_id,'2026-02-01',NULL) v) <> 'inativa'
    OR (SELECT v.administrative_status FROM public.class_at(test_class_id,'2026-01-31',NULL) v) <> 'ativa'
  THEN RAISE EXCEPTION 'b252:inactivation'; END IF;
  INSERT INTO b252_results VALUES (3,'Inativação versionada','PASS');
  feb_active_id := public.record_institutional_class_version(test_class_id,feb_inactive_id,'reactivate',
    NULL,NULL,NULL,'2026-02-15',NULL,'reativação','ato-reativacao');
  IF (SELECT v.administrative_status FROM public.class_at(test_class_id,'2026-02-14',NULL) v) <> 'inativa'
    OR (SELECT v.administrative_status FROM public.class_at(test_class_id,'2026-02-15',NULL) v) <> 'ativa'
  THEN RAISE EXCEPTION 'b252:reactivation'; END IF;
  INSERT INTO b252_results VALUES (4,'Reativação versionada','PASS');
  INSERT INTO b252_results VALUES (18,'Fronteiras inclusivas D e D+1','PASS');

  -- 14. Versão substituída jamais serve de base novamente.
  BEGIN
    PERFORM public.record_institutional_class_version(test_class_id,initial_id,'correct',
      'X','Base velha','ativa','2026-01-01',NULL,'erro','ato');
    RAISE EXCEPTION 'b252:stale-base-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:base-superseded%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_results VALUES (14,'Base já substituída recusada','PASS');

  -- 15 e 16. Conflitos com faixa contemporânea e futura são recusados.
  BEGIN
    PERFORM public.record_institutional_class_version(test_class_id,march2_id,'correct',
      'X','Conflito março','ativa','2026-03-19','2026-03-25','conflito','ato');
    RAISE EXCEPTION 'b252:current-overlap-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:overlapping-current-segments%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_results VALUES (15,'Sobreposição contemporânea recusada','PASS');
  BEGIN
    PERFORM public.record_institutional_class_version(test_class_id,future_id,'correct',
      'X','Conflito futuro','ativa','2026-09-15','2026-12-31','conflito','ato');
    RAISE EXCEPTION 'b252:future-overlap-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:overlapping-current-segments%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_results VALUES (16,'Sobreposição futura recusada','PASS');
  IF (SELECT v.name FROM public.class_at(test_class_id,'2026-03-09',NULL) v) <> 'Turma corrigida'
    OR (SELECT v.name FROM public.class_at(test_class_id,'2026-03-10',NULL) v) <> 'Turma corrigida 2'
    OR (SELECT v.name FROM public.class_at(test_class_id,'2026-03-20',NULL) v) <> 'Turma corrigida 2'
    OR (SELECT v.name FROM public.class_at(test_class_id,'2026-03-21',NULL) v) <> 'Turma corrigida'
  THEN RAISE EXCEPTION 'b252:exact-boundary'; END IF;

  -- 11–13. O escritor deriva a escola da identidade, não do pedido.
  PERFORM set_config('request.jwt.claims',other_claim,true);
  BEGIN
    PERFORM public.record_institutional_class_version(test_class_id,feb_active_id,'correct',
      'B','Outra escola','ativa','2026-02-15','2026-02-28','tentativa','ato');
    RAISE EXCEPTION 'b252:other-school-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:school-capability-required%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_results VALUES (11,'Secretaria de outra escola recusada','PASS');
  PERFORM set_config('request.jwt.claims',expired_claim,true);
  BEGIN
    PERFORM public.record_institutional_class_version(test_class_id,feb_active_id,'correct',
      'X','Atuação vencida','ativa','2026-02-15','2026-02-28','tentativa','ato');
    RAISE EXCEPTION 'b252:expired-engagement-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:school-capability-required%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_results VALUES (12,'Atuação vencida recusada','PASS');
  PERFORM set_config('request.jwt.claims',network_claim,true);
  BEGIN
    PERFORM public.record_institutional_class_version(test_class_id,feb_active_id,'correct',
      'X','Alcance rede','ativa','2026-02-15','2026-02-28','tentativa','ato');
    RAISE EXCEPTION 'b252:wrong-scope-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:school-capability-required%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_results VALUES (13,'Alcance incorreto recusado','PASS');

  PERFORM set_config('request.jwt.claims',school_claim,true);
  SELECT v.* INTO rec FROM public.institutional_class_record_versions v WHERE v.id=march2_id;
  IF rec.recorded_by <> '00000000-0000-0000-0000-00000000b561'
    OR rec.recorded_by_person_id <> '00000000-0000-0000-0000-00000000b551'
    OR rec.recorded_via_engagement_id <> '00000000-0000-0000-0000-00000000b581'
    OR rec.authorizing_policy_id <> test_policy_id OR rec.change_reason <> 'nova retificação'
    OR rec.originating_act_ref <> 'ato-correcao-2'
  THEN RAISE EXCEPTION 'b252:provenance'; END IF;
  INSERT INTO b252_results VALUES (17,'Proveniência e classId preservados','PASS');

  -- 9, 10 e impossibilidade de DML direto são restrições de banco.
  PERFORM set_config('role','none',true);
  BEGIN
    UPDATE public.institutional_classes c SET school_id='esc-b252-b' WHERE c.id=test_class_id;
    RAISE EXCEPTION 'b252:school-mutation-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Fato oficial é imutável%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_results VALUES (9,'Mudança da escola estrutural recusada','PASS');
  BEGIN
    UPDATE public.institutional_classes c SET academic_year_id='ano-b252-b' WHERE c.id=test_class_id;
    RAISE EXCEPTION 'b252:year-mutation-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Fato oficial é imutável%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_results VALUES (10,'Mudança do ano estrutural recusada','PASS');
  BEGIN
    UPDATE public.institutional_class_record_versions v SET name='Mutação' WHERE v.id=initial_id;
    RAISE EXCEPTION 'b252:version-update-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Fato oficial é imutável%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.institutional_class_record_versions v WHERE v.id=initial_id;
    RAISE EXCEPTION 'b252:version-delete-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Fato oficial é imutável%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_results VALUES (21,'UPDATE/DELETE históricos recusados','PASS');
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claims',school_claim,true);
  BEGIN
    INSERT INTO public.institutional_class_record_versions
      (class_id,segment_id,version,name,administrative_status,valid_from,
       originating_act_ref,recorded_by,recorded_by_person_id,recorded_via_engagement_id,authorizing_policy_id)
    VALUES (test_class_id,gen_random_uuid(),999,'Escrita direta','ativa','2026-01-01','ato',
            '00000000-0000-0000-0000-00000000b561',
            '00000000-0000-0000-0000-00000000b551',
            '00000000-0000-0000-0000-00000000b581',test_policy_id);
    RAISE EXCEPTION 'b252:direct-insert-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' THEN RAISE; END IF;
  END;
  INSERT INTO b252_results VALUES (22,'INSERT direto do cliente recusado','PASS');
  BEGIN
    INSERT INTO public.institutional_classes
      (id,school_id,school_label_snapshot,academic_year_id,academic_year_label,name,valid_from)
    VALUES ('turma-b252-direta','esc-b252-a','Escola A','ano-b252-a','Ano A','Direta','2026-01-01');
    RAISE EXCEPTION 'b252:direct-identity-insert-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' THEN RAISE; END IF;
  END;
  INSERT INTO b252_results VALUES (24,'INSERT direto da identidade recusado','PASS');

  -- O lock por classId e a base única estão presentes. A prova de bloqueio
  -- simultâneo requer duas conexões e não é inferida deste teste sequencial.
  IF position('pg_advisory_xact_lock' in
      pg_get_functiondef('public.record_institutional_class_version(text,uuid,text,text,text,text,date,date,text,text)'::regprocedure)) = 0
  THEN RAISE EXCEPTION 'b252:missing-class-lock'; END IF;
  INSERT INTO b252_results VALUES (23,'Contrato de lock por classId e base otimista','PASS');
  PERFORM set_config('role','none',true);
  IF (SELECT count(*) FROM public.institutional_class_period_organization_versions) <> 0
    OR (SELECT count(*) FROM public.capability_policies p WHERE p.logical_policy_id='politica-capacidades-diario' AND p.status='draft') <> 2
  THEN RAISE EXCEPTION 'b252:scope-or-policy-changed'; END IF;
END $b252$;
SELECT n,scenario,result FROM b252_results ORDER BY n;
ROLLBACK;
