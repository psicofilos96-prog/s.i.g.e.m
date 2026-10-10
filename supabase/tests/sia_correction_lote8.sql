-- LOTE 8: correção SIA só grava com revisão humana, versão aprovada pela OP e autor; anon não grava. Termina em RAISE (nada persiste).
DO $$
DECLARE cls record; a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); op uuid := gen_random_uuid(); asg text := 'ta-' || gen_random_uuid();
  v uuid; ev uuid; r uuid; lines jsonb := '[{"number":1,"itemVersionId":"x","answered":"A","correct":true},{"number":2,"itemVersionId":"y","answered":null,"correct":false}]';
  bad jsonb := '[{"number":1,"itemVersionId":"x","answered":null,"correct":null}]'; ok int := 0;
  path text; c record;
BEGIN
  SELECT id, school_id INTO cls FROM public.institutional_classes LIMIT 1;
  INSERT INTO public.teaching_assignments(id, class_id) VALUES (asg, cls.id); -- sintético, desfeito com o RAISE
  INSERT INTO public.teacher_instrument_versions(instrument_id, version, assignment_id, class_id, school_id, title, items, status, author_user_id)
  VALUES ('tins-lote8', 1, asg, cls.id, cls.school_id, 'Prova L8', '[]', 'publicado', a) RETURNING id INTO v;
  path := a::text || '/cartoes/' || v || '/img';
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.record_sia_card_correction(v,'','st1','qr1',path,repeat('a',64),repeat('b',64),lines,true,NULL,NULL,false); RAISE EXCEPTION 'L8_FAIL:no-op-approval';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%sia:not-approved-by-op%' THEN RAISE; END IF; ok := ok + 1; END;
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.teacher_work_review_events(subject_kind, subject_id, subject_version_id, school_id, seq, event, actor_user_id) VALUES ('instrumento','tins-lote8',v,cls.school_id,1,'enviado',a);
  INSERT INTO public.teacher_work_review_events(subject_kind, subject_id, subject_version_id, school_id, seq, event, actor_user_id) VALUES ('instrumento','tins-lote8',v,cls.school_id,2,'aprovado',op) RETURNING id INTO ev;
  PERFORM set_config('role', 'authenticated', true);
  BEGIN PERFORM public.record_sia_card_correction(v,'','st1','qr1',path,repeat('a',64),repeat('b',64),lines,false,NULL,NULL,false); RAISE EXCEPTION 'L8_FAIL:no-human';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%sia:human-review-required%' THEN RAISE; END IF; ok := ok + 1; END;
  BEGIN PERFORM public.record_sia_card_correction(v,'','st1','qr1',path,repeat('a',64),repeat('b',64),bad,true,NULL,NULL,false); RAISE EXCEPTION 'L8_FAIL:unresolved';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%sia:unresolved-lines%' THEN RAISE; END IF; ok := ok + 1; END;
  BEGIN PERFORM public.record_sia_card_correction(v,'','st1','qr1',path,repeat('a',64),repeat('b',64),lines,true,NULL,NULL,true); RAISE EXCEPTION 'L8_FAIL:diary-unlinked';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%sia:no-diary-instrument%' THEN RAISE; END IF; ok := ok + 1; END;
  r := public.record_sia_card_correction(v,'B','st1','qr1',path,repeat('a',64),repeat('b',64),lines,true,NULL,NULL,false);
  SELECT * INTO c FROM public.sia_card_corrections WHERE id = r;
  IF c.hits <> 1 OR c.total <> 2 OR c.approved_review_event_id <> ev THEN RAISE EXCEPTION 'L8_FAIL:stored %', row_to_json(c); END IF; ok := ok + 1;
  BEGIN PERFORM public.record_sia_card_correction(v,'B','st1','qr1',path,repeat('a',64),repeat('b',64),lines,true,r,NULL,false); RAISE EXCEPTION 'L8_FAIL:reason';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%sia:reason-required%' THEN RAISE; END IF; ok := ok + 1; END;
  PERFORM public.record_sia_card_correction(v,'B','st1','qr1',path,repeat('a',64),repeat('b',64),lines,true,r,'Revisão da questão 2',false); ok := ok + 1;
  BEGIN UPDATE public.sia_card_corrections SET hits = 2 WHERE id = r; IF FOUND THEN RAISE EXCEPTION 'L8_FAIL:update'; END IF; EXCEPTION WHEN insufficient_privilege THEN NULL; END; ok := ok + 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM public.sia_card_corrections WHERE instrument_version_id = v) THEN RAISE EXCEPTION 'L8_FAIL:B reads A'; END IF; ok := ok + 1;
  BEGIN PERFORM public.record_sia_card_correction(v,'','st2','qr2',b::text||'/x',repeat('a',64),repeat('b',64),lines,true,NULL,NULL,false); RAISE EXCEPTION 'L8_FAIL:B writes';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%sia:only-author-corrects%' THEN RAISE; END IF; ok := ok + 1; END;
  BEGIN PERFORM public.record_op_permanent_board_version('Fund I',NULL,'t','[{"heading":"a","body":"b"}]',NULL); RAISE EXCEPTION 'L8_FAIL:board';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%board:capability-missing%' THEN RAISE; END IF; ok := ok + 1; END;
  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.record_sia_card_correction(v,'','st1','qr1',path,repeat('a',64),repeat('b',64),lines,true,NULL,NULL,false); RAISE EXCEPTION 'L8_FAIL:anon';
  EXCEPTION WHEN insufficient_privilege THEN ok := ok + 1; END;
  RAISE EXCEPTION 'L8_PASS %', ok;
END $$;
