CREATE TABLE public.enr_seat_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.enr_campaigns(id),
  cell_key text NOT NULL CHECK (cell_key ~ '^[^|]+\|[^|]+\|[^|]+$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, cell_key)
);
CREATE TABLE public.enr_seat_pool_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.enr_seat_pools(id),
  version int NOT NULL CHECK (version >= 1),
  authorized int NOT NULL CHECK (authorized >= 0),
  act_ref uuid NOT NULL REFERENCES public.admin_case_act_versions(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, version)
);
CREATE TABLE public.enr_seat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.enr_seat_pools(id),
  seq int NOT NULL CHECK (seq >= 1),
  hold_id uuid NOT NULL,
  application_id uuid NOT NULL REFERENCES public.enr_applications(id),
  kind text NOT NULL CHECK (kind IN ('reservar','confirmar','liberar')),
  proposal_id uuid REFERENCES public.enr_distribution_proposals(id),
  expires_at timestamptz,
  reason text,
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, seq),
  CHECK (kind <> 'reservar' OR (expires_at IS NOT NULL AND proposal_id IS NOT NULL)),
  CHECK (kind <> 'liberar' OR length(btrim(coalesce(reason,''))) >= 10)
);
CREATE UNIQUE INDEX enr_seat_events_one_reserve ON public.enr_seat_events(hold_id) WHERE kind = 'reservar';
CREATE UNIQUE INDEX enr_seat_events_one_close ON public.enr_seat_events(hold_id) WHERE kind IN ('confirmar','liberar');
CREATE INDEX enr_seat_events_app ON public.enr_seat_events(application_id);

GRANT SELECT ON public.enr_seat_pools, public.enr_seat_pool_versions, public.enr_seat_events TO authenticated;
GRANT ALL ON public.enr_seat_pools, public.enr_seat_pool_versions, public.enr_seat_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_seat_pools, public.enr_seat_pool_versions, public.enr_seat_events FROM authenticated, anon;
ALTER TABLE public.enr_seat_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_seat_pool_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_seat_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr seat pools read" ON public.enr_seat_pools FOR SELECT TO authenticated USING (public.has_network_capability('reservar-vagas-de-ingresso') OR public.has_network_capability('manter-quadro-de-vagas-de-ingresso'));
CREATE POLICY "enr seat versions read" ON public.enr_seat_pool_versions FOR SELECT TO authenticated USING (public.has_network_capability('reservar-vagas-de-ingresso') OR public.has_network_capability('manter-quadro-de-vagas-de-ingresso'));
CREATE POLICY "enr seat events read" ON public.enr_seat_events FOR SELECT TO authenticated USING (public.has_network_capability('reservar-vagas-de-ingresso') OR public.has_network_capability('manter-quadro-de-vagas-de-ingresso'));
CREATE TRIGGER enr_seat_pools_append_only BEFORE UPDATE OR DELETE ON public.enr_seat_pools FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_seat_versions_append_only BEFORE UPDATE OR DELETE ON public.enr_seat_pool_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_seat_events_append_only BEFORE UPDATE OR DELETE ON public.enr_seat_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.enr_seat_occupancy(_pool uuid, _at timestamptz) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*)::int FROM public.enr_seat_events r
   WHERE r.pool_id = _pool AND r.kind = 'reservar'
     AND NOT EXISTS (SELECT 1 FROM public.enr_seat_events x WHERE x.hold_id = r.hold_id AND x.kind = 'liberar')
     AND (EXISTS (SELECT 1 FROM public.enr_seat_events x WHERE x.hold_id = r.hold_id AND x.kind = 'confirmar') OR r.expires_at > _at)
$$;

CREATE OR REPLACE FUNCTION public.record_enr_seat_capacity(_campaign uuid, _cell text, _expected_version int, _authorized int, _act uuid, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _pool uuid; _v int; _occ int;
BEGIN
  SELECT version INTO _v FROM public.enr_seat_pool_versions WHERE idempotency_key = _key;
  IF _v IS NOT NULL THEN RETURN _v; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('manter-quadro-de-vagas-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_case_act_versions WHERE id = _act) THEN RAISE EXCEPTION 'ato-inexistente'; END IF;
  INSERT INTO public.enr_seat_pools(campaign_id, cell_key) VALUES (_campaign, _cell) ON CONFLICT (campaign_id, cell_key) DO NOTHING;
  SELECT id INTO _pool FROM public.enr_seat_pools WHERE campaign_id = _campaign AND cell_key = _cell FOR UPDATE;
  SELECT coalesce(max(version),0) INTO _v FROM public.enr_seat_pool_versions WHERE pool_id = _pool;
  IF _v <> _expected_version THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  _occ := public.enr_seat_occupancy(_pool, now());
  IF _authorized < _occ THEN RAISE EXCEPTION 'capacidade-abaixo-da-ocupacao'; END IF;
  INSERT INTO public.enr_seat_pool_versions(pool_id, version, authorized, act_ref, reason, person_id, idempotency_key)
  VALUES (_pool, _v + 1, _authorized, _act, btrim(_reason), _p, _key);
  RETURN _v + 1;
END $$;

CREATE OR REPLACE FUNCTION public.enr_seat_reserve(_pool uuid, _application uuid, _proposal uuid, _minutes int, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _h uuid; _camp uuid; _cap int; _occ int; _s int; _last text;
BEGIN
  SELECT hold_id INTO _h FROM public.enr_seat_events WHERE idempotency_key = _key;
  IF _h IS NOT NULL THEN RETURN _h; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('reservar-vagas-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  IF _minutes IS NULL OR _minutes < 1 OR _minutes > 43200 THEN RAISE EXCEPTION 'prazo-invalido'; END IF;
  SELECT campaign_id INTO _camp FROM public.enr_seat_pools WHERE id = _pool FOR UPDATE;
  IF _camp IS NULL THEN RAISE EXCEPTION 'quadro-inexistente'; END IF;
  PERFORM 1 FROM public.enr_applications WHERE id = _application AND campaign_id = _camp FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pedido-fora-da-campanha'; END IF;
  SELECT action INTO _last FROM public.enr_distribution_events e JOIN public.enr_distribution_proposals d ON d.id = e.proposal_id
   WHERE d.id = _proposal AND d.campaign_id = _camp ORDER BY e.seq DESC LIMIT 1;
  IF coalesce(_last,'') <> 'publicar' THEN RAISE EXCEPTION 'distribuicao-nao-publicada'; END IF;
  IF EXISTS (SELECT 1 FROM public.enr_seat_events r WHERE r.application_id = _application AND r.kind = 'reservar'
              AND NOT EXISTS (SELECT 1 FROM public.enr_seat_events x WHERE x.hold_id = r.hold_id AND x.kind = 'liberar')
              AND (EXISTS (SELECT 1 FROM public.enr_seat_events x WHERE x.hold_id = r.hold_id AND x.kind = 'confirmar') OR r.expires_at > now()))
  THEN RAISE EXCEPTION 'pedido-ja-tem-vaga'; END IF;
  SELECT authorized INTO _cap FROM public.enr_seat_pool_versions WHERE pool_id = _pool ORDER BY version DESC LIMIT 1;
  IF _cap IS NULL THEN RAISE EXCEPTION 'capacidade-nao-autorizada'; END IF;
  _occ := public.enr_seat_occupancy(_pool, now());
  IF _occ >= _cap THEN RAISE EXCEPTION 'sem-vaga'; END IF;
  SELECT coalesce(max(seq),0) INTO _s FROM public.enr_seat_events WHERE pool_id = _pool;
  _h := gen_random_uuid();
  INSERT INTO public.enr_seat_events(pool_id, seq, hold_id, application_id, kind, proposal_id, expires_at, person_id, idempotency_key)
  VALUES (_pool, _s + 1, _h, _application, 'reservar', _proposal, now() + make_interval(mins => _minutes), _p, _key);
  RETURN _h;
END $$;

CREATE OR REPLACE FUNCTION public.enr_seat_close(_hold uuid, _kind text, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.enr_seat_events; _s int; _cap int;
BEGIN
  SELECT seq INTO _s FROM public.enr_seat_events WHERE idempotency_key = _key;
  IF _s IS NOT NULL THEN RETURN _s; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF _kind NOT IN ('confirmar','liberar') THEN RAISE EXCEPTION 'acao-invalida'; END IF;
  IF NOT public.has_network_capability(CASE WHEN _kind = 'confirmar' THEN 'confirmar-vagas-de-ingresso' ELSE 'reservar-vagas-de-ingresso' END)
  THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _r FROM public.enr_seat_events WHERE hold_id = _hold AND kind = 'reservar';
  IF _r.id IS NULL THEN RAISE EXCEPTION 'reserva-inexistente'; END IF;
  PERFORM 1 FROM public.enr_seat_pools WHERE id = _r.pool_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.enr_seat_events WHERE hold_id = _hold AND kind IN ('confirmar','liberar')) THEN RAISE EXCEPTION 'reserva-encerrada'; END IF;
  IF _kind = 'confirmar' THEN
    IF _r.expires_at <= now() THEN RAISE EXCEPTION 'reserva-vencida'; END IF;
    IF _p = _r.person_id THEN RAISE EXCEPTION 'confirmador-igual-reservante'; END IF;
    SELECT authorized INTO _cap FROM public.enr_seat_pool_versions WHERE pool_id = _r.pool_id ORDER BY version DESC LIMIT 1;
    IF _cap IS NULL OR public.enr_seat_occupancy(_r.pool_id, now()) > _cap THEN RAISE EXCEPTION 'sem-vaga'; END IF;
  END IF;
  SELECT coalesce(max(seq),0) INTO _s FROM public.enr_seat_events WHERE pool_id = _r.pool_id;
  INSERT INTO public.enr_seat_events(pool_id, seq, hold_id, application_id, kind, reason, person_id, idempotency_key)
  VALUES (_r.pool_id, _s + 1, _hold, _r.application_id, _kind, nullif(btrim(coalesce(_reason,'')),''), _p, _key);
  RETURN _s + 1;
END $$;

REVOKE ALL ON FUNCTION public.enr_seat_occupancy(uuid,timestamptz), public.record_enr_seat_capacity(uuid,text,int,int,uuid,text,text),
  public.enr_seat_reserve(uuid,uuid,uuid,int,text), public.enr_seat_close(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_enr_seat_capacity(uuid,text,int,int,uuid,text,text),
  public.enr_seat_reserve(uuid,uuid,uuid,int,text), public.enr_seat_close(uuid,text,text,text) TO authenticated;