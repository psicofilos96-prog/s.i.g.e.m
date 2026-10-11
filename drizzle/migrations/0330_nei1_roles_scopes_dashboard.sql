-- NEI.1: papéis do NEI (coordenador/técnico/AEE) sobre contas institucionais existentes, com escopo rede/escola/caso,
-- auditoria de acesso e painel agregado. Sem conta ou senha paralela; sem dado nominal no painel.
CREATE TABLE public.nei_role_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('coordenador','tecnico','aee')),
  scope_kind text NOT NULL CHECK (scope_kind IN ('rede','escola','caso')),
  school_id text REFERENCES public.institutional_schools(id),
  student_id text,
  valid_from date NOT NULL,
  valid_until date,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  granted_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((scope_kind = 'rede') = (school_id IS NULL)),
  CHECK ((scope_kind = 'caso') = (student_id IS NOT NULL)),
  CHECK (role <> 'coordenador' OR scope_kind = 'rede'),
  CHECK (role <> 'aee' OR scope_kind <> 'rede'),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
CREATE TABLE public.nei_role_revocations (
  grant_id uuid PRIMARY KEY REFERENCES public.nei_role_grants(id),
  revoked_on date NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  revoked_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.nei_access_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  school_id text,
  outcome text NOT NULL CHECK (outcome IN ('permitido','recusado')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT ALL ON public.nei_role_grants, public.nei_role_revocations, public.nei_access_events TO service_role;
ALTER TABLE public.nei_role_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_role_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_access_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER nei_grants_immutable BEFORE UPDATE OR DELETE ON public.nei_role_grants FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_revocations_immutable BEFORE UPDATE OR DELETE ON public.nei_role_revocations FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_access_immutable BEFORE UPDATE OR DELETE ON public.nei_access_events FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();

-- Concessões vigentes da conta (interno).
CREATE OR REPLACE FUNCTION public.nei_active_grants(_user uuid) RETURNS SETOF public.nei_role_grants
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT g.* FROM public.nei_role_grants g
   WHERE g.user_id = _user AND g.valid_from <= CURRENT_DATE AND (g.valid_until IS NULL OR g.valid_until >= CURRENT_DATE)
     AND NOT EXISTS (SELECT 1 FROM public.nei_role_revocations r WHERE r.grant_id = g.id AND r.revoked_on <= CURRENT_DATE)
$$;
REVOKE ALL ON FUNCTION public.nei_active_grants(uuid) FROM PUBLIC, anon, authenticated;

-- Conta de estação NEI (órgão, rede) vigente.
CREATE OR REPLACE FUNCTION public.nei_is_station(_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.institutional_sector_principals p
    WHERE p.auth_user_id = _user AND p.station_code = 'inclusao_nei' AND p.valid_from <= CURRENT_DATE
      AND NOT EXISTS (SELECT 1 FROM public.institutional_sector_principal_revocations r WHERE r.principal_id = p.id AND r.revoked_on <= CURRENT_DATE))
$$;
REVOKE ALL ON FUNCTION public.nei_is_station(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nei_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.general_admin_session())
$$;
REVOKE ALL ON FUNCTION public.nei_is_admin() FROM PUBLIC, anon, authenticated;

-- Pode gerir papéis: Admin geral (concede coordenador) ou coordenador vigente / estação NEI (concede técnico e AEE).
CREATE OR REPLACE FUNCTION public.nei_can_manage(_role text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (public.nei_is_admin() OR (_role <> 'coordenador' AND (public.nei_is_station(auth.uid())
    OR EXISTS (SELECT 1 FROM public.nei_active_grants(auth.uid()) g WHERE g.role = 'coordenador'))))
$$;
REVOKE ALL ON FUNCTION public.nei_can_manage(text) FROM PUBLIC, anon, authenticated;

-- Escolas visíveis à conta pelo NEI: NULL na lista = rede inteira.
CREATE OR REPLACE FUNCTION public.nei_scope_schools(_user uuid) RETURNS TABLE(school_id text, network boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NULL::text, true WHERE public.nei_is_station(_user) OR EXISTS (SELECT 1 FROM public.nei_active_grants(_user) g WHERE g.scope_kind = 'rede')
  UNION
  SELECT DISTINCT g.school_id, false FROM public.nei_active_grants(_user) g WHERE g.scope_kind IN ('escola','caso')
$$;
REVOKE ALL ON FUNCTION public.nei_scope_schools(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nei_log(_action text, _school text, _outcome text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.nei_access_events(user_id, action, school_id, outcome) VALUES (auth.uid(), _action, _school, _outcome)
$$;
REVOKE ALL ON FUNCTION public.nei_log(text,text,text) FROM PUBLIC, anon, authenticated;

-- O que a conta é no NEI (sem efeito colateral sensível).
CREATE OR REPLACE FUNCTION public.nei_my_access() RETURNS TABLE(source text, role text, scope_kind text, school_id text, school_name text, student_scoped boolean, valid_until date, can_manage_staff boolean, can_manage_coordinators boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  RETURN QUERY
    SELECT 'estacao'::text, 'estacao-nei'::text, 'rede'::text, NULL::text, NULL::text, false, NULL::date, true, public.nei_is_admin()
     WHERE public.nei_is_station(auth.uid())
    UNION ALL
    SELECT 'papel', g.role, g.scope_kind, g.school_id,
      (SELECT v.name FROM public.institutional_school_record_versions v WHERE v.school_id = g.school_id ORDER BY v.recorded_at DESC LIMIT 1),
      g.student_id IS NOT NULL, g.valid_until, public.nei_can_manage('tecnico'), public.nei_is_admin()
      FROM public.nei_active_grants(auth.uid()) g
    UNION ALL
    SELECT 'administracao', 'admin-geral', 'rede', NULL, NULL, false, NULL, true, true WHERE public.nei_is_admin();
END $$;
REVOKE ALL ON FUNCTION public.nei_my_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_my_access() TO authenticated;

-- Painel: só contagens por escola, dentro do escopo; cada abertura fica registrada (permitida ou recusada).
CREATE OR REPLACE FUNCTION public.nei_dashboard(_school text DEFAULT NULL)
RETURNS TABLE(school_id text, school_name text, students_with_record bigint, aee_active bigint, aee_sessions_30d bigint, mediations_active bigint, clinical_students bigint, students_in_case_scope bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE net boolean; allowed text[]; is_coord boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT bool_or(s.network), array_agg(s.school_id) FILTER (WHERE s.school_id IS NOT NULL) INTO net, allowed FROM public.nei_scope_schools(auth.uid()) s;
  IF NOT coalesce(net,false) AND coalesce(array_length(allowed,1),0) = 0 THEN
    PERFORM public.nei_log('painel', _school, 'recusado'); RAISE EXCEPTION 'nei:not-authorized';
  END IF;
  IF _school IS NOT NULL AND NOT coalesce(net,false) AND NOT (_school = ANY(allowed)) THEN
    PERFORM public.nei_log('painel', _school, 'recusado'); RAISE EXCEPTION 'nei:not-authorized';
  END IF;
  is_coord := public.nei_is_station(auth.uid()) OR EXISTS (SELECT 1 FROM public.nei_active_grants(auth.uid()) g WHERE g.role = 'coordenador');
  PERFORM public.nei_log('painel', _school, 'permitido');
  RETURN QUERY
  WITH sc AS (
    SELECT s.id FROM public.institutional_schools s
     WHERE (_school IS NULL OR s.id = _school) AND (coalesce(net,false) OR s.id = ANY(allowed))
  ), ir AS (
    SELECT DISTINCT ON (r.logical_id) r.* FROM public.inclusion_records r ORDER BY r.logical_id, r.version DESC
  ), sv AS (
    SELECT DISTINCT ON (a.logical_id) a.* FROM public.aee_services a ORDER BY a.logical_id, a.version DESC
  ), ma AS (
    SELECT DISTINCT ON (m.logical_id) m.* FROM public.inclusion_mediation_assignments m ORDER BY m.logical_id, m.version DESC
  ), cr AS (
    SELECT DISTINCT ON (c.logical_id) c.* FROM public.inclusion_clinical_records c ORDER BY c.logical_id, c.version DESC
  )
  SELECT sc.id,
    (SELECT v.name FROM public.institutional_school_record_versions v WHERE v.school_id = sc.id ORDER BY v.recorded_at DESC LIMIT 1),
    (SELECT count(DISTINCT ir.student_id) FROM ir WHERE ir.school_id = sc.id AND ir.event_kind <> 'encerramento' AND (ir.valid_to IS NULL OR ir.valid_to >= CURRENT_DATE)),
    (SELECT count(*) FROM sv WHERE sv.school_id = sc.id AND sv.event_kind <> 'encerramento' AND (sv.valid_to IS NULL OR sv.valid_to >= CURRENT_DATE)),
    (SELECT count(*) FROM public.aee_sessions x WHERE x.school_id = sc.id AND x.session_date >= CURRENT_DATE - 30),
    (SELECT count(*) FROM ma WHERE ma.school_id = sc.id AND ma.event_kind <> 'encerramento' AND (ma.valid_to IS NULL OR ma.valid_to >= CURRENT_DATE)),
    CASE WHEN is_coord THEN (SELECT count(DISTINCT cr.student_id) FROM cr WHERE cr.school_id = sc.id AND cr.event_kind <> 'encerramento') END,
    (SELECT count(DISTINCT g.student_id) FROM public.nei_active_grants(auth.uid()) g WHERE g.school_id = sc.id AND g.student_id IS NOT NULL)
  FROM sc ORDER BY 2 NULLS LAST;
END $$;
REVOKE ALL ON FUNCTION public.nei_dashboard(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_dashboard(text) TO authenticated;

-- Concessão de papel: só conta institucional existente ligada a pessoa natural (sem conta paralela).
CREATE OR REPLACE FUNCTION public.record_nei_role_grant(_user uuid, _role text, _scope text, _school text, _student text, _from date, _until date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT public.nei_can_manage(_role) THEN PERFORM public.nei_log('conceder-papel', _school, 'recusado'); RAISE EXCEPTION 'nei:cannot-manage'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'nei:self-grant'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_person_links l WHERE l.user_id = _user) THEN RAISE EXCEPTION 'nei:account-without-person'; END IF;
  IF _scope = 'caso' AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e JOIN public.institutional_classes c ON c.id = e.class_id
       WHERE e.student_id = _student AND c.school_id = _school) THEN RAISE EXCEPTION 'nei:student-not-in-school'; END IF;
  INSERT INTO public.nei_role_grants(user_id, role, scope_kind, school_id, student_id, valid_from, valid_until, reason, granted_by)
    VALUES (_user, _role, _scope, CASE WHEN _scope = 'rede' THEN NULL ELSE _school END, CASE WHEN _scope = 'caso' THEN _student END,
            coalesce(_from, CURRENT_DATE), _until, _reason, auth.uid()) RETURNING id INTO nid;
  PERFORM public.nei_log('conceder-papel', _school, 'permitido');
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_nei_role_grant(uuid,text,text,text,text,date,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_role_grant(uuid,text,text,text,text,date,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_nei_role_grant(_grant uuid, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.nei_role_grants;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO g FROM public.nei_role_grants WHERE id = _grant;
  IF g.id IS NULL THEN RAISE EXCEPTION 'nei:grant-unknown'; END IF;
  IF NOT public.nei_can_manage(g.role) THEN PERFORM public.nei_log('revogar-papel', g.school_id, 'recusado'); RAISE EXCEPTION 'nei:cannot-manage'; END IF;
  INSERT INTO public.nei_role_revocations(grant_id, revoked_on, reason, revoked_by) VALUES (_grant, CURRENT_DATE, _reason, auth.uid());
  PERFORM public.nei_log('revogar-papel', g.school_id, 'permitido');
END $$;
REVOKE ALL ON FUNCTION public.revoke_nei_role_grant(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_nei_role_grant(uuid,text) TO authenticated;

-- Lista de papéis e contas candidatas (só para quem gere). Candidatas = contas com pessoa natural e atuação vigente.
CREATE OR REPLACE FUNCTION public.nei_role_grants_list() RETURNS TABLE(id uuid, user_id uuid, person_name text, role text, scope_kind text, school_id text, student_scoped boolean, valid_from date, valid_until date, reason text, revoked boolean, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.nei_can_manage('tecnico') THEN RAISE EXCEPTION 'nei:cannot-manage'; END IF;
  RETURN QUERY SELECT g.id, g.user_id, (SELECT p.display_name FROM public.user_person_links l JOIN public.institutional_persons p ON p.id = l.person_id WHERE l.user_id = g.user_id LIMIT 1),
    g.role, g.scope_kind, g.school_id, g.student_id IS NOT NULL, g.valid_from, g.valid_until, g.reason,
    EXISTS (SELECT 1 FROM public.nei_role_revocations r WHERE r.grant_id = g.id), g.recorded_at
    FROM public.nei_role_grants g ORDER BY g.recorded_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.nei_role_grants_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_role_grants_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.nei_candidate_accounts(_query text) RETURNS TABLE(user_id uuid, person_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.nei_can_manage('tecnico') THEN RAISE EXCEPTION 'nei:cannot-manage'; END IF;
  IF length(btrim(coalesce(_query,''))) < 3 THEN RETURN; END IF;
  RETURN QUERY SELECT DISTINCT l.user_id, p.display_name FROM public.user_person_links l JOIN public.institutional_persons p ON p.id = l.person_id
    WHERE p.display_name ILIKE '%' || btrim(_query) || '%' ORDER BY 2 LIMIT 20;
END $$;
REVOKE ALL ON FUNCTION public.nei_candidate_accounts(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_candidate_accounts(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.nei_access_log(_limit int DEFAULT 200) RETURNS TABLE(person_name text, action text, school_id text, outcome text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.nei_can_manage('tecnico') THEN RAISE EXCEPTION 'nei:cannot-manage'; END IF;
  RETURN QUERY SELECT coalesce((SELECT p.display_name FROM public.user_person_links l JOIN public.institutional_persons p ON p.id = l.person_id WHERE l.user_id = e.user_id LIMIT 1), 'conta de setor'),
    e.action, e.school_id, e.outcome, e.recorded_at FROM public.nei_access_events e ORDER BY e.id DESC LIMIT least(greatest(coalesce(_limit,200),1),1000);
END $$;
REVOKE ALL ON FUNCTION public.nei_access_log(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_access_log(int) TO authenticated;