-- 0109: Frente F — alunos, matrículas escolares e vínculos declarados no EducaCenso 2026.
-- Pessoa ≠ aluno ≠ matrícula escolar ≠ vínculo de turma observado. Início efetivo não declarado pela fonte:
-- matrícula com opened_on NULL e vínculo de turma como OBSERVAÇÃO (known_at), nunca participação/alocação com data inventada.
-- Executor técnico só pela camada 0100; app roles sem execução nem escrita direta.

CREATE TABLE public.institutional_student_persons (
  student_id text PRIMARY KEY REFERENCES public.institutional_students(id),
  person_id uuid NOT NULL UNIQUE REFERENCES public.institutional_persons(id),
  technical_operation_id uuid REFERENCES public.technical_execution_operations(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.institutional_student_persons IS 'Papel de aluno de uma pessoa (StudentRole). Uma pessoa, no máximo um registro de aluno.';

ALTER TABLE public.school_enrollments ADD COLUMN technical_operation_id uuid REFERENCES public.technical_execution_operations(id);
ALTER TABLE public.school_enrollments ADD CONSTRAINT school_enrollments_author_xor CHECK (NOT (technical_operation_id IS NOT NULL AND recorded_by IS NOT NULL));
COMMENT ON COLUMN public.school_enrollments.opened_on IS 'Início efetivo do vínculo escolar; NULL = não declarado pela fonte (nunca preenchido com snapshot).';

CREATE TABLE public.student_class_bond_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  enrollment_id text NOT NULL REFERENCES public.school_enrollments(id),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  enrollment_code text NOT NULL CHECK (pg_catalog.btrim(enrollment_code) <> ''),
  stage_literal text,
  multi_stage_literal text,
  valid_from date,
  known_at timestamptz NOT NULL,
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  source_ref text NOT NULL,
  source_locator text NOT NULL,
  technical_operation_id uuid NOT NULL REFERENCES public.technical_execution_operations(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_hash, enrollment_code)
);
COMMENT ON TABLE public.student_class_bond_observations IS 'Vínculo aluno × turma declarado pela fonte no snapshot (known_at). Código da matrícula = identificador externo contextual. valid_from NULL = início não declarado. Não é participação/alocação constituída; natureza (curricular/AEE/atividade) vem da declaração da turma.';

CREATE TABLE public.student_school_day_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  link_role text NOT NULL CHECK (link_role IN ('vinculo-na-escola','vinculo-adicional')),
  link_kind_literal text,
  stage_literal text,
  schedule_literal text,
  weekly_load_literal text,
  known_at timestamptz NOT NULL,
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  source_ref text NOT NULL,
  source_locator text NOT NULL,
  technical_operation_id uuid NOT NULL REFERENCES public.technical_execution_operations(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_hash, source_locator, link_role)
);
COMMENT ON TABLE public.student_school_day_observations IS 'Jornada Escolar do ALUNO (EducaCenso): vínculo principal/adicional, turma, dias/horários declarados. Fonte suplementar; não cria aluno, movimento, data de ingresso nem jornada profissional.';

CREATE TABLE public.technical_operation_findings (
  operation_id uuid NOT NULL REFERENCES public.technical_execution_operations(id),
  code text NOT NULL CHECK (code ~ '^[a-z0-9-]{3,60}$'),
  occurrences integer NOT NULL CHECK (occurrences > 0),
  PRIMARY KEY (operation_id, code)
);
COMMENT ON TABLE public.technical_operation_findings IS 'Contagens agregadas de recusas/divergências por operação técnica. Sem PII.';

REVOKE ALL ON public.institutional_student_persons, public.student_class_bond_observations, public.student_school_day_observations, public.technical_operation_findings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.student_class_bond_observations, public.student_school_day_observations TO authenticated;
ALTER TABLE public.institutional_student_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_class_bond_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_school_day_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_operation_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura por capacidade escolar" ON public.student_class_bond_observations FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', school_id));
CREATE POLICY "leitura por capacidade escolar" ON public.student_school_day_observations FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', school_id));
CREATE POLICY "students via observed bond" ON public.institutional_students FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_class_bond_observations o WHERE o.student_id = institutional_students.id
                 AND public.has_school_capability('consultar-matricula-e-movimentacao', o.school_id)));
CREATE TRIGGER institutional_student_persons_immutable BEFORE UPDATE OR DELETE ON public.institutional_student_persons FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER student_class_bond_observations_immutable BEFORE UPDATE OR DELETE ON public.student_class_bond_observations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER student_school_day_observations_immutable BEFORE UPDATE OR DELETE ON public.student_school_day_observations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER technical_operation_findings_immutable BEFORE UPDATE OR DELETE ON public.technical_operation_findings FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.technical_import_educacenso_2026_students_enrollments(_operation_kind text, _source_hash text, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE op uuid; fp text; existing record; p jsonb; r jsonb; pid uuid; pid2 uuid; h text; sid text; eid text; cid text; yid text;
  school text; findings jsonb := '{}'::jsonb; k text;
  m jsonb := _payload->'manifest'; ps jsonb := _payload->'students'; ds jsonb := _payload->'day_rows';
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'technical:automation-disabled'; END IF;
  IF _operation_kind IS DISTINCT FROM 'technical_import_educacenso_2026_students_enrollments' THEN RAISE EXCEPTION 'technical:operation-kind-mismatch'; END IF;
  IF coalesce(_source_hash,'') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'technical:source-hash-invalid'; END IF;
  IF pg_catalog.jsonb_typeof(m) IS DISTINCT FROM 'object' OR pg_catalog.jsonb_typeof(ps) IS DISTINCT FROM 'array' OR pg_catalog.jsonb_typeof(ds) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'technical:payload-shape'; END IF;
  IF m->>'source_hash' IS DISTINCT FROM _source_hash OR coalesce(m->>'day_source_hash','') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'technical:manifest-hash-mismatch'; END IF;
  IF (m->>'student_count')::int IS DISTINCT FROM pg_catalog.jsonb_array_length(ps) THEN RAISE EXCEPTION 'technical:count-students'; END IF;
  IF (m->>'bond_count')::int IS DISTINCT FROM (SELECT sum(pg_catalog.jsonb_array_length(e->'rows')) FROM pg_catalog.jsonb_array_elements(ps) e) THEN RAISE EXCEPTION 'technical:count-rows'; END IF;
  IF (m->>'day_row_count')::int IS DISTINCT FROM pg_catalog.jsonb_array_length(ds) THEN RAISE EXCEPTION 'technical:count-day-rows'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(ps) e WHERE coalesce(e->>'inep','') !~ '^[0-9]{12}$' OR coalesce(pg_catalog.btrim(e->>'name'),'') = ''
             OR (e->>'cpf' IS NOT NULL AND NOT public.technical_cpf_valid(e->>'cpf')) OR pg_catalog.jsonb_array_length(e->'rows') = 0) THEN RAISE EXCEPTION 'technical:person-identity-insufficient'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(ps) e GROUP BY e->>'inep' HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(ps) e WHERE e->>'cpf' IS NOT NULL GROUP BY e->>'cpf' HAVING count(*) > 1) THEN RAISE EXCEPTION 'technical:duplicate-person'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(ps) e, pg_catalog.jsonb_array_elements(e->'rows') x GROUP BY x->>'enrollment_code' HAVING count(*) > 1) THEN RAISE EXCEPTION 'technical:duplicate-enrollment-code'; END IF;
  IF EXISTS (SELECT 1 FROM (SELECT x FROM pg_catalog.jsonb_array_elements(ps) e, pg_catalog.jsonb_array_elements(e->'rows') x
                            UNION ALL SELECT d FROM pg_catalog.jsonb_array_elements(ds) d) z
             WHERE (z.x->>'known_at') IS NULL OR coalesce(z.x->>'locator','') = '' OR NOT EXISTS (
               SELECT 1 FROM public.institutional_class_identifiers ci JOIN public.institutional_classes c ON c.id = ci.class_id
               WHERE ci.identifier_kind = 'educacenso-turma' AND ci.value = z.x->>'class_code' AND c.school_id = 'inep-' || (z.x->>'inep_school')))
    THEN RAISE EXCEPTION 'technical:class-not-found-in-school'; END IF;
  fp := pg_catalog.encode(extensions.digest(_payload::text, 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('technical:' || _operation_kind));
  SELECT * INTO existing FROM public.technical_execution_operations WHERE operation_kind = _operation_kind AND source_hash = _source_hash;
  IF existing.id IS NOT NULL THEN
    IF existing.payload_fingerprint <> fp THEN RAISE EXCEPTION 'technical:payload-differs-from-recorded-operation'; END IF;
    RETURN existing.id;
  END IF;
  op := pg_catalog.gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, _operation_kind, 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento', m->>'source_ref', _source_hash, 'decisao-do-proprietario', fp, 'concluida', m, pg_catalog.clock_timestamp());
  FOR p IN SELECT * FROM pg_catalog.jsonb_array_elements(ps) LOOP
    h := CASE WHEN p->>'cpf' IS NULL THEN NULL ELSE public.technical_cpf_hmac(p->>'cpf') END;
    pid := NULL; pid2 := NULL;
    IF h IS NOT NULL THEN SELECT person_id INTO pid FROM public.institutional_person_identifiers WHERE identifier_kind='cpf-hmac' AND value = h; END IF;
    SELECT person_id INTO pid2 FROM public.institutional_person_identifiers WHERE identifier_kind='inep-pessoa' AND value = p->>'inep';
    IF pid IS NOT NULL AND pid2 IS NOT NULL AND pid <> pid2 THEN
      findings := pg_catalog.jsonb_set(findings, '{identidade-conflitante-no-sigem}', pg_catalog.to_jsonb(coalesce((findings->>'identidade-conflitante-no-sigem')::int,0)+1)); CONTINUE;
    END IF;
    pid := coalesce(pid, pid2);
    IF pid IS NULL THEN
      INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES (pg_catalog.btrim(p->>'name'), 'pessoa-natural') RETURNING id INTO pid;
      INSERT INTO public.technical_execution_targets VALUES (op, 'institutional_persons', pid::text);
    ELSE
      findings := pg_catalog.jsonb_set(findings, '{pessoa-existente-reutilizada}', pg_catalog.to_jsonb(coalesce((findings->>'pessoa-existente-reutilizada')::int,0)+1));
    END IF;
    IF h IS NOT NULL THEN INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value, technical_operation_id) VALUES (pid, 'cpf-hmac', h, op) ON CONFLICT DO NOTHING; END IF;
    INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value, technical_operation_id) VALUES (pid, 'inep-pessoa', p->>'inep', op) ON CONFLICT DO NOTHING;
    sid := NULL;
    SELECT sp.student_id INTO sid FROM public.institutional_student_persons sp WHERE sp.person_id = pid;
    IF sid IS NULL THEN
      sid := 'aluno-' || pg_catalog.gen_random_uuid();
      INSERT INTO public.institutional_students(id, display_name) VALUES (sid, pg_catalog.btrim(p->>'name'));
      INSERT INTO public.institutional_student_persons(student_id, person_id, technical_operation_id) VALUES (sid, pid, op);
      INSERT INTO public.technical_execution_targets VALUES (op, 'institutional_students', sid);
    END IF;
    FOR r IN SELECT * FROM pg_catalog.jsonb_array_elements(p->'rows') LOOP
      school := 'inep-' || (r->>'inep_school'); eid := NULL;
      SELECT ci.class_id, c.academic_year_id INTO cid, yid FROM public.institutional_class_identifiers ci JOIN public.institutional_classes c ON c.id = ci.class_id
        WHERE ci.identifier_kind='educacenso-turma' AND ci.value = r->>'class_code';
      SELECT e.id INTO eid FROM public.school_enrollments e WHERE e.student_id = sid AND e.school_id = school AND e.academic_year_id = yid
        AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id) LIMIT 1;
      IF eid IS NULL THEN
        eid := 'matricula-' || pg_catalog.gen_random_uuid();
        INSERT INTO public.school_enrollments(id, student_id, school_id, opened_on, originating_act_ref, academic_year_id, technical_operation_id)
        VALUES (eid, sid, school, NULL, m->>'source_ref', yid, op);
        INSERT INTO public.technical_execution_targets VALUES (op, 'school_enrollments', eid);
      END IF;
      INSERT INTO public.student_class_bond_observations(student_id, school_id, enrollment_id, class_id, enrollment_code, stage_literal, multi_stage_literal, valid_from, known_at, source_hash, source_ref, source_locator, technical_operation_id)
      VALUES (sid, school, eid, cid, r->>'enrollment_code', r->>'stage', r->>'multi_stage', NULL, (r->>'known_at')::timestamptz, _source_hash, m->>'source_ref', r->>'locator', op);
    END LOOP;
  END LOOP;
  FOR r IN SELECT * FROM pg_catalog.jsonb_array_elements(ds) LOOP
    sid := NULL;
    SELECT sp.student_id INTO sid FROM public.institutional_person_identifiers pi JOIN public.institutional_student_persons sp ON sp.person_id = pi.person_id
      WHERE pi.identifier_kind = 'inep-pessoa' AND pi.value = r->>'inep';
    IF sid IS NULL THEN
      findings := pg_catalog.jsonb_set(findings, '{jornada-aluno-sem-correspondencia}', pg_catalog.to_jsonb(coalesce((findings->>'jornada-aluno-sem-correspondencia')::int,0)+1)); CONTINUE;
    END IF;
    SELECT ci.class_id INTO cid FROM public.institutional_class_identifiers ci WHERE ci.identifier_kind='educacenso-turma' AND ci.value = r->>'class_code';
    INSERT INTO public.student_school_day_observations(student_id, school_id, class_id, link_role, link_kind_literal, stage_literal, schedule_literal, weekly_load_literal, known_at, source_hash, source_ref, source_locator, technical_operation_id)
    VALUES (sid, 'inep-' || (r->>'inep_school'), cid, r->>'link_role', r->>'link_kind', r->>'stage', r->>'schedule', r->>'weekly', (r->>'known_at')::timestamptz, m->>'day_source_hash', m->>'day_source_ref', r->>'locator', op);
  END LOOP;
  FOR k IN SELECT pg_catalog.jsonb_object_keys(findings) LOOP
    INSERT INTO public.technical_operation_findings VALUES (op, k, (findings->>k)::int);
  END LOOP;
  RETURN op;
END $f$;
REVOKE ALL ON FUNCTION public.technical_import_educacenso_2026_students_enrollments(text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
