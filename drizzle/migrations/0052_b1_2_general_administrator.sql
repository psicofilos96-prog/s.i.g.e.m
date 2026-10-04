-- B1.2: Administrador Geral do SIGEM = tipo de atuação transversal próprio.
-- Sem flag, sem bypass, sem wildcard: o poder vem só de regras explícitas da política
-- homologada; a completude é verificada (nunca concedida) por sigem_general_admin_coverage_issues.
CREATE OR REPLACE FUNCTION public.sigem_general_admin_kind()
 RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $$ SELECT 'administrador-geral-do-sigem'::text $$;
REVOKE ALL ON FUNCTION public.sigem_general_admin_kind() FROM PUBLIC, anon;

-- Problemas de completude do Administrador Geral numa política. Política sem regras do
-- Administrador Geral não é avaliada (zero linhas): o tipo é opcional.
CREATE OR REPLACE FUNCTION public.sigem_general_admin_coverage_issues(_policy uuid)
 RETURNS TABLE(issue text, capability_id text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  WITH k AS (SELECT public.sigem_general_admin_kind() AS kind),
  has_master AS (SELECT EXISTS (SELECT 1 FROM public.capability_policy_rules r, k WHERE r.policy_id = _policy AND r.engagement_kind_id = k.kind) AS v),
  sector AS (SELECT DISTINCT r.capability_id FROM public.capability_policy_rules r, k WHERE r.policy_id = _policy AND r.engagement_kind_id <> k.kind),
  master AS (SELECT r.capability_id, r.scope_dimensions FROM public.capability_policy_rules r, k WHERE r.policy_id = _policy AND r.engagement_kind_id = k.kind)
  SELECT * FROM (
    SELECT 'missing-sector-capability', s.capability_id FROM sector s
      WHERE NOT EXISTS (SELECT 1 FROM master m WHERE m.capability_id = s.capability_id AND m.scope_dimensions = ARRAY['network']::text[])
    UNION ALL
    SELECT 'missing-administrative-capability', a FROM unnest(public.sigem_administrative_capabilities()) a
      WHERE NOT EXISTS (SELECT 1 FROM master m WHERE m.capability_id = a AND m.scope_dimensions = ARRAY['network']::text[])
    UNION ALL
    SELECT 'scope-not-network', m.capability_id FROM master m WHERE m.scope_dimensions <> ARRAY['network']::text[]
    UNION ALL
    SELECT 'master-only-capability', m.capability_id FROM master m
      WHERE NOT EXISTS (SELECT 1 FROM sector s WHERE s.capability_id = m.capability_id)
        AND NOT (m.capability_id = ANY (public.sigem_administrative_capabilities()))
  ) x WHERE (SELECT v FROM has_master)
$$;
REVOKE ALL ON FUNCTION public.sigem_general_admin_coverage_issues(uuid) FROM PUBLIC, anon, authenticated;

-- Instalação: mantém B1.1 e acrescenta a completude do Administrador Geral.
CREATE OR REPLACE FUNCTION public.install_sigem(_act_ref text, _person_name text, _person_identifier text, _engagement_kind_id text, _position_label text, _policy_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _state text; _email text; _designated text; _person uuid; _eng uuid; _act uuid; _pstatus text; _missing text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'install:unauthenticated'; END IF;
  SELECT state INTO _state FROM sigem_installation_state WHERE singleton FOR UPDATE;
  IF _state <> 'nao-instalado' THEN RAISE EXCEPTION 'install:already-installed'; END IF;
  SELECT lower(installer_email) INTO _designated FROM sigem_installer_designation WHERE singleton;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid();
  IF _designated IS NULL OR _email IS NULL OR _email <> _designated THEN RAISE EXCEPTION 'install:not-designated'; END IF;
  IF coalesce(btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'install:act-required'; END IF;
  IF coalesce(btrim(_engagement_kind_id),'') = '' THEN RAISE EXCEPTION 'install:engagement-kind-required'; END IF;
  SELECT status INTO _pstatus FROM capability_policies WHERE id = _policy_id FOR UPDATE;
  IF _pstatus IS NULL OR _pstatus <> 'draft' THEN RAISE EXCEPTION 'install:policy-not-draft'; END IF;
  IF NOT EXISTS (SELECT 1 FROM capability_policy_rules WHERE policy_id = _policy_id AND engagement_kind_id = _engagement_kind_id) THEN
    RAISE EXCEPTION 'install:engagement-kind-without-rules'; END IF;
  SELECT coalesce(array_agg(c ORDER BY c), '{}') INTO _missing
  FROM unnest(public.sigem_administrative_capabilities()) c
  WHERE NOT EXISTS (
    SELECT 1 FROM capability_policy_rules r
    WHERE r.policy_id = _policy_id AND r.engagement_kind_id = _engagement_kind_id
      AND r.capability_id = c AND r.scope_dimensions = ARRAY['network']::text[]);
  IF cardinality(_missing) > 0 THEN
    RAISE EXCEPTION 'install:initial-engagement-lacks-administration:%', array_to_string(_missing, ','); END IF;
  IF EXISTS (SELECT 1 FROM public.sigem_general_admin_coverage_issues(_policy_id)) THEN
    RAISE EXCEPTION 'install:general-admin-coverage-incomplete'; END IF;
  SELECT person_id INTO _person FROM user_person_links WHERE user_id = auth.uid();
  IF _person IS NULL THEN
    IF coalesce(btrim(_person_name),'') = '' THEN RAISE EXCEPTION 'install:person-name-required'; END IF;
    INSERT INTO institutional_persons(display_name, institutional_identifier) VALUES (btrim(_person_name), nullif(btrim(_person_identifier),'')) RETURNING id INTO _person;
    INSERT INTO user_person_links(user_id, person_id) VALUES (auth.uid(), _person);
  END IF;
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, scope_level, valid_from, originating_act_ref)
  VALUES (_person, _engagement_kind_id, nullif(btrim(_position_label),''), 'rede', current_date, _act_ref) RETURNING id INTO _eng;
  UPDATE capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = _act_ref, valid_from = coalesce(valid_from, current_date) WHERE id = _policy_id;
  INSERT INTO sigem_installation_acts(executor_user_id, person_id, engagement_id, policy_id, act_ref) VALUES (auth.uid(), _person, _eng, _policy_id, _act_ref) RETURNING id INTO _act;
  UPDATE sigem_installation_state SET state = 'instalado', changed_at = now() WHERE singleton;
  RETURN _act;
END $function$;

-- Homologação pós-instalação: corpo anterior + completude do Administrador Geral.
CREATE OR REPLACE FUNCTION public.homologate_capability_policy(_policy uuid, _act_ref text, _valid_from date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _p record; _cap text; _missing text[] := '{}';
BEGIN
  IF NOT public.has_network_capability('homologar-politica-de-capacidades') THEN RAISE EXCEPTION 'capability:homologar-politica-de-capacidades'; END IF;
  SELECT * INTO _p FROM capability_policies WHERE id = _policy FOR UPDATE;
  IF _p.id IS NULL OR _p.status <> 'draft' THEN RAISE EXCEPTION 'policy:not-draft'; END IF;
  IF coalesce(btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'policy:act-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'policy:valid-from-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.sigem_general_admin_coverage_issues(_policy)) THEN RAISE EXCEPTION 'policy:general-admin-coverage-incomplete'; END IF;
  FOREACH _cap IN ARRAY public.sigem_administrative_capabilities() LOOP
    IF NOT EXISTS (
      SELECT 1 FROM institutional_engagements e
      JOIN capability_policy_rules r ON r.engagement_kind_id = e.engagement_kind_id
      JOIN capability_policies q ON q.id = r.policy_id
      WHERE r.capability_id = _cap AND e.scope_level = 'rede'
        AND e.valid_from <= _valid_from AND (e.valid_until IS NULL OR e.valid_until >= _valid_from)
        AND (q.id = _policy OR (q.status = 'homologated' AND q.id IS DISTINCT FROM _p.supersedes_version_id
             AND (q.valid_until IS NULL OR q.valid_until >= _valid_from)
             AND NOT EXISTS (SELECT 1 FROM capability_policies s WHERE s.supersedes_version_id = q.id AND s.status = 'homologated' AND s.valid_from <= _valid_from)))
    ) THEN _missing := _missing || _cap; END IF;
  END LOOP;
  IF array_length(_missing,1) > 0 THEN RAISE EXCEPTION 'policy:would-remove-administration:%', array_to_string(_missing, ','); END IF;
  UPDATE capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = _act_ref, valid_from = _valid_from WHERE id = _policy;
END $function$;

-- Gates que nomeavam o tipo de atuação passam a ser semânticos (escopo da regra), sem wildcard.
CREATE OR REPLACE FUNCTION public.b2_4_authorizing_engagement()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _engagement uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'b2_4:unauthenticated'; END IF;
  SELECT c.engagement_id INTO _engagement
  FROM public.effective_scope_capabilities(current_date) c
  WHERE c.capability_id = 'manter-anos-e-periodos-letivos' AND c.scope_level = 'rede'
  ORDER BY c.engagement_id
  LIMIT 1;
  IF _engagement IS NULL THEN RAISE EXCEPTION 'capability:manter-anos-e-periodos-letivos'; END IF;
  RETURN _engagement;
END $function$;

CREATE OR REPLACE FUNCTION public.class_registry_school_grant(_capability text, _school text)
 RETURNS TABLE(engagement_id uuid, policy_id uuid, policy_version integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT c.engagement_id, c.policy_id, c.policy_version
  FROM public.effective_scope_capabilities(current_date) c
  JOIN public.institutional_engagements e ON e.id = c.engagement_id
  JOIN public.capability_policy_rules r ON r.policy_id = c.policy_id
    AND r.engagement_kind_id = e.engagement_kind_id AND r.capability_id = c.capability_id
  WHERE auth.uid() IS NOT NULL
    AND _capability IN ('manter-cadastro-de-turmas', 'manter-organizacao-de-periodos-da-turma')
    AND _school IS NOT NULL
    AND c.capability_id = _capability
    AND ((c.scope_level = 'escola' AND c.school_id = _school AND r.scope_dimensions = ARRAY['school']::text[])
      OR (c.scope_level = 'rede' AND r.scope_dimensions = ARRAY['network']::text[]
          AND EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school)))
  ORDER BY (c.scope_level = 'escola') DESC, c.policy_version DESC, c.engagement_id
  LIMIT 1
$function$;

-- Leitura da sessão: atuações vigentes da PRÓPRIA pessoa no tipo Administrador Geral que
-- efetivamente produzem capacidade homologada. Sem regra homologada ⇒ nada.
CREATE OR REPLACE FUNCTION public.general_admin_session()
 RETURNS TABLE(engagement_id uuid, position_label text, capability_count integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT e.id, e.position_label_snapshot, count(DISTINCT c.capability_id)::int
  FROM public.effective_scope_capabilities(CURRENT_DATE) c
  JOIN public.institutional_engagements e ON e.id = c.engagement_id
  WHERE auth.uid() IS NOT NULL AND c.policy_id IS NOT NULL
    AND e.engagement_kind_id = public.sigem_general_admin_kind() AND e.scope_level = 'rede'
  GROUP BY e.id, e.position_label_snapshot
$$;
REVOKE ALL ON FUNCTION public.general_admin_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.general_admin_session() TO authenticated;