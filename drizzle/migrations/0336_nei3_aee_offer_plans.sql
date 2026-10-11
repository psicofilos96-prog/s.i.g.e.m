-- NEI.3: situação da oferta AEE (sobre aee_services existente), registro de atividades/recursos, agenda com conflitos,
-- planos AEE (PAEE) e PEI distintos, versionados, com revisão colaborativa e anexos privados. Tudo append-only.
CREATE TABLE public.nei_aee_offer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_logical_id uuid NOT NULL,
  seq integer NOT NULL CHECK (seq >= 1),
  status text NOT NULL CHECK (status IN ('planejada','iniciada','interrompida','retomada','encerrada')),
  room text CHECK (room IS NULL OR length(btrim(room)) BETWEEN 1 AND 120),
  cause text,
  effective_on date NOT NULL,
  note text,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (service_logical_id, seq),
  CHECK (status NOT IN ('interrompida','encerrada') OR length(btrim(coalesce(cause,''))) >= 5)
);
CREATE TABLE public.nei_aee_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_logical_id uuid NOT NULL,
  session_date date NOT NULL,
  activities text NOT NULL CHECK (length(btrim(activities)) BETWEEN 3 AND 4000),
  resources text CHECK (resources IS NULL OR length(resources) <= 2000),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.nei_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  kind text NOT NULL CHECK (kind IN ('paee','pei')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.nei_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.nei_plans(id),
  version integer NOT NULL CHECK (version >= 1),
  status text NOT NULL CHECK (status IN ('rascunho','em-revisao','concluido')),
  content jsonb NOT NULL,
  reason text,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (plan_id, version),
  CHECK (version = 1 OR length(btrim(coalesce(reason,''))) >= 5)
);
CREATE TABLE public.nei_plan_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.nei_plan_versions(id),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 2 AND 2000),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.nei_plan_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.nei_plans(id),
  object_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT ALL ON public.nei_aee_offer_events, public.nei_aee_activity_logs, public.nei_plans, public.nei_plan_versions, public.nei_plan_comments, public.nei_plan_attachments TO service_role;
REVOKE ALL ON public.nei_aee_offer_events, public.nei_aee_activity_logs, public.nei_plans, public.nei_plan_versions, public.nei_plan_comments, public.nei_plan_attachments FROM PUBLIC, anon, authenticated;
ALTER TABLE public.nei_aee_offer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_aee_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_plan_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_plan_attachments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER nei_offer_imm BEFORE UPDATE OR DELETE ON public.nei_aee_offer_events FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_act_imm BEFORE UPDATE OR DELETE ON public.nei_aee_activity_logs FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_plans_imm BEFORE UPDATE OR DELETE ON public.nei_plans FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_planv_imm BEFORE UPDATE OR DELETE ON public.nei_plan_versions FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_planc_imm BEFORE UPDATE OR DELETE ON public.nei_plan_comments FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_plana_imm BEFORE UPDATE OR DELETE ON public.nei_plan_attachments FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();

-- Atendimento AEE vigente (última versão do aee_services).
CREATE OR REPLACE FUNCTION public.nei_aee_service_head(_logical uuid) RETURNS public.aee_services
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.* FROM public.aee_services a WHERE a.logical_id = _logical ORDER BY a.version DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.nei_aee_service_head(uuid) FROM PUBLIC, anon, authenticated;

-- Transições da oferta: planejada→iniciada→(interrompida→retomada)*→encerrada.
CREATE OR REPLACE FUNCTION public.nei_offer_next_allowed(_from text, _to text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN _from IS NULL THEN _to IN ('planejada','iniciada')
    ELSE (_from, _to) IN (('planejada','iniciada'),('planejada','encerrada'),('iniciada','interrompida'),('iniciada','encerrada'),
      ('interrompida','retomada'),('interrompida','encerrada'),('retomada','interrompida'),('retomada','encerrada')) END
$$;

CREATE OR REPLACE FUNCTION public.record_nei_aee_offer_event(_service uuid, _expected_seq integer, _status text, _effective date, _room text DEFAULT NULL, _cause text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.aee_services; last public.nei_aee_offer_events; n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  s := public.nei_aee_service_head(_service);
  IF s.id IS NULL OR public.nei_student_role(s.student_id, s.school_id) IS NULL THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('nei-offer:' || _service::text));
  SELECT * INTO last FROM public.nei_aee_offer_events WHERE service_logical_id = _service ORDER BY seq DESC LIMIT 1;
  n := coalesce(last.seq, 0);
  IF n <> coalesce(_expected_seq, 0) THEN RAISE EXCEPTION 'nei:stale-version'; END IF;
  IF NOT public.nei_offer_next_allowed(last.status, _status) THEN RAISE EXCEPTION 'nei:invalid-transition'; END IF;
  IF last.effective_on IS NOT NULL AND _effective < last.effective_on THEN RAISE EXCEPTION 'nei:date-before-last'; END IF;
  INSERT INTO public.nei_aee_offer_events(service_logical_id, seq, status, room, cause, effective_on, note, recorded_by)
  VALUES (_service, n + 1, _status, coalesce(nullif(btrim(coalesce(_room,'')),''), last.room), nullif(btrim(coalesce(_cause,'')),''), _effective, _note, auth.uid());
  PERFORM public.nei_log('aee-oferta', s.school_id, 'permitido');
  RETURN n + 1;
END $$;
REVOKE ALL ON FUNCTION public.record_nei_aee_offer_event(uuid,integer,text,date,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_aee_offer_event(uuid,integer,text,date,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_nei_aee_activity(_service uuid, _date date, _activities text, _resources text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.aee_services; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  s := public.nei_aee_service_head(_service);
  IF s.id IS NULL OR public.nei_student_role(s.student_id, s.school_id) IS NULL THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  IF _date > CURRENT_DATE THEN RAISE EXCEPTION 'nei:future-date'; END IF;
  INSERT INTO public.nei_aee_activity_logs(service_logical_id, session_date, activities, resources, recorded_by) VALUES (_service, _date, _activities, nullif(btrim(coalesce(_resources,'')),''), auth.uid()) RETURNING id INTO nid;
  PERFORM public.nei_log('aee-atividade', s.school_id, 'permitido');
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_nei_aee_activity(uuid,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_aee_activity(uuid,date,text,text) TO authenticated;

-- Agenda AEE da escola: horários dos atendimentos vigentes, situação, sala e conflitos (mesmo profissional ou mesma sala sobrepostos).
CREATE OR REPLACE FUNCTION public.nei_aee_agenda(_school text)
RETURNS TABLE(service_logical_id uuid, student_id text, student_name text, responsible_name text, weekday smallint, starts_at time, ends_at time,
  status text, room text, last_seq integer, conflict_professional boolean, conflict_room boolean, sessions_30d bigint, presences_30d bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL OR NOT (public.nei_is_station(auth.uid()) OR EXISTS (SELECT 1 FROM public.nei_active_grants(auth.uid()) g WHERE g.scope_kind = 'rede' OR g.school_id = _school)) THEN
    PERFORM public.nei_log('aee-agenda', _school, 'recusado'); RETURN;
  END IF;
  PERFORM public.nei_log('aee-agenda', _school, 'permitido');
  RETURN QUERY
  WITH sv AS (
    SELECT DISTINCT ON (a.logical_id) a.* FROM public.aee_services a WHERE a.school_id = _school ORDER BY a.logical_id, a.version DESC
  ), cur AS (
    SELECT sv.* FROM sv WHERE sv.event_kind <> 'encerramento' AND (sv.valid_to IS NULL OR sv.valid_to >= CURRENT_DATE)
      AND public.nei_student_role(sv.student_id, sv.school_id) IS NOT NULL
  ), st AS (
    SELECT DISTINCT ON (o.service_logical_id) o.service_logical_id, o.status, o.room, o.seq FROM public.nei_aee_offer_events o
     WHERE o.service_logical_id IN (SELECT logical_id FROM cur) ORDER BY o.service_logical_id, o.seq DESC
  ), sl AS (
    SELECT cur.logical_id, cur.student_id, cur.responsible_engagement_id, x.weekday, x.starts_at, x.ends_at, st.status, st.room, st.seq
      FROM cur JOIN public.aee_service_slots x ON x.service_version_id = cur.id LEFT JOIN st ON st.service_logical_id = cur.logical_id
  )
  SELECT sl.logical_id, sl.student_id,
    (SELECT coalesce(nullif(btrim(v.social_name),''), v.civil_name) FROM public.student_identity_versions v WHERE v.student_id = sl.student_id ORDER BY v.version DESC LIMIT 1),
    (SELECT p.display_name FROM public.institutional_engagements e JOIN public.institutional_persons p ON p.id = e.person_id WHERE e.id = sl.responsible_engagement_id),
    sl.weekday, sl.starts_at, sl.ends_at, coalesce(sl.status, 'sem-registro'), sl.room, coalesce(sl.seq, 0),
    EXISTS (SELECT 1 FROM sl o WHERE o.logical_id <> sl.logical_id AND o.responsible_engagement_id = sl.responsible_engagement_id AND o.weekday = sl.weekday AND o.starts_at < sl.ends_at AND sl.starts_at < o.ends_at),
    sl.room IS NOT NULL AND EXISTS (SELECT 1 FROM sl o WHERE o.logical_id <> sl.logical_id AND o.room = sl.room AND o.weekday = sl.weekday AND o.starts_at < sl.ends_at AND sl.starts_at < o.ends_at),
    (SELECT count(DISTINCT s2.logical_id) FROM public.aee_sessions s2 WHERE s2.service_logical_id = sl.logical_id AND s2.session_date >= CURRENT_DATE - 30),
    NULL::bigint
  FROM sl ORDER BY sl.weekday, sl.starts_at;
END $$;
REVOKE ALL ON FUNCTION public.nei_aee_agenda(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_aee_agenda(text) TO authenticated;

-- Detalhe de um atendimento: histórico da oferta + atividades. Recusa = vazio registrado.
CREATE OR REPLACE FUNCTION public.nei_aee_service_detail(_service uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.aee_services;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  s := public.nei_aee_service_head(_service);
  IF s.id IS NULL OR public.nei_student_role(s.student_id, s.school_id) IS NULL THEN PERFORM public.nei_log('aee-detalhe', s.school_id, 'recusado'); RETURN NULL; END IF;
  PERFORM public.nei_log('aee-detalhe', s.school_id, 'permitido');
  RETURN jsonb_build_object(
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('seq', o.seq, 'status', o.status, 'room', o.room, 'cause', o.cause, 'effective_on', o.effective_on, 'note', o.note, 'recorded_at', o.recorded_at) ORDER BY o.seq) FROM public.nei_aee_offer_events o WHERE o.service_logical_id = _service), '[]'::jsonb),
    'activities', coalesce((SELECT jsonb_agg(jsonb_build_object('session_date', l.session_date, 'activities', l.activities, 'resources', l.resources, 'recorded_at', l.recorded_at) ORDER BY l.session_date DESC) FROM public.nei_aee_activity_logs l WHERE l.service_logical_id = _service), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.nei_aee_service_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_aee_service_detail(uuid) TO authenticated;

-- Planos: AEE escreve só PAEE; gestão escreve ambos; quem tem papel no caso lê e comenta.
CREATE OR REPLACE FUNCTION public.nei_plan_role(_plan uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.nei_student_role(p.student_id, p.school_id) FROM public.nei_plans p WHERE p.id = _plan
$$;
REVOKE ALL ON FUNCTION public.nei_plan_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_plan_role(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.nei_plan_content_problem(_c jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN jsonb_typeof(_c) <> 'object' THEN 'conteudo'
    WHEN _c ? 'metas' AND jsonb_typeof(_c->'metas') <> 'array' THEN 'metas'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(_c->'metas','[]'::jsonb)) m
                  WHERE length(btrim(coalesce(m->>'texto',''))) < 3 OR (m->>'prazo' IS NOT NULL AND m->>'prazo' !~ '^\d{4}-\d{2}-\d{2}$')) THEN 'meta-invalida'
    WHEN length(_c::text) > 60000 THEN 'grande' END
$$;

CREATE OR REPLACE FUNCTION public.create_nei_plan(_student text, _school text, _kind text, _title text, _content jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r text; pid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  r := public.nei_student_role(_student, _school);
  IF r IS NULL OR (r = 'aee' AND _kind <> 'paee') THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  IF NOT public.nei_enrolled_in(_student, _school) THEN RAISE EXCEPTION 'nei:student-not-in-school'; END IF;
  IF public.nei_plan_content_problem(_content) IS NOT NULL THEN RAISE EXCEPTION 'nei:plan-content:%', public.nei_plan_content_problem(_content); END IF;
  INSERT INTO public.nei_plans(student_id, school_id, kind, title, created_by) VALUES (_student, _school, _kind, _title, auth.uid()) RETURNING id INTO pid;
  INSERT INTO public.nei_plan_versions(plan_id, version, status, content, recorded_by) VALUES (pid, 1, 'rascunho', _content, auth.uid());
  PERFORM public.nei_log('plano-criacao', _school, 'permitido');
  RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.create_nei_plan(text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_nei_plan(text,text,text,text,jsonb) TO authenticated;

-- Nova versão: base esperada; status rascunho/em-revisao/concluido; concluído só por quem escreve e é terminal até nova revisão explícita (nova versão com motivo).
CREATE OR REPLACE FUNCTION public.record_nei_plan_version(_plan uuid, _expected_version integer, _status text, _content jsonb, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.nei_plans; r text; last integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO p FROM public.nei_plans WHERE id = _plan;
  r := public.nei_student_role(p.student_id, p.school_id);
  IF p.id IS NULL OR r IS NULL OR (r = 'aee' AND p.kind <> 'paee') THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('nei-plan:' || _plan::text));
  SELECT max(version) INTO last FROM public.nei_plan_versions WHERE plan_id = _plan;
  IF last <> _expected_version THEN RAISE EXCEPTION 'nei:stale-version'; END IF;
  IF public.nei_plan_content_problem(_content) IS NOT NULL THEN RAISE EXCEPTION 'nei:plan-content:%', public.nei_plan_content_problem(_content); END IF;
  INSERT INTO public.nei_plan_versions(plan_id, version, status, content, reason, recorded_by) VALUES (_plan, last + 1, _status, _content, _reason, auth.uid());
  PERFORM public.nei_log('plano-versao', p.school_id, 'permitido');
  RETURN last + 1;
END $$;
REVOKE ALL ON FUNCTION public.record_nei_plan_version(uuid,integer,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_plan_version(uuid,integer,text,jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_nei_plan_comment(_version uuid, _body text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid uuid; sc text; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT v.plan_id, p.school_id INTO pid, sc FROM public.nei_plan_versions v JOIN public.nei_plans p ON p.id = v.plan_id WHERE v.id = _version;
  IF pid IS NULL OR public.nei_plan_role(pid) IS NULL THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  INSERT INTO public.nei_plan_comments(version_id, body, recorded_by) VALUES (_version, _body, auth.uid()) RETURNING id INTO nid;
  PERFORM public.nei_log('plano-comentario', sc, 'permitido');
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_nei_plan_comment(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_plan_comment(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.nei_plans_for(_student text, _school text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  r := public.nei_student_role(_student, _school);
  IF r IS NULL THEN PERFORM public.nei_log('planos', _school, 'recusado'); RETURN NULL; END IF;
  PERFORM public.nei_log('planos', _school, 'permitido');
  RETURN jsonb_build_object('role', r, 'plans', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'title', p.title, 'created_at', p.created_at,
    'versions', (SELECT jsonb_agg(jsonb_build_object('id', v.id, 'version', v.version, 'status', v.status, 'content', v.content, 'reason', v.reason, 'recorded_at', v.recorded_at, 'mine', v.recorded_by = auth.uid(),
        'comments', coalesce((SELECT jsonb_agg(jsonb_build_object('body', c.body, 'recorded_at', c.recorded_at, 'mine', c.recorded_by = auth.uid()) ORDER BY c.recorded_at) FROM public.nei_plan_comments c WHERE c.version_id = v.id), '[]'::jsonb)) ORDER BY v.version)
      FROM public.nei_plan_versions v WHERE v.plan_id = p.id),
    'attachments', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'path', a.object_path, 'file_name', a.file_name, 'recorded_at', a.recorded_at) ORDER BY a.recorded_at) FROM public.nei_plan_attachments a WHERE a.plan_id = p.id), '[]'::jsonb))
    ORDER BY p.created_at DESC) FROM public.nei_plans p WHERE p.student_id = _student AND p.school_id = _school), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.nei_plans_for(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_plans_for(text,text) TO authenticated;

-- Anexo: metadado gravado antes do envio; caminho obrigatório <plan_id>/<uuid>-nome; leitura registrada.
CREATE OR REPLACE FUNCTION public.record_nei_plan_attachment(_plan uuid, _path text, _name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r text; sc text; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  r := public.nei_plan_role(_plan);
  SELECT school_id INTO sc FROM public.nei_plans WHERE id = _plan;
  IF r IS NULL OR (r = 'aee' AND (SELECT kind FROM public.nei_plans WHERE id = _plan) <> 'paee') THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  IF split_part(_path, '/', 1) <> _plan::text OR _path ~ '\.\.' THEN RAISE EXCEPTION 'nei:bad-path'; END IF;
  INSERT INTO public.nei_plan_attachments(plan_id, object_path, file_name, recorded_by) VALUES (_plan, _path, _name, auth.uid()) RETURNING id INTO nid;
  PERFORM public.nei_log('plano-anexo', sc, 'permitido');
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_nei_plan_attachment(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_plan_attachment(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.nei_plan_attachment_open(_attachment uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.nei_plan_attachments; sc text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO a FROM public.nei_plan_attachments WHERE id = _attachment;
  SELECT school_id INTO sc FROM public.nei_plans WHERE id = a.plan_id;
  IF a.id IS NULL OR public.nei_plan_role(a.plan_id) IS NULL THEN PERFORM public.nei_log('plano-anexo-leitura', sc, 'recusado'); RETURN NULL; END IF;
  PERFORM public.nei_log('plano-anexo-leitura', sc, 'permitido');
  RETURN a.object_path;
END $$;
REVOKE ALL ON FUNCTION public.nei_plan_attachment_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_plan_attachment_open(uuid) TO authenticated;

-- Armazenamento privado: só quem tem papel no caso do plano (pasta = plan_id). Upload só para anexo já registrado; nunca apagar/sobrescrever.
CREATE POLICY "nei_planos_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'nei-planos' AND EXISTS (SELECT 1 FROM public.nei_plan_attachments a WHERE a.object_path = name) AND public.nei_plan_role(((storage.foldername(name))[1])::uuid) IS NOT NULL);
CREATE POLICY "nei_planos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nei-planos' AND EXISTS (SELECT 1 FROM public.nei_plan_attachments a WHERE a.object_path = name AND a.recorded_by = auth.uid()) AND public.nei_plan_role(((storage.foldername(name))[1])::uuid) IS NOT NULL);