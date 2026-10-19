-- Anexos probatórios do Caderno Negro: bucket privado, caminho <escola>/<ocorrência>/<arquivo>, sem troca nem exclusão.
CREATE TABLE public.school_disciplinary_occurrence_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id uuid NOT NULL REFERENCES public.school_disciplinary_occurrences(id),
  school_id text NOT NULL,
  object_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(btrim(file_name)) > 0),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  recorded_by_user uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.school_disciplinary_occurrence_attachments FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.school_disciplinary_occurrence_attachments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER sdoa_no_change BEFORE UPDATE OR DELETE ON public.school_disciplinary_occurrence_attachments FOR EACH ROW EXECUTE FUNCTION public.sdo_immutable();

CREATE OR REPLACE FUNCTION public.sdo_is_direcao(_school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.auth_user_id = auth.uid()
    AND p.station_code = 'direcao_escolar' AND p.school_id = _school)
$$;
REVOKE ALL ON FUNCTION public.sdo_is_direcao(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sdo_is_direcao(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sdo_upload_allowed(_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.school_disciplinary_occurrences o
    WHERE o.school_id = split_part(_path, '/', 1) AND o.id::text = split_part(_path, '/', 2)
      AND public.sdo_is_direcao(o.school_id))
$$;
REVOKE ALL ON FUNCTION public.sdo_upload_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sdo_upload_allowed(text) TO authenticated;

CREATE POLICY "ocorrencias anexos envio pela direcao" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ocorrencias-anexos' AND public.sdo_upload_allowed(name));
CREATE POLICY "ocorrencias anexos leitura autorizada" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ocorrencias-anexos' AND public.sdo_can_read(split_part(name, '/', 1)));

CREATE OR REPLACE FUNCTION public.direcao_attach_occurrence_file(_occurrence uuid, _path text, _name text, _mime text, _size bigint, _sha256 text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE o record; nid uuid; obj record;
BEGIN
  SELECT * INTO o FROM public.school_disciplinary_occurrences WHERE id = _occurrence;
  IF o.id IS NULL OR NOT public.sdo_is_direcao(o.school_id) THEN RAISE EXCEPTION 'occurrence:direcao-only'; END IF;
  IF split_part(_path, '/', 1) <> o.school_id OR split_part(_path, '/', 2) <> o.id::text THEN RAISE EXCEPTION 'occurrence:path-invalid'; END IF;
  SELECT id INTO nid FROM public.school_disciplinary_occurrence_attachments WHERE object_path = _path;
  IF nid IS NOT NULL THEN RETURN nid; END IF;
  SELECT * INTO obj FROM storage.objects WHERE bucket_id = 'ocorrencias-anexos' AND name = _path;
  IF obj.id IS NULL THEN RAISE EXCEPTION 'occurrence:file-missing'; END IF;
  IF (obj.metadata->>'size')::bigint IS DISTINCT FROM _size THEN RAISE EXCEPTION 'occurrence:file-size-mismatch'; END IF;
  INSERT INTO public.school_disciplinary_occurrence_attachments(occurrence_id, school_id, object_path, file_name, mime_type, size_bytes, sha256, recorded_by_user)
  VALUES (o.id, o.school_id, _path, btrim(_name), _mime, _size, lower(_sha256), auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.direcao_attach_occurrence_file(uuid, text, text, text, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direcao_attach_occurrence_file(uuid, text, text, text, bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.occurrence_attachments_at(_school text)
RETURNS TABLE(id uuid, occurrence_id uuid, object_path text, file_name text, mime_type text, size_bytes bigint, sha256 text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.sdo_can_read(_school) THEN RAISE EXCEPTION 'occurrence:not-authorized'; END IF;
  RETURN QUERY SELECT a.id, a.occurrence_id, a.object_path, a.file_name, a.mime_type, a.size_bytes, a.sha256, a.created_at
    FROM public.school_disciplinary_occurrence_attachments a WHERE a.school_id = _school ORDER BY a.created_at;
END $$;
REVOKE ALL ON FUNCTION public.occurrence_attachments_at(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.occurrence_attachments_at(text) TO authenticated;