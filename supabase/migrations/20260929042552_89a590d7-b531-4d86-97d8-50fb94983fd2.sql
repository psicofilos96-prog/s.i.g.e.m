CREATE TABLE public.class_offering_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  logical_id text NOT NULL,
  version integer NOT NULL,
  supersedes_id uuid UNIQUE REFERENCES public.class_offering_versions(id),
  valid_from date,
  valid_until date,
  correction_reason text,
  originating_act_ref text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);
CREATE TABLE public.class_offering_axis_values (
  offering_version_id uuid NOT NULL REFERENCES public.class_offering_versions(id),
  scheme_id text NOT NULL,
  value_id text NOT NULL,
  value_version integer NOT NULL,
  PRIMARY KEY (offering_version_id, scheme_id),
  FOREIGN KEY (scheme_id, value_id, value_version) REFERENCES public.attribute_value_definitions(scheme_id, value_id, version)
);
GRANT SELECT ON public.class_offering_versions, public.class_offering_axis_values TO authenticated;
GRANT ALL ON public.class_offering_versions, public.class_offering_axis_values TO service_role;
ALTER TABLE public.class_offering_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_offering_axis_values ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_offering_versions BEFORE UPDATE OR DELETE ON public.class_offering_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER immutable_offering_axis_values BEFORE UPDATE OR DELETE ON public.class_offering_axis_values FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE POLICY "offering by class read" ON public.class_offering_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = class_id
    AND (public.can_read_institutional_class(c.id, c.school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id))));
CREATE POLICY "offering axis by version read" ON public.class_offering_axis_values FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_offering_versions v JOIN public.institutional_classes c ON c.id = v.class_id
    WHERE v.id = offering_version_id
    AND (public.can_read_institutional_class(c.id, c.school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id))));

CREATE OR REPLACE FUNCTION public.record_class_offering_version(_logical text, _base_version_id uuid, _class text, _axes jsonb,
  _valid_from date, _valid_until date, _correction_reason text, _act_ref text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school text; _v integer; _id uuid; _a jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT school_id INTO _school FROM institutional_classes WHERE id = _class;
  IF _school IS NULL THEN RAISE EXCEPTION 'Turma inexistente'; END IF;
  IF NOT public.has_school_capability('manter-organizacao-da-oferta-da-turma', _school) THEN
    RAISE EXCEPTION 'Capacidade manter-organizacao-da-oferta-da-turma ausente na escola'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'Organização da oferta exige início de vigência'; END IF;
  IF jsonb_typeof(_axes) <> 'array' OR jsonb_array_length(_axes) = 0 THEN RAISE EXCEPTION 'Informe ao menos um eixo classificado'; END IF;
  FOR _a IN SELECT * FROM jsonb_array_elements(_axes) LOOP
    IF NOT public.attribute_value_homologated(_a->>'scheme', _a->>'value', (_a->>'version')::int, _valid_from) THEN
      RAISE EXCEPTION 'Valor % do eixo % não homologado', _a->>'value', _a->>'scheme'; END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtext('offering:' || _class));
  IF _base_version_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM class_offering_versions WHERE logical_id = _logical) THEN RAISE EXCEPTION 'Registro lógico já existe; informe a base'; END IF;
    _v := 1;
  ELSE
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'Correção exige motivo'; END IF;
    SELECT version + 1 INTO _v FROM class_offering_versions WHERE id = _base_version_id AND logical_id = _logical AND class_id = _class;
    IF _v IS NULL THEN RAISE EXCEPTION 'Versão base inexistente'; END IF;
    IF EXISTS (SELECT 1 FROM class_offering_versions WHERE supersedes_id = _base_version_id) THEN RAISE EXCEPTION 'Versão base já substituída'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM class_offering_versions s WHERE s.class_id = _class AND s.logical_id <> _logical AND s.valid_from IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM class_offering_versions n WHERE n.supersedes_id = s.id)
      AND daterange(s.valid_from, s.valid_until, '[]') && daterange(_valid_from, _valid_until, '[]')) THEN
    RAISE EXCEPTION 'Vigência de organização da oferta sobreposta na mesma turma'; END IF;
  INSERT INTO class_offering_versions(class_id, logical_id, version, supersedes_id, valid_from, valid_until, correction_reason, originating_act_ref, recorded_by)
  VALUES (_class, _logical, _v, _base_version_id, _valid_from, _valid_until, _correction_reason, _act_ref, auth.uid()) RETURNING id INTO _id;
  INSERT INTO class_offering_axis_values(offering_version_id, scheme_id, value_id, value_version)
  SELECT _id, a->>'scheme', a->>'value', (a->>'version')::int FROM jsonb_array_elements(_axes) a;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_class_offering_version(text,uuid,text,jsonb,date,date,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_class_offering_version(text,uuid,text,jsonb,date,date,text,text) TO authenticated;