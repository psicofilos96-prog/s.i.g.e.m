-- B1.1: a instalação inicial só procede se a política draft escolhida conceder,
-- em escopo rede, ao tipo de atuação inicial TODAS as capacidades administrativas
-- que homologate_capability_policy protege (policy:would-remove-administration).
CREATE OR REPLACE FUNCTION public.sigem_administrative_capabilities()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $$
  SELECT ARRAY['manter-pessoas-institucionais','manter-contas-institucionais','manter-atuacoes-institucionais','registrar-politica-de-capacidades','homologar-politica-de-capacidades']::text[]
$$;
COMMENT ON FUNCTION public.sigem_administrative_capabilities() IS
  'B1.1: lista canônica das 5 capacidades administrativas; idêntica à usada em homologate_capability_policy (policy:would-remove-administration).';
REVOKE ALL ON FUNCTION public.sigem_administrative_capabilities() FROM PUBLIC, anon;

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
  -- B1.1: a atuação inicial (escopo rede) deve deter todas as capacidades administrativas.
  SELECT coalesce(array_agg(c ORDER BY c), '{}') INTO _missing
  FROM unnest(public.sigem_administrative_capabilities()) c
  WHERE NOT EXISTS (
    SELECT 1 FROM capability_policy_rules r
    WHERE r.policy_id = _policy_id AND r.engagement_kind_id = _engagement_kind_id
      AND r.capability_id = c AND r.scope_dimensions = ARRAY['network']::text[]);
  IF cardinality(_missing) > 0 THEN
    RAISE EXCEPTION 'install:initial-engagement-lacks-administration:%', array_to_string(_missing, ','); END IF;
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