-- Avaliação e Desempenho da rede: avaliações institucionais/externas, resultados brutos, métricas com fórmula versionada,
-- política de divulgação e metas. Nenhum índice, faixa, peso, meta ou limiar é semeado.
-- Capabilities (sem regra de política até decisão do proprietário):
--   manter-avaliacao-institucional (rede) · registrar-resultado-avaliacao-institucional (escola|rede)
--   manter-metrica-desempenho (rede) · consultar-desempenho-educacional (escola|rede)

CREATE FUNCTION public.perf_grant(_capability text, _school text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('manter-avaliacao-institucional','registrar-resultado-avaliacao-institucional','manter-metrica-desempenho','consultar-desempenho-educacional')
    THEN RAISE EXCEPTION 'perf:capability-not-allowed'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL
     AND (c.scope_level = 'rede' OR (_school IS NOT NULL AND c.scope_level = 'escola' AND c.school_id = _school))
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.perf_grant(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.inst_assessment_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.inst_assessment_versions(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  origin text NOT NULL CHECK (origin IN ('institucional','externa')),
  source_note text,
  applied_from date NOT NULL, applied_to date NOT NULL CHECK (applied_to >= applied_from),
  target_population jsonb NOT NULL CHECK (jsonb_typeof(target_population) = 'array'),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  scale jsonb NOT NULL CHECK (jsonb_typeof(scale) = 'object'),
  reason text, author_user_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE TABLE public.inst_assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.inst_assessment_results(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  assessment_logical_id uuid NOT NULL, assessment_version_id uuid NOT NULL REFERENCES public.inst_assessment_versions(id),
  school_id text NOT NULL, student_id text NOT NULL, class_id text, item_id text,
  status text NOT NULL CHECK (status IN ('observado','ausente','nao-aplicado')),
  raw_value text, numeric_value numeric,
  source_ref text, plan_key text UNIQUE,
  reason text, author_user_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (status = 'observado' OR (raw_value IS NULL AND numeric_value IS NULL)),
  CHECK (status <> 'observado' OR raw_value IS NOT NULL),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE TABLE public.performance_metric_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.performance_metric_versions(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 200),
  assessment_logical_id uuid NOT NULL,
  formula jsonb NOT NULL CHECK (jsonb_typeof(formula) = 'object' AND formula->>'op' IN ('media','contagem-observados','proporcao-em-valores')),
  population_key text NOT NULL CHECK (length(btrim(population_key)) > 0),
  unit_label text, source_note text NOT NULL CHECK (length(btrim(source_note)) > 0),
  reason text, author_user_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE TABLE public.performance_disclosure_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.performance_disclosure_versions(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  min_group_size integer NOT NULL CHECK (min_group_size >= 1),
  source_note text NOT NULL CHECK (length(btrim(source_note)) > 0),
  reason text, author_user_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE TABLE public.performance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.performance_goals(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','revogacao')),
  metric_version_id uuid NOT NULL REFERENCES public.performance_metric_versions(id),
  school_id text, target_value numeric NOT NULL, comparator text NOT NULL CHECK (comparator IN ('>=','<=')),
  source_note text NOT NULL CHECK (length(btrim(source_note)) > 0),
  reason text, author_user_id uuid NOT NULL, author_engagement uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE INDEX inst_assessment_results_assessment ON public.inst_assessment_results (assessment_logical_id, school_id);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['inst_assessment_versions','inst_assessment_results','performance_metric_versions','performance_disclosure_versions','performance_goals'] LOOP
    EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I (supersedes_id) WHERE supersedes_id IS NOT NULL', t || '_one_successor', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.import_append_only()', t || '_append_only', t);
  END LOOP;
END $$;

-- Writers -----------------------------------------------------------------------------------------
CREATE FUNCTION public.record_inst_assessment(_base_id uuid, _kind text, _title text, _origin text, _source text, _from date, _to date, _population jsonb, _items jsonb, _scale jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.inst_assessment_versions; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'perf:kind-invalid'; END IF;
  g := public.perf_grant('manter-avaliacao-institucional', NULL);
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.inst_assessment_versions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'perf:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.inst_assessment_versions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'perf:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'perf:already-revoked'; END IF;
    IF _kind = 'revogacao' THEN _title := base.title; _origin := base.origin; _source := base.source_note; _from := base.applied_from; _to := base.applied_to; _population := base.target_population; _items := base.items; _scale := base.scale; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'perf:base-not-allowed'; END IF;
  IF jsonb_typeof(_population) <> 'array' OR jsonb_array_length(_population) = 0 THEN RAISE EXCEPTION 'perf:population-required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_population) p WHERE coalesce(btrim(p->>'axis_id'),'') = '' OR coalesce(btrim(p->>'value_id'),'') = '') THEN RAISE EXCEPTION 'perf:population-invalid'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(_items) i WHERE coalesce(btrim(i->>'item_id'),'') = '') THEN RAISE EXCEPTION 'perf:items-invalid'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(_items)) <> (SELECT count(DISTINCT i->>'item_id') FROM jsonb_array_elements(_items) i) THEN RAISE EXCEPTION 'perf:items-duplicated'; END IF;
  IF _scale->>'kind' NOT IN ('numerico','categorico') THEN RAISE EXCEPTION 'perf:scale-invalid'; END IF;
  IF _scale->>'kind' = 'categorico' AND (jsonb_typeof(_scale->'values') <> 'array' OR jsonb_array_length(_scale->'values') = 0) THEN RAISE EXCEPTION 'perf:scale-invalid'; END IF;
  INSERT INTO public.inst_assessment_versions(logical_id, version, supersedes_id, event_kind, title, origin, source_note, applied_from, applied_to, target_population, items, scale, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, btrim(_title), _origin, nullif(btrim(_source),''), _from, _to, _population, _items, _scale, nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.record_inst_assessment_result(_base_id uuid, _kind text, _assessment_version uuid, _school text, _student text, _class text, _item text, _status text, _raw text, _source text, _plan_key text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.inst_assessment_results; a public.inst_assessment_versions; r uuid; num numeric;
BEGIN
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'perf:kind-invalid'; END IF;
  IF _plan_key IS NOT NULL THEN
    SELECT id INTO r FROM public.inst_assessment_results WHERE plan_key = _plan_key;
    IF r IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.inst_assessment_results WHERE id = r AND author_user_id = auth.uid()) THEN RAISE EXCEPTION 'perf:plan-conflict'; END IF;
      RETURN r;
    END IF;
  END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.inst_assessment_results WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'perf:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.inst_assessment_results WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'perf:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'perf:already-revoked'; END IF;
    _assessment_version := base.assessment_version_id; _school := base.school_id; _student := base.student_id; _class := base.class_id; _item := base.item_id;
    IF _kind = 'revogacao' THEN _status := base.status; _raw := base.raw_value; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'perf:base-not-allowed'; END IF;
  g := public.perf_grant('registrar-resultado-avaliacao-institucional', _school);
  SELECT * INTO a FROM public.inst_assessment_versions WHERE id = _assessment_version;
  IF a.id IS NULL THEN RAISE EXCEPTION 'perf:assessment-unknown'; END IF;
  IF _kind <> 'revogacao' THEN
    IF EXISTS (SELECT 1 FROM public.inst_assessment_versions s WHERE s.supersedes_id = a.id) THEN RAISE EXCEPTION 'perf:assessment-version-superseded'; END IF;
    IF a.event_kind = 'revogacao' THEN RAISE EXCEPTION 'perf:assessment-revoked'; END IF;
  END IF;
  IF _item IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(a.items) i WHERE i->>'item_id' = _item) THEN RAISE EXCEPTION 'perf:item-unknown'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN RAISE EXCEPTION 'perf:student-not-in-school'; END IF;
  IF _status NOT IN ('observado','ausente','nao-aplicado') THEN RAISE EXCEPTION 'perf:status-invalid'; END IF;
  IF _status <> 'observado' THEN _raw := NULL;
  ELSE
    _raw := nullif(btrim(_raw),'');
    IF _raw IS NULL THEN RAISE EXCEPTION 'perf:value-required'; END IF;
    IF a.scale->>'kind' = 'numerico' THEN
      BEGIN num := replace(_raw, ',', '.')::numeric; EXCEPTION WHEN others THEN RAISE EXCEPTION 'perf:value-not-numeric'; END;
      IF (a.scale ? 'min' AND num < (a.scale->>'min')::numeric) OR (a.scale ? 'max' AND num > (a.scale->>'max')::numeric) THEN RAISE EXCEPTION 'perf:value-outside-scale'; END IF;
    ELSIF NOT (a.scale->'values') ? _raw THEN RAISE EXCEPTION 'perf:value-outside-scale'; END IF;
  END IF;
  IF _kind = 'registro' AND EXISTS (SELECT 1 FROM public.inst_assessment_results x WHERE x.assessment_logical_id = a.logical_id AND x.student_id = _student
       AND x.item_id IS NOT DISTINCT FROM _item AND x.event_kind <> 'revogacao' AND NOT EXISTS (SELECT 1 FROM public.inst_assessment_results s WHERE s.supersedes_id = x.id))
    THEN RAISE EXCEPTION 'perf:duplicate-use-rectification'; END IF;
  INSERT INTO public.inst_assessment_results(logical_id, version, supersedes_id, event_kind, assessment_logical_id, assessment_version_id, school_id, student_id, class_id, item_id, status, raw_value, numeric_value, source_ref, plan_key, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, a.logical_id, a.id, _school, _student, _class, _item, _status, _raw, num, nullif(btrim(_source),''), _plan_key, nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.record_performance_metric(_base_id uuid, _kind text, _label text, _assessment uuid, _formula jsonb, _population_key text, _unit text, _source text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.performance_metric_versions; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'perf:kind-invalid'; END IF;
  g := public.perf_grant('manter-metrica-desempenho', NULL);
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.performance_metric_versions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'perf:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.performance_metric_versions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'perf:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'perf:already-revoked'; END IF;
    _assessment := base.assessment_logical_id;
    IF _kind = 'revogacao' THEN _label := base.label; _formula := base.formula; _population_key := base.population_key; _unit := base.unit_label; _source := base.source_note; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'perf:base-not-allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inst_assessment_versions WHERE logical_id = _assessment) THEN RAISE EXCEPTION 'perf:assessment-unknown'; END IF;
  IF _formula->>'op' = 'proporcao-em-valores' AND (jsonb_typeof(_formula->'values') <> 'array' OR jsonb_array_length(_formula->'values') = 0) THEN RAISE EXCEPTION 'perf:formula-invalid'; END IF;
  IF coalesce(_formula->>'op','') NOT IN ('media','contagem-observados','proporcao-em-valores') THEN RAISE EXCEPTION 'perf:formula-invalid'; END IF;
  INSERT INTO public.performance_metric_versions(logical_id, version, supersedes_id, event_kind, label, assessment_logical_id, formula, population_key, unit_label, source_note, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, btrim(_label), _assessment, _formula, btrim(_population_key), nullif(btrim(_unit),''), btrim(_source), nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.record_performance_disclosure(_base_id uuid, _kind text, _min integer, _source text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.performance_disclosure_versions; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'perf:kind-invalid'; END IF;
  g := public.perf_grant('manter-metrica-desempenho', NULL);
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.performance_disclosure_versions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'perf:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.performance_disclosure_versions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'perf:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'perf:already-revoked'; END IF;
    IF _kind = 'revogacao' THEN _min := base.min_group_size; _source := base.source_note; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'perf:base-not-allowed';
  ELSIF EXISTS (SELECT 1 FROM public.performance_disclosure_versions d WHERE d.event_kind <> 'revogacao' AND NOT EXISTS (SELECT 1 FROM public.performance_disclosure_versions s WHERE s.supersedes_id = d.id))
    THEN RAISE EXCEPTION 'perf:duplicate-use-rectification'; END IF;
  INSERT INTO public.performance_disclosure_versions(logical_id, version, supersedes_id, event_kind, min_group_size, source_note, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _min, btrim(_source), nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $fn$;

CREATE FUNCTION public.record_performance_goal(_base_id uuid, _kind text, _metric_version uuid, _school text, _target numeric, _comparator text, _source text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; base public.performance_goals; r uuid;
BEGIN
  IF _kind NOT IN ('registro','retificacao','revogacao') THEN RAISE EXCEPTION 'perf:kind-invalid'; END IF;
  g := public.perf_grant('manter-metrica-desempenho', NULL);
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.performance_goals WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'perf:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.performance_goals WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'perf:base-superseded'; END IF;
    IF base.event_kind = 'revogacao' THEN RAISE EXCEPTION 'perf:already-revoked'; END IF;
    _metric_version := base.metric_version_id; _school := base.school_id;
    IF _kind = 'revogacao' THEN _target := base.target_value; _comparator := base.comparator; _source := base.source_note; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'perf:base-not-allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.performance_metric_versions WHERE id = _metric_version AND event_kind <> 'revogacao') THEN RAISE EXCEPTION 'perf:metric-unknown'; END IF;
  INSERT INTO public.performance_goals(logical_id, version, supersedes_id, event_kind, metric_version_id, school_id, target_value, comparator, source_note, reason, author_user_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _metric_version, _school, _target, _comparator, btrim(_source), nullif(btrim(_reason),''), auth.uid(), g)
  RETURNING id INTO r; RETURN r;
END $fn$;

-- Readers (cabeças conhecidas até _known_at) ---------------------------------------------------
CREATE FUNCTION public.inst_assessments_at(_known_at timestamptz, _logical_id uuid)
RETURNS SETOF public.inst_assessment_versions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.policy_id IS NOT NULL
     AND c.capability_id IN ('consultar-desempenho-educacional','manter-avaliacao-institucional','registrar-resultado-avaliacao-institucional','manter-metrica-desempenho'))
    THEN RAISE EXCEPTION 'capability:consultar-desempenho-educacional'; END IF;
  RETURN QUERY SELECT v.* FROM public.inst_assessment_versions v WHERE v.recorded_at <= k
    AND (CASE WHEN _logical_id IS NOT NULL THEN v.logical_id = _logical_id
         ELSE NOT EXISTS (SELECT 1 FROM public.inst_assessment_versions s WHERE s.supersedes_id = v.id AND s.recorded_at <= k) END)
    ORDER BY v.applied_from DESC, v.version LIMIT 500;
END $fn$;
-- _school NULL ⇒ rede inteira (exige alcance rede).
CREATE FUNCTION public.inst_assessment_results_at(_assessment uuid, _school text, _known_at timestamptz)
RETURNS SETOF public.inst_assessment_results LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  PERFORM public.perf_grant('consultar-desempenho-educacional', _school);
  RETURN QUERY SELECT x.* FROM public.inst_assessment_results x
   WHERE x.assessment_logical_id = _assessment AND (_school IS NULL OR x.school_id = _school) AND x.recorded_at <= k
     AND NOT EXISTS (SELECT 1 FROM public.inst_assessment_results s WHERE s.supersedes_id = x.id AND s.recorded_at <= k)
   ORDER BY x.school_id, x.student_id, x.item_id LIMIT 20000;
END $fn$;
CREATE FUNCTION public.inst_assessment_result_history(_logical_id uuid)
RETURNS SETOF public.inst_assessment_results LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE sc text;
BEGIN
  SELECT school_id INTO sc FROM public.inst_assessment_results WHERE logical_id = _logical_id LIMIT 1;
  IF sc IS NULL THEN RETURN; END IF;
  PERFORM public.perf_grant('consultar-desempenho-educacional', sc);
  RETURN QUERY SELECT x.* FROM public.inst_assessment_results x WHERE x.logical_id = _logical_id ORDER BY x.version;
END $fn$;
CREATE FUNCTION public.performance_metrics_at(_assessment uuid, _known_at timestamptz)
RETURNS SETOF public.performance_metric_versions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.policy_id IS NOT NULL AND c.capability_id IN ('consultar-desempenho-educacional','manter-metrica-desempenho'))
    THEN RAISE EXCEPTION 'capability:consultar-desempenho-educacional'; END IF;
  RETURN QUERY SELECT m.* FROM public.performance_metric_versions m WHERE m.recorded_at <= k AND (_assessment IS NULL OR m.assessment_logical_id = _assessment)
    AND NOT EXISTS (SELECT 1 FROM public.performance_metric_versions s WHERE s.supersedes_id = m.id AND s.recorded_at <= k)
    ORDER BY m.label LIMIT 500;
END $fn$;
CREATE FUNCTION public.performance_disclosure_at(_known_at timestamptz)
RETURNS SETOF public.performance_disclosure_versions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  RETURN QUERY SELECT d.* FROM public.performance_disclosure_versions d WHERE d.recorded_at <= k AND d.event_kind <> 'revogacao'
    AND NOT EXISTS (SELECT 1 FROM public.performance_disclosure_versions s WHERE s.supersedes_id = d.id AND s.recorded_at <= k) LIMIT 2;
END $fn$;
CREATE FUNCTION public.performance_goals_at(_metric_logical uuid, _known_at timestamptz)
RETURNS SETOF public.performance_goals LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.policy_id IS NOT NULL AND c.capability_id IN ('consultar-desempenho-educacional','manter-metrica-desempenho'))
    THEN RAISE EXCEPTION 'capability:consultar-desempenho-educacional'; END IF;
  RETURN QUERY SELECT g.* FROM public.performance_goals g JOIN public.performance_metric_versions m ON m.id = g.metric_version_id
   WHERE m.logical_id = _metric_logical AND g.recorded_at <= k AND g.event_kind <> 'revogacao'
     AND NOT EXISTS (SELECT 1 FROM public.performance_goals s WHERE s.supersedes_id = g.id AND s.recorded_at <= k) LIMIT 500;
END $fn$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'record_inst_assessment(uuid,text,text,text,text,date,date,jsonb,jsonb,jsonb,text)',
    'record_inst_assessment_result(uuid,text,uuid,text,text,text,text,text,text,text,text,text)',
    'record_performance_metric(uuid,text,text,uuid,jsonb,text,text,text,text)',
    'record_performance_disclosure(uuid,text,integer,text,text)',
    'record_performance_goal(uuid,text,uuid,text,numeric,text,text,text)',
    'inst_assessments_at(timestamptz,uuid)','inst_assessment_results_at(uuid,text,timestamptz)','inst_assessment_result_history(uuid)',
    'performance_metrics_at(uuid,timestamptz)','performance_disclosure_at(timestamptz)','performance_goals_at(uuid,timestamptz)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;