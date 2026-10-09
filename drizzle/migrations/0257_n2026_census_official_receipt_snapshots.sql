CREATE TABLE public.census_official_receipt_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  inep text NOT NULL CHECK (inep ~ '^[0-9]{8}$'),
  census_year text NOT NULL CHECK (census_year ~ '^[0-9]{4}$'),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.census_official_receipt_snapshots(id),
  closed_at timestamptz,
  issued_at timestamptz NOT NULL,
  receipt_code_sha256 text CHECK (receipt_code_sha256 IS NULL OR receipt_code_sha256 ~ '^[0-9a-f]{64}$'),
  school_declared jsonb NOT NULL,
  measures jsonb NOT NULL CHECK (jsonb_typeof(measures) = 'object'),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_ref text NOT NULL,
  source_locator text NOT NULL,
  technical_operation_id uuid NOT NULL REFERENCES public.technical_execution_operations(id),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (inep, census_year, version),
  UNIQUE (inep, census_year, issued_at, content_sha256)
);
COMMENT ON TABLE public.census_official_receipt_snapshots IS 'Fotografia documental do recibo oficial Educacenso por escola; referência agregada, nunca gera pessoa/turma; append-only versionado por issued_at; sem nome/CPF de pessoas.';

CREATE TABLE public.census_official_panel_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_kind text NOT NULL CHECK (scope_kind IN ('municipio')),
  scope_ref text NOT NULL,
  census_year text NOT NULL CHECK (census_year ~ '^[0-9]{4}$'),
  panel_updated_at timestamptz NOT NULL,
  measures jsonb NOT NULL CHECK (jsonb_typeof(measures) = 'object'),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_ref text NOT NULL,
  technical_operation_id uuid NOT NULL REFERENCES public.technical_execution_operations(id),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (scope_kind, scope_ref, census_year, panel_updated_at, content_sha256)
);
COMMENT ON TABLE public.census_official_panel_snapshots IS 'Indicadores agregados do Painel Educacenso (inclui rede estadual/privada); estatística de referência, jamais fonte de entidades.';

GRANT SELECT ON public.census_official_receipt_snapshots, public.census_official_panel_snapshots TO authenticated;
GRANT ALL ON public.census_official_receipt_snapshots, public.census_official_panel_snapshots TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.census_official_receipt_snapshots, public.census_official_panel_snapshots FROM service_role, authenticated, anon;
ALTER TABLE public.census_official_receipt_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.census_official_panel_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura de rede do censo" ON public.census_official_receipt_snapshots FOR SELECT TO authenticated USING (public.census_can_read_network());
CREATE POLICY "leitura de rede do censo" ON public.census_official_panel_snapshots FOR SELECT TO authenticated USING (public.census_can_read_network());
CREATE TRIGGER census_official_receipt_immutable BEFORE UPDATE OR DELETE ON public.census_official_receipt_snapshots FOR EACH ROW EXECUTE FUNCTION public.census_immutable();
CREATE TRIGGER census_official_panel_immutable BEFORE UPDATE OR DELETE ON public.census_official_panel_snapshots FOR EACH ROW EXECUTE FUNCTION public.census_immutable();

CREATE OR REPLACE FUNCTION public.technical_import_educacenso_2026_census_receipts(_operation_kind text, _source_hash text, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE op uuid; fp text; r jsonb; existing record; head record; csha text; n int := 0;
  m jsonb := _payload->'manifest'; rs jsonb := _payload->'rows';
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'technical:automation-disabled'; END IF;
  IF _operation_kind IS DISTINCT FROM 'technical_import_educacenso_2026_census_receipts' THEN RAISE EXCEPTION 'technical:operation-kind-mismatch'; END IF;
  IF coalesce(_source_hash,'') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'technical:source-hash-invalid'; END IF;
  IF pg_catalog.jsonb_typeof(m) IS DISTINCT FROM 'object' OR pg_catalog.jsonb_typeof(rs) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'technical:payload-shape'; END IF;
  IF m->>'source_hash' IS DISTINCT FROM _source_hash THEN RAISE EXCEPTION 'technical:manifest-hash-mismatch'; END IF;
  IF (m->>'row_count')::int IS DISTINCT FROM pg_catalog.jsonb_array_length(rs) THEN RAISE EXCEPTION 'technical:count-rows'; END IF;
  IF _payload::text ~ '[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}([^0-9]|$)' AND _payload::text ~ '"cpf' THEN RAISE EXCEPTION 'technical:personal-data'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(rs) e WHERE coalesce(e->>'inep','') !~ '^[0-9]{8}$' OR e->>'issued_at' IS NULL OR coalesce(e->>'locator','')='' OR pg_catalog.jsonb_typeof(e->'measures') IS DISTINCT FROM 'object' OR e ? 'cpf' OR (e->'school') ? 'gestor') THEN RAISE EXCEPTION 'technical:row-invalid'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(rs) e, pg_catalog.jsonb_each(e->'measures') x WHERE pg_catalog.jsonb_typeof(x.value) <> 'object' OR NOT (x.value ? 'value') OR (pg_catalog.jsonb_typeof(x.value->'value') NOT IN ('number','null'))) THEN RAISE EXCEPTION 'technical:measure-shape'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(rs) e WHERE NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers i WHERE i.identifier_kind='inep' AND i.value = e->>'inep')) THEN RAISE EXCEPTION 'technical:school-not-found'; END IF;
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(rs)) <> (SELECT count(DISTINCT e->>'inep') FROM pg_catalog.jsonb_array_elements(rs) e) THEN RAISE EXCEPTION 'technical:duplicate-school-in-source'; END IF;
  fp := pg_catalog.encode(extensions.digest(_payload::text, 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('technical:' || _operation_kind));
  SELECT * INTO existing FROM public.technical_execution_operations WHERE operation_kind = _operation_kind AND source_hash = _source_hash;
  IF existing.id IS NOT NULL THEN
    IF existing.payload_fingerprint <> fp THEN RAISE EXCEPTION 'technical:payload-differs-from-recorded-operation'; END IF;
    RETURN existing.id;
  END IF;
  op := pg_catalog.gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, _operation_kind, 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento', m->>'source_ref', _source_hash, 'decisao-do-proprietario', fp, 'concluida', m, pg_catalog.clock_timestamp());
  FOR r IN SELECT * FROM pg_catalog.jsonb_array_elements(rs) LOOP
    csha := pg_catalog.encode(extensions.digest((r->'measures')::text || (r->'school')::text, 'sha256'), 'hex');
    IF EXISTS (SELECT 1 FROM public.census_official_receipt_snapshots s WHERE s.inep=r->>'inep' AND s.census_year='2026' AND s.issued_at=(r->>'issued_at')::timestamptz AND s.content_sha256=csha) THEN CONTINUE; END IF;
    SELECT * INTO head FROM public.census_official_receipt_snapshots s WHERE s.inep=r->>'inep' AND s.census_year='2026' ORDER BY s.version DESC LIMIT 1;
    INSERT INTO public.census_official_receipt_snapshots(school_id, inep, census_year, version, supersedes_id, closed_at, issued_at, receipt_code_sha256, school_declared, measures, content_sha256, source_sha256, source_ref, source_locator, technical_operation_id)
    VALUES ('inep-' || (r->>'inep'), r->>'inep', '2026', coalesce(head.version,0)+1, head.id, (r->>'closed_at')::timestamptz, (r->>'issued_at')::timestamptz, r->>'receipt_code_sha256', r->'school', r->'measures', csha, _source_hash, m->>'source_ref', r->>'locator', op);
    n := n + 1;
  END LOOP;
  RETURN op;
END $function$;

CREATE OR REPLACE FUNCTION public.technical_import_educacenso_2026_census_panel(_operation_kind text, _source_hash text, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE op uuid; fp text; existing record; m jsonb := _payload->'manifest'; p jsonb := _payload->'panel';
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'technical:automation-disabled'; END IF;
  IF _operation_kind IS DISTINCT FROM 'technical_import_educacenso_2026_census_panel' THEN RAISE EXCEPTION 'technical:operation-kind-mismatch'; END IF;
  IF coalesce(_source_hash,'') !~ '^[0-9a-f]{64}$' OR m->>'source_hash' IS DISTINCT FROM _source_hash THEN RAISE EXCEPTION 'technical:source-hash-invalid'; END IF;
  IF p->>'scope_kind' IS DISTINCT FROM 'municipio' OR coalesce(p->>'scope_ref','')='' OR p->>'updated_at' IS NULL OR pg_catalog.jsonb_typeof(p->'measures') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'technical:payload-shape'; END IF;
  fp := pg_catalog.encode(extensions.digest(_payload::text, 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('technical:' || _operation_kind));
  SELECT * INTO existing FROM public.technical_execution_operations WHERE operation_kind = _operation_kind AND source_hash = _source_hash;
  IF existing.id IS NOT NULL THEN
    IF existing.payload_fingerprint <> fp THEN RAISE EXCEPTION 'technical:payload-differs-from-recorded-operation'; END IF;
    RETURN existing.id;
  END IF;
  op := pg_catalog.gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, _operation_kind, 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento', m->>'source_ref', _source_hash, 'decisao-do-proprietario', fp, 'concluida', m, pg_catalog.clock_timestamp());
  INSERT INTO public.census_official_panel_snapshots(scope_kind, scope_ref, census_year, panel_updated_at, measures, content_sha256, source_sha256, source_ref, technical_operation_id)
  VALUES ('municipio', p->>'scope_ref', '2026', (p->>'updated_at')::timestamptz, p->'measures', pg_catalog.encode(extensions.digest((p->'measures')::text, 'sha256'), 'hex'), _source_hash, m->>'source_ref', op);
  RETURN op;
END $function$;

REVOKE ALL ON FUNCTION public.technical_import_educacenso_2026_census_receipts(text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.technical_import_educacenso_2026_census_panel(text,text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.census_official_receipts_at(_known_at timestamptz)
RETURNS SETOF public.census_official_receipt_snapshots LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$
  SELECT DISTINCT ON (s.inep, s.census_year) s.* FROM public.census_official_receipt_snapshots s
  WHERE s.issued_at <= _known_at ORDER BY s.inep, s.census_year, s.version DESC $$;
REVOKE ALL ON FUNCTION public.census_official_receipts_at(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.census_official_receipts_at(timestamptz) TO authenticated;