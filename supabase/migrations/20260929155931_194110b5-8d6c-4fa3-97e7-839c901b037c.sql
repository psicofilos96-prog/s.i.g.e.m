ALTER TABLE public.student_identity_versions ADD COLUMN civil_name text, ADD COLUMN social_name text;

CREATE TABLE public.student_official_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  identifier_kind_id text NOT NULL,
  identifier_kind_version integer NOT NULL,
  value text NOT NULL,
  originating_act_ref text,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  recorded_via_engagement_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identifier_kind_id, value),
  UNIQUE (student_id, identifier_kind_id)
);
GRANT SELECT ON public.student_official_identifiers TO authenticated;
GRANT ALL ON public.student_official_identifiers TO service_role;
ALTER TABLE public.student_official_identifiers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER student_official_identifiers_immutable BEFORE UPDATE OR DELETE ON public.student_official_identifiers FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

ALTER TABLE public.student_identity_versions ADD COLUMN recorded_by_person_id uuid, ADD COLUMN recorded_via_engagement_id uuid;

CREATE POLICY "identifiers by network or enrollment" ON public.student_official_identifiers FOR SELECT TO authenticated
USING (public.has_network_capability('consultar-identidade-cadastral-do-estudante') OR EXISTS (SELECT 1 FROM school_enrollments e WHERE e.student_id = student_official_identifiers.student_id AND public.has_school_capability('consultar-identidade-cadastral-do-estudante', e.school_id)));
CREATE POLICY "identity by network capability" ON public.student_identity_versions FOR SELECT TO authenticated
USING (public.has_network_capability('consultar-identidade-cadastral-do-estudante'));
CREATE POLICY "students by network capability" ON public.institutional_students FOR SELECT TO authenticated
USING (public.has_network_capability('consultar-identidade-cadastral-do-estudante'));

DROP FUNCTION IF EXISTS public.record_student_identity_version(text, uuid, date, text, integer, text, text);

CREATE OR REPLACE FUNCTION public.student_identity_authority(_student text, _cap text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.engagement_id FROM public.effective_scope_capabilities(current_date) c
  WHERE c.capability_id = _cap AND (c.scope_level = 'rede' OR (_student IS NOT NULL AND c.scope_level = 'escola'
    AND EXISTS (SELECT 1 FROM school_enrollments e WHERE e.student_id = _student AND e.school_id = c.school_id)))
  ORDER BY (c.scope_level = 'rede') DESC LIMIT 1
$$;

-- Cadastro: só alcance de rede; nunca cria matrícula, enturmação ou vínculo com escola.
CREATE OR REPLACE FUNCTION public.register_student(_civil_name text, _social_name text, _birth_date date, _sex_value text, _sex_version integer, _identifiers jsonb, _act_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g uuid; _sid text; _r jsonb; _n text := nullif(btrim(coalesce(_civil_name,'')),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(current_date) c WHERE c.capability_id = 'cadastrar-estudante-na-rede' AND c.scope_level = 'rede' LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:cadastrar-estudante-na-rede'; END IF;
  IF _n IS NULL THEN RAISE EXCEPTION 'student:name-required'; END IF;
  IF coalesce(btrim(_act_ref),'') = '' THEN RAISE EXCEPTION 'student:act-required'; END IF;
  IF (_sex_value IS NULL) <> (_sex_version IS NULL) THEN RAISE EXCEPTION 'student:sex-version-required'; END IF;
  IF _sex_value IS NOT NULL AND NOT public.attribute_value_homologated('sexo-administrativo', _sex_value, _sex_version, current_date) THEN RAISE EXCEPTION 'student:catalog-not-homologated'; END IF;
  _sid := 'est-' || gen_random_uuid();
  INSERT INTO institutional_students(id, display_name) VALUES (_sid, _n);
  INSERT INTO student_identity_versions(student_id, version, civil_name, social_name, birth_date, sex_value_id, sex_value_version, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_sid, 1, _n, nullif(btrim(coalesce(_social_name,'')),''), _birth_date, _sex_value, _sex_version, _act_ref, auth.uid(), public.current_person_id(), g);
  FOR _r IN SELECT * FROM jsonb_array_elements(coalesce(_identifiers,'[]'::jsonb)) LOOP
    IF coalesce(btrim(_r->>'value'),'') = '' THEN CONTINUE; END IF;
    IF NOT public.attribute_value_homologated('identificador-oficial-do-estudante', _r->>'kind', (_r->>'version')::int, current_date) THEN RAISE EXCEPTION 'student:catalog-not-homologated'; END IF;
    IF EXISTS (SELECT 1 FROM student_official_identifiers WHERE identifier_kind_id = _r->>'kind' AND value = btrim(_r->>'value')) THEN RAISE EXCEPTION 'student:identifier-in-use'; END IF;
    INSERT INTO student_official_identifiers(student_id, identifier_kind_id, identifier_kind_version, value, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES (_sid, _r->>'kind', (_r->>'version')::int, btrim(_r->>'value'), _act_ref, auth.uid(), public.current_person_id(), g);
  END LOOP;
  RETURN _sid;
END $$;

-- Correção: nova versão encadeada; base superada ou sem alteração é recusada.
CREATE OR REPLACE FUNCTION public.record_student_identity_version(_student text, _base_version_id uuid, _civil_name text, _social_name text, _birth_date date, _sex_value text, _sex_version integer, _correction_reason text, _act_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g uuid; b record; _id uuid; _n text := nullif(btrim(coalesce(_civil_name,'')),''); _s text := nullif(btrim(coalesce(_social_name,'')),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  g := public.student_identity_authority(_student, 'manter-identidade-cadastral-do-estudante');
  IF g IS NULL THEN RAISE EXCEPTION 'capability:manter-identidade-cadastral-do-estudante'; END IF;
  IF _n IS NULL THEN RAISE EXCEPTION 'student:name-required'; END IF;
  IF coalesce(btrim(_correction_reason),'') = '' THEN RAISE EXCEPTION 'student:reason-required'; END IF;
  IF (_sex_value IS NULL) <> (_sex_version IS NULL) THEN RAISE EXCEPTION 'student:sex-version-required'; END IF;
  IF _sex_value IS NOT NULL AND NOT public.attribute_value_homologated('sexo-administrativo', _sex_value, _sex_version, current_date) THEN RAISE EXCEPTION 'student:catalog-not-homologated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('identity:' || _student));
  SELECT * INTO b FROM student_identity_versions WHERE id = _base_version_id AND student_id = _student;
  IF b.id IS NULL THEN RAISE EXCEPTION 'student:base-missing'; END IF;
  IF EXISTS (SELECT 1 FROM student_identity_versions WHERE supersedes_id = _base_version_id) THEN RAISE EXCEPTION 'student:base-superseded'; END IF;
  IF b.civil_name IS NOT DISTINCT FROM _n AND b.social_name IS NOT DISTINCT FROM _s AND b.birth_date IS NOT DISTINCT FROM _birth_date
     AND b.sex_value_id IS NOT DISTINCT FROM _sex_value AND b.sex_value_version IS NOT DISTINCT FROM _sex_version THEN RAISE EXCEPTION 'student:no-change'; END IF;
  INSERT INTO student_identity_versions(student_id, version, supersedes_id, civil_name, social_name, birth_date, sex_value_id, sex_value_version, correction_reason, originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
  VALUES (_student, b.version + 1, b.id, _n, _s, _birth_date, _sex_value, _sex_version, _correction_reason, _act_ref, auth.uid(), public.current_person_id(), g) RETURNING id INTO _id;
  UPDATE institutional_students SET display_name = _n WHERE id = _student;
  RETURN _id;
END $$;

-- Busca mínima para matrícula: identificador oficial exato; devolve só ID e nome.
CREATE OR REPLACE FUNCTION public.locate_student_for_enrollment(_kind text, _value text)
RETURNS TABLE(student_id text, display_name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(current_date) c WHERE c.capability_id = 'localizar-estudante-para-matricula' AND c.scope_level IN ('escola','rede')) THEN
    RAISE EXCEPTION 'capability:localizar-estudante-para-matricula'; END IF;
  IF coalesce(btrim(_value),'') = '' THEN RETURN; END IF;
  RETURN QUERY SELECT s.id, s.display_name FROM student_official_identifiers i JOIN institutional_students s ON s.id = i.student_id
    WHERE i.identifier_kind_id = _kind AND i.value = btrim(_value);
END $$;

REVOKE EXECUTE ON FUNCTION public.register_student(text,text,date,text,integer,jsonb,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_student_identity_version(text,uuid,text,text,date,text,integer,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.locate_student_for_enrollment(text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.student_identity_authority(text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.register_student(text,text,date,text,integer,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_identity_version(text,uuid,text,text,date,text,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.locate_student_for_enrollment(text,text) TO authenticated;

-- Política v2 em rascunho: cópia íntegra da v1 + 4 regras novas. v1 não é tocada.
DO $$ DECLARE v1 uuid; v2 uuid; BEGIN
  SELECT id INTO v1 FROM capability_policies WHERE logical_policy_id = 'politica-capacidades-diario' AND version = 1;
  INSERT INTO capability_policies(logical_policy_id, version, supersedes_version_id, status) VALUES ('politica-capacidades-diario', 2, v1, 'draft') RETURNING id INTO v2;
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions)
    SELECT v2, engagement_kind_id, capability_id, scope_dimensions FROM capability_policy_rules WHERE policy_id = v1;
  INSERT INTO capability_policy_rules(policy_id, engagement_kind_id, capability_id, scope_dimensions) VALUES
    (v2, 'cadastro-institucional-da-rede', 'consultar-identidade-cadastral-do-estudante', '{network}'),
    (v2, 'cadastro-institucional-da-rede', 'cadastrar-estudante-na-rede', '{network}'),
    (v2, 'cadastro-institucional-da-rede', 'manter-identidade-cadastral-do-estudante', '{network}'),
    (v2, 'secretaria-escolar', 'localizar-estudante-para-matricula', '{school}');
END $$;