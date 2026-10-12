CREATE TABLE public.protocol_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_number text NOT NULL UNIQUE,
  year int NOT NULL,
  seq int NOT NULL,
  channel text NOT NULL CHECK (channel IN ('interno','presencial','digital')),
  origin_unit_id text NOT NULL,
  interested_person_id uuid,
  interested_external_ref text,
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 3 AND 300),
  classification_code text NOT NULL,
  receipt_hash text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  registered_by_person uuid NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, seq),
  CHECK (interested_person_id IS NOT NULL OR coalesce(btrim(interested_external_ref),'') <> '')
);
CREATE TABLE public.protocol_registration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.protocol_registrations(id),
  seq int NOT NULL CHECK (seq >= 1),
  event_type text NOT NULL CHECK (event_type IN ('registrado','encaminhado','recebido','juntada','anotacao','arquivado','desarquivado')),
  to_unit_id text,
  note text,
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id, seq)
);
COMMENT ON TABLE public.protocol_registrations IS 'Protocolo único: registra recebimento, nunca deferimento (decisão vive na Tramitação).';
GRANT SELECT ON public.protocol_registrations, public.protocol_registration_events TO authenticated;
GRANT ALL ON public.protocol_registrations, public.protocol_registration_events TO service_role;
ALTER TABLE public.protocol_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_registration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "protocol readable by competent, author or interested" ON public.protocol_registrations FOR SELECT TO authenticated
  USING (public.has_network_capability('protocolar-solicitacoes')
    OR origin_unit_id IN (SELECT public.school_capability_schools('protocolar-solicitacoes'))
    OR registered_by_person = public.current_person_id()
    OR interested_person_id = public.current_person_id());
CREATE POLICY "protocol events follow registration" ON public.protocol_registration_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.protocol_registrations r WHERE r.id = registration_id));
CREATE TRIGGER protocol_reg_immutable BEFORE UPDATE OR DELETE ON public.protocol_registrations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER protocol_evt_immutable BEFORE UPDATE OR DELETE ON public.protocol_registration_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.register_protocol(_channel text, _origin_unit_id text, _interested_person_id uuid, _interested_external_ref text, _subject text, _classification_code text, _idempotency_key text)
RETURNS TABLE(registration_id uuid, protocol_number text, receipt_hash text, reused boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _prev public.protocol_registrations; _y int := extract(year from now())::int; _n int; _num text; _hash text; _id uuid;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'protocol:no-person'; END IF;
  IF NOT (public.has_network_capability('protocolar-solicitacoes') OR _origin_unit_id IN (SELECT public.school_capability_schools('protocolar-solicitacoes'))) THEN
    RAISE EXCEPTION 'protocol:forbidden'; END IF;
  IF coalesce(btrim(_idempotency_key),'') = '' OR coalesce(btrim(_classification_code),'') = '' THEN RAISE EXCEPTION 'protocol:missing-field'; END IF;
  SELECT * INTO _prev FROM public.protocol_registrations p WHERE p.idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF _prev.subject <> _subject OR _prev.origin_unit_id <> _origin_unit_id THEN RAISE EXCEPTION 'protocol:idempotency-conflict'; END IF;
    RETURN QUERY SELECT _prev.id, _prev.protocol_number, _prev.receipt_hash, true; RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('protocol|' || _y, 0));
  SELECT coalesce(max(p.seq),0)+1 INTO _n FROM public.protocol_registrations p WHERE p.year = _y;
  _num := 'PROT-' || _y || '-' || lpad(_n::text, 6, '0');
  _hash := encode(extensions.digest(_num || '|' || _channel || '|' || _origin_unit_id || '|' || _subject || '|' || _classification_code || '|' || _person || '|' || now()::text, 'sha256'), 'hex');
  INSERT INTO public.protocol_registrations(protocol_number, year, seq, channel, origin_unit_id, interested_person_id, interested_external_ref, subject, classification_code, receipt_hash, idempotency_key, registered_by_person)
  VALUES (_num, _y, _n, _channel, _origin_unit_id, _interested_person_id, nullif(btrim(_interested_external_ref),''), btrim(_subject), _classification_code, _hash, _idempotency_key, _person) RETURNING id INTO _id;
  INSERT INTO public.protocol_registration_events(registration_id, seq, event_type, author_person) VALUES (_id, 1, 'registrado', _person);
  RETURN QUERY SELECT _id, _num, _hash, false;
END $$;

CREATE OR REPLACE FUNCTION public.record_protocol_event(_registration_id uuid, _expected_seq int, _event_type text, _to_unit_id text, _note text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _r public.protocol_registrations; _last int;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'protocol:no-person'; END IF;
  SELECT * INTO _r FROM public.protocol_registrations WHERE id = _registration_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'protocol:not-found'; END IF;
  IF NOT (public.has_network_capability('protocolar-solicitacoes') OR _r.origin_unit_id IN (SELECT public.school_capability_schools('protocolar-solicitacoes'))) THEN
    RAISE EXCEPTION 'protocol:forbidden'; END IF;
  IF _event_type = 'registrado' THEN RAISE EXCEPTION 'protocol:invalid-event'; END IF;
  IF _event_type = 'encaminhado' AND coalesce(_to_unit_id,'') = '' THEN RAISE EXCEPTION 'protocol:missing-destination'; END IF;
  SELECT max(seq) INTO _last FROM public.protocol_registration_events WHERE registration_id = _registration_id;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'protocol:stale-base'; END IF;
  INSERT INTO public.protocol_registration_events(registration_id, seq, event_type, to_unit_id, note, author_person)
  VALUES (_registration_id, _last+1, _event_type, _to_unit_id, nullif(btrim(_note),''), _person);
  RETURN _last+1;
END $$;

REVOKE ALL ON FUNCTION public.register_protocol(text,text,uuid,text,text,text,text), public.record_protocol_event(uuid,int,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_protocol(text,text,uuid,text,text,text,text), public.record_protocol_event(uuid,int,text,text,text) TO authenticated;