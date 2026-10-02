CREATE TABLE public.attribute_value_definitions (
  scheme_id text NOT NULL,
  value_id text NOT NULL,
  version integer NOT NULL,
  label text NOT NULL,
  status text NOT NULL CHECK (status IN ('rascunho','homologada')),
  homologation_act_ref text,
  valid_from date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scheme_id, value_id, version)
);
CREATE TABLE public.student_identity_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  version integer NOT NULL,
  supersedes_id uuid UNIQUE REFERENCES public.student_identity_versions(id),
  birth_date date,
  sex_scheme_id text NOT NULL DEFAULT 'sexo-administrativo' CHECK (sex_scheme_id = 'sexo-administrativo'),
  sex_value_id text,
  sex_value_version integer,
  correction_reason text,
  originating_act_ref text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, version),
  FOREIGN KEY (sex_scheme_id, sex_value_id, sex_value_version) REFERENCES public.attribute_value_definitions(scheme_id, value_id, version)
);
CREATE TABLE public.class_shift_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  logical_id text NOT NULL,
  version integer NOT NULL,
  supersedes_id uuid UNIQUE REFERENCES public.class_shift_versions(id),
  shift_scheme_id text NOT NULL DEFAULT 'turno' CHECK (shift_scheme_id = 'turno'),
  shift_value_id text NOT NULL,
  shift_value_version integer NOT NULL,
  valid_from date,
  valid_until date,
  correction_reason text,
  originating_act_ref text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from),
  FOREIGN KEY (shift_scheme_id, shift_value_id, shift_value_version) REFERENCES public.attribute_value_definitions(scheme_id, value_id, version)
);

GRANT SELECT ON public.attribute_value_definitions, public.student_identity_versions, public.class_shift_versions TO authenticated;
GRANT ALL ON public.attribute_value_definitions, public.student_identity_versions, public.class_shift_versions TO service_role;

ALTER TABLE public.attribute_value_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_identity_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_shift_versions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER immutable_attribute_values BEFORE UPDATE OR DELETE ON public.attribute_value_definitions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER immutable_identity_versions BEFORE UPDATE OR DELETE ON public.student_identity_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER immutable_shift_versions BEFORE UPDATE OR DELETE ON public.class_shift_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE POLICY "attribute values readable" ON public.attribute_value_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "identity by enrollment school capability" ON public.student_identity_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = student_identity_versions.student_id
    AND public.has_school_capability('consultar-identidade-cadastral-do-estudante', e.school_id)));
CREATE POLICY "shift by class school capability" ON public.class_shift_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = class_id
    AND (public.can_read_institutional_class(c.id, c.school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id))));

CREATE OR REPLACE FUNCTION public.attribute_value_homologated(_scheme text, _value text, _version integer, _on date) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM attribute_value_definitions d WHERE d.scheme_id = _scheme AND d.value_id = _value AND d.version = _version
    AND d.status = 'homologada' AND (d.valid_from IS NULL OR _on IS NULL OR d.valid_from <= _on))
$$;

CREATE OR REPLACE FUNCTION public.record_student_identity_version(_student text, _base_version_id uuid, _birth_date date,
  _sex_value text, _sex_version integer, _correction_reason text, _act_ref text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _v integer; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM school_enrollments e WHERE e.student_id = _student
      AND public.has_school_capability('manter-identidade-cadastral-do-estudante', e.school_id)) THEN
    RAISE EXCEPTION 'Capacidade manter-identidade-cadastral-do-estudante ausente em escola do estudante'; END IF;
  IF (_sex_value IS NULL) <> (_sex_version IS NULL) THEN RAISE EXCEPTION 'Valor de sexo exige versão do catálogo'; END IF;
  IF _sex_value IS NOT NULL AND NOT public.attribute_value_homologated('sexo-administrativo', _sex_value, _sex_version, current_date) THEN
    RAISE EXCEPTION 'Valor de sexo administrativo não homologado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('identity:' || _student));
  IF _base_version_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM student_identity_versions WHERE student_id = _student) THEN RAISE EXCEPTION 'Já existe versão; informe a base'; END IF;
    _v := 1;
  ELSE
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'Correção exige motivo'; END IF;
    SELECT version + 1 INTO _v FROM student_identity_versions WHERE id = _base_version_id AND student_id = _student;
    IF _v IS NULL THEN RAISE EXCEPTION 'Versão base inexistente para este estudante'; END IF;
    IF EXISTS (SELECT 1 FROM student_identity_versions WHERE supersedes_id = _base_version_id) THEN RAISE EXCEPTION 'Versão base já substituída'; END IF;
  END IF;
  INSERT INTO student_identity_versions(student_id, version, supersedes_id, birth_date, sex_value_id, sex_value_version, correction_reason, originating_act_ref, recorded_by)
  VALUES (_student, _v, _base_version_id, _birth_date, _sex_value, _sex_version, _correction_reason, _act_ref, auth.uid()) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_class_shift_version(_logical text, _base_version_id uuid, _class text, _shift_value text,
  _shift_version integer, _valid_from date, _valid_until date, _correction_reason text, _act_ref text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school text; _v integer; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT school_id INTO _school FROM institutional_classes WHERE id = _class;
  IF _school IS NULL THEN RAISE EXCEPTION 'Turma inexistente'; END IF;
  IF NOT public.has_school_capability('manter-turno-da-turma', _school) THEN RAISE EXCEPTION 'Capacidade manter-turno-da-turma ausente na escola'; END IF;
  IF NOT public.attribute_value_homologated('turno', _shift_value, _shift_version, _valid_from) THEN RAISE EXCEPTION 'Turno não homologado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('shift:' || _logical));
  IF _base_version_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM class_shift_versions WHERE logical_id = _logical) THEN RAISE EXCEPTION 'Registro lógico já existe; informe a base'; END IF;
    _v := 1;
  ELSE
    IF coalesce(btrim(_correction_reason), '') = '' THEN RAISE EXCEPTION 'Correção exige motivo'; END IF;
    SELECT version + 1 INTO _v FROM class_shift_versions WHERE id = _base_version_id AND logical_id = _logical AND class_id = _class;
    IF _v IS NULL THEN RAISE EXCEPTION 'Versão base inexistente'; END IF;
    IF EXISTS (SELECT 1 FROM class_shift_versions WHERE supersedes_id = _base_version_id) THEN RAISE EXCEPTION 'Versão base já substituída'; END IF;
  END IF;
  IF _valid_from IS NOT NULL AND EXISTS (
    SELECT 1 FROM class_shift_versions s WHERE s.class_id = _class AND s.logical_id <> _logical AND s.valid_from IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM class_shift_versions n WHERE n.supersedes_id = s.id)
      AND daterange(s.valid_from, s.valid_until, '[]') && daterange(_valid_from, _valid_until, '[]')) THEN
    RAISE EXCEPTION 'Vigência de turno sobreposta na mesma turma'; END IF;
  INSERT INTO class_shift_versions(class_id, logical_id, version, supersedes_id, shift_value_id, shift_value_version, valid_from, valid_until, correction_reason, originating_act_ref, recorded_by)
  VALUES (_class, _logical, _v, _base_version_id, _shift_value, _shift_version, _valid_from, _valid_until, _correction_reason, _act_ref, auth.uid()) RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.record_student_identity_version(text,uuid,date,text,integer,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_class_shift_version(text,uuid,text,text,integer,date,date,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_student_identity_version(text,uuid,date,text,integer,text,text),
  public.record_class_shift_version(text,uuid,text,text,integer,date,date,text,text) TO authenticated;