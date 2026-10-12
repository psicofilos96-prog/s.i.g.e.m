-- SIGEM Desenvolvimento L21: trilhas por função. Alvo = tipo de atuação canônica (institutional_engagements.engagement_kind_id),
-- nunca cargo textual; indicação para a pessoa só pela atuação vigente dela hoje; nenhuma competência clínica.
CREATE TABLE public.dev_role_track_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_version_id uuid NOT NULL REFERENCES public.dev_track_approvals(track_version_id),
  engagement_kind_id text NOT NULL CHECK (length(btrim(engagement_kind_id)) >= 2),
  audience_group text NOT NULL CHECK (audience_group IN ('docentes','gestores','mediadores','apoio','secretaria','alimentacao','transporte','outros')),
  rationale text NOT NULL CHECK (length(btrim(rationale)) >= 20),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (track_version_id, engagement_kind_id)
);
CREATE TABLE public.dev_role_track_target_withdrawals (
  target_id uuid PRIMARY KEY REFERENCES public.dev_role_track_targets(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dev_role_track_targets, public.dev_role_track_target_withdrawals TO authenticated;
GRANT ALL ON public.dev_role_track_targets, public.dev_role_track_target_withdrawals TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_role_track_targets, public.dev_role_track_target_withdrawals FROM authenticated, anon;
ALTER TABLE public.dev_role_track_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_role_track_target_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev role track targets read" ON public.dev_role_track_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev role track withdrawals read" ON public.dev_role_track_target_withdrawals FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.dev_clinical_text(_t text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT lower(coalesce(_t,'')) ~ '(diagn[oó]stic|cl[ií]nic|terap|laudo|\mcid\M|patolog|transtorno|prescri|medica[cç]|psicoterap)'
$$;

CREATE OR REPLACE FUNCTION public.target_dev_role_track(_track_version uuid, _kind text, _group text, _rationale text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _title text; _obj text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_role_track_targets WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('manter-trilhas-por-funcao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dev_track_approvals a WHERE a.track_version_id = _track_version) THEN RAISE EXCEPTION 'dev:not-approved'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.engagement_kind_id = btrim(_kind)) THEN RAISE EXCEPTION 'dev:unknown-engagement-kind'; END IF;
  SELECT v.title, v.objectives INTO _title, _obj FROM public.dev_track_versions v WHERE v.id = _track_version;
  IF public.dev_clinical_text(_title) OR public.dev_clinical_text(_obj) OR public.dev_clinical_text(_rationale) THEN RAISE EXCEPTION 'dev:clinical-content'; END IF;
  INSERT INTO public.dev_role_track_targets(track_version_id, engagement_kind_id, audience_group, rationale, author_person, idempotency_key)
  VALUES (_track_version, btrim(_kind), _group, btrim(_rationale), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR unique_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.withdraw_dev_role_track(_target uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id();
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF NOT public.has_network_capability('manter-trilhas-por-funcao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  INSERT INTO public.dev_role_track_target_withdrawals(target_id, reason, author_person) VALUES (_target, btrim(_reason), _p);
EXCEPTION WHEN check_violation OR unique_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.dev_my_role_tracks()
RETURNS TABLE(target_id uuid, track_version_id uuid, engagement_kind_id text, audience_group text, engagement_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.id, t.track_version_id, t.engagement_kind_id, t.audience_group, e.id
  FROM public.dev_role_track_targets t
  JOIN public.institutional_engagements e ON e.engagement_kind_id = t.engagement_kind_id
  WHERE e.person_id = public.current_person_id() AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)
    AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.ended_on <= current_date)
    AND NOT EXISTS (SELECT 1 FROM public.dev_role_track_target_withdrawals w WHERE w.target_id = t.id)
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['target_dev_role_track(uuid,text,text,text,text)','withdraw_dev_role_track(uuid,text)','dev_my_role_tracks()','dev_clinical_text(text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;