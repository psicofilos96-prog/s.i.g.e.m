-- Matrículas L10: cada inscrição enviada recebe UM protocolo do registro canônico (register_protocol, PROT-ano-seq); nunca numeração própria.
-- Pedido do portal não tem pessoa natural; o protocolo é registrado por pessoa da rede com 'protocolar-solicitacoes' (registered_by real).
-- Protocolo atesta recebimento: não equivale a vaga, reserva nem matrícula.
CREATE TABLE public.enr_application_protocols (
  application_id uuid PRIMARY KEY REFERENCES public.enr_applications(id),
  registration_id uuid NOT NULL UNIQUE REFERENCES public.protocol_registrations(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.enr_application_protocols TO authenticated;
GRANT ALL ON public.enr_application_protocols TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_application_protocols FROM authenticated, anon;
ALTER TABLE public.enr_application_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr app protocols read" ON public.enr_application_protocols FOR SELECT TO authenticated
  USING (public.has_network_capability('protocolar-solicitacoes') OR public.has_network_capability('registrar-identificacao-de-ingresso'));
CREATE TRIGGER enr_app_protocols_append_only BEFORE UPDATE OR DELETE ON public.enr_application_protocols FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Idempotente por pedido (chave determinística); lock por pedido evita dois protocolos concorrentes.
CREATE OR REPLACE FUNCTION public.enr_protocol_application(_application uuid)
RETURNS TABLE(protocol_number text, reused boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _a public.enr_applications; _reg uuid; _num text; _kind text; _year int; _r record;
BEGIN
  SELECT * INTO _a FROM public.enr_applications WHERE id = _application FOR UPDATE;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'inscricao-inexistente'; END IF;
  SELECT p.protocol_number INTO _num FROM public.enr_application_protocols l JOIN public.protocol_registrations p ON p.id = l.registration_id WHERE l.application_id = _application;
  IF _num IS NOT NULL THEN RETURN QUERY SELECT _num, true; RETURN; END IF;
  SELECT c.kind, c.cycle_year INTO _kind, _year FROM public.enr_campaigns c WHERE c.id = _a.campaign_id;
  -- register_protocol revalida pessoa e capacidade; origem = 1ª escola preferida (id canônico); interessado = código do pedido (sem dado pessoal).
  SELECT * INTO _r FROM public.register_protocol('digital', _a.school_preferences[1], NULL, _a.application_code,
    'Inscrição em campanha de matrícula ' || _kind || ' ' || _year, 'matriculas-inscricao', 'enr-app-' || _a.id);
  INSERT INTO public.enr_application_protocols(application_id, registration_id) VALUES (_application, _r.registration_id);
  RETURN QUERY SELECT _r.protocol_number, false;
END $$;

-- Comprovante público: código + conferência; inválido/inexistente ⇒ 'indisponivel' igual. Sem pessoa, escola ou id técnico.
CREATE OR REPLACE FUNCTION public.enr_public_application_receipt(_code text, _check text)
RETURNS TABLE(status text, protocol_number text, submitted_on date, campaign_kind text, campaign_year int, situation text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _a public.enr_applications; _num text; _k text; _y int;
BEGIN
  IF _code IS NULL OR _check IS NULL OR btrim(_code) !~ '^INS-[0-9A-F]{10}$' OR lower(btrim(_check)) !~ '^[0-9a-f]{12}$' THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text, NULL::date, NULL::text, NULL::int, NULL::text; RETURN; END IF;
  SELECT * INTO _a FROM public.enr_applications a WHERE a.application_code = btrim(_code);
  IF _a.check_hash IS NULL OR _a.check_hash <> encode(extensions.digest(lower(btrim(_check)), 'sha256'), 'hex') THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text, NULL::date, NULL::text, NULL::int, NULL::text; RETURN; END IF;
  SELECT p.protocol_number INTO _num FROM public.enr_application_protocols l JOIN public.protocol_registrations p ON p.id = l.registration_id WHERE l.application_id = _a.id;
  SELECT c.kind, c.cycle_year INTO _k, _y FROM public.enr_campaigns c WHERE c.id = _a.campaign_id;
  RETURN QUERY SELECT 'ok'::text, _num, (_a.submitted_at AT TIME ZONE 'America/Sao_Paulo')::date, _k, _y,
    CASE WHEN _num IS NULL THEN 'aguardando-protocolo' ELSE 'protocolado' END;
END $$;

REVOKE ALL ON FUNCTION public.enr_protocol_application(uuid), public.enr_public_application_receipt(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enr_protocol_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enr_public_application_receipt(text,text) TO anon, authenticated;