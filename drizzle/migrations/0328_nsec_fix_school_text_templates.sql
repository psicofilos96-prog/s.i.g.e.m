-- NSEC.FIX.1: modelos de texto por escola (Atestado de Escolaridade; Ata do Conselho de Classe), versionados append-only.
-- Escrita/leitura por capability legítima da escola: atestado = emitir-documento-escolar (Secretaria);
-- conselho = conduzir-conselho-de-classe (OP e Direção). Qualquer fonte efetiva conta, sempre no escopo da escola.
CREATE TABLE public.school_text_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  kind text NOT NULL CHECK (kind IN ('atestado-de-escolaridade','ata-conselho-de-classe')),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.school_text_template_versions(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 160),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 10 AND 8000),
  signatures text[] NOT NULL DEFAULT '{}' CHECK (cardinality(signatures) <= 6),
  reason text,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, kind, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) >= 5))
);
REVOKE ALL ON public.school_text_template_versions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.school_text_template_versions TO service_role;
ALTER TABLE public.school_text_template_versions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER sttv_append_only BEFORE UPDATE OR DELETE ON public.school_text_template_versions FOR EACH ROW EXECUTE FUNCTION public.fhd_immutable();

CREATE OR REPLACE FUNCTION public.school_text_template_capability(_kind text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE _kind WHEN 'atestado-de-escolaridade' THEN 'emitir-documento-escolar' WHEN 'ata-conselho-de-classe' THEN 'conduzir-conselho-de-classe' END $$;

CREATE OR REPLACE FUNCTION public.school_text_template_allowed(_school text, _kind text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c
    WHERE c.capability_id = public.school_text_template_capability(_kind)
      AND ((c.scope_level = 'escola' AND c.school_id = _school) OR c.scope_level = 'rede')) $$;
REVOKE ALL ON FUNCTION public.school_text_template_allowed(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_text_template_allowed(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_school_text_template(_school text, _kind text, _expected uuid, _title text, _body text, _signatures text[], _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE h public.school_text_template_versions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF public.school_text_template_capability(_kind) IS NULL THEN RAISE EXCEPTION 'template:kind-unknown'; END IF;
  IF NOT public.school_text_template_allowed(_school, _kind) THEN RAISE EXCEPTION 'template:capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sttv:' || _school || ':' || _kind));
  SELECT * INTO h FROM public.school_text_template_versions v WHERE v.school_id = _school AND v.kind = _kind ORDER BY v.version DESC LIMIT 1;
  IF h.id IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'base-superseded'; END IF;
  INSERT INTO public.school_text_template_versions(school_id, kind, version, supersedes_id, title, body, signatures, reason, recorded_by)
  VALUES (_school, _kind, coalesce(h.version, 0) + 1, h.id, btrim(_title), btrim(_body), coalesce(_signatures, '{}'), nullif(btrim(coalesce(_reason,'')), ''), auth.uid());
  RETURN coalesce(h.version, 0) + 1;
END $$;
REVOKE ALL ON FUNCTION public.record_school_text_template(text, text, uuid, text, text, text[], text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_school_text_template(text, text, uuid, text, text, text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.school_text_templates(_school text, _kind text)
RETURNS TABLE(id uuid, version integer, title text, body text, signatures text[], reason text, recorded_at timestamptz, by_me boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.school_text_template_allowed(_school, _kind) THEN RAISE EXCEPTION 'template:capability-missing'; END IF;
  RETURN QUERY SELECT v.id, v.version, v.title, v.body, v.signatures, v.reason, v.recorded_at, v.recorded_by = auth.uid()
    FROM public.school_text_template_versions v WHERE v.school_id = _school AND v.kind = _kind ORDER BY v.version DESC;
END $$;
REVOKE ALL ON FUNCTION public.school_text_templates(text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.school_text_templates(text, text) TO authenticated;