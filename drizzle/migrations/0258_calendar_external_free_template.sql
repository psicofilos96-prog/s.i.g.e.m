ALTER TABLE public.calendar_external_profile_revisions DROP CONSTRAINT calendar_external_profile_revisions_template_code_check;
ALTER TABLE public.calendar_external_profile_revisions ADD CONSTRAINT calendar_external_profile_revisions_template_code_check CHECK (template_code = 'externo-livre');
ALTER TABLE public.calendar_external_presentation_revisions DROP CONSTRAINT calendar_external_presentation_revisions_template_code_check;
ALTER TABLE public.calendar_external_presentation_revisions ADD CONSTRAINT calendar_external_presentation_revisions_template_code_check CHECK (template_code = 'externo-livre');
CREATE OR REPLACE FUNCTION public.record_calendar_external_profile(_calendar_id text, _template_code text, _expected_head uuid, _profile jsonb, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g uuid; h public.calendar_external_profile_revisions%ROWTYPE; _id uuid; _img text;
BEGIN
  g := public.calendar_network_grant('construir-calendario-da-rede');
  IF _template_code IS NULL OR _template_code NOT IN ('externo-livre') THEN
    RAISE EXCEPTION 'calendar-external:invalid-template'; END IF;
  IF _calendar_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.calendar_versions v WHERE v.calendar_id = _calendar_id) THEN
    RAISE EXCEPTION 'calendar-external:calendar-not-found'; END IF;
  IF pg_catalog.jsonb_typeof(coalesce(_profile,'null')) <> 'object' THEN RAISE EXCEPTION 'calendar-external:profile-required'; END IF;
  IF pg_catalog.octet_length(_profile::text) > 4194304 THEN RAISE EXCEPTION 'calendar-external:profile-too-large'; END IF;
  FOR _img IN SELECT x #>> '{}' FROM pg_catalog.jsonb_path_query(_profile, 'strict $.**') x
    WHERE pg_catalog.jsonb_typeof(x) = 'string' AND (x #>> '{}') LIKE 'data:%' LOOP
    IF _img !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' THEN RAISE EXCEPTION 'calendar-external:asset-invalid'; END IF;
    IF pg_catalog.length(_img) > 1572864 THEN RAISE EXCEPTION 'calendar-external:asset-too-large'; END IF;
  END LOOP;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendar-external:' || _calendar_id || ':' || _template_code, 0));
  SELECT * INTO h FROM public.calendar_external_profile_revisions r
    WHERE r.calendar_id = _calendar_id AND r.template_code = _template_code ORDER BY r.revision DESC LIMIT 1;
  IF _expected_head IS DISTINCT FROM h.id THEN RAISE EXCEPTION 'calendar-external:base-superseded'; END IF;
  INSERT INTO public.calendar_external_profile_revisions(calendar_id, template_code, revision, base_revision_id, profile,
    profile_digest, reason, recorded_by, recorded_via_engagement_id)
  VALUES (_calendar_id, _template_code, coalesce(h.revision, 0) + 1, h.id, _profile,
    pg_catalog.encode(extensions.digest(_profile::text, 'sha256'), 'hex'),
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), g)
  RETURNING id INTO _id;
  RETURN pg_catalog.jsonb_build_object('revisionId', _id, 'revision', coalesce(h.revision, 0) + 1);
END $function$;