-- SIGEM Desenvolvimento L09: calendário formativo. Encontros da turma formativa; nunca grava calendário letivo oficial.
CREATE TABLE public.dev_class_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.dev_classes(id),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Alteração = nova versão (base esperada, motivo a partir da v2); cancelamento é versão com status 'cancelado'.
CREATE TABLE public.dev_class_meeting_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.dev_class_meetings(id),
  version int NOT NULL CHECK (version >= 1),
  status text NOT NULL CHECK (status IN ('agendado','cancelado')),
  meeting_on date NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  location text NOT NULL CHECK (length(btrim(location)) BETWEEN 3 AND 200),
  trainer_engagements uuid[] NOT NULL CHECK (cardinality(trainer_engagements) >= 1),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, version),
  CHECK (ends_at > starts_at),
  CHECK (version = 1 OR reason IS NOT NULL),
  CHECK (version > 1 OR status = 'agendado')
);
-- Outbox de avisos: um por versão; entrega pela camada única de notificações quando houver regra de entrega configurada.
CREATE TABLE public.dev_meeting_notices (
  meeting_version_id uuid PRIMARY KEY REFERENCES public.dev_class_meeting_versions(id),
  event_kind text NOT NULL CHECK (event_kind IN ('dev-encontro-agendado','dev-encontro-alterado','dev-encontro-cancelado')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dev_class_meetings, public.dev_class_meeting_versions, public.dev_meeting_notices TO authenticated;
GRANT ALL ON public.dev_class_meetings, public.dev_class_meeting_versions, public.dev_meeting_notices TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_class_meetings, public.dev_class_meeting_versions, public.dev_meeting_notices FROM authenticated, anon;
ALTER TABLE public.dev_class_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_class_meeting_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_meeting_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev meetings read" ON public.dev_class_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev meeting versions read" ON public.dev_class_meeting_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev meeting notices read" ON public.dev_meeting_notices FOR SELECT TO authenticated USING (true);
CREATE TRIGGER devm_immutable BEFORE UPDATE OR DELETE ON public.dev_class_meetings FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devmv_immutable BEFORE UPDATE OR DELETE ON public.dev_class_meeting_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devmn_immutable BEFORE UPDATE OR DELETE ON public.dev_meeting_notices FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_dev_meeting_version(_class uuid, _meeting uuid, _expected_version int, _status text,
  _on date, _starts time, _ends time, _location text, _trainers uuid[], _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int; _c public.dev_classes; _state text; _e uuid; _eng public.institutional_engagements;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_class_meeting_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('gerir-turmas-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _c FROM public.dev_classes WHERE id = _class FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT status INTO _state FROM public.dev_class_status_events WHERE class_id = _class ORDER BY seq DESC LIMIT 1;
  IF _state IS NULL OR _state IN ('concluida','cancelada') THEN RAISE EXCEPTION 'dev:class-closed'; END IF;
  IF _on < _c.starts_on OR _on > _c.ends_on THEN RAISE EXCEPTION 'dev:outside-class-period'; END IF;
  FOREACH _e IN ARRAY coalesce(_trainers, '{}'::uuid[]) LOOP
    SELECT * INTO _eng FROM public.institutional_engagements WHERE id = _e;
    IF NOT FOUND OR _eng.valid_from > _on OR (_eng.valid_until IS NOT NULL AND _eng.valid_until < _on) THEN RAISE EXCEPTION 'dev:trainer-not-active'; END IF;
  END LOOP;
  IF _meeting IS NULL THEN
    IF coalesce(_expected_version, 0) <> 0 THEN RAISE EXCEPTION 'dev:stale'; END IF;
    INSERT INTO public.dev_class_meetings(class_id, author_person, idempotency_key) VALUES (_class, _p, _key || ':meeting') RETURNING id INTO _meeting; _last := 0;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.dev_class_meetings WHERE id = _meeting AND class_id = _class) THEN RAISE EXCEPTION 'dev:invalid'; END IF;
    SELECT coalesce(max(version), 0) INTO _last FROM public.dev_class_meeting_versions WHERE meeting_id = _meeting;
    IF _last <> _expected_version THEN RAISE EXCEPTION 'dev:stale'; END IF;
    IF EXISTS (SELECT 1 FROM public.dev_class_meeting_versions WHERE meeting_id = _meeting AND version = _last AND status = 'cancelado') THEN RAISE EXCEPTION 'dev:meeting-cancelled'; END IF;
  END IF;
  INSERT INTO public.dev_class_meeting_versions(meeting_id, version, status, meeting_on, starts_at, ends_at, location, trainer_engagements, reason, author_person, idempotency_key)
  VALUES (_meeting, _last + 1, _status, _on, _starts, _ends, btrim(_location), _trainers, nullif(btrim(coalesce(_reason,'')),''), _p, _key) RETURNING id INTO _id;
  INSERT INTO public.dev_meeting_notices(meeting_version_id, event_kind)
  VALUES (_id, CASE WHEN _status = 'cancelado' THEN 'dev-encontro-cancelado' WHEN _last = 0 THEN 'dev-encontro-agendado' ELSE 'dev-encontro-alterado' END);
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;
REVOKE EXECUTE ON FUNCTION public.record_dev_meeting_version(uuid,uuid,int,text,date,time,time,text,uuid[],text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_dev_meeting_version(uuid,uuid,int,text,date,time,time,text,uuid[],text,text) TO authenticated;