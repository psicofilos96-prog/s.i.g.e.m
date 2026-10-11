-- NEI.7: homologação técnica. (1) Ledgers NEI continuam append-only para todos; a ÚNICA exceção é a limpeza
-- de contas sintéticas BO (operação marcada, automação técnica ligada, linha de autoria de conta da operação).
-- (2) Correção: Direção/OP com atuação pessoal vigente na escola também recebem protocolos (antes só contas de setor).
CREATE OR REPLACE FUNCTION public.nei_fixture_row(_old jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE op text := current_setting('sigem.bo_cleanup_op', true); k text;
BEGIN
  IF op IS NULL OR op !~ '^bo-[0-9a-f]{12}$' OR NOT public.technical_automation_enabled() THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['opened_by','recorded_by','created_by','sent_by','scheduled_by','user_id','revoked_by'] LOOP
    IF _old ? k AND EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.operation_id = op AND a.user_id::text = _old->>k) THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.nei_fixture_row(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nei_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND public.nei_fixture_row(to_jsonb(OLD)) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'nei:append-only';
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT t.tgname, t.tgrelid::regclass AS rel FROM pg_trigger t
    WHERE t.tgfoid = 'public.sia_immutable'::regproc AND t.tgrelid::regclass::text LIKE 'nei\_%' LOOP
    EXECUTE format('DROP TRIGGER %I ON %s', r.tgname, r.rel);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION public.nei_immutable()', r.tgname, r.rel);
  END LOOP;
END $$;

-- Concessão NEI para conta sintética da operação (só service_role, só com automação técnica ligada).
CREATE OR REPLACE FUNCTION public.bo_fixture_nei_grant(_operation_id text, _user_id uuid, _role text, _scope text, _school text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE gid uuid;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id AND a.user_id = _user_id) THEN RAISE EXCEPTION 'bo:not-fixture'; END IF;
  INSERT INTO public.nei_role_grants(user_id, role, scope_kind, school_id, valid_from, reason, granted_by)
    VALUES (_user_id, _role, _scope, _school, CURRENT_DATE, 'bo-fixture:' || _operation_id, _user_id) RETURNING id INTO gid;
  RETURN gid;
END $$;
REVOKE ALL ON FUNCTION public.bo_fixture_nei_grant(text,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_nei_grant(text,uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_nei(_operation_id text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t text; n int := 0; c int; pass int; left_ int;
  tabs text[] := ARRAY['nei_documents','nei_protocol_events','nei_protocols','nei_action_events','nei_actions','nei_visit_events','nei_visits',
    'nei_barrier_events','nei_accessibility_barriers','nei_coverage_events','nei_support_request_events','nei_support_requests',
    'nei_plan_attachments','nei_plan_comments','nei_plan_versions','nei_plans','nei_aee_activity_logs','nei_aee_offer_events',
    'nei_case_events','nei_cases','nei_profile_entries','nei_access_events','nei_role_revocations','nei_role_grants'];
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  FOR pass IN 1..4 LOOP
    left_ := 0;
    FOREACH t IN ARRAY tabs LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I x WHERE public.nei_fixture_row(to_jsonb(x))', t); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
      EXCEPTION WHEN foreign_key_violation THEN left_ := left_ + 1;
      END;
    END LOOP;
    EXIT WHEN left_ = 0;
  END LOOP;
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  IF left_ > 0 THEN RAISE EXCEPTION 'bo:nei-cleanup-incomplete'; END IF;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup_nei(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup_nei(text) TO service_role;

CREATE OR REPLACE FUNCTION public.nei_staff_engaged(_user uuid, _kind text, _school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_person_links l JOIN public.institutional_engagements e ON e.person_id = l.person_id
    WHERE l.user_id = _user AND e.engagement_kind_id = _kind AND e.school_id = _school AND public.nei_engagement_active_at(e.id, _school))
$$;
REVOKE ALL ON FUNCTION public.nei_staff_engaged(uuid,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nei_recipient_eligible(_kind text, _user uuid, _school text, _student text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE _kind
    WHEN 'direcao' THEN EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.auth_user_id = _user AND p.station_code = 'direcao_escolar' AND (p.school_id = _school OR p.school_id IS NULL))
      OR public.nei_staff_engaged(_user, 'direcao-escolar', _school)
    WHEN 'op' THEN EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.auth_user_id = _user AND p.station_code = 'orientacao_pedagogica' AND (p.school_id = _school OR p.school_id IS NULL))
      OR public.nei_staff_engaged(_user, 'orientacao-pedagogica', _school)
    WHEN 'supervisao' THEN EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.auth_user_id = _user AND p.station_code = 'supervisao')
    WHEN 'aee' THEN EXISTS (SELECT 1 FROM public.nei_active_grants(_user) g WHERE g.role = 'aee' AND (g.scope_kind = 'rede' OR g.school_id = _school))
    WHEN 'docente' THEN EXISTS (SELECT 1 FROM public.user_person_links l JOIN public.institutional_engagements e ON e.person_id = l.person_id
      WHERE l.user_id = _user AND e.school_id = _school AND e.engagement_kind_id = 'professor' AND public.nei_engagement_active_at(e.id, _school))
    WHEN 'familia' THEN _student IS NOT NULL AND EXISTS (SELECT 1 FROM public.guardian_authorizations a
      WHERE a.guardian_user_id = _user AND a.student_id = _student AND a.school_id = _school AND a.event_kind <> 'revogacao' AND 'comunicados' = ANY (a.sections)
        AND NOT EXISTS (SELECT 1 FROM public.guardian_authorizations s WHERE s.supersedes_id = a.id)
        AND a.valid_from <= CURRENT_DATE AND (a.valid_until IS NULL OR a.valid_until >= CURRENT_DATE))
    ELSE false END
$$;
REVOKE ALL ON FUNCTION public.nei_recipient_eligible(text,uuid,text,text) FROM PUBLIC, anon, authenticated;

-- Candidatos passam a incluir Direção/OP pessoais com atuação na escola (já cobertos pelo ramo de atuações).
