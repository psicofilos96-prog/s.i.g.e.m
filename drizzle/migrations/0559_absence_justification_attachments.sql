CREATE TABLE public.student_absence_justification_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  justification_id uuid NOT NULL,
  school_id text NOT NULL,
  object_path text NOT NULL UNIQUE,
  mime text NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp','application/pdf')),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_absence_justification_attachments_j ON public.student_absence_justification_attachments(justification_id);
GRANT SELECT ON public.student_absence_justification_attachments TO authenticated;
GRANT ALL ON public.student_absence_justification_attachments TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.student_absence_justification_attachments FROM authenticated, anon;
ALTER TABLE public.student_absence_justification_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_absence_justification_attachments_read ON public.student_absence_justification_attachments FOR SELECT TO authenticated
  USING (public.has_school_capability('manter-matricula-e-enturmacao', school_id));
CREATE TRIGGER student_absence_justification_attachments_immutable BEFORE UPDATE OR DELETE ON public.student_absence_justification_attachments FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.secretariat_attach_absence_justification(_justification uuid, _path text, _mime text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE sch text; aid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  SELECT r.school_id INTO sch FROM public.student_absence_justification_events r WHERE r.justification_id=_justification AND r.act='registrar';
  IF sch IS NULL THEN RAISE EXCEPTION 'justification:not-found'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', sch) THEN RAISE EXCEPTION 'justification:capability-missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.student_absence_justification_events v WHERE v.justification_id=_justification AND v.act='anular') THEN RAISE EXCEPTION 'justification:already-void'; END IF;
  IF split_part(_path,'/',1) <> sch OR split_part(_path,'/',2) <> _justification::text THEN RAISE EXCEPTION 'justification:path-invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='atestados' AND o.name=_path) THEN RAISE EXCEPTION 'justification:file-missing'; END IF;
  INSERT INTO public.student_absence_justification_attachments(justification_id,school_id,object_path,mime,recorded_by)
  VALUES (_justification,sch,_path,_mime,auth.uid()) RETURNING id INTO aid;
  RETURN aid;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_attach_absence_justification(uuid,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_attach_absence_justification(uuid,text,text) TO authenticated;

CREATE POLICY "atestados envio pela escola" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'atestados' AND public.has_school_capability('manter-matricula-e-enturmacao', (storage.foldername(name))[1]));
CREATE POLICY "atestados leitura pela escola" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'atestados' AND public.has_school_capability('manter-matricula-e-enturmacao', (storage.foldername(name))[1]));