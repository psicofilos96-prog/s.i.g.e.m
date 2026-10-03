-- B3.2: remoção do overconstraint técnico; nenhum dado ou norma é criado.

-- 6. Alocação: turma validada pelo contexto canônico da B2 (class_fact_context).
-- B3.2: término explícito na constituição, dentro da mesma transação.
CREATE OR REPLACE FUNCTION public.record_class_allocation(_id text, _participation_logical text, _class text, _valid_from date,
  _act_ref text, _supersedes text, _correction_reason text, _ended_on date) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p public.cycle_participations; _e public.school_enrollments; _c public.institutional_classes;
  _rec public.institutional_class_record_versions; _prev public.class_enrollment_episodes; _enrollment_end public.cycle_enrollment_ending_versions;
  _logical text := _id; _ended date := _ended_on;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'allocation:session-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'allocation:valid-from-required'; END IF;
  IF _supersedes IS NOT NULL AND _ended_on IS NOT NULL THEN
    RAISE EXCEPTION 'allocation:ending-on-correction-unsupported';
  END IF;
  _p := public.b3_participation_head(_participation_logical);
  IF _p.id IS NULL OR _p.annulled THEN RAISE EXCEPTION 'allocation:participation-unknown'; END IF;
  _e := public.b3_enrollment_head(_p.enrollment_logical_id);
  IF _e.id IS NULL THEN RAISE EXCEPTION 'allocation:enrollment-unknown'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _e.school_id) THEN RAISE EXCEPTION 'allocation:capability-missing'; END IF;
  SELECT * INTO _c FROM public.institutional_classes WHERE id = _class;
  IF NOT FOUND THEN RAISE EXCEPTION 'allocation:class-unknown'; END IF;
  IF _c.school_id <> _e.school_id THEN RAISE EXCEPTION 'allocation:class-other-school'; END IF;
  IF _c.academic_year_id IS DISTINCT FROM _e.academic_year_id THEN RAISE EXCEPTION 'allocation:academic-year-mismatch'; END IF;
  -- Same lock order as the parent writers; re-read heads after waiting for them.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('participation-enrollment:' || _p.enrollment_logical_id));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('allocation-participation:' || _participation_logical));
  _p := public.b3_participation_head(_participation_logical);
  IF _p.id IS NULL OR _p.annulled THEN RAISE EXCEPTION 'allocation:participation-unknown'; END IF;
  _e := public.b3_enrollment_head(_p.enrollment_logical_id);
  IF _e.id IS NULL THEN RAISE EXCEPTION 'allocation:enrollment-unknown'; END IF;
  IF _valid_from < _p.valid_from OR (_p.valid_until IS NOT NULL AND _valid_from > _p.valid_until) THEN
    RAISE EXCEPTION 'allocation:outside-participation';
  END IF;
  IF _supersedes IS NOT NULL THEN
    IF coalesce(pg_catalog.btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'allocation:correction-reason-required'; END IF;
    SELECT * INTO _prev FROM public.class_enrollment_episodes WHERE id = _supersedes FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'allocation:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.class_enrollment_episodes WHERE supersedes_id = _supersedes) THEN RAISE EXCEPTION 'allocation:base-superseded'; END IF;
    IF _prev.participation_logical_id IS DISTINCT FROM _participation_logical THEN RAISE EXCEPTION 'allocation:participation-immutable'; END IF;
    _logical := coalesce(_prev.logical_id, _prev.id);
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('allocation-ending:' || _logical));
    _ended := public.b3_allocation_ended_on(_logical);
  END IF;
  IF _ended IS NOT NULL THEN
    IF _supersedes IS NOT NULL AND _prev.class_id <> _class THEN RAISE EXCEPTION 'allocation:class-immutable-after-ending'; END IF;
    IF _ended < _valid_from THEN RAISE EXCEPTION 'allocation:ending-before-start'; END IF;
  END IF;
  IF _p.valid_until IS NOT NULL THEN
    IF _ended IS NULL THEN RAISE EXCEPTION 'allocation:open-beyond-participation'; END IF;
    IF _ended > _p.valid_until THEN RAISE EXCEPTION 'allocation:outside-participation'; END IF;
  END IF;
  _enrollment_end := public.b3_enrollment_ending_head(_p.enrollment_logical_id);
  IF _valid_from < _e.opened_on OR (_enrollment_end.id IS NOT NULL AND NOT _enrollment_end.annulled
    AND (_ended IS NULL OR _ended > _enrollment_end.ended_on)) THEN
    RAISE EXCEPTION 'allocation:outside-enrollment';
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
  IF _supersedes IS NULL AND _ended_on IS NOT NULL THEN
    PERFORM public.record_class_allocation_ending(_logical, NULL::uuid, _ended_on, NULL::text, _act_ref, NULL::text);
  END IF;
  RETURN _id;
END $$;

-- Assinatura B3/B3.1 preservada: sem data final, a participação delimitada continua recusada.
CREATE OR REPLACE FUNCTION public.record_class_allocation(_id text, _participation_logical text, _class text, _valid_from date,
  _act_ref text, _supersedes text, _correction_reason text) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.record_class_allocation(_id, _participation_logical, _class, _valid_from,
    _act_ref, _supersedes, _correction_reason, NULL::date)
$$;

REVOKE EXECUTE ON FUNCTION public.record_class_allocation(text,text,text,date,text,text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_class_allocation(text,text,text,date,text,text,text,date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_class_allocation(text,text,text,date,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_class_allocation(text,text,text,date,text,text,text) TO authenticated;
