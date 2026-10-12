-- SIGEM Desenvolvimento L04: diagnóstico de necessidades formativas.
-- Submissões (escola, Orientação, Supervisão, avaliação agregada) → consolidação em necessidade (dev_needs, L02) com prioridade justificada.
-- Nenhuma coluna identifica pessoa avaliada; evidência de avaliação só agregada acima de limiar aprovado.

CREATE TABLE public.dev_aggregate_threshold_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL UNIQUE CHECK (version >= 1),
  min_group_size int NOT NULL CHECK (min_group_size >= 2),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_aggregate_threshold_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL UNIQUE REFERENCES public.dev_aggregate_threshold_versions(id),
  approver_person uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dev_need_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin text NOT NULL CHECK (origin IN ('escola','orientacao','supervisao','avaliacao-agregada')),
  school_id text REFERENCES public.institutional_schools(id),
  topic text NOT NULL CHECK (length(btrim(topic)) BETWEEN 5 AND 200),
  justification text NOT NULL CHECK (length(btrim(justification)) >= 20),
  audience text CHECK (audience IS NULL OR length(btrim(audience)) BETWEEN 3 AND 200),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (origin <> 'escola' OR school_id IS NOT NULL)
);

-- Evidência: referência tipada a registro canônico OU agregado de avaliação (contagem ≥ limiar), nunca pessoa.
CREATE TABLE public.dev_need_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.dev_need_submissions(id),
  kind text NOT NULL CHECK (kind IN ('documento','registro-supervisao','registro-orientacao','resultado-agregado')),
  document_version_ref uuid REFERENCES public.docserv_document_versions(id),
  record_ref uuid,
  instrument_ref text REFERENCES public.assessment_instruments(id),
  group_size int CHECK (group_size IS NULL OR group_size > 0),
  threshold_version_id uuid REFERENCES public.dev_aggregate_threshold_versions(id),
  summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 10 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'documento' OR document_version_ref IS NOT NULL),
  CHECK (kind NOT IN ('registro-supervisao','registro-orientacao') OR record_ref IS NOT NULL),
  CHECK (kind <> 'resultado-agregado' OR (instrument_ref IS NOT NULL AND group_size IS NOT NULL AND threshold_version_id IS NOT NULL))
);

-- Consolidação: liga submissões a uma necessidade com prioridade e justificativa; uma submissão, uma consolidação.
CREATE TABLE public.dev_need_consolidations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id uuid NOT NULL REFERENCES public.dev_needs(id),
  submission_id uuid NOT NULL UNIQUE REFERENCES public.dev_need_submissions(id),
  priority text NOT NULL CHECK (priority IN ('alta','media','baixa')),
  priority_reason text NOT NULL CHECK (length(btrim(priority_reason)) >= 20),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dev_aggregate_threshold_versions, public.dev_aggregate_threshold_approvals, public.dev_need_submissions,
  public.dev_need_evidence, public.dev_need_consolidations TO authenticated;
GRANT ALL ON public.dev_aggregate_threshold_versions, public.dev_aggregate_threshold_approvals, public.dev_need_submissions,
  public.dev_need_evidence, public.dev_need_consolidations TO service_role;
REVOKE SELECT ON public.dev_need_evidence FROM authenticated;
GRANT SELECT (id, submission_id, kind, instrument_ref, group_size, threshold_version_id, summary, created_at) ON public.dev_need_evidence TO authenticated;

ALTER TABLE public.dev_aggregate_threshold_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_aggregate_threshold_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_need_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_need_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_need_consolidations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev thresholds managers" ON public.dev_aggregate_threshold_versions FOR SELECT TO authenticated USING (public.dev_can_manage());
CREATE POLICY "dev threshold approvals managers" ON public.dev_aggregate_threshold_approvals FOR SELECT TO authenticated USING (public.dev_can_manage());
CREATE POLICY "dev submissions author or manager" ON public.dev_need_submissions FOR SELECT TO authenticated
  USING (author_person = public.current_person_id() OR public.dev_can_manage());
CREATE POLICY "dev evidence follows submission" ON public.dev_need_evidence FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dev_need_submissions s WHERE s.id = submission_id AND (s.author_person = public.current_person_id() OR public.dev_can_manage())));
CREATE POLICY "dev consolidations managers" ON public.dev_need_consolidations FOR SELECT TO authenticated USING (public.dev_can_manage());

CREATE TRIGGER devtv_immutable BEFORE UPDATE OR DELETE ON public.dev_aggregate_threshold_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devta_immutable BEFORE UPDATE OR DELETE ON public.dev_aggregate_threshold_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devns_immutable BEFORE UPDATE OR DELETE ON public.dev_need_submissions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devne_immutable BEFORE UPDATE OR DELETE ON public.dev_need_evidence FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devnc_immutable BEFORE UPDATE OR DELETE ON public.dev_need_consolidations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
REVOKE TRUNCATE ON public.dev_aggregate_threshold_versions, public.dev_aggregate_threshold_approvals, public.dev_need_submissions,
  public.dev_need_evidence, public.dev_need_consolidations FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.record_dev_threshold_version(_expected_version int, _min int, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_aggregate_threshold_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('planejar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  LOCK TABLE public.dev_aggregate_threshold_versions IN SHARE ROW EXCLUSIVE MODE;
  SELECT coalesce(max(version), 0) INTO _last FROM public.dev_aggregate_threshold_versions;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_aggregate_threshold_versions(version, min_group_size, reason, author_person, idempotency_key)
  VALUES (_last + 1, _min, btrim(_reason), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_dev_threshold(_version uuid, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _author uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_aggregate_threshold_approvals WHERE idempotency_key = _key AND approver_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('aprovar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT author_person INTO _author FROM public.dev_aggregate_threshold_versions WHERE id = _version;
  IF _author IS NULL THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _author = _p THEN RAISE EXCEPTION 'dev:self-approval'; END IF;
  INSERT INTO public.dev_aggregate_threshold_approvals(version_id, approver_person, reason, idempotency_key) VALUES (_version, _p, btrim(_reason), _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Limiar vigente = última versão, se aprovada; senão nenhum (agregado recusado).
CREATE OR REPLACE FUNCTION public.dev_current_threshold() RETURNS public.dev_aggregate_threshold_versions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT v.* FROM public.dev_aggregate_threshold_versions v
  WHERE v.version = (SELECT max(version) FROM public.dev_aggregate_threshold_versions)
    AND EXISTS (SELECT 1 FROM public.dev_aggregate_threshold_approvals a WHERE a.version_id = v.id)
$$;
REVOKE EXECUTE ON FUNCTION public.dev_current_threshold() FROM PUBLIC, anon, authenticated;

-- Submissão + evidências numa transação. _evidence: [{kind, document_version_ref?, record_ref?, instrument_ref?, group_size?, summary}].
CREATE OR REPLACE FUNCTION public.submit_dev_need(_origin text, _school text, _topic text, _justification text, _audience text, _evidence jsonb, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _ev jsonb; _t public.dev_aggregate_threshold_versions; _allowed boolean;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_need_submissions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  _allowed := CASE _origin
    WHEN 'escola' THEN _school IS NOT NULL AND public.has_school_capability('solicitar-formacao', _school)
    WHEN 'orientacao' THEN public.has_network_capability('registrar-necessidade-formativa-orientacao')
    WHEN 'supervisao' THEN public.has_network_capability('registrar-necessidade-formativa-supervisao')
    WHEN 'avaliacao-agregada' THEN public.has_network_capability('registrar-necessidade-formativa-avaliacao')
    ELSE false END;
  IF NOT coalesce(_allowed, false) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _evidence IS NULL OR jsonb_typeof(_evidence) <> 'array' OR jsonb_array_length(_evidence) = 0 THEN RAISE EXCEPTION 'dev:evidence-required'; END IF;
  INSERT INTO public.dev_need_submissions(origin, school_id, topic, justification, audience, author_person, idempotency_key)
  VALUES (_origin, _school, btrim(_topic), btrim(_justification), nullif(btrim(coalesce(_audience, '')), ''), _p, _key) RETURNING id INTO _id;
  FOR _ev IN SELECT * FROM jsonb_array_elements(_evidence) LOOP
    IF (_ev ? 'person_id') OR (_ev ? 'student_id') OR (_ev ? 'professional_id') THEN RAISE EXCEPTION 'dev:individual-evidence'; END IF;
    IF _ev->>'kind' = 'resultado-agregado' THEN
      _t := public.dev_current_threshold();
      IF _t.id IS NULL THEN RAISE EXCEPTION 'dev:threshold-not-approved'; END IF;
      IF (_ev->>'group_size')::int < _t.min_group_size THEN RAISE EXCEPTION 'dev:group-below-threshold'; END IF;
    END IF;
    INSERT INTO public.dev_need_evidence(submission_id, kind, document_version_ref, record_ref, instrument_ref, group_size, threshold_version_id, summary)
    VALUES (_id, _ev->>'kind', (_ev->>'document_version_ref')::uuid, (_ev->>'record_ref')::uuid, _ev->>'instrument_ref',
      (_ev->>'group_size')::int, CASE WHEN _ev->>'kind' = 'resultado-agregado' THEN _t.id END, btrim(_ev->>'summary'));
  END LOOP;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation OR invalid_text_representation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.consolidate_dev_need(_need uuid, _submission uuid, _priority text, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_need_consolidations WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('planejar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  PERFORM 1 FROM public.dev_need_submissions WHERE id = _submission FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  INSERT INTO public.dev_need_consolidations(need_id, submission_id, priority, priority_reason, author_person, idempotency_key)
  VALUES (_need, _submission, _priority, btrim(_reason), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-consolidated';
  WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_dev_threshold_version(int,int,text,text)','approve_dev_threshold(uuid,text,text)',
    'submit_dev_need(text,text,text,text,text,jsonb,text)','consolidate_dev_need(uuid,uuid,text,text,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;