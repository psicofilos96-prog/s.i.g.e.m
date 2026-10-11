-- EDUCACENSO.2 — catálogo de leiaute versionado por ano/etapa (append-only). Conteúdo = esquema compartilhado por parser
-- e gerador; o banco recalcula impressão digital, confere contagem declarada × campos e NUNCA marca confronto INEP.
CREATE TABLE public.educacenso_layout_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  census_year text NOT NULL CHECK (census_year ~ '^[0-9]{4}$'),
  stage_key text NOT NULL CHECK (stage_key ~ '^[a-z0-9-]{3,60}$'),
  version integer NOT NULL CHECK (version > 0),
  source_kind text NOT NULL CHECK (source_kind IN ('guia-do-usuario','documento-inep')),
  source_file text NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  layout_registration_id uuid REFERENCES public.educacenso_layout_registrations(id),
  inep_confronted boolean NOT NULL DEFAULT false CHECK (inep_confronted = false),
  content jsonb NOT NULL,
  content_sha256 text NOT NULL,
  record_count integer NOT NULL,
  field_count integer NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 2),
  actor_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (census_year, stage_key, version)
);
COMMENT ON COLUMN public.educacenso_layout_specs.inep_confronted IS 'Sempre false: confronto com documentação INEP exige decisão própria ainda não modelada.';
GRANT SELECT ON public.educacenso_layout_specs TO authenticated;
GRANT ALL ON public.educacenso_layout_specs TO service_role;
ALTER TABLE public.educacenso_layout_specs ENABLE ROW LEVEL SECURITY;
CREATE POLICY educacenso_layout_specs_read ON public.educacenso_layout_specs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE TRIGGER educacenso_layout_specs_immutable BEFORE UPDATE OR DELETE ON public.educacenso_layout_specs FOR EACH ROW EXECUTE FUNCTION public.educacenso_append_only();

CREATE OR REPLACE FUNCTION public.educacenso_register_layout_spec(_year text, _stage_key text, _content jsonb, _expected_version integer, _layout uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE head integer; r jsonb; nrec int := 0; nfld int := 0; fp text; src jsonb; lay record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacenso:session-required'; END IF;
  IF NOT public.has_network_capability('preparar-censo-escolar') THEN RAISE EXCEPTION 'educacenso:not-authorized'; END IF;
  src := _content->'source';
  IF src IS NULL OR coalesce(src->>'kind','') NOT IN ('guia-do-usuario','documento-inep') OR coalesce(src->>'sha256','') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'educacenso:spec-source-required'; END IF;
  IF coalesce((src->>'inepConfronted')::boolean, false) THEN RAISE EXCEPTION 'educacenso:confrontation-not-declarable'; END IF;
  IF _content->>'year' IS DISTINCT FROM _year THEN RAISE EXCEPTION 'educacenso:spec-year-mismatch'; END IF;
  IF jsonb_typeof(_content->'records') <> 'array' OR jsonb_array_length(_content->'records') = 0 THEN RAISE EXCEPTION 'educacenso:spec-empty'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(_content->'records') LOOP
    IF jsonb_typeof(r->'fields') <> 'array' OR jsonb_array_length(r->'fields') <> (r->>'declaredFieldCount')::int THEN
      RAISE EXCEPTION 'educacenso:spec-field-count-mismatch:%', r->>'record'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'fields') WITH ORDINALITY f(v, i) WHERE (f.v->>'n')::int <> f.i) THEN
      RAISE EXCEPTION 'educacenso:spec-field-order:%', r->>'record'; END IF;
    nrec := nrec + 1; nfld := nfld + (r->>'declaredFieldCount')::int;
  END LOOP;
  IF _layout IS NOT NULL THEN SELECT * INTO lay FROM public.educacenso_layout_registrations l WHERE l.id = _layout;
    IF NOT FOUND OR lay.census_year <> _year THEN RAISE EXCEPTION 'educacenso:layout-year-mismatch'; END IF; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('educacenso-spec:' || _year || ':' || _stage_key));
  SELECT max(version) INTO head FROM public.educacenso_layout_specs s WHERE s.census_year = _year AND s.stage_key = _stage_key;
  IF coalesce(head, 0) <> coalesce(_expected_version, -1) THEN RAISE EXCEPTION 'educacenso:stale-base'; END IF;
  fp := encode(extensions.digest(convert_to(_content::text, 'UTF8'), 'sha256'), 'hex');
  INSERT INTO public.educacenso_layout_specs(census_year, stage_key, version, source_kind, source_file, source_sha256, layout_registration_id, content, content_sha256, record_count, field_count, reason, actor_user_id)
  VALUES (_year, _stage_key, coalesce(head, 0) + 1, src->>'kind', coalesce(src->>'file','—'), src->>'sha256', _layout, _content, fp, nrec, nfld, _reason, auth.uid());
  RETURN jsonb_build_object('version', coalesce(head, 0) + 1, 'content_sha256', fp, 'records', nrec, 'fields', nfld);
END $$;
REVOKE ALL ON FUNCTION public.educacenso_register_layout_spec(text,text,jsonb,integer,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.educacenso_register_layout_spec(text,text,jsonb,integer,uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_educacenso(_operation_id text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int := 0; c int;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  DELETE FROM public.educacenso_school_status_events e WHERE public.semed_fixture_row(to_jsonb(e)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.educacenso_collection_events e WHERE public.semed_fixture_row(to_jsonb(e)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.educacenso_layout_specs e WHERE public.semed_fixture_row(to_jsonb(e)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.educacenso_layout_registrations e WHERE public.semed_fixture_row(to_jsonb(e))
    AND NOT EXISTS (SELECT 1 FROM public.educacenso_collection_events x WHERE x.layout_registration_id = e.id)
    AND NOT EXISTS (SELECT 1 FROM public.educacenso_layout_specs x WHERE x.layout_registration_id = e.id); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup_educacenso(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup_educacenso(text) TO service_role;
