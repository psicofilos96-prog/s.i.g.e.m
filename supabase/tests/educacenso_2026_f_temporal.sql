-- Prova 0108/0109 (correção temporal C + Frente F). Dados SINTÉTICOS; termina em RAISE: nada persiste.
DO $$ DECLARE msg text; f text; r text; cc text; ci text; sc text; pl jsonb; op1 uuid; op2 uuid; pexist uuid; n int; vf date;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.technical_import_educacenso_2026_students_enrollments(text,text,jsonb)',
    'public.technical_correct_educacenso_2026_temporal(text,text,jsonb)'] LOOP
    FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF has_function_privilege(r, f, 'EXECUTE') THEN RAISE EXCEPTION 'FAIL privilege % %', r, f; END IF;
    END LOOP;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_table_privilege(r, 'public.student_class_bond_observations', 'INSERT') OR has_table_privilege(r, 'public.school_enrollments', 'INSERT')
       OR has_table_privilege(r, 'public.institutional_student_persons', 'SELECT') OR has_table_privilege(r, 'public.technical_operation_findings', 'SELECT')
       OR has_table_privilege(r, 'public.temporal_stand_in_neutralizations', 'INSERT') THEN RAISE EXCEPTION 'FAIL table privilege %', r; END IF;
  END LOOP;
  -- C: stand-ins neutralizados; contagem de turmas inalterada; readers não devolvem stand-in.
  IF (SELECT count(*) FROM public.institutional_classes) <> 698 THEN RAISE EXCEPTION 'FAIL class count'; END IF;
  SELECT c.id INTO ci FROM public.institutional_classes c JOIN public.class_source_observations o ON o.class_id = c.id LIMIT 1;
  SELECT x.valid_from INTO vf FROM public.class_at(ci, DATE '2026-08-01') x;
  IF NOT FOUND OR vf IS NOT NULL THEN RAISE EXCEPTION 'FAIL class_at stand-in'; END IF;
  IF EXISTS (SELECT 1 FROM public.class_at(ci, DATE '2026-07-30')) THEN RAISE EXCEPTION 'FAIL class_at before observation'; END IF;
  IF public.calendar_year_state_at((SELECT academic_year_id FROM public.institutional_classes WHERE id = ci), DATE '2026-05-01', now()) <> 'ano-letivo-limites-oficiais-nao-informados' THEN RAISE EXCEPTION 'FAIL year state'; END IF;
  IF EXISTS (SELECT 1 FROM public.class_source_observations WHERE known_at::date IN (DATE '2026-08-31', DATE '2026-01-01')) THEN RAISE EXCEPTION 'FAIL known_at'; END IF;
  -- F: nenhuma data inventada; sem autoria humana; sem participação/alocação constituída por inferência.
  IF EXISTS (SELECT 1 FROM public.school_enrollments WHERE technical_operation_id IS NOT NULL AND (opened_on IS NOT NULL OR recorded_by IS NOT NULL)) THEN RAISE EXCEPTION 'FAIL enrollment dates/author'; END IF;
  IF EXISTS (SELECT 1 FROM public.student_class_bond_observations WHERE valid_from IS NOT NULL) THEN RAISE EXCEPTION 'FAIL bond valid_from'; END IF;
  -- Append-only.
  BEGIN UPDATE public.student_class_bond_observations SET stage_literal = 'x' WHERE true; RAISE EXCEPTION 'FAIL append-only';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg LIKE 'FAIL%' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.temporal_stand_in_neutralizations WHERE true; RAISE EXCEPTION 'FAIL append-only n';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg LIKE 'FAIL%' THEN RAISE; END IF; END;
  -- Sintético: pessoa existente recebe papel de aluno sem duplicar pessoa; aluno novo; AEE adicional; multietapa.
  SELECT i.value, c.school_id INTO cc, sc FROM public.institutional_class_identifiers i JOIN public.institutional_classes c ON c.id = i.class_id WHERE i.identifier_kind='educacenso-turma' LIMIT 1;
  INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('Pessoa Sintética A', 'pessoa-natural') RETURNING id INTO pexist;
  INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value) VALUES (pexist, 'inep-pessoa', '900000000001');
  pl := jsonb_build_object('manifest', jsonb_build_object('source_hash', repeat('b',64), 'source_ref','sintetico', 'day_source_hash', repeat('c',64), 'day_source_ref','sintetico',
          'student_count', 2, 'bond_count', 3, 'day_row_count', 2),
        'students', jsonb_build_array(
          jsonb_build_object('inep','900000000001','cpf',NULL,'name','Pessoa Sintética A','rows', jsonb_build_array(
            jsonb_build_object('inep_school', substr(sc,6), 'enrollment_code','S1','class_code',cc,'stage','x','multi_stage','Fase literal','known_at','2026-07-31T10:00:00-03:00','locator','s:1'),
            jsonb_build_object('inep_school', substr(sc,6), 'enrollment_code','S2','class_code',cc,'stage',NULL,'multi_stage',NULL,'known_at','2026-07-31T10:00:00-03:00','locator','s:2'))),
          jsonb_build_object('inep','900000000002','cpf',NULL,'name','Pessoa Sintética A','rows', jsonb_build_array(
            jsonb_build_object('inep_school', substr(sc,6), 'enrollment_code','S3','class_code',cc,'stage',NULL,'multi_stage',NULL,'known_at','2026-07-31T10:00:00-03:00','locator','s:3')))),
        'day_rows', jsonb_build_array(
          jsonb_build_object('inep','900000000001','inep_school',substr(sc,6),'class_code',cc,'link_role','vinculo-adicional','link_kind','Atendimento educacional especializado (AEE)','known_at','2026-08-31T10:00:00-03:00','locator','d:1'),
          jsonb_build_object('inep','999999999999','inep_school',substr(sc,6),'class_code',cc,'link_role','vinculo-na-escola','known_at','2026-08-31T10:00:00-03:00','locator','d:2')));
  n := (SELECT count(*) FROM public.institutional_persons);
  op1 := public.technical_import_educacenso_2026_students_enrollments('technical_import_educacenso_2026_students_enrollments', repeat('b',64), pl);
  IF (SELECT count(*) FROM public.institutional_persons) <> n + 1 THEN RAISE EXCEPTION 'FAIL person reuse / homonym'; END IF;
  IF (SELECT count(*) FROM public.institutional_student_persons WHERE person_id = pexist) <> 1 THEN RAISE EXCEPTION 'FAIL student role'; END IF;
  IF (SELECT count(*) FROM public.student_class_bond_observations WHERE technical_operation_id = op1) <> 3 THEN RAISE EXCEPTION 'FAIL bonds'; END IF;
  IF (SELECT count(DISTINCT enrollment_id) FROM public.student_class_bond_observations WHERE technical_operation_id = op1) <> 2 THEN RAISE EXCEPTION 'FAIL enrollment per school'; END IF;
  IF (SELECT occurrences FROM public.technical_operation_findings WHERE operation_id = op1 AND code = 'jornada-aluno-sem-correspondencia') <> 1 THEN RAISE EXCEPTION 'FAIL day mismatch'; END IF;
  -- Reimportação idempotente; payload diferente com mesmo hash = recusa.
  n := (SELECT count(*) FROM public.student_class_bond_observations);
  op2 := public.technical_import_educacenso_2026_students_enrollments('technical_import_educacenso_2026_students_enrollments', repeat('b',64), pl);
  IF op2 <> op1 OR (SELECT count(*) FROM public.student_class_bond_observations) <> n THEN RAISE EXCEPTION 'FAIL idempotent'; END IF;
  BEGIN PERFORM public.technical_import_educacenso_2026_students_enrollments('technical_import_educacenso_2026_students_enrollments', repeat('b',64), jsonb_set(pl, '{students,0,name}', '"Outro"')); RAISE EXCEPTION 'FAIL differs';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:payload-differs-from-recorded-operation' THEN RAISE EXCEPTION 'FAIL differs %', msg; END IF; END;
  -- ID externo duplicado no lote, turma inexistente/de outra escola, código de matrícula repetido.
  BEGIN PERFORM public.technical_import_educacenso_2026_students_enrollments('technical_import_educacenso_2026_students_enrollments', repeat('d',64),
      jsonb_set(jsonb_set(pl, '{manifest,source_hash}', to_jsonb(repeat('d',64))), '{students,1,inep}', '"900000000001"')); RAISE EXCEPTION 'FAIL dup inep';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:duplicate-person' THEN RAISE EXCEPTION 'FAIL dup inep %', msg; END IF; END;
  BEGIN PERFORM public.technical_import_educacenso_2026_students_enrollments('technical_import_educacenso_2026_students_enrollments', repeat('d',64),
      jsonb_set(jsonb_set(pl, '{manifest,source_hash}', to_jsonb(repeat('d',64))), '{students,1,rows,0,class_code}', '"00000000"')); RAISE EXCEPTION 'FAIL class';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:class-not-found-in-school' THEN RAISE EXCEPTION 'FAIL class %', msg; END IF; END;
  BEGIN PERFORM public.technical_import_educacenso_2026_students_enrollments('technical_import_educacenso_2026_students_enrollments', repeat('d',64),
      jsonb_set(jsonb_set(pl, '{manifest,source_hash}', to_jsonb(repeat('d',64))), '{students,1,rows,0,enrollment_code}', '"S1"')); RAISE EXCEPTION 'FAIL enr code';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:duplicate-enrollment-code' THEN RAISE EXCEPTION 'FAIL enr code %', msg; END IF; END;
  -- Automação desligada ⇒ recusa.
  INSERT INTO public.technical_automation_settings(setting_key, enabled, decided_by, reason) VALUES ('development_automation_enabled', false, 'decisao-do-proprietario', 'prova');
  BEGIN PERFORM public.technical_import_educacenso_2026_students_enrollments('technical_import_educacenso_2026_students_enrollments', repeat('e',64), pl); RAISE EXCEPTION 'FAIL disabled';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'technical:automation-disabled' THEN RAISE EXCEPTION 'FAIL disabled %', msg; END IF; END;
  RAISE EXCEPTION 'OK educacenso_2026_f_temporal (rollback)';
END $$;
