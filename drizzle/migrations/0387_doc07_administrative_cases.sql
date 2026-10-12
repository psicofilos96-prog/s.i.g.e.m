CREATE TABLE public.admin_case_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL UNIQUE,
  year int NOT NULL,
  seq int NOT NULL,
  unit_id text NOT NULL,
  protocol_registration_id uuid REFERENCES public.protocol_registrations(id),
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 3 AND 300),
  classification_code text NOT NULL,
  opened_by_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, seq)
);
CREATE TABLE public.admin_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.admin_case_files(id),
  seq int NOT NULL CHECK (seq >= 1),
  event_type text NOT NULL CHECK (event_type IN ('autuado','documento_juntado','instrucao','manifestacao','encaminhado','concluido','reaberto')),
  document_order int,
  document_ref text,
  content_sha256 text CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'),
  to_unit_id text,
  text_body text,
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, seq),
  CHECK (event_type <> 'documento_juntado' OR (document_order IS NOT NULL AND document_ref IS NOT NULL AND content_sha256 IS NOT NULL))
);
CREATE UNIQUE INDEX admin_case_events_doc_order ON public.admin_case_events(case_id, document_order) WHERE document_order IS NOT NULL;
GRANT SELECT ON public.admin_case_files, public.admin_case_events TO authenticated;
GRANT ALL ON public.admin_case_files, public.admin_case_events TO service_role;
ALTER TABLE public.admin_case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case readable by competent or author" ON public.admin_case_files FOR SELECT TO authenticated
  USING (public.has_network_capability('instruir-processos') OR unit_id IN (SELECT public.school_capability_schools('instruir-processos'))
    OR opened_by_person = public.current_person_id());
CREATE POLICY "case events follow case" ON public.admin_case_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_case_files c WHERE c.id = case_id));
CREATE TRIGGER admin_case_immutable BEFORE UPDATE OR DELETE ON public.admin_case_files FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER admin_case_evt_immutable BEFORE UPDATE OR DELETE ON public.admin_case_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.case_can_act(_unit text, _cap text) RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT public.has_network_capability(_cap) OR _unit IN (SELECT public.school_capability_schools(_cap)) $$;

CREATE OR REPLACE FUNCTION public.open_admin_case(_unit_id text, _subject text, _classification_code text, _protocol_registration_id uuid, _idempotency_key text)
RETURNS TABLE(case_id uuid, case_number text, reused boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _prev public.admin_case_files; _y int := extract(year from now())::int; _n int; _num text; _id uuid;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'case:no-person'; END IF;
  IF NOT public.case_can_act(_unit_id, 'instruir-processos') THEN RAISE EXCEPTION 'case:forbidden'; END IF;
  IF coalesce(btrim(_idempotency_key),'') = '' OR coalesce(btrim(_classification_code),'') = '' THEN RAISE EXCEPTION 'case:missing-field'; END IF;
  SELECT * INTO _prev FROM public.admin_case_files c WHERE c.idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF _prev.subject <> btrim(_subject) OR _prev.unit_id <> _unit_id THEN RAISE EXCEPTION 'case:idempotency-conflict'; END IF;
    RETURN QUERY SELECT _prev.id, _prev.case_number, true; RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('admin-case|' || _y, 0));
  SELECT coalesce(max(c.seq),0)+1 INTO _n FROM public.admin_case_files c WHERE c.year = _y;
  _num := 'PROC-' || _y || '-' || lpad(_n::text, 6, '0');
  INSERT INTO public.admin_case_files(case_number, year, seq, unit_id, protocol_registration_id, subject, classification_code, opened_by_person, idempotency_key)
  VALUES (_num, _y, _n, _unit_id, _protocol_registration_id, btrim(_subject), _classification_code, _person, _idempotency_key) RETURNING id INTO _id;
  INSERT INTO public.admin_case_events(case_id, seq, event_type, author_person) VALUES (_id, 1, 'autuado', _person);
  RETURN QUERY SELECT _id, _num, false;
END $$;

CREATE OR REPLACE FUNCTION public.record_admin_case_event(_case_id uuid, _expected_seq int, _event_type text, _document_ref text, _content_sha256 text, _to_unit_id text, _text_body text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _c public.admin_case_files; _last int; _state text; _ord int;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'case:no-person'; END IF;
  SELECT * INTO _c FROM public.admin_case_files WHERE id = _case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'case:not-found'; END IF;
  IF NOT public.case_can_act(_c.unit_id, 'instruir-processos') THEN RAISE EXCEPTION 'case:forbidden'; END IF;
  SELECT e.seq INTO _last FROM public.admin_case_events e WHERE e.case_id = _case_id ORDER BY e.seq DESC LIMIT 1;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'case:stale-base'; END IF;
  SELECT CASE WHEN e.event_type = 'concluido' THEN 'concluido' ELSE 'aberto' END INTO _state
    FROM public.admin_case_events e WHERE e.case_id = _case_id AND e.event_type IN ('autuado','concluido','reaberto') ORDER BY e.seq DESC LIMIT 1;
  IF _event_type = 'autuado' THEN RAISE EXCEPTION 'case:invalid-event'; END IF;
  IF _state = 'concluido' AND _event_type <> 'reaberto' THEN RAISE EXCEPTION 'case:concluded'; END IF;
  IF _event_type = 'reaberto' THEN
    IF _state <> 'concluido' THEN RAISE EXCEPTION 'case:not-concluded'; END IF;
    IF NOT public.case_can_act(_c.unit_id, 'reabrir-processos') THEN RAISE EXCEPTION 'case:reopen-forbidden'; END IF;
  END IF;
  IF _event_type IN ('manifestacao','instrucao','concluido','reaberto') AND length(btrim(coalesce(_text_body,''))) < 10 THEN RAISE EXCEPTION 'case:text-required'; END IF;
  IF _event_type = 'encaminhado' AND coalesce(_to_unit_id,'') = '' THEN RAISE EXCEPTION 'case:missing-destination'; END IF;
  IF _event_type = 'documento_juntado' THEN
    IF coalesce(_document_ref,'') = '' OR coalesce(_content_sha256,'') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'case:document-invalid'; END IF;
    SELECT coalesce(max(e.document_order),0)+1 INTO _ord FROM public.admin_case_events e WHERE e.case_id = _case_id;
  END IF;
  INSERT INTO public.admin_case_events(case_id, seq, event_type, document_order, document_ref, content_sha256, to_unit_id, text_body, author_person)
  VALUES (_case_id, _last+1, _event_type, _ord, nullif(_document_ref,''), nullif(_content_sha256,''), nullif(_to_unit_id,''), nullif(btrim(_text_body),''), _person);
  RETURN _last+1;
END $$;

REVOKE ALL ON FUNCTION public.case_can_act(text,text), public.open_admin_case(text,text,text,uuid,text), public.record_admin_case_event(uuid,int,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_can_act(text,text), public.open_admin_case(text,text,text,uuid,text), public.record_admin_case_event(uuid,int,text,text,text,text,text) TO authenticated;