ALTER TABLE public.institutional_visit_records ADD COLUMN IF NOT EXISTS recorded_by_principal_id uuid;

CREATE OR REPLACE FUNCTION public.school_visit_book_principal(_school text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT p.id FROM public.institutional_sector_principals p
  WHERE p.id = public.current_principal_id(current_date)
    AND p.station_code IN ('secretaria_escolar','direcao_escolar')
    AND p.scope_kind <> 'network' AND p.school_id = _school
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.school_visit_book_principal(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.school_visit_book_principal(text) TO authenticated;

-- Default visitor kinds ("Padrão do sistema") until the network homologates the catalog.
CREATE OR REPLACE FUNCTION public.school_visit_default_kinds()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['supervisao-escolar','orientacao-pedagogica','nei','ciece','acompanhamento-institucional','gabinete','conselho-tutelar','ministerio-publico','vigilancia-sanitaria','outro']
$$;

CREATE OR REPLACE FUNCTION public.record_school_visit(_logical uuid, _base uuid, _school text, _visited_on date,
  _kind text, _identification text, _origin text, _annul boolean, _correction_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr uuid; g record; cur record; _v integer := 1; _lid uuid := coalesce(_logical, gen_random_uuid()); _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  pr := public.school_visit_book_principal(_school);
  IF pr IS NULL THEN
    SELECT ec.engagement_id, ec.policy_id, ec.policy_version INTO g FROM public.effective_capabilities(current_date) ec
     WHERE ec.capability_id = 'registrar-visita-institucional' AND (ec.school_id = _school OR ec.school_id IS NULL) AND ec.class_id IS NULL LIMIT 1;
    IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'Sem permissão para registrar visitas nesta escola'; END IF;
  END IF;
  IF NOT (_kind = ANY (public.school_visit_default_kinds())) THEN RAISE EXCEPTION 'Tipo de visitante não reconhecido'; END IF;
  IF coalesce(btrim(_identification),'') = '' THEN RAISE EXCEPTION 'Identificação do visitante ausente'; END IF;
  IF _visited_on IS NULL OR _visited_on > current_date THEN RAISE EXCEPTION 'Data da visita inválida'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ivr:' || _lid));
  SELECT * INTO cur FROM institutional_visit_records WHERE logical_id = _lid ORDER BY version DESC LIMIT 1;
  IF cur.id IS NOT NULL THEN
    IF _base IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'Registro alterado por outra pessoa; recarregue'; END IF;
    IF cur.annulled THEN RAISE EXCEPTION 'Visita anulada não é corrigida'; END IF;
    IF coalesce(btrim(_correction_reason),'') = '' THEN RAISE EXCEPTION 'Correção ou anulação exige motivo'; END IF;
    IF cur.school_id <> _school THEN RAISE EXCEPTION 'Visita não muda de escola'; END IF;
    _v := cur.version + 1;
  ELSIF _base IS NOT NULL THEN RAISE EXCEPTION 'Registro base inexistente';
  ELSIF coalesce(_annul, false) THEN RAISE EXCEPTION 'Anulação exige visita existente'; END IF;
  INSERT INTO institutional_visit_records(logical_id, version, supersedes_id, school_id, visited_on, visitor_kind_id, visitor_kind_version,
    declared_identification, origin_organization, additional_identification, annulled, originating_act_ref, correction_reason,
    author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version, recorded_by_principal_id)
  VALUES (_lid, _v, cur.id, _school, _visited_on, _kind, 1, btrim(_identification), nullif(btrim(_origin),''), '{}'::jsonb,
    coalesce(_annul,false), NULL, nullif(btrim(_correction_reason),''), auth.uid(), public.current_person_id(), g.engagement_id, g.policy_id, g.policy_version, pr)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_school_visit(uuid,uuid,text,date,text,text,text,boolean,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_school_visit(uuid,uuid,text,date,text,text,text,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.school_visits_book(_school text)
RETURNS TABLE(id uuid, logical_id uuid, version integer, supersedes_id uuid, school_id text, visited_on date,
  visitor_kind_id text, visitor_kind_version integer, declared_identification text, origin_organization text,
  annulled boolean, originating_act_ref text, correction_reason text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  IF public.school_visit_book_principal(_school) IS NULL
     AND NOT public.has_school_capability('consultar-registro-de-visitas', _school)
     AND NOT EXISTS (SELECT 1 FROM public.effective_capabilities(current_date) ec WHERE ec.capability_id='registrar-visita-institucional' AND (ec.school_id=_school OR ec.school_id IS NULL)) THEN
    RAISE EXCEPTION 'Sem permissão para consultar visitas desta escola';
  END IF;
  RETURN QUERY SELECT v.id, v.logical_id, v.version, v.supersedes_id, v.school_id, v.visited_on, v.visitor_kind_id, v.visitor_kind_version,
    v.declared_identification, v.origin_organization, v.annulled, v.originating_act_ref, v.correction_reason, v.recorded_at
  FROM institutional_visit_records v WHERE v.school_id = _school ORDER BY v.visited_on DESC, v.version DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.school_visits_book(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.school_visits_book(text) TO authenticated;