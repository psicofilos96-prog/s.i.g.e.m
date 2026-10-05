-- 0101: classificação administrativa com três estados por campo — omitido = herdar, valor = alterar,
-- limpar = nome do campo em _clear_administrative (grava NULL na NOVA versão; anteriores intactas).
DROP FUNCTION public.technical_import_educacenso_2026_schools(text,text,date,jsonb);
DROP FUNCTION public.register_school_record_version(text,uuid,text,text,text,text,boolean,date,text,text,text,text,text,text,boolean,boolean,integer,text,text,text);
DROP FUNCTION public.school_record_version_core(text,uuid,text,text,text,text,boolean,date,text,text,text,text,text,text,boolean,boolean,integer,text,text,text,uuid,uuid,uuid,uuid,integer);

CREATE FUNCTION public.school_record_version_core(_school text, _base_version_id uuid, _official_name text, _address text, _district text, _location_kind text, _active boolean, _valid_from date, _justification text, _act_ref text, _inep text, _network_code text, _phone text, _email text, _own_building boolean, _hard_access boolean, _classroom_count integer, _administrative_dependency text, _private_school_category text, _partnership_public_authority text, _clear_administrative text[], _author_user uuid, _author_person uuid, _engagement uuid, _policy_id uuid, _policy_version integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE cur record; nv integer; vid uuid; _sid text := nullif(pg_catalog.btrim(coalesce(_school,'')),'');
  _i text := nullif(pg_catalog.btrim(coalesce(_inep,'')),''); _n text := nullif(pg_catalog.btrim(coalesce(_network_code,'')),'');
  _clr text[] := coalesce(_clear_administrative, '{}'::text[]);
BEGIN
  IF coalesce(pg_catalog.btrim(_official_name),'') = '' THEN RAISE EXCEPTION 'Nome oficial obrigatório'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.unnest(_clr) c WHERE c NOT IN ('administrative_dependency','private_school_category','partnership_public_authority')) THEN
    RAISE EXCEPTION 'school:clear-unknown-field'; END IF;
  _administrative_dependency := nullif(pg_catalog.btrim(coalesce(_administrative_dependency,'')),'');
  _private_school_category := nullif(pg_catalog.btrim(coalesce(_private_school_category,'')),'');
  _partnership_public_authority := nullif(pg_catalog.btrim(coalesce(_partnership_public_authority,'')),'');
  IF ('administrative_dependency' = ANY(_clr) AND _administrative_dependency IS NOT NULL)
     OR ('private_school_category' = ANY(_clr) AND _private_school_category IS NOT NULL)
     OR ('partnership_public_authority' = ANY(_clr) AND _partnership_public_authority IS NOT NULL) THEN
    RAISE EXCEPTION 'school:clear-and-set-conflict'; END IF;
  _act_ref := nullif(pg_catalog.btrim(coalesce(_act_ref,'')),'');
  _email := nullif(pg_catalog.btrim(coalesce(_email,'')),'');
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'school:valid-from-required'; END IF;
  IF _email IS NOT NULL AND _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'E-mail institucional inválido'; END IF;
  IF _sid IS NULL THEN _sid := 'esc-' || pg_catalog.gen_random_uuid(); END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('school:' || _sid));
  SELECT * INTO cur FROM public.institutional_school_record_versions WHERE school_id = _sid ORDER BY version_number DESC LIMIT 1;
  IF cur.id IS NULL THEN
    IF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'Base inexistente'; END IF;
    INSERT INTO public.institutional_schools(id, originating_act_ref, author_user_id) VALUES (_sid, _act_ref, _author_user) ON CONFLICT DO NOTHING;
    nv := 1;
  ELSE
    IF _base_version_id IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'Versão base superada'; END IF;
    IF coalesce(pg_catalog.btrim(_justification),'') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória para mudança cadastral'; END IF;
    nv := cur.version_number + 1;
    IF NOT ('administrative_dependency' = ANY(_clr)) THEN _administrative_dependency := coalesce(_administrative_dependency, cur.administrative_dependency); END IF;
    IF NOT ('private_school_category' = ANY(_clr)) THEN _private_school_category := coalesce(_private_school_category, cur.private_school_category); END IF;
    IF NOT ('partnership_public_authority' = ANY(_clr)) THEN _partnership_public_authority := coalesce(_partnership_public_authority, cur.partnership_public_authority); END IF;
  END IF;
  IF _i IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE identifier_kind='inep' AND value=_i AND school_id<>_sid) THEN RAISE EXCEPTION 'school:inep-in-use'; END IF;
    INSERT INTO public.institutional_school_identifiers(school_id, identifier_kind, value, originating_act_ref, author_user_id)
    VALUES (_sid, 'inep', _i, _act_ref, _author_user) ON CONFLICT (school_id, identifier_kind) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE school_id=_sid AND identifier_kind='inep' AND value=_i) THEN
      RAISE EXCEPTION 'INEP divergente do já cadastrado para esta unidade'; END IF;
  END IF;
  IF _n IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE identifier_kind='codigo-rede' AND value=_n AND school_id<>_sid) THEN RAISE EXCEPTION 'school:network-code-in-use'; END IF;
    INSERT INTO public.institutional_school_identifiers(school_id, identifier_kind, value, originating_act_ref, author_user_id)
    VALUES (_sid, 'codigo-rede', _n, _act_ref, _author_user) ON CONFLICT (school_id, identifier_kind) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE school_id=_sid AND identifier_kind='codigo-rede' AND value=_n) THEN
      RAISE EXCEPTION 'Código de rede divergente do já cadastrado para esta unidade'; END IF;
  END IF;
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, supersedes_version_id, official_name, address, district, location_kind, active, valid_from, justification, originating_act_ref, author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version, phone, institutional_email, own_building, hard_access, classroom_count, administrative_dependency, private_school_category, partnership_public_authority)
  VALUES (_sid, nv, cur.id, pg_catalog.btrim(_official_name), nullif(pg_catalog.btrim(coalesce(_address,'')),''), nullif(pg_catalog.btrim(coalesce(_district,'')),''), _location_kind, _active, _valid_from, _justification, _act_ref, _author_user, _author_person, _engagement, _policy_id, _policy_version, nullif(pg_catalog.btrim(coalesce(_phone,'')),''), _email, _own_building, _hard_access, _classroom_count, _administrative_dependency, _private_school_category, _partnership_public_authority)
  RETURNING id INTO vid;
  RETURN vid;
END $function$;
REVOKE ALL ON FUNCTION public.school_record_version_core(text,uuid,text,text,text,text,boolean,date,text,text,text,text,text,text,boolean,boolean,integer,text,text,text,text[],uuid,uuid,uuid,uuid,integer) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.register_school_record_version(_school text, _base_version_id uuid, _official_name text, _address text, _district text, _location_kind text, _active boolean, _valid_from date, _justification text, _act_ref text, _inep text, _network_code text, _phone text DEFAULT NULL::text, _email text DEFAULT NULL::text, _own_building boolean DEFAULT NULL::boolean, _hard_access boolean DEFAULT NULL::boolean, _classroom_count integer DEFAULT NULL::integer, _administrative_dependency text DEFAULT NULL::text, _private_school_category text DEFAULT NULL::text, _partnership_public_authority text DEFAULT NULL::text, _clear_administrative text[] DEFAULT NULL::text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE g record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT c.engagement_id, c.policy_id, c.policy_version INTO g FROM public.effective_scope_capabilities(current_date) c
   WHERE c.capability_id = 'manter-cadastro-unidade-escolar' AND c.scope_level = 'rede' LIMIT 1;
  IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'capability:manter-cadastro-unidade-escolar não concedida por política homologada com alcance de rede'; END IF;
  RETURN public.school_record_version_core(_school, _base_version_id, _official_name, _address, _district, _location_kind, _active, _valid_from, _justification, _act_ref, _inep, _network_code, _phone, _email, _own_building, _hard_access, _classroom_count, _administrative_dependency, _private_school_category, _partnership_public_authority, _clear_administrative, auth.uid(), public.current_person_id(), g.engagement_id, g.policy_id, g.policy_version);
END $function$;
REVOKE ALL ON FUNCTION public.register_school_record_version(text,uuid,text,text,text,text,boolean,date,text,text,text,text,text,text,boolean,boolean,integer,text,text,text,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_school_record_version(text,uuid,text,text,text,text,boolean,date,text,text,text,text,text,text,boolean,boolean,integer,text,text,text,text[]) TO authenticated, service_role;

CREATE FUNCTION public.technical_import_educacenso_2026_schools(_operation_kind text, _source_hash text, _snapshot date, _schools jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE op uuid; fp text; r jsonb; t0 timestamptz := pg_catalog.clock_timestamp(); existing record; vid uuid; n int := 0;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'technical:automation-disabled'; END IF;
  IF _operation_kind IS DISTINCT FROM 'technical_import_educacenso_2026_schools' THEN RAISE EXCEPTION 'technical:operation-kind-mismatch'; END IF;
  IF _source_hash IS DISTINCT FROM 'fd2e288bf598fcedce527470a54601eabf96d46a19e85ce03672254954a3d494' THEN RAISE EXCEPTION 'technical:source-hash-mismatch'; END IF;
  IF _snapshot IS DISTINCT FROM DATE '2026-08-31' THEN RAISE EXCEPTION 'technical:snapshot-mismatch'; END IF;
  IF pg_catalog.jsonb_typeof(_schools) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'technical:payload-not-array'; END IF;
  IF pg_catalog.jsonb_array_length(_schools) <> 55 THEN RAISE EXCEPTION 'technical:count-total'; END IF;
  IF (SELECT count(DISTINCT e->>'inep') FROM pg_catalog.jsonb_array_elements(_schools) e WHERE coalesce(e->>'inep','') ~ '^[0-9]{8}$') <> 55 THEN RAISE EXCEPTION 'technical:inep-unique'; END IF;
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(_schools) e WHERE e->>'administrative_dependency'='municipal') <> 40 THEN RAISE EXCEPTION 'technical:count-municipal'; END IF;
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(_schools) e WHERE e->>'administrative_dependency'='privada' AND e->>'partnership_public_authority' IS NOT NULL) <> 15 THEN RAISE EXCEPTION 'technical:count-conveniada'; END IF;
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(_schools) e WHERE e->>'location_kind'='urbana') <> 41 THEN RAISE EXCEPTION 'technical:count-urbana'; END IF;
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(_schools) e WHERE e->>'location_kind'='rural') <> 14 THEN RAISE EXCEPTION 'technical:count-rural'; END IF;
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(_schools) e WHERE (e->'active') = 'true'::jsonb) <> 55 THEN RAISE EXCEPTION 'technical:count-active'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(_schools) e WHERE nullif(e->>'network_code','') IS NOT NULL) THEN RAISE EXCEPTION 'technical:network-code-not-allowed'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(_schools) e WHERE e->>'school_id' IS DISTINCT FROM 'inep-' || (e->>'inep')) THEN RAISE EXCEPTION 'technical:school-id-pattern'; END IF;
  fp := pg_catalog.encode(extensions.digest(_schools::text, 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('technical:' || _operation_kind));
  SELECT * INTO existing FROM public.technical_execution_operations WHERE operation_kind = _operation_kind AND source_hash = _source_hash;
  IF existing.id IS NOT NULL THEN
    IF existing.payload_fingerprint <> fp THEN RAISE EXCEPTION 'technical:payload-differs-from-recorded-operation'; END IF;
    RETURN existing.id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.institutional_school_identifiers i JOIN pg_catalog.jsonb_array_elements(_schools) e ON i.identifier_kind='inep' AND i.value = e->>'inep')
     OR EXISTS (SELECT 1 FROM public.institutional_schools s JOIN pg_catalog.jsonb_array_elements(_schools) e ON s.id = e->>'school_id') THEN
    RAISE EXCEPTION 'technical:schools-already-present';
  END IF;
  op := pg_catalog.gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, _operation_kind, 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento',
          'Matriz_Escolas_Itaperuna_Censo2026.xlsx; docs/data/educacenso-2026-school-staging.json', _source_hash, 'decisao-do-proprietario', fp, 'concluida',
          pg_catalog.jsonb_build_object('total',55,'municipal',40,'privada_conveniada',15,'urbana',41,'rural',14,'ativas',55,'snapshot','2026-08-31'), t0);
  FOR r IN SELECT * FROM pg_catalog.jsonb_array_elements(_schools) LOOP
    vid := public.school_record_version_core(r->>'school_id', NULL, r->>'official_name', NULL, NULL, r->>'location_kind', true, _snapshot,
      'Carga técnica EducaCenso 2026 (operação ' || op || ')', NULL, r->>'inep', NULL, r->>'phone', r->>'institutional_email',
      NULL, NULL, NULL, r->>'administrative_dependency', r->>'private_school_category', r->>'partnership_public_authority', NULL,
      NULL, NULL, NULL, NULL, NULL);
    INSERT INTO public.technical_execution_targets VALUES (op, 'institutional_school_record_versions', vid::text), (op, 'institutional_schools', r->>'school_id');
    n := n + 1;
  END LOOP;
  IF n <> 55 THEN RAISE EXCEPTION 'technical:written-count'; END IF;
  RETURN op;
END $function$;
REVOKE ALL ON FUNCTION public.technical_import_educacenso_2026_schools(text,text,date,jsonb) FROM PUBLIC, anon, authenticated, service_role;