-- NREL.3: modelos pessoais do gerador de relatórios por principal (só a escolha; nunca dado).
-- Append-only versionado; isolamento por auth.uid(); sem compartilhamento (não há capability definida).
CREATE TABLE public.report_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  sector text NOT NULL CHECK (char_length(sector) BETWEEN 1 AND 40),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  version integer NOT NULL DEFAULT 1,
  archived boolean NOT NULL DEFAULT false,
  choice jsonb NOT NULL CHECK (jsonb_typeof(choice) = 'object' AND pg_column_size(choice) <= 8192),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 80),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, sector, name, version),
  UNIQUE (owner_id, idempotency_key)
);
GRANT SELECT, INSERT ON public.report_template_versions TO authenticated;
GRANT ALL ON public.report_template_versions TO service_role;
ALTER TABLE public.report_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rtv_own_select" ON public.report_template_versions FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "rtv_own_insert" ON public.report_template_versions FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.rtv_assign_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  NEW.owner_id := auth.uid();
  NEW.name := btrim(NEW.name);
  NEW.recorded_at := now();
  PERFORM pg_advisory_xact_lock(hashtext(NEW.owner_id::text || '|' || NEW.sector || '|' || NEW.name));
  SELECT coalesce(max(v.version), 0) + 1 INTO NEW.version
    FROM public.report_template_versions v
   WHERE v.owner_id = NEW.owner_id AND v.sector = NEW.sector AND v.name = NEW.name;
  RETURN NEW;
END $$;
CREATE TRIGGER rtv_assign_version BEFORE INSERT ON public.report_template_versions
  FOR EACH ROW EXECUTE FUNCTION public.rtv_assign_version();