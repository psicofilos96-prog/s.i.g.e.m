CREATE TABLE public.admin_case_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.admin_case_files(id),
  dispatch_seq int NOT NULL CHECK (dispatch_seq >= 1),
  from_unit_id text NOT NULL,
  to_unit_id text NOT NULL,
  responsible_engagement_id text,
  due_on date,
  due_basis text,
  note text,
  sent_by_person uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, dispatch_seq),
  CHECK (from_unit_id <> to_unit_id),
  CHECK (due_on IS NULL OR coalesce(btrim(due_basis),'') <> '')
);
CREATE TABLE public.admin_case_dispatch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES public.admin_case_dispatches(id),
  event_type text NOT NULL CHECK (event_type IN ('recebido','devolvido','responsavel_assumiu')),
  responsible_engagement_id text,
  note text,
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX admin_case_dispatch_one_receipt ON public.admin_case_dispatch_events(dispatch_id) WHERE event_type IN ('recebido','devolvido');
CREATE TABLE public.admin_case_sensitive_documents (
  case_event_id uuid PRIMARY KEY REFERENCES public.admin_case_events(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  marked_by_person uuid NOT NULL,
  marked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.admin_case_sensitive_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_event_id uuid NOT NULL REFERENCES public.admin_case_events(id),
  purpose text NOT NULL,
  reader_person uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_case_dispatches, public.admin_case_dispatch_events, public.admin_case_sensitive_documents TO authenticated;
GRANT ALL ON public.admin_case_dispatches, public.admin_case_dispatch_events, public.admin_case_sensitive_documents, public.admin_case_sensitive_access_log TO service_role;
ALTER TABLE public.admin_case_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_dispatch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_sensitive_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_sensitive_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dispatch readable by origin or destination" ON public.admin_case_dispatches FOR SELECT TO authenticated
  USING (public.case_can_act(from_unit_id, 'instruir-processos') OR public.case_can_act(to_unit_id, 'instruir-processos'));
CREATE POLICY "dispatch events follow dispatch" ON public.admin_case_dispatch_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_case_dispatches d WHERE d.id = dispatch_id));
CREATE POLICY "sensitive marks follow case events" ON public.admin_case_sensitive_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_case_events e WHERE e.id = case_event_id));
CREATE POLICY "case readable by dispatch destination" ON public.admin_case_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_case_dispatches d WHERE d.case_id = id AND public.case_can_act(d.to_unit_id, 'instruir-processos')));
CREATE TRIGGER admin_dispatch_immutable BEFORE UPDATE OR DELETE ON public.admin_case_dispatches FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER admin_dispatch_evt_immutable BEFORE UPDATE OR DELETE ON public.admin_case_dispatch_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER admin_sensitive_immutable BEFORE UPDATE OR DELETE ON public.admin_case_sensitive_documents FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER admin_sensitive_log_immutable BEFORE UPDATE OR DELETE ON public.admin_case_sensitive_access_log FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.admin_case_current_unit(_case_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT d.to_unit_id FROM public.admin_case_dispatches d
     WHERE d.case_id = _case_id AND EXISTS (SELECT 1 FROM public.admin_case_dispatch_events x WHERE x.dispatch_id = d.id AND x.event_type = 'recebido')
     ORDER BY d.dispatch_seq DESC LIMIT 1),
   (SELECT c.unit_id FROM public.admin_case_files c WHERE c.id = _case_id)) $$;

CREATE OR REPLACE FUNCTION public.dispatch_admin_case(_case_id uuid, _expected_dispatch_seq int, _to_unit_id text, _responsible_engagement_id text, _due_on date, _due_basis text, _note text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _last int; _from text; _pending boolean; _concluded boolean;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'dispatch:no-person'; END IF;
  PERFORM 1 FROM public.admin_case_files WHERE id = _case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dispatch:not-found'; END IF;
  SELECT coalesce(max(dispatch_seq),0) INTO _last FROM public.admin_case_dispatches WHERE case_id = _case_id;
  IF _last <> _expected_dispatch_seq THEN RAISE EXCEPTION 'dispatch:stale-base'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.admin_case_dispatches d WHERE d.case_id = _case_id AND NOT EXISTS
    (SELECT 1 FROM public.admin_case_dispatch_events x WHERE x.dispatch_id = d.id AND x.event_type IN ('recebido','devolvido'))) INTO _pending;
  IF _pending THEN RAISE EXCEPTION 'dispatch:pending-receipt'; END IF;
  SELECT e.event_type = 'concluido' INTO _concluded FROM public.admin_case_events e
    WHERE e.case_id = _case_id AND e.event_type IN ('autuado','concluido','reaberto') ORDER BY e.seq DESC LIMIT 1;
  IF _concluded THEN RAISE EXCEPTION 'dispatch:case-concluded'; END IF;
  _from := public.admin_case_current_unit(_case_id);
  IF NOT public.case_can_act(_from, 'instruir-processos') THEN RAISE EXCEPTION 'dispatch:forbidden'; END IF;
  IF coalesce(btrim(_to_unit_id),'') = '' OR _to_unit_id = _from THEN RAISE EXCEPTION 'dispatch:invalid-destination'; END IF;
  IF _due_on IS NOT NULL AND coalesce(btrim(_due_basis),'') = '' THEN RAISE EXCEPTION 'dispatch:due-without-basis'; END IF;
  INSERT INTO public.admin_case_dispatches(case_id, dispatch_seq, from_unit_id, to_unit_id, responsible_engagement_id, due_on, due_basis, note, sent_by_person)
  VALUES (_case_id, _last+1, _from, btrim(_to_unit_id), nullif(btrim(_responsible_engagement_id),''), _due_on, nullif(btrim(_due_basis),''), nullif(btrim(_note),''), _person);
  RETURN _last+1;
END $$;

CREATE OR REPLACE FUNCTION public.record_dispatch_event(_dispatch_id uuid, _event_type text, _responsible_engagement_id text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _d public.admin_case_dispatches; _received boolean;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'dispatch:no-person'; END IF;
  SELECT * INTO _d FROM public.admin_case_dispatches WHERE id = _dispatch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dispatch:not-found'; END IF;
  IF NOT public.case_can_act(_d.to_unit_id, 'instruir-processos') THEN RAISE EXCEPTION 'dispatch:forbidden'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.admin_case_dispatch_events WHERE dispatch_id = _dispatch_id AND event_type = 'recebido') INTO _received;
  IF _event_type = 'devolvido' AND length(btrim(coalesce(_note,''))) < 10 THEN RAISE EXCEPTION 'dispatch:justification-required'; END IF;
  IF _event_type = 'responsavel_assumiu' THEN
    IF NOT _received THEN RAISE EXCEPTION 'dispatch:not-received'; END IF;
    IF coalesce(btrim(_responsible_engagement_id),'') = '' THEN RAISE EXCEPTION 'dispatch:missing-responsible'; END IF;
  END IF;
  INSERT INTO public.admin_case_dispatch_events(dispatch_id, event_type, responsible_engagement_id, note, author_person)
  VALUES (_dispatch_id, _event_type, nullif(btrim(_responsible_engagement_id),''), nullif(btrim(_note),''), _person);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dispatch:already-settled';
END $$;

CREATE OR REPLACE FUNCTION public.mark_case_document_sensitive(_case_event_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _case uuid;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'sensitive:no-person'; END IF;
  SELECT case_id INTO _case FROM public.admin_case_events WHERE id = _case_event_id AND event_type = 'documento_juntado';
  IF _case IS NULL THEN RAISE EXCEPTION 'sensitive:not-document'; END IF;
  IF NOT public.case_can_act(public.admin_case_current_unit(_case), 'instruir-processos') THEN RAISE EXCEPTION 'sensitive:forbidden'; END IF;
  INSERT INTO public.admin_case_sensitive_documents(case_event_id, reason, marked_by_person) VALUES (_case_event_id, btrim(_reason), _person)
  ON CONFLICT (case_event_id) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.read_sensitive_case_document(_case_event_id uuid, _purpose text)
RETURNS TABLE(document_ref text, content_sha256 text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _e public.admin_case_events;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'sensitive:no-person'; END IF;
  IF length(btrim(coalesce(_purpose,''))) < 5 THEN RAISE EXCEPTION 'sensitive:purpose-required'; END IF;
  SELECT * INTO _e FROM public.admin_case_events WHERE id = _case_event_id;
  IF NOT FOUND OR NOT public.case_can_act(public.admin_case_current_unit(_e.case_id), 'ler-anexos-sensiveis') THEN RAISE EXCEPTION 'sensitive:forbidden'; END IF;
  INSERT INTO public.admin_case_sensitive_access_log(case_event_id, purpose, reader_person) VALUES (_case_event_id, btrim(_purpose), _person);
  RETURN QUERY SELECT _e.document_ref, _e.content_sha256;
END $$;

-- Referência de anexo sensível deixa de ser legível pela leitura direta dos eventos.
CREATE OR REPLACE VIEW public.admin_case_events_safe WITH (security_invoker = true) AS
  SELECT e.id, e.case_id, e.seq, e.event_type, e.document_order,
    CASE WHEN s.case_event_id IS NULL THEN e.document_ref END AS document_ref,
    CASE WHEN s.case_event_id IS NULL THEN e.content_sha256 END AS content_sha256,
    (s.case_event_id IS NOT NULL) AS sensitive,
    e.to_unit_id, e.text_body, e.author_person, e.created_at
  FROM public.admin_case_events e LEFT JOIN public.admin_case_sensitive_documents s ON s.case_event_id = e.id;
GRANT SELECT ON public.admin_case_events_safe TO authenticated;
REVOKE SELECT ON public.admin_case_events FROM authenticated;
GRANT SELECT (id, case_id, seq, event_type, document_order, to_unit_id, text_body, author_person, created_at) ON public.admin_case_events TO authenticated;

REVOKE ALL ON FUNCTION public.admin_case_current_unit(uuid), public.dispatch_admin_case(uuid,int,text,text,date,text,text), public.record_dispatch_event(uuid,text,text,text), public.mark_case_document_sensitive(uuid,text), public.read_sensitive_case_document(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_case_current_unit(uuid), public.dispatch_admin_case(uuid,int,text,text,date,text,text), public.record_dispatch_event(uuid,text,text,text), public.mark_case_document_sensitive(uuid,text), public.read_sensitive_case_document(uuid,text) TO authenticated;