-- B4.8.1 — corrige a checagem do papel opcional: attribute_value_homologated exige a data (início da vigência).
CREATE OR REPLACE FUNCTION public.record_teaching_assignment_version(_class_id text, _assignment_id text, _expected_head_id uuid,
  _change_kind text, _valid_from date, _valid_until date, _engagement_id uuid, _matrix_version_id uuid, _item_key text,
  _role_scheme_id text, _role_value_id text, _role_value_version integer, _source_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _school text; g uuid; _aid text; _head uuid; _hver integer; _vid uuid; _mid text; _pt date; _e record;
BEGIN
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _class_id;
  g := public.teaching_assignment_grant(_school);
  IF _change_kind IS NULL OR _change_kind NOT IN ('constituicao','sucessao','retificacao') THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'assignment:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'assignment:invalid-window'; END IF;
  IF _change_kind <> 'constituicao' AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'assignment:reason-required'; END IF;
  IF _engagement_id IS NULL OR _matrix_version_id IS NULL OR coalesce(_item_key,'') = '' THEN RAISE EXCEPTION 'assignment:target-required'; END IF;
  IF _role_value_id IS NOT NULL AND NOT public.attribute_value_homologated(_role_scheme_id, _role_value_id, _role_value_version, _valid_from) THEN
    RAISE EXCEPTION 'assignment:role-not-homologated'; END IF;

  SELECT * INTO _e FROM public.institutional_engagements e WHERE e.id = _engagement_id;
  IF _e.id IS NULL OR _e.school_id IS DISTINCT FROM _school THEN RAISE EXCEPTION 'assignment:engagement-outside-school'; END IF;
  IF _e.valid_from > _valid_from OR (_e.valid_until IS NOT NULL AND (_valid_until IS NULL OR _e.valid_until < _valid_until))
     OR EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = _e.id AND (_valid_until IS NULL OR x.ended_on < _valid_until))
  THEN RAISE EXCEPTION 'assignment:engagement-not-valid-throughout'; END IF;

  SELECT v.matrix_id INTO _mid FROM public.curricular_matrix_versions v WHERE v.id = _matrix_version_id;
  IF _mid IS NULL OR NOT EXISTS (SELECT 1 FROM public.curricular_matrix_items i WHERE i.matrix_version_id = _matrix_version_id AND i.item_key = _item_key)
  THEN RAISE EXCEPTION 'assignment:element-not-in-matrix'; END IF;
  FOR _pt IN SELECT _valid_from UNION SELECT _valid_until WHERE _valid_until IS NOT NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM public.class_curricular_matrices_at(_school, _class_id, _pt, now()) m
                   WHERE m.result_kind IN ('matrix','specific-link') AND m.matrix_version_id = _matrix_version_id)
    THEN RAISE EXCEPTION 'assignment:matrix-not-applicable'; END IF;
  END LOOP;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('assignment:' || _class_id, 0));
  IF _assignment_id IS NULL THEN
    IF _change_kind <> 'constituicao' OR _expected_head_id IS NOT NULL THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.teaching_assignments a WHERE a.id = _assignment_id AND a.class_id = _class_id)
    THEN RAISE EXCEPTION 'assignment:not-found'; END IF;
    SELECT v.id, v.version INTO _head, _hver FROM public.teaching_assignment_versions v WHERE v.assignment_id = _assignment_id ORDER BY v.version DESC LIMIT 1;
    IF _expected_head_id IS DISTINCT FROM _head THEN RAISE EXCEPTION 'assignment:stale-head'; END IF;
    IF _change_kind = 'constituicao' THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
    IF _change_kind = 'sucessao' AND _valid_from <= (SELECT valid_from FROM public.teaching_assignment_versions WHERE id = _head)
    THEN RAISE EXCEPTION 'assignment:succession-must-start-later'; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.teaching_assignment_effective_versions(now()) w
             JOIN public.teaching_assignment_versions v ON v.id = w.version_id
             JOIN public.teaching_assignments a ON a.id = v.assignment_id AND a.class_id = _class_id
             WHERE v.assignment_id IS DISTINCT FROM _assignment_id AND v.engagement_id = _engagement_id
               AND v.matrix_version_id = _matrix_version_id AND v.item_key = _item_key
               AND w.effective_from <= coalesce(_valid_until, 'infinity'::date)
               AND coalesce(w.effective_until, 'infinity'::date) >= _valid_from)
  THEN RAISE EXCEPTION 'assignment:overlap'; END IF;

  IF _assignment_id IS NULL THEN
    _aid := 'ta-' || gen_random_uuid()::text;
    INSERT INTO public.teaching_assignments(id, class_id) VALUES (_aid, _class_id);
  ELSE _aid := _assignment_id; END IF;
  INSERT INTO public.teaching_assignment_versions(assignment_id, version, supersedes_id, change_kind, valid_from, valid_until,
      engagement_id, matrix_id, matrix_version_id, item_key, role_scheme_id, role_value_id, role_value_version,
      source_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES (_aid, coalesce(_hver,0)+1, _head, _change_kind, _valid_from, _valid_until, _engagement_id, _mid, _matrix_version_id,
      _item_key, _role_scheme_id, _role_value_id, _role_value_version, nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id(), g)
    RETURNING id INTO _vid;
  RETURN pg_catalog.jsonb_build_object('assignment_id', _aid, 'version_id', _vid, 'version', coalesce(_hver,0)+1);
END $fn$;