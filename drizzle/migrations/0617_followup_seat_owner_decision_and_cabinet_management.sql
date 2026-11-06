-- 0617 — Decisão do proprietário do SIGEM (06/11/2026): os postos do
-- acompanhamento recebem capacidades pela própria designação, em toda a rede;
-- o Gabinete é órgão (sem pessoa natural), só consulta e administra quem ocupa
-- acomp1/acomp2. Nada aqui altera user_person_links nem outras áreas.

CREATE TABLE public.followup_seat_capability_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_code text NOT NULL CHECK (seat_code IN ('acomp1','acomp2','gab')),
  capability_id text NOT NULL CHECK (capability_id IN (
    'registrar-acompanhamento-institucional','consultar-acompanhamento-institucional',
    'administrar-postos-de-acompanhamento')),
  scope_level text NOT NULL DEFAULT 'rede' CHECK (scope_level = 'rede'),
  valid_from date NOT NULL,
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) BETWEEN 3 AND 300),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (seat_code, capability_id)
);
REVOKE ALL ON public.followup_seat_capability_decisions FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.followup_seat_capability_decisions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER followup_seat_capability_decisions_immutable
  BEFORE UPDATE OR DELETE ON public.followup_seat_capability_decisions
  FOR EACH ROW EXECUTE FUNCTION public.followup_seat_append_only();
INSERT INTO public.followup_seat_capability_decisions (seat_code, capability_id, valid_from, decision_ref)
SELECT s, c, DATE '2026-11-06', 'Decisão do proprietário do SIGEM em 06/11/2026: acompanhamento em toda a rede'
FROM (VALUES ('acomp1','registrar-acompanhamento-institucional'),
             ('acomp2','registrar-acompanhamento-institucional'),
             ('gab','consultar-acompanhamento-institucional'),
             ('gab','administrar-postos-de-acompanhamento')) v(s, c);

-- Ocupante vigente: acomp1/acomp2 = pessoa natural; gab = órgão institucional.
CREATE OR REPLACE FUNCTION public.followup_seat_active_assignment()
RETURNS TABLE(seat_code text, person_id uuid, assignment_id uuid)
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
  SELECT a.seat_code, a.person_id, a.id
  FROM public.followup_seat_assignments a
  JOIN public.institutional_persons p ON p.id = a.person_id
    AND ((a.seat_code IN ('acomp1','acomp2') AND p.actor_nature = 'pessoa-natural')
      OR (a.seat_code = 'gab' AND p.actor_nature = 'orgao-institucional'))
  JOIN auth.users u ON u.id = a.auth_user_id
    AND u.raw_app_meta_data->>'sigem_account' = 'followup-functional-pending'
    AND u.raw_app_meta_data->>'followup_seat' = a.seat_code
  JOIN auth.sessions sess ON sess.id = _sid AND sess.user_id = u.id
    AND sess.created_at >= a.designated_at
    AND (sess.not_after IS NULL OR sess.not_after > now())
  WHERE a.auth_user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.followup_seat_revocations r WHERE r.assignment_id = a.id)
  ORDER BY a.designated_at DESC, a.id DESC LIMIT 1;
END $$;
REVOKE ALL ON FUNCTION public.followup_seat_active_assignment() FROM PUBLIC, anon, authenticated, service_role;

-- Capacidades do posto = decisão registrada do proprietário (policy_id nulo =
-- designação explícita, como B4.6.8). Nunca herda capacidades da pessoa.
CREATE OR REPLACE FUNCTION public.followup_seat_effective_grants(_on date)
RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid,
  policy_version integer, scope_level text, school_id text, person_id uuid, person_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT d.capability_id, s.assignment_id, NULL::uuid, NULL::integer, d.scope_level,
    NULL::text, s.person_id, ip.display_name
  FROM public.followup_seat_active_assignment() s
  JOIN public.institutional_persons ip ON ip.id = s.person_id
  JOIN public.followup_seat_capability_decisions d ON d.seat_code = s.seat_code
  WHERE d.valid_from <= _on
$$;
REVOKE ALL ON FUNCTION public.followup_seat_effective_grants(date) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.followup_seat_cabinet_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.followup_seat_effective_grants(
    (now() AT TIME ZONE 'America/Sao_Paulo')::date) g
    JOIN public.followup_seat_active_assignment() s ON s.assignment_id = g.engagement_id
    WHERE s.seat_code = 'gab' AND g.capability_id = 'administrar-postos-de-acompanhamento')
$$;
REVOKE ALL ON FUNCTION public.followup_seat_cabinet_manager() FROM PUBLIC, anon, authenticated, service_role;

-- Quadro dos postos acomp1/acomp2: ocupante vigente e histórico (somente Gabinete).
CREATE FUNCTION public.followup_seat_roster()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.followup_seat_cabinet_manager() THEN RAISE EXCEPTION 'followup-seat:cabinet-denied'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'assignment_id', a.id, 'seat_code', a.seat_code, 'person_id', a.person_id,
      'person_name', p.display_name, 'designated_at', a.designated_at, 'act_ref', a.act_ref,
      'revoked_at', r.revoked_at, 'revocation_reason', r.reason)
      ORDER BY a.seat_code, a.designated_at DESC)
    FROM public.followup_seat_assignments a
    JOIN public.institutional_persons p ON p.id = a.person_id
    LEFT JOIN public.followup_seat_revocations r ON r.assignment_id = a.id
    WHERE a.seat_code IN ('acomp1','acomp2')), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.followup_seat_roster() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.followup_seat_roster() TO authenticated;

-- Busca de servidores (pessoa natural) para designar; retorno mínimo.
CREATE FUNCTION public.followup_seat_person_search(_q text)
RETURNS TABLE(person_id uuid, display_name text, login text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.followup_seat_cabinet_manager() THEN RAISE EXCEPTION 'followup-seat:cabinet-denied'; END IF;
  IF length(btrim(coalesce(_q,''))) < 3 THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.display_name, (SELECT u.email::text FROM public.user_person_links l
      JOIN auth.users u ON u.id = l.user_id WHERE l.person_id = p.id LIMIT 1)
  FROM public.institutional_persons p
  WHERE p.actor_nature = 'pessoa-natural'
    AND p.display_name ILIKE '%' || replace(replace(btrim(_q), '%', ''), '_', '') || '%'
  ORDER BY p.display_name LIMIT 20;
END $$;
REVOKE ALL ON FUNCTION public.followup_seat_person_search(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.followup_seat_person_search(text) TO authenticated;

-- Troca do ocupante de acomp1/acomp2 pelo Gabinete: encerra o vigente e
-- designa o novo numa única transação. Sessões antigas do posto perdem acesso.
CREATE FUNCTION public.followup_seat_cabinet_replace(_seat text, _person uuid, _reason text, _request uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _id uuid; _user uuid; _cur uuid;
BEGIN
  IF NOT public.followup_seat_cabinet_manager() THEN RAISE EXCEPTION 'followup-seat:cabinet-denied'; END IF;
  IF _seat NOT IN ('acomp1','acomp2') OR _person IS NULL OR _request IS NULL
    OR length(btrim(coalesce(_reason,''))) NOT BETWEEN 3 AND 200
  THEN RAISE EXCEPTION 'followup-seat:invalid-designation'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('followup-seat:'||_seat, 0));
  SELECT id INTO _id FROM public.followup_seat_assignments WHERE request_key = _request;
  IF _id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.followup_seat_assignments a WHERE a.id = _id
      AND a.seat_code = _seat AND a.person_id = _person) THEN RETURN _id; END IF;
    RAISE EXCEPTION 'followup-seat:request-conflict';
  END IF;
  SELECT u.id INTO _user FROM auth.users u
   WHERE lower(u.email) = _seat || '@sigem.itap.gov.br'
     AND u.raw_app_meta_data->>'sigem_account' = 'followup-functional-pending'
     AND u.raw_app_meta_data->>'followup_seat' = _seat;
  IF _user IS NULL THEN RAISE EXCEPTION 'followup-seat:account-not-confirmed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_persons p
    WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
  THEN RAISE EXCEPTION 'followup-seat:natural-person-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.followup_seat_assignments a
    WHERE a.person_id = _person AND a.seat_code <> _seat
      AND NOT EXISTS (SELECT 1 FROM public.followup_seat_revocations r WHERE r.assignment_id = a.id))
  THEN RAISE EXCEPTION 'followup-seat:person-holds-other-seat'; END IF;
  FOR _cur IN SELECT a.id FROM public.followup_seat_assignments a
    WHERE a.seat_code = _seat
      AND NOT EXISTS (SELECT 1 FROM public.followup_seat_revocations r WHERE r.assignment_id = a.id)
  LOOP
    INSERT INTO public.followup_seat_revocations (assignment_id, revoked_by, reason, request_key)
    VALUES (_cur, auth.uid(), 'Substituição pelo Gabinete: ' || btrim(_reason), gen_random_uuid());
  END LOOP;
  INSERT INTO public.followup_seat_assignments
    (auth_user_id, seat_code, person_id, designated_at, designated_by, act_ref, request_key)
  VALUES (_user, _seat, _person, clock_timestamp(), auth.uid(), 'Gabinete: ' || btrim(_reason), _request)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.followup_seat_cabinet_replace(text,uuid,text,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.followup_seat_cabinet_replace(text,uuid,text,uuid) TO authenticated;

-- Deixar o posto vago (sem novo ocupante).
CREATE FUNCTION public.followup_seat_cabinet_vacate(_seat text, _reason text, _request uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _n integer;
BEGIN
  IF NOT public.followup_seat_cabinet_manager() THEN RAISE EXCEPTION 'followup-seat:cabinet-denied'; END IF;
  IF _seat NOT IN ('acomp1','acomp2') OR _request IS NULL
    OR length(btrim(coalesce(_reason,''))) NOT BETWEEN 3 AND 200
  THEN RAISE EXCEPTION 'followup-seat:revocation-invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('followup-seat:'||_seat, 0));
  IF EXISTS (SELECT 1 FROM public.followup_seat_revocations WHERE request_key = _request) THEN RETURN 0; END IF;
  INSERT INTO public.followup_seat_revocations (assignment_id, revoked_by, reason, request_key)
  SELECT a.id, auth.uid(), 'Posto deixado vago pelo Gabinete: ' || btrim(_reason),
    CASE WHEN row_number() OVER () = 1 THEN _request ELSE gen_random_uuid() END
  FROM public.followup_seat_assignments a
  WHERE a.seat_code = _seat
    AND NOT EXISTS (SELECT 1 FROM public.followup_seat_revocations r WHERE r.assignment_id = a.id);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.followup_seat_cabinet_vacate(text,text,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.followup_seat_cabinet_vacate(text,text,uuid) TO authenticated;