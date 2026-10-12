-- Centro de Operações L02: núcleo compartilhado de solicitações (transporte, infraestrutura, patrimônio).
-- Fatos append-only; estado é projeção dos eventos; escrita só pelos writers com capacidade do setor na escola.
CREATE TABLE public.ops_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector text NOT NULL CHECK (sector IN ('transporte','infraestrutura','patrimonio')),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  kind text NOT NULL CHECK (length(btrim(kind)) BETWEEN 2 AND 80),
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 5 AND 300),
  requester_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ops_requests_school_idx ON public.ops_requests(school_id, sector, created_at);

CREATE TABLE public.ops_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ops_requests(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('atribuicao','inicio','espera','conclusao','cancelamento','reabertura','vinculo-protocolo','vinculo-objeto','fim-vinculo-objeto','anexo')),
  responsible_engagement uuid REFERENCES public.institutional_engagements(id),
  protocol_ref uuid REFERENCES public.protocol_registrations(id),
  object_kind text CHECK (object_kind IS NULL OR object_kind IN ('rota','ponto','veiculo','ambiente','bem','item-almoxarifado')),
  object_ref text,
  valid_from date,
  case_event_ref uuid REFERENCES public.admin_case_events(id),
  note text CHECK (note IS NULL OR length(btrim(note)) >= 10),
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, seq),
  CHECK (kind <> 'atribuicao' OR responsible_engagement IS NOT NULL),
  CHECK (kind <> 'vinculo-protocolo' OR protocol_ref IS NOT NULL),
  CHECK (kind NOT IN ('vinculo-objeto','fim-vinculo-objeto') OR (object_kind IS NOT NULL AND object_ref IS NOT NULL AND valid_from IS NOT NULL)),
  CHECK (kind <> 'anexo' OR case_event_ref IS NOT NULL),
  CHECK (kind NOT IN ('cancelamento','reabertura','espera') OR note IS NOT NULL)
);

GRANT SELECT ON public.ops_requests, public.ops_request_events TO authenticated;
GRANT ALL ON public.ops_requests, public.ops_request_events TO service_role;
ALTER TABLE public.ops_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_request_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ops_can_read(_sector text, _school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT public.has_school_capability('acompanhar-' || _sector, _school) OR public.has_school_capability('atender-' || _sector, _school)
$$;

CREATE POLICY "ops requests by sector+school or requester" ON public.ops_requests FOR SELECT TO authenticated
  USING (requester_person = public.current_person_id() OR public.ops_can_read(sector, school_id));
CREATE POLICY "ops events follow request" ON public.ops_request_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_requests r WHERE r.id = request_id
    AND (r.requester_person = public.current_person_id() OR public.ops_can_read(r.sector, r.school_id))));
-- Referência de anexo nunca é lida direto: só pela leitura restrita do SIGEM Documentos.
REVOKE SELECT (case_event_ref) ON public.ops_request_events FROM authenticated;

CREATE TRIGGER opsr_immutable BEFORE UPDATE OR DELETE ON public.ops_requests FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opse_immutable BEFORE UPDATE OR DELETE ON public.ops_request_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.open_ops_request(_sector text, _school text, _kind text, _subject text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'ops:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_requests WHERE idempotency_key = _key AND requester_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _sector NOT IN ('transporte','infraestrutura','patrimonio') OR NOT public.has_school_capability('solicitar-' || _sector, _school) THEN
    RAISE EXCEPTION 'ops:unavailable'; END IF;
  INSERT INTO public.ops_requests(sector, school_id, kind, subject, requester_person, idempotency_key)
  VALUES (_sector, _school, btrim(_kind), btrim(_subject), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'ops:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_request_event(_request uuid, _expected_seq int, _kind text, _engagement uuid,
  _protocol uuid, _object_kind text, _object_ref text, _valid_from date, _case_event uuid, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.ops_requests; _last int; _seq int; _e public.institutional_engagements;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'ops:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_request_events WHERE idempotency_key = _key AND request_id = _request;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _r FROM public.ops_requests WHERE id = _request FOR UPDATE;
  IF _r.id IS NULL OR NOT public.has_school_capability('atender-' || _r.sector, _r.school_id) THEN RAISE EXCEPTION 'ops:unavailable'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.ops_request_events WHERE request_id = _request;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'ops:conflict'; END IF;
  IF _kind = 'atribuicao' THEN
    SELECT * INTO _e FROM public.institutional_engagements WHERE id = _engagement;
    IF _e.id IS NULL OR _e.school_id IS DISTINCT FROM _r.school_id OR _e.valid_from > current_date
       OR (_e.valid_until IS NOT NULL AND _e.valid_until < current_date) THEN RAISE EXCEPTION 'ops:responsible-not-active'; END IF;
  END IF;
  IF _valid_from IS NOT NULL AND _valid_from > current_date + 366 THEN RAISE EXCEPTION 'ops:invalid-date'; END IF;
  INSERT INTO public.ops_request_events(request_id, seq, kind, responsible_engagement, protocol_ref, object_kind, object_ref, valid_from, case_event_ref, note, actor_person, idempotency_key)
  VALUES (_request, _last + 1, _kind, _engagement, _protocol, _object_kind, nullif(btrim(_object_ref),''), _valid_from, _case_event, nullif(btrim(_note),''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'ops:invalid';
END $$;

REVOKE ALL ON FUNCTION public.open_ops_request(text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_request_event(uuid,int,text,uuid,uuid,text,text,date,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_ops_request(text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_request_event(uuid,int,text,uuid,uuid,text,text,date,uuid,text,text) TO authenticated;
