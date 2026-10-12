-- SIGEM Desenvolvimento L14: resultados de aprendizagem por rubrica versionada. Satisfação (questionário L13) não entra aqui.
CREATE TABLE public.dev_rubric_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  course_id uuid NOT NULL REFERENCES public.dev_courses(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 200),
  criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria) = 'array' AND jsonb_array_length(criteria) BETWEEN 1 AND 20),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.dev_rubric_approvals (
  rubric_version_id uuid PRIMARY KEY REFERENCES public.dev_rubric_versions(id),
  approver_person uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Resultado: versões por inscrição × rubrica aprovada; cada critério com nível + justificativa; desfecho declarado pelo avaliador.
CREATE TABLE public.dev_learning_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.dev_enrollments(id),
  rubric_version_id uuid NOT NULL REFERENCES public.dev_rubric_approvals(rubric_version_id),
  version int NOT NULL CHECK (version >= 1),
  ratings jsonb NOT NULL CHECK (jsonb_typeof(ratings) = 'object'),
  outcome text NOT NULL CHECK (outcome IN ('atingiu','atingiu-parcialmente','nao-atingiu','nao-avaliavel')),
  justification text NOT NULL CHECK (length(btrim(justification)) >= 20),
  evidence_refs uuid[] NOT NULL DEFAULT '{}',
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  review_request_id uuid,
  evaluator_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, rubric_version_id, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);
-- Pedido de revisão do participante; decide pessoa ≠ avaliador da versão contestada.
CREATE TABLE public.dev_result_review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL UNIQUE REFERENCES public.dev_learning_results(id),
  grounds text NOT NULL CHECK (length(btrim(grounds)) BETWEEN 20 AND 4000),
  requester_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_result_review_decisions (
  request_id uuid PRIMARY KEY REFERENCES public.dev_result_review_requests(id),
  decision text NOT NULL CHECK (decision IN ('mantido','revisto')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  new_result_id uuid REFERENCES public.dev_learning_results(id),
  reviewer_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((decision = 'revisto') = (new_result_id IS NOT NULL))
);
ALTER TABLE public.dev_learning_results ADD CONSTRAINT dev_lr_review_fk FOREIGN KEY (review_request_id) REFERENCES public.dev_result_review_requests(id);

GRANT SELECT ON public.dev_rubric_versions, public.dev_rubric_approvals, public.dev_learning_results, public.dev_result_review_requests, public.dev_result_review_decisions TO authenticated;
GRANT ALL ON public.dev_rubric_versions, public.dev_rubric_approvals, public.dev_learning_results, public.dev_result_review_requests, public.dev_result_review_decisions TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_rubric_versions, public.dev_rubric_approvals, public.dev_learning_results, public.dev_result_review_requests, public.dev_result_review_decisions FROM authenticated, anon;
ALTER TABLE public.dev_rubric_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_rubric_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_learning_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_result_review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_result_review_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev rubrics read" ON public.dev_rubric_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev rubric approvals read" ON public.dev_rubric_approvals FOR SELECT TO authenticated USING (true);
-- Resultado individual: só a pessoa, a gestão ou o formador vigente da turma.
CREATE POLICY "dev results read" ON public.dev_learning_results FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_enrollments e WHERE e.id = enrollment_id
    AND (e.person_id = public.current_person_id() OR public.dev_can_manage() OR public.dev_is_active_trainer(e.class_id))));
CREATE POLICY "dev review requests read" ON public.dev_result_review_requests FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_learning_results r JOIN public.dev_enrollments e ON e.id = r.enrollment_id WHERE r.id = result_id
    AND (e.person_id = public.current_person_id() OR public.dev_can_manage() OR public.dev_is_active_trainer(e.class_id))));
CREATE POLICY "dev review decisions read" ON public.dev_result_review_decisions FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_result_review_requests q JOIN public.dev_learning_results r ON r.id = q.result_id JOIN public.dev_enrollments e ON e.id = r.enrollment_id
  WHERE q.id = request_id AND (e.person_id = public.current_person_id() OR public.dev_can_manage() OR public.dev_is_active_trainer(e.class_id))));
CREATE TRIGGER devrub_immutable BEFORE UPDATE OR DELETE ON public.dev_rubric_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devruba_immutable BEFORE UPDATE OR DELETE ON public.dev_rubric_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devlr_immutable BEFORE UPDATE OR DELETE ON public.dev_learning_results FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devrrq_immutable BEFORE UPDATE OR DELETE ON public.dev_result_review_requests FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devrrd_immutable BEFORE UPDATE OR DELETE ON public.dev_result_review_decisions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Valida estrutura: [{key,description,levels:[{key,label,description}]≥2}], chaves únicas.
CREATE OR REPLACE FUNCTION public.dev_rubric_valid(_c jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_c) c WHERE
      coalesce(c->>'key','') !~ '^[a-z0-9-]{2,40}$' OR length(btrim(coalesce(c->>'description',''))) < 10
      OR jsonb_typeof(c->'levels') <> 'array' OR jsonb_array_length(c->'levels') < 2
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(c->'levels') l WHERE coalesce(l->>'key','') !~ '^[a-z0-9-]{1,40}$'
         OR length(btrim(coalesce(l->>'label',''))) < 2 OR length(btrim(coalesce(l->>'description',''))) < 10)
      OR (SELECT count(DISTINCT l->>'key') FROM jsonb_array_elements(c->'levels') l) <> jsonb_array_length(c->'levels'))
  AND (SELECT count(DISTINCT c->>'key') FROM jsonb_array_elements(_c) c) = jsonb_array_length(_c)
$$;

CREATE OR REPLACE FUNCTION public.record_dev_rubric_version(_logical uuid, _expected_version int, _course uuid, _title text, _criteria jsonb, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_rubric_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('planejar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF NOT public.dev_rubric_valid(_criteria) THEN RAISE EXCEPTION 'dev:invalid-rubric'; END IF;
  _logical := coalesce(_logical, gen_random_uuid());
  PERFORM pg_advisory_xact_lock(hashtext('dev-rubric:' || _logical::text));
  SELECT coalesce(max(version), 0) INTO _last FROM public.dev_rubric_versions WHERE logical_id = _logical;
  IF _last <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'dev:stale'; END IF;
  IF _last > 0 AND NOT EXISTS (SELECT 1 FROM public.dev_rubric_versions WHERE logical_id = _logical AND course_id = _course) THEN RAISE EXCEPTION 'dev:course-immutable'; END IF;
  INSERT INTO public.dev_rubric_versions(logical_id, version, course_id, title, criteria, reason, author_person, idempotency_key)
  VALUES (_logical, _last + 1, _course, btrim(_title), _criteria, nullif(btrim(coalesce(_reason,'')),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_dev_rubric(_version uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.dev_rubric_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_rubric_approvals WHERE rubric_version_id = _version AND approver_person = _p) THEN RETURN; END IF;
  IF NOT public.has_network_capability('aprovar-criterios-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _v FROM public.dev_rubric_versions WHERE id = _version;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _v.author_person = _p THEN RAISE EXCEPTION 'dev:self-approval'; END IF;
  INSERT INTO public.dev_rubric_approvals(rubric_version_id, approver_person, reason) VALUES (_version, _p, btrim(_reason));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Avaliação: formador vigente ≠ participante; rubrica aprovada do mesmo curso; todo critério com nível válido e justificativa.
CREATE OR REPLACE FUNCTION public.record_dev_learning_result(_enrollment uuid, _rubric uuid, _expected_version int, _ratings jsonb,
  _outcome text, _justification text, _evidence uuid[], _reason text, _review_request uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _e public.dev_enrollments; _r public.dev_rubric_versions; _last int; _c jsonb; _ev uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_learning_results WHERE idempotency_key = _key AND evaluator_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _e.person_id = _p THEN RAISE EXCEPTION 'dev:self-evaluation'; END IF;
  IF _review_request IS NULL AND NOT public.dev_is_active_trainer(_e.class_id) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind = 'confirmacao') THEN RAISE EXCEPTION 'dev:not-confirmed'; END IF;
  SELECT r.* INTO _r FROM public.dev_rubric_versions r JOIN public.dev_rubric_approvals a ON a.rubric_version_id = r.id WHERE r.id = _rubric;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:rubric-not-approved'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dev_classes k JOIN public.dev_course_versions v ON v.id = k.course_version_id WHERE k.id = _e.class_id AND v.course_id = _r.course_id) THEN
    RAISE EXCEPTION 'dev:rubric-other-course'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(_ratings)) <> jsonb_array_length(_r.criteria) THEN RAISE EXCEPTION 'dev:ratings-incomplete'; END IF;
  FOR _c IN SELECT * FROM jsonb_array_elements(_r.criteria) LOOP
    IF jsonb_typeof(_ratings->(_c->>'key')) <> 'object' OR length(btrim(coalesce(_ratings->(_c->>'key')->>'justification',''))) < 10
       OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_c->'levels') l WHERE l->>'key' = _ratings->(_c->>'key')->>'level') THEN
      RAISE EXCEPTION 'dev:rating-invalid'; END IF;
  END LOOP;
  FOREACH _ev IN ARRAY coalesce(_evidence, '{}'::uuid[]) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.dev_activity_submissions WHERE id = _ev AND enrollment_id = _enrollment) THEN RAISE EXCEPTION 'dev:evidence-not-of-enrollment'; END IF;
  END LOOP;
  SELECT coalesce(max(version), 0) INTO _last FROM public.dev_learning_results WHERE enrollment_id = _enrollment AND rubric_version_id = _rubric;
  IF _last <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'dev:stale'; END IF;
  IF _review_request IS NOT NULL THEN
    -- só chamado internamente pela decisão de revisão (ver decide_dev_result_review)
    IF NOT EXISTS (SELECT 1 FROM public.dev_result_review_requests q JOIN public.dev_learning_results r ON r.id = q.result_id
                   WHERE q.id = _review_request AND r.enrollment_id = _enrollment AND r.evaluator_person <> _p) THEN RAISE EXCEPTION 'dev:invalid-review'; END IF;
    IF NOT public.has_network_capability('revisar-resultados-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  END IF;
  INSERT INTO public.dev_learning_results(enrollment_id, rubric_version_id, version, ratings, outcome, justification, evidence_refs, reason, review_request_id, evaluator_person, idempotency_key)
  VALUES (_enrollment, _rubric, _last + 1, _ratings, _outcome, btrim(_justification), coalesce(_evidence,'{}'), nullif(btrim(coalesce(_reason,'')),''), _review_request, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR unique_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.request_dev_result_review(_result uuid, _grounds text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _r public.dev_learning_results;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT * INTO _r FROM public.dev_learning_results WHERE id = _result;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.dev_enrollments WHERE id = _r.enrollment_id AND person_id = _p) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_learning_results WHERE enrollment_id = _r.enrollment_id AND rubric_version_id = _r.rubric_version_id AND version > _r.version) THEN
    RAISE EXCEPTION 'dev:not-current-result'; END IF;
  SELECT id INTO _id FROM public.dev_result_review_requests WHERE result_id = _result AND requester_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO public.dev_result_review_requests(result_id, grounds, requester_person) VALUES (_result, btrim(_grounds), _p) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
  WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-requested';
END $$;

-- Decisão: revisor com capacidade própria, ≠ avaliador contestado e ≠ participante; "revisto" exige a nova versão gravada pelo próprio revisor.
CREATE OR REPLACE FUNCTION public.decide_dev_result_review(_request uuid, _decision text, _reason text, _new_result uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _q public.dev_result_review_requests; _r public.dev_learning_results;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF NOT public.has_network_capability('revisar-resultados-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _q FROM public.dev_result_review_requests WHERE id = _request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT * INTO _r FROM public.dev_learning_results WHERE id = _q.result_id;
  IF _p IN (_r.evaluator_person, _q.requester_person) THEN RAISE EXCEPTION 'dev:reviewer-conflict'; END IF;
  IF _decision = 'revisto' AND NOT EXISTS (SELECT 1 FROM public.dev_learning_results WHERE id = _new_result AND review_request_id = _request AND evaluator_person = _p) THEN
    RAISE EXCEPTION 'dev:new-result-required'; END IF;
  INSERT INTO public.dev_result_review_decisions(request_id, decision, reason, new_result_id, reviewer_person)
  VALUES (_request, _decision, btrim(_reason), CASE WHEN _decision = 'revisto' THEN _new_result END, _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_dev_rubric_version(uuid,int,uuid,text,jsonb,text,text)','approve_dev_rubric(uuid,text)',
    'record_dev_learning_result(uuid,uuid,int,jsonb,text,text,uuid[],text,uuid,text)','request_dev_result_review(uuid,text)',
    'decide_dev_result_review(uuid,text,text,uuid)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.dev_rubric_valid(jsonb) FROM PUBLIC, anon;