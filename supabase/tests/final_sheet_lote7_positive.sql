-- LOTE 7 — caminho POSITIVO da Folha Final com identidades sintéticas (sem login humano). Termina em RAISE 'FS7_PASS': nada persiste.
-- Política de capacidades sintética (logical 'teste-fs7') só existe dentro deste bloco.
DO $$
DECLARE s text; s2 text; c text; pol uuid; td date := current_date;
  u uuid[] := ARRAY['00000000-0000-4000-8000-0000000007a1','00000000-0000-4000-8000-0000000007a2','00000000-0000-4000-8000-0000000007b1','00000000-0000-4000-8000-0000000007b2','00000000-0000-4000-8000-0000000007c1']::uuid[];
  kinds text[] := ARRAY['gestao-pedagogica-da-rede','gestao-pedagogica-da-rede','secretaria-escolar','secretaria-escolar','secretaria-escolar'];
  p uuid; i int; r1 uuid; r2 uuid; ok text; snap jsonb; snap_pend jsonb; snap_att jsonb; sha text := repeat('a',64);
BEGIN
  SELECT id INTO s FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.institutional_schools ORDER BY id OFFSET 1 LIMIT 1;
  SELECT id INTO c FROM public.institutional_classes WHERE school_id = s ORDER BY id LIMIT 1;
  INSERT INTO public.capability_policies(logical_policy_id, version, status, valid_from) VALUES ('teste-fs7', 1, 'draft', td - 1) RETURNING id INTO pol;
  INSERT INTO public.capability_policy_rules(policy_id, engagement_kind_id, capability_id) VALUES
    (pol, 'gestao-pedagogica-da-rede', 'manter-regras-de-resultado'), (pol, 'secretaria-escolar', 'registrar-folha-final');
  UPDATE public.capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = 'teste-fs7' WHERE id = pol;
  FOR i IN 1..5 LOOP
    INSERT INTO public.institutional_persons(id, display_name, institutional_identifier, actor_nature) VALUES (gen_random_uuid(), 'FS7 '||i, 'fs7:'||i, 'pessoa-natural') RETURNING id INTO p;
    INSERT INTO public.user_person_links(user_id, person_id) VALUES (u[i], p);
    INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, scope_level, school_id, valid_from, valid_until, originating_act_ref)
      VALUES (p, kinds[i], 'FS7', CASE WHEN i <= 2 THEN 'rede' ELSE 'escola' END, CASE WHEN i IN (3,4) THEN s WHEN i = 5 THEN s2 END, td - 1, td + 1, 'teste-fs7');
  END LOOP;
  PERFORM set_config('role','authenticated',true);
  -- Regra: autor u1 escreve, u1 não homologa, u2 homologa.
  PERFORM set_config('request.jwt.claims', json_build_object('sub',u[1],'role','authenticated')::text, true);
  PERFORM public.record_final_sheet_rule('fs7', 0, 'Fund II', '{"modality":"fundamental-anos-finais","valid_from":"2026-01-01"}', '{"passMark":50,"minAttendance":0.75}', 'teste', 'rascunho');
  BEGIN PERFORM public.record_final_sheet_rule('fs7', 1, 'Fund II', '{"modality":"fundamental-anos-finais","valid_from":"2026-01-01"}', '{"passMark":50,"minAttendance":0.75}', 'teste', 'homologada'); ok := 'x'; EXCEPTION WHEN others THEN ok := SQLERRM; END;
  IF ok <> 'HOMOLOGATION_SAME_AUTHOR' THEN RAISE EXCEPTION 'autor homologou: %', ok; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',u[2],'role','authenticated')::text, true);
  BEGIN PERFORM public.record_final_sheet_rule('fs7', 1, 'Fund II', '{"modality":"fundamental-anos-finais","valid_from":"2026-01-01"}', '{"passMark":60,"minAttendance":0.75}', 'teste', 'homologada'); ok := 'x'; EXCEPTION WHEN others THEN ok := SQLERRM; END;
  IF ok <> 'HOMOLOGATION_MUST_NOT_CHANGE' THEN RAISE EXCEPTION 'homologacao mudou parametro: %', ok; END IF;
  r2 := public.record_final_sheet_rule('fs7', 1, 'Fund II', '{"modality":"fundamental-anos-finais","valid_from":"2026-01-01"}', '{"passMark":50,"minAttendance":0.75}', 'teste', 'homologada');
  -- escola: secretaria A (u3) rascunho+conferencia; u4 homologa
  snap := jsonb_build_object('modality','fundamental-anos-finais','rule',jsonb_build_object('id',r2),'rows',jsonb_build_array(jsonb_build_object('student','x','status','Ativo','overall','APROVADO','components',jsonb_build_array(jsonb_build_object('id','lp','att',0.9)))));
  snap_att := jsonb_set(snap, '{rows,0,components,0,att}', 'null');
  snap_pend := jsonb_set(snap, '{rows,0,overall}', '"PENDENTE"');
  PERFORM set_config('request.jwt.claims', json_build_object('sub',u[5],'role','authenticated')::text, true);
  BEGIN PERFORM public.record_final_sheet_act(c, 0, 'rascunho', r2, snap, sha, null); ok := 'x'; EXCEPTION WHEN others THEN ok := SQLERRM; END;
  IF ok <> 'CAPABILITY_REQUIRED' THEN RAISE EXCEPTION 'escola B gravou na escola A: %', ok; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',u[3],'role','authenticated')::text, true);
  PERFORM public.record_final_sheet_act(c, 0, 'rascunho', r2, snap, sha, null);
  PERFORM public.record_final_sheet_act(c, 1, 'conferencia', r2, snap, sha, null);
  BEGIN PERFORM public.record_final_sheet_act(c, 2, 'homologacao', r2, snap, sha, null); ok := 'x'; EXCEPTION WHEN others THEN ok := SQLERRM; END;
  IF ok <> 'HOMOLOGATION_SAME_ACTOR' THEN RAISE EXCEPTION 'conferente homologou: %', ok; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',u[4],'role','authenticated')::text, true);
  BEGIN PERFORM public.record_final_sheet_act(c, 2, 'homologacao', r2, snap, repeat('b',64), null); ok := 'x'; EXCEPTION WHEN others THEN ok := SQLERRM; END;
  IF ok <> 'SNAPSHOT_CHANGED_SINCE_CONFERENCE' THEN RAISE EXCEPTION 'hash: %', ok; END IF;
  BEGIN PERFORM public.record_final_sheet_act(c, 2, 'homologacao', r2, snap_pend, sha, null); ok := 'x'; EXCEPTION WHEN others THEN ok := SQLERRM; END;
  IF ok <> 'PENDING_ROWS' THEN RAISE EXCEPTION 'pendente: %', ok; END IF;
  BEGIN PERFORM public.record_final_sheet_act(c, 2, 'homologacao', r2, snap_att, sha, null); ok := 'x'; EXCEPTION WHEN others THEN ok := SQLERRM; END;
  IF ok <> 'ATTENDANCE_REQUIRED' THEN RAISE EXCEPTION 'frequencia: %', ok; END IF;
  PERFORM public.record_final_sheet_act(c, 2, 'homologacao', r2, snap, sha, null);
  BEGIN PERFORM public.record_final_sheet_act(c, 3, 'rascunho', r2, snap, sha, null); ok := 'x'; EXCEPTION WHEN others THEN ok := SQLERRM; END;
  IF ok <> 'REOPEN_REQUIRED' THEN RAISE EXCEPTION 'editou homologada: %', ok; END IF;
  BEGIN PERFORM public.record_final_sheet_act(c, 3, 'retificacao', r2, snap, sha, ''); ok := 'x'; EXCEPTION WHEN others THEN ok := SQLERRM; END;
  IF ok <> 'REASON_REQUIRED' THEN RAISE EXCEPTION 'motivo: %', ok; END IF;
  PERFORM public.record_final_sheet_act(c, 3, 'retificacao', r2, snap, sha, 'correção de nota lançada');
  PERFORM public.record_final_sheet_act(c, 4, 'reabertura', r2, snap, sha, 'revisão do conselho');
  PERFORM public.record_final_sheet_act(c, 5, 'rascunho', r2, snap, sha, null);
  IF (SELECT count(*) FROM public.final_sheet_acts WHERE class_id = c) <> 6 THEN RAISE EXCEPTION 'cadeia incompleta'; END IF;
  BEGIN UPDATE public.final_sheet_acts SET reason = 'x' WHERE class_id = c; ok := 'x'; EXCEPTION WHEN others THEN ok := SQLERRM; END;
  IF ok = 'x' THEN RAISE EXCEPTION 'ato alterado'; END IF;
  RAISE EXCEPTION 'FS7_PASS';
END $$;
