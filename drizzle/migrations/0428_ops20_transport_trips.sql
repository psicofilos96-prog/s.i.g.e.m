-- Centro de Operações L20: viagem planejada (rota aprovada + data + sentido), programação (escala L19 + veículo), execução
-- (realizada com horários/quilometragem OU não realizada com motivo) e ocorrência/providência são entidades distintas,
-- append-only, com autoria = pessoa da sessão. Execução só pela pessoa escalada como motorista (ou escalador para não realização).
CREATE TABLE public.ops_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_version_id uuid NOT NULL REFERENCES public.ops_route_versions(id),
  trip_date date NOT NULL,
  direction text NOT NULL CHECK (direction IN ('ida','volta')),
  planned_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_version_id, trip_date, direction)
);
CREATE TABLE public.ops_trip_programmings (
  trip_id uuid PRIMARY KEY REFERENCES public.ops_trips(id),
  driver_shift_id uuid NOT NULL REFERENCES public.ops_crew_shifts(id),
  monitor_shift_id uuid REFERENCES public.ops_crew_shifts(id),
  vehicle_id uuid NOT NULL REFERENCES public.ops_vehicles(id),
  programmed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_trip_executions (
  trip_id uuid PRIMARY KEY REFERENCES public.ops_trip_programmings(trip_id),
  outcome text NOT NULL CHECK (outcome IN ('realizada','nao-realizada')),
  started_at timestamptz,
  ended_at timestamptz,
  km_start numeric(10,1),
  km_end numeric(10,1),
  reason text,
  recorded_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (outcome <> 'realizada' OR (started_at IS NOT NULL AND ended_at > started_at AND km_start >= 0 AND km_end >= km_start AND reason IS NULL)),
  CHECK (outcome <> 'nao-realizada' OR (length(btrim(coalesce(reason,''))) >= 10 AND started_at IS NULL AND km_start IS NULL AND km_end IS NULL))
);
CREATE TABLE public.ops_trip_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.ops_trips(id),
  category text NOT NULL CHECK (category ~ '^[a-z0-9-]{2,40}$'),
  occurred_at timestamptz NOT NULL,
  description text NOT NULL CHECK (length(btrim(description)) >= 10),
  recorded_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_trip_occurrence_measures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id uuid NOT NULL REFERENCES public.ops_trip_occurrences(id),
  measure text NOT NULL CHECK (length(btrim(measure)) >= 10),
  taken_on date NOT NULL,
  recorded_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.ops_trips, public.ops_trip_programmings, public.ops_trip_executions, public.ops_trip_occurrences, public.ops_trip_occurrence_measures FROM anon, authenticated;
GRANT SELECT ON public.ops_trips, public.ops_trip_programmings, public.ops_trip_executions, public.ops_trip_occurrences, public.ops_trip_occurrence_measures TO authenticated;
GRANT ALL ON public.ops_trips, public.ops_trip_programmings, public.ops_trip_executions, public.ops_trip_occurrences, public.ops_trip_occurrence_measures TO service_role;
ALTER TABLE public.ops_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_trip_programmings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_trip_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_trip_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_trip_occurrence_measures ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.ops_trip_readable(_trip uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_network_capability('escalar-transporte') OR EXISTS (
    SELECT 1 FROM public.ops_trips t JOIN public.ops_route_version_schools s ON s.route_version_id = t.route_version_id
    WHERE t.id = _trip AND public.ops_can_read('transporte', s.school_id))
  OR EXISTS (SELECT 1 FROM public.ops_trip_programmings p JOIN public.ops_crew_shifts c ON c.id IN (p.driver_shift_id, p.monitor_shift_id)
    JOIN public.ops_crew_designations d ON d.id = c.designation_id JOIN public.institutional_engagements e ON e.id = d.engagement_id
    WHERE p.trip_id = _trip AND e.person_id = public.current_person_id())
$$;
REVOKE ALL ON FUNCTION public.ops_trip_readable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_trip_readable(uuid) TO authenticated;
CREATE POLICY "trips readable" ON public.ops_trips FOR SELECT TO authenticated USING (public.ops_trip_readable(id));
CREATE POLICY "trip programming readable" ON public.ops_trip_programmings FOR SELECT TO authenticated USING (public.ops_trip_readable(trip_id));
CREATE POLICY "trip execution readable" ON public.ops_trip_executions FOR SELECT TO authenticated USING (public.ops_trip_readable(trip_id));
CREATE POLICY "trip occurrence readable" ON public.ops_trip_occurrences FOR SELECT TO authenticated USING (public.ops_trip_readable(trip_id));
CREATE POLICY "trip measure readable" ON public.ops_trip_occurrence_measures FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_trip_occurrences o WHERE o.id = occurrence_id AND public.ops_trip_readable(o.trip_id)));
CREATE TRIGGER opstrip_immutable BEFORE UPDATE OR DELETE ON public.ops_trips FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opstripp_immutable BEFORE UPDATE OR DELETE ON public.ops_trip_programmings FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opstripe_immutable BEFORE UPDATE OR DELETE ON public.ops_trip_executions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opstripo_immutable BEFORE UPDATE OR DELETE ON public.ops_trip_occurrences FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opstripm_immutable BEFORE UPDATE OR DELETE ON public.ops_trip_occurrence_measures FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.ops_shift_person(_shift uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.person_id FROM public.ops_crew_shifts c JOIN public.ops_crew_designations d ON d.id = c.designation_id
  JOIN public.institutional_engagements e ON e.id = d.engagement_id WHERE c.id = _shift
$$;
REVOKE ALL ON FUNCTION public.ops_shift_person(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.plan_ops_trip(_route_version uuid, _date date, _direction text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opstrip:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_trips WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('escalar-transporte') THEN RAISE EXCEPTION 'opstrip:forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_route_versions v JOIN public.ops_route_approvals a ON a.route_version_id = v.id
      WHERE v.id = _route_version AND v.valid_from <= _date AND (v.valid_until IS NULL OR v.valid_until >= _date)) THEN RAISE EXCEPTION 'opstrip:route-not-approved'; END IF;
  INSERT INTO public.ops_trips(route_version_id, trip_date, direction, planned_by, idempotency_key) VALUES (_route_version, _date, _direction, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opstrip:duplicate';
  WHEN check_violation THEN RAISE EXCEPTION 'opstrip:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.program_ops_trip(_trip uuid, _driver_shift uuid, _monitor_shift uuid, _vehicle uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _t public.ops_trips;
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
  INSERT INTO public.ops_trip_programmings(trip_id, driver_shift_id, monitor_shift_id, vehicle_id, programmed_by) VALUES (_trip, _driver_shift, _monitor_shift, _vehicle, _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opstrip:already-programmed';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_trip_execution(_trip uuid, _outcome text, _start timestamptz, _end timestamptz, _km_start numeric, _km_end numeric, _reason text, _key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _pr public.ops_trip_programmings; _last numeric;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opstripx:no-person'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_trip_executions WHERE idempotency_key = _key) THEN RETURN; END IF;
  SELECT * INTO _pr FROM public.ops_trip_programmings WHERE trip_id = _trip FOR UPDATE;
  IF _pr.trip_id IS NULL THEN RAISE EXCEPTION 'opstripx:not-programmed'; END IF;
  IF _outcome = 'realizada' AND public.ops_shift_person(_pr.driver_shift_id) IS DISTINCT FROM _p THEN RAISE EXCEPTION 'opstripx:not-the-driver'; END IF;
  IF _outcome = 'nao-realizada' AND public.ops_shift_person(_pr.driver_shift_id) IS DISTINCT FROM _p AND NOT public.has_network_capability('escalar-transporte') THEN RAISE EXCEPTION 'opstripx:forbidden'; END IF;
  IF _end > now() OR _start > now() THEN RAISE EXCEPTION 'opstripx:future-time'; END IF;
  IF _outcome = 'realizada' THEN
    PERFORM 1 FROM public.ops_vehicles WHERE id = _pr.vehicle_id FOR UPDATE;
    SELECT max(x.km_end) INTO _last FROM public.ops_trip_executions x JOIN public.ops_trip_programmings p ON p.trip_id = x.trip_id
      WHERE p.vehicle_id = _pr.vehicle_id AND x.outcome = 'realizada' AND x.ended_at <= _start;
    IF _last IS NOT NULL AND _km_start < _last THEN RAISE EXCEPTION 'opstripx:odometer-regression'; END IF;
  END IF;
  INSERT INTO public.ops_trip_executions(trip_id, outcome, started_at, ended_at, km_start, km_end, reason, recorded_by, idempotency_key)
  VALUES (_trip, _outcome, _start, _end, _km_start, _km_end, nullif(btrim(_reason),''), _p, _key);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opstripx:already-recorded';
  WHEN check_violation THEN RAISE EXCEPTION 'opstripx:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_trip_occurrence(_trip uuid, _category text, _at timestamptz, _description text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _pr public.ops_trip_programmings;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsocc:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_trip_occurrences WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO _pr FROM public.ops_trip_programmings WHERE trip_id = _trip;
  IF NOT (public.has_network_capability('escalar-transporte') OR (_pr.trip_id IS NOT NULL AND _p IN (public.ops_shift_person(_pr.driver_shift_id), public.ops_shift_person(_pr.monitor_shift_id)))) THEN RAISE EXCEPTION 'opsocc:forbidden'; END IF;
  IF _at > now() THEN RAISE EXCEPTION 'opsocc:future-time'; END IF;
  INSERT INTO public.ops_trip_occurrences(trip_id, category, occurred_at, description, recorded_by, idempotency_key) VALUES (_trip, _category, _at, btrim(_description), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsocc:invalid';
  WHEN foreign_key_violation THEN RAISE EXCEPTION 'opsocc:not-found';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_trip_measure(_occ uuid, _measure text, _on date, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsocc:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_trip_occurrence_measures WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('escalar-transporte') THEN RAISE EXCEPTION 'opsocc:forbidden'; END IF;
  IF _on > current_date THEN RAISE EXCEPTION 'opsocc:future-date'; END IF;
  INSERT INTO public.ops_trip_occurrence_measures(occurrence_id, measure, taken_on, recorded_by, idempotency_key) VALUES (_occ, btrim(_measure), _on, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsocc:invalid';
  WHEN foreign_key_violation THEN RAISE EXCEPTION 'opsocc:not-found';
END $$;

REVOKE ALL ON FUNCTION public.plan_ops_trip(uuid,date,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.program_ops_trip(uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_trip_execution(uuid,text,timestamptz,timestamptz,numeric,numeric,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_trip_occurrence(uuid,text,timestamptz,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_trip_measure(uuid,text,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_ops_trip(uuid,date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.program_ops_trip(uuid,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_trip_execution(uuid,text,timestamptz,timestamptz,numeric,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_trip_occurrence(uuid,text,timestamptz,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_trip_measure(uuid,text,date,text) TO authenticated;