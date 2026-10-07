-- N1 — Central de acessos: inventário de contas e auditoria de redefinição (sem valor de senha).
CREATE TABLE public.access_credential_reset_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  requested_count integer NOT NULL CHECK (requested_count > 0),
  succeeded_count integer NOT NULL CHECK (succeeded_count >= 0),
  mode text NOT NULL CHECK (mode IN ('individual','lote-setorial')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.access_credential_reset_targets (
  batch_id uuid NOT NULL REFERENCES public.access_credential_reset_batches(id),
  user_id uuid NOT NULL,
  PRIMARY KEY (batch_id, user_id)
);
GRANT SELECT ON public.access_credential_reset_batches, public.access_credential_reset_targets TO authenticated;
GRANT ALL ON public.access_credential_reset_batches, public.access_credential_reset_targets TO service_role;
ALTER TABLE public.access_credential_reset_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_credential_reset_targets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER access_credential_reset_batches_immutable BEFORE UPDATE OR DELETE ON public.access_credential_reset_batches FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER access_credential_reset_targets_immutable BEFORE UPDATE OR DELETE ON public.access_credential_reset_targets FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Titular da central: capacidade de rede pela perna HUMANA (pessoa × atuação × política homologada).
-- Conta setorial nunca é titular, mesmo que sua estação inclua a capacidade.
CREATE OR REPLACE FUNCTION public.access_center_holder()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.institutional_sector_principals s WHERE s.auth_user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c
                WHERE c.capability_id = 'manter-contas-institucionais' AND c.scope_level = 'rede' AND c.policy_id IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.access_center_holder() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.access_center_holder() TO authenticated;

CREATE POLICY "access center holder reads batches" ON public.access_credential_reset_batches FOR SELECT TO authenticated USING (public.access_center_holder());
CREATE POLICY "access center holder reads targets" ON public.access_credential_reset_targets FOR SELECT TO authenticated USING (public.access_center_holder());

CREATE OR REPLACE FUNCTION public.access_center_inventory()
RETURNS TABLE(user_id uuid, login text, account_kind text, station_code text, scope_kind text, school_id text,
  school_name text, inep text, revoked boolean, banned boolean, last_sign_in_at timestamptz, created_at timestamptz,
  origin text, person_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.access_center_holder() THEN RAISE EXCEPTION 'access-center:not-holder'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text,
    CASE WHEN sp.id IS NOT NULL THEN 'setorial'
         WHEN l.user_id IS NOT NULL AND p.actor_nature = 'orgao-institucional' THEN 'orgao'
         WHEN l.user_id IS NOT NULL THEN 'humano'
         ELSE 'tecnico' END,
    coalesce(sp.station_code, (SELECT string_agg(DISTINCT e.engagement_kind_id, ', ') FROM public.institutional_engagements e
       WHERE e.person_id = l.person_id AND e.valid_from <= CURRENT_DATE AND (e.valid_until IS NULL OR e.valid_until >= CURRENT_DATE)
         AND NOT EXISTS (SELECT 1 FROM public.engagement_endings en WHERE en.engagement_id = e.id))),
    coalesce(sp.scope_kind, CASE WHEN l.user_id IS NOT NULL THEN
      (SELECT CASE WHEN bool_or(e.scope_level = 'rede') THEN 'network' WHEN count(*) > 0 THEN 'school' END FROM public.institutional_engagements e
        WHERE e.person_id = l.person_id AND (e.valid_until IS NULL OR e.valid_until >= CURRENT_DATE)) END),
    sp.school_id,
    (SELECT v.official_name FROM public.institutional_school_record_versions v WHERE v.school_id = sp.school_id ORDER BY v.version_number DESC LIMIT 1),
    (SELECT i.value FROM public.institutional_school_identifiers i WHERE i.school_id = sp.school_id AND i.identifier_kind = 'inep'),
    (r.principal_id IS NOT NULL),
    (u.banned_until IS NOT NULL AND u.banned_until > now()),
    u.last_sign_in_at, u.created_at,
    CASE WHEN sp.id IS NOT NULL THEN sp.provenance
         WHEN l.user_id IS NOT NULL THEN 'cadastro-institucional'
         ELSE 'sem-vinculo-institucional' END,
    p.display_name
  FROM auth.users u
  LEFT JOIN public.institutional_sector_principals sp ON sp.auth_user_id = u.id
  LEFT JOIN public.institutional_sector_principal_revocations r ON r.principal_id = sp.id
  LEFT JOIN public.user_person_links l ON l.user_id = u.id
  LEFT JOIN public.institutional_persons p ON p.id = l.person_id
  ORDER BY 3, 4, 7, 2;
END $$;
REVOKE ALL ON FUNCTION public.access_center_inventory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.access_center_inventory() TO authenticated;

-- Autoriza a redefinição ANTES de qualquer efeito. Lote só de contas setoriais ativas; demais, uma por vez.
CREATE OR REPLACE FUNCTION public.access_center_authorize_reset(_users uuid[])
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int := coalesce(array_length(_users, 1), 0); found int; non_sector int; revoked_n int;
BEGIN
  IF NOT public.access_center_holder() THEN RAISE EXCEPTION 'access-center:not-holder'; END IF;
  IF n = 0 THEN RAISE EXCEPTION 'access-center:empty'; END IF;
  IF n > 500 THEN RAISE EXCEPTION 'access-center:too-many'; END IF;
  SELECT count(*) INTO found FROM auth.users u WHERE u.id = ANY(_users);
  IF found <> (SELECT count(DISTINCT x) FROM unnest(_users) x) THEN RAISE EXCEPTION 'access-center:unknown-account'; END IF;
  SELECT count(*) INTO non_sector FROM unnest(_users) x WHERE NOT EXISTS (SELECT 1 FROM public.institutional_sector_principals s WHERE s.auth_user_id = x);
  SELECT count(*) INTO revoked_n FROM public.institutional_sector_principals s JOIN public.institutional_sector_principal_revocations r ON r.principal_id = s.id WHERE s.auth_user_id = ANY(_users);
  IF revoked_n > 0 THEN RAISE EXCEPTION 'access-center:revoked'; END IF;
  IF n > 1 AND non_sector > 0 THEN RAISE EXCEPTION 'access-center:bulk-only-sector'; END IF;
  RETURN CASE WHEN n > 1 THEN 'lote-setorial' ELSE 'individual' END;
END $$;
REVOKE ALL ON FUNCTION public.access_center_authorize_reset(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.access_center_authorize_reset(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.access_center_record_reset(_users uuid[], _succeeded uuid[])
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE m text; b uuid;
BEGIN
  m := public.access_center_authorize_reset(_users);
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_succeeded, '{}')) x WHERE NOT x = ANY(_users)) THEN RAISE EXCEPTION 'access-center:succeeded-outside-request'; END IF;
  INSERT INTO public.access_credential_reset_batches(actor_user_id, requested_count, succeeded_count, mode)
  VALUES (auth.uid(), array_length(_users, 1), coalesce(array_length(_succeeded, 1), 0), m) RETURNING id INTO b;
  INSERT INTO public.access_credential_reset_targets(batch_id, user_id) SELECT DISTINCT b, x FROM unnest(coalesce(_succeeded, '{}')) x;
  RETURN b;
END $$;
REVOKE ALL ON FUNCTION public.access_center_record_reset(uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.access_center_record_reset(uuid[], uuid[]) TO authenticated;