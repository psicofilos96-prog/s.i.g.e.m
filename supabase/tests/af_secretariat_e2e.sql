-- Executado em 2026-10-06: af-e2e-ok (todas as etapas), rollback sem resíduos.
-- AF — E2E transacional sintético da Secretaria Escolar. Termina em RAISE: nada persiste.
-- Cadeia: aluno → vínculo anual → turma → documento → reprodução/retificação → transferência → destino → vida escolar.
DO $t$
DECLARE
  us uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); ux uuid := gen_random_uuid(); uq uuid := gen_random_uuid();
  ps uuid; pd uuid; px uuid; pq uuid; sa text; sb text; y text := 'ano-af-e2e-sintetico'; cls text := 'turma-af-e2e'; clsb text := 'turma-af-e2e-b';
  stu text; enr text; enr_b text; ep text; tpl uuid; tplb uuid; e1 jsonb; e2 jsonb; rp jsonb; mv uuid; j jsonb; n int; r record; ok text := '';
  real_enr text; other_stu text;
BEGIN
  SET LOCAL statement_timeout = '50s'; SET LOCAL lock_timeout = '5s';
  SELECT s.id INTO sa FROM public.institutional_schools s ORDER BY s.id LIMIT 1;
  SELECT s.id INTO sb FROM public.institutional_schools s WHERE s.id <> sa ORDER BY s.id LIMIT 1;
  SELECT e.id INTO real_enr FROM public.school_enrollments e WHERE e.school_id = sa ORDER BY e.id LIMIT 1;
  SELECT e.student_id INTO other_stu FROM public.school_enrollments e WHERE e.school_id <> sa ORDER BY e.id LIMIT 1;
  -- contexto sintético (ano operacional, turmas, tipo de movimentação, pessoas)
  INSERT INTO public.institutional_academic_years(id) VALUES (y);
  INSERT INTO public.institutional_academic_year_versions(academic_year_id, version, official_name, starts_on, ends_on, is_active, valid_from, originating_act_ref, technical_operation_id)
    VALUES (y, 1, 'AF Ano Sintético', '2026-08-01', '2026-12-31', true, '2026-08-01', 'af-e2e', (SELECT o.id FROM public.technical_execution_operations o ORDER BY o.id LIMIT 1));
  INSERT INTO public.academic_year_operational_states(academic_year_id, sequence, state, reason, technical_provenance) VALUES (y, 1, 'operacional', 'af-e2e', 'af-e2e');
  INSERT INTO public.institutional_classes(id, school_id, school_label_snapshot, academic_year_id, academic_year_label, name, valid_from)
    VALUES (cls, sa, 'A', y, 'AF', 'AF Turma Sintética', '2026-08-01'), (clsb, sb, 'B', y, 'AF', 'AF Turma B', '2026-08-01');
  INSERT INTO public.movement_type_definitions(id, version, label, status, valid_from) VALUES ('af-e2e-transferencia', 1, 'AF transferência sintética', 'homologada', '2026-01-01');
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AF Secretaria A', 'pessoa-natural') RETURNING id INTO ps;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AF Secretaria B', 'pessoa-natural') RETURNING id INTO pd;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AF Professor', 'pessoa-natural') RETURNING id INTO px;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('AF Órgão sem pessoa', 'orgao-institucional') RETURNING id INTO pq;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (us, ps), (ud, pd), (ux, px), (uq, pq);
  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_af_original;
  EXECUTE format($s$CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT c, '00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, 1, 'escola', %L
        FROM unnest(ARRAY['consultar-matricula-e-movimentacao','manter-matricula-e-enturmacao','registrar-movimentacao-escolar','emitir-documento-escolar','cadastrar-estudante-na-escola']) c
       WHERE auth.uid() IN (%L::uuid, %L::uuid)
      UNION ALL SELECT 'manter-modelo-de-documento-escolar', '00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, 1, 'rede', NULL
       WHERE auth.uid() = %L::uuid
      UNION ALL
      SELECT c, '00000000-0000-0000-0000-0000000000f2'::uuid, '00000000-0000-0000-0000-0000000000f1'::uuid, 1, 'escola', %L
        FROM unnest(ARRAY['consultar-matricula-e-movimentacao','manter-matricula-e-enturmacao']) c WHERE auth.uid() = %L::uuid $b$$s$,
      sa, us, uq, us, sb, ud);
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated';

  -- Secretaria A: aluno → vínculo → turma
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', us, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  stu := public.register_student_for_school(sa, 'AF Aluno Sintético', '52998224725', '');
  enr := public.enroll_student_in_school_year(stu, sa, y, '2026-09-01', NULL);
  BEGIN PERFORM public.secretariat_allocate_to_class(enr, cls, '2026-08-15', NULL); RAISE EXCEPTION 'antes';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'secretariat:before-enrollment%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.secretariat_allocate_to_class(enr, clsb, '2026-09-02', NULL); RAISE EXCEPTION 'turma outra escola';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'secretariat:class-invalid%' THEN RAISE; END IF; END;
  ep := public.secretariat_allocate_to_class(enr, cls, '2026-09-02', NULL);
  BEGIN PERFORM public.secretariat_allocate_to_class(enr, cls, '2026-09-03', NULL); RAISE EXCEPTION 'dupla';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'secretariat:active-class-exists%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.secretariat_allocate_to_class(real_enr, cls, '2026-09-03', NULL); RAISE EXCEPTION '2026 operado';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'secretariat:year-not-open%' THEN RAISE; END IF; END;
  j := public.secretariat_overview_at(sa, y, '2026-09-10');
  IF (j->'enrollments'->>'active')::int <> 1 OR (j->'allocations'->>'active_episodes')::int <> 1 OR j->'year'->>'state' <> 'operacional' THEN RAISE EXCEPTION 'painel: %', j; END IF;
  ok := ok || 'aluno+vinculo+turma+recusas(antes,outra-escola,dupla,2026); painel; ';

  -- Documentos
  tpl := (public.record_school_document_template_version('af-e2e-declaracao', 'declaracao-de-matricula', NULL, 'Declaração sintética',
    '[{"type":"paragraph","text":"{{aluno.nome}} vinculado a {{escola.id}} desde {{matricula.abertura}}, turma {{turma.rotulo}}."}]'::jsonb,
    '{}'::jsonb, NULL, ARRAY['escola.id'], NULL, NULL)->>'id')::uuid;
  tplb := (public.record_school_document_template_version('af-e2e-boletim', 'boletim', NULL, 'Boletim sintético', '[]'::jsonb, '{}'::jsonb, NULL, '{}', NULL, NULL)->>'id')::uuid;
  j := public.school_document_facts(sa, stu, '2026-09-10');
  IF j->>'eligibility' <> 'ok' OR j->'fields'->>'turma.rotulo' <> 'AF Turma Sintética' THEN RAISE EXCEPTION 'fatos: %', j; END IF;
  BEGIN PERFORM public.emit_school_document_v2(tplb, sa, stu, '2026-09-10', NULL, NULL, NULL); RAISE EXCEPTION 'boletim';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'document:not-ready:boletim%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.emit_school_document_v2(tpl, sa, stu, CURRENT_DATE + 30, NULL, NULL, NULL); RAISE EXCEPTION 'futuro';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'document:reference-date-invalid%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.emit_school_document_v2(tpl, sa, stu, '2026-08-20', NULL, NULL, NULL); RAISE EXCEPTION 'nao elegivel';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'document:not-eligible:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.emit_school_document_v2(tpl, sa, other_stu, '2026-09-10', NULL, NULL, NULL); RAISE EXCEPTION 'idor aluno';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'document:emission-not-found%' THEN RAISE; END IF; END;
  e1 := public.emit_school_document_v2(tpl, sa, stu, '2026-09-10', NULL, NULL, NULL);
  SELECT count(*) INTO n FROM public.student_document_emissions(sa, stu) x
   WHERE x.id = (e1->>'id')::uuid AND x.snapshot->'fields'->>'turma.rotulo' = 'AF Turma Sintética' AND jsonb_array_length(x.snapshot->'sources') >= 3
     AND x.snapshot_sha256 = e1->>'snapshot_sha256';
  IF n <> 1 THEN RAISE EXCEPTION 'snapshot/fontes'; END IF;
  rp := public.emit_school_document_v2(NULL, sa, stu, NULL, (e1->>'id')::uuid, NULL, NULL);
  IF rp->>'snapshot_sha256' <> e1->>'snapshot_sha256' THEN RAISE EXCEPTION 'reproducao divergiu'; END IF;
  BEGIN PERFORM public.emit_school_document_v2(tpl, sa, stu, '2026-09-11', NULL, (e1->>'id')::uuid, NULL); RAISE EXCEPTION 'retif sem motivo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'correction-reason-required%' THEN RAISE; END IF; END;
  e2 := public.emit_school_document_v2(tpl, sa, stu, '2026-09-11', NULL, (e1->>'id')::uuid, 'Retificação sintética');
  BEGIN PERFORM public.emit_school_document_v2(tpl, sa, stu, '2026-09-11', NULL, (e1->>'id')::uuid, 'de novo'); RAISE EXCEPTION 'retif stale';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'base-superseded%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.emit_school_document_v2(NULL, sa, stu, NULL, (e1->>'id')::uuid, NULL, NULL); RAISE EXCEPTION 'reproduz retificado';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'document:emission-not-active%' THEN RAISE; END IF; END;
  ok := ok || 'documento(fatos-no-banco,emissao,reproducao=sha,retificacao,stale,boletim-not-ready,futuro,nao-elegivel,idor-aluno); ';

  -- Transferência: origem encerrada, destino constituído pela outra secretaria
  BEGIN PERFORM public.secretariat_record_exit(enr, '2026-09-20', 'tipo-inexistente', 1, sb, 'x'); RAISE EXCEPTION 'tipo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'movement:type-not-current%' THEN RAISE; END IF; END;
  mv := public.secretariat_record_exit(enr, '2026-09-20', 'af-e2e-transferencia', 1, sb, 'Transferência sintética');
  BEGIN PERFORM public.secretariat_record_exit(enr, '2026-09-21', 'af-e2e-transferencia', 1, sb, 'de novo'); RAISE EXCEPTION 'saida dupla';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'base-superseded%' THEN RAISE; END IF; END;
  SELECT count(*) INTO n FROM public.student_document_emissions(sa, stu) x WHERE x.id = (e2->>'id')::uuid AND x.snapshot->'fields'->>'turma.rotulo' = 'AF Turma Sintética';
  IF n <> 1 THEN RAISE EXCEPTION 'emissao recalculada'; END IF;
  BEGIN PERFORM public.emit_school_document_v2(tpl, sa, stu, '2026-09-25', NULL, NULL, NULL); RAISE EXCEPTION 'apos saida';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'document:not-eligible:%' THEN RAISE; END IF; END;
  IF (public.school_document_facts(sa, stu, '2026-09-10')->>'eligibility') <> 'ok' THEN RAISE EXCEPTION 'historia perdida'; END IF;
  SELECT count(DISTINCT kind) INTO n FROM public.student_school_life(sa, stu) WHERE kind IN ('identidade','vinculo-anual','turma','saida-turma','encerramento-vinculo','movimentacao');
  IF n <> 6 THEN RAISE EXCEPTION 'timeline A: %', n; END IF;
  BEGIN PERFORM public.student_school_life(sa, 'inexistente-af'); RAISE EXCEPTION 'inexistente';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'secretariat:not-found%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.student_school_life(sa, other_stu); RAISE EXCEPTION 'idor timeline';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'secretariat:not-found%' THEN RAISE; END IF; END;
  ok := ok || 'transferencia(origem-encerrada,tipo,dupla,emissao-imutavel,nao-elegivel-apos,historia-preservada,timeline=6,idor); ';

  -- Secretaria B: constitui destino; não vê nem opera a escola A
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ud, 'role','authenticated')::text, true);
  enr_b := public.enroll_student_in_school_year(stu, sb, y, '2026-09-21', NULL);
  IF enr_b = enr THEN RAISE EXCEPTION 'destino reutilizou origem'; END IF;
  SELECT count(*) INTO n FROM public.student_school_life(sb, stu) WHERE kind = 'movimentacao' AND detail->>'origem' = sa;
  IF n <> 1 THEN RAISE EXCEPTION 'destino sem origem'; END IF;
  SELECT count(*) INTO n FROM public.student_school_life(sb, stu) WHERE kind IN ('turma','vinculo-anual') AND school_id = sa;
  IF n <> 0 THEN RAISE EXCEPTION 'destino viu detalhes da origem'; END IF;
  BEGIN PERFORM public.student_school_life(sa, stu); RAISE EXCEPTION 'B leu A';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'secretariat:not-found%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.secretariat_overview_at(sa, y, '2026-09-10'); RAISE EXCEPTION 'B painel A';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'secretariat:not-authorized%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.emit_school_document_v2(tpl, sa, stu, '2026-09-10', NULL, NULL, NULL); RAISE EXCEPTION 'B emitiu A';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.student_document_emissions(sa, stu); RAISE EXCEPTION 'B leu docs A';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  ok := ok || 'destino(nova-matricula,origem-visivel-so-pela-movimentacao,outra-escola-negada); ';

  -- Professor/família sem poderes administrativos; conta técnica não é autora
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ux, 'role','authenticated')::text, true);
  BEGIN PERFORM public.secretariat_overview_at(sa, y, '2026-09-10'); RAISE EXCEPTION 'prof painel';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'secretariat:not-authorized%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.emit_school_document_v2(tpl, sa, stu, '2026-09-10', NULL, NULL, NULL); RAISE EXCEPTION 'prof emitiu';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.secretariat_end_class_episode(ep, '2026-09-30', 'x'); RAISE EXCEPTION 'prof encerrou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'secretariat:not-found%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uq, 'role','authenticated')::text, true);
  BEGIN PERFORM public.emit_school_document_v2(tpl, sa, stu, '2026-09-10', NULL, NULL, NULL); RAISE EXCEPTION 'tecnica emitiu';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'secretariat:natural-person-required%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.emit_school_document(tpl, sa, stu, '{}'::jsonb, '{"fields":{}}'::jsonb, NULL, NULL, NULL); RAISE EXCEPTION 'v1';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.school_document_emissions(verification_code, emission_kind, template_version_id, document_kind, school_id, student_id, snapshot, snapshot_sha256, emitted_by, emitted_by_engagement)
    VALUES ('X', 'original', tpl, 'x', sa, stu, '{}', 'x', uq, uq); RAISE EXCEPTION 'dml';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.secretariat_overview_at(sa, y, '2026-09-10'); RAISE EXCEPTION 'anon';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SET LOCAL ROLE service_role;
  BEGIN PERFORM public.emit_school_document_v2(tpl, sa, stu, '2026-09-10', NULL, NULL, NULL); RAISE EXCEPTION 'service_role';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.secretariat_record_exit(enr_b, '2026-09-30', 'af-e2e-transferencia', 1, NULL, 'x'); RAISE EXCEPTION 'service_role saida';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.school_document_emissions SET snapshot_sha256 = 'x' WHERE id = (e1->>'id')::uuid; RAISE EXCEPTION 'service_role dml documento';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  ok := ok || 'professor/tecnica/v1/dml/anon/service_role negados';
  RAISE EXCEPTION 'af-e2e-ok: %', ok;
END $t$;
