CREATE TABLE public.ext_result_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version int NOT NULL, supersedes_id uuid REFERENCES public.ext_result_versions(id),
  program_key text NOT NULL CHECK (program_key IN ('saeb','ideb','avalia-rj','cnca-caed')),
  edition_year int NOT NULL CHECK (edition_year BETWEEN 2005 AND 2100),
  stage text NOT NULL, area text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('rede','escola')), school_id text,
  sample_kind text NOT NULL CHECK (sample_kind IN ('censitaria','amostral')),
  scale_key text NOT NULL, matrix_ref text NOT NULL,
  expected_count int, present_count int,
  proficiency numeric, levels jsonb, flow_p numeric, perf_n numeric, ideb numeric, target numeric,
  source_ref text NOT NULL, source_hash text, reason text,
  author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK ((scope = 'escola') = (school_id IS NOT NULL))
);
CREATE TABLE public.ext_result_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_version_id uuid NOT NULL REFERENCES public.ext_result_versions(id),
  decision text NOT NULL CHECK (decision IN ('homologado','revogado')), reason text NOT NULL,
  author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ext_result_versions, public.ext_result_homologations TO authenticated;
GRANT ALL ON public.ext_result_versions, public.ext_result_homologations TO service_role;
ALTER TABLE public.ext_result_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ext_result_homologations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ext_res_read ON public.ext_result_versions FOR SELECT TO authenticated USING (
  public.has_network_capability('acompanhar-avaliacao-externa') OR public.has_network_capability('registrar-avaliacao-externa')
  OR (scope = 'rede' AND public.has_network_capability('homologar-avaliacao-externa'))
  OR (school_id IS NOT NULL AND public.has_school_capability('acompanhar-avaliacao-externa', school_id)));
CREATE POLICY ext_hom_read ON public.ext_result_homologations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ext_result_versions v WHERE v.id = result_version_id));
CREATE FUNCTION public.ext_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'avaliacao-externa:append-only'; END $$;
CREATE TRIGGER ext_res_ro BEFORE UPDATE OR DELETE ON public.ext_result_versions FOR EACH ROW EXECUTE FUNCTION public.ext_append_only();
CREATE TRIGGER ext_hom_ro BEFORE UPDATE OR DELETE ON public.ext_result_homologations FOR EACH ROW EXECUTE FUNCTION public.ext_append_only();

CREATE FUNCTION public.ext_record_result(_logical uuid, _expected_version int, _program text, _year int, _stage text, _area text,
  _scope text, _school text, _sample text, _scale text, _matrix text, _expected int, _present int,
  _proficiency numeric, _levels jsonb, _flow_p numeric, _perf_n numeric, _ideb numeric, _target numeric,
  _source text, _source_hash text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE lid uuid := coalesce(_logical, gen_random_uuid()); b public.ext_result_versions; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'avaliacao-externa:unauthenticated'; END IF;
  IF NOT public.has_network_capability('registrar-avaliacao-externa') THEN RAISE EXCEPTION 'avaliacao-externa:forbidden'; END IF;
  IF length(btrim(coalesce(_source,''))) < 3 THEN RAISE EXCEPTION 'avaliacao-externa:source-required'; END IF;
  IF length(btrim(coalesce(_scale,''))) = 0 OR length(btrim(coalesce(_matrix,''))) = 0 THEN RAISE EXCEPTION 'avaliacao-externa:scale-matrix-required'; END IF;
  IF _scale ILIKE '%acerto%' THEN RAISE EXCEPTION 'avaliacao-externa:raw-score-not-proficiency'; END IF;
  IF _program = 'saeb' AND _scale NOT LIKE 'saeb-%' THEN RAISE EXCEPTION 'avaliacao-externa:scale-program-mismatch'; END IF;
  IF _program = 'avalia-rj' AND _scale NOT LIKE 'avalia-rj-%' THEN RAISE EXCEPTION 'avaliacao-externa:scale-program-mismatch'; END IF;
  IF _program = 'cnca-caed' AND _scale NOT LIKE 'caed-%' THEN RAISE EXCEPTION 'avaliacao-externa:scale-program-mismatch'; END IF;
  IF _program = 'ideb' AND _scale <> 'ideb-inep' THEN RAISE EXCEPTION 'avaliacao-externa:scale-program-mismatch'; END IF;
  IF _program <> 'ideb' AND (_ideb IS NOT NULL OR _flow_p IS NOT NULL OR _perf_n IS NOT NULL) THEN RAISE EXCEPTION 'avaliacao-externa:ideb-fields-only-ideb'; END IF;
  IF _program = 'ideb' AND _proficiency IS NOT NULL THEN RAISE EXCEPTION 'avaliacao-externa:ideb-no-proficiency'; END IF;
  IF _flow_p IS NOT NULL AND (_flow_p <= 0 OR _flow_p > 1) THEN RAISE EXCEPTION 'avaliacao-externa:flow-range'; END IF;
  IF _perf_n IS NOT NULL AND (_perf_n < 0 OR _perf_n > 10) THEN RAISE EXCEPTION 'avaliacao-externa:n-range'; END IF;
  IF _ideb IS NOT NULL AND _flow_p IS NOT NULL AND _perf_n IS NOT NULL AND abs(_ideb - _flow_p * _perf_n) > 0.051 THEN RAISE EXCEPTION 'avaliacao-externa:ideb-not-n-times-p'; END IF;
  IF _expected IS NOT NULL AND _present IS NOT NULL AND (_present < 0 OR _present > _expected) THEN RAISE EXCEPTION 'avaliacao-externa:participation-invalid'; END IF;
  IF _levels IS NOT NULL AND jsonb_typeof(_levels) <> 'array' THEN RAISE EXCEPTION 'avaliacao-externa:levels-invalid'; END IF;
  SELECT * INTO b FROM public.ext_result_versions WHERE logical_id = lid ORDER BY version DESC LIMIT 1 FOR UPDATE;
  IF coalesce(b.version,0) <> coalesce(_expected_version,0) THEN RAISE EXCEPTION 'avaliacao-externa:stale-base'; END IF;
  IF b.id IS NOT NULL AND length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'avaliacao-externa:reason-required'; END IF;
  INSERT INTO public.ext_result_versions(logical_id, version, supersedes_id, program_key, edition_year, stage, area, scope, school_id, sample_kind, scale_key, matrix_ref,
    expected_count, present_count, proficiency, levels, flow_p, perf_n, ideb, target, source_ref, source_hash, reason, author_user_id)
  VALUES (lid, coalesce(b.version,0)+1, b.id, _program, _year, btrim(_stage), btrim(_area), _scope, nullif(btrim(coalesce(_school,'')),''), _sample, btrim(_scale), btrim(_matrix),
    _expected, _present, _proficiency, _levels, _flow_p, _perf_n, _ideb, _target, btrim(_source), _source_hash, nullif(btrim(coalesce(_reason,'')),''), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;
CREATE FUNCTION public.ext_homologate_result(_version uuid, _decision text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.ext_result_versions; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'avaliacao-externa:unauthenticated'; END IF;
  IF NOT public.has_network_capability('homologar-avaliacao-externa') THEN RAISE EXCEPTION 'avaliacao-externa:forbidden'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'avaliacao-externa:reason-required'; END IF;
  SELECT * INTO v FROM public.ext_result_versions WHERE id = _version;
  IF v.id IS NULL THEN RAISE EXCEPTION 'avaliacao-externa:not-found'; END IF;
  IF v.author_user_id = auth.uid() THEN RAISE EXCEPTION 'avaliacao-externa:self-homologation'; END IF;
  INSERT INTO public.ext_result_homologations(result_version_id, decision, reason, author_user_id) VALUES (_version, _decision, btrim(_reason), auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.ext_record_result(uuid,int,text,int,text,text,text,text,text,text,text,int,int,numeric,jsonb,numeric,numeric,numeric,numeric,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ext_homologate_result(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ext_record_result(uuid,int,text,int,text,text,text,text,text,text,text,int,int,numeric,jsonb,numeric,numeric,numeric,numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ext_homologate_result(uuid,text,text) TO authenticated;