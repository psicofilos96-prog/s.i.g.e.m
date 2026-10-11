-- SIA.ED.1: cabeçalho institucional reutilizável (OP/secretaria) e ajustes de impressão por versão de prova.
CREATE TABLE public.sia_print_header_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.sia_print_header_versions(id),
  unit_name_snapshot text NOT NULL,
  config jsonb NOT NULL,
  author_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, version)
);
GRANT SELECT ON public.sia_print_header_versions TO authenticated;
GRANT ALL ON public.sia_print_header_versions TO service_role;
ALTER TABLE public.sia_print_header_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sia_header_read ON public.sia_print_header_versions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.sia_instrument_print_settings (
  instrument_version_id uuid PRIMARY KEY REFERENCES public.teacher_instrument_versions(id),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 40),
  header_version_id uuid REFERENCES public.sia_print_header_versions(id),
  author_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sia_instrument_print_settings TO authenticated;
GRANT ALL ON public.sia_instrument_print_settings TO service_role;
ALTER TABLE public.sia_instrument_print_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY sia_settings_read ON public.sia_instrument_print_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teacher_instrument_versions v WHERE v.id = instrument_version_id));

CREATE OR REPLACE FUNCTION public.sia_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'sia:append-only'; END $$;
CREATE TRIGGER sia_header_immutable BEFORE UPDATE OR DELETE ON public.sia_print_header_versions FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER sia_settings_immutable BEFORE UPDATE OR DELETE ON public.sia_instrument_print_settings FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();

CREATE OR REPLACE FUNCTION public.record_sia_print_header(_school text, _expected_head uuid, _config jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE head public.sia_print_header_versions; unit text; lbl jsonb; lg jsonb; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c
     WHERE c.capability_id IN ('configurar-cabecalho-avaliacao','revisar-trabalho-docente') AND c.scope_level = 'escola' AND c.school_id = _school)
    THEN RAISE EXCEPTION 'sia:header-capability-missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sia-header:' || _school));
  SELECT * INTO head FROM public.sia_print_header_versions h WHERE h.school_id = _school ORDER BY h.version DESC LIMIT 1;
  IF head.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'sia:stale-head'; END IF;
  IF jsonb_typeof(_config) <> 'object' THEN RAISE EXCEPTION 'sia:invalid-header'; END IF;
  IF jsonb_typeof(_config->'labels') <> 'array' OR jsonb_array_length(_config->'labels') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'sia:invalid-labels'; END IF;
  FOR lbl IN SELECT * FROM jsonb_array_elements(_config->'labels') LOOP
    IF jsonb_typeof(lbl) <> 'string' OR length(btrim(lbl #>> '{}')) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'sia:invalid-labels'; END IF;
  END LOOP;
  IF jsonb_typeof(coalesce(_config->'logos','[]')) <> 'array' THEN RAISE EXCEPTION 'sia:invalid-logos'; END IF;
  FOR lg IN SELECT * FROM jsonb_array_elements(coalesce(_config->'logos','[]')) LOOP
    IF lg #>> '{}' NOT IN ('brasao','prefeitura','educacao','sigem') THEN RAISE EXCEPTION 'sia:invalid-logos'; END IF;
  END LOOP;
  IF length(coalesce(_config->>'line1','')) > 160 OR length(coalesce(_config->>'line2','')) > 160 OR length(coalesce(_config->>'notice','')) > 600 THEN RAISE EXCEPTION 'sia:invalid-header'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(_config) k WHERE k NOT IN ('labels','logos','line1','line2','notice','showStudentLines')) > 0 THEN RAISE EXCEPTION 'sia:invalid-header'; END IF;
  SELECT r.official_name INTO unit FROM public.institutional_school_record_versions r WHERE r.school_id = _school ORDER BY r.version_number DESC LIMIT 1;
  IF unit IS NULL THEN RAISE EXCEPTION 'sia:school-unknown'; END IF;
  INSERT INTO public.sia_print_header_versions(school_id, version, supersedes_id, unit_name_snapshot, config, author_user_id)
    VALUES (_school, coalesce(head.version, 0) + 1, head.id, unit, _config, auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_sia_print_header(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sia_print_header(text, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_sia_instrument_print_settings(_instrument_version uuid, _label text, _header uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.teacher_instrument_versions; h public.sia_print_header_versions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO v FROM public.teacher_instrument_versions x WHERE x.id = _instrument_version;
  IF v.id IS NULL OR v.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'sia:only-author'; END IF;
  IF EXISTS (SELECT 1 FROM public.teacher_work_review_events e WHERE e.subject_kind = 'instrumento' AND e.subject_version_id = v.id) THEN RAISE EXCEPTION 'sia:settings-frozen-after-submission'; END IF;
  IF EXISTS (SELECT 1 FROM public.sia_instrument_print_settings s WHERE s.instrument_version_id = v.id) THEN RAISE EXCEPTION 'sia:settings-already-recorded'; END IF;
  IF _header IS NOT NULL THEN
    SELECT * INTO h FROM public.sia_print_header_versions x WHERE x.id = _header;
    IF h.id IS NULL OR h.school_id <> v.school_id THEN RAISE EXCEPTION 'sia:header-other-school'; END IF;
    IF NOT (h.config->'labels') ? btrim(_label) THEN RAISE EXCEPTION 'sia:label-not-configured'; END IF;
  END IF;
  INSERT INTO public.sia_instrument_print_settings(instrument_version_id, label, header_version_id, author_user_id) VALUES (v.id, btrim(_label), _header, auth.uid());
  RETURN v.id;
END $$;
REVOKE ALL ON FUNCTION public.record_sia_instrument_print_settings(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sia_instrument_print_settings(uuid, text, uuid) TO authenticated;