-- BM.1 Fundação de Inteligência Educacional (Acompanhamento e Avaliação).
-- Estende 0075 (inst_assessment_versions/results/metrics): programa, edição, comparabilidade declarada,
-- painéis salvos (referências, nunca dados) e definições de análise/previsão (sem execução).
-- Nenhum programa, escala, faixa, meta, correspondência ou regra é semeado.
-- Capabilities novas (sem regra de política até configuração humana):
--   consultar-resultados-avaliativos (escola|rede) · manter-programa-avaliativo (rede)
--   declarar-comparabilidade-avaliativa (rede) · manter-painel-inteligencia (escola|rede)
--   definir-analise-avaliativa (rede)

CREATE FUNCTION public.ei_grant(_capability text, _school text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('consultar-resultados-avaliativos','manter-programa-avaliativo','declarar-comparabilidade-avaliativa','manter-painel-inteligencia','definir-analise-avaliativa')
    THEN RAISE EXCEPTION 'ei:capability-not-allowed'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL
     AND (c.scope_level = 'rede' OR (_school IS NOT NULL AND c.scope_level = 'escola' AND c.school_id = _school))
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.ei_grant(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.assessment_program_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.assessment_program_versions(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  origin_kind text NOT NULL CHECK (origin_kind IN ('interna','externa')),
  application_responsibility text NOT NULL CHECK (length(btrim(application_responsibility)) > 0),
  correction_responsibility text NOT NULL CHECK (length(btrim(correction_responsibility)) > 0),
  result_delivery text NOT NULL CHECK (result_delivery IN ('registro-na-rede','importado-de-fonte-externa','misto')),
  source_note text,
  reason text, author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE TABLE public.assessment_edition_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.assessment_edition_versions(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  program_logical_id uuid NOT NULL,
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 200),
  cycle_label text,
  reference_date date NOT NULL,
  instrument_logical_ids uuid[] NOT NULL DEFAULT '{}',
  reference_edition_id text,
  source_note text,
  reason text, author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE TABLE public.assessment_metric_comparability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.assessment_metric_comparability(id),
  metric_a uuid NOT NULL, metric_b uuid NOT NULL CHECK (metric_a <> metric_b),
  status text NOT NULL CHECK (status IN ('comparable','not_comparable','unknown')),
  source_note text NOT NULL CHECK (length(btrim(source_note)) > 0),
  reason text, author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE TABLE public.intelligence_dashboard_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.intelligence_dashboard_versions(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  visibility text NOT NULL CHECK (visibility IN ('pessoal','compartilhado','institucional')),
  audience_capability text,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  widgets jsonb NOT NULL CHECK (jsonb_typeof(widgets) = 'array'),
  filters jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(filters) = 'object'),
  reason text, author_user_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (visibility <> 'compartilhado' OR audience_capability IS NOT NULL),
  CHECK (version = 1 OR supersedes_id IS NOT NULL)
);
CREATE TABLE public.assessment_analysis_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.assessment_analysis_definitions(id),
  kind text NOT NULL CHECK (kind IN ('analise','previsao')),
  algorithm text NOT NULL CHECK (length(btrim(algorithm)) > 0),
  algorithm_version text NOT NULL CHECK (length(btrim(algorithm_version)) > 0),
  parameters jsonb NOT NULL CHECK (jsonb_typeof(parameters) = 'object'),
  input_refs jsonb NOT NULL CHECK (jsonb_typeof(input_refs) = 'array' AND jsonb_array_length(input_refs) > 0),
  reason text, author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR supersedes_id IS NOT NULL)
);
COMMENT ON TABLE public.assessment_analysis_definitions IS 'BM.1: só definição; nenhuma execução ou projeção é gravada nesta frente; projeção nunca sobrescreve fato.';

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['assessment_program_versions','assessment_edition_versions','assessment_metric_comparability','intelligence_dashboard_versions','assessment_analysis_definitions'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.import_append_only()', t || '_append_only', t);
  END LOOP;
END $$;

-- Writers ------------------------------------------------------------------------------------
CREATE FUNCTION public.record_assessment_program(_base_id uuid, _kind text, _name text, _origin text, _application text, _correction text, _delivery text, _source text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; me uuid; base public.assessment_program_versions; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'ei:kind-invalid'; END IF;
  g := public.ei_grant('manter-programa-avaliativo', NULL);
  me := public.af_natural_person();
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.assessment_program_versions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'ei:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.assessment_program_versions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'ei:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'ei:already-revoked'; END IF;
    IF _kind = 'revogacao' THEN _name := base.name; _origin := base.origin_kind; _application := base.application_responsibility; _correction := base.correction_responsibility; _delivery := base.result_delivery; _source := base.source_note; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'ei:base-not-allowed'; END IF;
  INSERT INTO public.assessment_program_versions(logical_id, version, supersedes_id, event_kind, name, origin_kind, application_responsibility, correction_responsibility, result_delivery, source_note, reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, btrim(_name), _origin, btrim(_application), btrim(_correction), _delivery, nullif(btrim(_source),''), nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.record_assessment_edition(_base_id uuid, _kind text, _program uuid, _label text, _cycle text, _reference_date date, _instruments uuid[], _reference_edition text, _source text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; me uuid; base public.assessment_edition_versions; r uuid; i uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'ei:kind-invalid'; END IF;
  g := public.ei_grant('manter-programa-avaliativo', NULL);
  me := public.af_natural_person();
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.assessment_edition_versions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'ei:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.assessment_edition_versions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'ei:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'ei:already-revoked'; END IF;
    _program := base.program_logical_id;
    IF _kind = 'revogacao' THEN _label := base.label; _cycle := base.cycle_label; _reference_date := base.reference_date; _instruments := base.instrument_logical_ids; _reference_edition := base.reference_edition_id; _source := base.source_note; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'ei:base-not-allowed'; END IF;
  IF _reference_date IS NULL THEN RAISE EXCEPTION 'ei:reference-date-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assessment_program_versions p WHERE p.logical_id = _program AND p.event_kind <> 'revogacao'
     AND NOT EXISTS (SELECT 1 FROM public.assessment_program_versions s WHERE s.supersedes_id = p.id)) THEN RAISE EXCEPTION 'ei:program-unknown'; END IF;
  FOREACH i IN ARRAY coalesce(_instruments, '{}') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.inst_assessment_versions v WHERE v.logical_id = i) THEN RAISE EXCEPTION 'ei:instrument-unknown'; END IF;
  END LOOP;
  IF _reference_edition IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.curricular_reference_editions e WHERE e.id::text = _reference_edition) THEN RAISE EXCEPTION 'ei:reference-edition-unknown'; END IF;
  INSERT INTO public.assessment_edition_versions(logical_id, version, supersedes_id, event_kind, program_logical_id, label, cycle_label, reference_date, instrument_logical_ids, reference_edition_id, source_note, reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _program, btrim(_label), nullif(btrim(_cycle),''), _reference_date, coalesce(_instruments,'{}'), _reference_edition, nullif(btrim(_source),''), nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.record_metric_comparability(_base_id uuid, _metric_a uuid, _metric_b uuid, _status text, _source text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; me uuid; base public.assessment_metric_comparability; r uuid; a uuid; b uuid;
BEGIN
  g := public.ei_grant('declarar-comparabilidade-avaliativa', NULL);
  me := public.af_natural_person();
  a := least(_metric_a, _metric_b); b := greatest(_metric_a, _metric_b);
  IF _base_id IS NOT NULL THEN
    SELECT * INTO base FROM public.assessment_metric_comparability WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'ei:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.assessment_metric_comparability WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'ei:base-superseded'; END IF;
    a := base.metric_a; b := base.metric_b;
  ELSIF EXISTS (SELECT 1 FROM public.assessment_metric_comparability c WHERE c.metric_a = a AND c.metric_b = b) THEN RAISE EXCEPTION 'ei:comparability-exists-use-base';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.performance_metric_versions m WHERE m.logical_id = a) OR NOT EXISTS (SELECT 1 FROM public.performance_metric_versions m WHERE m.logical_id = b) THEN RAISE EXCEPTION 'ei:metric-unknown'; END IF;
  INSERT INTO public.assessment_metric_comparability(logical_id, version, supersedes_id, metric_a, metric_b, status, source_note, reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, a, b, _status, btrim(_source), nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.ei_widgets_valid(_w jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT jsonb_typeof(_w) = 'array' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(_w) x
     WHERE jsonb_typeof(x) <> 'object' OR coalesce(btrim(x->>'id'),'') = '' OR coalesce(btrim(x->>'queryRef'),'') = ''
        OR x->>'visual' NOT IN ('tabela','pivot','kpi','grafico-linha','grafico-barra')
        OR x ? 'rows' OR x ? 'data' OR x ? 'values') $$;
REVOKE ALL ON FUNCTION public.ei_widgets_valid(jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.record_intelligence_dashboard(_base_id uuid, _kind text, _visibility text, _audience text, _title text, _widgets jsonb, _filters jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.intelligence_dashboard_versions; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'ei:kind-invalid'; END IF;
  IF _visibility = 'pessoal' THEN
    SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.capability_id = 'manter-painel-inteligencia' AND c.policy_id IS NOT NULL LIMIT 1;
    IF g IS NULL THEN RAISE EXCEPTION 'capability:manter-painel-inteligencia'; END IF;
  ELSE g := public.ei_grant('manter-painel-inteligencia', NULL); PERFORM public.af_natural_person(); END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.intelligence_dashboard_versions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'ei:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.intelligence_dashboard_versions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'ei:base-superseded'; END IF;
    IF base.visibility = 'pessoal' AND base.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'ei:not-found'; END IF;
    IF _kind = 'revogacao' THEN _visibility := base.visibility; _audience := base.audience_capability; _title := base.title; _widgets := base.widgets; _filters := base.filters; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'ei:base-not-allowed'; END IF;
  IF NOT public.ei_widgets_valid(_widgets) THEN RAISE EXCEPTION 'ei:widgets-invalid'; END IF;
  INSERT INTO public.intelligence_dashboard_versions(logical_id, version, supersedes_id, event_kind, visibility, audience_capability, title, widgets, filters, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _visibility, nullif(btrim(_audience),''), btrim(_title), _widgets, coalesce(_filters,'{}'), nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.record_assessment_analysis_definition(_base_id uuid, _kind text, _algorithm text, _algorithm_version text, _parameters jsonb, _inputs jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; me uuid; base public.assessment_analysis_definitions; r uuid;
BEGIN
  g := public.ei_grant('definir-analise-avaliativa', NULL);
  me := public.af_natural_person();
  IF _base_id IS NOT NULL THEN
    SELECT * INTO base FROM public.assessment_analysis_definitions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'ei:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.assessment_analysis_definitions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'ei:base-superseded'; END IF;
  END IF;
  INSERT INTO public.assessment_analysis_definitions(logical_id, version, supersedes_id, kind, algorithm, algorithm_version, parameters, input_refs, reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, btrim(_algorithm), btrim(_algorithm_version), _parameters, _inputs, nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r; RETURN r;
END $fn$;

-- Readers (knownAt explícito; negação uniforme) -----------------------------------------------
CREATE FUNCTION public.ei_can_read() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.policy_id IS NOT NULL
    AND c.capability_id IN ('consultar-resultados-avaliativos','manter-programa-avaliativo','consultar-desempenho-educacional')) $$;
REVOKE ALL ON FUNCTION public.ei_can_read() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.assessment_programs_at(_known_at timestamptz)
RETURNS SETOF public.assessment_program_versions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  IF NOT public.ei_can_read() THEN RAISE EXCEPTION 'capability:consultar-resultados-avaliativos'; END IF;
  RETURN QUERY SELECT p.* FROM public.assessment_program_versions p WHERE p.recorded_at <= k
    AND NOT EXISTS (SELECT 1 FROM public.assessment_program_versions s WHERE s.supersedes_id = p.id AND s.recorded_at <= k) ORDER BY p.name LIMIT 500;
END $fn$;
CREATE FUNCTION public.assessment_editions_at(_program uuid, _known_at timestamptz)
RETURNS SETOF public.assessment_edition_versions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  IF NOT public.ei_can_read() THEN RAISE EXCEPTION 'capability:consultar-resultados-avaliativos'; END IF;
  RETURN QUERY SELECT e.* FROM public.assessment_edition_versions e WHERE e.recorded_at <= k AND (_program IS NULL OR e.program_logical_id = _program)
    AND NOT EXISTS (SELECT 1 FROM public.assessment_edition_versions s WHERE s.supersedes_id = e.id AND s.recorded_at <= k) ORDER BY e.reference_date DESC LIMIT 1000;
END $fn$;
CREATE FUNCTION public.assessment_metric_comparability_at(_known_at timestamptz)
RETURNS SETOF public.assessment_metric_comparability LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  IF NOT public.ei_can_read() THEN RAISE EXCEPTION 'capability:consultar-resultados-avaliativos'; END IF;
  RETURN QUERY SELECT c.* FROM public.assessment_metric_comparability c WHERE c.recorded_at <= k
    AND NOT EXISTS (SELECT 1 FROM public.assessment_metric_comparability s WHERE s.supersedes_id = c.id AND s.recorded_at <= k) LIMIT 2000;
END $fn$;
CREATE FUNCTION public.intelligence_dashboards_visible()
RETURNS SETOF public.intelligence_dashboard_versions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  RETURN QUERY SELECT d.* FROM public.intelligence_dashboard_versions d
   WHERE d.event_kind <> 'revogacao' AND NOT EXISTS (SELECT 1 FROM public.intelligence_dashboard_versions s WHERE s.supersedes_id = d.id)
     AND ((d.visibility = 'pessoal' AND d.author_user_id = auth.uid())
       OR (d.visibility = 'institucional' AND public.ei_can_read())
       OR (d.visibility = 'compartilhado' AND EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.policy_id IS NOT NULL AND c.capability_id = d.audience_capability)))
   ORDER BY d.visibility, d.title LIMIT 500;
END $fn$;
CREATE FUNCTION public.assessment_analysis_definitions_at(_known_at timestamptz)
RETURNS SETOF public.assessment_analysis_definitions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  IF NOT public.ei_can_read() THEN RAISE EXCEPTION 'capability:consultar-resultados-avaliativos'; END IF;
  RETURN QUERY SELECT a.* FROM public.assessment_analysis_definitions a WHERE a.recorded_at <= k
    AND NOT EXISTS (SELECT 1 FROM public.assessment_analysis_definitions s WHERE s.supersedes_id = a.id AND s.recorded_at <= k) LIMIT 500;
END $fn$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'record_assessment_program(uuid,text,text,text,text,text,text,text,text)',
    'record_assessment_edition(uuid,text,uuid,text,text,date,uuid[],text,text,text)',
    'record_metric_comparability(uuid,uuid,uuid,text,text,text)',
    'record_intelligence_dashboard(uuid,text,text,text,text,jsonb,jsonb,text)',
    'record_assessment_analysis_definition(uuid,text,text,text,jsonb,jsonb,text)',
    'assessment_programs_at(timestamptz)','assessment_editions_at(uuid,timestamptz)',
    'assessment_metric_comparability_at(timestamptz)','intelligence_dashboards_visible()',
    'assessment_analysis_definitions_at(timestamptz)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
