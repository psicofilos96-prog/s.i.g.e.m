-- Centro de Operações L18: veículos do transporte escolar (próprio = bem do patrimônio oficial L09; contratado = contrato
-- juntado no SIGEM Documentos). Capacidade, documentação, vistoria, manutenção e disponibilidade são eventos append-only;
-- "apto" é projeção. Referências documentais ficam fora do SELECT direto.
CREATE TABLE public.ops_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL UNIQUE CHECK (plate ~ '^[A-Z0-9]{7}$'),
  ownership text NOT NULL CHECK (ownership IN ('proprio','contratado')),
  asset_id uuid UNIQUE REFERENCES public.ops_assets(id),
  contract_doc_ref uuid REFERENCES public.admin_case_events(id),
  contractor_label text,
  registered_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((ownership = 'proprio' AND asset_id IS NOT NULL AND contract_doc_ref IS NULL AND contractor_label IS NULL)
      OR (ownership = 'contratado' AND asset_id IS NULL AND contract_doc_ref IS NOT NULL AND length(btrim(coalesce(contractor_label,''))) >= 3))
);
CREATE TABLE public.ops_vehicle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.ops_vehicles(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('capacidade','documento','vistoria','manutencao','disponibilidade')),
  seats int CHECK (seats IS NULL OR seats >= 1),
  accessible_seats int CHECK (accessible_seats IS NULL OR accessible_seats >= 0),
  doc_key text CHECK (doc_key IS NULL OR doc_key ~ '^[a-z0-9-]{2,40}$'),
  valid_until date,
  inspection_result text CHECK (inspection_result IS NULL OR inspection_result IN ('aprovado','reprovado')),
  on_date date NOT NULL,
  service_order_id uuid,
  available boolean,
  doc_ref uuid REFERENCES public.admin_case_events(id),
  note text,
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, seq),
  CHECK (kind <> 'capacidade' OR (seats IS NOT NULL AND accessible_seats IS NOT NULL AND accessible_seats <= seats AND doc_ref IS NOT NULL)),
  CHECK (kind <> 'documento' OR (doc_key IS NOT NULL AND valid_until IS NOT NULL AND doc_ref IS NOT NULL)),
  CHECK (kind <> 'vistoria' OR (inspection_result IS NOT NULL AND doc_ref IS NOT NULL)),
  CHECK (kind <> 'manutencao' OR length(btrim(coalesce(note,''))) >= 10),
  CHECK (kind <> 'disponibilidade' OR (available IS NOT NULL AND length(btrim(coalesce(note,''))) >= 10))
);
GRANT SELECT (id, plate, ownership, asset_id, contractor_label, registered_by, idempotency_key, created_at) ON public.ops_vehicles TO authenticated;
GRANT SELECT (id, vehicle_id, seq, kind, seats, accessible_seats, doc_key, valid_until, inspection_result, on_date, service_order_id, available, note, actor_person, idempotency_key, created_at) ON public.ops_vehicle_events TO authenticated;
GRANT ALL ON public.ops_vehicles, public.ops_vehicle_events TO service_role;
ALTER TABLE public.ops_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_vehicle_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles network transport" ON public.ops_vehicles FOR SELECT TO authenticated USING (public.has_network_capability('gerir-frota-escolar') OR public.has_network_capability('planejar-rotas-de-transporte'));
CREATE POLICY "vehicle events network transport" ON public.ops_vehicle_events FOR SELECT TO authenticated USING (public.has_network_capability('gerir-frota-escolar') OR public.has_network_capability('planejar-rotas-de-transporte'));
CREATE TRIGGER opsveh_immutable BEFORE UPDATE OR DELETE ON public.ops_vehicles FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsvev_immutable BEFORE UPDATE OR DELETE ON public.ops_vehicle_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.ops_doc_is_attachment(_ref uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_case_events e WHERE e.id = _ref AND e.event_type = 'documento_juntado')
$$;
REVOKE ALL ON FUNCTION public.ops_doc_is_attachment(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_ops_vehicle(_plate text, _ownership text, _asset uuid, _contract_doc uuid, _contractor text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsveh:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_vehicles WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('gerir-frota-escolar') THEN RAISE EXCEPTION 'opsveh:forbidden'; END IF;
  IF _ownership = 'proprio' THEN
    IF NOT EXISTS (SELECT 1 FROM public.ops_assets WHERE id = _asset) THEN RAISE EXCEPTION 'opsveh:unknown-asset'; END IF;
    IF EXISTS (SELECT 1 FROM public.ops_asset_events WHERE asset_id = _asset AND kind = 'baixa') THEN RAISE EXCEPTION 'opsveh:asset-written-off'; END IF;
  ELSIF _ownership = 'contratado' THEN
    IF NOT public.ops_doc_is_attachment(_contract_doc) THEN RAISE EXCEPTION 'opsveh:contract-doc-required'; END IF;
  END IF;
  INSERT INTO public.ops_vehicles(plate, ownership, asset_id, contract_doc_ref, contractor_label, registered_by, idempotency_key)
  VALUES (upper(btrim(_plate)), _ownership, _asset, _contract_doc, nullif(btrim(_contractor),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsveh:invalid';
  WHEN unique_violation THEN RAISE EXCEPTION 'opsveh:duplicate';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_vehicle_event(_vehicle uuid, _expected_seq int, _kind text, _seats int, _accessible int, _doc_key text,
  _valid_until date, _result text, _on date, _service_order uuid, _available boolean, _doc uuid, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _seq int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsvev:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_vehicle_events WHERE idempotency_key = _key;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  IF _kind = 'vistoria' THEN
    IF NOT public.has_network_capability('vistoriar-veiculos-escolares') THEN RAISE EXCEPTION 'opsvev:inspect-forbidden'; END IF;
  ELSIF NOT public.has_network_capability('gerir-frota-escolar') THEN RAISE EXCEPTION 'opsvev:forbidden'; END IF;
  PERFORM 1 FROM public.ops_vehicles WHERE id = _vehicle FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'opsvev:not-found'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.ops_vehicle_events WHERE vehicle_id = _vehicle;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsvev:conflict'; END IF;
  IF _on > current_date THEN RAISE EXCEPTION 'opsvev:future-date'; END IF;
  IF _doc IS NOT NULL AND NOT public.ops_doc_is_attachment(_doc) THEN RAISE EXCEPTION 'opsvev:invalid-doc'; END IF;
  IF _kind = 'manutencao' AND _service_order IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_service_orders WHERE id = _service_order) THEN RAISE EXCEPTION 'opsvev:unknown-service-order'; END IF;
  INSERT INTO public.ops_vehicle_events(vehicle_id, seq, kind, seats, accessible_seats, doc_key, valid_until, inspection_result, on_date, service_order_id, available, doc_ref, note, actor_person, idempotency_key)
  VALUES (_vehicle, _last + 1, _kind,
    CASE WHEN _kind = 'capacidade' THEN _seats END, CASE WHEN _kind = 'capacidade' THEN _accessible END,
    CASE WHEN _kind = 'documento' THEN _doc_key END, CASE WHEN _kind = 'documento' THEN _valid_until END,
    CASE WHEN _kind = 'vistoria' THEN _result END, _on, CASE WHEN _kind = 'manutencao' THEN _service_order END,
    CASE WHEN _kind = 'disponibilidade' THEN _available END, _doc, nullif(btrim(_note),''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsvev:invalid';
END $$;

REVOKE ALL ON FUNCTION public.register_ops_vehicle(text,text,uuid,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_vehicle_event(uuid,int,text,int,int,text,date,text,date,uuid,boolean,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_ops_vehicle(text,text,uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_vehicle_event(uuid,int,text,int,int,text,date,text,date,uuid,boolean,uuid,text,text) TO authenticated;