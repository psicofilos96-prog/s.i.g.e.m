-- SIGEM Desenvolvimento L12: frequência por encontro (presencial/remoto síncrono) e por atividade assíncrona, com evidência.
-- Abrir/baixar material NÃO é evidência aceita. Correção = nova versão com motivo, nunca edição.
CREATE TABLE public.dev_class_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.dev_classes(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 200),
  opens_on date NOT NULL,
  closes_on date NOT NULL,
  completion_evidence text NOT NULL CHECK (length(btrim(completion_evidence)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_on >= opens_on)
);
CREATE TABLE public.dev_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.dev_enrollments(id),
  meeting_id uuid REFERENCES public.dev_class_meetings(id),
  activity_id uuid REFERENCES public.dev_class_activities(id),
  version int NOT NULL CHECK (version >= 1),
  mode text NOT NULL CHECK (mode IN ('presencial','remota-sincrona','assincrona')),
  status text NOT NULL CHECK (status IN ('presente','ausente','ausencia-justificada')),
  evidence_kind text CHECK (evidence_kind IN ('lista-de-presenca','registro-de-conexao-com-duracao','entrega-de-atividade','observacao-do-formador')),
  evidence_ref text CHECK (evidence_ref IS NULL OR length(btrim(evidence_ref)) BETWEEN 3 AND 300),
  connected_minutes int CHECK (connected_minutes IS NULL OR connected_minutes >= 0),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  recorder_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((meeting_id IS NULL) <> (activity_id IS NULL)),
  CHECK ((activity_id IS NOT NULL) = (mode = 'assincrona')),
  CHECK (status <> 'presente' OR (evidence_kind IS NOT NULL AND evidence_ref IS NOT NULL)),
  CHECK (mode <> 'assincrona' OR status <> 'presente' OR evidence_kind = 'entrega-de-atividade'),
  CHECK (mode <> 'remota-sincrona' OR status <> 'presente' OR (evidence_kind IN ('registro-de-conexao-com-duracao','observacao-do-formador') AND (evidence_kind <> 'registro-de-conexao-com-duracao' OR connected_minutes IS NOT NULL))),
  CHECK (status <> 'ausencia-justificada' OR reason IS NOT NULL),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE UNIQUE INDEX dev_attendance_meeting_version ON public.dev_attendance_records(enrollment_id, meeting_id, version) WHERE meeting_id IS NOT NULL;
CREATE UNIQUE INDEX dev_attendance_activity_version ON public.dev_attendance_records(enrollment_id, activity_id, version) WHERE activity_id IS NOT NULL;
GRANT SELECT ON public.dev_class_activities, public.dev_attendance_records TO authenticated;
GRANT ALL ON public.dev_class_activities, public.dev_attendance_records TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_class_activities, public.dev_attendance_records FROM authenticated, anon;
ALTER TABLE public.dev_class_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev activities read" ON public.dev_class_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev attendance read" ON public.dev_attendance_records FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_enrollments e WHERE e.id = enrollment_id
    AND (e.person_id = public.current_person_id() OR public.dev_can_manage() OR public.dev_is_active_trainer(e.class_id))));
CREATE TRIGGER devact_immutable BEFORE UPDATE OR DELETE ON public.dev_class_activities FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devatt_immutable BEFORE UPDATE OR DELETE ON public.dev_attendance_records FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_dev_class_activity(_class uuid, _title text, _opens date, _closes date, _evidence text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _c public.dev_classes;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_class_activities WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT (public.has_network_capability('gerir-turmas-de-formacao') OR public.dev_is_active_trainer(_class)) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _c FROM public.dev_classes WHERE id = _class;
  IF NOT FOUND OR _opens < _c.starts_on OR _closes > _c.ends_on THEN RAISE EXCEPTION 'dev:outside-class-period'; END IF;
  INSERT INTO public.dev_class_activities(class_id, title, opens_on, closes_on, completion_evidence, author_person, idempotency_key)
  VALUES (_class, btrim(_title), _opens, _closes, btrim(_evidence), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Registro/correção: formador vigente ou gestão; nunca o próprio participante. Só inscrição confirmada e não encerrada.
CREATE OR REPLACE FUNCTION public.record_dev_attendance(_enrollment uuid, _meeting uuid, _activity uuid, _expected_version int,
  _mode text, _status text, _evidence_kind text, _evidence_ref text, _minutes int, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _e public.dev_enrollments; _last int; _target_class uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_attendance_records WHERE idempotency_key = _key AND recorder_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF NOT (public.has_network_capability('gerir-turmas-de-formacao') OR public.dev_is_active_trainer(_e.class_id)) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _e.person_id = _p THEN RAISE EXCEPTION 'dev:self-attendance'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind = 'confirmacao') THEN RAISE EXCEPTION 'dev:not-confirmed'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind IN ('conclusao','nao-conclusao','cancelamento')) THEN RAISE EXCEPTION 'dev:terminal'; END IF;
  IF _meeting IS NOT NULL THEN
    SELECT class_id INTO _target_class FROM public.dev_class_meetings WHERE id = _meeting;
    IF EXISTS (SELECT 1 FROM public.dev_class_meeting_versions v WHERE v.meeting_id = _meeting AND v.status = 'cancelado'
               AND v.version = (SELECT max(version) FROM public.dev_class_meeting_versions WHERE meeting_id = _meeting)) THEN RAISE EXCEPTION 'dev:meeting-cancelled'; END IF;
    SELECT coalesce(max(version), 0) INTO _last FROM public.dev_attendance_records WHERE enrollment_id = _enrollment AND meeting_id = _meeting;
  ELSE
    SELECT class_id INTO _target_class FROM public.dev_class_activities WHERE id = _activity;
    SELECT coalesce(max(version), 0) INTO _last FROM public.dev_attendance_records WHERE enrollment_id = _enrollment AND activity_id = _activity;
  END IF;
  IF _target_class IS DISTINCT FROM _e.class_id THEN RAISE EXCEPTION 'dev:other-class'; END IF;
  IF _last <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_attendance_records(enrollment_id, meeting_id, activity_id, version, mode, status, evidence_kind, evidence_ref, connected_minutes, reason, recorder_person, idempotency_key)
  VALUES (_enrollment, _meeting, _activity, _last + 1, _mode, _status, _evidence_kind, nullif(btrim(coalesce(_evidence_ref,'')),''), _minutes,
          nullif(btrim(coalesce(_reason,'')),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR unique_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_dev_class_activity(uuid,text,date,date,text,text)',
    'record_dev_attendance(uuid,uuid,uuid,int,text,text,text,text,int,text,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;