-- AG — E2E transacional sintético do Censo Escolar. Termina em RAISE: nada persiste.
-- Cobre: ciclo, snapshot+impressão digital, unknown≠zero, alteração posterior, reconferência, segregação,
-- stale, staging/rejeições/idempotência, comparação, ACL escola/rede, papéis técnicos e imutabilidade.
DO $t$
DECLARE
  up uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); uc2 uuid := gen_random_uuid(); us uuid := gen_random_uuid(); uq uuid := gen_random_uuid();
  sa text; sb text; sx text := 'escola-ag-e2e-sem-cadastro'; y text := 'ano-ag-e2e-sintetico'; cls text := 'turma-ag-e2e'; cid text;
  st1 text; st2 text; en1 text; en2 text; s1 jsonb; s2 jsonb; imp jsonb; imp2 jsonb; j jsonb; n int; seq int; ok text := ''; fp_before text;
BEGIN
  SET LOCAL statement_timeout = '55s'; SET LOCAL lock_timeout = '5s';
  SELECT s.id INTO sa FROM public.institutional_schools s ORDER BY s.id LIMIT 1;
  SELECT s.id INTO sb FROM public.institutional_schools s WHERE s.id <> sa ORDER BY s.id LIMIT 1;
  INSERT INTO public.institutional_schools(id) VALUES (sx);
  INSERT INTO public.institutional_academic_years(id) VALUES (y);
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from, originating_act_ref, technical_operation_id)
    VALUES (y, 1, 'AG Ano Sintético', '2026-08-01', '2026-12-31', true, '2026-08-01', 'ag-e2e', (SELECT o.id FROM public.technical_execution_operations o ORDER BY o.id LIMIT 1));
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance) VALUES (y, 1, 'operacional', 'ag-e2e', 'ag-e2e');
  INSERT INTO public.institutional_classes(id, school_id, school_label_snapshot, academic_year_id, academic_year_label, name, valid_from)
    VALUES (cls, sa, 'A', y, 'AG', 'AG Turma', '2026-08-01');
  WITH p AS (INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES
      ('AG Preparador', 'pessoa-natural'), ('AG Conferente', 'pessoa-natural'), ('AG Conferente 2', 'pessoa-natural'),
      ('AG Escola', 'pessoa-natural'), ('AG Órgão', 'orgao-institucional') RETURNING id, display_name)
  INSERT INTO public.user_person_links(user_id, person_id)
    SELECT CASE p.display_name WHEN 'AG Preparador' THEN up WHEN 'AG Conferente' THEN uc WHEN 'AG Conferente 2' THEN uc2 WHEN 'AG Escola' THEN us ELSE uq END, p.id FROM p;
  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_ag_original;
  EXECUTE format($s$CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT c, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, 1, 'rede', NULL::text
        FROM unnest(ARRAY['preparar-censo-escolar','conferir-censo-escolar','consultar-censo-escolar']) c WHERE auth.uid() IN (%L::uuid, %L::uuid)
      UNION ALL SELECT 'conferir-censo-escolar', '00000000-0000-0000-0000-0000000000a2'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, 1, 'rede', NULL
        WHERE auth.uid() IN (%L::uuid, %L::uuid)
      UNION ALL SELECT c, '00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, 1, 'escola', %L
        FROM unnest(ARRAY['cadastrar-estudante-na-escola','manter-matricula-e-enturmacao','consultar-matricula-e-movimentacao']) c WHERE auth.uid() = %L::uuid
      UNION ALL SELECT 'consultar-pendencias-do-censo', '00000000-0000-0000-0000-0000000000a3'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, 1, 'escola', %L
        WHERE auth.uid() = %L::uuid $b$$s$,
      up, uq, uc, uc2, sa, up, sa, us);
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated';

  -- Fatos sintéticos: um vínculo com início declarado e outro sem início (unknown)
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', up, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  st1 := public.register_student_for_school(sa, 'AG Aluno 1', '52998224725', '');
  st2 := public.register_student_for_school(sa, 'AG Aluno 2', '11144477735', '');
  en1 := public.enroll_student_in_school_year(st1, sa, y, '2026-09-01', NULL);
  en2 := public.enroll_student_in_school_year(st2, sa, y, NULL, NULL);

  -- Ciclo
  cid := public.census_open_cycle(y, '2026-09-10', 'Preparação sintética');
  BEGIN PERFORM public.census_open_cycle(y, '2026-09-10', 'de novo'); RAISE EXCEPTION 'ciclo duplo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:cycle-exists%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.census_advance_stage(cid, 1, 'pendencias', 'x'); RAISE EXCEPTION 'salto';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:transition-invalid%' THEN RAISE; END IF; END;
  seq := public.census_advance_stage(cid, 1, 'validacao', 'Validação');
  BEGIN PERFORM public.census_advance_stage(cid, 1, 'pendencias', 'x'); RAISE EXCEPTION 'stale etapa';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:stale%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.census_advance_stage(cid, seq, 'pendencias', 'x'); RAISE EXCEPTION 'sem snapshot';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:snapshot-required%' THEN RAISE; END IF; END;
  ok := ok || 'ciclo(nativo,duplo,salto,stale,sem-snapshot); ';

  -- Snapshot v1: unknown ≠ zero
  s1 := public.census_take_snapshot(cid, NULL, NULL);
  j := public.census_snapshot_content((s1->>'id')::uuid);
  SELECT x->'measures' INTO j FROM jsonb_array_elements(j->'schools') x WHERE x->>'school_id' = sa;
  IF j->'vinculos_ativos'->'value' <> 'null'::jsonb OR j->'vinculos_ativos'->>'reason' <> 'inicio-efetivo-nao-declarado'
     OR (j->'vinculos_ativos'->>'proven')::int <> 1 OR (j->'vinculos_ativos'->>'unknown')::int <> 1 OR (j->'turmas'->>'value')::int <> 1 THEN
    RAISE EXCEPTION 'unknown sa: %', j; END IF;
  SELECT x->'measures' INTO j FROM jsonb_array_elements(public.census_snapshot_content((s1->>'id')::uuid)->'schools') x WHERE x->>'school_id' = sb;
  IF (j->'vinculos_ativos'->>'value')::int <> 0 OR j->'posicoes_curriculares'->'value' <> 'null'::jsonb THEN RAISE EXCEPTION 'zero/unknown sb: %', j; END IF;
  SELECT count(*) INTO n FROM jsonb_array_elements(public.census_snapshot_content((s1->>'id')::uuid)->'findings') f
    WHERE f->>'rule' = 'vinculo-sem-inicio-efetivo' AND f->>'school_id' = sa AND (f->>'count')::int = 1;
  IF n <> 1 THEN RAISE EXCEPTION 'achado estrutural'; END IF;
  BEGIN PERFORM public.census_take_snapshot(cid, (s1->>'id')::uuid, 'igual'); RAISE EXCEPTION 'sem mudanca';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:snapshot-unchanged%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.census_take_snapshot(cid, NULL, NULL); RAISE EXCEPTION 'stale snapshot';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:stale%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.census_confer_snapshot((s1->>'id')::uuid, s1->>'fingerprint', NULL); RAISE EXCEPTION 'autoconferencia';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:segregation-required%' THEN RAISE; END IF; END;
  ok := ok || 'snapshot(unknown!=zero,zero-provado,achado,sem-mudanca,stale,autoconferencia); ';

  -- Alteração posterior: enturmação muda os fatos; snapshot antigo não muda e conferência exige novo snapshot
  PERFORM public.secretariat_allocate_to_class(en1, cls, '2026-09-02', NULL);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uc, 'role','authenticated')::text, true);
  BEGIN PERFORM public.census_confer_snapshot((s1->>'id')::uuid, repeat('0', 64), NULL); RAISE EXCEPTION 'fp errada';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:fingerprint-mismatch%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.census_confer_snapshot((s1->>'id')::uuid, s1->>'fingerprint', NULL); RAISE EXCEPTION 'desatualizado';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:snapshot-outdated%' THEN RAISE; END IF; END;
  RESET ROLE;
  SELECT public.census_fingerprint(s.content) INTO fp_before FROM public.census_snapshots s WHERE s.id = (s1->>'id')::uuid;
  IF fp_before <> s1->>'fingerprint' THEN RAISE EXCEPTION 'snapshot antigo mudou'; END IF;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', up, 'role','authenticated')::text, true);
  BEGIN PERFORM public.census_take_snapshot(cid, (s1->>'id')::uuid, NULL); RAISE EXCEPTION 'sem motivo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:reason-required%' THEN RAISE; END IF; END;
  s2 := public.census_take_snapshot(cid, (s1->>'id')::uuid, 'Enturmação posterior');
  IF (s2->>'version')::int <> 2 OR s2->>'fingerprint' = s1->>'fingerprint' THEN RAISE EXCEPTION 'v2'; END IF;
  SELECT (x->'measures'->'enturmacoes_vigentes'->>'value')::int INTO n FROM jsonb_array_elements(public.census_snapshot_content((s1->>'id')::uuid)->'schools') x WHERE x->>'school_id' = sa;
  IF n IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'v1 recalculado: %', n; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uc, 'role','authenticated')::text, true);
  BEGIN PERFORM public.census_confer_snapshot((s1->>'id')::uuid, s1->>'fingerprint', NULL); RAISE EXCEPTION 'conferir superado';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:stale%' THEN RAISE; END IF; END;
  PERFORM public.census_confer_snapshot((s2->>'id')::uuid, s2->>'fingerprint', 'Conferido');
  ok := ok || 'alteracao-posterior(outdated,v1-imutavel,v2,reconferencia); ';

  -- Etapas até snapshot com segregação; homologação sem regra
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', up, 'role','authenticated')::text, true);
  seq := public.census_advance_stage(cid, seq, 'pendencias', 'Pendências');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uc, 'role','authenticated')::text, true);
  seq := public.census_advance_stage(cid, seq, 'conferencia', 'Conferência');
  BEGIN PERFORM public.census_advance_stage(cid, seq, 'snapshot', 'x'); RAISE EXCEPTION 'conferente fechou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:segregation-required%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uc2, 'role','authenticated')::text, true);
  BEGIN PERFORM public.census_advance_stage(cid, seq, 'homologacao', 'x'); RAISE EXCEPTION 'homologou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:homologation-rule-missing%' THEN RAISE; END IF; END;
  seq := public.census_advance_stage(cid, seq, 'snapshot', 'Fechamento do snapshot');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', up, 'role','authenticated')::text, true);
  BEGIN PERFORM public.census_take_snapshot(cid, (s2->>'id')::uuid, 'depois'); RAISE EXCEPTION 'apos fechamento';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:cycle-closed%' THEN RAISE; END IF; END;
  ok := ok || 'etapas(segregacao,homologacao-sem-regra,fechado); ';

  -- Staging e comparação
  BEGIN PERFORM public.census_stage_source(cid, 'x', 'Educacenso 2027', 'sigem-agregado-por-escola', 1, repeat('a', 64), '[]'); RAISE EXCEPTION 'layout oficial';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:official-layout-not-homologated%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.census_stage_source(cid, 'x', 'planilha', 'parser-x', 1, repeat('a', 64), '[]'); RAISE EXCEPTION 'parser';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:parser-not-registered%' THEN RAISE; END IF; END;
  imp := public.census_stage_source(cid, 'Planilha sintética', 'agregado-sintetico-v1', 'sigem-agregado-por-escola', 1, repeat('b', 64),
    jsonb_build_array(
      jsonb_build_object('school_id', sa, 'measure', 'turmas', 'value', 1),
      jsonb_build_object('school_id', sa, 'measure', 'vinculos_ativos', 'value', 2),
      jsonb_build_object('school_id', sb, 'measure', 'turmas', 'value', 5),
      jsonb_build_object('school_id', sx, 'measure', 'turmas', 'value', 3),
      jsonb_build_object('school_id', 'inexistente', 'measure', 'turmas', 'value', 1),
      jsonb_build_object('school_id', sa, 'measure', 'turmas', 'value', 9),
      jsonb_build_object('school_id', sa, 'measure', 'inventada', 'value', 1),
      jsonb_build_object('school_id', sb, 'measure', 'lotacoes_profissionais', 'value', -1)));
  IF (imp->>'accepted')::int <> 4 OR (imp->>'rejected')::int <> 4 THEN RAISE EXCEPTION 'staging: %', imp; END IF;
  imp2 := public.census_stage_source(cid, 'Planilha sintética', 'agregado-sintetico-v1', 'sigem-agregado-por-escola', 1, repeat('b', 64), '[]');
  IF NOT (imp2->>'idempotent')::boolean OR imp2->>'id' <> imp->>'id' THEN RAISE EXCEPTION 'idempotencia'; END IF;
  SELECT count(*) FILTER (WHERE school_id = sa AND measure = 'turmas' AND category = 'igual')
       + count(*) FILTER (WHERE school_id = sa AND measure = 'vinculos_ativos' AND category = 'nao-comparavel')
       + count(*) FILTER (WHERE school_id = sb AND measure = 'turmas' AND category = 'divergente')
       + count(*) FILTER (WHERE school_id = sx AND measure = 'turmas' AND category = 'ausente-no-sigem')
       + least(1, count(*) FILTER (WHERE school_id = sb AND measure = 'lotacoes_profissionais' AND category = 'ausente-na-fonte'))
    INTO n FROM public.census_compare((s2->>'id')::uuid, (imp->>'id')::uuid);
  IF n <> 5 THEN RAISE EXCEPTION 'comparacao: %', n; END IF;
  RESET ROLE;
  SELECT count(*) INTO n FROM public.school_enrollments e WHERE e.academic_year_id = y AND e.opened_on IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'comparacao alterou dado operacional'; END IF;
  SET LOCAL ROLE authenticated;
  ok := ok || 'staging(layout-oficial,parser,rejeicoes=4,idempotente)+comparacao(5-categorias); ';

  -- Escola: só a própria; não vê rede nem grava
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  j := public.census_school_pending(cid, sa);
  IF jsonb_array_length(j->'live_items') <> 1 OR j->'snapshot'->'school'->>'school_id' <> sa OR j::text LIKE '%AG Aluno%' THEN RAISE EXCEPTION 'escola: %', j; END IF;
  BEGIN PERFORM public.census_school_pending(cid, sb); RAISE EXCEPTION 'outra escola';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:not-authorized%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.census_cycles_overview(); RAISE EXCEPTION 'escola leu rede';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:not-authorized%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.census_compare((s2->>'id')::uuid, (imp->>'id')::uuid); RAISE EXCEPTION 'escola comparou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:not-authorized%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.census_take_snapshot(cid, (s2->>'id')::uuid, 'x'); RAISE EXCEPTION 'escola snapshot';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:not-authorized%' THEN RAISE; END IF; END;
  -- Órgão (não pessoa natural) com capacidades não pratica ato
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uq, 'role','authenticated')::text, true);
  BEGIN PERFORM public.census_stage_source(cid, 'x', 'y', 'sigem-agregado-por-escola', 1, repeat('c', 64), '[]'); RAISE EXCEPTION 'orgao';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:natural-person-required%' THEN RAISE; END IF; END;
  BEGIN INSERT INTO public.census_snapshots(cycle_id, version, reference_date, rule_set, content, fingerprint, author_person, author_user)
    VALUES (cid, 9, '2026-09-10', 'x', '{}', repeat('d', 64), uq, uq); RAISE EXCEPTION 'dml';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  BEGIN UPDATE public.census_snapshots SET reason = 'x' WHERE id = (s1->>'id')::uuid; RAISE EXCEPTION 'update dono';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'census:append-only%' THEN RAISE; END IF; END;
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.census_cycles_overview(); RAISE EXCEPTION 'anon';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SET LOCAL ROLE service_role;
  BEGIN PERFORM public.census_advance_stage(cid, seq, 'snapshot', 'x'); RAISE EXCEPTION 'service_role ato';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.census_snapshot_conferences(snapshot_id, fingerprint, person, user_id) VALUES ((s2->>'id')::uuid, 'x', uq, uq); RAISE EXCEPTION 'service_role dml';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  ok := ok || 'acl(escola-propria,outra-escola,rede-negada,orgao,dml,append-only,anon,service_role)';
  RAISE EXCEPTION 'ag-e2e-ok: %', ok;
END $t$;
