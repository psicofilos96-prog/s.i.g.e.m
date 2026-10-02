CREATE TABLE public.institutional_schools (
  id text PRIMARY KEY,
  originating_act_ref text,
  author_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.institutional_schools TO authenticated;
GRANT ALL ON public.institutional_schools TO service_role;
ALTER TABLE public.institutional_schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura do cadastro de unidades" ON public.institutional_schools FOR SELECT TO authenticated USING (true);
CREATE TRIGGER institutional_schools_immutable BEFORE UPDATE OR DELETE ON public.institutional_schools FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TABLE public.institutional_school_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  identifier_kind text NOT NULL,
  value text NOT NULL,
  originating_act_ref text,
  author_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identifier_kind, value),
  UNIQUE (school_id, identifier_kind)
);
GRANT SELECT ON public.institutional_school_identifiers TO authenticated;
GRANT ALL ON public.institutional_school_identifiers TO service_role;
ALTER TABLE public.institutional_school_identifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura dos identificadores de unidades" ON public.institutional_school_identifiers FOR SELECT TO authenticated USING (true);
CREATE TRIGGER institutional_school_identifiers_immutable BEFORE UPDATE OR DELETE ON public.institutional_school_identifiers FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TABLE public.institutional_school_record_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  version_number integer NOT NULL,
  supersedes_version_id uuid REFERENCES public.institutional_school_record_versions(id),
  official_name text NOT NULL,
  address text,
  district text,
  location_kind text,
  active boolean NOT NULL,
  valid_from date NOT NULL,
  justification text,
  originating_act_ref text,
  author_user_id uuid,
  author_person_id uuid REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid REFERENCES public.capability_policies(id),
  capability_policy_version integer,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, version_number),
  CHECK (location_kind IS NULL OR location_kind IN ('urbana','rural'))
);
GRANT SELECT ON public.institutional_school_record_versions TO authenticated;
GRANT ALL ON public.institutional_school_record_versions TO service_role;
ALTER TABLE public.institutional_school_record_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura das versões cadastrais de unidades" ON public.institutional_school_record_versions FOR SELECT TO authenticated USING (true);
CREATE TRIGGER institutional_school_versions_immutable BEFORE UPDATE OR DELETE ON public.institutional_school_record_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

ALTER TABLE public.institutional_classes ADD CONSTRAINT institutional_classes_school_fk FOREIGN KEY (school_id) REFERENCES public.institutional_schools(id);
ALTER TABLE public.institutional_engagements ADD CONSTRAINT institutional_engagements_school_fk FOREIGN KEY (school_id) REFERENCES public.institutional_schools(id);
ALTER TABLE public.school_enrollments ADD CONSTRAINT school_enrollments_school_fk FOREIGN KEY (school_id) REFERENCES public.institutional_schools(id);
ALTER TABLE public.class_enrollment_episodes ADD CONSTRAINT class_enrollment_episodes_school_fk FOREIGN KEY (school_id) REFERENCES public.institutional_schools(id);

-- Gravação: somente com capacidade de rede efetiva (política homologada). Sem ela, falha fechada.
CREATE OR REPLACE FUNCTION public.register_school_record_version(
  _school text, _base_version_id uuid, _official_name text, _address text, _district text,
  _location_kind text, _active boolean, _valid_from date, _justification text, _act_ref text,
  _inep text, _network_code text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; cur record; nv integer; vid uuid; pid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT ec.engagement_id, ec.policy_id, ec.policy_version INTO g
    FROM public.effective_capabilities(current_date) ec
   WHERE ec.capability_id = 'manter-cadastro-unidade-escolar'
     AND (ec.school_id = _school) LIMIT 1;
  IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'Capacidade manter-cadastro-unidade-escolar não concedida por política homologada'; END IF;
  IF coalesce(trim(_official_name),'') = '' THEN RAISE EXCEPTION 'Nome oficial obrigatório'; END IF;
  pid := public.current_person_id();
  PERFORM pg_advisory_xact_lock(hashtext('school:' || _school));
  SELECT * INTO cur FROM public.institutional_school_record_versions WHERE school_id = _school ORDER BY version_number DESC LIMIT 1;
  IF cur.id IS NULL THEN
    IF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'Base inexistente'; END IF;
    INSERT INTO public.institutional_schools(id, originating_act_ref, author_user_id) VALUES (_school, _act_ref, auth.uid()) ON CONFLICT DO NOTHING;
    nv := 1;
  ELSE
    IF _base_version_id IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'Versão base superada'; END IF;
    IF coalesce(trim(_justification),'') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória para mudança cadastral'; END IF;
    nv := cur.version_number + 1;
  END IF;
  IF _inep IS NOT NULL THEN
    INSERT INTO public.institutional_school_identifiers(school_id, identifier_kind, value, originating_act_ref, author_user_id)
    VALUES (_school, 'inep', _inep, _act_ref, auth.uid()) ON CONFLICT (school_id, identifier_kind) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE school_id=_school AND identifier_kind='inep' AND value=_inep) THEN
      RAISE EXCEPTION 'INEP divergente do já cadastrado para esta unidade'; END IF;
  END IF;
  IF _network_code IS NOT NULL THEN
    INSERT INTO public.institutional_school_identifiers(school_id, identifier_kind, value, originating_act_ref, author_user_id)
    VALUES (_school, 'codigo-rede', _network_code, _act_ref, auth.uid()) ON CONFLICT (school_id, identifier_kind) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE school_id=_school AND identifier_kind='codigo-rede' AND value=_network_code) THEN
      RAISE EXCEPTION 'Código de rede divergente do já cadastrado para esta unidade'; END IF;
  END IF;
  INSERT INTO public.institutional_school_record_versions(school_id, version_number, supersedes_version_id, official_name, address, district, location_kind, active, valid_from, justification, originating_act_ref, author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_school, nv, cur.id, _official_name, _address, _district, _location_kind, _active, _valid_from, _justification, _act_ref, auth.uid(), pid, g.engagement_id, g.policy_id, g.policy_version)
  RETURNING id INTO vid;
  RETURN vid;
END $$;
REVOKE ALL ON FUNCTION public.register_school_record_version(text,uuid,text,text,text,text,boolean,date,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_school_record_version(text,uuid,text,text,text,text,boolean,date,text,text,text,text) TO authenticated;