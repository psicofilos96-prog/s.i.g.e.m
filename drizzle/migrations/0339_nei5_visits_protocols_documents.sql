-- NEI.5: agenda de visitas técnicas, providências com prazo, protocolos com devolutiva e documentos privados.
-- Destinatário é sempre conta EXISTENTE elegível no momento do envio (setor da escola, AEE do NEI, docente com atuação
-- vigente, responsável com autorização vigente em 'comunicados'); a caixa de entrada mostra só assunto sem dado clínico.
CREATE TABLE public.nei_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  student_id text,
  purpose text NOT NULL CHECK (length(btrim(purpose)) BETWEEN 5 AND 400),
  scheduled_on date NOT NULL,
  scheduled_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.nei_visit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.nei_visits(id),
  seq integer NOT NULL CHECK (seq >= 1),
  status text NOT NULL CHECK (status IN ('agendada','reagendada','realizada','cancelada')),
  on_date date NOT NULL,
  report text CHECK (report IS NULL OR length(report) <= 8000),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (visit_id, seq),
  CHECK (status <> 'realizada' OR length(btrim(coalesce(report,''))) >= 20),
  CHECK (status <> 'cancelada' OR length(btrim(coalesce(report,''))) >= 10)
);
CREATE TABLE public.nei_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  visit_id uuid REFERENCES public.nei_visits(id),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 5 AND 1000),
  due_on date,
  responsible_label text CHECK (responsible_label IS NULL OR length(responsible_label) <= 120),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.nei_action_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.nei_actions(id),
  seq integer NOT NULL CHECK (seq >= 1),
  status text NOT NULL CHECK (status IN ('aberta','em-andamento','concluida','cancelada')),
  note text NOT NULL CHECK (length(btrim(note)) >= 3),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (action_id, seq),
  CHECK (status NOT IN ('concluida','cancelada') OR length(btrim(note)) >= 10)
);
CREATE TABLE public.nei_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  student_id text,
  destination_kind text NOT NULL CHECK (destination_kind IN ('direcao','op','aee','docente','supervisao','familia')),
  recipient_user uuid NOT NULL,
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 5 AND 120),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 10 AND 4000),
  reply_due_on date,
  sent_by uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (destination_kind <> 'familia' OR student_id IS NOT NULL),
  CHECK (recipient_user <> sent_by)
);
CREATE TABLE public.nei_protocol_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id uuid NOT NULL REFERENCES public.nei_protocols(id),
  seq integer NOT NULL CHECK (seq >= 1),
  stage text NOT NULL CHECK (stage IN ('enviado','recebido','devolutiva','encerrado')),
  note text CHECK (note IS NULL OR length(note) <= 4000),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (protocol_id, seq),
  CHECK (stage <> 'devolutiva' OR length(btrim(coalesce(note,''))) >= 10)
);
-- Documentos: metadados aqui, conteúdo no bucket privado 'nei-documentos'. Retenção fica NULL até decisão institucional
-- (sem decisão, retém), porque prazo legal não nasce no código.
CREATE TABLE public.nei_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  visit_id uuid REFERENCES public.nei_visits(id),
  protocol_id uuid REFERENCES public.nei_protocols(id),
  object_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  retention_class text,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((visit_id IS NULL) <> (protocol_id IS NULL))
);
GRANT ALL ON public.nei_visits, public.nei_visit_events, public.nei_actions, public.nei_action_events, public.nei_protocols, public.nei_protocol_events, public.nei_documents TO service_role;
REVOKE ALL ON public.nei_visits, public.nei_visit_events, public.nei_actions, public.nei_action_events, public.nei_protocols, public.nei_protocol_events, public.nei_documents FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.nei_visits, public.nei_visit_events, public.nei_actions, public.nei_action_events, public.nei_protocols, public.nei_protocol_events, public.nei_documents FROM service_role;
GRANT INSERT ON public.nei_visits, public.nei_visit_events, public.nei_actions, public.nei_action_events, public.nei_protocols, public.nei_protocol_events, public.nei_documents TO service_role;
ALTER TABLE public.nei_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_visit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_action_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_protocol_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_documents ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER nei_vis_imm BEFORE UPDATE OR DELETE ON public.nei_visits FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_vise_imm BEFORE UPDATE OR DELETE ON public.nei_visit_events FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_act_imm BEFORE UPDATE OR DELETE ON public.nei_actions FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_acte_imm BEFORE UPDATE OR DELETE ON public.nei_action_events FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_pro_imm BEFORE UPDATE OR DELETE ON public.nei_protocols FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_proe_imm BEFORE UPDATE OR DELETE ON public.nei_protocol_events FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_doc_imm BEFORE UPDATE OR DELETE ON public.nei_documents FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();

-- Texto que sai do NEI para outro setor/família não carrega CID nem menção clínica.
CREATE OR REPLACE FUNCTION public.nei_text_has_clinical(_t text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT _t ~ '(^|[^A-Za-z0-9])[A-TV-Z][0-9]{2}(\.[0-9]{1,2})?([^0-9]|$)' OR _t ~* '(\mcid\M|\mlaudo|diagn[oó]stic|\mcl[ií]nic)'
$$;
GRANT EXECUTE ON FUNCTION public.nei_text_has_clinical(text) TO authenticated;

-- Elegibilidade do destinatário, verificada no envio.
CREATE OR REPLACE FUNCTION public.nei_recipient_eligible(_kind text, _user uuid, _school text, _student text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE _kind
    WHEN 'direcao' THEN EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.auth_user_id = _user AND p.station_code = 'direcao_escolar' AND (p.school_id = _school OR p.school_id IS NULL))
    WHEN 'op' THEN EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.auth_user_id = _user AND p.station_code = 'orientacao_pedagogica' AND (p.school_id = _school OR p.school_id IS NULL))
    WHEN 'supervisao' THEN EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.auth_user_id = _user AND p.station_code = 'supervisao')
    WHEN 'aee' THEN EXISTS (SELECT 1 FROM public.nei_active_grants(_user) g WHERE g.role = 'aee' AND (g.scope_kind = 'rede' OR g.school_id = _school))
    WHEN 'docente' THEN EXISTS (SELECT 1 FROM public.user_person_links l JOIN public.institutional_engagements e ON e.person_id = l.person_id
      WHERE l.user_id = _user AND e.school_id = _school AND public.nei_engagement_active_at(e.id, _school))
    WHEN 'familia' THEN _student IS NOT NULL AND EXISTS (SELECT 1 FROM public.guardian_authorizations a
      WHERE a.guardian_user_id = _user AND a.student_id = _student AND a.school_id = _school AND a.event_kind <> 'revogacao' AND 'comunicados' = ANY (a.sections)
        AND NOT EXISTS (SELECT 1 FROM public.guardian_authorizations s WHERE s.supersedes_id = a.id)
        AND a.valid_from <= CURRENT_DATE AND (a.valid_until IS NULL OR a.valid_until >= CURRENT_DATE))
    ELSE false END
$$;
REVOKE ALL ON FUNCTION public.nei_recipient_eligible(text,uuid,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nei_recipient_candidates(_school text, _kind text, _student text DEFAULT NULL)
RETURNS TABLE(user_id uuid, label text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT public.nei_school_manager(_school) THEN RETURN; END IF;
  RETURN QUERY
  SELECT DISTINCT u.uid, u.lbl FROM (
    SELECT p.auth_user_id AS uid, CASE p.station_code WHEN 'direcao_escolar' THEN 'Direção da escola' WHEN 'orientacao_pedagogica' THEN 'Orientação Pedagógica' ELSE 'Supervisão Escolar' END AS lbl
      FROM public.institutional_sector_principals p WHERE p.station_code IN ('direcao_escolar','orientacao_pedagogica','supervisao')
    UNION ALL SELECT g.user_id, coalesce((SELECT pe.display_name FROM public.user_person_links l JOIN public.institutional_persons pe ON pe.id = l.person_id WHERE l.user_id = g.user_id LIMIT 1), 'Professor(a) de AEE') FROM public.nei_role_grants g WHERE g.role = 'aee'
    UNION ALL SELECT l.user_id, pe.display_name FROM public.user_person_links l JOIN public.institutional_persons pe ON pe.id = l.person_id JOIN public.institutional_engagements e ON e.person_id = l.person_id WHERE e.school_id = _school
    UNION ALL SELECT a.guardian_user_id, 'Responsável autorizado' || coalesce(' — ' || (SELECT pe.display_name FROM public.institutional_persons pe WHERE pe.id = a.guardian_person_id), '') FROM public.guardian_authorizations a WHERE a.student_id = _student
  ) u WHERE u.uid IS NOT NULL AND u.uid <> auth.uid() AND public.nei_recipient_eligible(_kind, u.uid, _school, _student);
END $$;
REVOKE ALL ON FUNCTION public.nei_recipient_candidates(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_recipient_candidates(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.schedule_nei_visit(_school text, _student text, _purpose text, _on date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE vid uuid;
BEGIN
  IF NOT public.nei_school_manager(_school) THEN PERFORM public.nei_log('visita-agendar', _school, 'recusado'); RAISE EXCEPTION 'nei:not-authorized'; END IF;
  IF _student IS NOT NULL AND NOT public.nei_enrolled_in(_student, _school) THEN RAISE EXCEPTION 'nei:student-not-in-school'; END IF;
  INSERT INTO public.nei_visits(school_id, student_id, purpose, scheduled_on, scheduled_by) VALUES (_school, _student, _purpose, _on, auth.uid()) RETURNING id INTO vid;
  INSERT INTO public.nei_visit_events(visit_id, seq, status, on_date, recorded_by) VALUES (vid, 1, 'agendada', _on, auth.uid());
  PERFORM public.nei_log('visita-agendar', _school, 'permitido');
  RETURN vid;
END $$;
REVOKE ALL ON FUNCTION public.schedule_nei_visit(text,text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_nei_visit(text,text,text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_nei_visit_event(_visit uuid, _expected_seq integer, _status text, _on date, _report text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.nei_visits; last public.nei_visit_events;
BEGIN
  SELECT * INTO v FROM public.nei_visits WHERE id = _visit FOR UPDATE;
  IF v.id IS NULL OR NOT public.nei_school_manager(v.school_id) THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  SELECT * INTO last FROM public.nei_visit_events WHERE visit_id = _visit ORDER BY seq DESC LIMIT 1;
  IF last.seq <> _expected_seq THEN RAISE EXCEPTION 'nei:stale'; END IF;
  IF last.status IN ('realizada','cancelada') OR _status NOT IN ('reagendada','realizada','cancelada') THEN RAISE EXCEPTION 'nei:invalid-transition'; END IF;
  INSERT INTO public.nei_visit_events(visit_id, seq, status, on_date, report, recorded_by) VALUES (_visit, last.seq + 1, _status, coalesce(_on, last.on_date), _report, auth.uid());
  PERFORM public.nei_log('visita-' || _status, v.school_id, 'permitido');
END $$;
REVOKE ALL ON FUNCTION public.record_nei_visit_event(uuid,integer,text,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_visit_event(uuid,integer,text,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.open_nei_action(_school text, _visit uuid, _description text, _due date, _responsible text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE aid uuid;
BEGIN
  IF NOT public.nei_school_manager(_school) THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  IF _visit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.nei_visits WHERE id = _visit AND school_id = _school) THEN RAISE EXCEPTION 'nei:visit-not-found'; END IF;
  INSERT INTO public.nei_actions(school_id, visit_id, description, due_on, responsible_label, created_by) VALUES (_school, _visit, _description, _due, nullif(btrim(_responsible),''), auth.uid()) RETURNING id INTO aid;
  INSERT INTO public.nei_action_events(action_id, seq, status, note, recorded_by) VALUES (aid, 1, 'aberta', 'Providência registrada.', auth.uid());
  PERFORM public.nei_log('providencia-abrir', _school, 'permitido');
  RETURN aid;
END $$;
REVOKE ALL ON FUNCTION public.open_nei_action(text,uuid,text,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_nei_action(text,uuid,text,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_nei_action_event(_action uuid, _expected_seq integer, _status text, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.nei_actions; last public.nei_action_events;
BEGIN
  SELECT * INTO a FROM public.nei_actions WHERE id = _action FOR UPDATE;
  IF a.id IS NULL OR NOT public.nei_school_manager(a.school_id) THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  SELECT * INTO last FROM public.nei_action_events WHERE action_id = _action ORDER BY seq DESC LIMIT 1;
  IF last.seq <> _expected_seq THEN RAISE EXCEPTION 'nei:stale'; END IF;
  IF last.status IN ('concluida','cancelada') OR _status NOT IN ('em-andamento','concluida','cancelada') THEN RAISE EXCEPTION 'nei:invalid-transition'; END IF;
  INSERT INTO public.nei_action_events(action_id, seq, status, note, recorded_by) VALUES (_action, last.seq + 1, _status, _note, auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.record_nei_action_event(uuid,integer,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_action_event(uuid,integer,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_nei_protocol(_school text, _student text, _kind text, _recipient uuid, _subject text, _body text, _due date) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid uuid; n bigint;
BEGIN
  IF NOT public.nei_school_manager(_school) THEN PERFORM public.nei_log('protocolo-enviar', _school, 'recusado'); RAISE EXCEPTION 'nei:not-authorized'; END IF;
  IF _student IS NOT NULL AND NOT public.nei_enrolled_in(_student, _school) THEN RAISE EXCEPTION 'nei:student-not-in-school'; END IF;
  IF public.nei_text_has_clinical(_subject) OR public.nei_text_has_clinical(_body) THEN RAISE EXCEPTION 'nei:clinical-text'; END IF;
  IF NOT public.nei_recipient_eligible(_kind, _recipient, _school, _student) THEN RAISE EXCEPTION 'nei:recipient-not-eligible'; END IF;
  INSERT INTO public.nei_protocols(school_id, student_id, destination_kind, recipient_user, subject, body, reply_due_on, sent_by)
    VALUES (_school, _student, _kind, _recipient, btrim(_subject), _body, _due, auth.uid()) RETURNING id, number INTO pid, n;
  INSERT INTO public.nei_protocol_events(protocol_id, seq, stage, recorded_by) VALUES (pid, 1, 'enviado', auth.uid());
  PERFORM public.nei_log('protocolo-enviar', _school, 'permitido');
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.send_nei_protocol(text,text,text,uuid,text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_nei_protocol(text,text,text,uuid,text,text,date) TO authenticated;

-- Destinatário registra recebimento/devolutiva enquanto continuar elegível; remetente (gestão NEI) encerra.
CREATE OR REPLACE FUNCTION public.record_nei_protocol_event(_protocol uuid, _expected_seq integer, _stage text, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.nei_protocols; last public.nei_protocol_events;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO p FROM public.nei_protocols WHERE id = _protocol FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  SELECT * INTO last FROM public.nei_protocol_events WHERE protocol_id = _protocol ORDER BY seq DESC LIMIT 1;
  IF last.seq <> _expected_seq THEN RAISE EXCEPTION 'nei:stale'; END IF;
  IF _stage IN ('recebido','devolutiva') THEN
    IF p.recipient_user <> auth.uid() OR NOT public.nei_recipient_eligible(p.destination_kind, auth.uid(), p.school_id, p.student_id) THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
    IF NOT ((last.stage = 'enviado' AND _stage IN ('recebido','devolutiva')) OR (last.stage = 'recebido' AND _stage = 'devolutiva')) THEN RAISE EXCEPTION 'nei:invalid-transition'; END IF;
    IF _stage = 'devolutiva' AND public.nei_text_has_clinical(coalesce(_note,'')) AND p.destination_kind = 'familia' THEN RAISE EXCEPTION 'nei:clinical-text'; END IF;
  ELSIF _stage = 'encerrado' THEN
    IF NOT public.nei_school_manager(p.school_id) THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
    IF last.stage = 'encerrado' THEN RAISE EXCEPTION 'nei:invalid-transition'; END IF;
  ELSE RAISE EXCEPTION 'nei:invalid-transition'; END IF;
  INSERT INTO public.nei_protocol_events(protocol_id, seq, stage, note, recorded_by) VALUES (_protocol, last.seq + 1, _stage, nullif(btrim(_note),''), auth.uid());
  PERFORM public.nei_log('protocolo-' || _stage, p.school_id, 'permitido');
END $$;
REVOKE ALL ON FUNCTION public.record_nei_protocol_event(uuid,integer,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_protocol_event(uuid,integer,text,text) TO authenticated;

-- Caixa de entrada: lista só número, assunto, origem e situação (nada clínico, nada de estudante).
CREATE OR REPLACE FUNCTION public.nei_protocol_inbox() RETURNS TABLE(id uuid, number bigint, subject text, school_id text, sent_at timestamptz, reply_due_on date, last_stage text, last_seq integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  RETURN QUERY SELECT p.id, p.number, p.subject, p.school_id, p.sent_at, p.reply_due_on, e.stage, e.seq
    FROM public.nei_protocols p JOIN LATERAL (SELECT x.stage, x.seq FROM public.nei_protocol_events x WHERE x.protocol_id = p.id ORDER BY x.seq DESC LIMIT 1) e ON true
    WHERE p.recipient_user = auth.uid() AND public.nei_recipient_eligible(p.destination_kind, auth.uid(), p.school_id, p.student_id)
    ORDER BY p.sent_at DESC LIMIT 200;
END $$;
REVOKE ALL ON FUNCTION public.nei_protocol_inbox() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_protocol_inbox() TO authenticated;

-- Abrir o conteúdo grava trilha; quem perdeu a elegibilidade recebe NULL (recusa registrada).
CREATE OR REPLACE FUNCTION public.open_nei_protocol(_protocol uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.nei_protocols; ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO p FROM public.nei_protocols WHERE id = _protocol;
  ok := p.id IS NOT NULL AND ((p.recipient_user = auth.uid() AND public.nei_recipient_eligible(p.destination_kind, auth.uid(), p.school_id, p.student_id)) OR public.nei_school_manager(p.school_id));
  PERFORM public.nei_log('protocolo-abrir', p.school_id, CASE WHEN ok THEN 'permitido' ELSE 'recusado' END);
  IF NOT ok THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', p.id, 'number', p.number, 'subject', p.subject, 'body', p.body, 'destination_kind', p.destination_kind, 'reply_due_on', p.reply_due_on, 'sent_at', p.sent_at,
    'student_name', (SELECT coalesce(nullif(btrim(v.social_name),''), v.civil_name) FROM public.student_identity_versions v WHERE v.student_id = p.student_id ORDER BY v.version DESC LIMIT 1),
    'is_recipient', p.recipient_user = auth.uid(),
    'events', (SELECT jsonb_agg(jsonb_build_object('seq', e.seq, 'stage', e.stage, 'note', e.note, 'recorded_at', e.recorded_at) ORDER BY e.seq) FROM public.nei_protocol_events e WHERE e.protocol_id = p.id),
    'documents', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'file_name', d.file_name, 'object_path', d.object_path)) FROM public.nei_documents d WHERE d.protocol_id = p.id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.open_nei_protocol(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_nei_protocol(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.nei_school_agenda(_school text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL OR NOT public.nei_school_manager(_school) THEN PERFORM public.nei_log('agenda-escola', _school, 'recusado'); RETURN NULL; END IF;
  PERFORM public.nei_log('agenda-escola', _school, 'permitido');
  RETURN jsonb_build_object(
    'visits', coalesce((SELECT jsonb_agg(jsonb_build_object('id', v.id, 'purpose', v.purpose, 'has_student', v.student_id IS NOT NULL,
        'student_name', (SELECT coalesce(nullif(btrim(s.social_name),''), s.civil_name) FROM public.student_identity_versions s WHERE s.student_id = v.student_id ORDER BY s.version DESC LIMIT 1),
        'events', (SELECT jsonb_agg(jsonb_build_object('seq', e.seq, 'status', e.status, 'on_date', e.on_date, 'report', e.report, 'recorded_at', e.recorded_at) ORDER BY e.seq) FROM public.nei_visit_events e WHERE e.visit_id = v.id),
        'documents', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'file_name', d.file_name, 'object_path', d.object_path)) FROM public.nei_documents d WHERE d.visit_id = v.id), '[]'::jsonb))
      ORDER BY v.scheduled_on DESC) FROM public.nei_visits v WHERE v.school_id = _school), '[]'::jsonb),
    'actions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'visit_id', a.visit_id, 'description', a.description, 'due_on', a.due_on, 'responsible_label', a.responsible_label,
        'events', (SELECT jsonb_agg(jsonb_build_object('seq', e.seq, 'status', e.status, 'note', e.note, 'recorded_at', e.recorded_at) ORDER BY e.seq) FROM public.nei_action_events e WHERE e.action_id = a.id))
      ORDER BY a.due_on NULLS LAST, a.created_at) FROM public.nei_actions a WHERE a.school_id = _school), '[]'::jsonb),
    'protocols', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'number', p.number, 'subject', p.subject, 'destination_kind', p.destination_kind, 'reply_due_on', p.reply_due_on, 'sent_at', p.sent_at,
        'last_stage', (SELECT e.stage FROM public.nei_protocol_events e WHERE e.protocol_id = p.id ORDER BY e.seq DESC LIMIT 1),
        'last_seq', (SELECT max(e.seq) FROM public.nei_protocol_events e WHERE e.protocol_id = p.id)) ORDER BY p.sent_at DESC)
      FROM public.nei_protocols p WHERE p.school_id = _school), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.nei_school_agenda(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_school_agenda(text) TO authenticated;

-- Documentos: registrar metadados (antes do upload); acesso ao objeto só por estas regras.
CREATE OR REPLACE FUNCTION public.register_nei_document(_visit uuid, _protocol uuid, _file_name text, _mime text, _size integer) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sch text; owner uuid; path text;
BEGIN
  IF _visit IS NOT NULL THEN SELECT school_id INTO sch FROM public.nei_visits WHERE id = _visit; owner := _visit;
  ELSE SELECT school_id INTO sch FROM public.nei_protocols WHERE id = _protocol; owner := _protocol; END IF;
  IF sch IS NULL OR NOT public.nei_school_manager(sch) THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  path := owner::text || '/' || gen_random_uuid()::text || CASE _mime WHEN 'application/pdf' THEN '.pdf' WHEN 'image/png' THEN '.png' ELSE '.jpg' END;
  INSERT INTO public.nei_documents(school_id, visit_id, protocol_id, object_path, file_name, mime_type, size_bytes, recorded_by) VALUES (sch, _visit, _protocol, path, _file_name, _mime, _size, auth.uid());
  PERFORM public.nei_log('documento-registrar', sch, 'permitido');
  RETURN path;
END $$;
REVOKE ALL ON FUNCTION public.register_nei_document(uuid,uuid,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_nei_document(uuid,uuid,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.nei_document_allowed(_name text, _upload boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.nei_documents d LEFT JOIN public.nei_protocols p ON p.id = d.protocol_id
    WHERE d.object_path = _name AND CASE WHEN _upload THEN d.recorded_by = auth.uid() AND public.nei_school_manager(d.school_id)
      ELSE public.nei_school_manager(d.school_id) OR (p.recipient_user = auth.uid() AND public.nei_recipient_eligible(p.destination_kind, auth.uid(), p.school_id, p.student_id)) END)
$$;
REVOKE ALL ON FUNCTION public.nei_document_allowed(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_document_allowed(text,boolean) TO authenticated;

CREATE POLICY "nei_documentos_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'nei-documentos' AND public.nei_document_allowed(name, false));
CREATE POLICY "nei_documentos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'nei-documentos' AND public.nei_document_allowed(name, true));
