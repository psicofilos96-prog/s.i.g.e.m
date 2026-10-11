CREATE TABLE public.educacenso_code_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  census_year text NOT NULL,
  source_scheme text NOT NULL,
  source_value text NOT NULL,
  target_record text NOT NULL,
  target_field integer NOT NULL,
  inep_code text,
  version integer NOT NULL,
  act text NOT NULL CHECK (act IN ('definir','retirar')),
  spec_id uuid NOT NULL REFERENCES public.educacenso_layout_specs(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  actor_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (census_year, source_scheme, source_value, target_record, target_field, version),
  CHECK ((act = 'definir' AND inep_code IS NOT NULL) OR (act = 'retirar' AND inep_code IS NULL))
);
COMMENT ON TABLE public.educacenso_code_translations IS 'Tradutor versionado valor homologado do SIGEM → código INEP de um campo do catálogo registrado. Append-only; código só aceito se constar da lista do catálogo registrado; nunca derivado do nome da turma.';
GRANT SELECT ON public.educacenso_code_translations TO authenticated;
GRANT ALL ON public.educacenso_code_translations TO service_role;
ALTER TABLE public.educacenso_code_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translations read by census" ON public.educacenso_code_translations FOR SELECT TO authenticated
  USING ((SELECT public.has_network_capability('preparar-censo-escolar')) OR (SELECT public.has_network_capability('consultar-censo-escolar'))
         OR EXISTS (SELECT 1 FROM public.school_capability_schools('preparar-censo-escolar')));
CREATE TRIGGER educacenso_code_translations_no_change BEFORE UPDATE OR DELETE ON public.educacenso_code_translations
  FOR EACH ROW EXECUTE FUNCTION public.educacenso_identity_review_immutable();

CREATE OR REPLACE FUNCTION public.educacenso_translate_code(_year text, _scheme text, _value text, _record text, _field integer, _code text, _act text, _expected_version integer, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _head integer; _spec public.educacenso_layout_specs; _f jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacenso:unauthenticated'; END IF;
  IF NOT public.has_network_capability('preparar-censo-escolar') THEN RAISE EXCEPTION 'educacenso:forbidden'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'educacenso:reason-required'; END IF;
  IF _act NOT IN ('definir','retirar') THEN RAISE EXCEPTION 'educacenso:invalid-transition'; END IF;
  IF coalesce(btrim(_scheme),'') = '' OR coalesce(btrim(_value),'') = '' THEN RAISE EXCEPTION 'educacenso:source-required'; END IF;
  SELECT * INTO _spec FROM public.educacenso_layout_specs WHERE census_year = _year ORDER BY recorded_at DESC, version DESC LIMIT 1;
  IF _spec.id IS NULL THEN RAISE EXCEPTION 'educacenso:layout-spec-missing'; END IF;
  SELECT f INTO _f FROM jsonb_array_elements(_spec.content->'records') r, jsonb_array_elements(r->'fields') f
   WHERE r->>'record' = _record AND (f->>'n')::int = _field AND coalesce(r->>'file','importacao') <> 'identificacao' LIMIT 1;
  IF _f IS NULL THEN RAISE EXCEPTION 'educacenso:field-unknown'; END IF;
  IF _act = 'definir' THEN
    IF _f->'codes' IS NULL OR jsonb_typeof(_f->'codes') <> 'object' THEN RAISE EXCEPTION 'educacenso:field-without-code-list'; END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_f->'codes'->'list') c WHERE c->>'code' = _code) THEN RAISE EXCEPTION 'educacenso:code-not-in-catalog'; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('educacenso-tr:' || _year || _scheme || _value || _record || _field));
  SELECT coalesce(max(version), 0) INTO _head FROM public.educacenso_code_translations
   WHERE census_year = _year AND source_scheme = _scheme AND source_value = _value AND target_record = _record AND target_field = _field;
  IF _head <> coalesce(_expected_version, -1) THEN RAISE EXCEPTION 'educacenso:stale-base'; END IF;
  IF _act = 'retirar' AND _head = 0 THEN RAISE EXCEPTION 'educacenso:invalid-transition'; END IF;
  INSERT INTO public.educacenso_code_translations (census_year, source_scheme, source_value, target_record, target_field, inep_code, version, act, spec_id, reason, actor_user_id)
  VALUES (_year, btrim(_scheme), btrim(_value), _record, _field, CASE WHEN _act = 'definir' THEN _code END, _head + 1, _act, _spec.id, btrim(_reason), auth.uid());
  RETURN _head + 1;
END $$;
REVOKE ALL ON FUNCTION public.educacenso_translate_code(text, text, text, text, integer, text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.educacenso_translate_code(text, text, text, text, integer, text, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_educacenso_translations(_operation_id text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer;
BEGIN
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-operation'; END IF;
  ALTER TABLE public.educacenso_code_translations DISABLE TRIGGER educacenso_code_translations_no_change;
  DELETE FROM public.educacenso_code_translations t USING auth.users u
   WHERE t.actor_user_id = u.id AND u.raw_user_meta_data->>'sigem_fixture' = 'BO' AND u.raw_user_meta_data->>'operation_id' = _operation_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  ALTER TABLE public.educacenso_code_translations ENABLE TRIGGER educacenso_code_translations_no_change;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup_educacenso_translations(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup_educacenso_translations(text) TO service_role;