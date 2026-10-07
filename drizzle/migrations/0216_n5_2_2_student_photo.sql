-- N5.2.2 — foto 3×4: referência canônica do estudante (append-only) aponta para o MESMO objeto enviado no rascunho; nunca copia o arquivo.
CREATE TABLE public.student_photo_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  school_id text NOT NULL,
  object_path text NOT NULL,
  source_draft_id uuid NOT NULL,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_draft_id)
);
REVOKE ALL ON public.student_photo_versions FROM PUBLIC, anon, authenticated, sandbox_exec;
GRANT SELECT ON public.student_photo_versions TO service_role;
ALTER TABLE public.student_photo_versions ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.student_photo_versions_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'student-photo:append-only'; END $$;
CREATE TRIGGER student_photo_versions_immutable BEFORE UPDATE OR DELETE ON public.student_photo_versions
  FOR EACH ROW EXECUTE FUNCTION public.student_photo_versions_immutable();

-- Vincula a foto do rascunho CONCLUÍDO ao estudante resultante (idempotente por rascunho).
CREATE OR REPLACE FUNCTION public.enrollment_photo_bind(_draft uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE e public.enrollment_wizard_draft_events; p text; sid text;
BEGIN
  PERFORM public.sec_actor();
  SELECT * INTO e FROM public.enrollment_wizard_draft_events WHERE draft_id = _draft AND kind = 'concluido';
  IF e.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', e.school_id) THEN RAISE EXCEPTION 'draft:not-found'; END IF;
  SELECT x.payload #>> '{foto,path}' INTO p FROM public.enrollment_wizard_draft_events x
    WHERE x.draft_id = _draft AND x.kind = 'salvo' ORDER BY x.sequence DESC LIMIT 1;
  sid := e.result ->> 'student_id';
  IF p IS NULL OR sid IS NULL THEN RETURN NULL; END IF;
  IF p NOT LIKE (e.school_id || '/' || _draft::text || '/%') THEN RAISE EXCEPTION 'draft:photo-path-invalid'; END IF;
  INSERT INTO public.student_photo_versions(student_id, school_id, object_path, source_draft_id, recorded_by)
    VALUES (sid, e.school_id, p, _draft, auth.uid()) ON CONFLICT (source_draft_id) DO NOTHING;
  RETURN p;
END $$;
REVOKE ALL ON FUNCTION public.enrollment_photo_bind(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enrollment_photo_bind(uuid) TO authenticated;

-- Foto vigente do estudante na escola (para URL assinada); só quem mantém ou consulta matrícula da escola.
CREATE OR REPLACE FUNCTION public.student_photo_current(_school text, _student text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT (public.has_school_capability('manter-matricula-e-enturmacao', _school) OR public.has_school_capability('consultar-matricula-e-movimentacao', _school)) THEN
    RAISE EXCEPTION 'secretariat:not-found'; END IF;
  RETURN (SELECT v.object_path FROM public.student_photo_versions v WHERE v.student_id = _student AND v.school_id = _school ORDER BY v.created_at DESC LIMIT 1);
END $$;
REVOKE ALL ON FUNCTION public.student_photo_current(text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.student_photo_current(text, text) TO authenticated;

-- Envio só JPEG/PNG/WEBP, dentro de <escola>/<rascunho>/; foto já vinculada a estudante nunca é apagada por usuário.
DROP POLICY IF EXISTS fotos_estudantes_insert ON storage.objects;
CREATE POLICY fotos_estudantes_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-estudantes'
    AND public.has_school_capability('manter-matricula-e-enturmacao', (storage.foldername(name))[1])
    AND pg_catalog.lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp'));
CREATE POLICY fotos_estudantes_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fotos-estudantes'
    AND public.has_school_capability('manter-matricula-e-enturmacao', (storage.foldername(name))[1])
    AND NOT EXISTS (SELECT 1 FROM public.student_photo_versions v WHERE v.object_path = name));
