-- Matrículas L08: política de preferências por campanha (limites, ordenação, turnos/ofertas admitidos), versionada e aprovada por pessoa ≠ autor.
-- Preferência nunca promete vaga: é só ordem declarada para a distribuição (L09).
CREATE TABLE public.enr_preference_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.enr_campaigns(id),
  version int NOT NULL CHECK (version >= 1),
  min_choices int NOT NULL CHECK (min_choices >= 1),
  max_choices int NOT NULL CHECK (max_choices BETWEEN 1 AND 10),
  ordering text NOT NULL CHECK (ordering IN ('ordenada','sem-ordem')),
  shift_ids text[] NOT NULL DEFAULT '{}',
  offer_ids text[] NOT NULL DEFAULT '{}',
  justification text NOT NULL CHECK (length(btrim(justification)) >= 20),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, version),
  CHECK (max_choices >= min_choices)
);
CREATE TABLE public.enr_preference_policy_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL UNIQUE REFERENCES public.enr_preference_policies(id),
  approver_person uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.enr_preference_policies, public.enr_preference_policy_approvals TO authenticated;
GRANT ALL ON public.enr_preference_policies, public.enr_preference_policy_approvals TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_preference_policies, public.enr_preference_policy_approvals FROM authenticated, anon;
ALTER TABLE public.enr_preference_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_preference_policy_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr pref policies read" ON public.enr_preference_policies FOR SELECT TO authenticated USING (public.enr_campaign_manager());
CREATE POLICY "enr pref approvals read" ON public.enr_preference_policy_approvals FOR SELECT TO authenticated USING (public.enr_campaign_manager());
CREATE TRIGGER enr_pref_policies_append_only BEFORE UPDATE OR DELETE ON public.enr_preference_policies FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_pref_approvals_append_only BEFORE UPDATE OR DELETE ON public.enr_preference_policy_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Política vigente = maior versão APROVADA da campanha.
CREATE OR REPLACE FUNCTION public.enr_preference_policy_current(_c uuid) RETURNS public.enr_preference_policies
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.* FROM public.enr_preference_policies p JOIN public.enr_preference_policy_approvals a ON a.policy_id = p.id
  WHERE p.campaign_id = _c ORDER BY p.version DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.record_enr_preference_policy(_campaign uuid, _expected_version int, _min int, _max int, _ordering text, _shifts text[], _offers text[], _justification text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid;
BEGIN
  SELECT id INTO _id FROM public.enr_preference_policies WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL OR NOT public.has_network_capability('manter-campanhas-de-matricula') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.enr_campaigns WHERE id = _campaign) THEN RAISE EXCEPTION 'campanha-inexistente'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_shifts,'{}')||coalesce(_offers,'{}')) v WHERE length(btrim(v)) = 0) THEN RAISE EXCEPTION 'valor-vazio'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.enr_preference_policies WHERE campaign_id = _campaign;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  INSERT INTO public.enr_preference_policies(campaign_id, version, min_choices, max_choices, ordering, shift_ids, offer_ids, justification, author_person, idempotency_key)
  VALUES (_campaign, _last + 1, _min, _max, _ordering, coalesce(_shifts,'{}'), coalesce(_offers,'{}'), _justification, _p, _key) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.approve_enr_preference_policy(_policy uuid, _reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _author uuid; _id uuid;
BEGIN
  SELECT id INTO _id FROM public.enr_preference_policy_approvals WHERE policy_id = _policy;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL OR NOT public.has_network_capability('autorizar-campanhas-de-matricula') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT author_person INTO _author FROM public.enr_preference_policies WHERE id = _policy FOR UPDATE;
  IF _author IS NULL THEN RAISE EXCEPTION 'politica-inexistente'; END IF;
  IF _author = _p THEN RAISE EXCEPTION 'aprovador-igual-autor'; END IF;
  INSERT INTO public.enr_preference_policy_approvals(policy_id, approver_person, reason) VALUES (_policy, _p, _reason) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Pedido sem política aprovada ou fora dos limites é recusado no banco (falha fechada), qualquer que seja o caminho de escrita.
CREATE OR REPLACE FUNCTION public.enr_application_preferences_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _pol public.enr_preference_policies; _n int := cardinality(NEW.school_preferences);
BEGIN
  _pol := public.enr_preference_policy_current(NEW.campaign_id);
  IF _pol.id IS NULL THEN RAISE EXCEPTION 'preferencias-sem-politica'; END IF;
  IF _n < _pol.min_choices OR _n > _pol.max_choices THEN RAISE EXCEPTION 'preferencias-fora-do-limite'; END IF;
  IF (SELECT count(DISTINCT s) FROM unnest(NEW.school_preferences) s) <> _n THEN RAISE EXCEPTION 'preferencias-repetidas'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enr_applications_preferences_guard BEFORE INSERT ON public.enr_applications FOR EACH ROW EXECUTE FUNCTION public.enr_application_preferences_guard();

-- Leitura pública só dos limites (sem autoria) para o formulário.
CREATE OR REPLACE FUNCTION public.enr_public_preference_policy(_campaign uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN p.id IS NULL OR public.enr_campaign_state(_campaign) <> 'publicada' THEN NULL
    ELSE jsonb_build_object('version', p.version, 'min', p.min_choices, 'max', p.max_choices, 'ordering', p.ordering, 'shifts', to_jsonb(p.shift_ids), 'offers', to_jsonb(p.offer_ids)) END
  FROM (SELECT (public.enr_preference_policy_current(_campaign)).*) p
$$;
REVOKE ALL ON FUNCTION public.record_enr_preference_policy(uuid,int,int,int,text,text[],text[],text,text), public.approve_enr_preference_policy(uuid,text), public.enr_preference_policy_current(uuid), public.enr_application_preferences_guard(), public.enr_public_preference_policy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_enr_preference_policy(uuid,int,int,int,text,text[],text[],text,text), public.approve_enr_preference_policy(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enr_public_preference_policy(uuid) TO anon, authenticated;