-- CAL.EXT.1.1 — prova POSITIVA e negativa do writer oficial do perfil visual externo.
-- Execução: como owner das funções (postgres), arquivo inteiro numa sessão:  psql -v ON_ERROR_STOP=1 -f supabase/tests/cal_ext_1_external_profiles.sql
-- Autoria: UUID SINTÉTICO (nunca conta humana real, nunca service_role). Pré-requisitos sintéticos mínimos
-- (pessoa órgão + vínculo + atuação do tipo já existente 'autoridade-calendario-da-rede' + designação só com
-- 'construir-calendario-da-rede') existem SOMENTE dentro desta transação. Nenhuma policy/regra/capability é criada.
-- O writer exige apenas auth.uid() + capacidade efetiva; não há FK para auth.users, então Auth real não é necessária.
BEGIN;
CREATE TEMP TABLE cal_ext_11_marker(test_user uuid, test_person uuid, test_engagement uuid) ON COMMIT DROP;
DO $t$
DECLARE
  tu  constant uuid := '00000000-ca1e-4e11-8000-0000000c4e11'; -- UUID SINTÉTICO de teste (CAL.EXT.1.1)
  tp uuid; te uuid; cal text; r jsonb; h1 uuid; h2 uuid;
  bv bigint; bh bigint; bd bigint; bp bigint; bl bigint; be bigint;
BEGIN
  SELECT count(*) INTO bv FROM public.calendar_versions;
  SELECT count(*) INTO bh FROM public.calendar_version_homologations;
  SELECT count(*) INTO bd FROM public.calendar_version_day_assignments;
  SELECT count(*) INTO bp FROM public.calendar_version_presentation_snapshots;
  SELECT count(*) INTO bl FROM public.calendar_external_presentation_revisions; -- 0201 aposentada
  IF bl <> 0 THEN RAISE EXCEPTION 'FALHA: tabela aposentada 0201 com dados'; END IF;
  SELECT v.calendar_id INTO cal FROM public.calendar_versions v ORDER BY v.created_at LIMIT 1;
  IF cal IS NULL THEN RAISE EXCEPTION 'FALHA: nenhum calendário'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_person_links WHERE user_id = tu) THEN RAISE EXCEPTION 'FALHA: UUID sintético já existe'; END IF;

  -- superfície: sem DML/SELECT direto para papéis de app; anon sem EXECUTE; 0201 sem grants de app
  IF has_table_privilege('authenticated','public.calendar_external_profile_revisions','INSERT,UPDATE,DELETE,SELECT')
     OR has_table_privilege('anon','public.calendar_external_profile_revisions','INSERT,UPDATE,DELETE,SELECT')
     OR has_table_privilege('authenticated','public.calendar_external_presentation_revisions','INSERT,UPDATE,DELETE,SELECT')
     OR has_table_privilege('anon','public.calendar_external_presentation_revisions','INSERT,UPDATE,DELETE,SELECT') THEN
    RAISE EXCEPTION 'FALHA: DML direto concedido'; END IF;
  IF has_function_privilege('anon','public.record_calendar_external_profile(text,text,uuid,jsonb,text)','EXECUTE')
     OR has_function_privilege('anon','public.calendar_external_profile_at(text,text,date,timestamptz)','EXECUTE') THEN
    RAISE EXCEPTION 'FALHA: anon executa'; END IF;

  -- sem sessão / sem capacidade
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'externo-mosaico', NULL, '{}', NULL); RAISE EXCEPTION 'FALHA: sem sessão aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'calendar:session-required%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', tu, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'externo-mosaico', NULL, '{}', NULL); RAISE EXCEPTION 'FALHA: sem capacidade aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;

  -- pré-requisitos sintéticos efêmeros (DML de fixture permitido só aqui, dentro da transação)
  INSERT INTO public.institutional_persons(display_name, actor_nature)
    VALUES ('TESTE SINTÉTICO CAL.EXT.1.1 — revertido', 'orgao-institucional') RETURNING id INTO tp;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (tu, tp);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, scope_level, valid_from, originating_act_ref)
    VALUES (tp, 'autoridade-calendario-da-rede', 'rede', CURRENT_DATE - 1, 'fixture sintética CAL.EXT.1.1 (ROLLBACK)') RETURNING id INTO te;
  INSERT INTO public.calendar_authority_designations(user_id, person_id, engagement_id, capabilities, origin)
    VALUES (tu, tp, te, ARRAY['construir-calendario-da-rede'], 'fixture sintética CAL.EXT.1.1 (ROLLBACK)');
  INSERT INTO cal_ext_11_marker VALUES (tu, tp, te);

  -- caminho positivo pelo writer OFICIAL
  IF public.calendar_external_profile_at(cal, 'externo-mosaico', CURRENT_DATE, now())->>'state' <> 'padrao' THEN RAISE EXCEPTION 'FALHA: padrão'; END IF;
  r := public.record_calendar_external_profile(cal, 'externo-mosaico', NULL,
    jsonb_build_object('primary','#123456','coverImage','data:image/png;base64,iVBORw0KGgo='), 'prova CAL.EXT.1.1');
  h1 := (r->>'revisionId')::uuid;
  IF (r->>'revision')::int <> 1 THEN RAISE EXCEPTION 'FALHA: revisão 1'; END IF;
  IF (SELECT recorded_by FROM public.calendar_external_profile_revisions WHERE id = h1) <> tu
     OR (SELECT recorded_via_engagement_id FROM public.calendar_external_profile_revisions WHERE id = h1) <> te THEN
    RAISE EXCEPTION 'FALHA: autoria não é a sintética'; END IF;
  r := public.calendar_external_profile_at(cal, 'externo-mosaico', CURRENT_DATE, now());
  IF r->>'state' <> 'lido' OR (r->>'revision')::int <> 1 OR r->'profile'->>'primary' <> '#123456' OR length(r->>'digest') <> 64 THEN
    RAISE EXCEPTION 'FALHA: leitura 1 %', r; END IF;
  r := public.record_calendar_external_profile(cal, 'externo-mosaico', h1, '{"primary":"#654321"}', NULL);
  h2 := (r->>'revisionId')::uuid;
  IF (r->>'revision')::int <> 2 THEN RAISE EXCEPTION 'FALHA: revisão 2'; END IF;
  r := public.calendar_external_profile_at(cal, 'externo-mosaico', CURRENT_DATE, now());
  IF r->>'state' <> 'lido' OR (r->>'revisionId')::uuid <> h2 OR r->'profile'->>'primary' <> '#654321' THEN RAISE EXCEPTION 'FALHA: leitura 2 %', r; END IF;

  -- recusas
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'externo-mosaico', h1, '{}', NULL); RAISE EXCEPTION 'FALHA: base obsoleta aceita';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'calendar-external:base-superseded%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'externo-mosaico', NULL, '{}', NULL); RAISE EXCEPTION 'FALHA: head nulo aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'calendar-external:base-superseded%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'qualquer', NULL, '{}', NULL); RAISE EXCEPTION 'FALHA: template aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'calendar-external:invalid-template%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'externo-mosaico', h2, '{"coverImage":"data:image/svg+xml;base64,AAAA"}', NULL); RAISE EXCEPTION 'FALHA: svg aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'calendar-external:asset-invalid%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'externo-mosaico', h2, '{"logos":[{"src":"data:text/html;base64,AAAA"}]}', NULL); RAISE EXCEPTION 'FALHA: asset aninhado aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'calendar-external:asset-invalid%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_calendar_external_profile(cal, 'externo-mosaico', h2, jsonb_build_object('coverImage', 'data:image/png;base64,' || repeat('A', 1600000)), NULL); RAISE EXCEPTION 'FALHA: grande aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'calendar-external:asset-too-large%' THEN RAISE; END IF; END;
  BEGIN UPDATE public.calendar_external_profile_revisions SET reason = 'x' WHERE id = h1; RAISE EXCEPTION 'FALHA: update aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.calendar_external_profile_revisions WHERE id = h1; RAISE EXCEPTION 'FALHA: delete aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHA%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.calendar_external_profile_revisions WHERE calendar_id = cal AND template_code = 'externo-mosaico') <> 2 THEN
    RAISE EXCEPTION 'FALHA: contagem de revisões'; END IF;

  -- conteúdo acadêmico/calendário/homologação inalterados
  IF (SELECT count(*) FROM public.calendar_versions) <> bv OR (SELECT count(*) FROM public.calendar_version_homologations) <> bh
     OR (SELECT count(*) FROM public.calendar_version_day_assignments) <> bd OR (SELECT count(*) FROM public.calendar_version_presentation_snapshots) <> bp THEN
    RAISE EXCEPTION 'FALHA: conteúdo do calendário alterado'; END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE public) THEN RAISE EXCEPTION 'FALHA: bucket público'; END IF;
  RAISE NOTICE 'CAL.EXT.1.1 SQL OK (dentro da transação)';
END $t$;
ROLLBACK;

-- fora da transação: zero resíduo sintético
DO $z$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_person_links WHERE user_id = '00000000-ca1e-4e11-8000-0000000c4e11')
     OR EXISTS (SELECT 1 FROM public.calendar_authority_designations WHERE user_id = '00000000-ca1e-4e11-8000-0000000c4e11')
     OR EXISTS (SELECT 1 FROM public.institutional_persons WHERE display_name LIKE 'TESTE SINTÉTICO CAL.EXT.1.1%')
     OR EXISTS (SELECT 1 FROM public.institutional_engagements WHERE originating_act_ref LIKE 'fixture sintética CAL.EXT.1.1%')
     OR EXISTS (SELECT 1 FROM public.calendar_external_profile_revisions WHERE recorded_by = '00000000-ca1e-4e11-8000-0000000c4e11') THEN
    RAISE EXCEPTION 'FALHA: resíduo sintético'; END IF;
  RAISE NOTICE 'CAL.EXT.1.1 zero resíduo OK';
END $z$;
