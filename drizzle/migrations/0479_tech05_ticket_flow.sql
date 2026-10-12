-- Tecnologia L05: triagem e verificação do chamado como atos append-only; atribuição/atendimento/conclusão/reabertura
-- continuam em ops_request_events (record_ops_request_event). Verificação só após conclusão, por pessoa ≠ quem concluiu.
CREATE TABLE public.tech_ticket_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ops_requests(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('triagem','verificacao-aceita','verificacao-recusada')),
  conclusion_seq int,
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, seq),
  CHECK (kind = 'triagem' OR conclusion_seq IS NOT NULL)
);
CREATE UNIQUE INDEX tech_review_once_per_conclusion ON public.tech_ticket_reviews(request_id, conclusion_seq) WHERE kind <> 'triagem';
GRANT SELECT ON public.tech_ticket_reviews TO authenticated;
GRANT ALL ON public.tech_ticket_reviews TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tech_ticket_reviews FROM anon, authenticated, service_role;
ALTER TABLE public.tech_ticket_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech review read" ON public.tech_ticket_reviews FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ops_requests r WHERE r.id = request_id
  AND (r.requester_person = public.current_person_id() OR public.tech_can_read(r.school_id))));
CREATE TRIGGER tech_review_immutable BEFORE UPDATE OR DELETE ON public.tech_ticket_reviews FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_tech_ticket_review(_request uuid, _expected_seq int, _kind text, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.ops_requests; _last int; _ev public.ops_request_events; _prev int;
BEGIN
  SELECT seq INTO _prev FROM public.tech_ticket_reviews WHERE idempotency_key = _key;
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _r FROM public.ops_requests WHERE id = _request AND sector = 'tecnologia' FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.tech_ticket_reviews WHERE request_id = _request;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  SELECT * INTO _ev FROM public.ops_request_events WHERE request_id = _request
    AND kind IN ('atribuicao','inicio','espera','conclusao','cancelamento','reabertura') ORDER BY seq DESC LIMIT 1;
  IF _kind = 'triagem' THEN
    IF NOT public.tech_can_manage(_r.school_id) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
    IF _ev.id IS NOT NULL AND _ev.kind <> 'reabertura' THEN RAISE EXCEPTION 'triagem-fora-de-hora'; END IF;
    INSERT INTO public.tech_ticket_reviews(request_id, seq, kind, note, person_id, idempotency_key)
    VALUES (_request, _last + 1, 'triagem', btrim(_note), _p, _key);
  ELSIF _kind IN ('verificacao-aceita','verificacao-recusada') THEN
    IF _ev.kind IS DISTINCT FROM 'conclusao' THEN RAISE EXCEPTION 'nao-concluido'; END IF;
    IF _ev.actor_person = _p THEN RAISE EXCEPTION 'verificador-igual-executor'; END IF;
    IF NOT (_r.requester_person = _p OR public.tech_can_manage(_r.school_id)) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
    INSERT INTO public.tech_ticket_reviews(request_id, seq, kind, conclusion_seq, note, person_id, idempotency_key)
    VALUES (_request, _last + 1, _kind, _ev.seq, btrim(_note), _p, _key);
  ELSE RAISE EXCEPTION 'tipo-invalido'; END IF;
  RETURN _last + 1;
END $$;
REVOKE ALL ON FUNCTION public.record_tech_ticket_review(uuid, int, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_tech_ticket_review(uuid, int, text, text, text) TO authenticated;
