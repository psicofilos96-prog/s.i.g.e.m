CREATE TABLE public.student_document_pendency_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pendency_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  enrollment_id text NOT NULL REFERENCES public.school_enrollments(id),
  school_id text NOT NULL,
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 200),
  status text NOT NULL CHECK (status IN ('pendente','recebido','invalido','vencido','dispensado')),
  due_on date,
  note text CHECK (note IS NULL OR length(note) <= 1000),
  actor_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pendency_id, version)
);
COMMENT ON TABLE public.student_document_pendency_events IS 'Pendência documental manual da Secretaria; não afirma obrigação legal. Append-only.';
REVOKE ALL ON public.student_document_pendency_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.student_document_pendency_events TO service_role;
ALTER TABLE public.student_document_pendency_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.student_document_pendency_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'pendency:append-only'; END $$;
CREATE TRIGGER student_document_pendency_events_immutable BEFORE UPDATE OR DELETE ON public.student_document_pendency_events
  FOR EACH ROW EXECUTE FUNCTION public.student_document_pendency_immutable();

CREATE OR REPLACE FUNCTION public.record_student_document_pendency(_pendency uuid, _expected_version integer, _enrollment text, _description text, _status text, _due_on date, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE head public.student_document_pendency_events; sch text; pid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _status NOT IN ('pendente','recebido','invalido','vencido','dispensado') THEN RAISE EXCEPTION 'pendency:status-invalid'; END IF;
  IF _pendency IS NULL THEN
    SELECT e.school_id INTO sch FROM public.school_enrollments e WHERE e.id = _enrollment;
    IF sch IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', sch) THEN RAISE EXCEPTION 'pendency:not-found'; END IF;
    IF _status <> 'pendente' THEN RAISE EXCEPTION 'pendency:must-open-pending'; END IF;
    pid := gen_random_uuid();
    INSERT INTO public.student_document_pendency_events(pendency_id, version, enrollment_id, school_id, description, status, due_on, note, actor_user_id)
    VALUES (pid, 1, _enrollment, sch, btrim(_description), 'pendente', _due_on, nullif(btrim(_note), ''), auth.uid());
    RETURN pid;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('pendency:' || _pendency::text));
  SELECT * INTO head FROM public.student_document_pendency_events p WHERE p.pendency_id = _pendency ORDER BY p.version DESC LIMIT 1;
  IF head.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', head.school_id) THEN RAISE EXCEPTION 'pendency:not-found'; END IF;
  IF head.version <> coalesce(_expected_version, -1) THEN RAISE EXCEPTION 'pendency:head-changed'; END IF;
  INSERT INTO public.student_document_pendency_events(pendency_id, version, enrollment_id, school_id, description, status, due_on, note, actor_user_id)
  VALUES (head.pendency_id, head.version + 1, head.enrollment_id, head.school_id,
    coalesce(nullif(btrim(_description), ''), head.description), _status, _due_on, nullif(btrim(_note), ''), auth.uid());
  RETURN head.pendency_id;
END $$;
REVOKE ALL ON FUNCTION public.record_student_document_pendency(uuid, integer, text, text, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_student_document_pendency(uuid, integer, text, text, text, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.student_document_pendencies(_school text)
RETURNS TABLE(pendency_id uuid, version integer, enrollment_id text, student_id text, description text, status text, due_on date, note text, recorded_at timestamptz, is_current boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RETURN; END IF;
  RETURN QUERY SELECT p.pendency_id, p.version, p.enrollment_id, e.student_id::text, p.description, p.status, p.due_on, p.note, p.recorded_at,
    p.version = max(p.version) OVER (PARTITION BY p.pendency_id)
    FROM public.student_document_pendency_events p JOIN public.school_enrollments e ON e.id = p.enrollment_id
    WHERE p.school_id = _school ORDER BY p.pendency_id, p.version;
END $$;
REVOKE ALL ON FUNCTION public.student_document_pendencies(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_document_pendencies(text) TO authenticated;