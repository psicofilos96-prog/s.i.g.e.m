-- Matrículas L16: prazo da reserva só por regra aprovada (aprovador ≠ autor); origem declarada; estados projetados
-- (ativa/confirmada/expirada/cancelada), nunca gravados. Ocupação canônica continua sendo só enr_seat_occupancy (L15).
CREATE TABLE public.enr_seat_hold_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.enr_campaigns(id),
  version int NOT NULL CHECK (version >= 1),
  hold_minutes int NOT NULL CHECK (hold_minutes BETWEEN 1 AND 43200),
  justification text NOT NULL CHECK (length(btrim(justification)) >= 20),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, version)
);
CREATE TABLE public.enr_seat_hold_rule_approvals (
  rule_id uuid PRIMARY KEY REFERENCES public.enr_seat_hold_rules(id),
  approver_person uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.enr_seat_hold_rules, public.enr_seat_hold_rule_approvals TO authenticated;
GRANT ALL ON public.enr_seat_hold_rules, public.enr_seat_hold_rule_approvals TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_seat_hold_rules, public.enr_seat_hold_rule_approvals FROM authenticated, anon;
ALTER TABLE public.enr_seat_hold_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_seat_hold_rule_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr hold rules read" ON public.enr_seat_hold_rules FOR SELECT TO authenticated USING (public.has_network_capability('reservar-vagas-de-ingresso') OR public.has_network_capability('manter-campanhas-de-matricula') OR public.has_network_capability('autorizar-campanhas-de-matricula'));
CREATE POLICY "enr hold rule appr read" ON public.enr_seat_hold_rule_approvals FOR SELECT TO authenticated USING (public.has_network_capability('reservar-vagas-de-ingresso') OR public.has_network_capability('manter-campanhas-de-matricula') OR public.has_network_capability('autorizar-campanhas-de-matricula'));
CREATE TRIGGER enr_hold_rules_append_only BEFORE UPDATE OR DELETE ON public.enr_seat_hold_rules FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_hold_rule_appr_append_only BEFORE UPDATE OR DELETE ON public.enr_seat_hold_rule_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

ALTER TABLE public.enr_seat_events ADD COLUMN origin text CHECK (origin IS NULL OR origin IN ('distribuicao','lista-de-espera','transferencia'));
ALTER TABLE public.enr_seat_events ADD COLUMN rule_id uuid REFERENCES public.enr_seat_hold_rules(id);

CREATE OR REPLACE FUNCTION public.record_enr_seat_hold_rule(_campaign uuid, _minutes int, _justification text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v int;
BEGIN
  SELECT version INTO _v FROM public.enr_seat_hold_rules WHERE idempotency_key = _key;
  IF _v IS NOT NULL THEN RETURN _v; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('manter-campanhas-de-matricula') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  PERFORM 1 FROM public.enr_campaigns WHERE id = _campaign FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campanha-inexistente'; END IF;
  SELECT coalesce(max(version),0) INTO _v FROM public.enr_seat_hold_rules WHERE campaign_id = _campaign;
  INSERT INTO public.enr_seat_hold_rules(campaign_id, version, hold_minutes, justification, author_person, idempotency_key)
  VALUES (_campaign, _v + 1, _minutes, btrim(_justification), _p, _key);
  RETURN _v + 1;
END $$;

CREATE OR REPLACE FUNCTION public.approve_enr_seat_hold_rule(_rule uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.enr_seat_hold_rules;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('autorizar-campanhas-de-matricula') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _r FROM public.enr_seat_hold_rules WHERE id = _rule FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'regra-inexistente'; END IF;
  IF EXISTS (SELECT 1 FROM public.enr_seat_hold_rule_approvals WHERE rule_id = _rule) THEN RETURN; END IF;
  IF _r.author_person = _p THEN RAISE EXCEPTION 'aprovador-igual-autor'; END IF;
  INSERT INTO public.enr_seat_hold_rule_approvals(rule_id, approver_person, reason) VALUES (_rule, _p, btrim(_reason));
END $$;

-- Regra vigente = maior versão APROVADA da campanha; sem regra ⇒ nenhuma reserva.
CREATE OR REPLACE FUNCTION public.enr_seat_reserve_v2(_pool uuid, _application uuid, _proposal uuid, _origin text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _h uuid; _camp uuid; _cap int; _s int; _last text; _rule public.enr_seat_hold_rules;
BEGIN
  SELECT hold_id INTO _h FROM public.enr_seat_events WHERE idempotency_key = _key;
  IF _h IS NOT NULL THEN RETURN _h; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('reservar-vagas-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  IF _origin IS NULL OR _origin NOT IN ('distribuicao','lista-de-espera','transferencia') THEN RAISE EXCEPTION 'origem-invalida'; END IF;
  SELECT campaign_id INTO _camp FROM public.enr_seat_pools WHERE id = _pool FOR UPDATE;
  IF _camp IS NULL THEN RAISE EXCEPTION 'quadro-inexistente'; END IF;
  PERFORM 1 FROM public.enr_applications WHERE id = _application AND campaign_id = _camp FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido-fora-da-campanha'; END IF;
  SELECT r.* INTO _rule FROM public.enr_seat_hold_rules r JOIN public.enr_seat_hold_rule_approvals a ON a.rule_id = r.id
   WHERE r.campaign_id = _camp ORDER BY r.version DESC LIMIT 1;
  IF _rule.id IS NULL THEN RAISE EXCEPTION 'prazo-sem-regra-aprovada'; END IF;
  SELECT action INTO _last FROM public.enr_distribution_events e JOIN public.enr_distribution_proposals d ON d.id = e.proposal_id
   WHERE d.id = _proposal AND d.campaign_id = _camp ORDER BY e.seq DESC LIMIT 1;
  IF coalesce(_last,'') <> 'publicar' THEN RAISE EXCEPTION 'distribuicao-nao-publicada'; END IF;
  IF EXISTS (SELECT 1 FROM public.enr_seat_events r WHERE r.application_id = _application AND r.kind = 'reservar'
              AND NOT EXISTS (SELECT 1 FROM public.enr_seat_events x WHERE x.hold_id = r.hold_id AND x.kind = 'liberar')
              AND (EXISTS (SELECT 1 FROM public.enr_seat_events x WHERE x.hold_id = r.hold_id AND x.kind = 'confirmar') OR r.expires_at > now()))
  THEN RAISE EXCEPTION 'pedido-ja-tem-vaga'; END IF;
  SELECT authorized INTO _cap FROM public.enr_seat_pool_versions WHERE pool_id = _pool ORDER BY version DESC LIMIT 1;
  IF _cap IS NULL THEN RAISE EXCEPTION 'capacidade-nao-autorizada'; END IF;
  IF public.enr_seat_occupancy(_pool, now()) >= _cap THEN RAISE EXCEPTION 'sem-vaga'; END IF;
  SELECT coalesce(max(seq),0) INTO _s FROM public.enr_seat_events WHERE pool_id = _pool;
  _h := gen_random_uuid();
  INSERT INTO public.enr_seat_events(pool_id, seq, hold_id, application_id, kind, proposal_id, expires_at, person_id, idempotency_key, origin, rule_id)
  VALUES (_pool, _s + 1, _h, _application, 'reservar', _proposal, now() + make_interval(mins => _rule.hold_minutes), _p, _key, _origin, _rule.id);
  RETURN _h;
END $$;

-- Estados e histórico projetados no instante (nada é gravado como estado).
CREATE OR REPLACE FUNCTION public.enr_seat_holds(_pool uuid)
RETURNS TABLE(hold_id uuid, application_id uuid, origin text, state text, reserved_at timestamptz, expires_at timestamptz, closed_at timestamptz, close_reason text, history jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.hold_id, r.application_id, r.origin,
    CASE WHEN c.kind = 'confirmar' THEN 'confirmada' WHEN c.kind = 'liberar' THEN 'cancelada'
         WHEN r.expires_at <= now() THEN 'expirada' ELSE 'ativa' END,
    r.created_at, r.expires_at, c.created_at, c.reason,
    (SELECT jsonb_agg(jsonb_build_object('seq', e.seq, 'kind', e.kind, 'at', e.created_at) ORDER BY e.seq) FROM public.enr_seat_events e WHERE e.hold_id = r.hold_id)
  FROM public.enr_seat_events r
  LEFT JOIN public.enr_seat_events c ON c.hold_id = r.hold_id AND c.kind IN ('confirmar','liberar')
  WHERE r.pool_id = _pool AND r.kind = 'reservar'
    AND (public.has_network_capability('reservar-vagas-de-ingresso') OR public.has_network_capability('confirmar-vagas-de-ingresso'))
  ORDER BY r.seq
$$;

-- Reserva só nasce com prazo de regra aprovada: o writer com prazo informado pelo chamador deixa de ser chamável.
REVOKE EXECUTE ON FUNCTION public.enr_seat_reserve(uuid,uuid,uuid,int,text) FROM authenticated;
COMMENT ON FUNCTION public.enr_seat_reserve(uuid,uuid,uuid,int,text) IS 'DEPRECATED: replaced by enr_seat_reserve_v2 (prazo por regra aprovada)';
REVOKE ALL ON FUNCTION public.record_enr_seat_hold_rule(uuid,int,text,text), public.approve_enr_seat_hold_rule(uuid,text),
  public.enr_seat_reserve_v2(uuid,uuid,uuid,text,text), public.enr_seat_holds(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_enr_seat_hold_rule(uuid,int,text,text), public.approve_enr_seat_hold_rule(uuid,text),
  public.enr_seat_reserve_v2(uuid,uuid,uuid,text,text), public.enr_seat_holds(uuid) TO authenticated;