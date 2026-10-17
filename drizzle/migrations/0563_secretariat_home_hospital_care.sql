CREATE TABLE public.student_home_hospital_care_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  care_id uuid NOT NULL,
  act text NOT NULL CHECK (act IN ('abrir','registrar','encerrar')),
  care_kind text CHECK (care_kind IN ('domiciliar','hospitalar')),
  occurred_on date NOT NULL,
  expected_end date,
  place text CHECK (place IS NULL OR length(place) <= 300),
  professional text CHECK (professional IS NULL OR length(professional) <= 200),
  note text CHECK (note IS NULL OR length(note) <= 2000),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (act <> 'abrir' OR (care_kind IS NOT NULL AND length(btrim(coalesce(note,''))) >= 5)),
  CHECK (act <> 'registrar' OR length(btrim(coalesce(note,''))) >= 5),
  CHECK (act <> 'encerrar' OR length(btrim(coalesce(note,''))) >= 5),
  CHECK (expected_end IS NULL OR expected_end >= occurred_on)
);
CREATE UNIQUE INDEX student_home_hospital_care_one_open ON public.student_home_hospital_care_events(care_id) WHERE act='abrir';
CREATE UNIQUE INDEX student_home_hospital_care_one_close ON public.student_home_hospital_care_events(care_id) WHERE act='encerrar';
CREATE INDEX student_home_hospital_care_student ON public.student_home_hospital_care_events(school_id, student_id);
GRANT SELECT ON public.student_home_hospital_care_events TO authenticated;
GRANT ALL ON public.student_home_hospital_care_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.student_home_hospital_care_events FROM authenticated, anon;
ALTER TABLE public.student_home_hospital_care_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_home_hospital_care_read ON public.student_home_hospital_care_events FOR SELECT TO authenticated
  USING (public.has_school_capability('manter-matricula-e-enturmacao', school_id));
CREATE TRIGGER student_home_hospital_care_immutable BEFORE UPDATE OR DELETE ON public.student_home_hospital_care_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.secretariat_home_hospital_care_act(_school text, _student text, _care uuid, _act text, _kind text, _on date, _expected_end date, _place text, _professional text, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE cid uuid := coalesce(_care, gen_random_uuid()); o record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'care:capability-missing'; END IF;
  IF _act NOT IN ('abrir','registrar','encerrar') THEN RAISE EXCEPTION 'care:act-invalid'; END IF;
  IF _on IS NULL OR _on > current_date THEN RAISE EXCEPTION 'care:date-invalid'; END IF;
  IF length(btrim(coalesce(_note,''))) < 5 THEN RAISE EXCEPTION 'care:note-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('care:'||_school||':'||_student));
  IF _act = 'abrir' THEN
    IF _care IS NOT NULL THEN RAISE EXCEPTION 'care:act-invalid'; END IF;
    IF _kind NOT IN ('domiciliar','hospitalar') THEN RAISE EXCEPTION 'care:kind-invalid'; END IF;
    IF _expected_end IS NOT NULL AND _expected_end < _on THEN RAISE EXCEPTION 'care:period-invalid'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.school_id=_school AND e.student_id=_student) THEN RAISE EXCEPTION 'care:not-a-student'; END IF;
    IF EXISTS (SELECT 1 FROM public.student_home_hospital_care_events a WHERE a.school_id=_school AND a.student_id=_student AND a.act='abrir'
       AND NOT EXISTS (SELECT 1 FROM public.student_home_hospital_care_events c WHERE c.care_id=a.care_id AND c.act='encerrar')) THEN RAISE EXCEPTION 'care:already-open'; END IF;
  ELSE
    SELECT * INTO o FROM public.student_home_hospital_care_events a WHERE a.care_id=_care AND a.act='abrir' AND a.school_id=_school AND a.student_id=_student;
    IF o IS NULL THEN RAISE EXCEPTION 'care:not-found'; END IF;
    IF EXISTS (SELECT 1 FROM public.student_home_hospital_care_events c WHERE c.care_id=_care AND c.act='encerrar') THEN RAISE EXCEPTION 'care:closed'; END IF;
    IF _on < o.occurred_on THEN RAISE EXCEPTION 'care:date-invalid'; END IF;
  END IF;
  INSERT INTO public.student_home_hospital_care_events(school_id,student_id,care_id,act,care_kind,occurred_on,expected_end,place,professional,note,recorded_by)
  VALUES (_school,_student,cid,_act,CASE WHEN _act='abrir' THEN _kind END,_on,CASE WHEN _act='abrir' THEN _expected_end END,nullif(btrim(_place),''),nullif(btrim(_professional),''),btrim(_note),auth.uid());
  RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_home_hospital_care_act(text,text,uuid,text,text,date,date,text,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_home_hospital_care_act(text,text,uuid,text,text,date,date,text,text,text) TO authenticated;