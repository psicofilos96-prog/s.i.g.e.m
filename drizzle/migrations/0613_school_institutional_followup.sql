-- Acompanhamento institucional de unidades escolares. Domínio distinto da Supervisão formal.
-- Aditivo, append-only, sem permissões automáticas. Gabinete lê; equipe humana registra.
-- Capabilities próprias; não compartilhar acesso com procedimentos formais da Supervisão.
INSERT INTO public.sigem_capability_catalog(capability_id, origin) VALUES
  ('consultar-acompanhamento-institucional', 'decisao-projeto-acompanhamento-2026-11-03'),
  ('registrar-acompanhamento-institucional', 'decisao-projeto-acompanhamento-2026-11-03')
ON CONFLICT (capability_id) DO NOTHING;
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
  situation text NOT NULL CHECK (situation IN ('prevista', 'em andamento', 'concluída', 'não realizada', 'suspensa')),
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
REVOKE ALL ON FUNCTION public.school_institutional_followup_immutable() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER followup_visit_immutable BEFORE UPDATE OR DELETE ON public.school_institutional_followup_visits
  FOR EACH ROW EXECUTE FUNCTION public.school_institutional_followup_immutable();
CREATE TRIGGER followup_action_immutable BEFORE UPDATE OR DELETE ON public.school_institutional_followup_actions
  FOR EACH ROW EXECUTE FUNCTION public.school_institutional_followup_immutable();
CREATE TRIGGER followup_update_immutable BEFORE UPDATE OR DELETE ON public.school_institutional_followup_updates
  FOR EACH ROW EXECUTE FUNCTION public.school_institutional_followup_immutable();

-- Uma autorização própria evita que dar leitura ao Gabinete abra a Supervisão formal.
-- Capabilities dependem de política institucional homologada. Nenhuma é concedida nesta migration.
CREATE FUNCTION public.school_institutional_followup_grant(_capability text, _school text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL OR _school IS NULL OR _capability NOT IN (
    'consultar-acompanhamento-institucional','registrar-acompanhamento-institucional'
  ) THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.effective_scope_capabilities((now() AT TIME ZONE 'America/Sao_Paulo')::date) c
    WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL
      AND (c.scope_level = 'rede' OR c.scope_level = 'escola' AND c.school_id = _school));
END $$;
REVOKE ALL ON FUNCTION public.school_institutional_followup_grant(text,text) FROM PUBLIC, anon, authenticated, service_role;
-- Uma função de leitura atende o Gabinete; a gravação sempre exige pessoa natural.
CREATE FUNCTION public.school_institutional_followup_can_read(_school text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.school_institutional_followup_grant('consultar-acompanhamento-institucional', _school)
    OR public.school_institutional_followup_grant('registrar-acompanhamento-institucional', _school)
  )
$$;
REVOKE ALL ON FUNCTION public.school_institutional_followup_can_read(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.school_institutional_followup_person(_school text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _person uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'followup:session-required'; END IF;
  IF NOT public.school_institutional_followup_grant('registrar-acompanhamento-institucional', _school)
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
    WHERE request_key = _request AND author_user_id = auth.uid() AND school_id = _school;
  IF _id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.school_institutional_followup_visits old
      WHERE old.id = _id
        AND old.visit_date IS NOT DISTINCT FROM _day
        AND old.diagnosis IS NOT DISTINCT FROM btrim(_diagnosis)
        AND old.strengths IS NOT DISTINCT FROM coalesce(_strengths,'')
        AND old.weaknesses IS NOT DISTINCT FROM coalesce(_weaknesses,'')
        AND old.summary IS NOT DISTINCT FROM nullif(btrim(_summary),'')
        AND old.supersedes_id IS NOT DISTINCT FROM _base
        AND old.correction_reason IS NOT DISTINCT FROM nullif(btrim(_reason),'')
    ) THEN RAISE EXCEPTION 'followup:request-conflict'; END IF;
    RETURN _id;
  END IF;
  IF _day IS NULL OR _day > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'followup:invalid-date'; END IF;
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
  IF NOT EXISTS (
    SELECT 1 FROM public.school_institutional_followup_visits old
    WHERE old.id = _id
      AND old.visit_date IS NOT DISTINCT FROM _day
      AND old.diagnosis IS NOT DISTINCT FROM btrim(_diagnosis)
      AND old.strengths IS NOT DISTINCT FROM coalesce(_strengths,'')
      AND old.weaknesses IS NOT DISTINCT FROM coalesce(_weaknesses,'')
      AND old.summary IS NOT DISTINCT FROM nullif(btrim(_summary),'')
      AND old.supersedes_id IS NOT DISTINCT FROM _base
      AND old.correction_reason IS NOT DISTINCT FROM nullif(btrim(_reason),'')
  ) THEN RAISE EXCEPTION 'followup:request-conflict'; END IF;
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
  IF NOT EXISTS (
    SELECT 1 FROM public.school_institutional_followup_actions old
    WHERE old.id = _id
      AND old.visit_logical_id = v.logical_id
      AND old.description IS NOT DISTINCT FROM btrim(_description)
      AND old.responsible_label IS NOT DISTINCT FROM nullif(btrim(_responsible),'')
      AND old.due_on IS NOT DISTINCT FROM _due
  ) THEN RAISE EXCEPTION 'followup:request-conflict'; END IF;
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
  IF _day IS NULL OR _day > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'followup:invalid-date'; END IF;
  IF btrim(coalesce(_situation,'')) NOT IN ('prevista', 'em andamento', 'concluída', 'não realizada', 'suspensa')
    THEN RAISE EXCEPTION 'followup:situation-invalid'; END IF;
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
  IF NOT EXISTS (
    SELECT 1 FROM public.school_institutional_followup_updates old
    WHERE old.id = _id
      AND old.action_id = _action
      AND old.visit_logical_id IS NOT DISTINCT FROM v.logical_id
      AND old.occurred_on IS NOT DISTINCT FROM _day
      AND old.situation IS NOT DISTINCT FROM btrim(_situation)
      AND old.done_text IS NOT DISTINCT FROM nullif(btrim(_done),'')
      AND old.not_done_text IS NOT DISTINCT FROM nullif(btrim(_not_done),'')
      AND old.results IS NOT DISTINCT FROM nullif(btrim(_results),'')
      AND old.referrals IS NOT DISTINCT FROM nullif(btrim(_referrals),'')
  ) THEN RAISE EXCEPTION 'followup:request-conflict'; END IF;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_school_institutional_followup_update(uuid,uuid,date,text,text,text,text,text,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_school_institutional_followup_update(uuid,uuid,date,text,text,text,text,text,uuid) TO authenticated;

CREATE FUNCTION public.school_institutional_followup_school(_school text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _res jsonb;
BEGIN
  IF NOT public.school_institutional_followup_can_read(_school) THEN RAISE EXCEPTION 'followup:read-denied'; END IF;
  -- Um histórico cortado silenciosamente produziria contagens e estados falsos.
  -- Enquanto a paginação canônica não existir, falha fechada com erro identificável.
  IF (SELECT count(*) FROM public.school_institutional_followup_visits
       WHERE school_id = _school) > 1000
    OR (SELECT count(*) FROM public.school_institutional_followup_actions
       WHERE school_id = _school) > 2000
    OR (SELECT count(*) FROM public.school_institutional_followup_updates u
       JOIN public.school_institutional_followup_actions a ON a.id = u.action_id
       WHERE a.school_id = _school) > 5000
  THEN RAISE EXCEPTION 'followup:history-volume-exceeded'; END IF;
  SELECT jsonb_build_object(
    'visits', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.visit_date DESC, t.created_at DESC)
      FROM (SELECT v.id, v.logical_id, v.version, v.school_id, v.visit_date, v.diagnosis,
        v.strengths, v.weaknesses, v.summary, v.correction_reason, v.supersedes_id,
        v.recorded_at AS created_at, p.display_name AS author_name,
        (v.author_user_id = auth.uid()) AS can_correct
        FROM public.school_institutional_followup_visits v
        LEFT JOIN public.institutional_persons p ON p.id = v.author_person_id
        WHERE v.school_id = _school AND NOT EXISTS
         (SELECT 1 FROM public.school_institutional_followup_visits next WHERE next.supersedes_id = v.id)
        ORDER BY v.visit_date DESC, v.recorded_at DESC LIMIT 1000) t),'[]'::jsonb),
    'visit_history', coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC)
      FROM (SELECT v.id, v.logical_id, v.version, v.school_id, v.visit_date, v.diagnosis,
        v.strengths, v.weaknesses, v.summary, v.correction_reason, v.supersedes_id,
        v.recorded_at AS created_at, p.display_name AS author_name
        FROM public.school_institutional_followup_visits v
        LEFT JOIN public.institutional_persons p ON p.id = v.author_person_id
        WHERE v.school_id = _school AND EXISTS
          (SELECT 1 FROM public.school_institutional_followup_visits later WHERE later.supersedes_id = v.id)
        ORDER BY v.recorded_at DESC LIMIT 1000) h),'[]'::jsonb),
    'actions', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC)
      FROM (SELECT a.id, a.school_id, a.visit_logical_id, a.description, a.responsible_label,
        a.due_on, a.recorded_at AS created_at, p.display_name AS author_name
        FROM public.school_institutional_followup_actions a
        LEFT JOIN public.institutional_persons p ON p.id = a.author_person_id
        WHERE a.school_id = _school
        ORDER BY a.recorded_at DESC LIMIT 2000) a),'[]'::jsonb),
    'updates', coalesce((SELECT jsonb_agg(to_jsonb(u) ORDER BY u.occurred_on DESC, u.created_at DESC)
      FROM (SELECT u.id, u.action_id, u.visit_logical_id, u.occurred_on, u.situation,
        u.done_text, u.not_done_text, u.results, u.referrals, u.recorded_at AS created_at,
        p.display_name AS author_name
        FROM public.school_institutional_followup_updates u
        JOIN public.school_institutional_followup_actions a ON a.id = u.action_id
        LEFT JOIN public.institutional_persons p ON p.id = u.author_person_id
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
      WHERE a.school_id = s.id AND a.due_on < (now() AT TIME ZONE 'America/Sao_Paulo')::date AND latest.situation IS DISTINCT FROM 'concluída'),
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


-- Uma visita e suas ações são um único ato transacional: erro em uma ação desfaz todas.
CREATE FUNCTION public.record_school_institutional_followup_bundle(
  _school text, _day date, _diagnosis text, _strengths text, _weaknesses text,
  _summary text, _request uuid, _actions jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _visit uuid; a jsonb; _request_action uuid;
BEGIN
  IF _actions IS NOT NULL AND pg_catalog.jsonb_typeof(_actions) <> 'array'
    THEN RAISE EXCEPTION 'followup:actions-invalid'; END IF;
  IF pg_catalog.jsonb_array_length(coalesce(_actions, '[]'::jsonb)) > 50
    THEN RAISE EXCEPTION 'followup:too-many-actions'; END IF;
  _visit := public.record_school_institutional_followup_visit(
    _school, _day, _diagnosis, _strengths, _weaknesses,
    _summary, NULL, NULL, _request
  );
  FOR a IN SELECT value FROM pg_catalog.jsonb_array_elements(coalesce(_actions, '[]'::jsonb))
  LOOP
    IF pg_catalog.jsonb_typeof(a) <> 'object' THEN
      RAISE EXCEPTION 'followup:action-invalid';
    END IF;
    IF nullif(pg_catalog.btrim(coalesce(a->>'description','')), '') IS NOT NULL THEN
      IF nullif(pg_catalog.btrim(coalesce(a->>'request','')), '') IS NULL
        THEN RAISE EXCEPTION 'followup:action-request-required'; END IF;
      _request_action := (a->>'request')::uuid;
      PERFORM public.record_school_institutional_followup_action(
        _visit, a->>'description', a->>'responsible',
        nullif(a->>'due','')::date, _request_action
      );
    END IF;
  END LOOP;
  RETURN _visit;
END $$;
REVOKE ALL ON FUNCTION public.record_school_institutional_followup_bundle(text,date,text,text,text,text,uuid,jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_school_institutional_followup_bundle(text,date,text,text,text,text,uuid,jsonb)
  TO authenticated;


-- Séries destinadas ao Gabinete: leitura agregada no banco, somente escolas autorizadas.
CREATE FUNCTION public.school_institutional_followup_monthly(_from date, _to date)
RETURNS TABLE(month text, visits integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'followup:session-required'; END IF;
  IF _from IS NULL OR _to IS NULL OR _from > _to THEN RAISE EXCEPTION 'followup:period-invalid'; END IF;
  RETURN QUERY
  SELECT to_char(v.visit_date, 'YYYY-MM')::text, count(*)::integer
  FROM public.school_institutional_followup_visits v
  WHERE v.visit_date BETWEEN _from AND _to
    AND public.school_institutional_followup_can_read(v.school_id)
    AND NOT EXISTS (SELECT 1 FROM public.school_institutional_followup_visits newer WHERE newer.supersedes_id = v.id)
  GROUP BY to_char(v.visit_date, 'YYYY-MM')
  ORDER BY to_char(v.visit_date, 'YYYY-MM');
END $$;
REVOKE ALL ON FUNCTION public.school_institutional_followup_monthly(date,date)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.school_institutional_followup_monthly(date,date) TO authenticated;

-- Situação vigente de cada medida, incluindo a classe "sem atualização".
CREATE FUNCTION public.school_institutional_followup_statuses()
RETURNS TABLE(situation text, actions integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'followup:session-required'; END IF;
  RETURN QUERY
    SELECT coalesce(latest.situation, 'sem atualização')::text, count(*)::integer
    FROM public.school_institutional_followup_actions a
    LEFT JOIN LATERAL (
      SELECT u.situation FROM public.school_institutional_followup_updates u
      WHERE u.action_id = a.id
      ORDER BY u.occurred_on DESC, u.recorded_at DESC, u.id DESC LIMIT 1
    ) latest ON true
    WHERE public.school_institutional_followup_can_read(a.school_id)
    GROUP BY coalesce(latest.situation, 'sem atualização')
    ORDER BY coalesce(latest.situation, 'sem atualização');
END $$;
REVOKE ALL ON FUNCTION public.school_institutional_followup_statuses()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.school_institutional_followup_statuses() TO authenticated;
