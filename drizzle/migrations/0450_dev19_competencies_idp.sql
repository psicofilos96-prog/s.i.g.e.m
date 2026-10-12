-- SIGEM Desenvolvimento L19: catálogo de competências (versões aprovadas) + Plano Individual de Desenvolvimento (PDI) privado.
-- Curso "contribui para" competência; conclusão NUNCA comprova domínio (não há coluna de domínio/nível atingido).
CREATE TABLE public.dev_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9.-]{1,30}$'),
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_competency_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id uuid NOT NULL REFERENCES public.dev_competencies(id),
  version int NOT NULL CHECK (version >= 1),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  description text NOT NULL CHECK (length(btrim(description)) >= 20),
  indicators text[] NOT NULL CHECK (cardinality(indicators) >= 1),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competency_id, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.dev_competency_approvals (
  competency_version_id uuid PRIMARY KEY REFERENCES public.dev_competency_versions(id),
  approver_person uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_course_competency_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_version_id uuid NOT NULL REFERENCES public.dev_course_versions(id),
  competency_version_id uuid NOT NULL REFERENCES public.dev_competency_approvals(competency_version_id),
  relation text NOT NULL DEFAULT 'contribui-para' CHECK (relation = 'contribui-para'),
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_version_id, competency_version_id)
);
-- PDI: um por pessoa; versões com metas/atividades (jsonb validado no writer); progresso por eventos.
CREATE TABLE public.dev_idps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE REFERENCES public.institutional_persons(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_idp_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idp_id uuid NOT NULL REFERENCES public.dev_idps(id),
  version int NOT NULL CHECK (version >= 1),
  goals jsonb NOT NULL CHECK (jsonb_typeof(goals) = 'array' AND jsonb_array_length(goals) >= 1),
  activities jsonb NOT NULL CHECK (jsonb_typeof(activities) = 'array'),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idp_id, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.dev_idp_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idp_version_id uuid NOT NULL REFERENCES public.dev_idp_versions(id),
  activity_key text NOT NULL,
  seq int NOT NULL CHECK (seq >= 1),
  status text NOT NULL CHECK (status IN ('planejada','em-andamento','concluida','abandonada')),
  note text CHECK (note IS NULL OR length(btrim(note)) >= 3),
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idp_version_id, activity_key, seq)
);
-- Compartilhamento explícito pelo titular (cargo/hierarquia não dá acesso).
CREATE TABLE public.dev_idp_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idp_id uuid NOT NULL REFERENCES public.dev_idps(id),
  grantee_person uuid NOT NULL REFERENCES public.institutional_persons(id),
  purpose text NOT NULL CHECK (length(btrim(purpose)) BETWEEN 10 AND 300),
  valid_until date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_idp_share_revocations (
  share_id uuid PRIMARY KEY REFERENCES public.dev_idp_shares(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Recomendações: sugestão fundamentada de alguém com capacidade; o titular aceita ou recusa. Nunca obriga.
CREATE TABLE public.dev_idp_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  course_id uuid REFERENCES public.dev_courses(id),
  competency_version_id uuid REFERENCES public.dev_competency_approvals(competency_version_id),
  justification text NOT NULL CHECK (length(btrim(justification)) >= 20),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (course_id IS NOT NULL OR competency_version_id IS NOT NULL),
  CHECK (author_person <> person_id)
);
CREATE TABLE public.dev_idp_recommendation_responses (
  recommendation_id uuid PRIMARY KEY REFERENCES public.dev_idp_recommendations(id),
  response text NOT NULL CHECK (response IN ('aceita','recusada')),
  note text CHECK (note IS NULL OR length(btrim(note)) >= 3),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dev_competencies, public.dev_competency_versions, public.dev_competency_approvals, public.dev_course_competency_links,
  public.dev_idps, public.dev_idp_versions, public.dev_idp_activity_events, public.dev_idp_shares, public.dev_idp_share_revocations,
  public.dev_idp_recommendations, public.dev_idp_recommendation_responses TO authenticated;
GRANT ALL ON public.dev_competencies, public.dev_competency_versions, public.dev_competency_approvals, public.dev_course_competency_links,
  public.dev_idps, public.dev_idp_versions, public.dev_idp_activity_events, public.dev_idp_shares, public.dev_idp_share_revocations,
  public.dev_idp_recommendations, public.dev_idp_recommendation_responses TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_competencies, public.dev_competency_versions, public.dev_competency_approvals, public.dev_course_competency_links,
  public.dev_idps, public.dev_idp_versions, public.dev_idp_activity_events, public.dev_idp_shares, public.dev_idp_share_revocations,
  public.dev_idp_recommendations, public.dev_idp_recommendation_responses FROM authenticated, anon;
ALTER TABLE public.dev_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_competency_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_competency_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_course_competency_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_idps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_idp_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_idp_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_idp_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_idp_share_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_idp_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_idp_recommendation_responses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.dev_idp_readable(_idp uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.dev_idps i WHERE i.id = _idp AND (i.person_id = public.current_person_id()
    OR EXISTS (SELECT 1 FROM public.dev_idp_shares s WHERE s.idp_id = i.id AND s.grantee_person = public.current_person_id()
      AND s.valid_until >= current_date AND NOT EXISTS (SELECT 1 FROM public.dev_idp_share_revocations r WHERE r.share_id = s.id))))
$$;
REVOKE EXECUTE ON FUNCTION public.dev_idp_readable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_idp_readable(uuid) TO authenticated;

-- Catálogo: autenticados leem só versões aprovadas; gestão do catálogo lê tudo.
CREATE POLICY "dev comp read" ON public.dev_competencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev comp versions read" ON public.dev_competency_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dev_competency_approvals a WHERE a.competency_version_id = id) OR public.has_network_capability('manter-competencias-formativas'));
CREATE POLICY "dev comp approvals read" ON public.dev_competency_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev course comp read" ON public.dev_course_competency_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev idp read" ON public.dev_idps FOR SELECT TO authenticated USING (public.dev_idp_readable(id));
CREATE POLICY "dev idp versions read" ON public.dev_idp_versions FOR SELECT TO authenticated USING (public.dev_idp_readable(idp_id));
CREATE POLICY "dev idp events read" ON public.dev_idp_activity_events FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_idp_versions v WHERE v.id = idp_version_id AND public.dev_idp_readable(v.idp_id)));
CREATE POLICY "dev idp shares read" ON public.dev_idp_shares FOR SELECT TO authenticated USING (
  grantee_person = public.current_person_id() OR EXISTS (SELECT 1 FROM public.dev_idps i WHERE i.id = idp_id AND i.person_id = public.current_person_id()));
CREATE POLICY "dev idp share rev read" ON public.dev_idp_share_revocations FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_idp_shares s JOIN public.dev_idps i ON i.id = s.idp_id WHERE s.id = share_id
    AND (s.grantee_person = public.current_person_id() OR i.person_id = public.current_person_id())));
CREATE POLICY "dev idp rec read" ON public.dev_idp_recommendations FOR SELECT TO authenticated USING (
  person_id = public.current_person_id() OR author_person = public.current_person_id());
CREATE POLICY "dev idp rec resp read" ON public.dev_idp_recommendation_responses FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_idp_recommendations r WHERE r.id = recommendation_id AND (r.person_id = public.current_person_id() OR r.author_person = public.current_person_id())));

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['dev_competencies','dev_competency_versions','dev_competency_approvals','dev_course_competency_links','dev_idps','dev_idp_versions',
    'dev_idp_activity_events','dev_idp_shares','dev_idp_share_revocations','dev_idp_recommendations','dev_idp_recommendation_responses'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only()', t || '_immutable', t);
  END LOOP;
END $$;

-- ===== Writers =====
CREATE OR REPLACE FUNCTION public.record_dev_competency_version(_code text, _expected_version int, _title text, _description text, _indicators text[], _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _c uuid; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_competency_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('manter-competencias-formativas') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT id INTO _c FROM public.dev_competencies WHERE code = upper(btrim(_code)) FOR UPDATE;
  IF _c IS NULL THEN
    IF coalesce(_expected_version, 0) <> 0 THEN RAISE EXCEPTION 'dev:stale'; END IF;
    INSERT INTO public.dev_competencies(code, author_person) VALUES (upper(btrim(_code)), _p) RETURNING id INTO _c;
  END IF;
  SELECT coalesce(max(version), 0) INTO _last FROM public.dev_competency_versions WHERE competency_id = _c;
  IF _last <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_competency_versions(competency_id, version, title, description, indicators, reason, author_person, idempotency_key)
  VALUES (_c, _last + 1, btrim(_title), btrim(_description), _indicators, nullif(btrim(coalesce(_reason,'')),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_dev_competency(_version uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _a uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_competency_approvals WHERE competency_version_id = _version AND approver_person = _p) THEN RETURN; END IF;
  IF NOT public.has_network_capability('aprovar-competencias-formativas') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT author_person INTO _a FROM public.dev_competency_versions WHERE id = _version;
  IF _a IS NULL THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _a = _p THEN RAISE EXCEPTION 'dev:self-approval'; END IF;
  INSERT INTO public.dev_competency_approvals(competency_version_id, approver_person, reason) VALUES (_version, _p, btrim(_reason));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.link_dev_course_competency(_course_version uuid, _competency_version uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_course_competency_links WHERE course_version_id = _course_version AND competency_version_id = _competency_version;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('manter-competencias-formativas') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  INSERT INTO public.dev_course_competency_links(course_version_id, competency_version_id, author_person) VALUES (_course_version, _competency_version, _p) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- PDI: só o titular escreve. Metas [{key,text,competency_version_id?,target_on?}], atividades [{key,goal_key,kind,description,course_id?}].
CREATE OR REPLACE FUNCTION public.record_dev_idp_version(_expected_version int, _goals jsonb, _activities jsonb, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _idp uuid; _last int; g jsonb; a jsonb; _gkeys text[] := '{}'; _akeys text[] := '{}';
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_idp_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF jsonb_typeof(_goals) <> 'array' OR jsonb_typeof(_activities) <> 'array' THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  FOR g IN SELECT * FROM jsonb_array_elements(_goals) LOOP
    IF coalesce(g->>'key','') !~ '^[a-z0-9-]{1,40}$' OR length(btrim(coalesce(g->>'text',''))) < 10 OR (g->>'key') = ANY(_gkeys) THEN RAISE EXCEPTION 'dev:invalid-goal'; END IF;
    IF g ? 'competency_version_id' AND g->>'competency_version_id' IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.dev_competency_approvals WHERE competency_version_id = (g->>'competency_version_id')::uuid) THEN RAISE EXCEPTION 'dev:competency-not-approved'; END IF;
    IF g ? 'target_on' AND g->>'target_on' IS NOT NULL THEN PERFORM (g->>'target_on')::date; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(g) k WHERE k NOT IN ('key','text','competency_version_id','target_on')) THEN RAISE EXCEPTION 'dev:invalid-goal'; END IF;
    _gkeys := _gkeys || (g->>'key');
  END LOOP;
  FOR a IN SELECT * FROM jsonb_array_elements(_activities) LOOP
    IF coalesce(a->>'key','') !~ '^[a-z0-9-]{1,40}$' OR (a->>'key') = ANY(_akeys) OR NOT (coalesce(a->>'goal_key','') = ANY(_gkeys))
       OR coalesce(a->>'kind','') NOT IN ('curso','leitura','pratica','mentoria','outro') OR length(btrim(coalesce(a->>'description',''))) < 5 THEN RAISE EXCEPTION 'dev:invalid-activity'; END IF;
    IF a->>'kind' = 'curso' AND NOT EXISTS (SELECT 1 FROM public.dev_courses WHERE id = (a->>'course_id')::uuid) THEN RAISE EXCEPTION 'dev:invalid-activity'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(a) k WHERE k NOT IN ('key','goal_key','kind','description','course_id')) THEN RAISE EXCEPTION 'dev:invalid-activity'; END IF;
    _akeys := _akeys || (a->>'key');
  END LOOP;
  SELECT id INTO _idp FROM public.dev_idps WHERE person_id = _p FOR UPDATE;
  IF _idp IS NULL THEN INSERT INTO public.dev_idps(person_id) VALUES (_p) RETURNING id INTO _idp; END IF;
  SELECT coalesce(max(version), 0) INTO _last FROM public.dev_idp_versions WHERE idp_id = _idp;
  IF _last <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_idp_versions(idp_id, version, goals, activities, reason, author_person, idempotency_key)
  VALUES (_idp, _last + 1, _goals, _activities, nullif(btrim(coalesce(_reason,'')),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR invalid_text_representation OR datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_dev_idp_activity(_idp_version uuid, _activity text, _expected_seq int, _status text, _note text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.dev_idp_versions; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT v.* INTO _v FROM public.dev_idp_versions v JOIN public.dev_idps i ON i.id = v.idp_id WHERE v.id = _idp_version AND i.person_id = _p;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  PERFORM 1 FROM public.dev_idps WHERE id = _v.idp_id FOR UPDATE;
  IF _v.version <> (SELECT max(version) FROM public.dev_idp_versions WHERE idp_id = _v.idp_id) THEN RAISE EXCEPTION 'dev:not-latest'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_v.activities) a WHERE a->>'key' = _activity) THEN RAISE EXCEPTION 'dev:invalid-activity'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.dev_idp_activity_events WHERE idp_version_id = _idp_version AND activity_key = _activity;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_idp_activity_events(idp_version_id, activity_key, seq, status, note, author_person)
  VALUES (_idp_version, _activity, _last + 1, _status, nullif(btrim(coalesce(_note,'')),''), _p);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.share_dev_idp(_grantee uuid, _purpose text, _valid_until date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _idp uuid; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF _grantee = _p THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _valid_until < current_date OR _valid_until > current_date + 366 THEN RAISE EXCEPTION 'dev:invalid-window'; END IF;
  SELECT id INTO _idp FROM public.dev_idps WHERE person_id = _p;
  IF _idp IS NULL THEN RAISE EXCEPTION 'dev:no-idp'; END IF;
  INSERT INTO public.dev_idp_shares(idp_id, grantee_person, purpose, valid_until) VALUES (_idp, _grantee, btrim(_purpose), _valid_until) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.revoke_dev_idp_share(_share uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id();
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dev_idp_shares s JOIN public.dev_idps i ON i.id = s.idp_id WHERE s.id = _share AND i.person_id = _p) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  INSERT INTO public.dev_idp_share_revocations(share_id) VALUES (_share) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.recommend_dev_formation(_person uuid, _course uuid, _competency_version uuid, _justification text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_idp_recommendations WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('recomendar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  INSERT INTO public.dev_idp_recommendations(person_id, course_id, competency_version_id, justification, author_person, idempotency_key)
  VALUES (_person, _course, _competency_version, btrim(_justification), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.respond_dev_recommendation(_recommendation uuid, _response text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id();
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dev_idp_recommendations WHERE id = _recommendation AND person_id = _p) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  INSERT INTO public.dev_idp_recommendation_responses(recommendation_id, response, note) VALUES (_recommendation, _response, nullif(btrim(coalesce(_note,'')),''));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_dev_competency_version(text,int,text,text,text[],text,text)','approve_dev_competency(uuid,text)','link_dev_course_competency(uuid,uuid)',
    'record_dev_idp_version(int,jsonb,jsonb,text,text)','record_dev_idp_activity(uuid,text,int,text,text)','share_dev_idp(uuid,text,date)','revoke_dev_idp_share(uuid)',
    'recommend_dev_formation(uuid,uuid,uuid,text,text)','respond_dev_recommendation(uuid,text,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
COMMENT ON TABLE public.dev_course_competency_links IS 'Curso contribui para competência; conclusão de curso não comprova domínio.';