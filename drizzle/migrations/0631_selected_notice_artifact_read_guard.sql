-- Only the selected network-notice storage read finding; keep canonical institutional audience.
CREATE OR REPLACE FUNCTION public.security_network_notice_image_readable(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT public.security_catalog_reader() AND EXISTS (
    SELECT 1 FROM public.network_notices n WHERE n.image_path = _name
  )
$$;
REVOKE ALL ON FUNCTION public.security_network_notice_image_readable(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_network_notice_image_readable(text) TO authenticated;
COMMENT ON FUNCTION public.security_network_notice_image_readable(text) IS 'Only canonical institutional readers may read registered network-notice images; ownership independently permits upload previews.';
ALTER POLICY "avisos-rede leitura autenticada" ON storage.objects TO authenticated
  USING (bucket_id = 'avisos-rede' AND (
    owner_id = (SELECT auth.uid()::text)
    OR public.security_network_notice_image_readable(name)
  ));