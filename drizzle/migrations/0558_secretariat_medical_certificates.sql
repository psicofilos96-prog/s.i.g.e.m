-- Atestados e justificativas de faltas: documento entregue pelo responsável, registrado pela Secretaria. Não altera a chamada do professor; só declara o período amparado. Append-only; anular é novo evento com motivo. CID nunca é guardado.
CREATE TABLE public.student_absence_justification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  justification_id uuid NOT NULL,
  act text NOT NULL CHECK (act IN ('registrar','anular')),
  doc_kind text CHECK (doc_kind IN ('atestado-medico','atestado-odontologico','declaracao-comparecimento','outro-amparo-legal')),
  starts_on date,
  ends_on date,
  issuer_name text CHECK (issuer_name IS NULL OR length(btrim(issuer_name)) BETWEEN 3 AND 200),
  issuer_registry text CHECK (issuer_registry IS NULL OR length(issuer_registry) <= 60),
  delivered_by text CHECK (delivered_by IS NULL OR length(btrim(delivered_by)) BETWEEN 3 AND 200),
  delivered_on date,
  reason text CHECK (reason IS NULL OR length(reason) <= 500),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (act <> 'registrar' OR (doc_kind IS NOT NULL AND starts_on IS NOT NULL AND ends_on IS NOT NULL AND ends_on >= starts_on AND delivered_on IS NOT NULL AND issuer_name IS NOT NULL)),
  CHECK (act <> 'anular' OR length(btrim(coalesce(reason,''))) >= 5)
);
CREATE UNIQUE INDEX student_absence_justification_one_register ON public.student_absence_justification_events(justification_id) WHERE act='registrar';
CREATE UNIQUE INDEX student_absence_justification_one_void ON public.student_absence_justification_events(justification_id) WHERE act='anular';
CREATE INDEX student_absence_justification_student ON public.student_absence_justification_events(school_id, student_id);
GRANT SELECT ON public.student_absence_justification_events TO authenticated;
GRANT ALL ON public.student_absence_justification_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.student_absence_justification_events FROM authenticated, anon, service_role;
ALTER TABLE public.student_absence_justification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_absence_justification_read ON public.student_absence_justification_events FOR SELECT TO authenticated
  USING (public.has_school_capability('manter-matricula-e-enturmacao', school_id));
CREATE TRIGGER student_absence_justification_immutable BEFORE UPDATE OR DELETE ON public.student_absence_justification_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.secretariat_record_absence_justification(_school text, _student text, _kind text, _starts date, _ends date, _issuer text, _registry text, _delivered_by text, _delivered_on date, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE jid uuid := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'justification:capability-missing'; END IF;
  IF _kind NOT IN ('atestado-medico','atestado-odontologico','declaracao-comparecimento','outro-amparo-legal') THEN RAISE EXCEPTION 'justification:kind-invalid'; END IF;
  IF _starts IS NULL OR _ends IS NULL OR _ends < _starts THEN RAISE EXCEPTION 'justification:period-invalid'; END IF;
  IF _ends - _starts > 365 THEN RAISE EXCEPTION 'justification:period-too-long'; END IF;
  IF _delivered_on IS NULL OR _delivered_on > current_date THEN RAISE EXCEPTION 'justification:date-invalid'; END IF;
  IF length(btrim(coalesce(_issuer,''))) < 3 THEN RAISE EXCEPTION 'justification:issuer-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.school_id=_school AND e.student_id=_student) THEN RAISE EXCEPTION 'justification:not-a-student'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('justif:'||_school||':'||_student));
  IF EXISTS (SELECT 1 FROM public.student_absence_justification_events r WHERE r.school_id=_school AND r.student_id=_student AND r.act='registrar'
     AND r.starts_on=_starts AND r.ends_on=_ends AND r.doc_kind=_kind
     AND NOT EXISTS (SELECT 1 FROM public.student_absence_justification_events v WHERE v.justification_id=r.justification_id AND v.act='anular'))
  THEN RAISE EXCEPTION 'justification:duplicate'; END IF;
  INSERT INTO public.student_absence_justification_events(school_id,student_id,justification_id,act,doc_kind,starts_on,ends_on,issuer_name,issuer_registry,delivered_by,delivered_on,reason,recorded_by)
  VALUES (_school,_student,jid,'registrar',_kind,_starts,_ends,btrim(_issuer),nullif(btrim(_registry),''),nullif(btrim(_delivered_by),''),_delivered_on,nullif(btrim(_note),''),auth.uid());
  RETURN jid;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_record_absence_justification(text,text,text,date,date,text,text,text,date,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_record_absence_justification(text,text,text,date,date,text,text,text,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.secretariat_void_absence_justification(_justification uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r public.student_absence_justification_events;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  SELECT * INTO r FROM public.student_absence_justification_events WHERE justification_id=_justification AND act='registrar';
  IF r.id IS NULL THEN RAISE EXCEPTION 'justification:not-found'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', r.school_id) THEN RAISE EXCEPTION 'justification:capability-missing'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'justification:reason-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.student_absence_justification_events WHERE justification_id=_justification AND act='anular') THEN RAISE EXCEPTION 'justification:already-void'; END IF;
  INSERT INTO public.student_absence_justification_events(school_id,student_id,justification_id,act,reason,recorded_by)
  VALUES (r.school_id,r.student_id,_justification,'anular',btrim(_reason),auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.secretariat_void_absence_justification(uuid,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_void_absence_justification(uuid,text) TO authenticated;