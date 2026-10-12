-- SIGEM Desenvolvimento L20: avaliação das formações (questionários reação/aplicabilidade/reavaliação) e impacto institucional (indicadores antes/depois).
-- Respostas só saem agregadas com limiar aprovado; indicadores são agregados por escola/rede, sem coluna de pessoa; variação observada nunca é causalidade.
CREATE TABLE public.dev_survey_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.dev_courses(id),
  version int NOT NULL CHECK (version >= 1),
  moment text NOT NULL CHECK (moment IN ('reacao','aplicabilidade','reavaliacao')),
  questions jsonb NOT NULL CHECK (jsonb_typeof(questions) = 'array' AND jsonb_array_length(questions) >= 1),
  reassess_after_days int CHECK (reassess_after_days IS NULL OR reassess_after_days BETWEEN 15 AND 730),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, moment, version),
  CHECK (version = 1 OR reason IS NOT NULL),
  CHECK ((moment = 'reavaliacao') = (reassess_after_days IS NOT NULL))
);
CREATE TABLE public.dev_survey_approvals (
  survey_version_id uuid PRIMARY KEY REFERENCES public.dev_survey_versions(id),
  approver_person uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_version_id uuid NOT NULL REFERENCES public.dev_survey_approvals(survey_version_id),
  enrollment_id uuid NOT NULL REFERENCES public.dev_enrollments(id),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_version_id, enrollment_id)
);
CREATE TABLE public.dev_impact_indicator_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.dev_programs(id),
  code text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9.-]{1,30}$'),
  version int NOT NULL CHECK (version >= 1),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  unit text NOT NULL CHECK (length(btrim(unit)) BETWEEN 1 AND 40),
  source_description text NOT NULL CHECK (length(btrim(source_description)) >= 20),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, code, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.dev_impact_indicator_approvals (
  indicator_version_id uuid PRIMARY KEY REFERENCES public.dev_impact_indicator_versions(id),
  approver_person uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_impact_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_version_id uuid NOT NULL REFERENCES public.dev_impact_indicator_approvals(indicator_version_id),
  scope_school_id text REFERENCES public.institutional_schools(id),
  moment text NOT NULL CHECK (moment IN ('antes','depois','reavaliacao')),
  observed_on date NOT NULL,
  value numeric NOT NULL,
  group_size int NOT NULL CHECK (group_size >= 1),
  source_ref text NOT NULL CHECK (length(btrim(source_ref)) BETWEEN 3 AND 300),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_impact_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_version_id uuid NOT NULL REFERENCES public.dev_impact_indicator_approvals(indicator_version_id),
  interpretation text NOT NULL CHECK (length(btrim(interpretation)) >= 40),
  limitations text NOT NULL CHECK (length(btrim(limitations)) >= 20),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dev_survey_versions, public.dev_survey_approvals, public.dev_impact_indicator_versions, public.dev_impact_indicator_approvals,
  public.dev_impact_observations, public.dev_impact_readings TO authenticated;
GRANT ALL ON public.dev_survey_versions, public.dev_survey_approvals, public.dev_survey_responses, public.dev_impact_indicator_versions,
  public.dev_impact_indicator_approvals, public.dev_impact_observations, public.dev_impact_readings TO service_role;
REVOKE ALL ON public.dev_survey_responses FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_survey_versions, public.dev_survey_approvals, public.dev_impact_indicator_versions,
  public.dev_impact_indicator_approvals, public.dev_impact_observations, public.dev_impact_readings FROM authenticated, anon;
ALTER TABLE public.dev_survey_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_survey_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_impact_indicator_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_impact_indicator_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_impact_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_impact_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev survey versions read" ON public.dev_survey_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev survey approvals read" ON public.dev_survey_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev impact ind read" ON public.dev_impact_indicator_versions FOR SELECT TO authenticated USING (public.dev_can_manage());
CREATE POLICY "dev impact ind appr read" ON public.dev_impact_indicator_approvals FOR SELECT TO authenticated USING (public.dev_can_manage());
CREATE POLICY "dev impact obs read" ON public.dev_impact_observations FOR SELECT TO authenticated USING (public.dev_can_manage());
CREATE POLICY "dev impact readings read" ON public.dev_impact_readings FOR SELECT TO authenticated USING (public.dev_can_manage());
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['dev_survey_versions','dev_survey_approvals','dev_survey_responses','dev_impact_indicator_versions','dev_impact_indicator_approvals',
    'dev_impact_observations','dev_impact_readings'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only()', t || '_immutable', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.record_dev_survey_version(_course uuid, _moment text, _expected_version int, _questions jsonb, _reassess int, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int; q jsonb; _keys text[] := '{}';
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_survey_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('planejar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  FOR q IN SELECT * FROM jsonb_array_elements(_questions) LOOP
    IF coalesce(q->>'key','') !~ '^[a-z0-9-]{1,40}$' OR (q->>'key') = ANY(_keys) OR length(btrim(coalesce(q->>'text',''))) < 10
       OR coalesce(q->>'kind','') NOT IN ('escala-1-5','texto') THEN RAISE EXCEPTION 'dev:invalid-question'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(q) k WHERE k NOT IN ('key','text','kind')) THEN RAISE EXCEPTION 'dev:invalid-question'; END IF;
    _keys := _keys || (q->>'key');
  END LOOP;
  PERFORM 1 FROM public.dev_courses WHERE id = _course FOR UPDATE;
  SELECT coalesce(max(version), 0) INTO _last FROM public.dev_survey_versions WHERE course_id = _course AND moment = _moment;
  IF _last <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_survey_versions(course_id, version, moment, questions, reassess_after_days, reason, author_person, idempotency_key)
  VALUES (_course, _last + 1, _moment, _questions, _reassess, nullif(btrim(coalesce(_reason,'')),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_dev_survey(_version uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _a uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_survey_approvals WHERE survey_version_id = _version AND approver_person = _p) THEN RETURN; END IF;
  IF NOT public.has_network_capability('aprovar-criterios-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT author_person INTO _a FROM public.dev_survey_versions WHERE id = _version;
  IF _a IS NULL THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _a = _p THEN RAISE EXCEPTION 'dev:self-approval'; END IF;
  INSERT INTO public.dev_survey_approvals(survey_version_id, approver_person, reason) VALUES (_version, _p, btrim(_reason));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.answer_dev_survey(_survey uuid, _enrollment uuid, _answers jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _s public.dev_survey_versions; _e public.dev_enrollments; _end date; q jsonb; k text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT v.* INTO _s FROM public.dev_survey_versions v JOIN public.dev_survey_approvals a ON a.survey_version_id = v.id WHERE v.id = _survey;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:survey-not-approved'; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment AND person_id = _p;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind = 'confirmacao') THEN RAISE EXCEPTION 'dev:not-confirmed'; END IF;
  SELECT k2.ends_on INTO _end FROM public.dev_classes k2 JOIN public.dev_course_versions cv ON cv.id = k2.course_version_id
    WHERE k2.id = _e.class_id AND cv.course_id = _s.course_id;
  IF _end IS NULL THEN RAISE EXCEPTION 'dev:other-course'; END IF;
  IF current_date < _end + coalesce(_s.reassess_after_days, 0) THEN RAISE EXCEPTION 'dev:too-early'; END IF;
  IF jsonb_typeof(_answers) <> 'object' THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  FOR k IN SELECT jsonb_object_keys(_answers) LOOP
    q := NULL;
    SELECT x INTO q FROM jsonb_array_elements(_s.questions) x WHERE x->>'key' = k;
    IF q IS NULL THEN RAISE EXCEPTION 'dev:invalid-answer'; END IF;
    IF q->>'kind' = 'escala-1-5' AND NOT (jsonb_typeof(_answers->k) = 'number' AND (_answers->>k)::numeric IN (1,2,3,4,5)) THEN RAISE EXCEPTION 'dev:invalid-answer'; END IF;
    IF q->>'kind' = 'texto' AND NOT (jsonb_typeof(_answers->k) = 'string' AND length(_answers->>k) <= 2000) THEN RAISE EXCEPTION 'dev:invalid-answer'; END IF;
  END LOOP;
  INSERT INTO public.dev_survey_responses(survey_version_id, enrollment_id, answers) VALUES (_survey, _enrollment, _answers);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-answered';
END $$;

CREATE OR REPLACE FUNCTION public.dev_survey_aggregate(_survey uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _t public.dev_aggregate_threshold_versions; _n int; _s public.dev_survey_versions; _out jsonb;
BEGIN
  IF public.current_person_id() IS NULL OR NOT public.dev_can_manage() THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  _t := public.dev_current_threshold();
  IF _t.id IS NULL THEN RETURN jsonb_build_object('suppressed', true, 'why', 'limiar não configurado'); END IF;
  SELECT * INTO _s FROM public.dev_survey_versions WHERE id = _survey;
  SELECT count(*) INTO _n FROM public.dev_survey_responses WHERE survey_version_id = _survey;
  IF _n < _t.min_group_size THEN RETURN jsonb_build_object('suppressed', true, 'why', 'grupo abaixo do limiar', 'threshold', _t.min_group_size); END IF;
  SELECT jsonb_object_agg(q->>'key', jsonb_build_object('text', q->>'text',
      'answered', (SELECT count(*) FROM public.dev_survey_responses r WHERE r.survey_version_id = _survey AND r.answers ? (q->>'key')),
      'distribution', (SELECT jsonb_object_agg(v, c) FROM (SELECT r.answers->>(q->>'key') v, count(*) c FROM public.dev_survey_responses r
        WHERE r.survey_version_id = _survey AND r.answers ? (q->>'key') GROUP BY 1) d)))
    INTO _out FROM jsonb_array_elements(_s.questions) q WHERE q->>'kind' = 'escala-1-5';
  RETURN jsonb_build_object('suppressed', false, 'responses', _n, 'threshold', _t.min_group_size, 'questions', coalesce(_out, '{}'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.record_dev_impact_indicator(_program uuid, _code text, _expected_version int, _title text, _unit text, _source text, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_impact_indicator_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('planejar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  PERFORM 1 FROM public.dev_programs WHERE id = _program FOR UPDATE;
  SELECT coalesce(max(version), 0) INTO _last FROM public.dev_impact_indicator_versions WHERE program_id = _program AND code = upper(btrim(_code));
  IF _last <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_impact_indicator_versions(program_id, code, version, title, unit, source_description, reason, author_person, idempotency_key)
  VALUES (_program, upper(btrim(_code)), _last + 1, btrim(_title), btrim(_unit), btrim(_source), nullif(btrim(coalesce(_reason,'')),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_dev_impact_indicator(_version uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _a uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_impact_indicator_approvals WHERE indicator_version_id = _version AND approver_person = _p) THEN RETURN; END IF;
  IF NOT public.has_network_capability('aprovar-criterios-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT author_person INTO _a FROM public.dev_impact_indicator_versions WHERE id = _version;
  IF _a IS NULL THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _a = _p THEN RAISE EXCEPTION 'dev:self-approval'; END IF;
  INSERT INTO public.dev_impact_indicator_approvals(indicator_version_id, approver_person, reason) VALUES (_version, _p, btrim(_reason));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_dev_impact_observation(_indicator uuid, _school text, _moment text, _observed_on date, _value numeric, _group int, _source text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _t public.dev_aggregate_threshold_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_impact_observations WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('acompanhar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  _t := public.dev_current_threshold();
  IF _t.id IS NULL THEN RAISE EXCEPTION 'dev:threshold-missing'; END IF;
  IF _group < _t.min_group_size THEN RAISE EXCEPTION 'dev:below-threshold'; END IF;
  IF _observed_on > current_date THEN RAISE EXCEPTION 'dev:future'; END IF;
  INSERT INTO public.dev_impact_observations(indicator_version_id, scope_school_id, moment, observed_on, value, group_size, source_ref, author_person, idempotency_key)
  VALUES (_indicator, _school, _moment, _observed_on, _value, _group, btrim(_source), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_dev_impact_reading(_indicator uuid, _interpretation text, _limitations text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_impact_readings WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('acompanhar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  INSERT INTO public.dev_impact_readings(indicator_version_id, interpretation, limitations, author_person, idempotency_key)
  VALUES (_indicator, btrim(_interpretation), btrim(_limitations), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_dev_survey_version(uuid,text,int,jsonb,int,text,text)','approve_dev_survey(uuid,text)','answer_dev_survey(uuid,uuid,jsonb)',
    'dev_survey_aggregate(uuid)','record_dev_impact_indicator(uuid,text,int,text,text,text,text,text)','approve_dev_impact_indicator(uuid,text)',
    'record_dev_impact_observation(uuid,text,text,date,numeric,int,text,text)','record_dev_impact_reading(uuid,text,text,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
COMMENT ON TABLE public.dev_impact_observations IS 'Agregado institucional (rede/escola) sem pessoa; variação antes/depois é observação, não causalidade, e não serve para avaliação individual ou punição.';