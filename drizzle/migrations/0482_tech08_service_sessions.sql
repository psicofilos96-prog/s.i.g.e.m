-- Tecnologia L08: atendimento presencial/remoto = sessão append-only do chamado, registrada só pela pessoa da
-- atuação responsável vigente (último 'atribuicao'), com período, modo, resultado e evidência opcional (juntada).
-- Retificação = nova linha que cita a anterior com motivo. Nunca altera o estado do chamado.
CREATE TABLE public.tech_service_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ops_requests(id),
  seq int NOT NULL CHECK (seq >= 1),
  mode text NOT NULL CHECK (mode IN ('presencial','remoto')),
  space_id uuid REFERENCES public.ops_spaces(id),
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  result text NOT NULL CHECK (result IN ('resolvido','parcial','nao-resolvido','nao-realizado')),
  summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 10 AND 2000),
  evidence_ref uuid REFERENCES public.admin_case_events(id),
  engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  rectifies uuid REFERENCES public.tech_service_sessions(id),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, seq),
  CHECK (ended_at > started_at AND ended_at - started_at <= interval '24 hours'),
  CHECK (mode = 'presencial' OR space_id IS NULL),
  CHECK (rectifies IS NULL OR reason IS NOT NULL)
);
CREATE UNIQUE INDEX tech_session_rectified_once ON public.tech_service_sessions(rectifies) WHERE rectifies IS NOT NULL;
GRANT SELECT ON public.tech_service_sessions TO authenticated;
GRANT ALL ON public.tech_service_sessions TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tech_service_sessions FROM anon, authenticated, service_role;
REVOKE SELECT ON public.tech_service_sessions FROM authenticated;
GRANT SELECT (id, request_id, seq, mode, space_id, started_at, ended_at, result, summary, engagement_id, rectifies, reason, person_id, created_at) ON public.tech_service_sessions TO authenticated;
ALTER TABLE public.tech_service_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech session read" ON public.tech_service_sessions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ops_requests r WHERE r.id = request_id
  AND (r.requester_person = public.current_person_id() OR public.tech_can_read(r.school_id))));
CREATE TRIGGER tech_session_immutable BEFORE UPDATE OR DELETE ON public.tech_service_sessions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_tech_service_session(_request uuid, _expected_seq int, _mode text, _space uuid,
  _started timestamptz, _ended timestamptz, _result text, _summary text, _evidence uuid, _rectifies uuid, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.ops_requests; _eng uuid; _e public.institutional_engagements; _last int; _prev int; _sp public.ops_spaces;
BEGIN
  SELECT seq INTO _prev FROM public.tech_service_sessions WHERE idempotency_key = _key;
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _r FROM public.ops_requests WHERE id = _request AND sector = 'tecnologia' FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  SELECT responsible_engagement INTO _eng FROM public.ops_request_events WHERE request_id = _request AND kind = 'atribuicao' ORDER BY seq DESC LIMIT 1;
  SELECT * INTO _e FROM public.institutional_engagements WHERE id = _eng;
  IF _e.id IS NULL OR _e.person_id IS DISTINCT FROM _p OR _e.school_id IS DISTINCT FROM _r.school_id OR _e.valid_from > current_date
     OR (_e.valid_until IS NOT NULL AND _e.valid_until < current_date) THEN RAISE EXCEPTION 'nao-responsavel'; END IF;
  IF _ended > now() + interval '5 minutes' THEN RAISE EXCEPTION 'periodo-futuro'; END IF;
  IF _started < _r.created_at THEN RAISE EXCEPTION 'anterior-ao-chamado'; END IF;
  IF _space IS NOT NULL THEN
    SELECT * INTO _sp FROM public.ops_spaces WHERE id = _space;
    IF _sp.id IS NULL OR _sp.school_id IS DISTINCT FROM _r.school_id THEN RAISE EXCEPTION 'espaco-de-outra-escola'; END IF;
  END IF;
  IF _rectifies IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tech_service_sessions s WHERE s.id = _rectifies AND s.request_id = _request)
  THEN RAISE EXCEPTION 'retificacao-invalida'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.tech_service_sessions WHERE request_id = _request;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  INSERT INTO public.tech_service_sessions(request_id, seq, mode, space_id, started_at, ended_at, result, summary, evidence_ref, engagement_id, rectifies, reason, person_id, idempotency_key)
  VALUES (_request, _last + 1, _mode, _space, _started, _ended, _result, btrim(_summary), _evidence, _e.id, _rectifies, _reason, _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;
REVOKE ALL ON FUNCTION public.record_tech_service_session(uuid, int, text, uuid, timestamptz, timestamptz, text, text, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_tech_service_session(uuid, int, text, uuid, timestamptz, timestamptz, text, text, uuid, uuid, text, text) TO authenticated;
