CREATE FUNCTION public.aa_infrequency_at(_school text DEFAULT NULL, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS TABLE(school_id text, class_id text, student_id text, enrollment_id text, period_id text, period_start date, present int, absent int, unmarked int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'infrequencia:unauthenticated'; END IF;
  IF NOT (public.has_network_capability('acompanhar-infrequencia')
    OR (_school IS NOT NULL AND public.has_school_capability('acompanhar-infrequencia', _school))) THEN RAISE EXCEPTION 'infrequencia:forbidden'; END IF;
  RETURN QUERY
  WITH les AS (
    SELECT DISTINCT ON (l.logical_record_id) l.logical_record_id, l.class_id, l.lesson_date, l.period_id
    FROM public.lesson_record_versions l
    WHERE (_from IS NULL OR l.lesson_date >= _from) AND (_to IS NULL OR l.lesson_date <= _to)
    ORDER BY l.logical_record_id, l.version_number DESC),
  att AS (
    SELECT DISTINCT ON (a.logical_attendance_id) a.lesson_logical_id, a.marks, a.eligible_student_ids
    FROM public.attendance_record_versions a ORDER BY a.logical_attendance_id, a.version_number DESC),
  slots AS (
    SELECT les.class_id, les.lesson_date, les.period_id, s.value AS m, att.eligible_student_ids AS elig
    FROM att JOIN les ON les.logical_record_id = att.lesson_logical_id, jsonb_each(att.marks) s),
  ep AS (
    SELECT e.school_id, e.class_id, e.student_id, e.enrollment_id, e.valid_from,
      (SELECT min(x.ended_on) FROM public.class_enrollment_episode_endings x WHERE x.episode_id = e.id) AS ended_on
    FROM public.class_enrollment_episodes e
    WHERE (_school IS NULL OR e.school_id = _school)
      AND (public.has_network_capability('acompanhar-infrequencia') OR public.has_school_capability('acompanhar-infrequencia', e.school_id)))
  SELECT ep.school_id, ep.class_id, ep.student_id, ep.enrollment_id, sl.period_id, min(sl.lesson_date),
    count(*) FILTER (WHERE sl.m->>ep.student_id = 'Presente')::int,
    count(*) FILTER (WHERE sl.m->>ep.student_id = 'Ausente')::int,
    count(*) FILTER (WHERE NOT (sl.m ? ep.student_id))::int
  FROM ep JOIN slots sl ON sl.class_id = ep.class_id AND sl.lesson_date >= ep.valid_from AND (ep.ended_on IS NULL OR sl.lesson_date <= ep.ended_on)
  GROUP BY ep.school_id, ep.class_id, ep.student_id, ep.enrollment_id, sl.period_id;
END $$;
REVOKE ALL ON FUNCTION public.aa_infrequency_at(text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aa_infrequency_at(text, date, date) TO authenticated;

CREATE TABLE public.aa_outreach_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL, class_id text NOT NULL, student_id text NOT NULL, enrollment_id text,
  basis_mode text NOT NULL CHECK (basis_mode IN ('periodo','acumulado')), basis_period text NOT NULL,
  basis_presence_pct numeric NOT NULL CHECK (basis_presence_pct >= 0 AND basis_presence_pct < 75),
  responsible_label text, opened_by uuid NOT NULL, opened_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id, basis_mode, basis_period)
);
CREATE TABLE public.aa_outreach_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.aa_outreach_cases(id), seq int NOT NULL,
  kind text NOT NULL CHECK (kind IN ('contato','encaminhamento','retorno','resolucao','responsavel')),
  guardian_label text, channel text, destination text, due_date date, note text NOT NULL,
  author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, seq)
);
GRANT SELECT ON public.aa_outreach_cases, public.aa_outreach_events TO authenticated;
GRANT ALL ON public.aa_outreach_cases, public.aa_outreach_events TO service_role;
ALTER TABLE public.aa_outreach_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aa_outreach_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY aa_out_case_read ON public.aa_outreach_cases FOR SELECT TO authenticated USING (
  public.has_network_capability('acompanhar-infrequencia') OR public.has_school_capability('acompanhar-infrequencia', school_id)
  OR public.has_school_capability('registrar-busca-ativa', school_id));
CREATE POLICY aa_out_ev_read ON public.aa_outreach_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.aa_outreach_cases c WHERE c.id = case_id));
CREATE FUNCTION public.aa_outreach_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'busca-ativa:append-only'; END $$;
CREATE TRIGGER aa_out_case_ro BEFORE UPDATE OR DELETE ON public.aa_outreach_cases FOR EACH ROW EXECUTE FUNCTION public.aa_outreach_append_only();
CREATE TRIGGER aa_out_ev_ro BEFORE UPDATE OR DELETE ON public.aa_outreach_events FOR EACH ROW EXECUTE FUNCTION public.aa_outreach_append_only();

CREATE FUNCTION public.aa_open_outreach_case(_school text, _class text, _student text, _enrollment text, _mode text, _period text, _pct numeric, _responsible text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'busca-ativa:unauthenticated'; END IF;
  IF NOT public.has_school_capability('registrar-busca-ativa', _school) THEN RAISE EXCEPTION 'busca-ativa:forbidden'; END IF;
  IF _pct IS NULL OR _pct >= 75 THEN RAISE EXCEPTION 'busca-ativa:not-below-threshold'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.school_id = _school AND e.class_id = _class AND e.student_id = _student) THEN RAISE EXCEPTION 'busca-ativa:enrollment-not-found'; END IF;
  INSERT INTO public.aa_outreach_cases(school_id, class_id, student_id, enrollment_id, basis_mode, basis_period, basis_presence_pct, responsible_label, opened_by)
  VALUES (_school, _class, _student, _enrollment, _mode, _period, _pct, nullif(btrim(coalesce(_responsible,'')),''), auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;
CREATE FUNCTION public.aa_record_outreach_event(_case uuid, _expected_seq int, _kind text, _guardian text, _channel text, _destination text, _due date, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.aa_outreach_cases; last_seq int; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'busca-ativa:unauthenticated'; END IF;
  SELECT * INTO c FROM public.aa_outreach_cases WHERE id = _case FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'busca-ativa:not-found'; END IF;
  IF NOT public.has_school_capability('registrar-busca-ativa', c.school_id) THEN RAISE EXCEPTION 'busca-ativa:forbidden'; END IF;
  SELECT coalesce(max(seq),0) INTO last_seq FROM public.aa_outreach_events WHERE case_id = _case;
  IF last_seq <> coalesce(_expected_seq,0) THEN RAISE EXCEPTION 'busca-ativa:stale-base'; END IF;
  IF EXISTS (SELECT 1 FROM public.aa_outreach_events WHERE case_id = _case AND kind = 'resolucao') THEN RAISE EXCEPTION 'busca-ativa:case-closed'; END IF;
  IF length(btrim(coalesce(_note,''))) < 5 THEN RAISE EXCEPTION 'busca-ativa:note-required'; END IF;
  IF _kind = 'contato' AND (length(btrim(coalesce(_guardian,''))) = 0 OR length(btrim(coalesce(_channel,''))) = 0) THEN RAISE EXCEPTION 'busca-ativa:contact-requires-guardian-channel'; END IF;
  IF _kind = 'encaminhamento' AND (length(btrim(coalesce(_destination,''))) = 0 OR _due IS NULL) THEN RAISE EXCEPTION 'busca-ativa:referral-requires-destination-due'; END IF;
  IF _kind = 'responsavel' AND length(btrim(coalesce(_guardian,''))) = 0 THEN RAISE EXCEPTION 'busca-ativa:responsible-required'; END IF;
  IF _kind = 'resolucao' AND NOT EXISTS (SELECT 1 FROM public.aa_outreach_events WHERE case_id = _case AND kind = 'retorno') THEN RAISE EXCEPTION 'busca-ativa:resolution-requires-return'; END IF;
  INSERT INTO public.aa_outreach_events(case_id, seq, kind, guardian_label, channel, destination, due_date, note, author_user_id)
  VALUES (_case, last_seq + 1, _kind, nullif(btrim(coalesce(_guardian,'')),''), nullif(btrim(coalesce(_channel,'')),''), nullif(btrim(coalesce(_destination,'')),''), _due, btrim(_note), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.aa_open_outreach_case(text,text,text,text,text,text,numeric,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aa_record_outreach_event(uuid,int,text,text,text,text,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aa_open_outreach_case(text,text,text,text,text,text,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aa_record_outreach_event(uuid,int,text,text,text,text,date,text) TO authenticated;