-- Logo da escola: versões append-only enviadas pela Direção da própria escola; a mais recente vale, as antigas ficam para documentos já emitidos.
CREATE TABLE public.school_logo_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  version int NOT NULL CHECK (version > 0),
  object_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  recorded_by_user uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, version)
);
REVOKE ALL ON public.school_logo_versions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.school_logo_versions TO service_role;
ALTER TABLE public.school_logo_versions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER slv_no_change BEFORE UPDATE OR DELETE ON public.school_logo_versions FOR EACH ROW EXECUTE FUNCTION public.sdo_immutable();

CREATE POLICY "logos envio pela direcao" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'escola-logos' AND public.sdo_is_direcao(split_part(name, '/', 1)));
CREATE POLICY "logos leitura autenticada" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'escola-logos');

CREATE OR REPLACE FUNCTION public.direcao_record_school_logo(_school text, _path text, _mime text, _size bigint, _sha256 text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE v int; obj record;
BEGIN
  IF NOT public.sdo_is_direcao(_school) THEN RAISE EXCEPTION 'logo:direcao-only'; END IF;
  IF split_part(_path, '/', 1) <> _school THEN RAISE EXCEPTION 'logo:path-invalid'; END IF;
  SELECT version INTO v FROM public.school_logo_versions WHERE object_path = _path;
  IF v IS NOT NULL THEN RETURN v; END IF;
  SELECT * INTO obj FROM storage.objects WHERE bucket_id = 'escola-logos' AND name = _path;
  IF obj.id IS NULL THEN RAISE EXCEPTION 'logo:file-missing'; END IF;
  IF (obj.metadata->>'size')::bigint IS DISTINCT FROM _size THEN RAISE EXCEPTION 'logo:file-size-mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('slv:' || _school));
  SELECT coalesce(max(version), 0) + 1 INTO v FROM public.school_logo_versions WHERE school_id = _school;
  INSERT INTO public.school_logo_versions(school_id, version, object_path, mime_type, size_bytes, sha256, recorded_by_user)
  VALUES (_school, v, _path, _mime, _size, lower(_sha256), auth.uid());
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.direcao_record_school_logo(text, text, text, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direcao_record_school_logo(text, text, text, bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.school_logo_at(_school text)
RETURNS TABLE(version int, object_path text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.version, l.object_path, l.created_at FROM public.school_logo_versions l
  WHERE l.school_id = _school AND auth.uid() IS NOT NULL ORDER BY l.version DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.school_logo_at(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_logo_at(text) TO authenticated;