-- Matrículas L22: necessidade de apoio declarada no ingresso é dado protegido e NUNCA critério de exclusão/ordenação.
-- Só tipo de catálogo fechado (sem CID, laudo ou texto livre); encaminhamento leva o MÍNIMO (código do pedido, escola, tipo)
-- ao destino compatível (NEI, Transporte, Infraestrutura), que lê só os próprios encaminhamentos por função DEFINER.
CREATE TABLE public.enr_support_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.enr_applications(id),
  need_kind text NOT NULL CHECK (need_kind IN ('acessibilidade-fisica','transporte-adaptado','apoio-pedagogico-especializado','comunicacao-acessivel','mobiliario-adaptado')),
  declared_by_person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, need_kind)
);
CREATE TABLE public.enr_support_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id uuid NOT NULL REFERENCES public.enr_support_needs(id),
  destination text NOT NULL CHECK (destination IN ('nei','transporte','infraestrutura')),
  application_code text NOT NULL,
  school_key text NOT NULL,
  need_kind text NOT NULL,
  referred_by_person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (need_id, destination)
);
COMMENT ON TABLE public.enr_support_needs IS 'Apoio declarado: protegido; nunca critério de classificação, distribuição ou indeferimento.';
GRANT SELECT ON public.enr_support_needs, public.enr_support_referrals TO authenticated;
GRANT ALL ON public.enr_support_needs, public.enr_support_referrals TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_support_needs, public.enr_support_referrals FROM authenticated, anon, service_role;
ALTER TABLE public.enr_support_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_support_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr support read" ON public.enr_support_needs FOR SELECT TO authenticated USING (public.has_network_capability('registrar-apoio-de-ingresso'));
CREATE POLICY "enr referral read" ON public.enr_support_referrals FOR SELECT TO authenticated USING (public.has_network_capability('registrar-apoio-de-ingresso'));
CREATE TRIGGER enr_support_append_only BEFORE UPDATE OR DELETE ON public.enr_support_needs FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_referral_append_only BEFORE UPDATE OR DELETE ON public.enr_support_referrals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.enr_support_destination_allowed(_kind text, _dest text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT (_dest = 'nei' AND _kind IN ('apoio-pedagogico-especializado','comunicacao-acessivel'))
      OR (_dest = 'transporte' AND _kind = 'transporte-adaptado')
      OR (_dest = 'infraestrutura' AND _kind IN ('acessibilidade-fisica','mobiliario-adaptado'))
$$;

CREATE OR REPLACE FUNCTION public.enr_record_support_need(_application uuid, _kind text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  SELECT n.id INTO _id FROM public.enr_support_needs n WHERE n.idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('registrar-apoio-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  INSERT INTO public.enr_support_needs(application_id, need_kind, declared_by_person_id, idempotency_key)
  VALUES (_application, _kind, _p, _key) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.enr_refer_support_need(_need uuid, _dest text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _n public.enr_support_needs; _a public.enr_applications;
BEGIN
  SELECT r.id INTO _id FROM public.enr_support_referrals r WHERE r.idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('registrar-apoio-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _n FROM public.enr_support_needs WHERE id = _need;
  IF _n.id IS NULL THEN RAISE EXCEPTION 'apoio-inexistente'; END IF;
  IF NOT public.enr_support_destination_allowed(_n.need_kind, _dest) THEN RAISE EXCEPTION 'destino-incompativel'; END IF;
  SELECT * INTO _a FROM public.enr_applications WHERE id = _n.application_id;
  INSERT INTO public.enr_support_referrals(need_id, destination, application_code, school_key, need_kind, referred_by_person_id, idempotency_key)
  VALUES (_need, _dest, _a.application_code, _a.school_preferences[1], _n.need_kind, _p, _key) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Leitura do destino: só o mínimo (sem nome, nascimento, CPF ou contato).
CREATE OR REPLACE FUNCTION public.enr_support_referrals_for(_dest text)
RETURNS TABLE(application_code text, school_key text, need_kind text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.application_code, r.school_key, r.need_kind, r.created_at FROM public.enr_support_referrals r
  WHERE r.destination = _dest AND public.has_network_capability(CASE _dest WHEN 'nei' THEN 'receber-encaminhamento-ingresso-nei'
    WHEN 'transporte' THEN 'receber-encaminhamento-ingresso-transporte' WHEN 'infraestrutura' THEN 'receber-encaminhamento-ingresso-infraestrutura' END)
  ORDER BY r.created_at
$$;
REVOKE ALL ON FUNCTION public.enr_record_support_need(uuid,text,text), public.enr_refer_support_need(uuid,text,text), public.enr_support_referrals_for(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enr_record_support_need(uuid,text,text), public.enr_refer_support_need(uuid,text,text), public.enr_support_referrals_for(text) TO authenticated;