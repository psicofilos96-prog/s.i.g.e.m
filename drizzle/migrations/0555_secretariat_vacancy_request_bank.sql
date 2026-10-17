-- Banco de solicitações de vaga da escola: pedido não é matrícula nem promessa de vaga.
-- Ordem padrão = ordem de protocolo (data/hora do registro), marcada "Padrão do sistema"; estado é projeção dos eventos.
CREATE TABLE public.school_vacancy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  year_label text NOT NULL CHECK (year_label ~ '^[0-9]{4}$'),
  protocol_seq integer NOT NULL CHECK (protocol_seq >= 1),
  protocol_code text NOT NULL,
  desired_stage text NOT NULL CHECK (length(btrim(desired_stage)) BETWEEN 2 AND 80),
  desired_shift text CHECK (desired_shift IS NULL OR length(desired_shift) <= 40),
  student_name text NOT NULL CHECK (length(btrim(student_name)) BETWEEN 5 AND 200),
  student_birth_date date NOT NULL,
  guardian_name text NOT NULL CHECK (length(btrim(guardian_name)) BETWEEN 5 AND 200),
  guardian_phone text CHECK (guardian_phone IS NULL OR guardian_phone ~ '^[0-9]{10,11}$'),
  note text CHECK (note IS NULL OR length(note) <= 500),
  idempotency_key text NOT NULL UNIQUE,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, year_label, protocol_seq)
);
CREATE TABLE public.school_vacancy_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.school_vacancy_requests(id),
  seq integer NOT NULL CHECK (seq >= 1),
  action text NOT NULL CHECK (action IN ('convocar','matriculado','desistiu','nao-compareceu','cancelar','voltar-a-fila')),
  due_on date,
  note text CHECK (note IS NULL OR length(note) <= 500),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, seq)
);
GRANT SELECT ON public.school_vacancy_requests, public.school_vacancy_request_events TO authenticated;
GRANT ALL ON public.school_vacancy_requests, public.school_vacancy_request_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.school_vacancy_requests, public.school_vacancy_request_events FROM authenticated, anon, service_role;
ALTER TABLE public.school_vacancy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_vacancy_request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY svr_read ON public.school_vacancy_requests FOR SELECT TO authenticated
  USING (public.has_school_capability('manter-matricula-e-enturmacao', school_id));
CREATE POLICY svre_read ON public.school_vacancy_request_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.school_vacancy_requests r WHERE r.id = request_id AND public.has_school_capability('manter-matricula-e-enturmacao', r.school_id)));
CREATE TRIGGER svr_immutable BEFORE UPDATE OR DELETE ON public.school_vacancy_requests FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER svre_immutable BEFORE UPDATE OR DELETE ON public.school_vacancy_request_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE INDEX svr_school_year ON public.school_vacancy_requests(school_id, year_label, recorded_at);

CREATE OR REPLACE FUNCTION public.secretariat_register_vacancy_request(_year text, _stage text, _shift text, _student_name text, _birth date, _guardian_name text, _phone text, _note text, _key text)
RETURNS TABLE(id uuid, protocol_code text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s text := public.secretariat_own_school_id(); n integer; nid uuid; code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  SELECT r.id, r.protocol_code INTO nid, code FROM public.school_vacancy_requests r WHERE r.idempotency_key = _key;
  IF nid IS NOT NULL THEN RETURN QUERY SELECT nid, code; RETURN; END IF;
  IF s IS NULL THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', s) THEN RAISE EXCEPTION 'vacancy-request:capability-missing'; END IF;
  IF _birth IS NULL OR _birth > current_date THEN RAISE EXCEPTION 'vacancy-request:birth-invalid'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_vacancy_requests r WHERE r.school_id = s AND r.year_label = _year
       AND lower(btrim(r.student_name)) = lower(btrim(_student_name)) AND r.student_birth_date = _birth
       AND coalesce((SELECT e.action FROM public.school_vacancy_request_events e WHERE e.request_id = r.id ORDER BY e.seq DESC LIMIT 1),'') NOT IN ('matriculado','desistiu','nao-compareceu','cancelar'))
  THEN RAISE EXCEPTION 'vacancy-request:duplicate'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('svr:'||s||':'||_year));
  SELECT coalesce(max(r.protocol_seq),0)+1 INTO n FROM public.school_vacancy_requests r WHERE r.school_id = s AND r.year_label = _year;
  code := 'SV-'||_year||'-'||lpad(n::text,4,'0');
  INSERT INTO public.school_vacancy_requests(school_id, year_label, protocol_seq, protocol_code, desired_stage, desired_shift, student_name, student_birth_date, guardian_name, guardian_phone, note, idempotency_key, recorded_by)
  VALUES (s, _year, n, code, btrim(_stage), nullif(btrim(_shift),''), btrim(_student_name), _birth, btrim(_guardian_name), nullif(regexp_replace(coalesce(_phone,''),'\D','','g'),''), nullif(btrim(_note),''), _key, auth.uid())
  RETURNING school_vacancy_requests.id INTO nid;
  RETURN QUERY SELECT nid, code;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_register_vacancy_request(text,text,text,text,date,text,text,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_register_vacancy_request(text,text,text,text,date,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.secretariat_vacancy_request_act(_request uuid, _action text, _due date, _note text, _expected_seq integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r public.school_vacancy_requests; cur integer; last text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  SELECT * INTO r FROM public.school_vacancy_requests x WHERE x.id = _request;
  IF r.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', r.school_id) THEN RAISE EXCEPTION 'vacancy-request:capability-missing'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('svre:'||_request::text));
  SELECT coalesce(max(e.seq),0) INTO cur FROM public.school_vacancy_request_events e WHERE e.request_id = _request;
  IF cur <> coalesce(_expected_seq,0) THEN RAISE EXCEPTION 'vacancy-request:stale-base'; END IF;
  SELECT e.action INTO last FROM public.school_vacancy_request_events e WHERE e.request_id = _request ORDER BY e.seq DESC LIMIT 1;
  last := coalesce(last, 'aguardando');
  IF NOT (
       (_action = 'convocar' AND last IN ('aguardando','voltar-a-fila'))
    OR (_action IN ('matriculado','nao-compareceu') AND last = 'convocar')
    OR (_action IN ('desistiu','cancelar') AND last IN ('aguardando','voltar-a-fila','convocar'))
    OR (_action = 'voltar-a-fila' AND last IN ('convocar','nao-compareceu'))
  ) THEN RAISE EXCEPTION 'vacancy-request:transition-invalid'; END IF;
  IF _action = 'convocar' AND (_due IS NULL OR _due < current_date) THEN RAISE EXCEPTION 'vacancy-request:due-invalid'; END IF;
  IF _action IN ('cancelar','voltar-a-fila') AND length(btrim(coalesce(_note,''))) < 5 THEN RAISE EXCEPTION 'vacancy-request:reason-required'; END IF;
  INSERT INTO public.school_vacancy_request_events(request_id, seq, action, due_on, note, recorded_by)
  VALUES (_request, cur+1, _action, CASE WHEN _action='convocar' THEN _due END, nullif(btrim(_note),''), auth.uid());
  RETURN cur+1;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_vacancy_request_act(uuid,text,date,text,integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_vacancy_request_act(uuid,text,date,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.secretariat_own_vacancy_requests(_year text)
RETURNS TABLE(id uuid, protocol_code text, protocol_seq integer, desired_stage text, desired_shift text, student_name text, student_birth_date date,
  guardian_name text, guardian_phone text, note text, recorded_at timestamptz, last_seq integer, last_action text, due_on date, last_note text, last_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s text := public.secretariat_own_school_id();
BEGIN
  IF s IS NULL THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', s) THEN RAISE EXCEPTION 'vacancy-request:capability-missing'; END IF;
  RETURN QUERY SELECT r.id, r.protocol_code, r.protocol_seq, r.desired_stage, r.desired_shift, r.student_name, r.student_birth_date, r.guardian_name, r.guardian_phone, r.note, r.recorded_at,
      coalesce(e.seq,0), e.action, e.due_on, e.note, e.recorded_at
    FROM public.school_vacancy_requests r
    LEFT JOIN LATERAL (SELECT x.seq, x.action, x.due_on, x.note, x.recorded_at FROM public.school_vacancy_request_events x WHERE x.request_id = r.id ORDER BY x.seq DESC LIMIT 1) e ON true
    WHERE r.school_id = s AND r.year_label = _year
    ORDER BY r.recorded_at, r.protocol_seq;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_own_vacancy_requests(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_own_vacancy_requests(text) TO authenticated;