-- Matrículas L18: divulgação INDIVIDUAL do resultado. Só por código + conferência do próprio pedido (sem lista, sem nome, sem terceiros).
-- Situação derivada das fontes canônicas: distribuição publicada (L14), reservas (L15/L16) e lista de espera (L17).
-- Justificativa e providência só de texto APROVADO por situação (aprovador ≠ autor); sem texto aprovado ⇒ nada inventado.
CREATE TABLE public.enr_result_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.enr_campaigns(id),
  situation text NOT NULL CHECK (situation IN ('contemplado','vaga-reservada','vaga-confirmada','reserva-vencida','reserva-cancelada','lista-de-espera','indeterminado','nao-contemplado')),
  version int NOT NULL CHECK (version >= 1),
  justification_text text NOT NULL CHECK (length(btrim(justification_text)) BETWEEN 20 AND 1000),
  action_text text NOT NULL CHECK (length(btrim(action_text)) BETWEEN 10 AND 1000),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, situation, version)
);
CREATE TABLE public.enr_result_notice_approvals (
  notice_id uuid PRIMARY KEY REFERENCES public.enr_result_notices(id),
  approver_person uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.enr_result_notices, public.enr_result_notice_approvals TO authenticated;
GRANT ALL ON public.enr_result_notices, public.enr_result_notice_approvals TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_result_notices, public.enr_result_notice_approvals FROM authenticated, anon;
ALTER TABLE public.enr_result_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_result_notice_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr notices read" ON public.enr_result_notices FOR SELECT TO authenticated USING (public.has_network_capability('manter-campanhas-de-matricula') OR public.has_network_capability('autorizar-campanhas-de-matricula'));
CREATE POLICY "enr notice appr read" ON public.enr_result_notice_approvals FOR SELECT TO authenticated USING (public.has_network_capability('manter-campanhas-de-matricula') OR public.has_network_capability('autorizar-campanhas-de-matricula'));
CREATE TRIGGER enr_notices_append_only BEFORE UPDATE OR DELETE ON public.enr_result_notices FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_notice_appr_append_only BEFORE UPDATE OR DELETE ON public.enr_result_notice_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Texto é modelo por situação: recusa CPF, código de pedido ou protocolo embutidos (nada individual em texto padrão).
CREATE OR REPLACE FUNCTION public.record_enr_result_notice(_campaign uuid, _situation text, _justification text, _action text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v int;
BEGIN
  SELECT version INTO _v FROM public.enr_result_notices WHERE idempotency_key = _key;
  IF _v IS NOT NULL THEN RETURN _v; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('manter-campanhas-de-matricula') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  IF (_justification || ' ' || _action) ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}|INS-[0-9A-F]{10}|PROT-\d' THEN RAISE EXCEPTION 'texto-com-dado-individual'; END IF;
  PERFORM 1 FROM public.enr_campaigns WHERE id = _campaign FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'campanha-inexistente'; END IF;
  SELECT coalesce(max(version),0) INTO _v FROM public.enr_result_notices WHERE campaign_id = _campaign AND situation = _situation;
  INSERT INTO public.enr_result_notices(campaign_id, situation, version, justification_text, action_text, author_person, idempotency_key)
  VALUES (_campaign, _situation, _v + 1, btrim(_justification), btrim(_action), _p, _key);
  RETURN _v + 1;
END $$;

CREATE OR REPLACE FUNCTION public.approve_enr_result_notice(_notice uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _n public.enr_result_notices;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('autorizar-campanhas-de-matricula') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _n FROM public.enr_result_notices WHERE id = _notice FOR UPDATE;
  IF _n.id IS NULL THEN RAISE EXCEPTION 'texto-inexistente'; END IF;
  IF EXISTS (SELECT 1 FROM public.enr_result_notice_approvals WHERE notice_id = _notice) THEN RETURN; END IF;
  IF _n.author_person = _p THEN RAISE EXCEPTION 'aprovador-igual-autor'; END IF;
  INSERT INTO public.enr_result_notice_approvals(notice_id, approver_person, reason) VALUES (_notice, _p, btrim(_reason));
END $$;

-- Resultado individual: UMA linha, só do próprio pedido. Escola/etapa/modalidade como chave da célula; nunca nome, posição de terceiros ou lista.
CREATE OR REPLACE FUNCTION public.enr_public_application_result(_code text, _check text)
RETURNS TABLE(status text, situation text, cell text, deadline timestamptz, justification text, next_step text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _a public.enr_applications; _prot text; _run public.enr_classification_runs; _item jsonb; _sit text; _cell text; _dl timestamptz;
        _hold record; _n public.enr_result_notices;
BEGIN
  IF _code IS NULL OR _check IS NULL OR btrim(_code) !~ '^INS-[0-9A-F]{10}$' OR lower(btrim(_check)) !~ '^[0-9a-f]{12}$' THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text, NULL::text, NULL::timestamptz, NULL::text, NULL::text; RETURN; END IF;
  SELECT * INTO _a FROM public.enr_applications a WHERE a.application_code = btrim(_code);
  IF _a.check_hash IS NULL OR _a.check_hash <> encode(extensions.digest(lower(btrim(_check)), 'sha256'), 'hex') THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text, NULL::text, NULL::timestamptz, NULL::text, NULL::text; RETURN; END IF;

  SELECT pr.protocol_number INTO _prot FROM public.enr_application_protocols l JOIN public.protocol_registrations pr ON pr.id = l.registration_id WHERE l.application_id = _a.id;
  SELECT r.* INTO _run FROM public.enr_distribution_proposals d JOIN public.enr_classification_runs r ON r.id = d.run_id
   WHERE d.campaign_id = _a.campaign_id
     AND (SELECT e.action FROM public.enr_distribution_events e WHERE e.proposal_id = d.id ORDER BY e.seq DESC LIMIT 1) = 'publicar'
   ORDER BY d.created_at DESC LIMIT 1;
  IF _run.id IS NULL OR _prot IS NULL THEN
    RETURN QUERY SELECT 'sem-resultado-publicado'::text, NULL::text, NULL::text, NULL::timestamptz, NULL::text, NULL::text; RETURN; END IF;

  SELECT r.expires_at, p.cell_key,
         (SELECT c.kind FROM public.enr_seat_events c WHERE c.hold_id = r.hold_id AND c.kind IN ('confirmar','liberar') LIMIT 1) AS closed
    INTO _hold FROM public.enr_seat_events r JOIN public.enr_seat_pools p ON p.id = r.pool_id
   WHERE r.application_id = _a.id AND r.kind = 'reservar' ORDER BY r.created_at DESC LIMIT 1;
  IF _hold.cell_key IS NOT NULL THEN
    _cell := _hold.cell_key;
    _sit := CASE WHEN _hold.closed = 'confirmar' THEN 'vaga-confirmada' WHEN _hold.closed = 'liberar' THEN 'reserva-cancelada'
                 WHEN _hold.expires_at <= now() THEN 'reserva-vencida' ELSE 'vaga-reservada' END;
    IF _sit = 'vaga-reservada' THEN _dl := _hold.expires_at; END IF;
  ELSE
    SELECT it INTO _item FROM jsonb_array_elements(_run.result->'items') it WHERE it->>'protocol' = _prot LIMIT 1;
    IF _item IS NOT NULL THEN
      _sit := CASE WHEN _item->>'outcome' = 'contemplado' THEN 'contemplado' ELSE 'lista-de-espera' END;
      _cell := _item->>'cellKey';
    ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(_run.result->'indeterminate') i WHERE i->>'protocol' = _prot) THEN
      _sit := 'indeterminado';
    ELSE _sit := 'nao-contemplado'; END IF;
  END IF;

  SELECT n.* INTO _n FROM public.enr_result_notices n JOIN public.enr_result_notice_approvals ap ON ap.notice_id = n.id
   WHERE n.campaign_id = _a.campaign_id AND n.situation = _sit ORDER BY n.version DESC LIMIT 1;
  RETURN QUERY SELECT CASE WHEN _n.id IS NULL THEN 'texto-nao-autorizado' ELSE 'ok' END, _sit, _cell, _dl, _n.justification_text, _n.action_text;
END $$;

REVOKE ALL ON FUNCTION public.record_enr_result_notice(uuid,text,text,text,text), public.approve_enr_result_notice(uuid,text),
  public.enr_public_application_result(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_enr_result_notice(uuid,text,text,text,text), public.approve_enr_result_notice(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enr_public_application_result(text,text) TO anon, authenticated;