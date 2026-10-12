-- SIGEM Desenvolvimento L06: trilhas por programa, versionadas, com etapas/pré-requisitos/cursos/critérios.
-- Obrigatoriedade só por ato competente juntado (mandato), nunca por campo da trilha.

CREATE TABLE public.dev_tracks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid NOT NULL REFERENCES public.dev_programs(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.dev_track_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.dev_tracks(id),
  version int NOT NULL CHECK (version >= 1),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 200),
  objectives text NOT NULL CHECK (length(btrim(objectives)) >= 20),
  audience text NOT NULL CHECK (length(btrim(audience)) BETWEEN 3 AND 300),
  competencies text[] NOT NULL DEFAULT '{}',
  completion_criteria text NOT NULL CHECK (length(btrim(completion_criteria)) >= 10),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (track_id, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.dev_track_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_version_id uuid NOT NULL REFERENCES public.dev_track_versions(id),
  ord int NOT NULL CHECK (ord >= 1),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  course_id uuid NOT NULL REFERENCES public.dev_courses(id),
  prerequisite_ords int[] NOT NULL DEFAULT '{}',
  elective boolean NOT NULL DEFAULT false,
  UNIQUE (track_version_id, ord)
);
CREATE TABLE public.dev_track_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_version_id uuid NOT NULL UNIQUE REFERENCES public.dev_track_versions(id),
  decision text NOT NULL CHECK (decision IN ('aprovada','recusada')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  approver_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Mandato: torna a trilha obrigatória para um público, com ato, fundamento e vigência; revogação é evento próprio.
CREATE TABLE public.dev_track_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_version_id uuid NOT NULL REFERENCES public.dev_track_versions(id),
  audience text NOT NULL CHECK (length(btrim(audience)) BETWEEN 3 AND 300),
  legal_basis text NOT NULL CHECK (length(btrim(legal_basis)) >= 10),
  act_document_ref uuid NOT NULL REFERENCES public.docserv_document_versions(id),
  valid_from date NOT NULL,
  valid_until date,
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
CREATE TABLE public.dev_track_mandate_revocations (
  mandate_id uuid PRIMARY KEY REFERENCES public.dev_track_mandates(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  act_document_ref uuid NOT NULL REFERENCES public.docserv_document_versions(id),
  effective_on date NOT NULL,
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dev_tracks, public.dev_track_versions, public.dev_track_steps, public.dev_track_approvals, public.dev_track_mandates, public.dev_track_mandate_revocations TO authenticated;
GRANT ALL ON public.dev_tracks, public.dev_track_versions, public.dev_track_steps, public.dev_track_approvals, public.dev_track_mandates, public.dev_track_mandate_revocations TO service_role;
REVOKE SELECT ON public.dev_track_mandates, public.dev_track_mandate_revocations FROM authenticated;
GRANT SELECT (id, track_version_id, audience, legal_basis, valid_from, valid_until, author_person, created_at) ON public.dev_track_mandates TO authenticated;
GRANT SELECT (mandate_id, reason, effective_on, author_person, created_at) ON public.dev_track_mandate_revocations TO authenticated;

ALTER TABLE public.dev_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_track_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_track_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_track_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_track_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_track_mandate_revocations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.dev_track_approved(_v uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.dev_track_approvals WHERE track_version_id = _v AND decision = 'aprovada')
$$;
REVOKE EXECUTE ON FUNCTION public.dev_track_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_track_approved(uuid) TO authenticated, service_role;

CREATE POLICY "dev tracks read" ON public.dev_tracks FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev track versions approved or manager" ON public.dev_track_versions FOR SELECT TO authenticated USING (public.dev_can_manage() OR public.dev_track_approved(id));
CREATE POLICY "dev track steps approved or manager" ON public.dev_track_steps FOR SELECT TO authenticated USING (public.dev_can_manage() OR public.dev_track_approved(track_version_id));
CREATE POLICY "dev track approvals read" ON public.dev_track_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev track mandates read" ON public.dev_track_mandates FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev track revocations read" ON public.dev_track_mandate_revocations FOR SELECT TO authenticated USING (true);

CREATE TRIGGER devt_immutable BEFORE UPDATE OR DELETE ON public.dev_tracks FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devtv2_immutable BEFORE UPDATE OR DELETE ON public.dev_track_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devts_immutable BEFORE UPDATE OR DELETE ON public.dev_track_steps FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devtap_immutable BEFORE UPDATE OR DELETE ON public.dev_track_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devtm_immutable BEFORE UPDATE OR DELETE ON public.dev_track_mandates FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devtmr_immutable BEFORE UPDATE OR DELETE ON public.dev_track_mandate_revocations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
REVOKE TRUNCATE ON public.dev_tracks, public.dev_track_versions, public.dev_track_steps, public.dev_track_approvals, public.dev_track_mandates, public.dev_track_mandate_revocations FROM authenticated, anon;

-- Versão + etapas numa transação. _steps: [{title, course_id, prerequisite_ords:[int], elective}] (ordem = posição; pré-requisito só de etapa anterior).
CREATE OR REPLACE FUNCTION public.record_dev_track_version(_program uuid, _track uuid, _expected_version int, _title text, _objectives text,
  _audience text, _competencies text[], _criteria text, _steps jsonb, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int; _s jsonb; _i int := 0; _pre int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_track_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('planejar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _steps IS NULL OR jsonb_typeof(_steps) <> 'array' OR jsonb_array_length(_steps) = 0 THEN RAISE EXCEPTION 'dev:steps-required'; END IF;
  IF _track IS NULL THEN
    IF coalesce(_expected_version, 0) <> 0 THEN RAISE EXCEPTION 'dev:stale'; END IF;
    INSERT INTO public.dev_tracks(program_id) VALUES (_program) RETURNING id INTO _track; _last := 0;
  ELSE
    PERFORM 1 FROM public.dev_tracks WHERE id = _track FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
    SELECT coalesce(max(version), 0) INTO _last FROM public.dev_track_versions WHERE track_id = _track;
    IF _last <> _expected_version THEN RAISE EXCEPTION 'dev:stale'; END IF;
  END IF;
  INSERT INTO public.dev_track_versions(track_id, version, title, objectives, audience, competencies, completion_criteria, reason, author_person, idempotency_key)
  VALUES (_track, _last + 1, btrim(_title), btrim(_objectives), btrim(_audience), coalesce(_competencies, '{}'), btrim(_criteria),
    nullif(btrim(coalesce(_reason, '')), ''), _p, _key) RETURNING id INTO _id;
  FOR _s IN SELECT * FROM jsonb_array_elements(_steps) LOOP
    _i := _i + 1;
    FOR _pre IN SELECT (x)::int FROM jsonb_array_elements_text(coalesce(_s->'prerequisite_ords', '[]')) x LOOP
      IF _pre < 1 OR _pre >= _i THEN RAISE EXCEPTION 'dev:invalid-prerequisite'; END IF;
    END LOOP;
    INSERT INTO public.dev_track_steps(track_version_id, ord, title, course_id, prerequisite_ords, elective)
    VALUES (_id, _i, btrim(_s->>'title'), (_s->>'course_id')::uuid,
      ARRAY(SELECT (x)::int FROM jsonb_array_elements_text(coalesce(_s->'prerequisite_ords', '[]')) x), coalesce((_s->>'elective')::boolean, false));
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.dev_track_steps WHERE track_version_id = _id AND NOT elective) THEN RAISE EXCEPTION 'dev:no-core-step'; END IF;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation OR invalid_text_representation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.decide_dev_track_version(_version uuid, _decision text, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _author uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_track_approvals WHERE idempotency_key = _key AND approver_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('aprovar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT author_person INTO _author FROM public.dev_track_versions WHERE id = _version;
  IF _author IS NULL THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _author = _p THEN RAISE EXCEPTION 'dev:self-approval'; END IF;
  INSERT INTO public.dev_track_approvals(track_version_id, decision, reason, approver_person, idempotency_key) VALUES (_version, _decision, btrim(_reason), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Obrigatoriedade: só sobre versão aprovada, capacidade própria, ato juntado e fundamento normativo.
CREATE OR REPLACE FUNCTION public.mandate_dev_track(_version uuid, _audience text, _basis text, _act uuid, _from date, _until date, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_track_mandates WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('determinar-obrigatoriedade-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF NOT public.dev_track_approved(_version) THEN RAISE EXCEPTION 'dev:track-not-approved'; END IF;
  IF _act IS NULL THEN RAISE EXCEPTION 'dev:act-required'; END IF;
  INSERT INTO public.dev_track_mandates(track_version_id, audience, legal_basis, act_document_ref, valid_from, valid_until, author_person, idempotency_key)
  VALUES (_version, btrim(_audience), btrim(_basis), _act, _from, _until, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.revoke_dev_track_mandate(_mandate uuid, _reason text, _act uuid, _effective date, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _m public.dev_track_mandates;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_track_mandate_revocations WHERE idempotency_key = _key AND author_person = _p) THEN RETURN _mandate; END IF;
  IF NOT public.has_network_capability('determinar-obrigatoriedade-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _m FROM public.dev_track_mandates WHERE id = _mandate FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _effective < _m.valid_from THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  INSERT INTO public.dev_track_mandate_revocations(mandate_id, reason, act_document_ref, effective_on, author_person, idempotency_key)
  VALUES (_mandate, btrim(_reason), _act, _effective, _p, _key);
  RETURN _mandate;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-revoked';
  WHEN check_violation OR foreign_key_violation OR not_null_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_dev_track_version(uuid,uuid,int,text,text,text,text[],text,jsonb,text,text)','decide_dev_track_version(uuid,text,text,text)',
    'mandate_dev_track(uuid,text,text,uuid,date,date,text)','revoke_dev_track_mandate(uuid,text,uuid,date,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;