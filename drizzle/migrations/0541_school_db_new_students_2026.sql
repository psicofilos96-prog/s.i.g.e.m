CREATE OR REPLACE FUNCTION public.technical_import_school_db_new_students_2026(_source_hash text, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE op uuid; fp text; ex record; p jsonb; pid uuid; sid text; eid text; n int := 0; skipped int := 0;
  kind constant text := 'technical_import_school_db_new_students_2026';
  yid constant text := 'ano-431ece00-be5c-41ed-a430-75ba853b0831';
BEGIN
  IF coalesce(_source_hash,'') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'technical:source-hash-invalid'; END IF;
  IF pg_catalog.jsonb_typeof(_payload->'students') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'technical:payload-shape'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(_payload->'students') e
             WHERE coalesce(pg_catalog.btrim(e->>'name'),'') = '' OR (e->>'birth') IS NULL
                OR NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = e->>'school')
                OR (e->>'inep' IS NOT NULL AND e->>'inep' !~ '^[0-9]{12}$')) THEN RAISE EXCEPTION 'technical:person-identity-insufficient'; END IF;
  fp := pg_catalog.encode(extensions.digest(_payload::text, 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('technical:' || kind));
  SELECT * INTO ex FROM public.technical_execution_operations WHERE operation_kind = kind AND source_hash = _source_hash;
  IF ex.id IS NOT NULL THEN
    IF ex.payload_fingerprint <> fp THEN RAISE EXCEPTION 'technical:payload-differs-from-recorded-operation'; END IF;
    RETURN ex.id;
  END IF;
  op := pg_catalog.gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, kind, 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento', 'planilhas Banco de dados das escolas 2026', _source_hash, 'decisao-do-proprietario', fp, 'concluida', pg_catalog.jsonb_build_object('count', pg_catalog.jsonb_array_length(_payload->'students')), pg_catalog.clock_timestamp());
  FOR p IN SELECT * FROM pg_catalog.jsonb_array_elements(_payload->'students') LOOP
    -- nunca duplica: mesmo nome exato + mesmo nascimento já observado, ou INEP já existente ⇒ pula
    IF (p->>'inep' IS NOT NULL AND EXISTS (SELECT 1 FROM public.institutional_person_identifiers WHERE identifier_kind='inep-pessoa' AND value = p->>'inep'))
       OR EXISTS (SELECT 1 FROM public.student_registration_observations o WHERE pg_catalog.upper(o.civil_name) = pg_catalog.upper(p->>'name') AND o.birth_date = (p->>'birth')::date)
    THEN skipped := skipped + 1; CONTINUE; END IF;
    INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES (pg_catalog.btrim(p->>'name'), 'pessoa-natural') RETURNING id INTO pid;
    INSERT INTO public.technical_execution_targets VALUES (op, 'institutional_persons', pid::text);
    IF p->>'inep' IS NOT NULL THEN
      INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value, technical_operation_id) VALUES (pid, 'inep-pessoa', p->>'inep', op);
    END IF;
    sid := 'aluno-' || pg_catalog.gen_random_uuid();
    INSERT INTO public.institutional_students(id, display_name) VALUES (sid, pg_catalog.btrim(p->>'name'));
    INSERT INTO public.institutional_student_persons(student_id, person_id, technical_operation_id) VALUES (sid, pid, op);
    INSERT INTO public.technical_execution_targets VALUES (op, 'institutional_students', sid);
    eid := 'matricula-' || pg_catalog.gen_random_uuid();
    INSERT INTO public.school_enrollments(id, student_id, school_id, opened_on, originating_act_ref, academic_year_id, technical_operation_id)
    VALUES (eid, sid, p->>'school', NULL, 'planilha Banco de dados da escola 2026', yid, op);
    INSERT INTO public.technical_execution_targets VALUES (op, 'school_enrollments', eid);
    INSERT INTO public.student_registration_observations(student_id, source_file, source_sha256, source_sheet, source_row, matched_by, executor_label, civil_name, birth_date, sex_literal, race_literal, nee_literal, father_name, mother_name, birthplace, birthplace_uf, nationality, guardian_name, guardian_occupation, phones, enrollment_status_literal, class_literal, grade_literal)
    VALUES (sid, p->>'file', p->>'sha', 'ALUNOS', (p->>'row')::int, 'novo-cadastro-planilha-escola', 'importacao-tecnica:school-db-new-students', p->>'name', (p->>'birth')::date, p->>'sex', p->>'race', p->>'nee', p->>'father', p->>'mother', p->>'birthplace', p->>'birthplace_uf', p->>'nationality', p->>'guardian', p->>'guardian_occupation', coalesce(ARRAY(SELECT pg_catalog.jsonb_array_elements_text(p->'phones')), '{}'::text[]), p->>'status', p->>'class', p->>'grade')
    ON CONFLICT DO NOTHING;
    n := n + 1;
  END LOOP;
  INSERT INTO public.technical_operation_findings VALUES (op, 'aluno-criado', n);
  IF skipped > 0 THEN INSERT INTO public.technical_operation_findings VALUES (op, 'ja-existente-pulado', skipped); END IF;
  RETURN op;
END $f$;
REVOKE ALL ON FUNCTION public.technical_import_school_db_new_students_2026(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;