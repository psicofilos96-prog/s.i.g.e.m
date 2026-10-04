-- B1.3 — Ativação institucional inicial sem ato externo + designação do login mestre.
-- Decisão do proprietário/gestor do projeto (chat 2026-10-04): login mestre admin@sigem.itap.gov.br;
-- não existe ato administrativo externo para ativar o SIGEM. Nenhum ato é fabricado: a proveniência
-- da ativação é o próprio registro (executor, instante, política, impressão digital, identidade).

CREATE TABLE public.sigem_installer_designation_versions (
  version integer PRIMARY KEY CHECK (version >= 1),
  installer_email text NOT NULL CHECK (installer_email = lower(btrim(installer_email)) AND installer_email <> ''),
  basis text NOT NULL CHECK (basis IN ('designacao-legada','decisao-de-bootstrap-do-proprietario')),
  basis_note text NOT NULL CHECK (btrim(basis_note) <> ''),
  designation_act_ref text,
  supersedes_version integer REFERENCES public.sigem_installer_designation_versions(version),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((version = 1 AND supersedes_version IS NULL) OR supersedes_version = version - 1)
);
GRANT ALL ON public.sigem_installer_designation_versions TO service_role;
ALTER TABLE public.sigem_installer_designation_versions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER installer_designation_versions_immutable BEFORE UPDATE OR DELETE ON public.sigem_installer_designation_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.sigem_installer_designation_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (SELECT state FROM public.sigem_installation_state WHERE singleton) <> 'nao-instalado' THEN
    RAISE EXCEPTION 'designation:already-activated'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER installer_designation_versions_only_before_activation BEFORE INSERT ON public.sigem_installer_designation_versions
  FOR EACH ROW EXECUTE FUNCTION public.sigem_installer_designation_guard();

COMMENT ON TABLE public.sigem_installer_designation IS
  'DEPRECATED (B1.3): substituída por sigem_installer_designation_versions; preservada como registro histórico imutável.';

CREATE OR REPLACE FUNCTION public.sigem_designated_installer_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT installer_email FROM public.sigem_installer_designation_versions ORDER BY version DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.sigem_designated_installer_email() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF (SELECT state FROM public.sigem_installation_state WHERE singleton) <> 'nao-instalado' THEN
    RAISE EXCEPTION 'b1.3:designation-change-requires-nao-instalado'; END IF;
  INSERT INTO public.sigem_installer_designation_versions(version, installer_email, basis, basis_note, designation_act_ref)
  SELECT 1, lower(installer_email), 'designacao-legada', 'cópia da designação B4.6.7d (0037) preservada em sigem_installer_designation', designation_act_ref
  FROM public.sigem_installer_designation WHERE singleton;
  INSERT INTO public.sigem_installer_designation_versions(version, installer_email, basis, basis_note, designation_act_ref, supersedes_version)
  VALUES (coalesce((SELECT max(version) FROM public.sigem_installer_designation_versions), 0) + 1,
    'admin@sigem.itap.gov.br', 'decisao-de-bootstrap-do-proprietario',
    'decisão do proprietário/gestor do projeto (chat 2026-10-04, B1.3): admin@sigem.itap.gov.br é o login mestre e único ativador inicial; não existe ato administrativo externo',
    NULL, (SELECT max(version) FROM public.sigem_installer_designation_versions));
END $$;

ALTER TABLE public.sigem_installation_acts ALTER COLUMN act_ref DROP NOT NULL;
ALTER TABLE public.sigem_installation_acts ADD COLUMN provenance text NOT NULL DEFAULT 'ato-externo'
  CHECK (provenance IN ('ato-externo','ativacao-inicial-sem-ato-externo'));
ALTER TABLE public.sigem_installation_acts ADD COLUMN policy_fingerprint text CHECK (policy_fingerprint ~ '^[0-9a-f]{64}$');
ALTER TABLE public.sigem_installation_acts ADD CONSTRAINT installation_acts_provenance_shape CHECK (
  (provenance = 'ato-externo' AND act_ref IS NOT NULL AND btrim(act_ref) <> '')
  OR (provenance = 'ativacao-inicial-sem-ato-externo' AND act_ref IS NULL AND policy_fingerprint IS NOT NULL));

ALTER TABLE public.capability_policies ADD COLUMN homologation_origin text
  CHECK (homologation_origin IN ('ato-administrativo','ativacao-inicial'));
ALTER TABLE public.capability_policies ADD CONSTRAINT capability_policies_homologation_origin_shape CHECK (
  status <> 'homologated' OR homologation_origin IS NULL
  OR (homologation_origin = 'ato-administrativo' AND homologation_act_ref IS NOT NULL)
  OR (homologation_origin = 'ativacao-inicial' AND homologation_act_ref IS NULL));

CREATE OR REPLACE FUNCTION public.am_designated_installer()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND lower(u.email) = public.sigem_designated_installer_email())
    AND (SELECT state FROM sigem_installation_state WHERE singleton) = 'nao-instalado'
$function$;

CREATE OR REPLACE FUNCTION public.installation_review()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE _uid uuid := auth.uid(); _state text; _email text; _confirmed boolean; _des text;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('contract','b4.6.7e/1','state','access-denied'); END IF;
  SELECT state INTO _state FROM public.sigem_installation_state WHERE singleton;
  _des := public.sigem_designated_installer_email();
  SELECT lower(email), email_confirmed_at IS NOT NULL INTO _email, _confirmed FROM auth.users WHERE id = _uid;
  IF _des IS NULL OR _email IS DISTINCT FROM _des THEN
    RETURN jsonb_build_object('contract','b4.6.7e/1','state','access-denied'); END IF;
  RETURN jsonb_build_object('contract','b4.6.7e/1','state','lido','installation', _state,'emailConfirmed', _confirmed,
    'designatedLogin', _des, 'initialEngagementKind', public.sigem_general_admin_kind(),
    'policies', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'logicalPolicyId', p.logical_policy_id, 'version', p.version, 'status', p.status,
        'validFrom', p.valid_from, 'validUntil', p.valid_until, 'fingerprint', public.sigem_policy_fingerprint(p.id),
        'rules', coalesce((SELECT jsonb_agg(jsonb_build_object('engagementKindId', r.engagement_kind_id, 'capabilityId', r.capability_id, 'scope', to_jsonb(r.scope_dimensions))
                 ORDER BY r.engagement_kind_id, r.capability_id) FROM public.capability_policy_rules r WHERE r.policy_id = p.id), '[]'::jsonb))
        ORDER BY p.version) FROM public.capability_policies p WHERE p.status = 'draft'), '[]'::jsonb));
END $function$;

CREATE OR REPLACE FUNCTION public.install_sigem(_act_ref text, _person_name text, _person_identifier text, _engagement_kind_id text, _position_label text, _policy_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _state text; _email text; _designated text; _person uuid; _eng uuid; _act uuid; _pstatus text; _missing text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'install:unauthenticated'; END IF;
  SELECT state INTO _state FROM sigem_installation_state WHERE singleton FOR UPDATE;
  IF _state <> 'nao-instalado' THEN RAISE EXCEPTION 'install:already-installed'; END IF;
  _designated := public.sigem_designated_installer_email();
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
  WHERE NOT EXISTS (SELECT 1 FROM capability_policy_rules r WHERE r.policy_id = _policy_id AND r.engagement_kind_id = _engagement_kind_id
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
  UPDATE capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = _act_ref,
    homologation_origin = 'ato-administrativo', valid_from = coalesce(valid_from, current_date) WHERE id = _policy_id;
  INSERT INTO sigem_installation_acts(executor_user_id, person_id, engagement_id, policy_id, act_ref, provenance, policy_fingerprint)
  VALUES (auth.uid(), _person, _eng, _policy_id, _act_ref, 'ato-externo', public.sigem_policy_fingerprint(_policy_id)) RETURNING id INTO _act;
  UPDATE sigem_installation_state SET state = 'instalado', changed_at = now() WHERE singleton;
  RETURN _act;
END $function$;
COMMENT ON FUNCTION public.install_sigem_reviewed(text,text,text,text,text,text,uuid,text,boolean) IS
  'DEPRECATED (B1.3): porta com ato externo preservada por compatibilidade; a ativação inicial usa activate_sigem_reviewed.';

CREATE OR REPLACE FUNCTION public.homologate_capability_policy(_policy uuid, _act_ref text, _valid_from date)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  UPDATE capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = _act_ref,
    homologation_origin = 'ato-administrativo', valid_from = _valid_from WHERE id = _policy;
END $function$;

CREATE OR REPLACE FUNCTION public.activate_sigem_reviewed(_policy_id uuid, _expected_fingerprint text, _confirm_all_rules_reviewed boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _email text; _confirmed boolean; _state text; _pstatus text; _fp text;
  _kind text := public.sigem_general_admin_kind(); _missing text[]; _person uuid; _nature text; _eng uuid; _act uuid;
  _name constant text := 'Administrador Geral do SIGEM';
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'install:unauthenticated'; END IF;
  SELECT lower(email), email_confirmed_at IS NOT NULL INTO _email, _confirmed FROM auth.users WHERE id = _uid;
  IF _email IS NULL THEN RAISE EXCEPTION 'install:unauthenticated'; END IF;
  IF _confirm_all_rules_reviewed IS NOT TRUE THEN RAISE EXCEPTION 'install:review-not-confirmed'; END IF;
  IF _expected_fingerprint IS NULL OR _expected_fingerprint !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'install:fingerprint-invalid'; END IF;
  SELECT state INTO _state FROM public.sigem_installation_state WHERE singleton FOR UPDATE;
  IF _state IS DISTINCT FROM 'nao-instalado' THEN RAISE EXCEPTION 'install:already-installed'; END IF;
  IF _email IS DISTINCT FROM public.sigem_designated_installer_email() THEN RAISE EXCEPTION 'install:not-designated'; END IF;
  IF NOT _confirmed THEN RAISE EXCEPTION 'install:email-not-confirmed'; END IF;
  SELECT status INTO _pstatus FROM public.capability_policies WHERE id = _policy_id FOR UPDATE;
  IF _pstatus IS NULL THEN RAISE EXCEPTION 'install:policy-not-found'; END IF;
  IF _pstatus <> 'draft' THEN RAISE EXCEPTION 'install:policy-not-draft'; END IF;
  LOCK TABLE public.capability_policy_rules IN SHARE MODE;
  _fp := public.sigem_policy_fingerprint(_policy_id);
  IF _fp IS DISTINCT FROM _expected_fingerprint THEN RAISE EXCEPTION 'install:review-stale'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.capability_policy_rules WHERE policy_id = _policy_id AND engagement_kind_id = _kind) THEN
    RAISE EXCEPTION 'install:engagement-kind-without-rules'; END IF;
  SELECT coalesce(array_agg(c ORDER BY c), '{}') INTO _missing
  FROM unnest(public.sigem_administrative_capabilities()) c
  WHERE NOT EXISTS (SELECT 1 FROM public.capability_policy_rules r WHERE r.policy_id = _policy_id AND r.engagement_kind_id = _kind
      AND r.capability_id = c AND r.scope_dimensions = ARRAY['network']::text[]);
  IF cardinality(_missing) > 0 THEN
    RAISE EXCEPTION 'install:initial-engagement-lacks-administration:%', array_to_string(_missing, ','); END IF;
  IF EXISTS (SELECT 1 FROM public.sigem_general_admin_coverage_issues(_policy_id)) THEN
    RAISE EXCEPTION 'install:general-admin-coverage-incomplete'; END IF;

  SELECT person_id INTO _person FROM public.user_person_links WHERE user_id = _uid;
  IF _person IS NULL THEN
    INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES (_name, 'orgao-institucional') RETURNING id INTO _person;
    INSERT INTO public.user_person_links(user_id, person_id) VALUES (_uid, _person);
    INSERT INTO public.institutional_actor_nature_origins(person_id, actor_nature, origin, recorded_by)
    VALUES (_person, 'orgao-institucional', 'declarada na ativação institucional inicial (B1.3), sem ato externo', _uid);
  ELSE
    SELECT actor_nature INTO _nature FROM public.institutional_persons WHERE id = _person;
    IF _nature IS DISTINCT FROM 'orgao-institucional' THEN RAISE EXCEPTION 'install:actor-nature-divergent'; END IF;
  END IF;
  INSERT INTO public.institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, scope_level, valid_from, originating_act_ref)
  VALUES (_person, _kind, _name, 'rede', current_date, NULL) RETURNING id INTO _eng;
  UPDATE public.capability_policies SET status = 'homologated', homologated_at = now(), homologation_act_ref = NULL,
    homologation_origin = 'ativacao-inicial', valid_from = coalesce(valid_from, current_date) WHERE id = _policy_id;
  INSERT INTO public.sigem_installation_acts(executor_user_id, person_id, engagement_id, policy_id, act_ref, provenance, policy_fingerprint)
  VALUES (_uid, _person, _eng, _policy_id, NULL, 'ativacao-inicial-sem-ato-externo', _fp) RETURNING id INTO _act;
  UPDATE public.sigem_installation_state SET state = 'instalado', changed_at = now() WHERE singleton;
  RETURN _act;
END $$;
REVOKE ALL ON FUNCTION public.activate_sigem_reviewed(uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_sigem_reviewed(uuid,text,boolean) TO authenticated;
COMMENT ON FUNCTION public.activate_sigem_reviewed(uuid,text,boolean) IS
  'B1.3: ativação institucional inicial sem ato externo; atuação inicial = Administrador Geral (órgão), proveniência = o próprio registro.';

CREATE TABLE public.sigem_activator_account_origins (
  user_id uuid PRIMARY KEY,
  login text NOT NULL,
  requested_by_user_id uuid NOT NULL,
  designation_version integer NOT NULL REFERENCES public.sigem_installer_designation_versions(version),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sigem_activator_account_origins TO service_role;
ALTER TABLE public.sigem_activator_account_origins ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER activator_account_origins_immutable BEFORE UPDATE OR DELETE ON public.sigem_activator_account_origins
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
COMMENT ON TABLE public.sigem_activator_account_origins IS
  'B1.3: criação da conta do ativador designado (senha escolhida pela pessoa, nunca gravada aqui).';