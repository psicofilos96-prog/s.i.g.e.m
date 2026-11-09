CREATE FUNCTION public.followup_attachment_can_write(_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT public.school_institutional_followup_grant('registrar-acompanhamento-institucional', split_part(_name, '/', 1))
$$;
CREATE FUNCTION public.followup_attachment_can_read(_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT public.school_institutional_followup_can_read(split_part(_name, '/', 1))
$$;
REVOKE ALL ON FUNCTION public.followup_attachment_can_write(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.followup_attachment_can_read(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.followup_attachment_can_write(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.followup_attachment_can_read(text) TO authenticated;
DROP POLICY IF EXISTS followup_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS followup_attachments_select ON storage.objects;
CREATE POLICY followup_attachments_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'followup-attachments' AND name ~ '^[^/]+/[0-9a-fA-F-]{36}$'
    AND public.followup_attachment_can_write(name));
CREATE POLICY followup_attachments_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'followup-attachments' AND public.followup_attachment_can_read(name));