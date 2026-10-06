-- CAL.EXT.1 — Perfis visuais dos modelos externos do calendário (aditiva). Só aparência: nunca dia, efeito,
-- contagem, versão acadêmica ou homologação. Revisões append-only por (calendar_id, template_code).
CREATE TABLE public.calendar_external_presentation_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL,
  template_code text NOT NULL CHECK (template_code IN ('externo-panoramico','externo-mosaico')),
  revision integer NOT NULL CHECK (revision >= 1),
  base_revision_id uuid REFERENCES public.calendar_external_presentation_revisions(id),
  profile jsonb NOT NULL CHECK (jsonb_typeof(profile) = 'object'),
  profile_digest text NOT NULL,
  reason text,
  recorded_by uuid NOT NULL,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_id, template_code, revision)
);
GRANT ALL ON public.calendar_external_presentation_revisions TO service_role;
REVOKE ALL ON public.calendar_external_presentation_revisions FROM PUBLIC, anon, authenticated;
DO $acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.calendar_external_presentation_revisions FROM sandbox_exec';
  END IF;
END $acl$;
ALTER TABLE public.calendar_external_presentation_revisions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_calendar_external_presentation_revisions BEFORE UPDATE OR DELETE ON public.calendar_external_presentation_revisions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Writer: mesma autoridade de construção do calendário; base esperada = cabeça atual (NULL só na primeira).
-- Imagens embutidas como data URL: só PNG/JPEG/WEBP, cada uma ≤ 1,5 MB codificada; perfil ≤ 4 MB.
CREATE FUNCTION public.record_calendar_external_profile(
  _calendar_id uuid, _template_code text, _expected_head uuid, _profile jsonb, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE g uuid; h public.calendar_external_presentation_revisions%ROWTYPE; _id uuid; _img text;
BEGIN
  g := public.calendar_network_grant('construir-calendario-da-rede');
  IF _template_code IS NULL OR _template_code NOT IN ('externo-panoramico','externo-mosaico') THEN
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
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendar-external:' || _calendar_id::text || ':' || _template_code, 0));
  SELECT * INTO h FROM public.calendar_external_presentation_revisions r
    WHERE r.calendar_id = _calendar_id AND r.template_code = _template_code ORDER BY r.revision DESC LIMIT 1;
  IF _expected_head IS DISTINCT FROM h.id THEN RAISE EXCEPTION 'calendar-external:base-superseded'; END IF;
  INSERT INTO public.calendar_external_presentation_revisions(calendar_id, template_code, revision, base_revision_id, profile,
    profile_digest, reason, recorded_by, recorded_via_engagement_id)
  VALUES (_calendar_id, _template_code, coalesce(h.revision, 0) + 1, h.id, _profile,
    pg_catalog.encode(extensions.digest(_profile::text, 'sha256'), 'hex'),
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), g)
  RETURNING id INTO _id;
  RETURN pg_catalog.jsonb_build_object('revisionId', _id, 'revision', coalesce(h.revision, 0) + 1);
END $fn$;
REVOKE ALL ON FUNCTION public.record_calendar_external_profile(uuid, text, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_calendar_external_profile(uuid, text, uuid, jsonb, text) TO authenticated;

-- Leitor at/knownAt: construção lê sempre; demais autenticados só se alguma versão do calendário está homologada na data.
CREATE FUNCTION public.calendar_external_profile_at(_calendar_id uuid, _template_code text, _on date, _known_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE r public.calendar_external_presentation_revisions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR _calendar_id IS NULL OR _template_code IS NULL OR _on IS NULL OR _known_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('contract','cal-ext-1/1','state','access-denied'); END IF;
  IF NOT (public.calendar_has_network_capability('construir-calendario-da-rede') OR EXISTS (
      SELECT 1 FROM public.calendar_versions v WHERE v.calendar_id = _calendar_id
        AND public.calendar_version_homologation_state(v.id, _on, _known_at) = 'homologada')) THEN
    RETURN pg_catalog.jsonb_build_object('contract','cal-ext-1/1','state','access-denied'); END IF;
  SELECT * INTO r FROM public.calendar_external_presentation_revisions x
    WHERE x.calendar_id = _calendar_id AND x.template_code = _template_code AND x.created_at <= _known_at
    ORDER BY x.revision DESC LIMIT 1;
  IF r.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('contract','cal-ext-1/1','state','padrao'); END IF;
  RETURN pg_catalog.jsonb_build_object('contract','cal-ext-1/1','state','lido','revisionId', r.id, 'revision', r.revision,
    'profile', r.profile, 'digest', r.profile_digest, 'recordedAt', r.created_at);
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_external_profile_at(uuid, text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_external_profile_at(uuid, text, date, timestamptz) TO authenticated;