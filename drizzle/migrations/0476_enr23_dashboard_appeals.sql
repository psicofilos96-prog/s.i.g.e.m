-- Matrículas L23: painel de distribuição/ocupação calculado NA HORA dos ledgers canônicos (nada gravado) e
-- recursos/revisões/exceções como ledger append-only com decisor ≠ autor e ato obrigatório em exceção.
-- Unidades nunca se misturam: solicitações (pedidos), estudantes (distintos), reservas (vigentes) e matrículas (vínculo Secretaria).
CREATE OR REPLACE FUNCTION public.enr_ingress_dashboard(_campaign uuid)
RETURNS TABLE(cell_key text, school_key text, authorized int, reservations_active int, confirmed int, requests int, students int, enrollments int, read_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_network_capability('acompanhar-ocupacao-de-ingresso') THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.cell_key, split_part(p.cell_key,'|',1),
    (SELECT v.authorized FROM public.enr_seat_pool_versions v WHERE v.pool_id = p.id ORDER BY v.version DESC LIMIT 1),
    public.enr_seat_occupancy(p.id, now()),
    (SELECT count(*)::int FROM public.enr_seat_events e WHERE e.pool_id = p.id AND e.kind = 'confirmar'),
    (SELECT count(*)::int FROM public.enr_applications a WHERE a.campaign_id = _campaign AND a.school_preferences[1] = split_part(p.cell_key,'|',1)),
    (SELECT count(DISTINCT coalesce(a.student_cpf_hmac, lower(a.student_name) || a.student_birth_date::text))::int FROM public.enr_applications a
       WHERE a.campaign_id = _campaign AND a.school_preferences[1] = split_part(p.cell_key,'|',1)),
    (SELECT count(*)::int FROM public.enr_formalization_links f JOIN public.enr_seat_events e ON e.hold_id = f.hold_id AND e.kind = 'reservar' WHERE e.pool_id = p.id),
    now()
  FROM public.enr_seat_pools p WHERE p.campaign_id = _campaign ORDER BY p.cell_key;
END $$;

CREATE TABLE public.enr_appeal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appeal_id uuid NOT NULL,
  seq int NOT NULL CHECK (seq >= 1),
  application_id uuid NOT NULL REFERENCES public.enr_applications(id),
  kind text NOT NULL CHECK (kind IN ('recurso','revisao','excecao')),
  action text NOT NULL CHECK (action IN ('registrar','analisar','deferir','indeferir')),
  act_ref uuid REFERENCES public.admin_case_act_versions(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appeal_id, seq),
  CHECK (NOT (kind = 'excecao' AND action = 'deferir' AND act_ref IS NULL))
);
GRANT SELECT ON public.enr_appeal_events TO authenticated;
GRANT ALL ON public.enr_appeal_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_appeal_events FROM authenticated, anon, service_role;
ALTER TABLE public.enr_appeal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr appeal read" ON public.enr_appeal_events FOR SELECT TO authenticated
  USING (public.has_network_capability('analisar-recursos-de-ingresso') OR public.has_network_capability('decidir-recursos-de-ingresso'));
CREATE TRIGGER enr_appeal_append_only BEFORE UPDATE OR DELETE ON public.enr_appeal_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_enr_appeal_event(_appeal uuid, _expected_seq int, _application uuid, _kind text, _action text, _act uuid, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _prev public.enr_appeal_events; _last public.enr_appeal_events; _s int;
BEGIN
  SELECT * INTO _prev FROM public.enr_appeal_events WHERE idempotency_key = _key;
  IF _prev.id IS NOT NULL THEN RETURN _prev.seq; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('enr-appeal-' || _appeal::text));
  SELECT * INTO _last FROM public.enr_appeal_events WHERE appeal_id = _appeal ORDER BY seq DESC LIMIT 1;
  _s := coalesce(_last.seq, 0);
  IF _s <> coalesce(_expected_seq, 0) THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  IF _last.id IS NOT NULL AND (_last.application_id <> _application OR _last.kind <> _kind) THEN RAISE EXCEPTION 'pedido-divergente'; END IF;
  IF _last.action IN ('deferir','indeferir') THEN RAISE EXCEPTION 'ja-decidido'; END IF;
  IF (_last.id IS NULL) <> (_action = 'registrar') THEN RAISE EXCEPTION 'transicao-invalida'; END IF;
  IF _action IN ('registrar','analisar') AND NOT public.has_network_capability('analisar-recursos-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  IF _action IN ('deferir','indeferir') THEN
    IF NOT public.has_network_capability('decidir-recursos-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
    IF _last.action <> 'analisar' THEN RAISE EXCEPTION 'sem-analise'; END IF;
    IF EXISTS (SELECT 1 FROM public.enr_appeal_events x WHERE x.appeal_id = _appeal AND x.person_id = _p) THEN RAISE EXCEPTION 'decisor-igual-autor'; END IF;
    IF _act IS NULL THEN RAISE EXCEPTION 'sem-ato'; END IF;
  END IF;
  INSERT INTO public.enr_appeal_events(appeal_id, seq, application_id, kind, action, act_ref, reason, person_id, idempotency_key)
  VALUES (_appeal, _s + 1, _application, _kind, _action, _act, _reason, _p, _key);
  RETURN _s + 1;
END $$;
REVOKE ALL ON FUNCTION public.enr_ingress_dashboard(uuid), public.record_enr_appeal_event(uuid,int,uuid,text,text,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enr_ingress_dashboard(uuid), public.record_enr_appeal_event(uuid,int,uuid,text,text,uuid,text,text) TO authenticated;