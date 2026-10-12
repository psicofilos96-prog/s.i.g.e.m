-- Tecnologia L16: pedido de acesso a serviço do catálogo L15 (última versão aprovada, não descontinuado).
-- Beneficiário = atuação vigente; eventos append-only (seq esperado): analise → aprovacao|indeferimento → revisao(manter|revogar)|revogacao.
-- Aprovar/revogar exige 'aprovar-acessos-digitais' e pessoa ≠ solicitante e ≠ beneficiário; analisar exige 'analisar-acessos-digitais'.
-- Nunca concede capability do SIGEM: autorização interna continua só pela política homologada.
CREATE TABLE public.tech_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL,
  service_version_id uuid NOT NULL REFERENCES public.tech_digital_service_versions(id),
  beneficiary_engagement uuid NOT NULL REFERENCES public.institutional_engagements(id),
  school_id text,
  access_profile text NOT NULL CHECK (length(btrim(access_profile)) BETWEEN 2 AND 80),
  justification text NOT NULL CHECK (length(btrim(justification)) BETWEEN 10 AND 1000),
  requester_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_access_request_events (
  request_id uuid NOT NULL REFERENCES public.tech_access_requests(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('analise','aprovacao','indeferimento','revisao-manter','revogacao')),
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, seq)
);
GRANT ALL ON public.tech_access_requests, public.tech_access_request_events TO service_role;
REVOKE ALL ON public.tech_access_requests, public.tech_access_request_events FROM anon, authenticated;
GRANT SELECT ON public.tech_access_requests, public.tech_access_request_events TO authenticated;
ALTER TABLE public.tech_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_access_request_events ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.tech_access_can_read(_r uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.tech_access_requests r LEFT JOIN public.institutional_engagements e ON e.id = r.beneficiary_engagement
    WHERE r.id = _r AND (r.requester_person = public.current_person_id() OR e.person_id = public.current_person_id()
      OR public.has_network_capability('analisar-acessos-digitais') OR public.has_network_capability('aprovar-acessos-digitais')))
$$;
REVOKE ALL ON FUNCTION public.tech_access_can_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tech_access_can_read(uuid) TO authenticated;
CREATE POLICY "tech acc read" ON public.tech_access_requests FOR SELECT TO authenticated USING (public.tech_access_can_read(id));
CREATE POLICY "tech acc ev read" ON public.tech_access_request_events FOR SELECT TO authenticated USING (public.tech_access_can_read(request_id));
CREATE TRIGGER tech_acc_immutable BEFORE UPDATE OR DELETE ON public.tech_access_requests FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_acc_ev_immutable BEFORE UPDATE OR DELETE ON public.tech_access_request_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.open_tech_access_request(_service text, _engagement uuid, _profile text, _just text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _v public.tech_digital_service_versions; _e public.institutional_engagements;
BEGIN
  SELECT id INTO _id FROM public.tech_access_requests WHERE idempotency_key = _key; IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _v FROM public.tech_digital_service_versions WHERE service_key = _service ORDER BY version DESC LIMIT 1;
  IF _v.id IS NULL OR _v.status = 'descontinuado' OR NOT EXISTS (SELECT 1 FROM public.tech_digital_service_approvals a WHERE a.version_id = _v.id AND a.person_id <> _v.person_id)
  THEN RAISE EXCEPTION 'servico-nao-vigente'; END IF;
  SELECT * INTO _e FROM public.institutional_engagements WHERE id = _engagement;
  IF _e.id IS NULL OR _e.valid_from > current_date OR (_e.valid_until IS NOT NULL AND _e.valid_until < current_date) THEN RAISE EXCEPTION 'atuacao-nao-vigente'; END IF;
  -- Pede para si, ou com capacidade de solicitar por terceiros na escola da atuação.
  IF _e.person_id IS DISTINCT FROM _p AND NOT (public.has_network_capability('solicitar-acessos-digitais')
     OR (_e.school_id IS NOT NULL AND public.has_school_capability('solicitar-acessos-digitais', _e.school_id))) THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  INSERT INTO public.tech_access_requests(service_key, service_version_id, beneficiary_engagement, school_id, access_profile, justification, requester_person, idempotency_key)
  VALUES (_service, _v.id, _e.id, _e.school_id, btrim(_profile), btrim(_just), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

CREATE OR REPLACE FUNCTION public.record_tech_access_event(_req uuid, _expected int, _kind text, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.tech_access_requests; _last int; _lk text; _prev int; _benef uuid;
BEGIN
  SELECT seq INTO _prev FROM public.tech_access_request_events WHERE idempotency_key = _key; IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _r FROM public.tech_access_requests WHERE id = _req FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  SELECT person_id INTO _benef FROM public.institutional_engagements WHERE id = _r.beneficiary_engagement;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.tech_access_request_events WHERE request_id = _req;
  IF _last <> _expected THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  SELECT kind INTO _lk FROM public.tech_access_request_events WHERE request_id = _req AND seq = _last;
  IF NOT ((_lk IS NULL AND _kind = 'analise')
       OR (_lk = 'analise' AND _kind IN ('aprovacao','indeferimento'))
       OR (_lk IN ('aprovacao','revisao-manter') AND _kind IN ('revisao-manter','revogacao'))) THEN RAISE EXCEPTION 'transicao-invalida'; END IF;
  IF _kind = 'analise' AND NOT public.has_network_capability('analisar-acessos-digitais') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  IF _kind <> 'analise' THEN
    IF NOT public.has_network_capability('aprovar-acessos-digitais') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
    IF _p = _r.requester_person OR _p = _benef THEN RAISE EXCEPTION 'conflito-de-interesse'; END IF;
  END IF;
  INSERT INTO public.tech_access_request_events(request_id, seq, kind, note, person_id, idempotency_key) VALUES (_req, _last + 1, _kind, btrim(_note), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;
REVOKE ALL ON FUNCTION public.open_tech_access_request(text, uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_tech_access_event(uuid, int, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_tech_access_request(text, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tech_access_event(uuid, int, text, text, text) TO authenticated;