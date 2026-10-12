-- SIGEM Desenvolvimento L13: ambiente do participante/formador nativo (não há AVA institucional identificado no projeto).
-- Material acessado nunca é progresso; entrega é do próprio participante; feedback é do formador vigente; sem nota automática.

-- Quem participa (confirmado, não encerrado) da turma.
CREATE OR REPLACE FUNCTION public.dev_is_confirmed_participant(_class uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.dev_enrollments e WHERE e.class_id = _class AND e.person_id = public.current_person_id()
    AND EXISTS (SELECT 1 FROM public.dev_participation_events x WHERE x.enrollment_id = e.id AND x.kind = 'confirmacao')
    AND NOT EXISTS (SELECT 1 FROM public.dev_participation_events x WHERE x.enrollment_id = e.id AND x.kind IN ('desistencia','cancelamento')))
$$;
REVOKE EXECUTE ON FUNCTION public.dev_is_confirmed_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_is_confirmed_participant(uuid) TO authenticated;

CREATE TABLE public.dev_class_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.dev_classes(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  storage_path text CHECK (storage_path IS NULL OR storage_path ~ '^materiais/[0-9a-f-]{36}/[^/]+$'),
  sha256 text CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
  external_url text CHECK (external_url IS NULL OR external_url ~ '^https://'),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((storage_path IS NULL) <> (external_url IS NULL)),
  CHECK (storage_path IS NULL OR sha256 IS NOT NULL)
);
CREATE TABLE public.dev_class_material_withdrawals (
  material_id uuid PRIMARY KEY REFERENCES public.dev_class_materials(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  withdrawn_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Entrega: versões do próprio participante por atividade (L12), com texto e/ou arquivo hasheado.
CREATE TABLE public.dev_activity_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.dev_class_activities(id),
  enrollment_id uuid NOT NULL REFERENCES public.dev_enrollments(id),
  version int NOT NULL CHECK (version >= 1),
  body text CHECK (body IS NULL OR length(btrim(body)) BETWEEN 1 AND 20000),
  storage_path text CHECK (storage_path IS NULL OR storage_path ~ '^entregas/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'),
  sha256 text CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, enrollment_id, version),
  CHECK (body IS NOT NULL OR storage_path IS NOT NULL),
  CHECK (storage_path IS NULL OR sha256 IS NOT NULL)
);
-- Questionário: definição imutável; resposta única por inscrição; sem gabarito nem nota automática.
CREATE TABLE public.dev_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.dev_classes(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  questions jsonb NOT NULL CHECK (jsonb_typeof(questions) = 'array' AND jsonb_array_length(questions) BETWEEN 1 AND 50),
  purpose text NOT NULL CHECK (purpose IN ('avaliacao-da-formacao','verificacao-de-aprendizagem')),
  opens_on date NOT NULL,
  closes_on date NOT NULL,
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_on >= opens_on)
);
CREATE TABLE public.dev_questionnaire_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES public.dev_questionnaires(id),
  enrollment_id uuid NOT NULL REFERENCES public.dev_enrollments(id),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'array'),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (questionnaire_id, enrollment_id)
);
-- Feedback do formador sobre entrega: append-only, autor ≠ participante.
CREATE TABLE public.dev_submission_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.dev_activity_submissions(id),
  outcome text NOT NULL CHECK (outcome IN ('atende','atende-parcialmente','nao-atende','comentario')),
  comment text NOT NULL CHECK (length(btrim(comment)) BETWEEN 10 AND 4000),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dev_class_materials, public.dev_class_material_withdrawals, public.dev_activity_submissions, public.dev_questionnaires, public.dev_questionnaire_responses, public.dev_submission_feedback TO authenticated;
GRANT ALL ON public.dev_class_materials, public.dev_class_material_withdrawals, public.dev_activity_submissions, public.dev_questionnaires, public.dev_questionnaire_responses, public.dev_submission_feedback TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_class_materials, public.dev_class_material_withdrawals, public.dev_activity_submissions, public.dev_questionnaires, public.dev_questionnaire_responses, public.dev_submission_feedback FROM authenticated, anon;
ALTER TABLE public.dev_class_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_class_material_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_activity_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_submission_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev materials read" ON public.dev_class_materials FOR SELECT TO authenticated
  USING (public.dev_can_manage() OR public.dev_is_active_trainer(class_id) OR public.dev_is_confirmed_participant(class_id));
CREATE POLICY "dev material withdrawals read" ON public.dev_class_material_withdrawals FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev questionnaires read" ON public.dev_questionnaires FOR SELECT TO authenticated
  USING (public.dev_can_manage() OR public.dev_is_active_trainer(class_id) OR public.dev_is_confirmed_participant(class_id));
CREATE POLICY "dev submissions read" ON public.dev_activity_submissions FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_enrollments e WHERE e.id = enrollment_id AND (e.person_id = public.current_person_id() OR public.dev_can_manage() OR public.dev_is_active_trainer(e.class_id))));
CREATE POLICY "dev responses read" ON public.dev_questionnaire_responses FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_enrollments e WHERE e.id = enrollment_id AND (e.person_id = public.current_person_id() OR public.dev_can_manage() OR public.dev_is_active_trainer(e.class_id))));
CREATE POLICY "dev feedback read" ON public.dev_submission_feedback FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_activity_submissions s JOIN public.dev_enrollments e ON e.id = s.enrollment_id WHERE s.id = submission_id
    AND (e.person_id = public.current_person_id() OR public.dev_can_manage() OR public.dev_is_active_trainer(e.class_id))));
CREATE TRIGGER devmat_immutable BEFORE UPDATE OR DELETE ON public.dev_class_materials FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devmatw_immutable BEFORE UPDATE OR DELETE ON public.dev_class_material_withdrawals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devsub_immutable BEFORE UPDATE OR DELETE ON public.dev_activity_submissions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devq_immutable BEFORE UPDATE OR DELETE ON public.dev_questionnaires FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devqr_immutable BEFORE UPDATE OR DELETE ON public.dev_questionnaire_responses FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devfb_immutable BEFORE UPDATE OR DELETE ON public.dev_submission_feedback FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Writers
CREATE OR REPLACE FUNCTION public.publish_dev_material(_class uuid, _title text, _path text, _sha text, _url text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_class_materials WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT (public.has_network_capability('gerir-turmas-de-formacao') OR public.dev_is_active_trainer(_class)) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _path IS NOT NULL AND split_part(_path, '/', 2) <> _class::text THEN RAISE EXCEPTION 'dev:path-mismatch'; END IF;
  INSERT INTO public.dev_class_materials(class_id, title, storage_path, sha256, external_url, author_person, idempotency_key)
  VALUES (_class, btrim(_title), _path, lower(_sha), _url, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.withdraw_dev_material(_material uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _m public.dev_class_materials;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT * INTO _m FROM public.dev_class_materials WHERE id = _material;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF NOT (public.has_network_capability('gerir-turmas-de-formacao') OR public.dev_is_active_trainer(_m.class_id)) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  INSERT INTO public.dev_class_material_withdrawals(material_id, reason, withdrawn_by) VALUES (_material, btrim(_reason), _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-withdrawn';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.submit_dev_activity(_activity uuid, _expected_version int, _body text, _path text, _sha text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _a public.dev_class_activities; _e uuid; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_activity_submissions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO _a FROM public.dev_class_activities WHERE id = _activity;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF NOT public.dev_is_confirmed_participant(_a.class_id) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF current_date < _a.opens_on OR current_date > _a.closes_on THEN RAISE EXCEPTION 'dev:outside-window'; END IF;
  SELECT id INTO _e FROM public.dev_enrollments WHERE class_id = _a.class_id AND person_id = _p FOR UPDATE;
  IF _path IS NOT NULL AND (split_part(_path, '/', 2) <> _a.class_id::text OR split_part(_path, '/', 3) <> _e::text) THEN RAISE EXCEPTION 'dev:path-mismatch'; END IF;
  SELECT coalesce(max(version), 0) INTO _last FROM public.dev_activity_submissions WHERE activity_id = _activity AND enrollment_id = _e;
  IF _last <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_activity_submissions(activity_id, enrollment_id, version, body, storage_path, sha256, author_person, idempotency_key)
  VALUES (_activity, _e, _last + 1, nullif(btrim(coalesce(_body,'')),''), _path, lower(_sha), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR unique_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_dev_questionnaire(_class uuid, _title text, _questions jsonb, _purpose text, _opens date, _closes date, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _q jsonb;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_questionnaires WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT (public.has_network_capability('gerir-turmas-de-formacao') OR public.dev_is_active_trainer(_class)) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  FOR _q IN SELECT * FROM jsonb_array_elements(_questions) LOOP
    IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(_q) k) NOT IN (ARRAY['kind','text'], ARRAY['kind','options','text'])
       OR _q->>'kind' NOT IN ('aberta','escolha-unica','escala') OR length(btrim(coalesce(_q->>'text',''))) < 5 THEN RAISE EXCEPTION 'dev:invalid-question'; END IF;
  END LOOP;
  INSERT INTO public.dev_questionnaires(class_id, title, questions, purpose, opens_on, closes_on, author_person, idempotency_key)
  VALUES (_class, btrim(_title), _questions, _purpose, _opens, _closes, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.answer_dev_questionnaire(_questionnaire uuid, _answers jsonb, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _q public.dev_questionnaires; _e uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_questionnaire_responses WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO _q FROM public.dev_questionnaires WHERE id = _questionnaire;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF NOT public.dev_is_confirmed_participant(_q.class_id) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF current_date < _q.opens_on OR current_date > _q.closes_on THEN RAISE EXCEPTION 'dev:outside-window'; END IF;
  IF jsonb_typeof(_answers) <> 'array' OR jsonb_array_length(_answers) <> jsonb_array_length(_q.questions) THEN RAISE EXCEPTION 'dev:answers-mismatch'; END IF;
  SELECT id INTO _e FROM public.dev_enrollments WHERE class_id = _q.class_id AND person_id = _p;
  INSERT INTO public.dev_questionnaire_responses(questionnaire_id, enrollment_id, answers, idempotency_key) VALUES (_questionnaire, _e, _answers, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-answered';
END $$;

CREATE OR REPLACE FUNCTION public.record_dev_feedback(_submission uuid, _outcome text, _comment text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _e public.dev_enrollments;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_submission_feedback WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT e.* INTO _e FROM public.dev_activity_submissions s JOIN public.dev_enrollments e ON e.id = s.enrollment_id WHERE s.id = _submission;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF NOT public.dev_is_active_trainer(_e.class_id) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _e.person_id = _p THEN RAISE EXCEPTION 'dev:self-feedback'; END IF;
  INSERT INTO public.dev_submission_feedback(submission_id, outcome, comment, author_person, idempotency_key)
  VALUES (_submission, _outcome, btrim(_comment), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['publish_dev_material(uuid,text,text,text,text,text)','withdraw_dev_material(uuid,text)',
    'submit_dev_activity(uuid,int,text,text,text,text)','record_dev_questionnaire(uuid,text,jsonb,text,date,date,text)',
    'answer_dev_questionnaire(uuid,jsonb,text)','record_dev_feedback(uuid,text,text,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Arquivos no bucket privado dev-formacao: materiais/<turma>/... e entregas/<turma>/<inscrição>/...
CREATE POLICY "dev formacao read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'dev-formacao' AND (
    (split_part(name,'/',1) = 'materiais' AND (public.dev_can_manage() OR public.dev_is_active_trainer(split_part(name,'/',2)::uuid) OR public.dev_is_confirmed_participant(split_part(name,'/',2)::uuid)))
    OR (split_part(name,'/',1) = 'entregas' AND (public.dev_can_manage() OR public.dev_is_active_trainer(split_part(name,'/',2)::uuid)
        OR EXISTS (SELECT 1 FROM public.dev_enrollments e WHERE e.id::text = split_part(name,'/',3) AND e.person_id = public.current_person_id())))));
CREATE POLICY "dev formacao upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'dev-formacao' AND (
    (split_part(name,'/',1) = 'materiais' AND (public.dev_can_manage() OR public.dev_is_active_trainer(split_part(name,'/',2)::uuid)))
    OR (split_part(name,'/',1) = 'entregas' AND EXISTS (SELECT 1 FROM public.dev_enrollments e WHERE e.id::text = split_part(name,'/',3)
        AND e.class_id::text = split_part(name,'/',2) AND e.person_id = public.current_person_id()))));