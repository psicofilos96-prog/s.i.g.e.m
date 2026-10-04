-- B2.5.2: contexto oficial e validação segmentada do ano letivo.
-- Executar após a migration, exclusivamente em transação revertida.
BEGIN;
CREATE TEMP TABLE b252_context_results (
  n integer PRIMARY KEY, scenario text NOT NULL, result text NOT NULL
);
GRANT SELECT, INSERT ON b252_context_results TO authenticated;

DO $context_test$
DECLARE
  school_claim text := '{"sub":"00000000-0000-0000-0000-00000000c561","role":"authenticated"}';
  operational_policy_id uuid;
  seed record;
  created_count integer := 0;
  open_class text;
  context_class text;
  context_base uuid;
  short_class text;
  short_base uuid;
BEGIN
  SELECT p.id INTO operational_policy_id
  FROM public.capability_policies p
  WHERE p.logical_policy_id='politica-capacidades-diario' AND p.version=3 AND p.status='homologated';
  IF operational_policy_id IS NULL OR EXISTS (SELECT 1 FROM public.institutional_classes)
  THEN RAISE EXCEPTION 'b252-context:fixture-collision-or-no-operational-policy'; END IF;
  IF pg_catalog.has_function_privilege(
    'authenticated', 'public.class_record_context(text,text,date,date)', 'EXECUTE')
  THEN RAISE EXCEPTION 'b252-context:internal-validator-exposed'; END IF;

  INSERT INTO public.institutional_persons(id,display_name)
  VALUES ('00000000-0000-0000-0000-00000000c551','Secretaria contextual');
  INSERT INTO public.user_person_links(user_id,person_id)
  VALUES ('00000000-0000-0000-0000-00000000c561','00000000-0000-0000-0000-00000000c551');
  INSERT INTO public.institutional_schools(id)
  VALUES ('esc-b252-context-active'),('esc-b252-context-inactive');
  INSERT INTO public.institutional_school_record_versions
    (school_id,version_number,official_name,active,valid_from,originating_act_ref)
  VALUES
    ('esc-b252-context-active',1,'Escola ativa',true,'2020-01-01','ato-escola'),
    ('esc-b252-context-inactive',1,'Escola antes ativa',true,'2020-01-01','ato-escola'),
    ('esc-b252-context-inactive',2,'Escola inativa',false,'2026-06-01','ato-inativacao');
  INSERT INTO public.institutional_engagements
    (id,person_id,engagement_kind_id,scope_level,school_id,valid_from)
  VALUES
    ('00000000-0000-0000-0000-00000000c581','00000000-0000-0000-0000-00000000c551',
     'secretaria-escolar','escola','esc-b252-context-active','2020-01-01'),
    ('00000000-0000-0000-0000-00000000c582','00000000-0000-0000-0000-00000000c551',
     'secretaria-escolar','escola','esc-b252-context-inactive','2020-01-01');
  INSERT INTO public.institutional_academic_years(id) VALUES
    ('ano-b252-single'),('ano-b252-compatible'),('ano-b252-short'),
    ('ano-b252-shifted'),('ano-b252-multi'),('ano-b252-middle-bad'),
    ('ano-b252-middle-inactive'),('ano-b252-inactive'),
    ('ano-b252-left-bad');

  -- Mesma interpretação canônica de B2.4: maior versão com valid_from <= D.
  -- As versões são inseridas em ordem para preservar a FK de supersedes_id.
  FOR seed IN
    SELECT v.year_id, v.version_no, v.starts_on, v.ends_on, v.active, v.valid_on
    FROM (VALUES
      ('ano-b252-single',1,'2026-01-01'::date,'2026-12-31'::date,true,'2020-01-01'::date),
      ('ano-b252-compatible',1,'2026-01-01','2026-12-31',true,'2020-01-01'),
      ('ano-b252-compatible',2,'2026-02-01','2026-12-31',true,'2026-07-01'),
      ('ano-b252-short',1,'2026-01-01','2026-12-31',true,'2020-01-01'),
      ('ano-b252-short',2,'2026-01-01','2026-11-30',true,'2026-07-01'),
      ('ano-b252-shifted',1,'2026-01-01','2026-12-31',true,'2020-01-01'),
      ('ano-b252-shifted',2,'2026-02-01','2026-12-31',true,'2026-07-01'),
      ('ano-b252-multi',1,'2026-01-01','2026-12-31',true,'2020-01-01'),
      ('ano-b252-multi',2,'2026-03-01','2026-12-31',true,'2026-04-01'),
      ('ano-b252-multi',3,'2026-03-01','2026-11-30',true,'2026-08-01'),
      ('ano-b252-middle-bad',1,'2026-01-01','2026-12-31',true,'2020-01-01'),
      ('ano-b252-middle-bad',2,'2026-05-01','2026-06-30',true,'2026-04-01'),
      ('ano-b252-middle-bad',3,'2026-01-01','2026-12-31',true,'2026-07-01'),
      ('ano-b252-middle-inactive',1,'2026-01-01','2026-12-31',true,'2020-01-01'),
      ('ano-b252-middle-inactive',2,'2026-01-01','2026-12-31',false,'2026-04-01'),
      ('ano-b252-middle-inactive',3,'2026-01-01','2026-12-31',true,'2026-07-01'),
      ('ano-b252-inactive',1,'2026-01-01','2026-12-31',false,'2020-01-01'),
      ('ano-b252-left-bad',1,'2026-01-01','2026-12-31',true,'2020-01-01'),
      ('ano-b252-left-bad',2,'2026-05-01','2026-12-31',true,'2026-04-01')
    ) AS v(year_id,version_no,starts_on,ends_on,active,valid_on)
    ORDER BY v.year_id,v.version_no
  LOOP
    INSERT INTO public.institutional_academic_year_versions
      (academic_year_id,version,supersedes_id,official_name,starts_on,ends_on,
       is_active,valid_from,change_reason,originating_act_ref,recorded_by,
       recorded_by_person_id,recorded_via_engagement_id)
    VALUES
      (seed.year_id,seed.version_no,
       (SELECT y.id FROM public.institutional_academic_year_versions y
        WHERE y.academic_year_id=seed.year_id AND y.version=seed.version_no-1),
       seed.year_id,seed.starts_on,seed.ends_on,seed.active,seed.valid_on,
       CASE WHEN seed.version_no=1 THEN NULL ELSE 'prova de versão' END,
       'ato-ano','00000000-0000-0000-0000-00000000c561',
       '00000000-0000-0000-0000-00000000c551',
       '00000000-0000-0000-0000-00000000c581');
  END LOOP;
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claims',school_claim,true);

  -- 1. Uma versão, escola/ano ativos e vigência contida: aceita.
  PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-single',
    '1','Turma simples','ativa','2026-03-01','2026-11-30','ato-1');
  created_count := created_count+1;
  INSERT INTO b252_context_results VALUES (1,'Uma versão e contexto ativo','PASS');

  -- 2. Escola inexistente não possui atuação autorizadora nem identidade.
  BEGIN
    PERFORM public.register_institutional_class('esc-b252-ausente','ano-b252-single',
      '2','Turma sem escola','ativa','2026-03-01','2026-11-30','ato-2');
    RAISE EXCEPTION 'b252-context:missing-school-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:school-capability-required%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_context_results VALUES (2,'Escola inexistente recusada','PASS');

  -- 3. A versão da escola aplicável em julho está inativa.
  BEGIN
    PERFORM public.register_institutional_class('esc-b252-context-inactive','ano-b252-single',
      '3','Turma em escola inativa','ativa','2026-07-01','2026-11-30','ato-3');
    RAISE EXCEPTION 'b252-context:inactive-school-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:school-inactive%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_context_results VALUES (3,'Escola inativa na data recusada','PASS');

  -- 4–8. Identidade/atividade/limites do ano e datas da turma.
  BEGIN
    PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-ausente',
      '4','Turma sem ano','ativa','2026-03-01','2026-11-30','ato-4');
    RAISE EXCEPTION 'b252-context:missing-year-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:academic-year-unavailable%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_context_results VALUES (4,'Ano inexistente recusado','PASS');
  BEGIN
    PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-inactive',
      '5','Turma em ano inativo','ativa','2026-03-01','2026-11-30','ato-5');
    RAISE EXCEPTION 'b252-context:inactive-year-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:academic-year-inactive%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_context_results VALUES (5,'Ano inativo recusado','PASS');
  BEGIN
    PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-single',
      '6','Turma precoce','ativa','2025-12-31','2026-06-01','ato-6');
    RAISE EXCEPTION 'b252-context:early-start-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:academic-year-outside-bounds%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_context_results VALUES (6,'Início anterior ao ano recusado','PASS');
  BEGIN
    PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-single',
      '7','Turma tardia','ativa','2027-01-01','2027-02-01','ato-7');
    RAISE EXCEPTION 'b252-context:late-start-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:academic-year-outside-bounds%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_context_results VALUES (7,'Início posterior ao ano recusado','PASS');
  BEGIN
    PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-single',
      '8','Turma longa','ativa','2026-03-01','2027-01-01','ato-8');
    RAISE EXCEPTION 'b252-context:late-end-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:academic-year-incompatible-segment%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_context_results VALUES (8,'Fim posterior ao ano recusado','PASS');
  BEGIN
    PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-single',
      '9','Turma invertida','ativa','2026-05-01','2026-04-30','ato-9');
    RAISE EXCEPTION 'b252-context:inverted-dates-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:invalid-dates%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_context_results VALUES (9,'Fim anterior ao início recusado','PASS');

  -- 10–12. Versões futuras: compatibilidade, encurtamento, início sem retroagir.
  PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-compatible',
    '10','Turma compatível','ativa','2026-03-01','2026-11-30','ato-10');
  created_count := created_count+1;
  INSERT INTO b252_context_results VALUES (10,'Mudança futura compatível','PASS');
  BEGIN
    PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-short',
      '11','Turma após limite','ativa','2026-03-01','2026-12-15','ato-11');
    RAISE EXCEPTION 'b252-context:future-shortening-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:academic-year-incompatible-segment%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_context_results VALUES (11,'Término futuro antecipado recusa dezembro','PASS');
  PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-shifted',
    '12','Turma anterior à mudança','ativa','2026-01-15','2026-08-01','ato-12');
  created_count := created_count+1;
  INSERT INTO b252_context_results VALUES (12,'Novo início não retroage','PASS');

  -- 13–15. Três versões: todas compatíveis, intermediária ruim, inativa.
  IF (SELECT y.version FROM public.institutional_academic_year_versions y
      WHERE y.academic_year_id='ano-b252-multi' AND y.valid_from <= '2026-03-01'
      ORDER BY y.version DESC LIMIT 1) <> 1
    OR (SELECT y.version FROM public.institutional_academic_year_versions y
      WHERE y.academic_year_id='ano-b252-multi' AND y.valid_from <= '2026-05-01'
      ORDER BY y.version DESC LIMIT 1) <> 2
    OR (SELECT y.version FROM public.institutional_academic_year_versions y
      WHERE y.academic_year_id='ano-b252-multi' AND y.valid_from <= '2026-09-01'
      ORDER BY y.version DESC LIMIT 1) <> 3
  THEN RAISE EXCEPTION 'b252-context:three-version-fixture'; END IF;
  PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-multi',
    '13','Turma multiversão','ativa','2026-03-01','2026-10-01','ato-13');
  created_count := created_count+1;
  INSERT INTO b252_context_results VALUES (13,'Três versões sucessivas compatíveis','PASS');
  BEGIN
    PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-middle-bad',
      '14','Turma em versão intermediária ruim','ativa','2026-03-01','2026-10-01','ato-14');
    RAISE EXCEPTION 'b252-context:middle-bad-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:academic-year-incompatible-segment%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_context_results VALUES (14,'Versão intermediária incompatível recusada','PASS');
  BEGIN
    PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-middle-inactive',
      '15','Turma em segmento inativo','ativa','2026-03-01','2026-10-01','ato-15');
    RAISE EXCEPTION 'b252-context:middle-inactive-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:academic-year-incompatible-segment%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_context_results VALUES (15,'Ano inativo apenas no meio recusado','PASS');

  -- 16. Início/fim exatos são inclusivos em ambos os extremos.
  PERFORM public.register_institutional_class('esc-b252-context-active','ano-b252-single',
    '16','Turma no limite','ativa','2026-01-01','2026-12-31','ato-16');
  created_count := created_count+1;
  INSERT INTO b252_context_results VALUES (16,'Limites inclusivos aceitos','PASS');

  -- 17. NULL não vira infinito: só a data inicial deve passar na validação.
  open_class := public.register_institutional_class('esc-b252-context-active','ano-b252-short',
    '17','Turma sem fim informado','ativa','2026-03-01',NULL,'ato-17');
  IF NOT EXISTS (
    SELECT 1 FROM public.institutional_classes c
    JOIN public.institutional_class_record_versions v ON v.class_id=c.id
    WHERE c.id=open_class AND c.valid_until IS NULL AND v.valid_until IS NULL
      AND v.version=1
  ) THEN RAISE EXCEPTION 'b252-context:null-end-was-replaced'; END IF;
  created_count := created_count+1;
  INSERT INTO b252_context_results VALUES (17,'Fim NULL valida apenas início','PASS');

  -- 18. Correção finita não pode inserir trecho incompatível com a v2 do ano.
  short_class := public.register_institutional_class('esc-b252-context-active','ano-b252-short',
    '18','Turma a corrigir','ativa','2026-03-01','2026-10-31','ato-18');
  created_count := created_count+1;
  SELECT v.id INTO short_base FROM public.institutional_class_record_versions v
  WHERE v.class_id=short_class AND v.version=1;
  BEGIN
    PERFORM public.record_institutional_class_version(short_class,short_base,'correct',
      '18','Turma corrigida','ativa','2026-03-01','2026-12-15','motivo','ato-correcao');
    RAISE EXCEPTION 'b252-context:correction-outside-year-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:academic-year-incompatible-segment%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.institutional_class_record_versions v
      WHERE v.class_id=short_class) <> 1
  THEN RAISE EXCEPTION 'b252-context:correction-left-residue'; END IF;
  INSERT INTO b252_context_results VALUES (18,'Correção incompatível recusada sem versão residual','PASS');

  -- Cada falha preservou ambas as tabelas; nenhuma identidade órfã existe.
  IF (SELECT count(*) FROM public.institutional_classes) <> created_count
    OR (SELECT count(*) FROM public.institutional_class_record_versions) <> created_count
    OR EXISTS (
      SELECT 1 FROM public.institutional_classes c
      WHERE NOT EXISTS (SELECT 1 FROM public.institutional_class_record_versions v
                        WHERE v.class_id=c.id)
    )
  THEN RAISE EXCEPTION 'b252-context:partial-write'; END IF;
  INSERT INTO b252_context_results VALUES (19,'Falhas sem identidade ou versão residual','PASS');

  -- 20. A correção usa a versão da escola em seu próprio início.
  context_class := public.register_institutional_class(
    'esc-b252-context-inactive','ano-b252-single','20','Turma antes da inativação',
    'ativa','2026-03-01','2026-10-31','ato-20');
  SELECT v.id INTO context_base FROM public.institutional_class_record_versions v
  WHERE v.class_id=context_class AND v.version=1;
  BEGIN
    PERFORM public.record_institutional_class_version(
      context_class,context_base,'correct','20','Correção em escola inativa',
      'ativa','2026-07-01','2026-08-31','motivo','ato-20-c');
    RAISE EXCEPTION 'b252-context:inactive-school-correction-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:school-inactive%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.institutional_class_record_versions v
      WHERE v.class_id=context_class) <> 1
    OR NOT EXISTS (SELECT 1 FROM public.institutional_classes c
                   WHERE c.id=context_class
                     AND c.school_id='esc-b252-context-inactive'
                     AND c.academic_year_id='ano-b252-single')
  THEN RAISE EXCEPTION 'b252-context:inactive-school-correction-residue'; END IF;
  INSERT INTO b252_context_results VALUES (20,'Correção após escola inativa recusada sem resíduo','PASS');

  -- 21. Antes da inativação, esquerda, alvo e direita mantêm contexto válido.
  context_class := public.register_institutional_class(
    'esc-b252-context-inactive','ano-b252-single','21','Turma até maio',
    'ativa','2026-03-01','2026-05-31','ato-21');
  SELECT v.id INTO context_base FROM public.institutional_class_record_versions v
  WHERE v.class_id=context_class AND v.version=1;
  PERFORM public.record_institutional_class_version(
    context_class,context_base,'correct','21','Correção antes da inativação',
    'ativa','2026-04-01','2026-04-30','motivo','ato-21-c');
  IF (SELECT count(*) FROM public.institutional_class_record_versions v
      WHERE v.class_id=context_class) <> 4
    OR (SELECT v.name FROM public.class_at(context_class,'2026-04-15',NULL) v)
       <> 'Correção antes da inativação'
  THEN RAISE EXCEPTION 'b252-context:active-school-correction'; END IF;
  INSERT INTO b252_context_results VALUES (21,'Correção anterior à inativação aceita','PASS');

  -- 22. Base aberta: não pode nascer direita em 01/01 fora do ano.
  context_class := public.register_institutional_class(
    'esc-b252-context-active','ano-b252-single','22','Base aberta',
    'ativa','2026-03-01',NULL,'ato-22');
  SELECT v.id INTO context_base FROM public.institutional_class_record_versions v
  WHERE v.class_id=context_class AND v.version=1;
  BEGIN
    PERFORM public.record_institutional_class_version(
      context_class,context_base,'correct','22','Correção até dezembro',
      'ativa','2026-03-01','2026-12-31','motivo','ato-22-c');
    RAISE EXCEPTION 'b252-context:right-outside-year-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:academic-year-outside-bounds%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.institutional_class_record_versions v
      WHERE v.class_id=context_class) <> 1
    OR NOT EXISTS (SELECT 1 FROM public.institutional_class_record_versions v
                   WHERE v.id=context_base AND v.valid_until IS NULL)
  THEN RAISE EXCEPTION 'b252-context:right-outside-year-residue'; END IF;
  INSERT INTO b252_context_results VALUES (22,'Direita em 01/01 recusada sem alterar base aberta','PASS');

  -- 23. As três peças, inclusive direita aberta iniciada em julho, são válidas.
  context_class := public.register_institutional_class(
    'esc-b252-context-active','ano-b252-single','23','Base para três peças',
    'ativa','2026-03-01',NULL,'ato-23');
  SELECT v.id INTO context_base FROM public.institutional_class_record_versions v
  WHERE v.class_id=context_class AND v.version=1;
  PERFORM public.record_institutional_class_version(
    context_class,context_base,'correct','23','Alvo de três peças',
    'ativa','2026-05-01','2026-06-30','motivo','ato-23-c');
  IF (SELECT count(*) FROM public.institutional_class_record_versions v
      WHERE v.class_id=context_class) <> 4
    OR (SELECT v.name FROM public.class_at(context_class,'2026-04-01',NULL) v)
       <> 'Base para três peças'
    OR (SELECT v.name FROM public.class_at(context_class,'2026-05-15',NULL) v)
       <> 'Alvo de três peças'
    OR (SELECT v.name FROM public.class_at(context_class,'2026-07-01',NULL) v)
       <> 'Base para três peças'
    OR NOT EXISTS (SELECT 1 FROM public.institutional_class_record_versions v
                   WHERE v.class_id=context_class AND v.valid_from='2026-07-01'
                     AND v.valid_until IS NULL)
  THEN RAISE EXCEPTION 'b252-context:three-valid-pieces'; END IF;
  INSERT INTO b252_context_results VALUES (23,'Esquerda alvo e direita válidas aceitas','PASS');

  -- 24. Somente a esquerda cruza a versão futura incompatível do ano.
  context_class := public.register_institutional_class(
    'esc-b252-context-active','ano-b252-left-bad','24','Base esquerda',
    'ativa','2026-03-01',NULL,'ato-24');
  SELECT v.id INTO context_base FROM public.institutional_class_record_versions v
  WHERE v.class_id=context_class AND v.version=1;
  BEGIN
    PERFORM public.record_institutional_class_version(
      context_class,context_base,'correct','24','Alvo válido',
      'ativa','2026-05-01','2026-07-31','motivo','ato-24-c');
    RAISE EXCEPTION 'b252-context:left-incompatible-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:academic-year-incompatible-segment%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.institutional_class_record_versions v
      WHERE v.class_id=context_class) <> 1
  THEN RAISE EXCEPTION 'b252-context:left-incompatible-residue'; END IF;
  INSERT INTO b252_context_results VALUES (24,'Esquerda incompatível recusa operação inteira','PASS');

  -- 25. Versão futura do ano torna inválida somente a direita de dezembro.
  context_class := public.register_institutional_class(
    'esc-b252-context-active','ano-b252-short','25','Base ano encurtado',
    'ativa','2026-03-01',NULL,'ato-25');
  SELECT v.id INTO context_base FROM public.institutional_class_record_versions v
  WHERE v.class_id=context_class AND v.version=1;
  BEGIN
    PERFORM public.record_institutional_class_version(
      context_class,context_base,'correct','25','Alvo até novembro',
      'ativa','2026-03-01','2026-11-30','motivo','ato-25-c');
    RAISE EXCEPTION 'b252-context:future-right-incompatible-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:academic-year-outside-bounds%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.institutional_class_record_versions v
      WHERE v.class_id=context_class) <> 1
  THEN RAISE EXCEPTION 'b252-context:future-right-residue'; END IF;
  INSERT INTO b252_context_results VALUES (25,'Ano futuro invalida apenas direita e recusa','PASS');

  -- 26. Escola inativa em junho afeta somente a direita gerada.
  context_class := public.register_institutional_class(
    'esc-b252-context-inactive','ano-b252-single','26','Base escola futura inativa',
    'ativa','2026-03-01',NULL,'ato-26');
  SELECT v.id INTO context_base FROM public.institutional_class_record_versions v
  WHERE v.class_id=context_class AND v.version=1;
  BEGIN
    PERFORM public.record_institutional_class_version(
      context_class,context_base,'correct','26','Alvo até maio',
      'ativa','2026-03-01','2026-05-31','motivo','ato-26-c');
    RAISE EXCEPTION 'b252-context:inactive-right-school-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:school-inactive%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.institutional_class_record_versions v
      WHERE v.class_id=context_class) <> 1
  THEN RAISE EXCEPTION 'b252-context:inactive-right-school-residue'; END IF;
  INSERT INTO b252_context_results VALUES (26,'Escola inativa só na direita recusa sem resíduo','PASS');
END $context_test$;
SELECT n,scenario,result FROM b252_context_results ORDER BY n;
ROLLBACK;
