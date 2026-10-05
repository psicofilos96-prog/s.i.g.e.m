-- Frente U.5 (0126) — prova no banco; termina em RAISE (nada persiste). Dados sintéticos.
DO $t$
DECLARE c1 text; c2 text; s text; y text; p uuid; ok boolean; n integer; pos_before integer; pos_after integer;
BEGIN
  SELECT id, school_id, academic_year_id INTO c1, s, y FROM public.institutional_classes ORDER BY id LIMIT 1;
  SELECT id INTO c2 FROM public.institutional_classes WHERE school_id = s AND id <> c1 ORDER BY id LIMIT 1;
  SELECT count(*) INTO pos_before FROM public.allocation_curricular_positions;

  -- Critério fechado: tipo desconhecido, parâmetro extra e "expressão" recusados
  IF public.class_designation_criterion_issue('formula', '{}') <> 'designation:unknown-criterion' THEN RAISE EXCEPTION 'falha: tipo desconhecido'; END IF;
  IF public.class_designation_criterion_issue('ordinal-por-categoria', '{"prefixes":{"ef-5-ano":"5"},"first_ordinal":0,"ordinal_width":2,"sql":"select 1"}') <> 'designation:invalid-params' THEN RAISE EXCEPTION 'falha: parâmetro extra'; END IF;
  IF public.class_designation_criterion_issue('ordinal-por-categoria', '{"prefixes":{"ef-5-ano":"5 || x"},"first_ordinal":0,"ordinal_width":2}') <> 'designation:invalid-params' THEN RAISE EXCEPTION 'falha: expressão'; END IF;
  IF public.class_designation_criterion_issue('ordinal-por-categoria', '{"prefixes":{"ef-5-ano":"5"},"first_ordinal":0,"ordinal_width":2}') IS NOT NULL THEN RAISE EXCEPTION 'falha: critério válido'; END IF;

  -- Rascunho não vigora: nenhuma política aplicável sem homologação
  INSERT INTO public.class_designation_policy_versions(policy_key, version, criterion_type, criterion_params, valid_from, drafted_by, drafted_by_person_id)
  VALUES ('u-teste', 1, 'ordinal-por-categoria', '{"prefixes":{"ef-5-ano":"5"},"first_ordinal":0,"ordinal_width":2}', '2000-01-01', gen_random_uuid(), gen_random_uuid()) RETURNING id INTO p;
  SELECT count(*) INTO n FROM public.applicable_class_designation_policy(CURRENT_DATE) WHERE policy_key = 'u-teste';
  IF n <> 0 THEN RAISE EXCEPTION 'falha: rascunho vigorando'; END IF;
  INSERT INTO public.class_designation_policy_homologations(policy_version_id, homologated_by, homologated_by_person_id, reason) VALUES (p, gen_random_uuid(), gen_random_uuid(), 'sintético');
  SELECT count(*) INTO n FROM public.applicable_class_designation_policy(CURRENT_DATE) WHERE policy_key = 'u-teste';
  IF n <> 1 THEN RAISE EXCEPTION 'falha: homologada não vigora'; END IF;

  -- Append-only
  ok := false; BEGIN UPDATE public.class_designation_policy_versions SET valid_from = '2001-01-01' WHERE id = p; EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'designation:append-only'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: política editável'; END IF;

  -- Reserva: 500 encerrado/abandonado nunca é reutilizado; mesma ordem não duplica
  INSERT INTO public.class_designation_reservations(class_id, class_sequence, school_id, academic_year_id, category_id, ordinal, designation, policy_version_id, reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (c1, 1, s, y, 'ef-5-ano', 0, '500', p, 'sintético', gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
  ok := false; BEGIN
    INSERT INTO public.class_designation_reservations(class_id, class_sequence, school_id, academic_year_id, category_id, ordinal, designation, policy_version_id, reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES (c2, 1, s, y, 'ef-5-ano', 0, '500', p, 'sintético', gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
  EXCEPTION WHEN unique_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: código duplicado'; END IF;
  ok := false; BEGIN DELETE FROM public.class_designation_reservations WHERE class_id = c1; EXCEPTION WHEN raise_exception THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: reserva apagável (reuso)'; END IF;
  IF pg_get_functiondef('public.assign_class_designation(text,integer,text)'::regprocedure) NOT LIKE '%max(r.ordinal) + 1%' THEN RAISE EXCEPTION 'falha: ordinal não monotônico'; END IF;
  IF pg_get_functiondef('public.assign_class_designation(text,integer,text)'::regprocedure) NOT LIKE '%applicable_class_designation_policy%' THEN RAISE EXCEPTION 'falha: writer aceita rascunho'; END IF;

  -- Designação/categoria não criam posição curricular
  SELECT count(*) INTO pos_after FROM public.allocation_curricular_positions;
  IF pos_after <> pos_before THEN RAISE EXCEPTION 'falha: designação criou posição'; END IF;
  IF pg_get_functiondef('public.assign_class_designation(text,integer,text)'::regprocedure) LIKE '%allocation_curricular_position%' THEN RAISE EXCEPTION 'falha: writer toca posição'; END IF;

  -- ACL
  IF has_function_privilege('anon','public.assign_class_designation(text,integer,text)','EXECUTE')
     OR has_function_privilege('service_role','public.assign_class_designation(text,integer,text)','EXECUTE')
     OR has_function_privilege('service_role','public.homologate_class_designation_policy(uuid,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.designation_actor()','EXECUTE')
     OR has_table_privilege('authenticated','public.class_designation_reservations','INSERT')
     THEN RAISE EXCEPTION 'falha: acl'; END IF;

  -- authenticated sem pessoa vinculada é recusado antes de qualquer escrita
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  ok := false; BEGIN PERFORM public.assign_class_designation(c1, 1, 'x'); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'designation:no-person'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: sem pessoa'; END IF;
  ok := false; BEGIN PERFORM public.homologate_class_designation_policy(p, 'x'); EXCEPTION WHEN raise_exception THEN ok := SQLERRM = 'designation:no-person'; END;
  IF NOT ok THEN RAISE EXCEPTION 'falha: homologar sem pessoa'; END IF;
  RESET ROLE;
  RAISE EXCEPTION 'u-designation-tests-ok';
END $t$;
