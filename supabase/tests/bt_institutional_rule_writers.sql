-- BT — prova transacional dos writers de regras institucionais (6 domínios).
-- Execução: como owner das funções, arquivo inteiro numa sessão:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/bt_institutional_rule_writers.sql
-- Separação deliberada (as capacidades novas ainda não têm regra homologada; NÃO se forja policy):
--   (1) ACL pelos endpoints públicos: sem sessão, sem pessoa, sem capacidade => recusa;
--   (2) núcleo (`*_core`, sem EXECUTE para papéis de app) com autoria SINTÉTICA explícita:
--       versão 1 -> leitura -> versão 2, stale, payload, segregação, homologação, consumidores, append-only.
-- O caminho positivo AUTENTICADO fica para BQ.1, quando a policy homologada conceder as capacidades.
-- Tudo dentro de BEGIN/ROLLBACK; o bloco final prova resíduo zero.
BEGIN;
DO $t$
DECLARE
  ua constant uuid := '00000000-b7b7-4e11-8000-0000000000a1'; -- UUID SINTÉTICO (redator)
  ub constant uuid := '00000000-b7b7-4e11-8000-0000000000b2'; -- UUID SINTÉTICO (homologador)
  pa uuid; pb uuid; ea uuid; eb uuid; v int; h uuid; r record; n int;
  dom text; fn text;
  dp jsonb := '{"familyId":"aula","appliesWhenOfficialClosing":"any","outcome":"admissible","requiredCapabilities":["registrar-aula"],"requirementCodes":["motivo"],"definition":{"label":"teste BT"}}';
  base_counts bigint[];
BEGIN
  SELECT ARRAY[(SELECT count(*) FROM public.diary_correction_policies),(SELECT count(*) FROM public.assessment_correction_policies),
    (SELECT count(*) FROM public.cycle_closing_policies),(SELECT count(*) FROM public.attendance_calculation_policies),
    (SELECT count(*) FROM public.attendance_occurrence_types),(SELECT count(*) FROM public.collegial_body_configurations),
    (SELECT count(*) FROM public.capability_policies),(SELECT count(*) FROM public.capability_policy_rules)] INTO base_counts;

  -- superfície
  FOREACH dom IN ARRAY ARRAY['institutional_rule_drafts','institutional_rule_homologations','diary_correction_policies','assessment_correction_policies',
      'cycle_closing_policies','attendance_calculation_policies','attendance_occurrence_types','collegial_body_configurations'] LOOP
    IF has_table_privilege('authenticated','public.'||dom,'INSERT') OR has_table_privilege('authenticated','public.'||dom,'UPDATE')
       OR has_table_privilege('authenticated','public.'||dom,'DELETE') OR has_table_privilege('anon','public.'||dom,'INSERT')
       OR has_table_privilege('anon','public.'||dom,'UPDATE') OR has_table_privilege('anon','public.'||dom,'DELETE') THEN
      RAISE EXCEPTION 'FALHA: DML direto em %', dom; END IF;
  END LOOP;
  IF has_table_privilege('authenticated','public.institutional_rule_drafts','SELECT') OR has_table_privilege('anon','public.institutional_rule_drafts','SELECT') THEN
    RAISE EXCEPTION 'FALHA: leitura direta do ledger'; END IF;
  FOREACH fn IN ARRAY ARRAY['public.record_diary_correction_policy_draft(text,integer,date,date,jsonb,text,text)',
      'public.homologate_collegial_body_configuration(text,integer,text,text)','public.institutional_rule_versions_at(text,date,timestamptz)',
      'public.preview_institutional_rule_draft(text,jsonb,date,date)'] LOOP
    IF has_function_privilege('anon', fn, 'EXECUTE') THEN RAISE EXCEPTION 'FALHA: anon executa %', fn; END IF;
    IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN RAISE EXCEPTION 'FALHA: authenticated sem endpoint %', fn; END IF;
  END LOOP;
  FOREACH fn IN ARRAY ARRAY['public.institutional_rule_record_draft_core(text,text,integer,date,date,jsonb,text,text,uuid,uuid,uuid)',
      'public.institutional_rule_homologate_core(text,text,integer,text,text,uuid,uuid,uuid)','public.institutional_rule_versions_core(text,date,timestamptz)',
      'public.institutional_rule_record_draft(text,text,integer,date,date,jsonb,text,text)','public.institutional_rule_payload_issue(text,jsonb,date,date)'] LOOP
    IF has_function_privilege('authenticated', fn, 'EXECUTE') OR has_function_privilege('anon', fn, 'EXECUTE') THEN RAISE EXCEPTION 'FALHA: núcleo exposto %', fn; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace WHERE s.nspname = 'public' AND p.prosecdef
     AND (p.proname LIKE 'institutional_rule_%' OR p.proname ~ '^(record|homologate)_(diary_correction|assessment_correction|cycle_closing|attendance_calculation|attendance_occurrence|collegial_body)[a-z_]*_(draft|policy|type|configuration)$')
     AND NOT (coalesce(p.proconfig, '{}') @> ARRAY['search_path=""'])) THEN RAISE EXCEPTION 'FALHA: DEFINER sem search_path vazio'; END IF;

  -- (1) ACL: sem sessão
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.record_diary_correction_policy_draft('bt-teste', 0, CURRENT_DATE, NULL, dp, 'x', NULL); RAISE EXCEPTION 'FALHA: sem sessão';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'session:required%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.institutional_rule_versions_at('correcao-diario', CURRENT_DATE, now()); RAISE EXCEPTION 'FALHA: leitura sem sessão';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'session:required%' THEN RAISE; END IF; END;
  -- sessão sem pessoa
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.homologate_attendance_occurrence_type('bt-teste', 1, 'x', NULL); RAISE EXCEPTION 'FALHA: sem pessoa';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'session:person-required%' THEN RAISE; END IF; END;

  -- fixtures sintéticas efêmeras (pessoa órgão + vínculo + atuação de tipo existente SEM as capacidades novas)
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('TESTE SINTÉTICO BT A — revertido','orgao-institucional') RETURNING id INTO pa;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('TESTE SINTÉTICO BT B — revertido','orgao-institucional') RETURNING id INTO pb;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (ua, pa), (ub, pb);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, valid_from, originating_act_ref)
    VALUES (pa, 'autoridade-calendario-da-rede', 'rede', CURRENT_DATE - 1, 'fixture sintética BT (ROLLBACK)') RETURNING id INTO ea;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, school_id, valid_from, originating_act_ref)
    VALUES (pb, 'autoridade-calendario-da-rede', 'escola', (SELECT s.id FROM public.institutional_schools s ORDER BY s.id LIMIT 1), CURRENT_DATE - 1, 'fixture sintética BT (ROLLBACK)') RETURNING id INTO eb;

  -- sessão com pessoa/atuação mas sem capacidade (rede e escola) => recusa em TODOS os endpoints
  FOREACH fn IN ARRAY ARRAY['record_diary_correction_policy_draft','record_assessment_correction_policy_draft','record_cycle_closing_policy_draft',
      'record_attendance_calculation_policy_draft','record_attendance_occurrence_type_draft','record_collegial_body_configuration_draft'] LOOP
    BEGIN EXECUTE format('SELECT public.%I($1,$2,$3,$4,$5,$6,$7)', fn) USING 'bt-teste', 0, CURRENT_DATE, NULL::date, '{}'::jsonb, 'x', NULL::text;
      RAISE EXCEPTION 'FALHA: sem capacidade % aceito', fn;
    EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:capability-missing:%' THEN RAISE; END IF; END;
  END LOOP;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  FOREACH fn IN ARRAY ARRAY['homologate_diary_correction_policy','homologate_assessment_correction_policy','homologate_cycle_closing_policy',
      'homologate_attendance_calculation_policy','homologate_attendance_occurrence_type','homologate_collegial_body_configuration'] LOOP
    BEGIN EXECUTE format('SELECT public.%I($1,$2,$3,$4)', fn) USING 'bt-teste', 1, 'x', NULL::text;
      RAISE EXCEPTION 'FALHA: homologar sem capacidade % aceito', fn;
    EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:capability-missing:%' THEN RAISE; END IF; END;
  END LOOP;
  BEGIN PERFORM public.institutional_rule_versions_at('configuracao-colegiado', CURRENT_DATE, now()); RAISE EXCEPTION 'FALHA: leitura sem capacidade';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:access-denied%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.preview_institutional_rule_draft('correcao-diario', dp, CURRENT_DATE, NULL); RAISE EXCEPTION 'FALHA: preview sem capacidade';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:capability-missing:%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', '', true);

  -- (2) núcleo com autoria sintética explícita
  -- payload inválido (contrato fechado)
  BEGIN PERFORM public.institutional_rule_record_draft_core('correcao-diario','bt-diario',0,CURRENT_DATE,NULL, dp || '{"sql":"drop"}', 'm', NULL, ua, pa, ea); RAISE EXCEPTION 'FALHA: campo desconhecido';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:payload-unknown-field:sql%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.institutional_rule_record_draft_core('correcao-diario','bt-diario',0,CURRENT_DATE,NULL, dp || '{"outcome":"talvez"}', 'm', NULL, ua, pa, ea); RAISE EXCEPTION 'FALHA: enum';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:payload-invalid:outcome%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.institutional_rule_record_draft_core('correcao-diario','bt-diario',0,NULL,NULL, dp, 'm', NULL, ua, pa, ea); RAISE EXCEPTION 'FALHA: vigência';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:validity-required%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.institutional_rule_record_draft_core('correcao-diario','bt-diario',0,CURRENT_DATE,NULL, dp || '{"requiredCapabilities":["*"]}', 'm', NULL, ua, pa, ea); RAISE EXCEPTION 'FALHA: curinga';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:payload-invalid:requiredCapabilities%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.institutional_rule_record_draft_core('fechamento-ciclo','bt-ciclo',0,CURRENT_DATE,NULL,
      '{"definition":{},"closingCapabilities":[],"rectificationCapabilities":[],"reopeningCapabilities":[]}', 'm', NULL, ua, pa, ea); RAISE EXCEPTION 'FALHA: vigência não aplicável';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:validity-not-applicable%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.institutional_rule_record_draft_core('correcao-avaliacao','bt-aval',0,CURRENT_DATE,NULL,
      '{"classId":"turma-inexistente-bt","appliesWhenPeriodClosing":"any","outcome":"forbidden","requiredCapabilities":[],"requirementCodes":[],"definition":{}}', 'm', NULL, ua, pa, ea);
      RAISE EXCEPTION 'FALHA: turma inexistente (escopo)';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:payload-invalid:classId%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.institutional_rule_record_draft_core('outro','bt-x',0,NULL,NULL,'{}','m',NULL,ua,pa,ea); RAISE EXCEPTION 'FALHA: domínio';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:domain-invalid%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.institutional_rule_record_draft_core('correcao-diario','bt-diario',0,CURRENT_DATE,NULL, dp, 'm', NULL, NULL, NULL, NULL); RAISE EXCEPTION 'FALHA: sem autoria';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:author-required%' THEN RAISE; END IF; END;

  -- Diário: v1 -> stale -> segregação -> homologação -> consumidor -> v2 -> consumidor -> histórico
  v := public.institutional_rule_record_draft_core('correcao-diario','bt-diario',0,CURRENT_DATE,NULL, dp, 'prova BT v1', NULL, ua, pa, ea);
  IF v <> 1 THEN RAISE EXCEPTION 'FALHA: v1'; END IF;
  BEGIN PERFORM public.institutional_rule_record_draft_core('correcao-diario','bt-diario',0,CURRENT_DATE,NULL, dp, 'm', NULL, ua, pa, ea); RAISE EXCEPTION 'FALHA: stale aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:stale-head%' THEN RAISE; END IF; END;
  SELECT * INTO r FROM public.institutional_rule_versions_core('correcao-diario', CURRENT_DATE, now()) WHERE logical_id = 'bt-diario';
  IF r.state <> 'rascunho' OR r.version <> 1 OR r.recorded_person_id <> pa THEN RAISE EXCEPTION 'FALHA: leitura rascunho %', r; END IF;
  IF EXISTS (SELECT 1 FROM public.applicable_diary_policy_on('aula', false, CURRENT_DATE)) THEN RAISE EXCEPTION 'FALHA: rascunho vale'; END IF;
  BEGIN PERFORM public.institutional_rule_homologate_core('correcao-diario','bt-diario',1,'h',NULL, ua, pa, ea); RAISE EXCEPTION 'FALHA: autohomologação';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:segregation%' THEN RAISE; END IF; END;
  h := public.institutional_rule_homologate_core('correcao-diario','bt-diario',1,'homologação BT',NULL, ub, pb, eb);
  BEGIN PERFORM public.institutional_rule_homologate_core('correcao-diario','bt-diario',1,'h',NULL, ub, pb, eb); RAISE EXCEPTION 'FALHA: dupla homologação';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:already-homologated%' THEN RAISE; END IF; END;
  SELECT * INTO r FROM public.applicable_diary_policy_on('aula', false, CURRENT_DATE);
  IF r.logical_policy_id <> 'bt-diario' OR r.version <> 1 OR r.homologation_act_ref <> 'sigem-homologacao:' || h THEN RAISE EXCEPTION 'FALHA: consumidor v1 %', r; END IF;
  IF EXISTS (SELECT 1 FROM public.applicable_diary_policy_on('aula', false, CURRENT_DATE - 1)) THEN RAISE EXCEPTION 'FALHA: asOf antes da vigência'; END IF;
  IF (SELECT state FROM public.institutional_rule_versions_core('correcao-diario', CURRENT_DATE, now()) WHERE logical_id='bt-diario' AND version=1) <> 'vigente' THEN RAISE EXCEPTION 'FALHA: estado vigente'; END IF;
  IF (SELECT state FROM public.institutional_rule_versions_core('correcao-diario', CURRENT_DATE - 1, now()) WHERE logical_id='bt-diario' AND version=1) <> 'homologada-futura' THEN RAISE EXCEPTION 'FALHA: estado futuro'; END IF;
  IF EXISTS (SELECT 1 FROM public.institutional_rule_versions_core('correcao-diario', CURRENT_DATE, now() - interval '1 second')) THEN RAISE EXCEPTION 'FALHA: knownAt'; END IF;
  v := public.institutional_rule_record_draft_core('correcao-diario','bt-diario',1,CURRENT_DATE,NULL, dp || '{"outcome":"forbidden"}', 'prova BT v2', NULL, ua, pa, ea);
  IF v <> 2 THEN RAISE EXCEPTION 'FALHA: v2'; END IF;
  BEGIN PERFORM public.institutional_rule_homologate_core('correcao-diario','bt-diario',1,'h',NULL, ub, pb, eb); RAISE EXCEPTION 'FALHA: homologar base superada';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:already-homologated%' AND SQLERRM NOT LIKE 'institutional-rule:stale-head%' THEN RAISE; END IF; END;
  PERFORM public.institutional_rule_homologate_core('correcao-diario','bt-diario',2,'homologação BT v2',NULL, ub, pb, eb);
  SELECT * INTO r FROM public.applicable_diary_policy_on('aula', false, CURRENT_DATE);
  IF r.version <> 2 OR r.outcome <> 'forbidden' OR r.supersedes_version_id IS NULL THEN RAISE EXCEPTION 'FALHA: consumidor v2 %', r; END IF;
  IF (SELECT outcome FROM public.diary_correction_policies WHERE logical_policy_id='bt-diario' AND version=1) <> 'admissible' THEN RAISE EXCEPTION 'FALHA: histórico'; END IF;
  IF (SELECT state FROM public.institutional_rule_versions_core('correcao-diario', CURRENT_DATE, now()) WHERE logical_id='bt-diario' AND version=1) <> 'superada' THEN RAISE EXCEPTION 'FALHA: superada'; END IF;
  -- imutabilidade
  BEGIN UPDATE public.diary_correction_policies SET outcome='admissible' WHERE logical_policy_id='bt-diario' AND version=1; RAISE EXCEPTION 'FALHA: update homologada';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF; END;
  BEGIN UPDATE public.institutional_rule_drafts SET reason='x' WHERE logical_id='bt-diario'; RAISE EXCEPTION 'FALHA: update rascunho';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.institutional_rule_homologations WHERE logical_id='bt-diario'; RAISE EXCEPTION 'FALHA: delete homologação';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF; END;

  -- demais domínios: v1 -> homologação -> linha consumível com status do motor
  v := public.institutional_rule_record_draft_core('correcao-avaliacao','bt-aval',0,CURRENT_DATE,NULL,
     '{"appliesWhenPeriodClosing":"absent","outcome":"admissible","requiredCapabilities":[],"requirementCodes":[],"admissibleValueKinds":["numerica"],"definition":{}}','m',NULL,ua,pa,ea);
  PERFORM public.institutional_rule_homologate_core('correcao-avaliacao','bt-aval',v,'h',NULL,ub,pb,eb);
  IF NOT EXISTS (SELECT 1 FROM public.assessment_correction_policies WHERE logical_policy_id='bt-aval' AND status='homologated' AND class_id IS NULL AND admissible_value_kinds = ARRAY['numerica']) THEN RAISE EXCEPTION 'FALHA: avaliação'; END IF;
  v := public.institutional_rule_record_draft_core('fechamento-ciclo','bt-ciclo',0,NULL,NULL,
     '{"definition":{},"closingCapabilities":["bt-c"],"rectificationCapabilities":[],"reopeningCapabilities":[]}','m',NULL,ua,pa,ea);
  PERFORM public.institutional_rule_homologate_core('fechamento-ciclo','bt-ciclo',v,'h',NULL,ub,pb,eb);
  IF NOT EXISTS (SELECT 1 FROM public.cycle_closing_policies WHERE id='bt-ciclo' AND version=1 AND status='homologada' AND closing_capabilities=ARRAY['bt-c']) THEN RAISE EXCEPTION 'FALHA: ciclo'; END IF;
  v := public.institutional_rule_record_draft_core('calculo-frequencia','bt-freq',0,CURRENT_DATE,CURRENT_DATE+10,'{"definition":{}}','m',NULL,ua,pa,ea);
  PERFORM public.institutional_rule_homologate_core('calculo-frequencia','bt-freq',v,'h',NULL,ub,pb,eb);
  IF NOT EXISTS (SELECT 1 FROM public.attendance_calculation_policies WHERE id='bt-freq' AND status='homologada' AND valid_until=CURRENT_DATE+10) THEN RAISE EXCEPTION 'FALHA: frequência'; END IF;
  IF (SELECT state FROM public.institutional_rule_versions_core('calculo-frequencia', CURRENT_DATE+11, now()) WHERE logical_id='bt-freq') <> 'expirada' THEN RAISE EXCEPTION 'FALHA: expirada'; END IF;
  BEGIN PERFORM public.institutional_rule_record_draft_core('tipo-ocorrencia-frequencia','bt-ocor',0,CURRENT_DATE,NULL,'{"code":"X","label":" ","requiresDocument":false}','m',NULL,ua,pa,ea); RAISE EXCEPTION 'FALHA: rótulo vazio';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'institutional-rule:payload-invalid:label%' THEN RAISE; END IF; END;
  v := public.institutional_rule_record_draft_core('tipo-ocorrencia-frequencia','bt-ocor',0,CURRENT_DATE,NULL,'{"code":"BT1","label":"Tipo sintético BT","requiresDocument":true}','m',NULL,ua,pa,ea);
  PERFORM public.institutional_rule_homologate_core('tipo-ocorrencia-frequencia','bt-ocor',v,'h',NULL,ub,pb,eb);
  IF NOT EXISTS (SELECT 1 FROM public.attendance_occurrence_types WHERE id='bt-ocor' AND status='homologada' AND requires_document AND homologation_act_ref LIKE 'sigem-homologacao:%') THEN RAISE EXCEPTION 'FALHA: ocorrência'; END IF;
  v := public.institutional_rule_record_draft_core('configuracao-colegiado','bt-coleg',0,NULL,NULL,'{"definition":{},"conductCapabilities":["bt-conduzir"]}','m',NULL,ua,pa,ea);
  PERFORM public.institutional_rule_homologate_core('configuracao-colegiado','bt-coleg',v,'h',NULL,ub,pb,eb);
  BEGIN PERFORM public.collegial_conduct_authority('bt-coleg', 1, 'turma-qualquer'); RAISE EXCEPTION 'FALHA: conduta sem capacidade';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability-missing%' THEN RAISE; END IF; END; -- motor lê a configuração homologada

  SELECT count(*) INTO n FROM public.institutional_rule_homologations WHERE logical_id LIKE 'bt-%';
  IF n <> 7 THEN RAISE EXCEPTION 'FALHA: homologações %', n; END IF;
  IF (SELECT count(*) FROM public.capability_policies) <> base_counts[7] OR (SELECT count(*) FROM public.capability_policy_rules) <> base_counts[8] THEN
    RAISE EXCEPTION 'FALHA: policy alterada'; END IF;
  RAISE NOTICE 'BT_OK base=%', base_counts;
END $t$;
ROLLBACK;

-- resíduo zero
DO $z$ BEGIN
  IF EXISTS (SELECT 1 FROM public.institutional_rule_drafts WHERE logical_id LIKE 'bt-%') OR EXISTS (SELECT 1 FROM public.institutional_rule_homologations WHERE logical_id LIKE 'bt-%')
     OR EXISTS (SELECT 1 FROM public.user_person_links WHERE user_id IN ('00000000-b7b7-4e11-8000-0000000000a1','00000000-b7b7-4e11-8000-0000000000b2'))
     OR EXISTS (SELECT 1 FROM public.institutional_persons WHERE display_name LIKE 'TESTE SINTÉTICO BT%')
     OR EXISTS (SELECT 1 FROM public.diary_correction_policies WHERE logical_policy_id LIKE 'bt-%') THEN
    RAISE EXCEPTION 'FALHA: resíduo BT'; END IF;
  RAISE NOTICE 'BT_RESIDUE_ZERO';
END $z$;
