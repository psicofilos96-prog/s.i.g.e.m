-- Catálogo territorial IBGE DTB (versionado por ano-base; códigos sempre texto; append-only)
CREATE TABLE public.territorial_dtb_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dtb_year int NOT NULL,
  reference_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('municipios','distritos','subdistritos','distritos_novos_extintos')),
  file_name text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  row_count int NOT NULL CHECK (row_count >= 0),
  rejected_count int NOT NULL DEFAULT 0,
  loaded_by text NOT NULL,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dtb_year, kind, sha256)
);
CREATE TABLE public.territorial_ufs (
  dtb_year int NOT NULL, code text NOT NULL CHECK (code ~ '^[0-9]{2}$'), name text NOT NULL,
  source_id uuid NOT NULL REFERENCES public.territorial_dtb_sources(id),
  PRIMARY KEY (dtb_year, code)
);
CREATE TABLE public.territorial_municipalities (
  dtb_year int NOT NULL, code text NOT NULL CHECK (code ~ '^[0-9]{7}$'), uf_code text NOT NULL, name text NOT NULL,
  intermediate_region_code text, intermediate_region_name text, immediate_region_code text, immediate_region_name text,
  source_id uuid NOT NULL REFERENCES public.territorial_dtb_sources(id),
  PRIMARY KEY (dtb_year, code),
  FOREIGN KEY (dtb_year, uf_code) REFERENCES public.territorial_ufs(dtb_year, code),
  CHECK (left(code, 2) = uf_code)
);
CREATE TABLE public.territorial_districts (
  dtb_year int NOT NULL, code text NOT NULL CHECK (code ~ '^[0-9]{9}$'), municipality_code text NOT NULL, name text NOT NULL,
  source_id uuid NOT NULL REFERENCES public.territorial_dtb_sources(id),
  PRIMARY KEY (dtb_year, code),
  FOREIGN KEY (dtb_year, municipality_code) REFERENCES public.territorial_municipalities(dtb_year, code),
  CHECK (left(code, 7) = municipality_code)
);
CREATE TABLE public.territorial_subdistricts (
  dtb_year int NOT NULL, code text NOT NULL CHECK (code ~ '^[0-9]{11}$'), district_code text NOT NULL, name text NOT NULL,
  source_id uuid NOT NULL REFERENCES public.territorial_dtb_sources(id),
  PRIMARY KEY (dtb_year, code),
  FOREIGN KEY (dtb_year, district_code) REFERENCES public.territorial_districts(dtb_year, code),
  CHECK (left(code, 9) = district_code)
);
-- Histórico declarado pelo IBGE (novos sem código no arquivo; extintos com código de 9 dígitos)
CREATE TABLE public.territorial_district_changes (
  dtb_year int NOT NULL, change text NOT NULL CHECK (change IN ('novo','extinto')),
  uf_name text NOT NULL, municipality_code text NOT NULL CHECK (municipality_code ~ '^[0-9]{7}$'),
  municipality_name text NOT NULL, district_code text CHECK (district_code IS NULL OR district_code ~ '^[0-9]{9}$'),
  district_name text NOT NULL,
  source_id uuid NOT NULL REFERENCES public.territorial_dtb_sources(id),
  PRIMARY KEY (dtb_year, change, municipality_code, district_name)
);
CREATE INDEX territorial_municipalities_uf_idx ON public.territorial_municipalities (dtb_year, uf_code, name);
CREATE INDEX territorial_districts_mun_idx ON public.territorial_districts (dtb_year, municipality_code);
CREATE INDEX territorial_subdistricts_dist_idx ON public.territorial_subdistricts (dtb_year, district_code);

CREATE OR REPLACE FUNCTION public.territorial_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'territorial catalog is append-only (new DTB year = new rows)'; END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['territorial_dtb_sources','territorial_ufs','territorial_municipalities','territorial_districts','territorial_subdistricts','territorial_district_changes'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.territorial_append_only()', t||'_append_only', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t||'_read', t);
    -- carga técnica inicial (executor sandbox_exec, só INSERT; revogada em migration seguinte)
    EXECUTE format('GRANT SELECT, INSERT ON public.%I TO sandbox_exec', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO sandbox_exec USING (true) WITH CHECK (true)', t||'_load', t);
  END LOOP;
END $$;

-- Busca encadeada UF → município → distrito → subdistrito (ano explícito, nunca fallback)
CREATE OR REPLACE FUNCTION public.territorial_search(p_year int, p_level text, p_parent text, p_query text, p_limit int DEFAULT 20)
RETURNS TABLE (code text, name text, parent_code text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH q AS (SELECT lower(coalesce(p_query,'')) AS s)
  SELECT * FROM (
    SELECT u.code, u.name, NULL::text FROM public.territorial_ufs u, q WHERE p_level='uf' AND u.dtb_year=p_year AND (q.s='' OR lower(u.name) LIKE '%'||q.s||'%' OR u.code=q.s)
    UNION ALL SELECT m.code, m.name, m.uf_code FROM public.territorial_municipalities m, q WHERE p_level='municipio' AND m.dtb_year=p_year AND m.uf_code=p_parent AND (q.s='' OR lower(m.name) LIKE '%'||q.s||'%' OR m.code=q.s)
    UNION ALL SELECT d.code, d.name, d.municipality_code FROM public.territorial_districts d, q WHERE p_level='distrito' AND d.dtb_year=p_year AND d.municipality_code=p_parent AND (q.s='' OR lower(d.name) LIKE '%'||q.s||'%' OR d.code=q.s)
    UNION ALL SELECT s.code, s.name, s.district_code FROM public.territorial_subdistricts s, q WHERE p_level='subdistrito' AND s.dtb_year=p_year AND s.district_code=p_parent AND (q.s='' OR lower(s.name) LIKE '%'||q.s||'%' OR s.code=q.s)
  ) r ORDER BY 2 LIMIT least(greatest(p_limit,1),100)
$$;
REVOKE ALL ON FUNCTION public.territorial_search(int,text,text,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.territorial_search(int,text,text,text,int) TO authenticated;