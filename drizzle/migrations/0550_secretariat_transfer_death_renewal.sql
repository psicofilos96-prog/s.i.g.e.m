-- Tipo de movimentação "Falecimento" (decisão do proprietário); só é usável junto do registro de óbito.
INSERT INTO public.movement_type_definitions(id, version, label, status, homologation_act_ref, valid_from)
VALUES ('falecimento', 1, 'Falecimento (Falecido)', 'homologada', 'decisao-proprietario-sigem:2026-10-17', '2026-01-01')
ON CONFLICT DO NOTHING;

INSERT INTO public.sector_parameter_catalog(key, sector, capability_id, value_kind, allowed, default_value)
VALUES ('secretaria.validade-declaracao-transferencia', 'secretaria', 'manter-matricula-e-enturmacao', 'dias', NULL, '30'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ÓBITO -------------------------------------------------------------------
CREATE TABLE public.student_death_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL UNIQUE REFERENCES public.institutional_students(id),
  enrollment_id text NOT NULL REFERENCES public.school_enrollments(id),
  school_id text NOT NULL,
  certificate_number text NOT NULL CHECK (btrim(certificate_number) <> ''),
  died_on date NOT NULL,
  note text,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  recorded_by_principal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.student_death_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  death_id uuid NOT NULL REFERENCES public.student_death_records(id),
  certificate_number text NOT NULL CHECK (btrim(certificate_number) <> ''),
  died_on date NOT NULL,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.student_death_records, public.student_death_corrections TO authenticated;
GRANT ALL ON public.student_death_records, public.student_death_corrections TO service_role;
ALTER TABLE public.student_death_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_death_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "death readable by school or network" ON public.student_death_records FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', school_id) OR public.has_network_capability('consultar-matricula-e-movimentacao'));
CREATE POLICY "death corrections readable" ON public.student_death_corrections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_death_records d WHERE d.id = death_id AND (public.has_school_capability('consultar-matricula-e-movimentacao', d.school_id) OR public.has_network_capability('consultar-matricula-e-movimentacao'))));
CREATE TRIGGER death_records_immutable BEFORE UPDATE OR DELETE ON public.student_death_records FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER death_corrections_immutable BEFORE UPDATE OR DELETE ON public.student_death_corrections FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.student_is_deceased(_student text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.student_death_records d WHERE d.student_id = _student)
$$;
REVOKE EXECUTE ON FUNCTION public.student_is_deceased(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_is_deceased(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.forbid_deceased_student() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.student_death_records d WHERE d.student_id = NEW.student_id) THEN
    RAISE EXCEPTION 'student:deceased';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER deceased_blocks_enrollment BEFORE INSERT ON public.school_enrollments FOR EACH ROW EXECUTE FUNCTION public.forbid_deceased_student();
CREATE TRIGGER deceased_blocks_allocation BEFORE INSERT ON public.class_enrollment_episodes FOR EACH ROW EXECUTE FUNCTION public.forbid_deceased_student();

CREATE OR REPLACE FUNCTION public.forbid_death_movement_without_record() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NEW.movement_type_id = 'falecimento' AND NOT EXISTS (SELECT 1 FROM public.student_death_records d WHERE d.student_id = NEW.student_id) THEN
    RAISE EXCEPTION 'death:use-death-form';
  END IF;
  IF NEW.movement_type_id <> 'falecimento' AND EXISTS (SELECT 1 FROM public.student_death_records d WHERE d.student_id = NEW.student_id) THEN
    RAISE EXCEPTION 'student:deceased';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER death_movement_guard BEFORE INSERT ON public.student_movement_events FOR EACH ROW EXECUTE FUNCTION public.forbid_death_movement_without_record();

CREATE OR REPLACE FUNCTION public.secretariat_record_death(_enrollment text, _certificate text, _died_on date, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE ac record; e record; did uuid; ep record;
BEGIN
  SELECT * INTO ac FROM public.sec_actor();
  SELECT * INTO e FROM public.school_enrollments WHERE id = _enrollment;
  IF e.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', e.school_id)
     OR NOT public.has_school_capability('registrar-movimentacao-escolar', e.school_id) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  IF coalesce(btrim(_certificate), '') = '' THEN RAISE EXCEPTION 'death:certificate-required'; END IF;
  IF _died_on IS NULL OR _died_on > CURRENT_DATE THEN RAISE EXCEPTION 'secretariat:date-invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('af-alloc:' || e.id));
  IF EXISTS (SELECT 1 FROM public.student_death_records d WHERE d.student_id = e.student_id) THEN RAISE EXCEPTION 'death:already-recorded'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = e.id) THEN RAISE EXCEPTION 'base-superseded'; END IF;
  INSERT INTO public.student_death_records(student_id, enrollment_id, school_id, certificate_number, died_on, note, recorded_by, recorded_by_person_id, recorded_by_principal_id)
  VALUES (e.student_id, e.id, e.school_id, btrim(_certificate), _died_on, nullif(btrim(coalesce(_note,'')),''), auth.uid(), ac.person_id, ac.principal_id)
  RETURNING id INTO did;
  FOR ep IN SELECT p.id FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id) LOOP
    INSERT INTO public.class_enrollment_episode_endings(episode_id, ended_on, reason_label) VALUES (ep.id, greatest(_died_on, (SELECT valid_from FROM public.class_enrollment_episodes WHERE id = ep.id)), 'falecimento');
  END LOOP;
  INSERT INTO public.school_enrollment_endings(enrollment_id, ended_on, bond_status_id, reason_text, recorded_by)
  VALUES (e.id, greatest(_died_on, coalesce(e.opened_on, _died_on)), 'falecimento', 'Óbito — certidão ' || btrim(_certificate), auth.uid());
  INSERT INTO public.student_movement_events(logical_id, version, student_id, enrollment_id, movement_type_id, movement_type_version,
    effective_on, origin, destination, reason_text, recorded_by, school_scope_ids)
  VALUES ('mov-' || gen_random_uuid(), 1, e.student_id, e.id, 'falecimento', 1, _died_on,
    jsonb_build_object('schoolId', e.school_id, 'enrollmentId', e.id), '{}'::jsonb, 'Óbito — certidão ' || btrim(_certificate), auth.uid(), ARRAY[e.school_id]);
  RETURN did;
END $$;

CREATE OR REPLACE FUNCTION public.secretariat_correct_death(_death uuid, _certificate text, _died_on date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE d record; cid uuid;
BEGIN
  PERFORM public.sec_actor();
  SELECT * INTO d FROM public.student_death_records WHERE id = _death;
  IF d.id IS NULL OR NOT public.has_school_capability('registrar-movimentacao-escolar', d.school_id) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'correction-reason-required'; END IF;
  IF coalesce(btrim(_certificate),'') = '' THEN RAISE EXCEPTION 'death:certificate-required'; END IF;
  IF _died_on IS NULL OR _died_on > CURRENT_DATE THEN RAISE EXCEPTION 'secretariat:date-invalid'; END IF;
  INSERT INTO public.student_death_corrections(death_id, certificate_number, died_on, reason, recorded_by)
  VALUES (d.id, btrim(_certificate), _died_on, btrim(_reason), auth.uid()) RETURNING id INTO cid;
  RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.student_death_current(_student text)
RETURNS TABLE(death_id uuid, certificate_number text, died_on date, note text, corrected boolean, recorded_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$
  SELECT d.id, coalesce(c.certificate_number, d.certificate_number), coalesce(c.died_on, d.died_on), d.note, c.id IS NOT NULL, d.created_at
  FROM public.student_death_records d
  LEFT JOIN LATERAL (SELECT * FROM public.student_death_corrections x WHERE x.death_id = d.id ORDER BY x.created_at DESC LIMIT 1) c ON true
  WHERE d.student_id = _student
$$;

-- TRANSFERÊNCIA RECEBIDA ---------------------------------------------------
CREATE TABLE public.transfer_receptions (
  idempotency_key text PRIMARY KEY CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  student_id text NOT NULL,
  destination_school_id text NOT NULL,
  origin_enrollment_id text,
  result jsonb NOT NULL,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transfer_receptions TO authenticated;
GRANT ALL ON public.transfer_receptions TO service_role;
ALTER TABLE public.transfer_receptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receptions by destination" ON public.transfer_receptions FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', destination_school_id));
CREATE TRIGGER transfer_receptions_immutable BEFORE UPDATE OR DELETE ON public.transfer_receptions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.student_transfer_history(_school text, _student text)
RETURNS TABLE(enrollment_id text, school_id text, school_name text, year_label text, opened_on date, ended_on date, ending text, classes text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  PERFORM public.sec_actor();
  IF NOT public.has_school_capability('localizar-estudante-para-matricula', _school) THEN RAISE EXCEPTION 'lookup:capability-missing'; END IF;
  RETURN QUERY
  SELECT e.id, e.school_id, public.student_card_school_name(e.school_id),
    (SELECT v.official_name FROM public.institutional_academic_year_versions v WHERE v.academic_year_id = e.academic_year_id ORDER BY v.version DESC LIMIT 1),
    e.opened_on, x.ended_on,
    coalesce((SELECT m.label FROM public.movement_type_definitions m WHERE m.id = x.bond_status_id ORDER BY m.version DESC LIMIT 1), x.bond_status_id),
    (SELECT string_agg(DISTINCT p.class_label_snapshot, ', ') FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id)
  FROM public.school_enrollments e
  LEFT JOIN public.school_enrollment_endings x ON x.enrollment_id = e.id
  WHERE e.student_id = _student AND NOT EXISTS (SELECT 1 FROM public.school_enrollments n WHERE n.supersedes_id = e.id)
  ORDER BY e.opened_on DESC NULLS LAST, e.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.secretariat_receive_transfer(_student text, _dest_school text, _year text, _class text, _on date, _idem text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE ac record; prev jsonb; a record; o record; c record; ep record; enr text; nep text; res jsonb; oname text; oinep text;
BEGIN
  SELECT * INTO ac FROM public.sec_actor();
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _dest_school)
     OR NOT public.has_school_capability('localizar-estudante-para-matricula', _dest_school) THEN RAISE EXCEPTION 'enrollment:capability-missing'; END IF;
  IF coalesce(length(_idem),0) < 8 THEN RAISE EXCEPTION 'idempotency:key-required'; END IF;
  SELECT result INTO prev FROM public.transfer_receptions WHERE idempotency_key = _idem;
  IF prev IS NOT NULL THEN RETURN prev; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'secretariat:date-required'; END IF;
  IF NOT public.s_year_open_for_operation(_year) THEN RAISE EXCEPTION 'enrollment:year-not-open'; END IF;
  IF public.student_is_deceased(_student) THEN RAISE EXCEPTION 'student:deceased'; END IF;
  SELECT * INTO c FROM public.institutional_classes WHERE id = _class;
  IF c.id IS NULL OR c.school_id <> _dest_school OR c.academic_year_id IS DISTINCT FROM _year THEN RAISE EXCEPTION 'secretariat:class-invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('enroll-year:' || _student || ':' || _year));
  SELECT * INTO a FROM public.s_active_enrollment(_student, _year) LIMIT 1;
  IF a.enrollment_id IS NOT NULL AND a.school_id = _dest_school THEN RAISE EXCEPTION 'transfer:already-here'; END IF;
  IF a.enrollment_id IS NOT NULL THEN
    SELECT * INTO o FROM public.school_enrollments WHERE id = a.enrollment_id;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('af-alloc:' || o.id));
    IF o.opened_on IS NOT NULL AND _on - 1 < o.opened_on THEN RAISE EXCEPTION 'secretariat:date-invalid'; END IF;
    FOR ep IN SELECT p.id, p.valid_from FROM public.class_enrollment_episodes p WHERE p.enrollment_id = o.id
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id) LOOP
      IF _on - 1 < ep.valid_from THEN RAISE EXCEPTION 'secretariat:date-invalid'; END IF;
      INSERT INTO public.class_enrollment_episode_endings(episode_id, ended_on, reason_label) VALUES (ep.id, _on - 1, 'transferencia');
    END LOOP;
    INSERT INTO public.school_enrollment_endings(enrollment_id, ended_on, bond_status_id, reason_text, recorded_by)
    VALUES (o.id, _on - 1, 'transferencia', 'Transferência recebida pela escola de destino', auth.uid());
    INSERT INTO public.student_movement_events(logical_id, version, student_id, enrollment_id, movement_type_id, movement_type_version,
      effective_on, origin, destination, reason_text, recorded_by, school_scope_ids)
    VALUES ('mov-' || gen_random_uuid(), 1, _student, o.id, 'transferencia', 1, _on - 1,
      jsonb_build_object('schoolId', o.school_id, 'enrollmentId', o.id), jsonb_build_object('schoolId', _dest_school),
      'Transferência recebida pela escola de destino', auth.uid(), ARRAY[o.school_id, _dest_school]);
    oname := public.student_card_school_name(o.school_id);
    oinep := CASE WHEN o.school_id LIKE 'inep-%' THEN substr(o.school_id, 6) ELSE NULL END;
  ELSE
    SELECT public.student_card_school_name(e.school_id), CASE WHEN e.school_id LIKE 'inep-%' THEN substr(e.school_id, 6) END INTO oname, oinep
    FROM public.school_enrollments e WHERE e.student_id = _student ORDER BY e.opened_on DESC NULLS LAST LIMIT 1;
    IF oname IS NULL THEN RAISE EXCEPTION 'transfer:no-history'; END IF;
  END IF;
  enr := public.s_enroll_core(_student, _dest_school, _year, _on, NULL);
  nep := public.sec_allocate_core(enr, _class, _on, 'Transferência recebida');
  PERFORM public.record_enrollment_entry_origin(enr, 'transferencia-recebida', 'rede', oinep, oname);
  res := jsonb_build_object('student_id', _student, 'enrollment_id', enr, 'episode_id', nep, 'origin_enrollment_id', a.enrollment_id, 'origin_school_name', oname);
  INSERT INTO public.transfer_receptions(idempotency_key, student_id, destination_school_id, origin_enrollment_id, result, recorded_by)
  VALUES (_idem, _student, _dest_school, a.enrollment_id, res, auth.uid());
  RETURN res;
END $$;

-- DECLARAÇÃO PROVISÓRIA DE TRANSFERÊNCIA -----------------------------------
CREATE TABLE public.transfer_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  issue_year integer NOT NULL,
  number integer NOT NULL,
  enrollment_id text NOT NULL UNIQUE REFERENCES public.school_enrollments(id),
  student_id text NOT NULL,
  issued_on date NOT NULL,
  valid_until date NOT NULL,
  validity_days integer NOT NULL,
  facts jsonb NOT NULL,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, issue_year, number)
);
GRANT SELECT ON public.transfer_declarations TO authenticated;
GRANT ALL ON public.transfer_declarations TO service_role;
ALTER TABLE public.transfer_declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "declarations by school" ON public.transfer_declarations FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', school_id) OR public.has_network_capability('consultar-matricula-e-movimentacao'));
CREATE TRIGGER transfer_declarations_immutable BEFORE UPDATE OR DELETE ON public.transfer_declarations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.secretariat_emit_transfer_declaration(_enrollment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE e record; x record; d record; days int; n int; f jsonb; iv record; dest text;
BEGIN
  PERFORM public.sec_actor();
  SELECT * INTO e FROM public.school_enrollments WHERE id = _enrollment;
  IF e.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', e.school_id) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  SELECT * INTO x FROM public.school_enrollment_endings WHERE enrollment_id = e.id;
  IF x.enrollment_id IS NULL OR x.bond_status_id <> 'transferencia' THEN RAISE EXCEPTION 'declaration:not-transferred'; END IF;
  SELECT * INTO d FROM public.transfer_declarations WHERE enrollment_id = e.id;
  IF d.id IS NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('transfer-decl:' || e.school_id));
    SELECT * INTO d FROM public.transfer_declarations WHERE enrollment_id = e.id;
  END IF;
  IF d.id IS NOT NULL THEN
    RETURN d.facts || jsonb_build_object('number', d.number, 'issue_year', d.issue_year, 'issued_on', d.issued_on, 'valid_until', d.valid_until, 'validity_days', d.validity_days);
  END IF;
  days := coalesce((public.sector_parameter_value('secretaria.validade-declaracao-transferencia') #>> '{}')::int, 30);
  SELECT coalesce(max(t.number), 0) + 1 INTO n FROM public.transfer_declarations t WHERE t.school_id = e.school_id AND t.issue_year = extract(year FROM CURRENT_DATE)::int;
  SELECT * INTO iv FROM public.student_identity_versions v WHERE v.student_id = e.student_id ORDER BY v.version DESC LIMIT 1;
  SELECT public.student_card_school_name(m.destination->>'schoolId') INTO dest FROM public.student_movement_events m
   WHERE m.enrollment_id = e.id AND m.movement_type_id = 'transferencia' ORDER BY m.created_at DESC LIMIT 1;
  f := jsonb_build_object(
    'student_name', coalesce(iv.civil_name, (SELECT s.display_name FROM public.institutional_students s WHERE s.id = e.student_id)),
    'birth_date', iv.birth_date,
    'school_name', public.student_card_school_name(e.school_id),
    'school_id', e.school_id,
    'year_label', (SELECT v.official_name FROM public.institutional_academic_year_versions v WHERE v.academic_year_id = e.academic_year_id ORDER BY v.version DESC LIMIT 1),
    'class_label', (SELECT p.class_label_snapshot FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id ORDER BY p.valid_from DESC LIMIT 1),
    'opened_on', e.opened_on, 'ended_on', x.ended_on, 'destination', dest);
  INSERT INTO public.transfer_declarations(school_id, issue_year, number, enrollment_id, student_id, issued_on, valid_until, validity_days, facts, recorded_by)
  VALUES (e.school_id, extract(year FROM CURRENT_DATE)::int, n, e.id, e.student_id, CURRENT_DATE, CURRENT_DATE + days, days, f, auth.uid())
  RETURNING * INTO d;
  RETURN f || jsonb_build_object('number', d.number, 'issue_year', d.issue_year, 'issued_on', d.issued_on, 'valid_until', d.valid_until, 'validity_days', d.validity_days);
END $$;

-- TERMO DE RENOVAÇÃO --------------------------------------------------------
CREATE TABLE public.renewal_term_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  student_id text NOT NULL,
  enrollment_id text NOT NULL REFERENCES public.school_enrollments(id),
  year_label text,
  grade_label text,
  image_consent boolean,
  address_change text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.renewal_term_records TO authenticated;
GRANT ALL ON public.renewal_term_records TO service_role;
ALTER TABLE public.renewal_term_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "renewal terms by school" ON public.renewal_term_records FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', school_id));
CREATE TRIGGER renewal_terms_immutable BEFORE UPDATE OR DELETE ON public.renewal_term_records FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.secretariat_record_renewal_term(_enrollment text, _grade text, _image boolean, _address text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE e record; rid uuid;
BEGIN
  PERFORM public.sec_actor();
  SELECT * INTO e FROM public.school_enrollments WHERE id = _enrollment;
  IF e.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', e.school_id) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  IF public.student_is_deceased(e.student_id) THEN RAISE EXCEPTION 'student:deceased'; END IF;
  INSERT INTO public.renewal_term_records(school_id, student_id, enrollment_id, year_label, grade_label, image_consent, address_change, recorded_by)
  VALUES (e.school_id, e.student_id, e.id,
    (SELECT v.official_name FROM public.institutional_academic_year_versions v WHERE v.academic_year_id = e.academic_year_id ORDER BY v.version DESC LIMIT 1),
    nullif(btrim(coalesce(_grade,'')),''), _image, nullif(btrim(coalesce(_address,'')),''), auth.uid())
  RETURNING id INTO rid;
  RETURN rid;
END $$;

REVOKE EXECUTE ON FUNCTION public.secretariat_record_death(text,text,date,text), public.secretariat_correct_death(uuid,text,date,text),
  public.student_transfer_history(text,text), public.secretariat_receive_transfer(text,text,text,text,date,text),
  public.secretariat_emit_transfer_declaration(text), public.secretariat_record_renewal_term(text,text,boolean,text),
  public.student_death_current(text), public.forbid_deceased_student(), public.forbid_death_movement_without_record() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_record_death(text,text,date,text), public.secretariat_correct_death(uuid,text,date,text),
  public.student_transfer_history(text,text), public.secretariat_receive_transfer(text,text,text,text,date,text),
  public.secretariat_emit_transfer_declaration(text), public.secretariat_record_renewal_term(text,text,boolean,text),
  public.student_death_current(text) TO authenticated;
