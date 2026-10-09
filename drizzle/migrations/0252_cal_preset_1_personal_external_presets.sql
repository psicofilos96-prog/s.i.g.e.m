-- CAL.PRESET.1: presets visuais PESSOAIS dos modelos externos do calendário (só aparência).
-- Append-only versionado por dono (auth.uid()); nunca toca calendar_versions/homologação.
-- Sem compartilhamento institucional: exigiria capacidade nova não decidida.
CREATE TABLE public.calendar_external_preset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  preset_key text NOT NULL CHECK (char_length(preset_key) BETWEEN 8 AND 80),
  template_code text NOT NULL CHECK (char_length(template_code) BETWEEN 1 AND 40),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  version integer NOT NULL DEFAULT 1,
  archived boolean NOT NULL DEFAULT false,
  profile jsonb NOT NULL CHECK (jsonb_typeof(profile) = 'object'),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 80),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, preset_key, version),
  UNIQUE (owner_id, idempotency_key)
);
GRANT SELECT, INSERT ON public.calendar_external_preset_versions TO authenticated;
GRANT ALL ON public.calendar_external_preset_versions TO service_role;
ALTER TABLE public.calendar_external_preset_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cepv_own_select" ON public.calendar_external_preset_versions FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "cepv_own_insert" ON public.calendar_external_preset_versions FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.cepv_assign_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE _img text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'calendar-preset:session-required'; END IF;
  IF pg_catalog.octet_length(NEW.profile::text) > 4194304 THEN RAISE EXCEPTION 'calendar-preset:profile-too-large'; END IF;
  FOR _img IN SELECT m[1] FROM pg_catalog.regexp_matches(NEW.profile::text, '"(data:[^"]*)"', 'g') AS m LOOP
    IF _img !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' THEN RAISE EXCEPTION 'calendar-preset:asset-invalid'; END IF;
    IF pg_catalog.length(_img) > 1572864 THEN RAISE EXCEPTION 'calendar-preset:asset-too-large'; END IF;
  END LOOP;
  NEW.owner_id := auth.uid();
  NEW.name := pg_catalog.btrim(NEW.name);
  NEW.recorded_at := pg_catalog.now();
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(NEW.owner_id::text || '|' || NEW.preset_key));
  SELECT coalesce(max(v.version), 0) + 1 INTO NEW.version
    FROM public.calendar_external_preset_versions v
   WHERE v.owner_id = NEW.owner_id AND v.preset_key = NEW.preset_key;
  RETURN NEW;
END $$;
CREATE TRIGGER cepv_assign_version BEFORE INSERT ON public.calendar_external_preset_versions
  FOR EACH ROW EXECUTE FUNCTION public.cepv_assign_version();

CREATE OR REPLACE FUNCTION public.cepv_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'calendar-preset:append-only'; END $$;
CREATE TRIGGER cepv_immutable BEFORE UPDATE OR DELETE ON public.calendar_external_preset_versions
  FOR EACH ROW EXECUTE FUNCTION public.cepv_immutable();