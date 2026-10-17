CREATE TABLE public.school_infrequency_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  period_from date NOT NULL,
  period_to date NOT NULL CHECK (period_to >= period_from),
  present integer NOT NULL CHECK (present >= 0),
  absent integer NOT NULL CHECK (absent >= 0),
  threshold numeric NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX school_infrequency_notices_s ON public.school_infrequency_notices(school_id, student_id);
GRANT SELECT ON public.school_infrequency_notices TO authenticated;
GRANT ALL ON public.school_infrequency_notices TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.school_infrequency_notices FROM authenticated, anon;
ALTER TABLE public.school_infrequency_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_infrequency_notices_read ON public.school_infrequency_notices FOR SELECT TO authenticated
  USING (public.has_school_capability('manter-matricula-e-enturmacao', school_id));
CREATE TRIGGER school_infrequency_notices_immutable BEFORE UPDATE OR DELETE ON public.school_infrequency_notices FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.secretariat_own_infrequency(_from date, _to date)
RETURNS TABLE(student_id text, student_name text, present integer, absent integer, rate numeric, threshold numeric, last_notice date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s text := public.secretariat_own_school_id(); thr numeric := public.aa_infrequency_threshold();
BEGIN
  IF s IS NULL THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', s) THEN RAISE EXCEPTION 'infrequency:capability-missing'; END IF;
  IF _from IS NULL OR _to IS NULL OR _to < _from THEN RAISE EXCEPTION 'infrequency:period-invalid'; END IF;
  IF thr IS NOT NULL AND thr <= 1 THEN thr := thr * 100; END IF;
  RETURN QUERY
  WITH a AS (SELECT f.student_id sid, sum(f.present)::int p, sum(f.absent)::int ab FROM public.aa_infrequency_at(s,_from,_to) f GROUP BY f.student_id)
  SELECT a.sid, st.display_name, a.p, a.ab, round(100.0*a.p/(a.p+a.ab),1), thr,
    (SELECT max(n.recorded_at)::date FROM public.school_infrequency_notices n WHERE n.school_id=s AND n.student_id=a.sid)
  FROM a JOIN public.institutional_students st ON st.id=a.sid
  WHERE thr IS NOT NULL AND a.p + a.ab > 0 AND 100.0*a.p/(a.p+a.ab) < thr
  ORDER BY 5, 2;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_own_infrequency(date,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_own_infrequency(date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.secretariat_record_infrequency_notice(_student text, _from date, _to date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s text := public.secretariat_own_school_id(); r record; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF s IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', s) THEN RAISE EXCEPTION 'infrequency:capability-missing'; END IF;
  SELECT * INTO r FROM public.secretariat_own_infrequency(_from,_to) x WHERE x.student_id=_student;
  IF r IS NULL THEN RAISE EXCEPTION 'infrequency:not-below-threshold'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('infreq:'||s||':'||_student));
  IF EXISTS (SELECT 1 FROM public.school_infrequency_notices n WHERE n.school_id=s AND n.student_id=_student AND n.recorded_at::date=current_date) THEN RAISE EXCEPTION 'infrequency:already-today'; END IF;
  INSERT INTO public.school_infrequency_notices(school_id,student_id,period_from,period_to,present,absent,threshold,recorded_by)
  VALUES (s,_student,_from,_to,r.present,r.absent,r.threshold,auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_record_infrequency_notice(text,date,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_record_infrequency_notice(text,date,date) TO authenticated;