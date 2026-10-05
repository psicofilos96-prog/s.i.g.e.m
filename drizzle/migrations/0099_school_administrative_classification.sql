-- 0099: classificação administrativa da unidade (dependência, categoria privada, poder público do convênio)
-- como atributos da versão cadastral append-only; valores abertos, preservados como na fonte.
ALTER TABLE public.institutional_school_record_versions
  ADD COLUMN administrative_dependency text,
  ADD COLUMN private_school_category text,
  ADD COLUMN partnership_public_authority text;
COMMENT ON COLUMN public.institutional_school_record_versions.administrative_dependency IS 'Dependência administrativa como na fonte (valor aberto); NULL = não informada.';
COMMENT ON COLUMN public.institutional_school_record_versions.private_school_category IS 'Categoria da escola privada como na fonte (valor aberto); NULL = não se aplica ou não informada.';
COMMENT ON COLUMN public.institutional_school_record_versions.partnership_public_authority IS 'Poder público responsável pela parceria/convênio como na fonte; NULL = sem convênio informado.';
DROP FUNCTION public.register_school_record_version(text,uuid,text,text,text,text,boolean,date,text,text,text,text,text,text,boolean,boolean,integer);
CREATE OR REPLACE FUNCTION public.register_school_record_version(_school text, _base_version_id uuid, _official_name text, _address text, _district text, _location_kind text, _active boolean, _valid_from date, _justification text, _act_ref text, _inep text, _network_code text, _phone text DEFAULT NULL::text, _email text DEFAULT NULL::text, _own_building boolean DEFAULT NULL::boolean, _hard_access boolean DEFAULT NULL::boolean, _classroom_count integer DEFAULT NULL::integer, _administrative_dependency text DEFAULT NULL::text, _private_school_category text DEFAULT NULL::text, _partnership_public_authority text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g record; cur record; nv integer; vid uuid; pid uuid; _sid text := nullif(pg_catalog.btrim(coalesce(_school,'')),'');
  _i text := nullif(pg_catalog.btrim(coalesce(_inep,'')),''); _n text := nullif(pg_catalog.btrim(coalesce(_network_code,'')),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT c.engagement_id, c.policy_id, c.policy_version INTO g FROM public.effective_scope_capabilities(current_date) c
   WHERE c.capability_id = 'manter-cadastro-unidade-escolar' AND c.scope_level = 'rede' LIMIT 1;
  IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'capability:manter-cadastro-unidade-escolar não concedida por política homologada com alcance de rede'; END IF;
  IF coalesce(pg_catalog.btrim(_official_name),'') = '' THEN RAISE EXCEPTION 'Nome oficial obrigatório'; END IF;
  _administrative_dependency := nullif(pg_catalog.btrim(coalesce(_administrative_dependency,'')),'');
  _private_school_category := nullif(pg_catalog.btrim(coalesce(_private_school_category,'')),'');
  _partnership_public_authority := nullif(pg_catalog.btrim(coalesce(_partnership_public_authority,'')),'');
  _act_ref := nullif(pg_catalog.btrim(coalesce(_act_ref,'')),'');
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'school:valid-from-required'; END IF;
  IF _email IS NOT NULL AND _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail institucional inválido'; END IF;
  IF _sid IS NULL THEN _sid := 'esc-' || pg_catalog.gen_random_uuid(); END IF;
  pid := public.current_person_id();
  PERFORM pg_advisory_xact_lock(pg_catalog.hashtext('school:' || _sid));
  SELECT * INTO cur FROM public.institutional_school_record_versions WHERE school_id = _sid ORDER BY version_number DESC LIMIT 1;
  IF cur.id IS NULL THEN
    IF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'Base inexistente'; END IF;
    INSERT INTO public.institutional_schools(id, originating_act_ref, author_user_id) VALUES (_sid, _act_ref, auth.uid()) ON CONFLICT DO NOTHING;
    nv := 1;
  ELSE
    IF _base_version_id IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'Versão base superada'; END IF;
    IF coalesce(pg_catalog.btrim(_justification),'') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória para mudança cadastral'; END IF;
    nv := cur.version_number + 1;
    _administrative_dependency := coalesce(_administrative_dependency, cur.administrative_dependency);
    _private_school_category := coalesce(_private_school_category, cur.private_school_category);
    _partnership_public_authority := coalesce(_partnership_public_authority, cur.partnership_public_authority);
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
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, supersedes_version_id, official_name, address, district, location_kind, active, valid_from, justification, originating_act_ref, author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version, phone, institutional_email, own_building, hard_access, classroom_count, administrative_dependency, private_school_category, partnership_public_authority)
  VALUES (_sid, nv, cur.id, pg_catalog.btrim(_official_name), nullif(pg_catalog.btrim(coalesce(_address,'')),''), nullif(pg_catalog.btrim(coalesce(_district,'')),''), _location_kind, _active, _valid_from, _justification, _act_ref, auth.uid(), pid, g.engagement_id, g.policy_id, g.policy_version, nullif(pg_catalog.btrim(coalesce(_phone,'')),''), _email, _own_building, _hard_access, _classroom_count, _administrative_dependency, _private_school_category, _partnership_public_authority)
  RETURNING id INTO vid;
  RETURN vid;
END $function$;

REVOKE ALL ON FUNCTION public.register_school_record_version(text,uuid,text,text,text,text,boolean,date,text,text,text,text,text,text,boolean,boolean,integer,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_school_record_version(text,uuid,text,text,text,text,boolean,date,text,text,text,text,text,text,boolean,boolean,integer,text,text,text) TO authenticated, service_role;