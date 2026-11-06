CREATE TABLE public.school_institutional_followup_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  visit_id uuid NOT NULL REFERENCES public.school_institutional_followup_visits(id),
  caption text,
  storage_path text NOT NULL UNIQUE,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  author_user_id uuid NOT NULL,
  author_person_id uuid,
  request_key uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.school_institutional_followup_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_institutional_followup_attachments FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER followup_attachment_immutable BEFORE UPDATE OR DELETE ON public.school_institutional_followup_attachments
  FOR EACH ROW EXECUTE FUNCTION public.school_institutional_followup_immutable();

CREATE FUNCTION public.record_school_institutional_followup_attachment(
  _visit uuid, _storage_path text, _caption text, _content_type text, _size_bytes integer, _request uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v public.school_institutional_followup_visits; _person uuid; _id uuid;
BEGIN
  SELECT * INTO v FROM public.school_institutional_followup_visits WHERE id = _visit;
  IF v.id IS NULL OR EXISTS (SELECT 1 FROM public.school_institutional_followup_visits s WHERE s.supersedes_id = v.id)
    THEN RAISE EXCEPTION 'followup:visit-invalid'; END IF;
  _person := public.school_institutional_followup_person(v.school_id);
  IF _request IS NULL THEN RAISE EXCEPTION 'followup:attachment-required'; END IF;
  IF _content_type NOT IN ('image/png', 'image/jpeg', 'image/webp')
    THEN RAISE EXCEPTION 'followup:attachment-type'; END IF;
  IF _size_bytes IS NULL OR _size_bytes < 1 OR _size_bytes > 5242880
    THEN RAISE EXCEPTION 'followup:attachment-size'; END IF;
  IF _storage_path IS NULL OR _storage_path <> v.school_id || '/' || _request::text
    THEN RAISE EXCEPTION 'followup:attachment-path'; END IF;
  IF to_regclass('storage.objects') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id = 'followup-attachments' AND o.name = _storage_path
  ) THEN RAISE EXCEPTION 'followup:attachment-missing'; END IF;
  INSERT INTO public.school_institutional_followup_attachments (
    school_id, visit_id, caption, storage_path, content_type, size_bytes,
    author_user_id, author_person_id, request_key)
  VALUES (v.school_id, v.id, nullif(btrim(coalesce(_caption, '')), ''), _storage_path, _content_type,
    _size_bytes, auth.uid(), _person, _request)
  ON CONFLICT (request_key) DO NOTHING RETURNING id INTO _id;
  IF _id IS NULL THEN SELECT id INTO _id FROM public.school_institutional_followup_attachments
    WHERE request_key = _request AND author_user_id = auth.uid() AND school_id = v.school_id; END IF;
  IF _id IS NULL THEN RAISE EXCEPTION 'followup:request-conflict'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.school_institutional_followup_attachments old
    WHERE old.id = _id AND old.visit_id = v.id AND old.storage_path = _storage_path
  ) THEN RAISE EXCEPTION 'followup:request-conflict'; END IF;
  RETURN _id;
END $function$;
REVOKE ALL ON FUNCTION public.record_school_institutional_followup_attachment(uuid,text,text,text,integer,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_school_institutional_followup_attachment(uuid,text,text,text,integer,uuid) TO authenticated;

CREATE FUNCTION public.school_institutional_followup_attachments(_school text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.school_institutional_followup_can_read(_school) THEN RAISE EXCEPTION 'followup:read-denied'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', a.id,
      'visit_id', a.visit_id,
      'visit_logical_id', v.logical_id,
      'caption', a.caption,
      'storage_path', a.storage_path,
      'content_type', a.content_type,
      'size_bytes', a.size_bytes,
      'author_name', coalesce(p.display_name, ''),
      'created_at', a.created_at
    ) ORDER BY a.created_at)
    FROM public.school_institutional_followup_attachments a
    JOIN public.school_institutional_followup_visits v ON v.id = a.visit_id
    LEFT JOIN public.institutional_persons p ON p.id = a.author_person_id
    WHERE a.school_id = _school
  ), '[]'::jsonb);
END $function$;
REVOKE ALL ON FUNCTION public.school_institutional_followup_attachments(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.school_institutional_followup_attachments(text) TO authenticated;

DO $policies$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE POLICY followup_attachments_insert ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'followup-attachments'
        AND name ~ '^[^/]+/[0-9a-fA-F-]{36}$'
        AND public.school_institutional_followup_grant('registrar-acompanhamento-institucional', split_part(name, '/', 1))
      )
    $sql$;
    EXECUTE $sql$
      CREATE POLICY followup_attachments_select ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'followup-attachments'
        AND public.school_institutional_followup_can_read(split_part(name, '/', 1))
      )
    $sql$;
  END IF;
END $policies$;