-- ACCEPT.1 — aceitação cruzada (camada banco, JWT simulado). Termina em RAISE: nada persiste.
-- SIPE: A compartilha com colega B da mesma escola; C (outra escola) recusado; B lê e registra cópia; revogação tira o acesso.
-- SIA v2: sem envio/aprovação da OP recusa; leitura não lida não gera nota nem Diário; peso ausente bloqueia Diário;
-- pontuação pelos pesos da versão; só o autor corrige; B não lê correção de A; anon recusado.
-- A "aprovação da OP" aqui é dublê transacional desfeito pelo RAISE — não é homologação nem ato humano real.
DO $t$
DECLARE ok text := ''; e text; a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); op uuid := gen_random_uuid();
  cls record; stu text; sB text; pa text := 'pes-acc-a-'||gen_random_uuid(); pb text := 'pes-acc-b-'||gen_random_uuid(); pc text := 'pes-acc-c-'||gen_random_uuid();
  asg text := 'ta-acc-'||gen_random_uuid(); plan text := 'plan-acc-'||gen_random_uuid(); copyp text := 'plan-acc-copy-'||gen_random_uuid();
  pv uuid; v uuid; r uuid; n int; img text;
  items jsonb := '[{"item_version_id":"i1","weight":2},{"item_version_id":"i2","weight":3},{"item_version_id":"i3"}]';
BEGIN
  SELECT x.id, x.school_id INTO cls FROM public.institutional_classes x WHERE EXISTS (SELECT 1 FROM public.class_enrollment_episodes ep WHERE ep.class_id = x.id) LIMIT 1;
  SELECT ep.student_id INTO stu FROM public.class_enrollment_episodes ep WHERE ep.class_id = cls.id LIMIT 1;
  SELECT s.id INTO sB FROM public.institutional_schools s WHERE s.id <> cls.school_id LIMIT 1;
  INSERT INTO public.institutional_persons(id, display_name) VALUES (pa,'Docente A (teste)'),(pb,'Docente B (teste)'),(pc,'Docente C (teste)');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (a,pa),(b,pb),(c,pc);
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, school_id, valid_from, scope_level) VALUES
    (pa,'professor',cls.school_id,CURRENT_DATE-1,'escola'),(pb,'professor',cls.school_id,CURRENT_DATE-1,'escola'),(pc,'professor',sB,CURRENT_DATE-1,'escola');
  INSERT INTO public.teaching_assignments(id, class_id) VALUES (asg, cls.id);
  INSERT INTO public.teaching_plan_versions(plan_id, version, assignment_id, assignment_version_id, matrix_version_id, class_id, school_id, title, blocks, curricular_refs, status, author_user_id, author_engagement_id)
    VALUES (plan, 1, asg, 'asv-acc', 'mv-acc', cls.id, cls.school_id, 'Plano semanal (teste)', '[]', '[]', 'publicado', a, 'eng-acc') RETURNING id INTO pv;

  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  BEGIN PERFORM public.share_teaching_plan(plan, c, false); RAISE EXCEPTION 'ACC_FAIL:share-other-school';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%recipient-not-colleague%' THEN RAISE; END IF; ok := ok||' sipe-outra-escola-recusada'; END;
  PERFORM public.share_teaching_plan(plan, b, false); ok := ok||' sipe-compartilhado';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.teaching_plans_shared_with_me() s WHERE s.id = pv; IF n <> 1 THEN RAISE EXCEPTION 'ACC_FAIL:B-nao-le'; END IF; ok := ok||' sipe-B-le';
  BEGIN PERFORM public.share_teaching_plan(plan, c, false); RAISE EXCEPTION 'ACC_FAIL:B-reshare';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%only-author-shares%' THEN RAISE; END IF; ok := ok||' sipe-B-nao-recompartilha'; END;
  PERFORM set_config('role','postgres',true);
  INSERT INTO public.teaching_plan_versions(plan_id, version, assignment_id, assignment_version_id, matrix_version_id, class_id, school_id, title, blocks, curricular_refs, status, author_user_id, author_engagement_id)
    VALUES (copyp, 1, asg, 'asv-acc', 'mv-acc', cls.id, cls.school_id, 'Cópia adaptada (teste)', '[]', '[]', 'rascunho', b, 'eng-acc-b');
  PERFORM set_config('role','authenticated',true);
  PERFORM public.record_shared_plan_copy(copyp, pv); ok := ok||' sipe-copia-registrada';
  IF (SELECT title FROM public.teaching_plan_versions WHERE id = pv) <> 'Plano semanal (teste)' THEN RAISE EXCEPTION 'ACC_FAIL:original-mudou'; END IF; ok := ok||' sipe-original-intacto';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',c,'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.teaching_plans_shared_with_me(); IF n <> 0 THEN RAISE EXCEPTION 'ACC_FAIL:C-le'; END IF; ok := ok||' sipe-C-nao-le';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  PERFORM public.share_teaching_plan(plan, b, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.teaching_plans_shared_with_me(); IF n <> 0 THEN RAISE EXCEPTION 'ACC_FAIL:revogado-ainda-le'; END IF; ok := ok||' sipe-revogado';

  -- SIA v2
  PERFORM set_config('role','postgres',true);
  INSERT INTO public.teacher_instrument_versions(instrument_id, version, assignment_id, class_id, school_id, title, items, status, author_user_id)
    VALUES ('tins-acc', 1, asg, cls.id, cls.school_id, 'AV1 (teste)', items, 'publicado', a) RETURNING id INTO v;
  img := a::text||'/cartoes/'||v||'/img';
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'A',stu,'sia1:x:A',img,repeat('a',64),repeat('b',64),
      '[{"itemVersionId":"i1","status":"certa"},{"itemVersionId":"i2","status":"errada"},{"itemVersionId":"i3","status":"anulada"}]',true,NULL,NULL,false);
    RAISE EXCEPTION 'ACC_FAIL:sem-op';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%not-approved-by-op%' THEN RAISE; END IF; ok := ok||' sia-sem-OP-recusa'; END;
  PERFORM set_config('role','postgres',true);
  INSERT INTO public.teacher_work_review_events(subject_kind, subject_id, subject_version_id, school_id, seq, event, actor_user_id) VALUES ('instrumento','tins-acc',v,cls.school_id,1,'enviado',a);
  INSERT INTO public.teacher_work_review_events(subject_kind, subject_id, subject_version_id, school_id, seq, event, actor_user_id) VALUES ('instrumento','tins-acc',v,cls.school_id,2,'aprovado',op);
  PERFORM set_config('role','authenticated',true);
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'A',stu,'sia1:x:A',img,repeat('a',64),repeat('b',64),
      '[{"itemVersionId":"i1","status":"certa"},{"itemVersionId":"i2","status":"errada"},{"itemVersionId":"i3","status":"anulada"}]',false,NULL,NULL,false);
    RAISE EXCEPTION 'ACC_FAIL:sem-conferencia';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%human-review-required%' THEN RAISE; END IF; ok := ok||' sia-sem-conferencia-recusa'; END;
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'A',stu,'sia1:x:A',img,repeat('a',64),repeat('b',64),
      '[{"itemVersionId":"i1","status":"certa"},{"itemVersionId":"i2","status":"nao-lida"},{"itemVersionId":"i3","status":"anulada"}]',true,NULL,NULL,true);
    RAISE EXCEPTION 'ACC_FAIL:nao-lida-diario';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%unread-blocks-diary%' THEN RAISE; END IF; ok := ok||' sia-nao-lida-bloqueia-diario'; END;
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'A',stu,'sia1:x:A',img,repeat('a',64),repeat('b',64),
      '[{"itemVersionId":"i1","status":"certa"},{"itemVersionId":"i2","status":"errada"},{"itemVersionId":"i3","status":"certa"}]',true,NULL,NULL,true);
    RAISE EXCEPTION 'ACC_FAIL:peso-ausente';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%weights-incomplete%' THEN RAISE; END IF; ok := ok||' sia-peso-ausente-bloqueia'; END;
  r := public.record_sia_card_correction_v2(v,'A',stu,'sia1:x:A',img,repeat('a',64),repeat('b',64),
      '[{"itemVersionId":"i1","status":"certa"},{"itemVersionId":"i2","status":"pontuada","points":1.5},{"itemVersionId":"i3","status":"anulada"}]',true,NULL,NULL,false);
  IF (SELECT score FROM public.sia_card_corrections WHERE id = r) <> 3.5 OR (SELECT max_score FROM public.sia_card_corrections WHERE id = r) <> 5 THEN RAISE EXCEPTION 'ACC_FAIL:nota'; END IF;
  ok := ok||' sia-nota-3.5/5';
  r := public.record_sia_card_correction_v2(v,'A',stu,'sia1:x:A',img,repeat('a',64),repeat('b',64),
      '[{"itemVersionId":"i1","status":"certa"},{"itemVersionId":"i2","status":"nao-lida"},{"itemVersionId":"i3","status":"anulada"}]',true,r,'Releitura',false);
  IF (SELECT score FROM public.sia_card_corrections WHERE id = r) IS NOT NULL THEN RAISE EXCEPTION 'ACC_FAIL:nao-lida-virou-nota'; END IF; ok := ok||' sia-nao-lida-sem-nota';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM public.sia_card_corrections WHERE instrument_version_id = v) THEN RAISE EXCEPTION 'ACC_FAIL:B-le-correcao'; END IF; ok := ok||' sia-B-nao-le';
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'A',stu,'q',b::text||'/x',repeat('a',64),repeat('b',64),'[{"itemVersionId":"i1","status":"certa"}]',true,r,'x',false); RAISE EXCEPTION 'ACC_FAIL:B-corrige';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%only-author-corrects%' THEN RAISE; END IF; ok := ok||' sia-B-nao-corrige'; END;
  PERFORM set_config('role','anon',true);
  BEGIN PERFORM public.record_sia_card_correction_v2(v,'A',stu,'q',img,repeat('a',64),repeat('b',64),'[]',true,NULL,NULL,false); RAISE EXCEPTION 'ACC_FAIL:anon';
  EXCEPTION WHEN insufficient_privilege THEN ok := ok||' anon-recusado'; END;
  RAISE EXCEPTION 'ACC_PASS%', ok;
END $t$;
