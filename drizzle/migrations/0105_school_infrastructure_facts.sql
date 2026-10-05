-- 0105: infraestrutura escolar como fatos versionados (registry aberto de atributos + observações).
-- Nenhuma coluna rígida em institutional_schools. Ausência de observação = "não informado" (≠ false/0).
CREATE TABLE public.school_infrastructure_attribute_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id text NOT NULL CHECK (attribute_id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  version_number integer NOT NULL CHECK (version_number >= 1),
  supersedes_version_id uuid REFERENCES public.school_infrastructure_attribute_versions(id),
  label text NOT NULL CHECK (pg_catalog.btrim(label) <> ''),
  value_type text NOT NULL CHECK (value_type IN ('boolean','integer','decimal','text','catalog')),
  catalog_values text[] CHECK (catalog_values IS NULL OR pg_catalog.cardinality(catalog_values) > 0),
  unit_label text,
  source_field text,
  source_ref text CHECK (source_ref IS NULL OR pg_catalog.btrim(source_ref) <> ''),
  author_user_id uuid, author_person_id uuid, authorizing_engagement_id uuid,
  technical_operation_id uuid REFERENCES public.technical_execution_operations(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attribute_id, version_number),
  CHECK ((value_type = 'catalog') = (catalog_values IS NOT NULL))
);
CREATE TABLE public.school_infrastructure_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  attribute_version_id uuid NOT NULL REFERENCES public.school_infrastructure_attribute_versions(id),
  attribute_id text NOT NULL,
  value_boolean boolean, value_integer bigint, value_decimal numeric, value_text text, value_catalog text,
  valid_from date NOT NULL,
  known_at timestamptz NOT NULL DEFAULT now(),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  source_ref text NOT NULL CHECK (pg_catalog.btrim(source_ref) <> ''),
  source_locator text,
  author_user_id uuid, author_person_id uuid, authorizing_engagement_id uuid,
  technical_operation_id uuid REFERENCES public.technical_execution_operations(id),
  UNIQUE (source_hash, school_id, attribute_id, valid_from),
  CHECK (num_nonnulls(value_boolean, value_integer, value_decimal, value_text, value_catalog) = 1)
);
CREATE INDEX school_infra_obs_school_idx ON public.school_infrastructure_observations(school_id, attribute_id, valid_from DESC, known_at DESC);
COMMENT ON TABLE public.school_infrastructure_observations IS 'Fato versionado de infraestrutura; sem linha = não informado. Append-only; gravação só por school_infrastructure_observation_core via writer humano ou operação técnica.';
REVOKE ALL ON public.school_infrastructure_attribute_versions, public.school_infrastructure_observations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.school_infrastructure_attribute_versions, public.school_infrastructure_observations TO authenticated, service_role;
ALTER TABLE public.school_infrastructure_attribute_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_infrastructure_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura autenticada" ON public.school_infrastructure_attribute_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "leitura autenticada" ON public.school_infrastructure_observations FOR SELECT TO authenticated USING (true);
CREATE TRIGGER school_infra_attr_immutable BEFORE UPDATE OR DELETE ON public.school_infrastructure_attribute_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER school_infra_obs_immutable BEFORE UPDATE OR DELETE ON public.school_infrastructure_observations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.school_infrastructure_attribute_core(_attribute text, _label text, _value_type text, _catalog_values text[], _unit_label text, _source_field text, _source_ref text, _author_user uuid, _author_person uuid, _engagement uuid, _op uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE cur record; vid uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('infra-attr:' || coalesce(_attribute,'')));
  SELECT * INTO cur FROM public.school_infrastructure_attribute_versions WHERE attribute_id = _attribute ORDER BY version_number DESC LIMIT 1;
  IF cur.id IS NOT NULL AND cur.label = pg_catalog.btrim(_label) AND cur.value_type = _value_type
     AND cur.catalog_values IS NOT DISTINCT FROM _catalog_values AND cur.unit_label IS NOT DISTINCT FROM nullif(pg_catalog.btrim(coalesce(_unit_label,'')),'') THEN
    RETURN cur.id;
  END IF;
  IF cur.id IS NOT NULL AND cur.value_type <> _value_type THEN RAISE EXCEPTION 'infra:attribute-type-change-forbidden'; END IF;
  INSERT INTO public.school_infrastructure_attribute_versions(attribute_id, version_number, supersedes_version_id, label, value_type, catalog_values, unit_label, source_field, source_ref, author_user_id, author_person_id, authorizing_engagement_id, technical_operation_id)
  VALUES (_attribute, coalesce(cur.version_number,0)+1, cur.id, pg_catalog.btrim(_label), _value_type, _catalog_values,
          nullif(pg_catalog.btrim(coalesce(_unit_label,'')),''), nullif(pg_catalog.btrim(coalesce(_source_field,'')),''),
          nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''), _author_user, _author_person, _engagement, _op)
  RETURNING id INTO vid;
  RETURN vid;
END $f$;
REVOKE ALL ON FUNCTION public.school_infrastructure_attribute_core(text,text,text,text[],text,text,text,uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.school_infrastructure_observation_core(_school text, _attribute text, _value jsonb, _valid_from date, _source_hash text, _source_ref text, _source_locator text, _author_user uuid, _author_person uuid, _engagement uuid, _op uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE a record; ex record; vb boolean; vi bigint; vd numeric; vt text; vc text; oid uuid;
BEGIN
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'infra:valid-from-required'; END IF;
  IF coalesce(_source_hash,'') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'infra:source-hash-invalid'; END IF;
  IF coalesce(pg_catalog.btrim(_source_ref),'') = '' THEN RAISE EXCEPTION 'infra:source-ref-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_schools WHERE id = _school) THEN RAISE EXCEPTION 'infra:school-not-found'; END IF;
  SELECT * INTO a FROM public.school_infrastructure_attribute_versions WHERE attribute_id = _attribute ORDER BY version_number DESC LIMIT 1;
  IF a.id IS NULL THEN RAISE EXCEPTION 'infra:attribute-unknown'; END IF;
  IF _value IS NULL OR pg_catalog.jsonb_typeof(_value) = 'null' THEN RAISE EXCEPTION 'infra:value-absent-is-not-informed'; END IF;
  CASE a.value_type
    WHEN 'boolean' THEN IF pg_catalog.jsonb_typeof(_value) <> 'boolean' THEN RAISE EXCEPTION 'infra:value-type-mismatch'; END IF; vb := (_value #>> '{}')::boolean;
    WHEN 'integer' THEN IF pg_catalog.jsonb_typeof(_value) <> 'number' OR (_value #>> '{}') !~ '^-?[0-9]+$' THEN RAISE EXCEPTION 'infra:value-type-mismatch'; END IF; vi := (_value #>> '{}')::bigint;
    WHEN 'decimal' THEN IF pg_catalog.jsonb_typeof(_value) <> 'number' THEN RAISE EXCEPTION 'infra:value-type-mismatch'; END IF; vd := (_value #>> '{}')::numeric;
    WHEN 'text' THEN IF pg_catalog.jsonb_typeof(_value) <> 'string' OR pg_catalog.btrim(_value #>> '{}') = '' THEN RAISE EXCEPTION 'infra:value-type-mismatch'; END IF; vt := pg_catalog.btrim(_value #>> '{}');
    WHEN 'catalog' THEN IF pg_catalog.jsonb_typeof(_value) <> 'string' OR NOT ((_value #>> '{}') = ANY (a.catalog_values)) THEN RAISE EXCEPTION 'infra:catalog-value-unknown'; END IF; vc := _value #>> '{}';
  END CASE;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('infra-obs:' || _school || ':' || _attribute));
  SELECT * INTO ex FROM public.school_infrastructure_observations
   WHERE source_hash = _source_hash AND school_id = _school AND attribute_id = _attribute AND valid_from = _valid_from;
  IF ex.id IS NOT NULL THEN
    IF ex.value_boolean IS NOT DISTINCT FROM vb AND ex.value_integer IS NOT DISTINCT FROM vi AND ex.value_decimal IS NOT DISTINCT FROM vd
       AND ex.value_text IS NOT DISTINCT FROM vt AND ex.value_catalog IS NOT DISTINCT FROM vc THEN RETURN ex.id; END IF;
    RAISE EXCEPTION 'infra:same-source-different-value';
  END IF;
  INSERT INTO public.school_infrastructure_observations(school_id, attribute_version_id, attribute_id, value_boolean, value_integer, value_decimal, value_text, value_catalog, valid_from, source_hash, source_ref, source_locator, author_user_id, author_person_id, authorizing_engagement_id, technical_operation_id)
  VALUES (_school, a.id, _attribute, vb, vi, vd, vt, vc, _valid_from, _source_hash, pg_catalog.btrim(_source_ref), nullif(pg_catalog.btrim(coalesce(_source_locator,'')),''), _author_user, _author_person, _engagement, _op)
  RETURNING id INTO oid;
  RETURN oid;
END $f$;
REVOKE ALL ON FUNCTION public.school_infrastructure_observation_core(text,text,jsonb,date,text,text,text,uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_school_infrastructure_attribute(_attribute text, _label text, _value_type text, _catalog_values text[], _unit_label text DEFAULT NULL, _source_field text DEFAULT NULL, _source_ref text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE g record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(current_date) c
   WHERE c.capability_id = 'manter-cadastro-unidade-escolar' AND c.scope_level = 'rede' LIMIT 1;
  IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'capability:manter-cadastro-unidade-escolar não concedida em rede'; END IF;
  RETURN public.school_infrastructure_attribute_core(_attribute, _label, _value_type, _catalog_values, _unit_label, _source_field, _source_ref, auth.uid(), public.current_person_id(), g.engagement_id, NULL);
END $f$;
CREATE OR REPLACE FUNCTION public.record_school_infrastructure_observation(_school text, _attribute text, _value jsonb, _valid_from date, _source_hash text, _source_ref text, _source_locator text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE g record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(current_date) c
   WHERE c.capability_id = 'manter-cadastro-unidade-escolar' AND c.scope_level = 'rede' LIMIT 1;
  IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'capability:manter-cadastro-unidade-escolar não concedida em rede'; END IF;
  RETURN public.school_infrastructure_observation_core(_school, _attribute, _value, _valid_from, _source_hash, _source_ref, _source_locator, auth.uid(), public.current_person_id(), g.engagement_id, NULL);
END $f$;
REVOKE ALL ON FUNCTION public.record_school_infrastructure_attribute(text,text,text,text[],text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_school_infrastructure_observation(text,text,jsonb,date,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_school_infrastructure_attribute(text,text,text,text[],text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_school_infrastructure_observation(text,text,jsonb,date,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.technical_import_educacenso_2026_infrastructure(_operation_kind text, _source_hash text, _snapshot date, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE op uuid; fp text; r jsonb; t0 timestamptz := pg_catalog.clock_timestamp(); existing record; vid uuid; n int := 0;
  m jsonb := _payload->'manifest'; atts jsonb := _payload->'attributes'; obs jsonb := _payload->'observations';
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'technical:automation-disabled'; END IF;
  IF _operation_kind IS DISTINCT FROM 'technical_import_educacenso_2026_infrastructure' THEN RAISE EXCEPTION 'technical:operation-kind-mismatch'; END IF;
  IF coalesce(_source_hash,'') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'technical:source-hash-invalid'; END IF;
  IF _snapshot IS DISTINCT FROM DATE '2026-08-31' THEN RAISE EXCEPTION 'technical:snapshot-mismatch'; END IF;
  IF pg_catalog.jsonb_typeof(m) IS DISTINCT FROM 'object' OR pg_catalog.jsonb_typeof(atts) IS DISTINCT FROM 'array' OR pg_catalog.jsonb_typeof(obs) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'technical:payload-shape'; END IF;
  IF m->>'source_hash' IS DISTINCT FROM _source_hash THEN RAISE EXCEPTION 'technical:manifest-hash-mismatch'; END IF;
  IF (m->>'attribute_count')::int IS DISTINCT FROM pg_catalog.jsonb_array_length(atts) THEN RAISE EXCEPTION 'technical:count-attributes'; END IF;
  IF (m->>'observation_count')::int IS DISTINCT FROM pg_catalog.jsonb_array_length(obs) THEN RAISE EXCEPTION 'technical:count-observations'; END IF;
  IF (m->>'school_count')::int IS DISTINCT FROM (SELECT count(DISTINCT e->>'inep') FROM pg_catalog.jsonb_array_elements(obs) e) THEN RAISE EXCEPTION 'technical:count-schools'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(obs) e GROUP BY e->>'inep', e->>'attribute_id' HAVING count(*) > 1) THEN RAISE EXCEPTION 'technical:duplicate-inep-attribute'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(obs) e WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(atts) x WHERE x->>'attribute_id' = e->>'attribute_id')) THEN RAISE EXCEPTION 'technical:attribute-undeclared'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(obs) e WHERE NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers i WHERE i.identifier_kind='inep' AND i.value = e->>'inep' AND i.school_id = 'inep-' || (e->>'inep'))) THEN RAISE EXCEPTION 'technical:school-not-found'; END IF;
  fp := pg_catalog.encode(extensions.digest(_payload::text, 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('technical:' || _operation_kind));
  SELECT * INTO existing FROM public.technical_execution_operations WHERE operation_kind = _operation_kind AND source_hash = _source_hash;
  IF existing.id IS NOT NULL THEN
    IF existing.payload_fingerprint <> fp THEN RAISE EXCEPTION 'technical:payload-differs-from-recorded-operation'; END IF;
    RETURN existing.id;
  END IF;
  op := pg_catalog.gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, _operation_kind, 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento',
          coalesce(m->>'source_ref','EducaCenso 2026 infraestrutura'), _source_hash, 'decisao-do-proprietario', fp, 'concluida', m, t0);
  FOR r IN SELECT * FROM pg_catalog.jsonb_array_elements(atts) LOOP
    vid := public.school_infrastructure_attribute_core(r->>'attribute_id', r->>'label', r->>'value_type',
      CASE WHEN pg_catalog.jsonb_typeof(r->'catalog_values')='array' THEN ARRAY(SELECT pg_catalog.jsonb_array_elements_text(r->'catalog_values')) END,
      r->>'unit_label', r->>'source_field', m->>'source_ref', NULL, NULL, NULL, op);
    INSERT INTO public.technical_execution_targets VALUES (op, 'school_infrastructure_attribute_versions', vid::text) ON CONFLICT DO NOTHING;
  END LOOP;
  FOR r IN SELECT * FROM pg_catalog.jsonb_array_elements(obs) LOOP
    vid := public.school_infrastructure_observation_core('inep-' || (r->>'inep'), r->>'attribute_id', r->'value', _snapshot,
      _source_hash, coalesce(r->>'source_ref', m->>'source_ref'), r->>'source_locator', NULL, NULL, NULL, op);
    INSERT INTO public.technical_execution_targets VALUES (op, 'school_infrastructure_observations', vid::text) ON CONFLICT DO NOTHING;
    n := n + 1;
  END LOOP;
  IF n <> pg_catalog.jsonb_array_length(obs) THEN RAISE EXCEPTION 'technical:written-count'; END IF;
  RETURN op;
END $f$;
REVOKE ALL ON FUNCTION public.technical_import_educacenso_2026_infrastructure(text,text,date,jsonb) FROM PUBLIC, anon, authenticated, service_role;
