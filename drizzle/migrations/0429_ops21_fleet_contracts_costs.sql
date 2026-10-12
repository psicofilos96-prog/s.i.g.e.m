-- Centro de Operações L21: contratos e prestadores de transporte (contrato = documento juntado; valores só por referência ao
-- sistema oficial + comprovante), medições com conferência por pessoa ≠ medidor e snapshot das viagens realizadas, e trava de
-- uso: programar viagem com veículo indisponível ou sem disponibilidade informada exige validação de outra pessoa competente.
CREATE TABLE public.ops_transport_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_doc_ref uuid NOT NULL UNIQUE REFERENCES public.admin_case_events(id),
  provider_label text NOT NULL CHECK (length(btrim(provider_label)) >= 3),
  official_contract_ref text NOT NULL CHECK (length(btrim(official_contract_ref)) >= 3),
  valid_from date NOT NULL,
  valid_until date NOT NULL,
  registered_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until >= valid_from)
);
CREATE TABLE public.ops_transport_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.ops_transport_contracts(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  trips_realized int NOT NULL,
  trips_not_realized int NOT NULL,
  km_realized numeric(12,1) NOT NULL,
  measurement_doc_ref uuid NOT NULL REFERENCES public.admin_case_events(id),
  measured_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  UNIQUE (contract_id, period_start, period_end)
);
CREATE TABLE public.ops_transport_measurement_conferences (
  measurement_id uuid PRIMARY KEY REFERENCES public.ops_transport_measurements(id),
  result text NOT NULL CHECK (result IN ('conferida','divergente')),
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  conferred_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_transport_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES public.ops_transport_measurements(id),
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  official_system_ref text NOT NULL CHECK (length(btrim(official_system_ref)) >= 3),
  receipt_doc_ref uuid NOT NULL REFERENCES public.admin_case_events(id),
  recorded_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_vehicle_use_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.ops_vehicles(id),
  trip_id uuid NOT NULL UNIQUE REFERENCES public.ops_trips(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  validated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.ops_transport_contracts, public.ops_transport_measurements, public.ops_transport_measurement_conferences, public.ops_transport_costs, public.ops_vehicle_use_validations FROM anon, authenticated;
GRANT SELECT (id, provider_label, official_contract_ref, valid_from, valid_until, registered_by, idempotency_key, created_at) ON public.ops_transport_contracts TO authenticated;
GRANT SELECT (id, contract_id, period_start, period_end, trips_realized, trips_not_realized, km_realized, measured_by, idempotency_key, created_at) ON public.ops_transport_measurements TO authenticated;
GRANT SELECT ON public.ops_transport_measurement_conferences, public.ops_vehicle_use_validations TO authenticated;
GRANT SELECT (id, measurement_id, amount_cents, official_system_ref, recorded_by, idempotency_key, created_at) ON public.ops_transport_costs TO authenticated;
GRANT ALL ON public.ops_transport_contracts, public.ops_transport_measurements, public.ops_transport_measurement_conferences, public.ops_transport_costs, public.ops_vehicle_use_validations TO service_role;
ALTER TABLE public.ops_transport_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_transport_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_transport_measurement_conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_transport_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_vehicle_use_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts fleet" ON public.ops_transport_contracts FOR SELECT TO authenticated USING (public.has_network_capability('gerir-frota-escolar') OR public.has_network_capability('medir-contratos-de-transporte'));
CREATE POLICY "measurements fleet" ON public.ops_transport_measurements FOR SELECT TO authenticated USING (public.has_network_capability('gerir-frota-escolar') OR public.has_network_capability('medir-contratos-de-transporte'));
CREATE POLICY "conferences fleet" ON public.ops_transport_measurement_conferences FOR SELECT TO authenticated USING (public.has_network_capability('gerir-frota-escolar') OR public.has_network_capability('medir-contratos-de-transporte'));
CREATE POLICY "costs fleet" ON public.ops_transport_costs FOR SELECT TO authenticated USING (public.has_network_capability('gerir-frota-escolar') OR public.has_network_capability('medir-contratos-de-transporte'));
CREATE POLICY "use validations" ON public.ops_vehicle_use_validations FOR SELECT TO authenticated USING (public.ops_trip_readable(trip_id));
CREATE TRIGGER opstc_immutable BEFORE UPDATE OR DELETE ON public.ops_transport_contracts FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opstm_immutable BEFORE UPDATE OR DELETE ON public.ops_transport_measurements FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opstmc_immutable BEFORE UPDATE OR DELETE ON public.ops_transport_measurement_conferences FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opstco_immutable BEFORE UPDATE OR DELETE ON public.ops_transport_costs FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsvuv_immutable BEFORE UPDATE OR DELETE ON public.ops_vehicle_use_validations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Disponível = último evento de disponibilidade até a data é "disponível". Sem evento ⇒ não disponível (fail-closed).
CREATE OR REPLACE FUNCTION public.ops_vehicle_available_on(_v uuid, _on date) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT available FROM public.ops_vehicle_events WHERE vehicle_id = _v AND kind = 'disponibilidade' AND on_date <= _on ORDER BY on_date DESC, seq DESC LIMIT 1), false)
$$;
REVOKE ALL ON FUNCTION public.ops_vehicle_available_on(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_vehicle_available_on(uuid,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_ops_vehicle_use(_trip uuid, _vehicle uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsuse:no-person'; END IF;
  IF NOT public.has_network_capability('validar-uso-de-veiculo') THEN RAISE EXCEPTION 'opsuse:forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_vehicle_events WHERE vehicle_id = _vehicle AND kind = 'vistoria' AND inspection_result = 'reprovado'
      AND seq = (SELECT max(seq) FROM public.ops_vehicle_events WHERE vehicle_id = _vehicle AND kind = 'vistoria')) THEN RAISE EXCEPTION 'opsuse:inspection-failed'; END IF;
  INSERT INTO public.ops_vehicle_use_validations(vehicle_id, trip_id, reason, validated_by) VALUES (_vehicle, _trip, btrim(_reason), _p) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsuse:already-validated';
  WHEN check_violation THEN RAISE EXCEPTION 'opsuse:invalid';
  WHEN foreign_key_violation THEN RAISE EXCEPTION 'opsuse:not-found';
END $$;

CREATE OR REPLACE FUNCTION public.program_ops_trip(_trip uuid, _driver_shift uuid, _monitor_shift uuid, _vehicle uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _t public.ops_trips; _val public.ops_vehicle_use_validations;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opstrip:no-person'; END IF;
  IF NOT public.has_network_capability('escalar-transporte') THEN RAISE EXCEPTION 'opstrip:forbidden'; END IF;
  SELECT * INTO _t FROM public.ops_trips WHERE id = _trip FOR UPDATE;
  IF _t.id IS NULL THEN RAISE EXCEPTION 'opstrip:not-found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_crew_shifts c JOIN public.ops_crew_designations d ON d.id = c.designation_id
      WHERE c.id = _driver_shift AND c.route_version_id = _t.route_version_id AND c.on_date = _t.trip_date AND d.role = 'motorista') THEN RAISE EXCEPTION 'opstrip:driver-not-scheduled'; END IF;
  IF _monitor_shift IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_crew_shifts c JOIN public.ops_crew_designations d ON d.id = c.designation_id
      WHERE c.id = _monitor_shift AND c.route_version_id = _t.route_version_id AND c.on_date = _t.trip_date AND d.role = 'monitor') THEN RAISE EXCEPTION 'opstrip:monitor-not-scheduled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_vehicles WHERE id = _vehicle) THEN RAISE EXCEPTION 'opstrip:unknown-vehicle'; END IF;
  IF NOT public.ops_vehicle_available_on(_vehicle, _t.trip_date) THEN
    SELECT * INTO _val FROM public.ops_vehicle_use_validations WHERE trip_id = _trip AND vehicle_id = _vehicle;
    IF _val.id IS NULL THEN RAISE EXCEPTION 'opstrip:vehicle-unavailable'; END IF;
    IF _val.validated_by = _p THEN RAISE EXCEPTION 'opstrip:self-validated-use'; END IF;
  END IF;
  INSERT INTO public.ops_trip_programmings(trip_id, driver_shift_id, monitor_shift_id, vehicle_id, programmed_by) VALUES (_trip, _driver_shift, _monitor_shift, _vehicle, _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opstrip:already-programmed';
END $$;

CREATE OR REPLACE FUNCTION public.register_ops_transport_contract(_doc uuid, _provider text, _official_ref text, _from date, _until date, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsctr:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_transport_contracts WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('gerir-frota-escolar') THEN RAISE EXCEPTION 'opsctr:forbidden'; END IF;
  IF NOT public.ops_doc_is_attachment(_doc) THEN RAISE EXCEPTION 'opsctr:contract-doc-required'; END IF;
  INSERT INTO public.ops_transport_contracts(contract_doc_ref, provider_label, official_contract_ref, valid_from, valid_until, registered_by, idempotency_key)
  VALUES (_doc, btrim(_provider), btrim(_official_ref), _from, _until, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsctr:duplicate';
  WHEN check_violation THEN RAISE EXCEPTION 'opsctr:invalid';
END $$;

-- Medição: contagens e km vêm das execuções registradas (L20) dos veículos ligados ao contrato no período; nunca digitadas.
CREATE OR REPLACE FUNCTION public.record_ops_transport_measurement(_contract uuid, _start date, _end date, _doc uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _c public.ops_transport_contracts; _r int; _n int; _km numeric;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsmeas:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_transport_measurements WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('medir-contratos-de-transporte') THEN RAISE EXCEPTION 'opsmeas:forbidden'; END IF;
  SELECT * INTO _c FROM public.ops_transport_contracts WHERE id = _contract;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'opsmeas:not-found'; END IF;
  IF _start < _c.valid_from OR _end > _c.valid_until THEN RAISE EXCEPTION 'opsmeas:outside-contract'; END IF;
  IF _end >= current_date THEN RAISE EXCEPTION 'opsmeas:period-not-closed'; END IF;
  IF NOT public.ops_doc_is_attachment(_doc) THEN RAISE EXCEPTION 'opsmeas:doc-required'; END IF;
  SELECT count(*) FILTER (WHERE x.outcome = 'realizada'), count(*) FILTER (WHERE x.outcome = 'nao-realizada'), coalesce(sum(x.km_end - x.km_start) FILTER (WHERE x.outcome = 'realizada'), 0)
    INTO _r, _n, _km
    FROM public.ops_trip_executions x JOIN public.ops_trip_programmings pr ON pr.trip_id = x.trip_id JOIN public.ops_trips t ON t.id = x.trip_id
    JOIN public.ops_vehicles v ON v.id = pr.vehicle_id
    WHERE v.contract_doc_ref = _c.contract_doc_ref AND t.trip_date BETWEEN _start AND _end;
  INSERT INTO public.ops_transport_measurements(contract_id, period_start, period_end, trips_realized, trips_not_realized, km_realized, measurement_doc_ref, measured_by, idempotency_key)
  VALUES (_contract, _start, _end, _r, _n, _km, _doc, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsmeas:duplicate-period';
  WHEN check_violation THEN RAISE EXCEPTION 'opsmeas:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.confer_ops_transport_measurement(_m uuid, _result text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _by uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsmeas:no-person'; END IF;
  IF NOT public.has_network_capability('conferir-medicoes-de-transporte') THEN RAISE EXCEPTION 'opsmeas:confer-forbidden'; END IF;
  SELECT measured_by INTO _by FROM public.ops_transport_measurements WHERE id = _m;
  IF _by IS NULL THEN RAISE EXCEPTION 'opsmeas:not-found'; END IF;
  IF _by = _p THEN RAISE EXCEPTION 'opsmeas:self-conference'; END IF;
  INSERT INTO public.ops_transport_measurement_conferences(measurement_id, result, note, conferred_by) VALUES (_m, _result, btrim(_note), _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsmeas:already-conferred';
  WHEN check_violation THEN RAISE EXCEPTION 'opsmeas:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_transport_cost(_m uuid, _cents bigint, _official_ref text, _receipt uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opscost:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_transport_costs WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('registrar-custos-de-transporte') THEN RAISE EXCEPTION 'opscost:forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_transport_measurement_conferences WHERE measurement_id = _m AND result = 'conferida') THEN RAISE EXCEPTION 'opscost:measurement-not-conferred'; END IF;
  IF NOT public.ops_doc_is_attachment(_receipt) THEN RAISE EXCEPTION 'opscost:receipt-required'; END IF;
  INSERT INTO public.ops_transport_costs(measurement_id, amount_cents, official_system_ref, receipt_doc_ref, recorded_by, idempotency_key)
  VALUES (_m, _cents, btrim(_official_ref), _receipt, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opscost:invalid';
END $$;

REVOKE ALL ON FUNCTION public.validate_ops_vehicle_use(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_ops_transport_contract(uuid,text,text,date,date,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_transport_measurement(uuid,date,date,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confer_ops_transport_measurement(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_transport_cost(uuid,bigint,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_ops_vehicle_use(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_ops_transport_contract(uuid,text,text,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_transport_measurement(uuid,date,date,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confer_ops_transport_measurement(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_transport_cost(uuid,bigint,text,uuid,text) TO authenticated;