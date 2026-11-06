-- 0615 — Contas funcionais com designação de pessoa EXCLUSIVA do acompanhamento.
-- Não usar user_person_links: vincular uma conta de posto ao login humano global
-- faria herdar TODAS as capacidades da pessoa em outros módulos.
-- Os 3 emails são identificadores sem caixa postal. Nenhuma conta é ativada,
-- política é homologada, senha é fornecida ou responsável é designado aqui.
-- Depende da 0614 e preserva os leitores/escritores das contas humanas normais.

CREATE FUNCTION public.followup_seat_is_account(_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _user
    AND (lower(u.email) IN (
      'acomp1@sigem.itap.gov.br','acomp2@sigem.itap.gov.br','gab@sigem.itap.gov.br')
      OR u.raw_app_meta_data->>'sigem_account' = 'followup-functional-pending'))
$$;
REVOKE ALL ON FUNCTION public.followup_seat_is_account(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Impedimento prévio: não criar a segregação caso algum posto tenha recebido
-- vínculo humano global ou principal setorial por fora do processo controlado.
DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_person_links l
    WHERE public.followup_seat_is_account(l.user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.institutional_sector_principals p
    WHERE public.followup_seat_is_account(p.auth_user_id)
  ) THEN RAISE EXCEPTION 'followup-seat:preexisting-global-identity'; END IF;
END $preflight$;

-- Sobrepõe o gatilho da 0614: não é permitida NENHUMA vinculação comum de
-- contas funcionais. O vínculo humano só fica na tabela dedicada abaixo.
CREATE OR REPLACE FUNCTION public.followup_functional_seat_link_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') AND (
    public.followup_seat_is_account(NEW.user_id)
    OR (TG_OP = 'UPDATE' AND public.followup_seat_is_account(OLD.user_id))
  ) THEN RAISE EXCEPTION 'followup-seat:global-person-link-forbidden'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.followup_functional_seat_link_guard()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.followup_seat_principal_insert_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF public.followup_seat_is_account(NEW.auth_user_id)
    THEN RAISE EXCEPTION 'followup-seat:sector-principal-forbidden'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.followup_seat_principal_insert_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER followup_seat_principal_insert_guard
  BEFORE INSERT ON public.institutional_sector_principals
  FOR EACH ROW EXECUTE FUNCTION public.followup_seat_principal_insert_guard();

-- Designação e término separados para preservar TODA a história do posto.
-- Nunca armazenar senhas, CPF ou credenciais aqui; person_id é cadastro
-- institucional existente, não pessoa inventada pelo módulo.
CREATE TABLE public.followup_seat_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  seat_code text NOT NULL CHECK (seat_code IN ('acomp1','acomp2','gab')),
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  designated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  designated_by uuid NOT NULL,
  act_ref text NOT NULL CHECK (length(btrim(act_ref)) BETWEEN 3 AND 200),
  request_key uuid NOT NULL UNIQUE
);
CREATE INDEX followup_seat_assignments_user_time
  ON public.followup_seat_assignments(auth_user_id, designated_at DESC);
CREATE TABLE public.followup_seat_revocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE REFERENCES public.followup_seat_assignments(id),
  revoked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_by uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 1000),
  request_key uuid NOT NULL UNIQUE
);
REVOKE ALL ON public.followup_seat_assignments, public.followup_seat_revocations
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.followup_seat_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_seat_revocations ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.followup_seat_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'followup-seat:append-only'; END $$;
REVOKE ALL ON FUNCTION public.followup_seat_append_only()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER followup_seat_assignments_immutable
  BEFORE UPDATE OR DELETE ON public.followup_seat_assignments
  FOR EACH ROW EXECUTE FUNCTION public.followup_seat_append_only();
CREATE TRIGGER followup_seat_revocations_immutable
  BEFORE UPDATE OR DELETE ON public.followup_seat_revocations
  FOR EACH ROW EXECUTE FUNCTION public.followup_seat_append_only();

-- Apenas uma administração institucional já autorizada pode designar/tirar
-- ocupantes. Os RPCs não criam Auth users, não mandam email e não concedem
-- novas políticas. O ato administrativo integra o evento append-only.
CREATE FUNCTION public.designate_followup_seat(
  _seat text, _auth_user uuid, _person uuid, _act_ref text, _request uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _id uuid; _u auth.users; _now timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_network_capability('manter-contas-institucionais')
    OR NOT public.has_network_capability('manter-atuacoes-institucionais')
  THEN RAISE EXCEPTION 'followup-seat:admin-denied'; END IF;
  IF _seat NOT IN ('acomp1','acomp2','gab') OR _auth_user IS NULL
    OR _person IS NULL OR _request IS NULL
    OR length(btrim(coalesce(_act_ref,''))) NOT BETWEEN 3 AND 200
  THEN RAISE EXCEPTION 'followup-seat:invalid-designation'; END IF;
  -- Serializar por posto e conta; duas chamadas simultâneas não podem
  -- instalar ocupantes distintos.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('followup-seat:'||_seat, 0));
  SELECT id INTO _id FROM public.followup_seat_assignments WHERE request_key = _request;
  IF _id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.followup_seat_assignments a WHERE a.id = _id
      AND a.seat_code = _seat AND a.auth_user_id = _auth_user
      AND a.person_id = _person AND a.act_ref = btrim(_act_ref))
    THEN RETURN _id; END IF;
    RAISE EXCEPTION 'followup-seat:request-conflict';
  END IF;
  SELECT * INTO _u FROM auth.users WHERE id = _auth_user;
  IF NOT FOUND OR _u.raw_app_meta_data->>'sigem_account' <> 'followup-functional-pending'
    OR _u.raw_app_meta_data->>'followup_seat' IS DISTINCT FROM _seat
    OR lower(_u.email) <> _seat||'@sigem.itap.gov.br'
    OR _u.email_confirmed_at IS NULL
  THEN RAISE EXCEPTION 'followup-seat:account-not-confirmed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_persons p
    WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
  THEN RAISE EXCEPTION 'followup-seat:natural-person-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_person_links l WHERE l.user_id = _auth_user)
    OR EXISTS (SELECT 1 FROM public.institutional_sector_principals p
      WHERE p.auth_user_id = _auth_user)
  THEN RAISE EXCEPTION 'followup-seat:global-identity-conflict'; END IF;
  IF EXISTS (SELECT 1 FROM public.followup_seat_assignments a
    WHERE (a.auth_user_id = _auth_user OR a.seat_code = _seat OR a.person_id = _person)
      AND NOT EXISTS (SELECT 1 FROM public.followup_seat_revocations r
        WHERE r.assignment_id = a.id))
  THEN RAISE EXCEPTION 'followup-seat:active-assignment'; END IF;
  _now := clock_timestamp();
  INSERT INTO public.followup_seat_assignments
    (auth_user_id,seat_code,person_id,designated_at,designated_by,act_ref,request_key)
  VALUES (_auth_user,_seat,_person,_now,auth.uid(),btrim(_act_ref),_request)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.designate_followup_seat(text,uuid,uuid,text,uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.designate_followup_seat(text,uuid,uuid,text,uuid)
  TO authenticated;

CREATE FUNCTION public.revoke_followup_seat(
  _assignment uuid, _reason text, _request uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _id uuid; _a public.followup_seat_assignments;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_network_capability('manter-contas-institucionais')
    OR NOT public.has_network_capability('manter-atuacoes-institucionais')
  THEN RAISE EXCEPTION 'followup-seat:admin-denied'; END IF;
  IF _assignment IS NULL OR _request IS NULL
    OR length(btrim(coalesce(_reason,''))) NOT BETWEEN 3 AND 1000
  THEN RAISE EXCEPTION 'followup-seat:revocation-invalid'; END IF;
  SELECT * INTO _a FROM public.followup_seat_assignments WHERE id=_assignment;
  IF NOT FOUND THEN RAISE EXCEPTION 'followup-seat:assignment-missing'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('followup-seat:'||_a.seat_code, 0));
  SELECT id INTO _id FROM public.followup_seat_revocations WHERE request_key = _request;
  IF _id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.followup_seat_revocations r
      WHERE r.id = _id AND r.assignment_id = _assignment
        AND r.reason = btrim(_reason)) THEN RETURN _id; END IF;
    RAISE EXCEPTION 'followup-seat:request-conflict';
  END IF;
  IF EXISTS (SELECT 1 FROM public.followup_seat_revocations
    WHERE assignment_id = _assignment)
  THEN RAISE EXCEPTION 'followup-seat:already-revoked'; END IF;
  INSERT INTO public.followup_seat_revocations
    (assignment_id,revoked_by,reason,request_key)
  VALUES (_assignment,auth.uid(),btrim(_reason),_request)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.revoke_followup_seat(uuid,text,uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_followup_seat(uuid,text,uuid)
  TO authenticated;

-- Só há responsável efetivo se a sessão Auth nasceu DEPOIS da designação,
-- é do MESMO usuário e o posto não foi revogado. JWT renovado preserva
-- session_id; jamais usar iat para substituir auth.sessions.created_at.
CREATE FUNCTION public.followup_seat_active_assignment()
RETURNS TABLE(seat_code text,person_id uuid,assignment_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _sid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.followup_seat_is_account() THEN RETURN; END IF;
  BEGIN
    _sid := nullif(auth.jwt()->>'session_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN;
  END;
  IF _sid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT a.seat_code,a.person_id,a.id
  FROM public.followup_seat_assignments a
  JOIN public.institutional_persons p ON p.id=a.person_id AND p.actor_nature='pessoa-natural'
  JOIN auth.users u ON u.id=a.auth_user_id
    AND u.raw_app_meta_data->>'sigem_account'='followup-functional-pending'
    AND u.raw_app_meta_data->>'followup_seat'=a.seat_code
  JOIN auth.sessions sess ON sess.id=_sid AND sess.user_id=u.id
    AND sess.created_at >= a.designated_at
    AND (sess.not_after IS NULL OR sess.not_after > now())
  WHERE a.auth_user_id=auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.followup_seat_revocations r
      WHERE r.assignment_id=a.id)
  ORDER BY a.designated_at DESC,a.id DESC LIMIT 1;
END $$;
REVOKE ALL ON FUNCTION public.followup_seat_active_assignment()
  FROM PUBLIC, anon, authenticated, service_role;

-- Política homologada continua sendo mandatória; a identidade do posto
-- restringe o verbo (acomp1/2 escrevem, gab APENAS consulta).
CREATE FUNCTION public.followup_seat_effective_grants(_on date)
RETURNS TABLE(capability_id text,engagement_id uuid,policy_id uuid,
  policy_version integer,scope_level text,school_id text,person_id uuid,person_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT r.capability_id,e.id,p.id,p.version,e.scope_level,
    CASE WHEN e.scope_level='escola' THEN e.school_id END,
    s.person_id,ip.display_name
  FROM public.followup_seat_active_assignment() s
  JOIN public.institutional_persons ip ON ip.id=s.person_id
  JOIN public.institutional_engagements e ON e.person_id=s.person_id
  JOIN public.capability_policy_rules r ON r.engagement_kind_id=e.engagement_kind_id
  JOIN public.capability_policies p ON p.id=r.policy_id
  WHERE (
    (s.seat_code IN ('acomp1','acomp2') AND r.capability_id='registrar-acompanhamento-institucional')
    OR (s.seat_code='gab' AND r.capability_id='consultar-acompanhamento-institucional')
  )
    AND e.scope_level IN ('rede','escola') AND p.status='homologated'
    AND e.valid_from<=_on AND (e.valid_until IS NULL OR e.valid_until>=_on)
    AND (p.valid_from IS NULL OR p.valid_from<=_on)
    AND (p.valid_until IS NULL OR p.valid_until>=_on)
    AND NOT EXISTS (SELECT 1 FROM public.capability_policies next_policy
      WHERE next_policy.supersedes_version_id=p.id
        AND next_policy.status='homologated'
        AND next_policy.valid_from<=_on)
$$;
REVOKE ALL ON FUNCTION public.followup_seat_effective_grants(date)
  FROM PUBLIC, anon, authenticated, service_role;

-- ÚNICA RPC de autoridade para os logins de posto, usada pelo frontend.
-- Não informa pessoa/escopo para sessões antigas ou sem ato de designação.
CREATE FUNCTION public.followup_seat_authority(_on date DEFAULT CURRENT_DATE)
RETURNS TABLE(capability_id text,engagement_id uuid,policy_id uuid,
  policy_version integer,school_id text,class_id text,component_id text,
  period_id text,person_id uuid,person_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT g.capability_id,g.engagement_id,g.policy_id,g.policy_version,
    g.school_id,NULL::text,NULL::text,NULL::text,g.person_id,g.person_name
  FROM public.followup_seat_effective_grants(_on) g
$$;
REVOKE ALL ON FUNCTION public.followup_seat_authority(date)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.followup_seat_authority(date) TO authenticated;

-- Não usar as capacidades globais do vínculo humano nesta área para o posto.
-- A conta funcional só recebe os dois verbos listados acima se houver
-- política homologada + pessoa designada + nova sessão não revogada.
CREATE OR REPLACE FUNCTION public.school_institutional_followup_grant(
  _capability text,_school text
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL OR _school IS NULL OR _capability NOT IN (
    'consultar-acompanhamento-institucional','registrar-acompanhamento-institucional'
  ) THEN RETURN false; END IF;
  IF public.followup_seat_is_account() THEN
    RETURN EXISTS (SELECT 1 FROM public.followup_seat_effective_grants(
      (now() AT TIME ZONE 'America/Sao_Paulo')::date) g
      WHERE g.capability_id=_capability
        AND (g.scope_level='rede' OR g.scope_level='escola' AND g.school_id=_school));
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.effective_scope_capabilities(
    (now() AT TIME ZONE 'America/Sao_Paulo')::date) c
    WHERE c.capability_id=_capability AND c.policy_id IS NOT NULL
      AND (c.scope_level='rede' OR c.scope_level='escola' AND c.school_id=_school));
END $$;
REVOKE ALL ON FUNCTION public.school_institutional_followup_grant(text,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.school_institutional_followup_person(_school text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _person uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'followup:session-required'; END IF;
  IF NOT public.school_institutional_followup_grant('registrar-acompanhamento-institucional',_school)
    THEN RAISE EXCEPTION 'followup:recording-denied'; END IF;
  IF public.followup_seat_is_account() THEN
    SELECT s.person_id INTO _person FROM public.followup_seat_active_assignment() s;
  ELSE
    SELECT l.person_id INTO _person FROM public.user_person_links l WHERE l.user_id=auth.uid();
  END IF;
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p
    WHERE p.id=_person AND p.actor_nature='pessoa-natural')
    THEN RAISE EXCEPTION 'followup:natural-person-required'; END IF;
  RETURN _person;
END $$;
REVOKE ALL ON FUNCTION public.school_institutional_followup_person(text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Troca do ocupante NÃO transfere poder de retificar visitas antigas.
-- O writer 0613 confere author_user_id; se o mesmo Auth for reutilizado,
-- esta barreira de INSERT confere também a pessoa natural ORIGINAL.
CREATE FUNCTION public.followup_seat_visit_correction_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _original_person uuid;
BEGIN
  IF NEW.supersedes_id IS NOT NULL AND public.followup_seat_is_account(NEW.author_user_id) THEN
    SELECT v.author_person_id INTO _original_person
      FROM public.school_institutional_followup_visits v
      WHERE v.id = NEW.supersedes_id;
    IF _original_person IS DISTINCT FROM NEW.author_person_id
      THEN RAISE EXCEPTION 'followup:only-author-corrects'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.followup_seat_visit_correction_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER followup_seat_visit_correction_guard
  BEFORE INSERT ON public.school_institutional_followup_visits
  FOR EACH ROW EXECUTE FUNCTION public.followup_seat_visit_correction_guard();

-- A projeção can_correct deve acompanhar a regra de escrita. Copia o
-- leitor canônico 0613 sem alterar os seus filtros, limites ou demais campos.
-- Somente o valor de can_correct ganha a verificação do autor natural.
CREATE OR REPLACE FUNCTION public.school_institutional_followup_school(_school text)
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
        v.strengths, v.weaknesses, v.summary, v.participants_note, v.purpose_note,
        v.correction_reason, v.supersedes_id,
        v.recorded_at AS created_at, p.display_name AS author_name,
        (v.author_user_id = auth.uid() AND (
          NOT public.followup_seat_is_account()
          OR v.author_person_id = (
            SELECT holder.person_id FROM public.followup_seat_active_assignment() holder
          )
        )) AS can_correct
        FROM public.school_institutional_followup_visits v
        LEFT JOIN public.institutional_persons p ON p.id = v.author_person_id
        WHERE v.school_id = _school AND NOT EXISTS
         (SELECT 1 FROM public.school_institutional_followup_visits next WHERE next.supersedes_id = v.id)
        ORDER BY v.visit_date DESC, v.recorded_at DESC LIMIT 1000) t),'[]'::jsonb),
    'visit_history', coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC)
      FROM (SELECT v.id, v.logical_id, v.version, v.school_id, v.visit_date, v.diagnosis,
        v.strengths, v.weaknesses, v.summary, v.participants_note, v.purpose_note,
        v.correction_reason, v.supersedes_id,
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

REVOKE ALL ON FUNCTION public.school_institutional_followup_school(text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.school_institutional_followup_school(text)
  TO authenticated;
