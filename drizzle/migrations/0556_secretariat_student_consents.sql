-- Termos e consentimentos do cadastro: manifestação real do responsável por termo e versão; nunca aceite presumido. Append-only.
CREATE TABLE public.student_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  term_key text NOT NULL CHECK (term_key IN ('uso-de-imagem','ciencia-de-faltas','saida-desacompanhada')),
  term_version integer NOT NULL CHECK (term_version >= 1),
  sequence integer NOT NULL CHECK (sequence >= 1),
  decision text NOT NULL CHECK (decision IN ('autoriza','nao-autoriza','ciente','revogado')),
  guardian_name text NOT NULL CHECK (length(btrim(guardian_name)) BETWEEN 5 AND 200),
  declared_on date NOT NULL,
  note text CHECK (note IS NULL OR length(note) <= 500),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, term_key, sequence)
);
GRANT SELECT ON public.student_consent_events TO authenticated;
GRANT ALL ON public.student_consent_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.student_consent_events FROM authenticated, anon, service_role;
ALTER TABLE public.student_consent_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_consent_school_read ON public.student_consent_events FOR SELECT TO authenticated
  USING (public.has_school_capability('manter-matricula-e-enturmacao', school_id));
CREATE TRIGGER student_consent_immutable BEFORE UPDATE OR DELETE ON public.student_consent_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.secretariat_record_consent(_school text, _student text, _term text, _version integer, _decision text, _guardian text, _declared_on date, _note text, _expected_sequence integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE cur integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'consent:capability-missing'; END IF;
  IF _term NOT IN ('uso-de-imagem','ciencia-de-faltas','saida-desacompanhada') THEN RAISE EXCEPTION 'consent:term-invalid'; END IF;
  IF (_term = 'ciencia-de-faltas' AND _decision NOT IN ('ciente'))
     OR (_term <> 'ciencia-de-faltas' AND _decision NOT IN ('autoriza','nao-autoriza','revogado')) THEN RAISE EXCEPTION 'consent:decision-invalid'; END IF;
  IF _declared_on IS NULL OR _declared_on > current_date THEN RAISE EXCEPTION 'consent:date-invalid'; END IF;
  IF length(btrim(coalesce(_guardian,''))) < 5 THEN RAISE EXCEPTION 'consent:guardian-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.school_id=_school AND e.student_id=_student) THEN RAISE EXCEPTION 'consent:not-a-student'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('consent:'||_school||':'||_student||':'||_term));
  SELECT coalesce(max(c.sequence),0) INTO cur FROM public.student_consent_events c WHERE c.school_id=_school AND c.student_id=_student AND c.term_key=_term;
  IF cur <> coalesce(_expected_sequence,0) THEN RAISE EXCEPTION 'consent:stale-base'; END IF;
  INSERT INTO public.student_consent_events(school_id,student_id,term_key,term_version,sequence,decision,guardian_name,declared_on,note,recorded_by)
  VALUES (_school,_student,_term,_version,cur+1,_decision,btrim(_guardian),_declared_on,nullif(btrim(_note),''),auth.uid());
  RETURN cur+1;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_record_consent(text,text,text,integer,text,text,date,text,integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_record_consent(text,text,text,integer,text,text,date,text,integer) TO authenticated;