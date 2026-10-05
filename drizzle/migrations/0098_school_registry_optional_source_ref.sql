-- 0098: documento/ato é proveniência opcional no cadastro de unidades (blank ⇒ NULL); demais gates inalterados.
CREATE OR REPLACE FUNCTION public.register_school_record_version(_school text, _base_version_id uuid, _official_name text, _address text, _district text, _location_kind text, _active boolean, _valid_from date, _justification text, _act_ref text, _inep text, _network_code text, _phone text DEFAULT NULL::text, _email text DEFAULT NULL::text, _own_building boolean DEFAULT NULL::boolean, _hard_access boolean DEFAULT NULL::boolean, _classroom_count integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE g record; cur record; nv integer; vid uuid; pid uuid; _sid text := nullif(btrim(coalesce(_school,'')),'');
  _i text := nullif(btrim(coalesce(_inep,'')),''); _n text := nullif(btrim(coalesce(_network_code,'')),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT c.engagement_id, c.policy_id, c.policy_version INTO g FROM public.effective_scope_capabilities(current_date) c
   WHERE c.capability_id = 'manter-cadastro-unidade-escolar' AND c.scope_level = 'rede' LIMIT 1;
  IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'capability:manter-cadastro-unidade-escolar não concedida por política homologada com alcance de rede'; END IF;
  IF coalesce(trim(_official_name),'') = '' THEN RAISE EXCEPTION 'Nome oficial obrigatório'; END IF;
  _act_ref := nullif(btrim(coalesce(_act_ref,'')),'');
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'school:valid-from-required'; END IF;
  IF _email IS NOT NULL AND _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail institucional inválido'; END IF;
  IF _sid IS NULL THEN _sid := 'esc-' || gen_random_uuid(); END IF;
  pid := public.current_person_id();
  PERFORM pg_advisory_xact_lock(hashtext('school:' || _sid));
  SELECT * INTO cur FROM public.institutional_school_record_versions WHERE school_id = _sid ORDER BY version_number DESC LIMIT 1;
  IF cur.id IS NULL THEN
    IF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'Base inexistente'; END IF;
    INSERT INTO public.institutional_schools(id, originating_act_ref, author_user_id) VALUES (_sid, _act_ref, auth.uid()) ON CONFLICT DO NOTHING;
    nv := 1;
  ELSE
    IF _base_version_id IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'Versão base superada'; END IF;
    IF coalesce(trim(_justification),'') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória para mudança cadastral'; END IF;
    nv := cur.version_number + 1;
  END IF;
  IF _i IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE identifier_kind='inep' AND value=_i AND school_id<>_sid) THEN RAISE EXCEPTION 'school:inep-in-use'; END IF;
    INSERT INTO public.institutional_school_identifiers(school_id, identifier_kind, value, originating_act_ref, author_user_id)
    VALUES (_sid, 'inep', _i, _act_ref, auth.uid()) ON CONFLICT (school_id, identifier_kind) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE school_id=_sid AND identifier_kind='inep' AND value=_i) THEN
      RAISE EXCEPTION 'INEP divergente do já cadastrado para esta unidade'; END IF;
  END IF;
  IF _n IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE identifier_kind='codigo-rede' AND value=_n AND school_id<>_sid) THEN RAISE EXCEPTION 'school:network-code-in-use'; END IF;
    INSERT INTO public.institutional_school_identifiers(school_id, identifier_kind, value, originating_act_ref, author_user_id)
    VALUES (_sid, 'codigo-rede', _n, _act_ref, auth.uid()) ON CONFLICT (school_id, identifier_kind) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE school_id=_sid AND identifier_kind='codigo-rede' AND value=_n) THEN
      RAISE EXCEPTION 'Código de rede divergente do já cadastrado para esta unidade'; END IF;
  END IF;
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, supersedes_version_id, official_name, address, district, location_kind, active, valid_from, justification, originating_act_ref, author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version, phone, institutional_email, own_building, hard_access, classroom_count)
  VALUES (_sid, nv, cur.id, btrim(_official_name), nullif(btrim(coalesce(_address,'')),''), nullif(btrim(coalesce(_district,'')),''), _location_kind, _active, _valid_from, _justification, _act_ref, auth.uid(), pid, g.engagement_id, g.policy_id, g.policy_version, nullif(btrim(coalesce(_phone,'')),''), _email, _own_building, _hard_access, _classroom_count)
  RETURNING id INTO vid;
  RETURN vid;
END $function$;