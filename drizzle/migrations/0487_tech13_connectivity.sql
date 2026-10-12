-- Tecnologia L13: conectividade por escola. Link = vínculo escola×provedor com contrato só como juntada do SIGEM
-- Documentos (coluna oculta); medição append-only com método e fonte; verificação por pessoa ≠ quem registrou.
CREATE TABLE public.tech_connectivity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  provider_name text NOT NULL CHECK (length(btrim(provider_name)) >= 2),
  contracted_down_mbps numeric CHECK (contracted_down_mbps > 0),
  contracted_up_mbps numeric CHECK (contracted_up_mbps > 0),
  contract_ref uuid REFERENCES public.admin_case_events(id),
  valid_from date NOT NULL,
  valid_until date,
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK (contract_ref IS NOT NULL OR (contracted_down_mbps IS NULL AND contracted_up_mbps IS NULL))
);
GRANT ALL ON public.tech_connectivity_links TO service_role;
REVOKE ALL ON public.tech_connectivity_links FROM anon, authenticated;
GRANT SELECT (id, school_id, provider_name, contracted_down_mbps, contracted_up_mbps, valid_from, valid_until, person_id, created_at) ON public.tech_connectivity_links TO authenticated;
ALTER TABLE public.tech_connectivity_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech link read" ON public.tech_connectivity_links FOR SELECT TO authenticated USING (public.tech_can_read(school_id));
CREATE TRIGGER tech_link_immutable BEFORE UPDATE OR DELETE ON public.tech_connectivity_links FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE TABLE public.tech_connectivity_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.tech_connectivity_links(id),
  measured_at timestamptz NOT NULL,
  method text NOT NULL CHECK (method IN ('teste-de-velocidade','painel-do-provedor','monitoramento','relatorio-do-provedor')),
  down_mbps numeric CHECK (down_mbps >= 0),
  up_mbps numeric CHECK (up_mbps >= 0),
  latency_ms numeric CHECK (latency_ms >= 0),
  available boolean,
  evidence_ref uuid REFERENCES public.admin_case_events(id),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (down_mbps IS NOT NULL OR up_mbps IS NOT NULL OR latency_ms IS NOT NULL OR available IS NOT NULL)
);
GRANT ALL ON public.tech_connectivity_measurements TO service_role;
REVOKE ALL ON public.tech_connectivity_measurements FROM anon, authenticated;
GRANT SELECT (id, link_id, measured_at, method, down_mbps, up_mbps, latency_ms, available, person_id, created_at) ON public.tech_connectivity_measurements TO authenticated;
ALTER TABLE public.tech_connectivity_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech meas read" ON public.tech_connectivity_measurements FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tech_connectivity_links l WHERE l.id = link_id AND public.tech_can_read(l.school_id)));
CREATE TRIGGER tech_meas_immutable BEFORE UPDATE OR DELETE ON public.tech_connectivity_measurements FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE TABLE public.tech_connectivity_verifications (
  measurement_id uuid PRIMARY KEY REFERENCES public.tech_connectivity_measurements(id),
  verdict text NOT NULL CHECK (verdict IN ('confirmada','recusada')),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (verdict = 'confirmada' OR reason IS NOT NULL)
);
GRANT ALL ON public.tech_connectivity_verifications TO service_role;
REVOKE ALL ON public.tech_connectivity_verifications FROM anon, authenticated;
GRANT SELECT ON public.tech_connectivity_verifications TO authenticated;
ALTER TABLE public.tech_connectivity_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech verif read" ON public.tech_connectivity_verifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tech_connectivity_measurements m JOIN public.tech_connectivity_links l ON l.id = m.link_id WHERE m.id = measurement_id AND public.tech_can_read(l.school_id)));
CREATE TRIGGER tech_verif_immutable BEFORE UPDATE OR DELETE ON public.tech_connectivity_verifications FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.register_tech_connectivity_link(_school text, _provider text, _down numeric, _up numeric, _contract uuid, _from date, _until date, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  SELECT id INTO _id FROM public.tech_connectivity_links WHERE idempotency_key = _key; IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT (public.has_network_capability('registrar-conectividade') OR public.has_school_capability('registrar-conectividade', _school)) THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  IF _contract IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.admin_case_events WHERE id = _contract AND event_type = 'documento_juntado') THEN RAISE EXCEPTION 'contrato-nao-juntado'; END IF;
  INSERT INTO public.tech_connectivity_links(school_id, provider_name, contracted_down_mbps, contracted_up_mbps, contract_ref, valid_from, valid_until, person_id, idempotency_key)
  VALUES (_school, btrim(_provider), _down, _up, _contract, _from, _until, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

CREATE OR REPLACE FUNCTION public.record_tech_connectivity_measurement(_link uuid, _at timestamptz, _method text, _down numeric, _up numeric, _lat numeric, _avail boolean, _evidence uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _l public.tech_connectivity_links; _id uuid;
BEGIN
  SELECT id INTO _id FROM public.tech_connectivity_measurements WHERE idempotency_key = _key; IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _l FROM public.tech_connectivity_links WHERE id = _link;
  IF _l.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF NOT (public.has_network_capability('registrar-conectividade') OR public.has_school_capability('registrar-conectividade', _l.school_id)) THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  IF _at > now() + interval '5 minutes' OR _at::date < _l.valid_from OR (_l.valid_until IS NOT NULL AND _at::date > _l.valid_until) THEN RAISE EXCEPTION 'fora-da-vigencia'; END IF;
  IF _evidence IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.admin_case_events WHERE id = _evidence AND event_type = 'documento_juntado') THEN RAISE EXCEPTION 'evidencia-nao-juntada'; END IF;
  INSERT INTO public.tech_connectivity_measurements(link_id, measured_at, method, down_mbps, up_mbps, latency_ms, available, evidence_ref, person_id, idempotency_key)
  VALUES (_link, _at, _method, _down, _up, _lat, _avail, _evidence, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

CREATE OR REPLACE FUNCTION public.verify_tech_connectivity_measurement(_m uuid, _verdict text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _row public.tech_connectivity_measurements; _school text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _row FROM public.tech_connectivity_measurements WHERE id = _m FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  SELECT school_id INTO _school FROM public.tech_connectivity_links WHERE id = _row.link_id;
  IF NOT (public.has_network_capability('verificar-medicoes-de-conectividade') OR public.has_school_capability('verificar-medicoes-de-conectividade', _school)) THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  IF _row.person_id = _p THEN RAISE EXCEPTION 'autoverificacao'; END IF;
  IF EXISTS (SELECT 1 FROM public.tech_connectivity_verifications WHERE measurement_id = _m) THEN RAISE EXCEPTION 'ja-verificada'; END IF;
  INSERT INTO public.tech_connectivity_verifications(measurement_id, verdict, reason, person_id) VALUES (_m, _verdict, _reason, _p);
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

REVOKE ALL ON FUNCTION public.register_tech_connectivity_link(text, text, numeric, numeric, uuid, date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_tech_connectivity_measurement(uuid, timestamptz, text, numeric, numeric, numeric, boolean, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_tech_connectivity_measurement(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_tech_connectivity_link(text, text, numeric, numeric, uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tech_connectivity_measurement(uuid, timestamptz, text, numeric, numeric, numeric, boolean, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_tech_connectivity_measurement(uuid, text, text) TO authenticated;