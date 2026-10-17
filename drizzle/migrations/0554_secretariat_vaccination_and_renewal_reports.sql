CREATE TABLE public.student_vaccination_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  status text NOT NULL CHECK (status IN ('em-dia','pendente')),
  declared_on date NOT NULL,
  due_on date,
  note text CHECK (note IS NULL OR length(note) <= 500),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, sequence)
);
COMMENT ON TABLE public.student_vaccination_status_events IS 'Situação vacinal declarada pela Secretaria (comprovante em dia ou pendente com prazo de 30 dias). Append-only; situação atual = última sequência.';
GRANT SELECT ON public.student_vaccination_status_events TO authenticated;
GRANT ALL ON public.student_vaccination_status_events TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.student_vaccination_status_events FROM authenticated, service_role;
ALTER TABLE public.student_vaccination_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_vaccination_school_read ON public.student_vaccination_status_events FOR SELECT TO authenticated
  USING (public.has_school_capability('manter-matricula-e-enturmacao', school_id));
CREATE TRIGGER student_vaccination_immutable BEFORE UPDATE OR DELETE ON public.student_vaccination_status_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.secretariat_record_vaccination(_school text, _student text, _status text, _declared_on date, _note text, _expected_sequence integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE cur integer; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'vaccination:capability-missing'; END IF;
  IF _status NOT IN ('em-dia','pendente') THEN RAISE EXCEPTION 'vaccination:status-invalid'; END IF;
  IF _declared_on IS NULL OR _declared_on > current_date THEN RAISE EXCEPTION 'vaccination:date-invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.school_id=_school AND e.student_id=_student) THEN RAISE EXCEPTION 'vaccination:not-a-student'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vaccination:'||_school||':'||_student));
  SELECT coalesce(max(v.sequence),0) INTO cur FROM public.student_vaccination_status_events v WHERE v.school_id=_school AND v.student_id=_student;
  IF cur <> coalesce(_expected_sequence,0) THEN RAISE EXCEPTION 'vaccination:stale-base'; END IF;
  INSERT INTO public.student_vaccination_status_events(school_id,student_id,sequence,status,declared_on,due_on,note,recorded_by)
  VALUES (_school,_student,cur+1,_status,_declared_on, CASE WHEN _status='pendente' THEN _declared_on + 30 END, nullif(btrim(_note),''), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_record_vaccination(text,text,text,date,text,integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_record_vaccination(text,text,text,date,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.secretariat_own_school_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT p.school_id FROM public.institutional_sector_principals p WHERE p.auth_user_id=auth.uid() AND p.scope_kind='school' AND p.school_id IS NOT NULL ORDER BY p.created_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.secretariat_own_school_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_own_school_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.secretariat_own_vaccination_report()
RETURNS TABLE(student_id text, student_name text, status text, declared_on date, due_on date, sequence integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s text := public.secretariat_own_school_id();
BEGIN
  IF s IS NULL THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', s) THEN RAISE EXCEPTION 'vaccination:capability-missing'; END IF;
  RETURN QUERY SELECT DISTINCT ON (v.student_id) v.student_id, st.display_name, v.status, v.declared_on, v.due_on, v.sequence
    FROM public.student_vaccination_status_events v JOIN public.institutional_students st ON st.id=v.student_id
    WHERE v.school_id=s ORDER BY v.student_id, v.sequence DESC;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_own_vaccination_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_own_vaccination_report() TO authenticated;

CREATE OR REPLACE FUNCTION public.secretariat_own_renewal_pending(_from_label text, _to_label text)
RETURNS TABLE(student_id text, student_name text, decision text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s text := public.secretariat_own_school_id(); f text; t text;
BEGIN
  IF s IS NULL THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  SELECT y.academic_year_id INTO f FROM public.institutional_academic_year_versions y WHERE y.official_name = 'Ano letivo '||_from_label ORDER BY y.version DESC LIMIT 1;
  SELECT y.academic_year_id INTO t FROM public.institutional_academic_year_versions y WHERE y.official_name = 'Ano letivo '||_to_label ORDER BY y.version DESC LIMIT 1;
  IF f IS NULL OR t IS NULL THEN RAISE EXCEPTION 'transition:year-not-found'; END IF;
  RETURN QUERY SELECT c.student_id, c.display_name, c.decision FROM public.year_transition_candidates(s, f, t) c WHERE c.decision IS NULL OR c.decision = 'nao-renovou';
END $$;
REVOKE ALL ON FUNCTION public.secretariat_own_renewal_pending(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_own_renewal_pending(text,text) TO authenticated;