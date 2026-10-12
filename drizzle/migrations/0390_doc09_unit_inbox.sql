CREATE TABLE public.admin_case_inbox_acts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES public.admin_case_dispatches(id),
  act_type text NOT NULL CHECK (act_type IN ('ciencia','providencia','analise','tarefa_vinculada')),
  text_body text,
  task_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (act_type <> 'tarefa_vinculada' OR task_id IS NOT NULL),
  CHECK (act_type NOT IN ('providencia','analise') OR length(btrim(coalesce(text_body,''))) >= 10)
);
CREATE UNIQUE INDEX admin_case_inbox_one_ciencia_per_person ON public.admin_case_inbox_acts(dispatch_id, author_person) WHERE act_type = 'ciencia';
GRANT SELECT ON public.admin_case_inbox_acts TO authenticated;
GRANT ALL ON public.admin_case_inbox_acts TO service_role;
ALTER TABLE public.admin_case_inbox_acts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inbox acts follow dispatch" ON public.admin_case_inbox_acts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_case_dispatches d WHERE d.id = dispatch_id));
CREATE TRIGGER admin_inbox_immutable BEFORE UPDATE OR DELETE ON public.admin_case_inbox_acts FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_inbox_act(_dispatch_id uuid, _act_type text, _text_body text, _task_id uuid, _idempotency_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _d public.admin_case_dispatches; _id uuid;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'inbox:no-person'; END IF;
  SELECT * INTO _d FROM public.admin_case_dispatches WHERE id = _dispatch_id;
  IF NOT FOUND OR NOT public.case_can_act(_d.to_unit_id, 'instruir-processos') THEN RAISE EXCEPTION 'inbox:forbidden'; END IF;
  IF coalesce(btrim(_idempotency_key),'') = '' THEN RAISE EXCEPTION 'inbox:missing-key'; END IF;
  SELECT id INTO _id FROM public.admin_case_inbox_acts WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN _id; END IF;
  IF _act_type <> 'ciencia' AND NOT EXISTS (SELECT 1 FROM public.admin_case_dispatch_events x WHERE x.dispatch_id = _dispatch_id AND x.event_type = 'recebido') THEN
    RAISE EXCEPTION 'inbox:not-received'; END IF;
  IF _act_type = 'tarefa_vinculada' AND NOT public.can_read_operational_task(_task_id) THEN RAISE EXCEPTION 'inbox:task-not-readable'; END IF;
  INSERT INTO public.admin_case_inbox_acts(dispatch_id, act_type, text_body, task_id, idempotency_key, author_person)
  VALUES (_dispatch_id, _act_type, nullif(btrim(_text_body),''), _task_id, _idempotency_key, _person) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'inbox:already-acknowledged';
  WHEN check_violation THEN RAISE EXCEPTION 'inbox:text-required';
END $$;

CREATE OR REPLACE VIEW public.admin_unit_inbox WITH (security_invoker = true) AS
  SELECT d.id AS dispatch_id, d.case_id, c.case_number, c.subject, d.from_unit_id, d.to_unit_id, d.dispatch_seq,
    d.responsible_engagement_id, d.due_on, d.due_basis, d.sent_by_person, d.sent_at,
    (SELECT x.event_type FROM public.admin_case_dispatch_events x WHERE x.dispatch_id = d.id AND x.event_type IN ('recebido','devolvido') LIMIT 1) AS settled_as,
    EXISTS (SELECT 1 FROM public.admin_case_inbox_acts a WHERE a.dispatch_id = d.id AND a.act_type = 'ciencia' AND a.author_person = public.current_person_id()) AS my_ciencia
  FROM public.admin_case_dispatches d JOIN public.admin_case_files c ON c.id = d.case_id
  WHERE public.case_can_act(d.to_unit_id, 'instruir-processos');
GRANT SELECT ON public.admin_unit_inbox TO authenticated;
REVOKE ALL ON public.admin_unit_inbox FROM anon;

REVOKE ALL ON FUNCTION public.record_inbox_act(uuid,text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_inbox_act(uuid,text,text,uuid,text) TO authenticated;