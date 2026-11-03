-- Acompanhamento institucional de unidades escolares. Domínio distinto da Supervisão formal.
-- Aditivo, append-only, sem permissões automáticas. Gabinete lê; equipe humana registra.
CREATE TABLE public.school_institutional_followup_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  supersedes_id uuid UNIQUE REFERENCES public.school_institutional_followup_visits(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  visit_date date NOT NULL,
  diagnosis text NOT NULL CHECK (length(btrim(diagnosis)) BETWEEN 1 AND 10000),
  strengths text NOT NULL DEFAULT '' CHECK (length(strengths) <= 10000),
  weaknesses text NOT NULL DEFAULT '' CHECK (length(weaknesses) <= 10000),
  summary text CHECK (summary IS NULL OR length(summary) <= 10000),
  correction_reason text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  request_key uuid NOT NULL UNIQUE,
  UNIQUE (logical_id, version),
  CHECK (version = 1 AND supersedes_id IS NULL AND correction_reason IS NULL
    OR version > 1 AND supersedes_id IS NOT NULL AND length(btrim(coalesce(correction_reason,''))) > 0)
);
CREATE INDEX school_institutional_followup_visits_school_date
  ON public.school_institutional_followup_visits(school_id, visit_date DESC, recorded_at DESC);

CREATE TABLE public.school_institutional_followup_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  visit_logical_id uuid NOT NULL,
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 4000),
  responsible_label text CHECK (responsible_label IS NULL OR length(responsible_label) <= 250),
  due_on date,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  request_key uuid NOT NULL UNIQUE
);
CREATE INDEX school_institutional_followup_actions_school
  ON public.school_institutional_followup_actions(school_id, recorded_at DESC);

CREATE TABLE public.school_institutional_followup_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.school_institutional_followup_actions(id),
  visit_logical_id uuid,
  occurred_on date NOT NULL,
  situation text NOT NULL CHECK (length(btrim(situation)) BETWEEN 1 AND 120),
  done_text text CHECK (done_text IS NULL OR length(done_text) <= 4000),
  not_done_text text CHECK (not_done_text IS NULL OR length(not_done_text) <= 4000),
  results text CHECK (results IS NULL OR length(results) <= 4000),
  referrals text CHECK (referrals IS NULL OR length(referrals) <= 4000),
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  request_key uuid NOT NULL UNIQUE
);
CREATE INDEX school_institutional_followup_updates_action
  ON public.school_institutional_followup_updates(action_id, occurred_on DESC, recorded_at DESC);

REVOKE ALL ON public.school_institutional_followup_visits,
  public.school_institutional_followup_actions, public.school_institutional_followup_updates
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.school_institutional_followup_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_institutional_followup_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_institutional_followup_updates ENABLE ROW LEVEL SECURITY;
-- Sem policies de acesso direto: somente funções guardadas por capacidade efetiva.
CREATE FUNCTION public.school_institutional_followup_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'followup:append-only'; END $$;
CREATE TRIGGER followup_visit_immutable BEFORE UPDATE OR DELETE ON public.school_institutional_followup_visits
  FOR EACH ROW EXECUTE FUNCTION public.school_institutional_followup_immutable();
CREATE TRIGGER followup_action_immutable BEFORE UPDATE OR DELETE ON public.school_institutional_followup_actions
  FOR EACH ROW EXECUTE FUNCTION public.school_institutional_followup_immutable();
CREATE TRIGGER followup_update_immutable BEFORE UPDATE OR DELETE ON public.school_institutional_followup_updates
  FOR EACH ROW EXECUTE FUNCTION public.school_institutional_followup_immutable();

-- Reaproveita a competência já homologável da Supervisão: não concede acesso por cargo.
-- Uma função de leitura atende o Gabinete; a gravação sempre exige pessoa natural.
CREATE FUNCTION public.school_institutional_followup_can_read(_school text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.al_supervision_grant('consultar-acompanhamento-da-supervisao', _school) IS NOT NULL
    OR public.al_supervision_grant('registrar-acompanhamento-da-supervisao', _school) IS NOT NULL
  )
$$;
REVOKE ALL ON FUNCTION public.school_institutional_followup_can_read(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.school_institutional_followup_person(_school text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _person uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'followup:session-required'; END IF;
  IF public.al_supervision_grant('registrar-acompanhamento-da-supervisao', _school) IS NULL
    THEN RAISE EXCEPTION 'followup:recording-denied'; END IF;
  SELECT l.person_id INTO _person FROM public.user_person_links l WHERE l.user_id = auth.uid();
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p
    WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'followup:natural-person-required'; END IF;
  RETURN _person;
END $$;
REVOKE ALL ON FUNCTION public.school_institutional_followup_person(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.record_school_institutional_followup_visit(
  _school text, _day date, _diagnosis text, _strengths text, _weaknesses text,
  _summary text, _base uuid, _reason text, _request uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _person uuid; _base_row public.school_institutional_followup_visits; _id uuid;
BEGIN
  _person := public.school_institutional_followup_person(_school);
  IF _request IS NULL THEN RAISE EXCEPTION 'followup:request-required'; END IF;
  SELECT id INTO _id FROM public.school_institutional_followup_visits
    WHERE request_key = _request AND author_user_id = auth.uid();
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _day IS NULL OR _day > CURRENT_DATE THEN RAISE EXCEPTION 'followup:invalid-date'; END IF;
  IF length(btrim(coalesce(_diagnosis,''))) = 0 THEN RAISE EXCEPTION 'followup:diagnosis-required'; END IF;
  IF _base IS NOT NULL THEN
    SELECT * INTO _base_row FROM public.school_institutional_followup_visits WHERE id = _base FOR UPDATE;
    IF _base_row.id IS NULL OR _base_row.school_id <> _school THEN RAISE EXCEPTION 'followup:invalid-base'; END IF;
    IF _base_row.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'followup:only-author-corrects'; END IF;
    IF EXISTS (SELECT 1 FROM public.school_institutional_followup_visits WHERE supersedes_id = _base)
      THEN RAISE EXCEPTION 'followup:base-superseded'; END IF;
    IF length(btrim(coalesce(_reason,''))) = 0 THEN RAISE EXCEPTION 'followup:reason-required'; END IF;
  END IF;
  INSERT INTO public.school_institutional_followup_visits (
    logical_id, version, supersedes_id, school_id, visit_date, diagnosis,
    strengths, weaknesses, summary, correction_reason, author_user_id, author_person_id, request_key)
  VALUES (
    coalesce(_base_row.logical_id, gen_random_uuid()), coalesce(_base_row.version, 0) + 1,
    _base, _school, _day, btrim(_diagnosis), coalesce(_strengths,''),
    coalesce(_weaknesses,''), nullif(btrim(_summary),''), nullif(btrim(_reason),''),
    auth.uid(), _person, _request)
  ON CONFLICT (request_key) DO NOTHING RETURNING id INTO _id;
  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.school_institutional_followup_visits
      WHERE request_key = _request AND author_user_id = auth.uid() AND school_id = _school;
  END IF;
  IF _id IS NULL THEN RAISE EXCEPTION 'followup:request-conflict'; END IF;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_school_institutional_followup_visit(text,date,text,text,text,text,uuid,text,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_school_institutional_followup_visit(text,date,text,text,text,text,uuid,text,uuid) TO authenticated;

CREATE FUNCTION public.record_school_institutional_followup_action(
  _visit uuid, _description text, _responsible text, _due date, _request uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v public.school_institutional_followup_visits; _person uuid; _id uuid;
BEGIN
  SELECT * INTO v FROM public.school_institutional_followup_visits WHERE id = _visit;
  IF v.id IS NULL OR EXISTS (SELECT 1 FROM public.school_institutional_followup_visits s WHERE s.supersedes_id = v.id)
    THEN RAISE EXCEPTION 'followup:visit-invalid'; END IF;
  _person := public.school_institutional_followup_person(v.school_id);
  IF _request IS NULL OR length(btrim(coalesce(_description,''))) = 0 THEN RAISE EXCEPTION 'followup:action-required'; END IF;
  IF _due IS NOT NULL AND _due < v.visit_date THEN RAISE EXCEPTION 'followup:due-before-visit'; END IF;
  INSERT INTO public.school_institutional_followup_actions (
    school_id, visit_logical_id, description, responsible_label, due_on, author_user_id, author_person_id, request_key)
  VALUES (v.school_id, v.logical_id, btrim(_description), nullif(btrim(_responsible),''),
    _due, auth.uid(), _person, _request)
  ON CONFLICT (request_key) DO NOTHING RETURNING id INTO _id;
  IF _id IS NULL THEN SELECT id INTO _id FROM public.school_institutional_followup_actions
    WHERE request_key = _request AND author_user_id = auth.uid() AND school_id = v.school_id; END IF;
  IF _id IS NULL THEN RAISE EXCEPTION 'followup:request-conflict'; END IF;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_school_institutional_followup_action(uuid,text,text,date,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_school_institutional_followup_action(uuid,text,text,date,uuid) TO authenticated;

CREATE FUNCTION public.record_school_institutional_followup_update(
  _action uuid, _visit uuid, _day date, _situation text, _done text, _not_done text,
  _results text, _referrals text, _request uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a public.school_institutional_followup_actions; v public.school_institutional_followup_visits; _person uuid; _id uuid;
BEGIN
  SELECT * INTO a FROM public.school_institutional_followup_actions WHERE id = _action;
  IF a.id IS NULL THEN RAISE EXCEPTION 'followup:action-not-found'; END IF;
  _person := public.school_institutional_followup_person(a.school_id);
  IF _day IS NULL OR _day > CURRENT_DATE THEN RAISE EXCEPTION 'followup:invalid-date'; END IF;
  IF length(btrim(coalesce(_situation,''))) = 0 THEN RAISE EXCEPTION 'followup:situation-required'; END IF;
  IF _request IS NULL THEN RAISE EXCEPTION 'followup:request-required'; END IF;
  IF _visit IS NOT NULL THEN
    SELECT * INTO v FROM public.school_institutional_followup_visits WHERE id = _visit;
    IF v.id IS NULL OR v.school_id <> a.school_id OR EXISTS
      (SELECT 1 FROM public.school_institutional_followup_visits s WHERE s.supersedes_id = v.id)
      THEN RAISE EXCEPTION 'followup:visit-mismatch'; END IF;
  END IF;
  INSERT INTO public.school_institutional_followup_updates (
    action_id, visit_logical_id, occurred_on, situation, done_text, not_done_text,
    results, referrals, author_user_id, author_person_id, request_key)
  VALUES (_action, v.logical_id, _day, btrim(_situation), nullif(btrim(_done),''),
    nullif(btrim(_not_done),''), nullif(btrim(_results),''), nullif(btrim(_referrals),''),
    auth.uid(), _person, _request)
  ON CONFLICT (request_key) DO NOTHING RETURNING id INTO _id;
  IF _id IS NULL THEN SELECT u.id INTO _id FROM public.school_institutional_followup_updates u
    WHERE u.request_key = _request AND u.author_user_id = auth.uid() AND u.action_id = _action; END IF;
  IF _id IS NULL THEN RAISE EXCEPTION 'followup:request-conflict'; END IF;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_school_institutional_followup_update(uuid,uuid,date,text,text,text,text,text,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_school_institutional_followup_update(uuid,uuid,date,text,text,text,text,text,uuid) TO authenticated;

CREATE FUNCTION public.school_institutional_followup_school(_school text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _res jsonb;
BEGIN
  IF NOT public.school_institutional_followup_can_read(_school) THEN RAISE EXCEPTION 'followup:read-denied'; END IF;
  SELECT jsonb_build_object(
    'visits', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.visit_date DESC, t.created_at DESC)
      FROM (SELECT v.id, v.logical_id, v.version, v.school_id, v.visit_date, v.diagnosis,
        v.strengths, v.weaknesses, v.summary, v.recorded_at AS created_at,
        p.display_name AS author_name
        FROM public.school_institutional_followup_visits v
        LEFT JOIN public.institutional_persons p ON p.id = v.author_person_id
        WHERE v.school_id = _school AND NOT EXISTS
         (SELECT 1 FROM public.school_institutional_followup_visits next WHERE next.supersedes_id = v.id)
        ORDER BY v.visit_date DESC, v.recorded_at DESC LIMIT 1000) t),'[]'::jsonb),
    'actions', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC)
      FROM (SELECT id, school_id, visit_logical_id, description, responsible_label,
        due_on, recorded_at AS created_at
        FROM public.school_institutional_followup_actions WHERE school_id = _school
        ORDER BY recorded_at DESC LIMIT 2000) a),'[]'::jsonb),
    'updates', coalesce((SELECT jsonb_agg(to_jsonb(u) ORDER BY u.occurred_on DESC, u.created_at DESC)
      FROM (SELECT u.id, u.action_id, u.visit_logical_id, u.occurred_on, u.situation,
        u.done_text, u.not_done_text, u.results, u.referrals, u.recorded_at AS created_at
        FROM public.school_institutional_followup_updates u
        JOIN public.school_institutional_followup_actions a ON a.id = u.action_id
        WHERE a.school_id = _school ORDER BY u.occurred_on DESC, u.recorded_at DESC LIMIT 5000) u),'[]'::jsonb)
  ) INTO _res;
  RETURN _res;
END $$;
REVOKE ALL ON FUNCTION public.school_institutional_followup_school(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.school_institutional_followup_school(text) TO authenticated;

CREATE FUNCTION public.school_institutional_followup_network(_from date, _to date)
RETURNS TABLE(school_id text, school_name text, visits integer, actions integer,
  completed integer, overdue integer, last_visit date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'followup:session-required'; END IF;
  IF _from IS NULL OR _to IS NULL OR _from > _to THEN RAISE EXCEPTION 'followup:period-invalid'; END IF;
  RETURN QUERY SELECT s.id, coalesce(n.official_name, s.id),
    (SELECT count(*)::integer FROM public.school_institutional_followup_visits v
      WHERE v.school_id = s.id AND v.visit_date BETWEEN _from AND _to
      AND NOT EXISTS (SELECT 1 FROM public.school_institutional_followup_visits newer WHERE newer.supersedes_id = v.id)),
    (SELECT count(*)::integer FROM public.school_institutional_followup_actions a WHERE a.school_id = s.id),
    (SELECT count(*)::integer FROM public.school_institutional_followup_actions a
      LEFT JOIN LATERAL (SELECT u.situation FROM public.school_institutional_followup_updates u
        WHERE u.action_id = a.id ORDER BY u.occurred_on DESC, u.recorded_at DESC, u.id DESC LIMIT 1) latest ON true
      WHERE a.school_id = s.id AND latest.situation = 'concluída'),
    (SELECT count(*)::integer FROM public.school_institutional_followup_actions a
      LEFT JOIN LATERAL (SELECT u.situation FROM public.school_institutional_followup_updates u
        WHERE u.action_id = a.id ORDER BY u.occurred_on DESC, u.recorded_at DESC, u.id DESC LIMIT 1) latest ON true
      WHERE a.school_id = s.id AND a.due_on < CURRENT_DATE AND latest.situation IS DISTINCT FROM 'concluída'),
    (SELECT max(v.visit_date) FROM public.school_institutional_followup_visits v
      WHERE v.school_id = s.id AND NOT EXISTS
        (SELECT 1 FROM public.school_institutional_followup_visits newer WHERE newer.supersedes_id = v.id))
  FROM public.institutional_schools s
  LEFT JOIN LATERAL (SELECT v.official_name FROM public.institutional_school_record_versions v
    WHERE v.school_id = s.id ORDER BY v.version_number DESC LIMIT 1) n ON true
  WHERE public.school_institutional_followup_can_read(s.id)
  ORDER BY n.official_name NULLS LAST, s.id;
END $$;
REVOKE ALL ON FUNCTION public.school_institutional_followup_network(date,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.school_institutional_followup_network(date,date) TO authenticated;
