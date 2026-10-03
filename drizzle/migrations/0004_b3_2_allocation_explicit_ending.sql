-- B3.2 — Alocação com término explícito na criação (aditiva).
-- Novo writer de 9 argumentos; o de 7 argumentos (B3/B3.1) passa a delegar com término nulo,
-- preservando o comportamento anterior. Sem término implícito, sem cascata, cardinalidade inalterada.
CREATE OR REPLACE FUNCTION public.record_class_allocation(_id text, _participation_logical text, _class text, _valid_from date,
  _act_ref text, _supersedes text, _correction_reason text, _ended_on date, _ending_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE _p public.cycle_participations; _e public.school_enrollments; _c public.institutional_classes;
  _rec public.institutional_class_record_versions; _prev public.class_enrollment_episodes; _logical text := _id; _ended date;
  _ee public.cycle_enrollment_ending_versions; _upper date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'allocation:session-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'allocation:valid-from-required'; END IF;
  IF _ended_on IS NOT NULL AND _supersedes IS NOT NULL THEN RAISE EXCEPTION 'allocation:ending-on-correction-unsupported'; END IF;
  IF _ended_on IS NOT NULL AND _ended_on < _valid_from THEN RAISE EXCEPTION 'allocation:ending-before-start'; END IF;
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
  IF _ended_on IS NOT NULL THEN
    IF _p.valid_until IS NOT NULL AND _ended_on > _p.valid_until THEN RAISE EXCEPTION 'allocation:outside-participation'; END IF;
    IF _e.opened_on IS NOT NULL AND _valid_from < _e.opened_on THEN RAISE EXCEPTION 'allocation:outside-enrollment'; END IF;
    _ee := public.b3_enrollment_ending_head(_p.enrollment_logical_id);
    IF _ee.id IS NOT NULL AND NOT _ee.annulled AND _ee.ended_on IS NOT NULL AND _ended_on > _ee.ended_on THEN
      RAISE EXCEPTION 'allocation:outside-enrollment';
    END IF;
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
  ELSIF _ended_on IS NULL AND _p.valid_until IS NOT NULL THEN
    -- Participação delimitada: alocação aberta ultrapassaria o pai; exige término explícito.
    RAISE EXCEPTION 'allocation:open-beyond-participation';
  END IF;
  _upper := coalesce(_ended, _ended_on, _valid_from);
  BEGIN
    PERFORM public.class_fact_context(_class, _valid_from, _upper);
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
  IF _ended_on IS NOT NULL THEN
    -- Mesma transação: término versão 1, retificável depois por record_class_allocation_ending.
    INSERT INTO public.class_allocation_ending_versions(allocation_logical_id, school_id, class_id, version, supersedes_id, ended_on, annulled,
      reason_text, originating_act_ref, correction_reason, recorded_by)
    VALUES (_logical, _e.school_id, _class, 1, NULL, _ended_on, false, _ending_reason, _act_ref, NULL, auth.uid());
  END IF;
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.record_class_allocation(_id text, _participation_logical text, _class text, _valid_from date,
  _act_ref text, _supersedes text, _correction_reason text)
 RETURNS text
 LANGUAGE sql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
  SELECT public.record_class_allocation(_id, _participation_logical, _class, _valid_from, _act_ref, _supersedes, _correction_reason,
    NULL::date, NULL::text)
$function$;

REVOKE ALL ON FUNCTION public.record_class_allocation(text,text,text,date,text,text,text,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_class_allocation(text,text,text,date,text,text,text,date,text) TO authenticated;
REVOKE ALL ON FUNCTION public.record_class_allocation(text,text,text,date,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_class_allocation(text,text,text,date,text,text,text) TO authenticated;
