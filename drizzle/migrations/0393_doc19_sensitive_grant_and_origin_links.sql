CREATE OR REPLACE FUNCTION public.read_sensitive_case_document(_case_event_id uuid, _purpose text)
RETURNS TABLE(document_ref text, content_sha256 text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _e public.admin_case_events;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'sensitive:no-person'; END IF;
  IF length(btrim(coalesce(_purpose,''))) < 5 THEN RAISE EXCEPTION 'sensitive:purpose-required'; END IF;
  SELECT * INTO _e FROM public.admin_case_events WHERE id = _case_event_id;
  IF NOT FOUND OR NOT (public.case_can_act(public.admin_case_current_unit(_e.case_id), 'ler-anexos-sensiveis')
     OR public.admin_case_granted(_e.case_id, 'leitura_anexos_sensiveis')) THEN RAISE EXCEPTION 'sensitive:forbidden'; END IF;
  INSERT INTO public.admin_case_sensitive_access_log(case_event_id, purpose, reader_person) VALUES (_case_event_id, btrim(_purpose), _person);
  RETURN QUERY SELECT _e.document_ref, _e.content_sha256;
END $$;
-- admin_case_granted('leitura') também aceita escopo sensível; o sensível exige o próprio escopo:
CREATE OR REPLACE FUNCTION public.admin_case_granted(_case_id uuid, _scope text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_case_access_grants g WHERE g.case_id = _case_id AND g.grantee_person = public.current_person_id()
    AND g.valid_until >= current_date AND (g.scope = _scope OR (_scope = 'leitura' AND g.scope = 'leitura_anexos_sensiveis'))
    AND NOT EXISTS (SELECT 1 FROM public.admin_case_access_revocations r WHERE r.grant_id = g.id)) $$;
COMMENT ON COLUMN public.admin_case_access_grants.revoked_at IS 'DEPRECATED: revogação é registro em admin_case_access_revocations';

-- L21–L23: vínculo do processo ao fato do módulo de origem (referência, nunca cópia)
CREATE TABLE public.admin_case_origin_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.admin_case_files(id),
  origin_module text NOT NULL CHECK (origin_module IN ('secretaria-escolar','gestao-de-pessoas','direcao-escolar','supervisao','orientacao','familia','sistema-externo')),
  origin_ref text NOT NULL,
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, origin_module, origin_ref)
);
GRANT SELECT ON public.admin_case_origin_links TO authenticated;
GRANT ALL ON public.admin_case_origin_links TO service_role;
ALTER TABLE public.admin_case_origin_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "origin links follow case" ON public.admin_case_origin_links FOR SELECT TO authenticated USING (public.admin_case_readable(case_id));
CREATE TRIGGER admin_case_origin_links_immutable BEFORE UPDATE OR DELETE ON public.admin_case_origin_links FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE OR REPLACE FUNCTION public.link_admin_case_origin(_case_id uuid, _origin_module text, _origin_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id();
BEGIN
  IF _p IS NULL OR NOT public.case_can_act(public.admin_case_current_unit(_case_id), 'instruir-processos') THEN RAISE EXCEPTION 'origin:forbidden'; END IF;
  IF _origin_module = 'sistema-externo' THEN RAISE EXCEPTION 'origin:external-system-not-configured'; END IF;
  IF coalesce(btrim(_origin_ref),'') = '' THEN RAISE EXCEPTION 'origin:missing-ref'; END IF;
  INSERT INTO public.admin_case_origin_links(case_id, origin_module, origin_ref, author_person) VALUES (_case_id, _origin_module, btrim(_origin_ref), _p)
  ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.link_admin_case_origin(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_admin_case_origin(uuid,text,text) TO authenticated;