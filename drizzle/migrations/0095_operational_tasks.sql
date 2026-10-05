-- Central de tarefas: tarefas MANUAIS persistidas; tarefas derivadas de workflow são projeção (não gravadas aqui).
CREATE TABLE public.operational_task_priorities (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{2,40}$'),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  ordinal integer NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.operational_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  description text CHECK (length(description) <= 2000),
  priority_id text REFERENCES public.operational_task_priorities(id),
  due_on date,
  recurrence jsonb CHECK (recurrence IS NULL OR (jsonb_typeof(recurrence) = 'object' AND recurrence ? 'regra')),
  source_kind text CHECK (source_kind ~ '^[a-z0-9-]{2,40}$'),
  source_ref text CHECK (length(source_ref) <= 200),
  dedupe_key text NOT NULL UNIQUE CHECK (length(dedupe_key) BETWEEN 8 AND 200),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source_kind IS NULL) = (source_ref IS NULL))
);
CREATE TABLE public.operational_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.operational_tasks(id),
  seq integer NOT NULL CHECK (seq > 0),
  kind text NOT NULL CHECK (kind IN ('atribuicao','status','comentario')),
  assignee_engagement uuid,
  status text CHECK (status IN ('aberta','em-andamento','concluida','cancelada')),
  comment text CHECK (length(comment) <= 2000),
  idempotency_key text NOT NULL UNIQUE,
  actor uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, seq),
  CHECK ((kind = 'atribuicao') = (assignee_engagement IS NOT NULL)),
  CHECK ((kind = 'status') = (status IS NOT NULL)),
  CHECK (kind <> 'comentario' OR comment IS NOT NULL)
);
GRANT SELECT ON public.operational_task_priorities, public.operational_tasks, public.operational_task_events TO authenticated;
GRANT ALL ON public.operational_task_priorities, public.operational_tasks, public.operational_task_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.operational_task_priorities, public.operational_tasks, public.operational_task_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.operational_engagement_active(_engagement uuid, _school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.institutional_engagements e
    WHERE e.id = _engagement AND (e.school_id = _school OR e.scope_level = 'rede')
      AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)
      AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.ended_on <= current_date));
$$;
CREATE OR REPLACE FUNCTION public.operational_task_assignee(_task uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT ev.assignee_engagement FROM public.operational_task_events ev WHERE ev.task_id = _task AND ev.kind = 'atribuicao' ORDER BY ev.seq DESC LIMIT 1;
$$;
-- Lê: gestor da escola, ou a pessoa da atuação responsável ENQUANTO a atuação estiver vigente.
CREATE OR REPLACE FUNCTION public.can_read_operational_task(_task uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.operational_tasks t WHERE t.id = _task AND (
    public.has_school_capability('gerir-tarefas-operacionais', t.school_id)
    OR EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = public.operational_task_assignee(t.id)
               AND e.person_id = public.current_person_id() AND public.operational_engagement_active(e.id, t.school_id))));
$$;
REVOKE ALL ON FUNCTION public.operational_engagement_active(uuid,text), public.operational_task_assignee(uuid), public.can_read_operational_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.operational_engagement_active(uuid,text), public.operational_task_assignee(uuid), public.can_read_operational_task(uuid) TO authenticated;

ALTER TABLE public.operational_task_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_task_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY otp_read ON public.operational_task_priorities FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY ot_read ON public.operational_tasks FOR SELECT TO authenticated USING (public.can_read_operational_task(id));
CREATE POLICY ote_read ON public.operational_task_events FOR SELECT TO authenticated USING (public.can_read_operational_task(task_id));
CREATE TRIGGER otp_ao BEFORE UPDATE OR DELETE ON public.operational_task_priorities FOR EACH ROW EXECUTE FUNCTION public.integration_append_only();
CREATE TRIGGER ot_ao BEFORE UPDATE OR DELETE ON public.operational_tasks FOR EACH ROW EXECUTE FUNCTION public.integration_append_only();
CREATE TRIGGER ote_ao BEFORE UPDATE OR DELETE ON public.operational_task_events FOR EACH ROW EXECUTE FUNCTION public.integration_append_only();

CREATE OR REPLACE FUNCTION public.register_operational_task_priority(_id text, _label text, _ordinal integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_network_capability('gerir-tarefas-operacionais') THEN RAISE EXCEPTION 'task:forbidden'; END IF;
  INSERT INTO public.operational_task_priorities(id, label, ordinal, recorded_by) VALUES (_id, _label, _ordinal, auth.uid());
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.create_operational_task(_school text, _title text, _description text, _priority text, _due_on date, _recurrence jsonb, _source_kind text, _source_ref text, _dedupe_key text, _assignee uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'task:unauthenticated'; END IF;
  IF NOT public.has_school_capability('gerir-tarefas-operacionais', _school) THEN RAISE EXCEPTION 'task:forbidden'; END IF;
  SELECT t.id INTO _id FROM public.operational_tasks t WHERE t.dedupe_key = _dedupe_key;
  IF _id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.operational_tasks t WHERE t.id = _id AND t.created_by = auth.uid()) THEN RAISE EXCEPTION 'task:dedupe-conflict'; END IF;
    RETURN _id;
  END IF;
  IF _assignee IS NOT NULL AND NOT public.operational_engagement_active(_assignee, _school) THEN RAISE EXCEPTION 'task:assignee-inactive'; END IF;
  INSERT INTO public.operational_tasks(school_id, title, description, priority_id, due_on, recurrence, source_kind, source_ref, dedupe_key, created_by)
  VALUES (_school, _title, nullif(_description,''), nullif(_priority,''), _due_on, _recurrence, nullif(_source_kind,''), nullif(_source_ref,''), _dedupe_key, auth.uid()) RETURNING id INTO _id;
  INSERT INTO public.operational_task_events(task_id, seq, kind, status, idempotency_key, actor) VALUES (_id, 1, 'status', 'aberta', _dedupe_key || ':abertura', auth.uid());
  IF _assignee IS NOT NULL THEN
    INSERT INTO public.operational_task_events(task_id, seq, kind, assignee_engagement, idempotency_key, actor) VALUES (_id, 2, 'atribuicao', _assignee, _dedupe_key || ':atribuicao', auth.uid());
  END IF;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.record_operational_task_event(_task uuid, _kind text, _expected_seq integer, _idempotency_key text, _status text, _assignee uuid, _comment text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _school text; _seq integer; _manager boolean; _owner boolean; _done uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'task:unauthenticated'; END IF;
  SELECT id INTO _done FROM public.operational_task_events WHERE idempotency_key = _idempotency_key;
  IF _done IS NOT NULL THEN RETURN (SELECT seq FROM public.operational_task_events WHERE id = _done AND actor = auth.uid()); END IF;
  SELECT t.school_id INTO _school FROM public.operational_tasks t WHERE t.id = _task;
  IF _school IS NULL THEN RAISE EXCEPTION 'task:not-found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('task:' || _task::text));
  _manager := public.has_school_capability('gerir-tarefas-operacionais', _school);
  _owner := EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = public.operational_task_assignee(_task)
                    AND e.person_id = public.current_person_id() AND public.operational_engagement_active(e.id, _school));
  IF NOT (_manager OR _owner) THEN RAISE EXCEPTION 'task:forbidden'; END IF;
  IF _kind = 'atribuicao' AND NOT _manager THEN RAISE EXCEPTION 'task:reassign-forbidden'; END IF;
  IF _kind = 'atribuicao' AND NOT public.operational_engagement_active(_assignee, _school) THEN RAISE EXCEPTION 'task:assignee-inactive'; END IF;
  SELECT coalesce(max(seq), 0) INTO _seq FROM public.operational_task_events WHERE task_id = _task;
  IF _seq <> _expected_seq THEN RAISE EXCEPTION 'task:stale'; END IF;
  INSERT INTO public.operational_task_events(task_id, seq, kind, assignee_engagement, status, comment, idempotency_key, actor)
  VALUES (_task, _seq + 1, _kind, CASE WHEN _kind = 'atribuicao' THEN _assignee END, CASE WHEN _kind = 'status' THEN _status END, nullif(_comment, ''), _idempotency_key, auth.uid());
  RETURN _seq + 1;
END; $$;
REVOKE ALL ON FUNCTION public.register_operational_task_priority(text,text,integer), public.create_operational_task(text,text,text,text,date,jsonb,text,text,text,uuid), public.record_operational_task_event(uuid,text,integer,text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_operational_task_priority(text,text,integer), public.create_operational_task(text,text,text,text,date,jsonb,text,text,text,uuid), public.record_operational_task_event(uuid,text,integer,text,text,uuid,text) TO authenticated;