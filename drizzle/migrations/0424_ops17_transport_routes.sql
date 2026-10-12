-- Centro de Operações L17: versões temporais de rota (itinerário ordenado de pontos canônicos, turno, escolas, capacidade com
-- fonte, horários), avaliação de segurança de ponto por pessoa e aprovação por pessoa ≠ autor exigindo pontos avaliados seguros.
-- Simulação é pura (sem escrita). Nenhuma tabela liga estudante a horário: rotina individual de menor não é exposta.
CREATE TABLE public.ops_stop_safety_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_logical_id uuid NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  result text NOT NULL CHECK (result IN ('seguro','inseguro')),
  assessed_on date NOT NULL,
  findings text NOT NULL CHECK (length(btrim(findings)) >= 10),
  assessor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_route_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_logical_id uuid NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  shift_label text NOT NULL CHECK (length(btrim(shift_label)) BETWEEN 1 AND 60),
  capacity int CHECK (capacity IS NULL OR capacity >= 1),
  capacity_source text,
  valid_from date NOT NULL,
  valid_until date,
  reason text,
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_logical_id, version),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK ((capacity IS NULL) = (capacity_source IS NULL)),
  CHECK (version = 1 OR length(btrim(coalesce(reason,''))) >= 10)
);
CREATE TABLE public.ops_route_version_schools (
  route_version_id uuid NOT NULL REFERENCES public.ops_route_versions(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  PRIMARY KEY (route_version_id, school_id)
);
CREATE TABLE public.ops_route_itinerary (
  route_version_id uuid NOT NULL REFERENCES public.ops_route_versions(id),
  ord int NOT NULL CHECK (ord >= 1),
  stop_logical_id uuid NOT NULL,
  scheduled_time time NOT NULL,
  PRIMARY KEY (route_version_id, ord),
  UNIQUE (route_version_id, stop_logical_id)
);
CREATE TABLE public.ops_route_approvals (
  route_version_id uuid PRIMARY KEY REFERENCES public.ops_route_versions(id),
  approver_person uuid NOT NULL,
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  approved_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ops_stop_safety_assessments, public.ops_route_versions, public.ops_route_version_schools, public.ops_route_itinerary, public.ops_route_approvals TO authenticated;
GRANT ALL ON public.ops_stop_safety_assessments, public.ops_route_versions, public.ops_route_version_schools, public.ops_route_itinerary, public.ops_route_approvals TO service_role;
ALTER TABLE public.ops_stop_safety_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_route_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_route_version_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_route_itinerary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_route_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stop safety by school" ON public.ops_stop_safety_assessments FOR SELECT TO authenticated USING (public.ops_can_read('transporte', school_id));
CREATE POLICY "route versions by school" ON public.ops_route_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_route_version_schools s WHERE s.route_version_id = id AND public.ops_can_read('transporte', s.school_id)));
CREATE POLICY "route schools by school" ON public.ops_route_version_schools FOR SELECT TO authenticated USING (public.ops_can_read('transporte', school_id));
CREATE POLICY "route itinerary by school" ON public.ops_route_itinerary FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_route_version_schools s WHERE s.route_version_id = ops_route_itinerary.route_version_id AND public.ops_can_read('transporte', s.school_id)));
CREATE POLICY "route approvals by school" ON public.ops_route_approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_route_version_schools s WHERE s.route_version_id = ops_route_approvals.route_version_id AND public.ops_can_read('transporte', s.school_id)));
CREATE TRIGGER opsssa_immutable BEFORE UPDATE OR DELETE ON public.ops_stop_safety_assessments FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsrv_immutable BEFORE UPDATE OR DELETE ON public.ops_route_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsrvs_immutable BEFORE UPDATE OR DELETE ON public.ops_route_version_schools FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsri_immutable BEFORE UPDATE OR DELETE ON public.ops_route_itinerary FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsra_immutable BEFORE UPDATE OR DELETE ON public.ops_route_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.assess_ops_stop_safety(_stop uuid, _school text, _result text, _on date, _findings text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsstop:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_stop_safety_assessments WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_school_capability('avaliar-pontos-de-transporte', _school) THEN RAISE EXCEPTION 'opsstop:forbidden'; END IF;
  IF _on > current_date THEN RAISE EXCEPTION 'opsstop:future-date'; END IF;
  IF NOT public.ops_stop_active_on(_stop, _school, _on) THEN RAISE EXCEPTION 'opsstop:invalid-stop'; END IF;
  INSERT INTO public.ops_stop_safety_assessments(stop_logical_id, school_id, result, assessed_on, findings, assessor_person, idempotency_key)
  VALUES (_stop, _school, _result, _on, btrim(_findings), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsstop:invalid';
END $$;

-- _itinerary: [{"stop":"<uuid>","time":"06:40"}, ...] na ordem de percurso.
CREATE OR REPLACE FUNCTION public.record_ops_route_version(_route uuid, _expected_version int, _shift text, _capacity int, _capacity_source text,
  _from date, _until date, _schools text[], _itinerary jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid; _s text; _i int := 0; _e jsonb; _prev time;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsroute:no-person'; END IF;
  IF NOT public.has_network_capability('planejar-rotas-de-transporte') THEN RAISE EXCEPTION 'opsroute:forbidden'; END IF;
  IF coalesce(array_length(_schools,1),0) = 0 THEN RAISE EXCEPTION 'opsroute:no-school'; END IF;
  IF jsonb_typeof(_itinerary) <> 'array' OR jsonb_array_length(_itinerary) < 1 THEN RAISE EXCEPTION 'opsroute:no-itinerary'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_transport_facts f WHERE f.kind = 'rota' AND f.logical_id = _route AND f.school_id = ANY(_schools)
      AND f.version = (SELECT max(version) FROM public.school_transport_facts g WHERE g.logical_id = _route) AND NOT f.revoked) THEN RAISE EXCEPTION 'opsroute:unknown-route'; END IF;
  PERFORM 1 FROM public.ops_route_versions WHERE route_logical_id = _route FOR UPDATE;
  SELECT coalesce(max(version),0) INTO _last FROM public.ops_route_versions WHERE route_logical_id = _route;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'opsroute:conflict'; END IF;
  IF _last > 0 AND _from < (SELECT valid_from FROM public.ops_route_versions WHERE route_logical_id = _route AND version = _last) THEN RAISE EXCEPTION 'opsroute:retroactive'; END IF;
  INSERT INTO public.ops_route_versions(route_logical_id, version, shift_label, capacity, capacity_source, valid_from, valid_until, reason, author_person)
  VALUES (_route, _last + 1, btrim(_shift), _capacity, nullif(btrim(_capacity_source),''), _from, _until, nullif(btrim(_reason),''), _p) RETURNING id INTO _id;
  FOREACH _s IN ARRAY _schools LOOP
    IF NOT EXISTS (SELECT 1 FROM public.institutional_schools WHERE id = _s) THEN RAISE EXCEPTION 'opsroute:unknown-school'; END IF;
    INSERT INTO public.ops_route_version_schools VALUES (_id, _s);
  END LOOP;
  FOR _e IN SELECT value FROM jsonb_array_elements(_itinerary) LOOP
    _i := _i + 1;
    IF NOT EXISTS (SELECT 1 FROM unnest(_schools) sc WHERE public.ops_stop_active_on((_e->>'stop')::uuid, sc, _from)) THEN RAISE EXCEPTION 'opsroute:invalid-stop'; END IF;
    IF _prev IS NOT NULL AND (_e->>'time')::time <= _prev THEN RAISE EXCEPTION 'opsroute:time-order'; END IF;
    _prev := (_e->>'time')::time;
    INSERT INTO public.ops_route_itinerary VALUES (_id, _i, (_e->>'stop')::uuid, _prev);
  END LOOP;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsroute:invalid';
  WHEN unique_violation THEN RAISE EXCEPTION 'opsroute:duplicate-stop';
END $$;

CREATE OR REPLACE FUNCTION public.approve_ops_route_version(_rv uuid, _decision_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.ops_route_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsroute:no-person'; END IF;
  IF NOT public.has_network_capability('aprovar-rotas-de-transporte') THEN RAISE EXCEPTION 'opsroute:approve-forbidden'; END IF;
  SELECT * INTO _v FROM public.ops_route_versions WHERE id = _rv;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'opsroute:not-found'; END IF;
  IF _v.author_person = _p THEN RAISE EXCEPTION 'opsroute:self-approval'; END IF;
  IF _v.capacity IS NULL THEN RAISE EXCEPTION 'opsroute:capacity-unknown'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_route_itinerary i WHERE i.route_version_id = _rv AND coalesce((SELECT a.result FROM public.ops_stop_safety_assessments a
      WHERE a.stop_logical_id = i.stop_logical_id ORDER BY a.assessed_on DESC, a.created_at DESC LIMIT 1), 'nao-avaliado') <> 'seguro') THEN RAISE EXCEPTION 'opsroute:unsafe-stop'; END IF;
  INSERT INTO public.ops_route_approvals(route_version_id, approver_person, decision_ref) VALUES (_rv, _p, btrim(_decision_ref));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsroute:already-approved';
  WHEN check_violation THEN RAISE EXCEPTION 'opsroute:invalid';
END $$;

REVOKE ALL ON FUNCTION public.assess_ops_stop_safety(uuid,text,text,date,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_route_version(uuid,int,text,int,text,date,date,text[],jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_ops_route_version(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assess_ops_stop_safety(uuid,text,text,date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_route_version(uuid,int,text,int,text,date,date,text[],jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ops_route_version(uuid,text) TO authenticated;