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
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.locate_student_for_enrollment(_kind text, _value text)
RETURNS TABLE(student_id text, display_name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(current_date) c WHERE c.capability_id = 'localizar-estudante-para-matricula' AND c.scope_level IN ('escola','rede')) THEN
    RAISE EXCEPTION 'capability:localizar-estudante-para-matricula'; END IF;
  IF coalesce(btrim(_value),'') = '' THEN RETURN; END IF;
  RETURN QUERY SELECT s.id, coalesce((SELECT v.civil_name FROM student_identity_versions v WHERE v.student_id = s.id ORDER BY v.version DESC LIMIT 1), s.display_name)
    FROM student_official_identifiers i JOIN institutional_students s ON s.id = i.student_id
    WHERE i.identifier_kind_id = _kind AND i.value = btrim(_value);
END $$;