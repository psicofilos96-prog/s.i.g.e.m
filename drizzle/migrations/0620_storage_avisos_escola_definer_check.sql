CREATE OR REPLACE FUNCTION public.avisos_escola_can_upload(_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.institutional_sector_principals p
    WHERE p.auth_user_id = auth.uid() AND p.station_code = 'direcao_escolar'
      AND p.school_id = (storage.foldername(_name))[1])
$$;
REVOKE ALL ON FUNCTION public.avisos_escola_can_upload(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avisos_escola_can_upload(text) TO authenticated;
DROP POLICY IF EXISTS "avisos-escola envio pela Direção" ON storage.objects;
CREATE POLICY "avisos-escola envio pela Direção" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avisos-escola' AND public.avisos_escola_can_upload(name));