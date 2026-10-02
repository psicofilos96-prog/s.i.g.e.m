-- B3.1 — Hardening técnico da cadeia inscrição → participação → alocação.
-- (0002_b3_1_chain_hardening.sql foi registrada vazia por engano operacional; esta é a B3.1 efetiva.)
-- Aditiva: redefine escritores B3 (mesmas assinaturas, ACL reafirmada), cria o reader
-- canônico de tipos de movimentação. Nenhum valor semeado; nenhuma cascata; recusa por código.
-- Versão institucional aplicável = maior versão com valid_from <= data (mesma regra de
-- class_record_context/class_fact_context da B2), nunca "head" por supersessão.

-- 1. Reader canônico temporal de tipos de movimentação.
CREATE OR REPLACE FUNCTION public.movement_types_at(_on date, _known_at timestamptz DEFAULT NULL)
RETURNS TABLE(id text, version integer, label text, valid_from date, homologation_act_ref text, created_at timestamptz)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'movement-type:query-arguments-required'; END IF;
  RETURN QUERY
  SELECT DISTINCT ON (d.id) d.id, d.version, d.label, d.valid_from, d.homologation_act_ref, d.created_at
  FROM public.movement_type_definitions d
  WHERE d.status = 'homologada' AND d.valid_from IS NOT NULL AND d.valid_from <= _on
    AND (_known_at IS NULL OR d.created_at <= _known_at)
  ORDER BY d.id, d.version DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.movement_types_at(date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.movement_types_at(date, timestamptz) TO authenticated;

-- 2. Movimentação: tipo validado pela versão vigente na data efetiva.
CREATE OR REPLACE FUNCTION public.record_student_movement(_logical text, _base_version_id uuid, _student text, _enrollment text,
  _type text, _type_version integer, _effective_on date, _origin jsonb, _destination jsonb, _reason_code text, _reason_text text,
  _act_ref text, _correction_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _schools text[]; _prev public.student_movement_events; _id uuid; _v integer := 1;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'movement:session-required'; END IF;
  IF _effective_on IS NULL THEN RAISE EXCEPTION 'movement:effective-on-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.movement_types_at(_effective_on, NULL) t WHERE t.id = _type AND t.version = _type_version) THEN
    RAISE EXCEPTION 'movement:type-not-current';
  END IF;
  _schools := array_remove(ARRAY[_origin->>'schoolId', _destination->>'schoolId'], NULL);
  IF array_length(_schools, 1) IS NULL THEN RAISE EXCEPTION 'movement:no-network-school'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(_schools) s WHERE public.has_school_capability('registrar-movimentacao-escolar', s)) THEN
    RAISE EXCEPTION 'movement:capability-missing';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('movement:' || _logical));
  SELECT m.* INTO _prev FROM public.student_movement_events m WHERE m.logical_id = _logical
    AND NOT EXISTS (SELECT 1 FROM public.student_movement_events n WHERE n.supersedes_id = m.id);
  IF _prev.id IS NOT NULL THEN
    IF _base_version_id IS DISTINCT FROM _prev.id THEN RAISE EXCEPTION 'movement:base-superseded'; END IF;
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'movement:correction-reason-required'; END IF;
    IF _prev.student_id <> _student THEN RAISE EXCEPTION 'movement:identity-immutable'; END IF;
    _v := _prev.version + 1;
  ELSIF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'movement:base-unknown';
  END IF;
  INSERT INTO public.student_movement_events(logical_id, version, supersedes_id, student_id, enrollment_id, movement_type_id, movement_type_version,
    effective_on, origin, destination, reason_code, reason_text, originating_act_ref, correction_reason, recorded_by, school_scope_ids)
  VALUES (_logical, _v, CASE WHEN _v > 1 THEN _prev.id END, _student, _enrollment, _type, _type_version, _effective_on, _origin, _destination,
    _reason_code, _reason_text, _act_ref, CASE WHEN _v > 1 THEN _correction_reason END, auth.uid(), _schools)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- 3. Inscrição: escola/ano pela versão aplicável; retificação revalida participações e término.
CREATE OR REPLACE FUNCTION public.constitute_cycle_enrollment(_id text, _student text, _school text, _academic_year text, _opened_on date,
  _institutional_number text, _act_ref text, _supersedes text, _correction_reason text, _offer_value text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev public.school_enrollments; _logical text := _id; _ok boolean; _end public.cycle_enrollment_ending_versions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'enrollment:session-required'; END IF;
  IF _opened_on IS NULL THEN RAISE EXCEPTION 'enrollment:opened-on-required'; END IF;
  IF _offer_value IS NOT NULL THEN RAISE EXCEPTION 'enrollment:offer-designation-not-homologated'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'enrollment:capability-missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_students WHERE id = _student) THEN RAISE EXCEPTION 'enrollment:student-unknown'; END IF;
  SELECT v.active INTO _ok FROM public.institutional_school_record_versions v
    WHERE v.school_id = _school AND v.valid_from <= _opened_on ORDER BY v.version_number DESC LIMIT 1;
  IF _ok IS NOT TRUE THEN RAISE EXCEPTION 'enrollment:school-inactive-on-date'; END IF;
  _ok := NULL;
  SELECT v.is_active INTO _ok FROM public.institutional_academic_year_versions v
    WHERE v.academic_year_id = _academic_year AND v.valid_from <= _opened_on ORDER BY v.version DESC LIMIT 1;
  IF _ok IS NOT TRUE THEN RAISE EXCEPTION 'enrollment:academic-year-inactive-on-date'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('enrollment:' || _student || '|' || _school || '|' || _academic_year));
  IF _supersedes IS NOT NULL THEN
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'enrollment:correction-reason-required'; END IF;
    SELECT * INTO _prev FROM public.school_enrollments WHERE id = _supersedes FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'enrollment:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.school_enrollments WHERE supersedes_id = _supersedes) THEN RAISE EXCEPTION 'enrollment:base-superseded'; END IF;
    IF _prev.student_id <> _student OR _prev.school_id <> _school OR _prev.academic_year_id IS DISTINCT FROM _academic_year THEN
      RAISE EXCEPTION 'enrollment:identity-immutable';
    END IF;
    _logical := coalesce(_prev.logical_id, _prev.id);
    PERFORM pg_advisory_xact_lock(hashtext('participation-enrollment:' || _logical));
    IF EXISTS (SELECT 1 FROM public.cycle_participations p WHERE p.enrollment_logical_id = _logical AND NOT p.annulled
        AND NOT EXISTS (SELECT 1 FROM public.cycle_participations s WHERE s.supersedes_id = p.id)
        AND p.valid_from < _opened_on) THEN
      RAISE EXCEPTION 'enrollment:child-participation-outside';
    END IF;
    _end := public.b3_enrollment_ending_head(_logical);
    IF _end.id IS NOT NULL AND NOT _end.annulled AND _end.ended_on < _opened_on THEN RAISE EXCEPTION 'enrollment:ending-before-start'; END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.school_enrollments e
      WHERE e.student_id = _student AND e.school_id = _school AND e.academic_year_id = _academic_year
        AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions x WHERE x.enrollment_logical_id = e.logical_id AND NOT x.annulled
          AND x.ended_on < _opened_on AND NOT EXISTS (SELECT 1 FROM public.cycle_enrollment_ending_versions y WHERE y.supersedes_id = x.id))) THEN
      RAISE EXCEPTION 'enrollment:coexistence-policy-absent';
    END IF;
  END IF;
  INSERT INTO public.school_enrollments(id, logical_id, student_id, school_id, academic_year_id, cycle_id, opened_on, institutional_number,
    originating_act_ref, supersedes_id, correction_reason, recorded_by)
  VALUES (_id, _logical, _student, _school, _academic_year, _academic_year, _opened_on, _institutional_number,
    _act_ref, _supersedes, _correction_reason, auth.uid());
  RETURN _id;
END $$;

-- 4. Término da inscrição: nunca deixa participação vigente fora da janela (sem cascata).
CREATE OR REPLACE FUNCTION public.record_cycle_enrollment_ending(_enrollment_logical text, _base_version_id uuid, _ended_on date,
  _bond_status_value text, _bond_status_version integer, _reason text, _act_ref text, _correction_reason text, _annul boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _e public.school_enrollments; _prev public.cycle_enrollment_ending_versions; _v integer := 1; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ending:session-required'; END IF;
  _e := public.b3_enrollment_head(_enrollment_logical);
  IF _e.id IS NULL THEN RAISE EXCEPTION 'ending:enrollment-unknown'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _e.school_id) THEN RAISE EXCEPTION 'ending:capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('participation-enrollment:' || _enrollment_logical));
  PERFORM pg_advisory_xact_lock(hashtext('enrollment-ending:' || _enrollment_logical));
  _prev := public.b3_enrollment_ending_head(_enrollment_logical);
  IF _prev.id IS NOT NULL THEN
    IF _base_version_id IS DISTINCT FROM _prev.id THEN RAISE EXCEPTION 'ending:base-superseded'; END IF;
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'ending:correction-reason-required'; END IF;
    _v := _prev.version + 1;
  ELSIF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'ending:base-unknown';
  ELSIF _annul THEN RAISE EXCEPTION 'ending:nothing-to-annul';
  END IF;
  IF NOT _annul THEN
    IF _ended_on IS NULL THEN RAISE EXCEPTION 'ending:date-required'; END IF;
    IF _ended_on < _e.opened_on THEN RAISE EXCEPTION 'ending:before-start'; END IF;
    IF _bond_status_value IS NULL OR NOT public.attribute_value_homologated('situacao-do-vinculo', _bond_status_value, _bond_status_version, _ended_on) THEN
      RAISE EXCEPTION 'ending:bond-status-not-homologated';
    END IF;
    IF EXISTS (SELECT 1 FROM public.cycle_participations p WHERE p.enrollment_logical_id = _enrollment_logical AND NOT p.annulled
        AND NOT EXISTS (SELECT 1 FROM public.cycle_participations s WHERE s.supersedes_id = p.id)
        AND (p.valid_from > _ended_on OR p.valid_until IS NULL OR p.valid_until > _ended_on)) THEN
      RAISE EXCEPTION 'ending:child-participation-outside';
    END IF;
  END IF;
  INSERT INTO public.cycle_enrollment_ending_versions(enrollment_logical_id, school_id, version, supersedes_id, ended_on, annulled,
    bond_status_value_id, bond_status_version, reason_text, originating_act_ref, correction_reason, recorded_by)
  VALUES (_enrollment_logical, _e.school_id, _v, _prev.id, CASE WHEN _annul THEN NULL ELSE _ended_on END, _annul,
    CASE WHEN _annul THEN NULL ELSE _bond_status_value END, CASE WHEN _annul THEN NULL ELSE _bond_status_version END,
    _reason, _act_ref, CASE WHEN _v > 1 THEN _correction_reason END, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- 5. Participação: encurtar/anular nunca deixa alocação vigente fora da janela (sem cascata).
CREATE OR REPLACE FUNCTION public.declare_cycle_participation(_logical text, _base_version_id uuid, _enrollment_logical text,
  _nature_value text, _nature_version integer, _valid_from date, _valid_until date, _act_ref text, _change_reason text, _annul boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _e public.school_enrollments; _end public.cycle_enrollment_ending_versions; _prev public.cycle_participations; _v integer := 1; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'participation:session-required'; END IF;
  _e := public.b3_enrollment_head(_enrollment_logical);
  IF _e.id IS NULL THEN RAISE EXCEPTION 'participation:enrollment-unknown'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _e.school_id) THEN RAISE EXCEPTION 'participation:capability-missing'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'participation:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'participation:ends-before-start'; END IF;
  IF NOT public.attribute_value_homologated('natureza-da-participacao-educacional', _nature_value, _nature_version, _valid_from) THEN
    RAISE EXCEPTION 'participation:nature-not-homologated';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('participation-enrollment:' || _enrollment_logical));
  PERFORM pg_advisory_xact_lock(hashtext('allocation-participation:' || _logical));
  IF _valid_from < _e.opened_on THEN RAISE EXCEPTION 'participation:outside-enrollment'; END IF;
  _end := public.b3_enrollment_ending_head(_enrollment_logical);
  IF NOT _annul AND _end.id IS NOT NULL AND NOT _end.annulled AND (_valid_from > _end.ended_on OR _valid_until IS NULL OR _valid_until > _end.ended_on) THEN
    RAISE EXCEPTION 'participation:outside-enrollment';
  END IF;
  _prev := public.b3_participation_head(_logical);
  IF _prev.id IS NOT NULL THEN
    IF _base_version_id IS DISTINCT FROM _prev.id THEN RAISE EXCEPTION 'participation:base-superseded'; END IF;
    IF coalesce(btrim(_change_reason), '') = '' THEN RAISE EXCEPTION 'participation:correction-reason-required'; END IF;
    IF _prev.enrollment_logical_id <> _enrollment_logical THEN RAISE EXCEPTION 'participation:enrollment-immutable'; END IF;
    _v := _prev.version + 1;
    IF _annul AND EXISTS (SELECT 1 FROM public.class_enrollment_episodes a WHERE a.participation_logical_id = _logical
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id)) THEN
      RAISE EXCEPTION 'participation:has-allocations';
    END IF;
    IF NOT _annul AND EXISTS (SELECT 1 FROM public.class_enrollment_episodes a WHERE a.participation_logical_id = _logical
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id)
        AND (a.valid_from < _valid_from OR (_valid_until IS NOT NULL AND (a.valid_from > _valid_until
          OR public.b3_allocation_ended_on(a.logical_id) IS NULL OR public.b3_allocation_ended_on(a.logical_id) > _valid_until)))) THEN
      RAISE EXCEPTION 'participation:child-allocation-outside';
    END IF;
  ELSIF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'participation:base-unknown';
  ELSIF _annul THEN RAISE EXCEPTION 'participation:nothing-to-annul';
  END IF;
  IF NOT _annul AND EXISTS (SELECT 1 FROM public.cycle_participations p
    WHERE p.enrollment_logical_id = _enrollment_logical AND p.logical_id <> _logical AND NOT p.annulled
      AND NOT EXISTS (SELECT 1 FROM public.cycle_participations s WHERE s.supersedes_id = p.id)
      AND p.valid_from <= coalesce(_valid_until, 'infinity'::date) AND coalesce(p.valid_until, 'infinity'::date) >= _valid_from) THEN
    RAISE EXCEPTION 'participation:coexistence-policy-absent';
  END IF;
  INSERT INTO public.cycle_participations(logical_id, version, supersedes_id, enrollment_logical_id, student_id, school_id,
    nature_value_id, nature_version, valid_from, valid_until, annulled, change_reason, originating_act_ref, recorded_by)
  VALUES (_logical, _v, _prev.id, _enrollment_logical, _e.student_id, _e.school_id, _nature_value, _nature_version,
    _valid_from, _valid_until, _annul, CASE WHEN _v > 1 THEN _change_reason END, _act_ref, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- 6. Alocação: turma validada pelo contexto canônico da B2 (class_fact_context).
-- Alocação nasce sem término; por isso é recusada sob participação já delimitada.
CREATE OR REPLACE FUNCTION public.record_class_allocation(_id text, _participation_logical text, _class text, _valid_from date,
  _act_ref text, _supersedes text, _correction_reason text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p public.cycle_participations; _e public.school_enrollments; _c public.institutional_classes;
  _rec public.institutional_class_record_versions; _prev public.class_enrollment_episodes; _logical text := _id; _ended date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'allocation:session-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'allocation:valid-from-required'; END IF;
  _p := public.b3_participation_head(_participation_logical);
  IF _p.id IS NULL OR _p.annulled THEN RAISE EXCEPTION 'allocation:participation-unknown'; END IF;
  _e := public.b3_enrollment_head(_p.enrollment_logical_id);
  IF _e.id IS NULL THEN RAISE EXCEPTION 'allocation:enrollment-unknown'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _e.school_id) THEN RAISE EXCEPTION 'allocation:capability-missing'; END IF;
  SELECT * INTO _c FROM public.institutional_classes WHERE id = _class;
  IF NOT FOUND THEN RAISE EXCEPTION 'allocation:class-unknown'; END IF;
  IF _c.school_id <> _e.school_id THEN RAISE EXCEPTION 'allocation:class-other-school'; END IF;
  IF _c.academic_year_id IS DISTINCT FROM _e.academic_year_id THEN RAISE EXCEPTION 'allocation:academic-year-mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('allocation-participation:' || _participation_logical));
  IF _valid_from < _p.valid_from OR (_p.valid_until IS NOT NULL AND _valid_from > _p.valid_until) THEN
    RAISE EXCEPTION 'allocation:outside-participation';
  END IF;
  IF _supersedes IS NOT NULL THEN
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'allocation:correction-reason-required'; END IF;
    SELECT * INTO _prev FROM public.class_enrollment_episodes WHERE id = _supersedes FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'allocation:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.class_enrollment_episodes WHERE supersedes_id = _supersedes) THEN RAISE EXCEPTION 'allocation:base-superseded'; END IF;
    IF _prev.participation_logical_id IS DISTINCT FROM _participation_logical THEN RAISE EXCEPTION 'allocation:participation-immutable'; END IF;
    _logical := coalesce(_prev.logical_id, _prev.id);
    PERFORM pg_advisory_xact_lock(hashtext('allocation-ending:' || _logical));
    _ended := public.b3_allocation_ended_on(_logical);
  END IF;
  IF _ended IS NOT NULL THEN
    IF _prev.class_id <> _class THEN RAISE EXCEPTION 'allocation:class-immutable-after-ending'; END IF;
    IF _ended < _valid_from THEN RAISE EXCEPTION 'allocation:ending-before-start'; END IF;
  ELSIF _p.valid_until IS NOT NULL THEN
    RAISE EXCEPTION 'allocation:open-beyond-participation';
  END IF;
  BEGIN
    PERFORM public.class_fact_context(_class, _valid_from, coalesce(_ended, _valid_from));
  EXCEPTION WHEN raise_exception THEN
    RAISE EXCEPTION 'allocation:class-inactive-on-date (%)', SQLERRM;
  END;
  SELECT r.* INTO _rec FROM public.class_at(_class, _valid_from, NULL) r;
  IF EXISTS (SELECT 1 FROM public.class_enrollment_episodes a
    WHERE a.participation_logical_id = _participation_logical AND a.logical_id <> _logical
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id)
      AND (public.b3_allocation_ended_on(a.logical_id) IS NULL OR public.b3_allocation_ended_on(a.logical_id) >= _valid_from)) THEN
    RAISE EXCEPTION 'allocation:cardinality-policy-absent';
  END IF;
  INSERT INTO public.class_enrollment_episodes(id, logical_id, participation_logical_id, enrollment_id, student_id, school_id, class_id,
    class_label_snapshot, cycle_id, valid_from, originating_act_ref, supersedes_id, correction_reason, recorded_by)
  VALUES (_id, _logical, _participation_logical, _e.id, _e.student_id, _e.school_id, _class, _rec.name, _e.academic_year_id,
    _valid_from, _act_ref, _supersedes, _correction_reason, auth.uid());
  RETURN _id;
END $$;

-- 7. Término da alocação: dentro da participação e com a turma ativa em todo o intervalo.
CREATE OR REPLACE FUNCTION public.record_class_allocation_ending(_allocation_logical text, _base_version_id uuid, _ended_on date,
  _reason text, _act_ref text, _correction_reason text, _annul boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _a public.class_enrollment_episodes; _p public.cycle_participations; _prev public.class_allocation_ending_versions; _v integer := 1; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'allocation-ending:session-required'; END IF;
  SELECT a.* INTO _a FROM public.class_enrollment_episodes a WHERE a.logical_id = _allocation_logical
    AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id) LIMIT 1;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'allocation-ending:allocation-unknown'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _a.school_id) THEN RAISE EXCEPTION 'allocation-ending:capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('allocation-participation:' || coalesce(_a.participation_logical_id, '')));
  PERFORM pg_advisory_xact_lock(hashtext('allocation-ending:' || _allocation_logical));
  IF _a.participation_logical_id IS NOT NULL THEN _p := public.b3_participation_head(_a.participation_logical_id); END IF;
  SELECT x.* INTO _prev FROM public.class_allocation_ending_versions x WHERE x.allocation_logical_id = _allocation_logical
    AND NOT EXISTS (SELECT 1 FROM public.class_allocation_ending_versions s WHERE s.supersedes_id = x.id) LIMIT 1;
  IF _prev.id IS NOT NULL THEN
    IF _base_version_id IS DISTINCT FROM _prev.id THEN RAISE EXCEPTION 'allocation-ending:base-superseded'; END IF;
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'allocation-ending:correction-reason-required'; END IF;
    _v := _prev.version + 1;
  ELSIF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'allocation-ending:base-unknown';
  ELSIF _annul THEN RAISE EXCEPTION 'allocation-ending:nothing-to-annul';
  END IF;
  IF _annul THEN
    IF _p.id IS NOT NULL AND _p.valid_until IS NOT NULL THEN RAISE EXCEPTION 'allocation-ending:open-beyond-participation'; END IF;
  ELSE
    IF _ended_on IS NULL THEN RAISE EXCEPTION 'allocation-ending:date-required'; END IF;
    IF _ended_on < _a.valid_from THEN RAISE EXCEPTION 'allocation-ending:before-start'; END IF;
    IF _p.id IS NOT NULL AND _p.valid_until IS NOT NULL AND _ended_on > _p.valid_until THEN
      RAISE EXCEPTION 'allocation-ending:outside-participation';
    END IF;
    BEGIN
      PERFORM public.class_fact_context(_a.class_id, _a.valid_from, _ended_on);
    EXCEPTION WHEN raise_exception THEN
      RAISE EXCEPTION 'allocation-ending:class-inactive-in-interval (%)', SQLERRM;
    END;
  END IF;
  INSERT INTO public.class_allocation_ending_versions(allocation_logical_id, school_id, class_id, version, supersedes_id, ended_on, annulled,
    reason_text, originating_act_ref, correction_reason, recorded_by)
  VALUES (_allocation_logical, _a.school_id, _a.class_id, _v, _prev.id, CASE WHEN _annul THEN NULL ELSE _ended_on END, _annul,
    _reason, _act_ref, CASE WHEN _v > 1 THEN _correction_reason END, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- 8. Capacidade: turma ativa e ano compatível em todo o período do registro (sem regra de lotação).
CREATE OR REPLACE FUNCTION public.record_class_capacity(_logical text, _base_version_id uuid, _class text, _reference_limit integer,
  _valid_from date, _valid_until date, _basis text, _act_ref text, _change_reason text, _annul boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _c public.institutional_classes; _prev public.class_capacity_records; _v integer := 1; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'capacity:session-required'; END IF;
  SELECT * INTO _c FROM public.institutional_classes WHERE id = _class;
  IF NOT FOUND THEN RAISE EXCEPTION 'capacity:class-unknown'; END IF;
  IF NOT public.has_school_capability('manter-cadastro-de-turmas', _c.school_id) THEN RAISE EXCEPTION 'capacity:capability-missing'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'capacity:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'capacity:ends-before-start'; END IF;
  IF NOT _annul AND (_reference_limit IS NULL OR _reference_limit < 0) THEN RAISE EXCEPTION 'capacity:limit-required'; END IF;
  IF NOT _annul THEN
    BEGIN
      PERFORM public.class_fact_context(_class, _valid_from, coalesce(_valid_until, _valid_from));
    EXCEPTION WHEN raise_exception THEN
      RAISE EXCEPTION 'capacity:class-inactive-on-date (%)', SQLERRM;
    END;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('capacity-class:' || _class));
  SELECT r.* INTO _prev FROM public.class_capacity_records r WHERE r.logical_id = _logical
    AND NOT EXISTS (SELECT 1 FROM public.class_capacity_records s WHERE s.supersedes_id = r.id) LIMIT 1;
  IF _prev.id IS NOT NULL THEN
    IF _base_version_id IS DISTINCT FROM _prev.id THEN RAISE EXCEPTION 'capacity:base-superseded'; END IF;
    IF coalesce(btrim(_change_reason), '') = '' THEN RAISE EXCEPTION 'capacity:correction-reason-required'; END IF;
    IF _prev.class_id <> _class THEN RAISE EXCEPTION 'capacity:class-immutable'; END IF;
    _v := _prev.version + 1;
  ELSIF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'capacity:base-unknown';
  END IF;
  IF NOT _annul AND EXISTS (SELECT 1 FROM public.class_capacity_records r
    WHERE r.class_id = _class AND r.logical_id <> _logical AND NOT r.annulled
      AND NOT EXISTS (SELECT 1 FROM public.class_capacity_records s WHERE s.supersedes_id = r.id)
      AND r.valid_from <= coalesce(_valid_until, 'infinity'::date) AND coalesce(r.valid_until, 'infinity'::date) >= _valid_from) THEN
    RAISE EXCEPTION 'capacity:overlapping-record';
  END IF;
  INSERT INTO public.class_capacity_records(logical_id, version, supersedes_id, class_id, school_id, reference_limit, valid_from, valid_until,
    annulled, basis_text, originating_act_ref, change_reason, recorded_by)
  VALUES (_logical, _v, _prev.id, _class, _c.school_id, CASE WHEN _annul THEN NULL ELSE _reference_limit END, _valid_from, _valid_until,
    _annul, _basis, _act_ref, CASE WHEN _v > 1 THEN _change_reason END, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- 9. ACL explícita.
REVOKE EXECUTE ON FUNCTION
  public.constitute_cycle_enrollment(text,text,text,text,date,text,text,text,text,text),
  public.record_cycle_enrollment_ending(text,uuid,date,text,integer,text,text,text,boolean),
  public.declare_cycle_participation(text,uuid,text,text,integer,date,date,text,text,boolean),
  public.record_class_allocation(text,text,text,date,text,text,text),
  public.record_class_allocation_ending(text,uuid,date,text,text,text,boolean),
  public.record_class_capacity(text,uuid,text,integer,date,date,text,text,text,boolean),
  public.record_student_movement(text,uuid,text,text,text,integer,date,jsonb,jsonb,text,text,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.constitute_cycle_enrollment(text,text,text,text,date,text,text,text,text,text),
  public.record_cycle_enrollment_ending(text,uuid,date,text,integer,text,text,text,boolean),
  public.declare_cycle_participation(text,uuid,text,text,integer,date,date,text,text,boolean),
  public.record_class_allocation(text,text,text,date,text,text,text),
  public.record_class_allocation_ending(text,uuid,date,text,text,text,boolean),
  public.record_class_capacity(text,uuid,text,integer,date,date,text,text,text,boolean),
  public.record_student_movement(text,uuid,text,text,text,integer,date,jsonb,jsonb,text,text,text,text)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.b3_enrollment_head(text), public.b3_enrollment_ending_head(text), public.b3_participation_head(text),
  public.b3_allocation_ended_on(text) FROM PUBLIC, anon, authenticated;