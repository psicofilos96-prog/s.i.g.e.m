-- NEI.2: ficha NEI sobre o estudante central (sem cadastro paralelo) e gestão de casos com histórico append-only.
CREATE TABLE public.nei_profile_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  section text NOT NULL CHECK (section IN ('necessidades','acessibilidade','aee','planos','apoios','avaliacoes','encaminhamentos')),
  content text NOT NULL CHECK (length(btrim(content)) BETWEEN 3 AND 8000),
  supersedes_id uuid REFERENCES public.nei_profile_entries(id),
  correction_reason text,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (supersedes_id IS NULL OR length(btrim(coalesce(correction_reason,''))) >= 5)
);
CREATE UNIQUE INDEX nei_profile_one_successor ON public.nei_profile_entries(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX nei_profile_student ON public.nei_profile_entries(student_id);

CREATE TABLE public.nei_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  request_summary text NOT NULL CHECK (length(btrim(request_summary)) BETWEEN 10 AND 4000),
  requested_by_label text,
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX nei_cases_student ON public.nei_cases(student_id);

CREATE TABLE public.nei_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.nei_cases(id),
  seq integer NOT NULL CHECK (seq >= 1),
  stage text NOT NULL CHECK (stage IN ('solicitacao','triagem','analise','providencias','designacao','execucao','monitoramento','reavaliacao','encerramento')),
  note text NOT NULL CHECK (length(btrim(note)) >= 3),
  priority text CHECK (priority IS NULL OR length(btrim(priority)) BETWEEN 1 AND 40),
  due_date date,
  assignee_user uuid,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (case_id, seq),
  CHECK (stage <> 'encerramento' OR length(btrim(note)) >= 10)
);

GRANT ALL ON public.nei_profile_entries, public.nei_cases, public.nei_case_events TO service_role;
REVOKE ALL ON public.nei_profile_entries, public.nei_cases, public.nei_case_events FROM PUBLIC, anon, authenticated;
ALTER TABLE public.nei_profile_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_case_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER nei_profile_immutable BEFORE UPDATE OR DELETE ON public.nei_profile_entries FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_cases_immutable BEFORE UPDATE OR DELETE ON public.nei_cases FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_case_events_immutable BEFORE UPDATE OR DELETE ON public.nei_case_events FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();

-- Papel efetivo da conta sobre um estudante/escola: 'gestao' (coordenação, técnico, estação), 'aee', ou NULL.
CREATE OR REPLACE FUNCTION public.nei_student_role(_student text, _school text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN public.nei_is_station(auth.uid()) THEN 'gestao'
    WHEN EXISTS (SELECT 1 FROM public.nei_active_grants(auth.uid()) g WHERE g.role IN ('coordenador','tecnico')
      AND (g.scope_kind = 'rede' OR (g.scope_kind = 'escola' AND g.school_id = _school) OR (g.scope_kind = 'caso' AND g.student_id = _student AND g.school_id = _school))) THEN 'gestao'
    WHEN EXISTS (SELECT 1 FROM public.nei_active_grants(auth.uid()) g WHERE g.role = 'aee'
      AND ((g.scope_kind = 'escola' AND g.school_id = _school) OR (g.scope_kind = 'caso' AND g.student_id = _student AND g.school_id = _school))) THEN 'aee'
  END
$$;
REVOKE ALL ON FUNCTION public.nei_student_role(text,text) FROM PUBLIC, anon, authenticated;

-- Matrícula vigente na escola (estudante central; nunca cadastro paralelo).
CREATE OR REPLACE FUNCTION public.nei_enrolled_in(_student text, _school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e
    WHERE e.student_id = _student AND e.school_id = _school AND e.valid_from <= CURRENT_DATE
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings x WHERE x.episode_id = e.id AND x.ended_on <= CURRENT_DATE)
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = e.id))
$$;
REVOKE ALL ON FUNCTION public.nei_enrolled_in(text,text) FROM PUBLIC, anon, authenticated;

-- Busca nominal só dentro da escola autorizada, com trilha. Recusa = vazio, com registro.
CREATE OR REPLACE FUNCTION public.nei_student_search(_school text, _q text)
RETURNS TABLE(student_id text, name text, class_label text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL OR length(btrim(coalesce(_q,''))) < 3 THEN RETURN; END IF;
  IF NOT (public.nei_is_station(auth.uid()) OR EXISTS (SELECT 1 FROM public.nei_active_grants(auth.uid()) g
      WHERE g.scope_kind = 'rede' OR g.school_id = _school)) THEN
    PERFORM public.nei_log('busca-estudante', _school, 'recusado'); RETURN;
  END IF;
  PERFORM public.nei_log('busca-estudante', _school, 'permitido');
  RETURN QUERY
  WITH cur AS (
    SELECT DISTINCT ON (e.student_id) e.student_id, e.class_label_snapshot FROM public.class_enrollment_episodes e
     WHERE e.school_id = _school AND e.valid_from <= CURRENT_DATE
       AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings x WHERE x.episode_id = e.id AND x.ended_on <= CURRENT_DATE)
       AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = e.id)
     ORDER BY e.student_id, e.valid_from DESC
  ), idn AS (
    SELECT DISTINCT ON (v.student_id) v.student_id, coalesce(nullif(btrim(v.social_name),''), v.civil_name) AS nm
      FROM public.student_identity_versions v ORDER BY v.student_id, v.version DESC
  )
  SELECT cur.student_id, idn.nm, cur.class_label_snapshot FROM cur JOIN idn USING (student_id)
   WHERE idn.nm ILIKE '%' || btrim(_q) || '%'
     AND public.nei_student_role(cur.student_id, _school) IS NOT NULL
   ORDER BY 2 LIMIT 30;
END $$;
REVOKE ALL ON FUNCTION public.nei_student_search(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_student_search(text,text) TO authenticated;

-- Ficha NEI completa (identificação central + ficha + casos + linha do tempo). Recusa = NULL, com registro.
CREATE OR REPLACE FUNCTION public.nei_student_file(_student text, _school text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r text; out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  r := public.nei_student_role(_student, _school);
  IF r IS NULL OR NOT public.nei_enrolled_in(_student, _school) THEN
    PERFORM public.nei_log('ficha', _school, 'recusado'); RETURN NULL;
  END IF;
  PERFORM public.nei_log('ficha', _school, 'permitido');
  SELECT jsonb_build_object(
    'role', r,
    'identity', (SELECT jsonb_build_object('civil_name', v.civil_name, 'social_name', v.social_name, 'birth_date', v.birth_date)
                   FROM public.student_identity_versions v WHERE v.student_id = _student ORDER BY v.version DESC LIMIT 1),
    'enrollments', coalesce((SELECT jsonb_agg(jsonb_build_object('class_label', e.class_label_snapshot, 'valid_from', e.valid_from) ORDER BY e.valid_from DESC)
                   FROM public.class_enrollment_episodes e WHERE e.student_id = _student AND e.school_id = _school
                    AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings x WHERE x.episode_id = e.id AND x.ended_on <= CURRENT_DATE)
                    AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = e.id)), '[]'::jsonb),
    'entries', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'section', p.section, 'content', p.content, 'supersedes_id', p.supersedes_id,
                    'correction_reason', p.correction_reason, 'recorded_at', p.recorded_at, 'mine', p.recorded_by = auth.uid(),
                    'current', NOT EXISTS (SELECT 1 FROM public.nei_profile_entries n WHERE n.supersedes_id = p.id)) ORDER BY p.recorded_at)
                   FROM public.nei_profile_entries p WHERE p.student_id = _student AND p.school_id = _school), '[]'::jsonb),
    'cases', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'request_summary', c.request_summary, 'requested_by_label', c.requested_by_label, 'opened_at', c.opened_at,
                    'events', (SELECT jsonb_agg(jsonb_build_object('seq', ev.seq, 'stage', ev.stage, 'note', ev.note, 'priority', ev.priority, 'due_date', ev.due_date,
                                 'assigned', ev.assignee_user IS NOT NULL, 'assigned_to_me', ev.assignee_user = auth.uid(), 'recorded_at', ev.recorded_at, 'mine', ev.recorded_by = auth.uid()) ORDER BY ev.seq)
                               FROM public.nei_case_events ev WHERE ev.case_id = c.id)) ORDER BY c.opened_at DESC)
                   FROM public.nei_cases c WHERE c.student_id = _student AND c.school_id = _school), '[]'::jsonb),
    'pedagogical_records', (SELECT count(DISTINCT ir.logical_id) FROM public.inclusion_records ir WHERE ir.student_id = _student AND ir.school_id = _school)
  ) INTO out;
  RETURN out;
END $$;
REVOKE ALL ON FUNCTION public.nei_student_file(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_student_file(text,text) TO authenticated;

-- Registro na ficha. AEE só grava a seção AEE; correção cria nova versão sobre a vigente.
CREATE OR REPLACE FUNCTION public.record_nei_profile_entry(_student text, _school text, _section text, _content text, _supersedes uuid DEFAULT NULL, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r text; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  r := public.nei_student_role(_student, _school);
  IF r IS NULL OR (r = 'aee' AND _section <> 'aee') THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  IF NOT public.nei_enrolled_in(_student, _school) THEN RAISE EXCEPTION 'nei:student-not-in-school'; END IF;
  IF _supersedes IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.nei_profile_entries p WHERE p.id = _supersedes AND p.student_id = _student AND p.school_id = _school AND p.section = _section
       AND NOT EXISTS (SELECT 1 FROM public.nei_profile_entries n WHERE n.supersedes_id = p.id)) THEN RAISE EXCEPTION 'nei:stale-version'; END IF;
  INSERT INTO public.nei_profile_entries(student_id, school_id, section, content, supersedes_id, correction_reason, recorded_by)
  VALUES (_student, _school, _section, _content, _supersedes, _reason, auth.uid()) RETURNING id INTO nid;
  PERFORM public.nei_log('ficha-registro', _school, 'permitido');
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_nei_profile_entry(text,text,text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_profile_entry(text,text,text,text,uuid,text) TO authenticated;

-- Abertura de caso (solicitação). Só gestão; laudo nunca é exigido.
CREATE OR REPLACE FUNCTION public.open_nei_case(_student text, _school text, _summary text, _requested_by text DEFAULT NULL, _priority text DEFAULT NULL, _due date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF public.nei_student_role(_student, _school) IS DISTINCT FROM 'gestao' THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  IF NOT public.nei_enrolled_in(_student, _school) THEN RAISE EXCEPTION 'nei:student-not-in-school'; END IF;
  INSERT INTO public.nei_cases(student_id, school_id, request_summary, requested_by_label, opened_by) VALUES (_student, _school, _summary, nullif(btrim(coalesce(_requested_by,'')),''), auth.uid()) RETURNING id INTO cid;
  INSERT INTO public.nei_case_events(case_id, seq, stage, note, priority, due_date, recorded_by) VALUES (cid, 1, 'solicitacao', _summary, nullif(btrim(coalesce(_priority,'')),''), _due, auth.uid());
  PERFORM public.nei_log('caso-abertura', _school, 'permitido');
  RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.open_nei_case(text,text,text,text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_nei_case(text,text,text,text,text,date) TO authenticated;

-- Transição/andamento: só etapas admitidas a partir da última; encerramento é terminal e justificado; base esperada (seq).
CREATE OR REPLACE FUNCTION public.nei_case_next_allowed(_from text, _to text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT _from <> 'encerramento' AND (_to = _from OR (_from, _to) IN (
    ('solicitacao','triagem'),('triagem','analise'),('analise','providencias'),('providencias','designacao'),('designacao','execucao'),
    ('execucao','monitoramento'),('monitoramento','reavaliacao'),('reavaliacao','execucao'),('reavaliacao','providencias'),
    ('triagem','encerramento'),('analise','encerramento'),('monitoramento','encerramento'),('reavaliacao','encerramento')))
$$;

CREATE OR REPLACE FUNCTION public.record_nei_case_event(_case uuid, _expected_seq integer, _stage text, _note text, _priority text DEFAULT NULL, _due date DEFAULT NULL, _assignee uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.nei_cases; last public.nei_case_events; r text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO c FROM public.nei_cases WHERE id = _case FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  r := public.nei_student_role(c.student_id, c.school_id);
  IF r IS NULL THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  SELECT * INTO last FROM public.nei_case_events WHERE case_id = _case ORDER BY seq DESC LIMIT 1;
  IF last.seq <> _expected_seq THEN RAISE EXCEPTION 'nei:stale-version'; END IF;
  -- AEE só registra andamento na etapa vigente (sem mudar etapa, prazo, prioridade ou responsável).
  IF r = 'aee' AND (_stage <> last.stage OR _priority IS NOT NULL OR _due IS NOT NULL OR _assignee IS NOT NULL) THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  IF NOT public.nei_case_next_allowed(last.stage, _stage) THEN RAISE EXCEPTION 'nei:invalid-transition'; END IF;
  IF _assignee IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.nei_active_grants(_assignee) g
       WHERE g.scope_kind = 'rede' OR g.school_id = c.school_id) AND NOT public.nei_is_station(_assignee) THEN RAISE EXCEPTION 'nei:assignee-without-role'; END IF;
  INSERT INTO public.nei_case_events(case_id, seq, stage, note, priority, due_date, assignee_user, recorded_by)
  VALUES (_case, last.seq + 1, _stage, _note,
          coalesce(nullif(btrim(coalesce(_priority,'')),''), last.priority), coalesce(_due, last.due_date), coalesce(_assignee, last.assignee_user), auth.uid());
  PERFORM public.nei_log('caso-andamento', c.school_id, 'permitido');
  RETURN last.seq + 1;
END $$;
REVOKE ALL ON FUNCTION public.record_nei_case_event(uuid,integer,text,text,text,date,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_case_event(uuid,integer,text,text,text,date,uuid) TO authenticated;

-- Responsáveis possíveis para designação: contas com papel NEI vigente na escola (sem dado além do nome).
CREATE OR REPLACE FUNCTION public.nei_case_assignees(_school text) RETURNS TABLE(user_id uuid, person_name text, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.nei_is_station(auth.uid()) OR EXISTS (SELECT 1 FROM public.nei_active_grants(auth.uid()) g WHERE g.role IN ('coordenador','tecnico') AND (g.scope_kind='rede' OR g.school_id=_school))) THEN RETURN; END IF;
  RETURN QUERY SELECT DISTINCT g.user_id, pe.full_name, g.role
    FROM public.nei_role_grants g
    JOIN public.user_person_links l ON l.user_id = g.user_id
    JOIN public.institutional_persons pe ON pe.id = l.person_id
   WHERE EXISTS (SELECT 1 FROM public.nei_active_grants(g.user_id) a WHERE a.id = g.id) AND (g.scope_kind = 'rede' OR g.school_id = _school)
   ORDER BY 2;
END $$;
REVOKE ALL ON FUNCTION public.nei_case_assignees(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_case_assignees(text) TO authenticated;