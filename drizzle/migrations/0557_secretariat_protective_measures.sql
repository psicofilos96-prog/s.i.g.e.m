-- Medidas protetivas / restrição de retirada: sigilosas. Sem SELECT direto; alerta operacional separado do conteúdo judicial.
CREATE TABLE public.student_protection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  measure_id uuid NOT NULL,
  seq integer NOT NULL CHECK (seq >= 1),
  action text NOT NULL CHECK (action IN ('registrar','corrigir','encerrar')),
  kind text NOT NULL CHECK (kind IN ('impedimento-de-retirada','medida-protetiva','guarda-judicial')),
  restricted_person text CHECK (restricted_person IS NULL OR length(btrim(restricted_person)) BETWEEN 3 AND 200),
  valid_from date NOT NULL,
  valid_until date,
  summary text CHECK (summary IS NULL OR length(summary) <= 1000),
  document_path text CHECK (document_path IS NULL OR document_path ~ '^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+$'),
  reason text CHECK (reason IS NULL OR length(reason) <= 500),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (measure_id, seq),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
CREATE TABLE public.student_protection_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL, student_id text NOT NULL, measure_id uuid, what text NOT NULL,
  accessed_by uuid NOT NULL, accessed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.student_protection_events, public.student_protection_access_log TO service_role;
REVOKE ALL ON public.student_protection_events, public.student_protection_access_log FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.student_protection_events, public.student_protection_access_log FROM service_role;
ALTER TABLE public.student_protection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_protection_access_log ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER student_protection_immutable BEFORE UPDATE OR DELETE ON public.student_protection_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER student_protection_log_immutable BEFORE UPDATE OR DELETE ON public.student_protection_access_log FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.secretariat_record_protection(_school text, _student text, _measure uuid, _action text, _kind text, _person text,
  _from date, _until date, _summary text, _document text, _reason text, _expected_seq integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE m uuid := coalesce(_measure, gen_random_uuid()); cur integer; last text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'protection:capability-missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.school_id=_school AND e.student_id=_student) THEN RAISE EXCEPTION 'protection:not-a-student'; END IF;
  IF _document IS NOT NULL AND split_part(_document,'/',1) <> _school THEN RAISE EXCEPTION 'protection:document-path'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('protection:'||m::text));
  SELECT coalesce(max(p.seq),0) INTO cur FROM public.student_protection_events p WHERE p.measure_id = m;
  IF cur <> coalesce(_expected_seq,0) THEN RAISE EXCEPTION 'protection:stale-base'; END IF;
  IF cur > 0 AND NOT EXISTS (SELECT 1 FROM public.student_protection_events p WHERE p.measure_id=m AND p.school_id=_school AND p.student_id=_student) THEN RAISE EXCEPTION 'protection:not-found'; END IF;
  SELECT p.action INTO last FROM public.student_protection_events p WHERE p.measure_id=m ORDER BY p.seq DESC LIMIT 1;
  IF NOT ((_action='registrar' AND cur=0) OR (_action IN ('corrigir','encerrar') AND cur>0 AND last <> 'encerrar')) THEN RAISE EXCEPTION 'protection:transition-invalid'; END IF;
  IF _action <> 'registrar' AND length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'protection:reason-required'; END IF;
  IF _kind = 'impedimento-de-retirada' AND length(btrim(coalesce(_person,''))) < 3 THEN RAISE EXCEPTION 'protection:person-required'; END IF;
  IF _from IS NULL THEN RAISE EXCEPTION 'protection:date-invalid'; END IF;
  INSERT INTO public.student_protection_events(school_id,student_id,measure_id,seq,action,kind,restricted_person,valid_from,valid_until,summary,document_path,reason,recorded_by)
  VALUES (_school,_student,m,cur+1,_action,_kind,nullif(btrim(_person),''),_from,
    CASE WHEN _action='encerrar' THEN coalesce(_until,current_date) ELSE _until END,
    nullif(btrim(_summary),''),_document,nullif(btrim(_reason),''),auth.uid());
  RETURN m;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_record_protection(text,text,uuid,text,text,text,date,date,text,text,text,integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_record_protection(text,text,uuid,text,text,text,date,date,text,text,text,integer) TO authenticated;

-- Alerta operacional: só tipo, pessoa impedida e vigência; nunca o conteúdo judicial.
CREATE OR REPLACE FUNCTION public.student_protection_alerts(_school text, _student text)
RETURNS TABLE(measure_id uuid, seq integer, kind text, restricted_person text, valid_from date, valid_until date, active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'protection:capability-missing'; END IF;
  RETURN QUERY SELECT DISTINCT ON (p.measure_id) p.measure_id, p.seq, p.kind, p.restricted_person, p.valid_from, p.valid_until,
      (p.action <> 'encerrar' AND p.valid_from <= current_date AND (p.valid_until IS NULL OR p.valid_until >= current_date))
    FROM public.student_protection_events p WHERE p.school_id=_school AND p.student_id=_student ORDER BY p.measure_id, p.seq DESC;
END $$;
REVOKE ALL ON FUNCTION public.student_protection_alerts(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_protection_alerts(text,text) TO authenticated;

-- Conteúdo sigiloso: cada leitura fica registrada.
CREATE OR REPLACE FUNCTION public.student_protection_detail(_school text, _measure uuid)
RETURNS TABLE(seq integer, action text, kind text, restricted_person text, valid_from date, valid_until date, summary text, document_path text, reason text, recorded_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE st text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'protection:capability-missing'; END IF;
  SELECT p.student_id INTO st FROM public.student_protection_events p WHERE p.measure_id=_measure AND p.school_id=_school LIMIT 1;
  IF st IS NULL THEN RAISE EXCEPTION 'protection:not-found'; END IF;
  INSERT INTO public.student_protection_access_log(school_id,student_id,measure_id,what,accessed_by) VALUES (_school,st,_measure,'detalhe',auth.uid());
  RETURN QUERY SELECT p.seq,p.action,p.kind,p.restricted_person,p.valid_from,p.valid_until,p.summary,p.document_path,p.reason,p.recorded_at
    FROM public.student_protection_events p WHERE p.measure_id=_measure ORDER BY p.seq;
END $$;
REVOKE ALL ON FUNCTION public.student_protection_detail(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_protection_detail(text,uuid) TO authenticated;

CREATE POLICY "protecao-judicial envio pela escola" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'protecao-judicial' AND public.has_school_capability('manter-matricula-e-enturmacao', (storage.foldername(name))[1]));
CREATE POLICY "protecao-judicial leitura pela escola" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'protecao-judicial' AND public.has_school_capability('manter-matricula-e-enturmacao', (storage.foldername(name))[1]));