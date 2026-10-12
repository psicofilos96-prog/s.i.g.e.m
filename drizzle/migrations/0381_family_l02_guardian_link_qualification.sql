-- Família L02: qualificação do vínculo (tipo, restrições, autor) por versão da autorização. Append-only.
CREATE TABLE public.guardian_link_qualifications (
  authorization_id uuid PRIMARY KEY REFERENCES public.guardian_authorizations(id),
  link_type text NOT NULL CHECK (link_type IN ('legal','cadastrado','autorizado')),
  restrictions text[] NOT NULL DEFAULT '{}' CHECK (restrictions <@ ARRAY['sem-frequencia','sem-avaliacao','sem-saude','sem-documentos','sem-comunicados','sem-matricula']::text[]),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.guardian_link_qualifications FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.guardian_link_qualifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_guardian_authorization_v4(_base_id uuid, _kind text, _student text, _guardian_person uuid, _school text,
  _relation_scheme text, _relation_value text, _sections text[], _valid_from date, _valid_until date, _reason text, _source_ref text,
  _link_type text, _restrictions text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE t text := _link_type; r text[] := coalesce(_restrictions, '{}'); eff text[]; nid uuid; prev public.guardian_link_qualifications;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _base_id IS NOT NULL THEN
    SELECT * INTO prev FROM public.guardian_link_qualifications WHERE authorization_id = _base_id;
    IF _kind = 'revogacao' THEN t := coalesce(prev.link_type, t); r := coalesce(prev.restrictions, r); END IF;
  END IF;
  IF t IS NULL OR t NOT IN ('legal','cadastrado','autorizado') THEN RAISE EXCEPTION 'family:link-type-invalid'; END IF;
  IF NOT (r <@ ARRAY['sem-frequencia','sem-avaliacao','sem-saude','sem-documentos','sem-comunicados','sem-matricula']::text[]) THEN RAISE EXCEPTION 'family:restriction-invalid'; END IF;
  IF _kind <> 'revogacao' THEN
    IF t = 'legal' AND coalesce(btrim(_source_ref), '') = '' THEN RAISE EXCEPTION 'family:legal-requires-source'; END IF;
    IF t = 'autorizado' AND _valid_until IS NULL THEN RAISE EXCEPTION 'family:authorized-requires-end'; END IF;
    IF t = 'autorizado' AND (_sections && ARRAY['saude','matricula']::text[]) THEN RAISE EXCEPTION 'family:authorized-section-forbidden'; END IF;
    SELECT coalesce(pg_catalog.array_agg(s), '{}') INTO eff FROM pg_catalog.unnest(_sections) s
     WHERE NOT (('sem-' || s) = ANY (r));
    IF pg_catalog.cardinality(eff) = 0 THEN RAISE EXCEPTION 'family:no-section-left'; END IF;
  ELSE
    eff := _sections;
  END IF;
  nid := public.record_guardian_authorization_v3(_base_id, _kind, _student, _guardian_person, _school,
    _relation_scheme, _relation_value, eff, _valid_from, _valid_until, _reason, _source_ref);
  INSERT INTO public.guardian_link_qualifications(authorization_id, link_type, restrictions, recorded_by)
  VALUES (nid, t, r, auth.uid());
  RETURN nid;
END $fn$;
REVOKE ALL ON FUNCTION public.record_guardian_authorization_v4(uuid,text,text,uuid,text,text,text,text[],date,date,text,text,text,text[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_guardian_authorization_v4(uuid,text,text,uuid,text,text,text,text[],date,date,text,text,text,text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.guardian_link_qualifications_at(_school text, _student text)
RETURNS TABLE(authorization_id uuid, link_type text, restrictions text[], recorded_by uuid, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT public.has_school_capability('manter-autorizacao-de-responsavel', _school) THEN RAISE EXCEPTION 'capability:manter-autorizacao-de-responsavel'; END IF;
  RETURN QUERY SELECT q.authorization_id, q.link_type, q.restrictions, q.recorded_by, q.recorded_at
    FROM public.guardian_link_qualifications q JOIN public.guardian_authorizations a ON a.id = q.authorization_id
   WHERE a.school_id = _school AND a.student_id = _student ORDER BY q.recorded_at;
END $fn$;
REVOKE ALL ON FUNCTION public.guardian_link_qualifications_at(text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.guardian_link_qualifications_at(text,text) TO authenticated;

-- v3 continua sendo etapa interna de v4; não é mais chamada direto pelas telas.
COMMENT ON FUNCTION public.record_guardian_authorization_v3(uuid,text,text,uuid,text,text,text,text[],date,date,text,text) IS 'DEPRECATED for UI: use record_guardian_authorization_v4 (tipo e restrições).';