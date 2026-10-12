-- Família L03: alteração sem tipo/restrição informados herda da versão anterior (nunca rebaixa um vínculo legal).
CREATE OR REPLACE FUNCTION public.record_guardian_authorization_v4(_base_id uuid, _kind text, _student text, _guardian_person uuid, _school text,
  _relation_scheme text, _relation_value text, _sections text[], _valid_from date, _valid_until date, _reason text, _source_ref text,
  _link_type text, _restrictions text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE t text := _link_type; r text[] := _restrictions; eff text[]; nid uuid; prev public.guardian_link_qualifications;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _base_id IS NOT NULL THEN
    SELECT * INTO prev FROM public.guardian_link_qualifications WHERE authorization_id = _base_id;
    IF _kind = 'revogacao' THEN t := coalesce(prev.link_type, t); r := coalesce(prev.restrictions, r);
    ELSE t := coalesce(t, prev.link_type); r := coalesce(r, prev.restrictions); END IF;
  END IF;
  r := coalesce(r, '{}');
  IF t IS NULL OR t NOT IN ('legal','cadastrado','autorizado') THEN RAISE EXCEPTION 'family:link-type-invalid'; END IF;
  IF NOT (r <@ ARRAY['sem-frequencia','sem-avaliacao','sem-saude','sem-documentos','sem-comunicados','sem-matricula']::text[]) THEN RAISE EXCEPTION 'family:restriction-invalid'; END IF;
  IF _kind <> 'revogacao' THEN
    IF t = 'legal' AND coalesce(btrim(_source_ref), '') = '' AND prev.authorization_id IS NULL THEN RAISE EXCEPTION 'family:legal-requires-source'; END IF;
    IF t = 'autorizado' AND _valid_until IS NULL THEN RAISE EXCEPTION 'family:authorized-requires-end'; END IF;
    IF t = 'autorizado' AND (_sections && ARRAY['saude','matricula']::text[]) THEN RAISE EXCEPTION 'family:authorized-section-forbidden'; END IF;
    SELECT coalesce(pg_catalog.array_agg(s), '{}') INTO eff FROM pg_catalog.unnest(_sections) s WHERE NOT (('sem-' || s) = ANY (r));
    IF pg_catalog.cardinality(eff) = 0 THEN RAISE EXCEPTION 'family:no-section-left'; END IF;
  ELSE
    eff := _sections;
  END IF;
  nid := public.record_guardian_authorization_v3(_base_id, _kind, _student, _guardian_person, _school,
    _relation_scheme, _relation_value, eff, _valid_from, _valid_until, _reason, _source_ref);
  INSERT INTO public.guardian_link_qualifications(authorization_id, link_type, restrictions, recorded_by) VALUES (nid, t, r, auth.uid());
  RETURN nid;
END $fn$;
REVOKE ALL ON FUNCTION public.record_guardian_authorization_v4(uuid,text,text,uuid,text,text,text,text[],date,date,text,text,text,text[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_guardian_authorization_v4(uuid,text,text,uuid,text,text,text,text[],date,date,text,text,text,text[]) TO authenticated;