-- Motor genérico de tramitação: definição é dado versionado; instância e eventos são append-only.
CREATE TABLE public.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key text NOT NULL CHECK (workflow_key ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  version integer NOT NULL CHECK (version >= 1),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  scope text NOT NULL CHECK (scope IN ('escola','rede')),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','homologada')),
  homologation_origin text NULL,
  homologated_at timestamptz NULL,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_key, version)
);
CREATE TABLE public.workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id),
  school_id uuid NULL,
  subject_ref text NOT NULL CHECK (length(subject_ref) BETWEEN 1 AND 300),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, idempotency_key)
);
CREATE TABLE public.workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.workflow_instances(id),
  seq integer NOT NULL CHECK (seq >= 1),
  transition_id text NULL,
  from_state text NULL,
  to_state text NOT NULL,
  comment text NULL CHECK (comment IS NULL OR length(comment) <= 4000),
  attachment_ref text NULL CHECK (attachment_ref IS NULL OR length(attachment_ref) <= 500),
  due_on date NULL,
  idempotency_key text NOT NULL,
  actor uuid NOT NULL,
  actor_person uuid NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, seq),
  UNIQUE (instance_id, idempotency_key)
);
CREATE TABLE public.workflow_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.workflow_events(id),
  instance_id uuid NOT NULL REFERENCES public.workflow_instances(id),
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz NULL
);

GRANT SELECT ON public.workflow_definitions, public.workflow_instances, public.workflow_events TO authenticated;
GRANT ALL ON public.workflow_definitions, public.workflow_instances, public.workflow_events, public.workflow_outbox TO service_role;
REVOKE ALL ON public.workflow_definitions, public.workflow_instances, public.workflow_events, public.workflow_outbox FROM anon, PUBLIC;
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.workflow_has_capability(_cap text, _school uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_network_capability(_cap)
      OR (_school IS NOT NULL AND EXISTS (SELECT 1 FROM public.school_capability_grant(_cap, _school::text)));
$$;
REVOKE ALL ON FUNCTION public.workflow_has_capability(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workflow_has_capability(text, uuid) TO authenticated;

-- Leitura: quem tem alguma capability declarada na definição, no escopo da instância, ou quem abriu.
CREATE OR REPLACE FUNCTION public.workflow_can_read(_definition uuid, _school uuid, _opened_by uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _opened_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.workflow_definitions d, pg_catalog.jsonb_array_elements(d.definition -> 'transitions') t
    WHERE d.id = _definition AND public.workflow_has_capability(t ->> 'capability', _school));
$$;
REVOKE ALL ON FUNCTION public.workflow_can_read(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workflow_can_read(uuid, uuid, uuid) TO authenticated;

CREATE POLICY "definicoes legiveis" ON public.workflow_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "instancias por capability" ON public.workflow_instances FOR SELECT TO authenticated
  USING (public.workflow_can_read(definition_id, school_id, opened_by));
CREATE POLICY "eventos por instancia legivel" ON public.workflow_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workflow_instances i WHERE i.id = instance_id AND public.workflow_can_read(i.definition_id, i.school_id, i.opened_by)));

CREATE OR REPLACE FUNCTION public.workflow_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'workflow_definitions' AND TG_OP = 'UPDATE' AND OLD.status = 'rascunho' AND NEW.status = 'homologada'
     AND NEW.definition = OLD.definition AND NEW.workflow_key = OLD.workflow_key AND NEW.version = OLD.version THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'workflow_outbox' AND TG_OP = 'UPDATE' AND OLD.dispatched_at IS NULL AND NEW.event_id = OLD.event_id THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'workflow:append-only';
END; $$;
CREATE TRIGGER workflow_definitions_immutable BEFORE UPDATE OR DELETE ON public.workflow_definitions FOR EACH ROW EXECUTE FUNCTION public.workflow_immutable();
CREATE TRIGGER workflow_instances_immutable BEFORE UPDATE OR DELETE ON public.workflow_instances FOR EACH ROW EXECUTE FUNCTION public.workflow_immutable();
CREATE TRIGGER workflow_events_immutable BEFORE UPDATE OR DELETE ON public.workflow_events FOR EACH ROW EXECUTE FUNCTION public.workflow_immutable();
CREATE TRIGGER workflow_outbox_immutable BEFORE UPDATE OR DELETE ON public.workflow_outbox FOR EACH ROW EXECUTE FUNCTION public.workflow_immutable();

-- Validação estrutural da definição (estados, inicial, transições com capability explícita, sem curinga).
CREATE OR REPLACE FUNCTION public.workflow_definition_issue(_d jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE t jsonb; states jsonb := _d -> 'states';
BEGIN
  IF jsonb_typeof(states) <> 'array' OR jsonb_array_length(states) < 2 THEN RETURN 'states'; END IF;
  IF NOT states ? (_d ->> 'initial') THEN RETURN 'initial'; END IF;
  IF jsonb_typeof(_d -> 'transitions') <> 'array' OR jsonb_array_length(_d -> 'transitions') = 0 THEN RETURN 'transitions'; END IF;
  FOR t IN SELECT * FROM jsonb_array_elements(_d -> 'transitions') LOOP
    IF coalesce(t ->> 'id','') !~ '^[a-z0-9-]{2,80}$' THEN RETURN 'transition-id'; END IF;
    IF NOT states ? (t ->> 'from') OR NOT states ? (t ->> 'to') THEN RETURN 'transition-state'; END IF;
    IF coalesce(t ->> 'capability','') !~ '^[a-z0-9][a-z0-9-]{1,99}$' THEN RETURN 'transition-capability'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(_d -> 'transitions') x) <> (SELECT count(DISTINCT x ->> 'id') FROM jsonb_array_elements(_d -> 'transitions') x) THEN RETURN 'transition-duplicate'; END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.register_workflow_definition(_key text, _title text, _scope text, _definition jsonb, _expected_version integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _last integer; _issue text; _id uuid;
BEGIN
  IF NOT public.has_network_capability('manter-definicoes-de-workflow') THEN RAISE EXCEPTION 'workflow:capability-missing'; END IF;
  _issue := public.workflow_definition_issue(_definition);
  IF _issue IS NOT NULL THEN RAISE EXCEPTION 'workflow:invalid-definition:%', _issue; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('wfdef:' || _key));
  SELECT max(version) INTO _last FROM public.workflow_definitions WHERE workflow_key = _key;
  IF _last IS DISTINCT FROM _expected_version THEN RAISE EXCEPTION 'workflow:stale-version'; END IF;
  INSERT INTO public.workflow_definitions (workflow_key, version, title, scope, definition, recorded_by)
  VALUES (_key, coalesce(_last, 0) + 1, _title, _scope, _definition, auth.uid()) RETURNING id INTO _id;
  RETURN _id;
END; $$;

-- Homologação pela decisão do proprietário: nenhum ato externo exigido.
CREATE OR REPLACE FUNCTION public.homologate_workflow_definition(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_network_capability('homologar-definicoes-de-workflow') THEN RAISE EXCEPTION 'workflow:capability-missing'; END IF;
  UPDATE public.workflow_definitions SET status = 'homologada', homologated_at = now(), homologation_origin = 'decisao-do-proprietario'
  WHERE id = _id AND status = 'rascunho';
  IF NOT FOUND THEN RAISE EXCEPTION 'workflow:not-draft'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.start_workflow(_definition uuid, _school uuid, _subject_ref text, _idempotency_key text, _comment text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.workflow_definitions%ROWTYPE; _id uuid; _ev uuid; _cap text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'workflow:auth-required'; END IF;
  SELECT * INTO d FROM public.workflow_definitions WHERE id = _definition;
  IF NOT FOUND OR d.status <> 'homologada' THEN RAISE EXCEPTION 'workflow:definition-not-homologated'; END IF;
  IF d.scope = 'escola' AND _school IS NULL THEN RAISE EXCEPTION 'workflow:scope-school-required'; END IF;
  IF d.scope = 'rede' AND _school IS NOT NULL THEN RAISE EXCEPTION 'workflow:scope-network-only'; END IF;
  _cap := d.definition ->> 'startCapability';
  IF _cap IS NULL OR NOT public.workflow_has_capability(_cap, _school) THEN RAISE EXCEPTION 'workflow:capability-missing'; END IF;
  SELECT id INTO _id FROM public.workflow_instances WHERE definition_id = _definition AND idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN _id; END IF; -- idempotente
  INSERT INTO public.workflow_instances (definition_id, school_id, subject_ref, idempotency_key, opened_by)
  VALUES (_definition, _school, _subject_ref, _idempotency_key, auth.uid()) RETURNING id INTO _id;
  INSERT INTO public.workflow_events (instance_id, seq, to_state, comment, idempotency_key, actor, actor_person)
  VALUES (_id, 1, d.definition ->> 'initial', nullif(btrim(coalesce(_comment,'')),''), _idempotency_key, auth.uid(), public.current_person_id()) RETURNING id INTO _ev;
  INSERT INTO public.workflow_outbox (event_id, instance_id, kind) VALUES (_ev, _id, 'workflow.aberto');
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.apply_workflow_transition(_instance uuid, _transition text, _expected_seq integer, _idempotency_key text,
  _comment text, _attachment_ref text, _due_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.workflow_instances%ROWTYPE; d public.workflow_definitions%ROWTYPE; t jsonb; last public.workflow_events%ROWTYPE; _ev uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'workflow:auth-required'; END IF;
  SELECT * INTO i FROM public.workflow_instances WHERE id = _instance;
  IF NOT FOUND THEN RAISE EXCEPTION 'workflow:instance-unavailable'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('wf:' || _instance::text));
  SELECT id INTO _ev FROM public.workflow_events WHERE instance_id = _instance AND idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN _ev; END IF; -- idempotente
  SELECT * INTO d FROM public.workflow_definitions WHERE id = i.definition_id;
  SELECT * INTO last FROM public.workflow_events WHERE instance_id = _instance ORDER BY seq DESC LIMIT 1;
  IF last.seq <> _expected_seq THEN RAISE EXCEPTION 'workflow:stale-seq'; END IF;
  SELECT x INTO t FROM jsonb_array_elements(d.definition -> 'transitions') x WHERE x ->> 'id' = _transition;
  IF t IS NULL OR t ->> 'from' <> last.to_state THEN RAISE EXCEPTION 'workflow:invalid-transition'; END IF;
  IF NOT public.workflow_has_capability(t ->> 'capability', i.school_id) THEN RAISE EXCEPTION 'workflow:capability-missing'; END IF;
  IF coalesce((t ->> 'requiresComment')::boolean, false) AND coalesce(btrim(_comment),'') = '' THEN RAISE EXCEPTION 'workflow:comment-required'; END IF;
  INSERT INTO public.workflow_events (instance_id, seq, transition_id, from_state, to_state, comment, attachment_ref, due_on, idempotency_key, actor, actor_person)
  VALUES (_instance, last.seq + 1, _transition, last.to_state, t ->> 'to', nullif(btrim(coalesce(_comment,'')),''), _attachment_ref, _due_on, _idempotency_key, auth.uid(), public.current_person_id())
  RETURNING id INTO _ev;
  INSERT INTO public.workflow_outbox (event_id, instance_id, kind) VALUES (_ev, _instance, 'workflow.' || coalesce(t ->> 'kind', 'transicao'));
  RETURN _ev;
END; $$;

REVOKE ALL ON FUNCTION public.register_workflow_definition(text, text, text, jsonb, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.homologate_workflow_definition(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_workflow(uuid, uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_workflow_transition(uuid, text, integer, text, text, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workflow_definition_issue(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_workflow_definition(text, text, text, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homologate_workflow_definition(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_workflow(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_workflow_transition(uuid, text, integer, text, text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_definition_issue(jsonb) TO authenticated;