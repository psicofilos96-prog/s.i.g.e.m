-- LOTE 8, atualizado para SIA.READ.1 (0324): a v1 não tem mais EXECUTE; toda correção passa por
-- record_sia_card_correction_v2 (estado por questão, nota pelos pesos da versão aprovada pela OP).
-- Identidades sintéticas (uuid aleatório, nenhuma pessoa real); a aprovação da OP é evento técnico
-- de um uuid sintético, nunca atribuída a pessoa humana. Termina em RAISE: nada persiste.
DO $$
DECLARE ep record; a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); op uuid := gen_random_uuid(); asg text := 'ta-' || gen_random_uuid();
  v uuid; ev uuid; r uuid; ok int := 0; path text; c record;
  items jsonb := '[{"item_version_id":"x","weight":1},{"item_version_id":"y","weight":1}]';
  lines jsonb := '[{"number":1,"itemVersionId":"x","status":"certa"},{"number":2,"itemVersionId":"y","status":"em-branco"}]';
  bad jsonb := '[{"number":1,"itemVersionId":"x","status":null},{"number":2,"itemVersionId":"y","status":"certa"}]';
  unread jsonb := '[{"number":1,"itemVersionId":"x","status":"nao-lida"},{"number":2,"itemVersionId":"y","status":"certa"}]';
BEGIN
  SELECT e.student_id, e.class_id, e.school_id INTO ep FROM public.class_enrollment_episodes e WHERE e.class_id IS NOT NULL LIMIT 1;
  IF ep.class_id IS NULL THEN RAISE EXCEPTION 'L8_SKIP:no-episode'; END IF;
  INSERT INTO public.teaching_assignments(id, class_id) VALUES (asg, ep.class_id);
  INSERT INTO public.teacher_instrument_versions(instrument_id, version, assignment_id, class_id, school_id, title, items, status, author_user_id)
  VALUES ('tins-lote8', 1, asg, ep.class_id, ep.school_id, 'Prova L8', items, 'publicado', a) RETURNING id INTO v;
  path := a::text || '/cartoes/' || v || '/img';
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_sia_card_correction(v,'',ep.student_id,'qr1',path,repeat('a',64),repeat('b',64),lines,true,NULL,NULL,false); RAISE EXCEPTION 'L8_FAIL:v1-callable';
  EXCEPTION WHEN insufficient_privilege THEN ok := ok + 1; END;
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'',ep.student_id,'qr1',path,repeat('a',64),repeat('b',64),lines,true,NULL,NULL,false); RAISE EXCEPTION 'L8_FAIL:no-op-approval';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%sia:not-approved-by-op%' THEN RAISE; END IF; ok := ok + 1; END;
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.teacher_work_review_events(subject_kind, subject_id, subject_version_id, school_id, seq, event, actor_user_id) VALUES ('instrumento','tins-lote8',v,ep.school_id,1,'enviado',a);
  INSERT INTO public.teacher_work_review_events(subject_kind, subject_id, subject_version_id, school_id, seq, event, actor_user_id) VALUES ('instrumento','tins-lote8',v,ep.school_id,2,'aprovado',op) RETURNING id INTO ev;
  PERFORM set_config('role', 'authenticated', true);
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'',ep.student_id,'qr1',path,repeat('a',64),repeat('b',64),lines,false,NULL,NULL,false); RAISE EXCEPTION 'L8_FAIL:no-human';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%sia:human-review-required%' THEN RAISE; END IF; ok := ok + 1; END;
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'',ep.student_id,'qr1',path,repeat('a',64),repeat('b',64),bad,true,NULL,NULL,false); RAISE EXCEPTION 'L8_FAIL:unresolved';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%sia:unresolved-lines%' THEN RAISE; END IF; ok := ok + 1; END;
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'','st-inexistente','qr1',path,repeat('a',64),repeat('b',64),lines,true,NULL,NULL,false); RAISE EXCEPTION 'L8_FAIL:student';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%sia:student-not-in-class%' THEN RAISE; END IF; ok := ok + 1; END;
  r := public.record_sia_card_correction_v2(v,'B',ep.student_id,'qr1',path,repeat('a',64),repeat('b',64),lines,true,NULL,NULL,false);
  SELECT * INTO c FROM public.sia_card_corrections WHERE id = r;
  IF c.hits <> 1 OR c.total <> 2 OR c.approved_review_event_id <> ev THEN RAISE EXCEPTION 'L8_FAIL:stored %', row_to_json(c); END IF; ok := ok + 1;
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'B',ep.student_id,'qr1',path,repeat('a',64),repeat('b',64),unread,true,r,NULL,false); RAISE EXCEPTION 'L8_FAIL:reason';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%sia:reason-required%' THEN RAISE; END IF; ok := ok + 1; END;
  BEGIN UPDATE public.sia_card_corrections SET hits = 2 WHERE id = r; IF FOUND THEN RAISE EXCEPTION 'L8_FAIL:update'; END IF; EXCEPTION WHEN insufficient_privilege THEN NULL; END; ok := ok + 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM public.sia_card_corrections WHERE instrument_version_id = v) THEN RAISE EXCEPTION 'L8_FAIL:B reads A'; END IF; ok := ok + 1;
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'',ep.student_id,'qr2',b::text||'/x',repeat('a',64),repeat('b',64),lines,true,NULL,NULL,false); RAISE EXCEPTION 'L8_FAIL:B writes';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%sia:only-author-corrects%' THEN RAISE; END IF; ok := ok + 1; END;
  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'',ep.student_id,'qr1',path,repeat('a',64),repeat('b',64),lines,true,NULL,NULL,false); RAISE EXCEPTION 'L8_FAIL:anon';
  EXCEPTION WHEN insufficient_privilege THEN ok := ok + 1; END;
  RAISE EXCEPTION 'L8_PASS %', ok;
END $$;
