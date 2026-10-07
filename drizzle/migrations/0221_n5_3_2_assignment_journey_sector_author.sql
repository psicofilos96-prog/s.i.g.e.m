-- N5.3.2 — autoria setorial (principal da Secretaria) na atribuição docente e na jornada da turma.
-- O SUJEITO da atribuição continua exigindo atuação + vínculo funcional + lotação reais (teaching_staff_fit);
-- só o AUTOR do registro passa a aceitar o principal institucional autorizado, sem pessoa fabricada.

ALTER TABLE public.teaching_assignment_versions ADD COLUMN recorded_by_principal_id uuid REFERENCES public.institutional_sector_principals(id);
ALTER TABLE public.teaching_assignment_versions ALTER COLUMN recorded_via_engagement_id DROP NOT NULL;
ALTER TABLE public.teaching_assignment_versions ADD CONSTRAINT teaching_assignment_versions_author_xor CHECK (
  (recorded_by_principal_id IS NULL AND recorded_via_engagement_id IS NOT NULL)
  OR (recorded_by_principal_id IS NOT NULL AND recorded_via_engagement_id IS NULL AND recorded_by_person_id IS NULL));
COMMENT ON COLUMN public.teaching_assignment_versions.recorded_by_principal_id IS 'N5.3.2: autor institucional (principal setorial); exclusivo com pessoa/atuação autora.';

ALTER TABLE public.class_journey_versions ADD COLUMN recorded_by_principal_id uuid REFERENCES public.institutional_sector_principals(id);
ALTER TABLE public.class_journey_versions ADD CONSTRAINT class_journey_versions_author_xor CHECK (
  recorded_by_principal_id IS NULL OR recorded_by_person_id IS NULL);

-- Principal setorial da Secretaria da própria escola com a capability da estação, hoje.
CREATE OR REPLACE FUNCTION public.class_time_sector_principal(_capability text, _school text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT g.principal_id FROM public.sector_station_grants(current_date) g
  JOIN public.institutional_sector_principals p ON p.id = g.principal_id
  WHERE _capability IN ('manter-jornada-da-turma','manter-atribuicao-docente')
    AND g.capability_id = _capability AND g.principal_id IS NOT NULL
    AND g.scope_level = 'escola' AND g.school_id = _school AND p.station_code = 'secretaria_escolar'
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.class_time_sector_principal(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_teaching_assignment_version_v2(_class_id text, _assignment_id text, _expected_head_id uuid,
  _change_kind text, _valid_from date, _valid_until date, _engagement_id uuid, _functional_link_logical_id uuid,
  _matrix_version_id uuid, _item_key text, _role_scheme_id text, _role_value_id text, _role_value_version integer,
  _source_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _school text; g uuid; _pr uuid; _aid text; _head uuid; _hver integer; _vid uuid; _mid text; _post uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  _school := public.class_time_writable_target(_class_id, _valid_from, _valid_until, 'assignment');
  IF public.current_principal_id() IS NOT NULL THEN
    _pr := public.class_time_sector_principal('manter-atribuicao-docente', _school);
    IF _pr IS NULL THEN RAISE EXCEPTION 'capability:manter-atribuicao-docente'; END IF;
  ELSE
    g := public.class_time_capability_grant('manter-atribuicao-docente', _school, _valid_from);
  END IF;
  IF _change_kind IS NULL OR _change_kind NOT IN ('constituicao','sucessao','retificacao') THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
  IF _change_kind <> 'constituicao' AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'assignment:reason-required'; END IF;
  IF _engagement_id IS NULL OR _matrix_version_id IS NULL OR coalesce(_item_key,'') = '' THEN RAISE EXCEPTION 'assignment:target-required'; END IF;
  IF _role_value_id IS NOT NULL AND NOT public.attribute_value_homologated(_role_scheme_id, _role_value_id, _role_value_version, _valid_from) THEN
    RAISE EXCEPTION 'assignment:role-not-homologated'; END IF;
  -- Sujeito: pessoa natural real, atuação vigente, vínculo funcional da pessoa e lotação na escola em toda a janela.
  IF NOT EXISTS (SELECT 1 FROM public.institutional_engagements e JOIN public.institutional_persons p ON p.id = e.person_id
                 WHERE e.id = _engagement_id AND p.actor_nature = 'pessoa-natural') THEN RAISE EXCEPTION 'assignment:engagement-not-natural-person'; END IF;
  _post := public.teaching_staff_fit('assignment', _engagement_id, _school, _functional_link_logical_id, _valid_from, _valid_until);
  SELECT v.matrix_id INTO _mid FROM public.curricular_matrix_versions v WHERE v.id = _matrix_version_id;
  IF _mid IS NULL OR NOT EXISTS (SELECT 1 FROM public.curricular_matrix_items i WHERE i.matrix_version_id = _matrix_version_id AND i.item_key = _item_key)
  THEN RAISE EXCEPTION 'assignment:element-not-in-matrix'; END IF;
  IF NOT public.offer_matrix_applicable_throughout(_school, _class_id, _matrix_version_id, _valid_from, _valid_until)
  THEN RAISE EXCEPTION 'assignment:matrix-not-applicable'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('assignment:' || _class_id, 0));
  IF _assignment_id IS NULL THEN
    IF _change_kind <> 'constituicao' OR _expected_head_id IS NOT NULL THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.teaching_assignments a WHERE a.id = _assignment_id AND a.class_id = _class_id)
    THEN RAISE EXCEPTION 'assignment:not-found'; END IF;
    SELECT v.id, v.version INTO _head, _hver FROM public.teaching_assignment_versions v WHERE v.assignment_id = _assignment_id ORDER BY v.version DESC LIMIT 1;
    IF _expected_head_id IS DISTINCT FROM _head THEN RAISE EXCEPTION 'assignment:stale-head'; END IF;
    IF _change_kind = 'constituicao' THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
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
      source_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id, recorded_by_principal_id,
      functional_link_logical_id, posting_logical_id)
    VALUES (_aid, coalesce(_hver,0)+1, _head, _change_kind, _valid_from, _valid_until, _engagement_id, _mid, _matrix_version_id,
      _item_key, _role_scheme_id, _role_value_id, _role_value_version, nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(),
      CASE WHEN _pr IS NULL THEN public.current_person_id() END, g, _pr,
      _functional_link_logical_id, _post)
    RETURNING id INTO _vid;
  RETURN pg_catalog.jsonb_build_object('assignment_id', _aid, 'version_id', _vid, 'version', coalesce(_hver,0)+1,
    'actor_kind', CASE WHEN _pr IS NULL THEN 'human' ELSE 'institutional' END);
END $fn$;
REVOKE ALL ON FUNCTION public.record_teaching_assignment_version_v2(text, text, uuid, text, date, date, uuid, uuid, uuid, text, text, text, integer, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_teaching_assignment_version_v2(text, text, uuid, text, date, date, uuid, uuid, uuid, text, text, text, integer, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_class_journey_version(_class_id text, _expected_head_id uuid, _change_kind text,
  _valid_from date, _valid_until date, _source_ref text, _reason text, _intervals jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _school text; g uuid; _pr uuid; _jid text; _head uuid; _hver integer; _vid uuid; _n integer; i jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  _school := public.class_time_writable_target(_class_id, _valid_from, _valid_until, 'journey');
  IF public.current_principal_id() IS NOT NULL THEN
    _pr := public.class_time_sector_principal('manter-jornada-da-turma', _school);
    IF _pr IS NULL THEN RAISE EXCEPTION 'capability:manter-jornada-da-turma'; END IF;
  ELSE
    g := public.class_time_capability_grant('manter-jornada-da-turma', _school, _valid_from);
  END IF;
  IF _change_kind IS NULL OR _change_kind NOT IN ('constituicao','sucessao','retificacao') THEN RAISE EXCEPTION 'journey:invalid-change-kind'; END IF;
  IF _change_kind <> 'constituicao' AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'journey:reason-required'; END IF;
  IF _intervals IS NULL OR pg_catalog.jsonb_typeof(_intervals) <> 'array' OR pg_catalog.jsonb_array_length(_intervals) = 0 THEN
    RAISE EXCEPTION 'journey:intervals-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('journey:' || _class_id, 0));
  SELECT j.id INTO _jid FROM public.class_journeys j WHERE j.class_id = _class_id;
  IF _jid IS NOT NULL THEN
    SELECT v.id, v.version INTO _head, _hver FROM public.class_journey_versions v WHERE v.journey_id = _jid ORDER BY v.version DESC LIMIT 1;
  END IF;
  IF _expected_head_id IS DISTINCT FROM _head THEN RAISE EXCEPTION 'journey:stale-head'; END IF;
  IF (_head IS NULL) <> (_change_kind = 'constituicao') THEN RAISE EXCEPTION 'journey:invalid-change-kind'; END IF;
  IF _jid IS NULL THEN
    _jid := 'cj-' || gen_random_uuid()::text;
    INSERT INTO public.class_journeys(id, class_id) VALUES (_jid, _class_id);
  END IF;
  INSERT INTO public.class_journey_versions(journey_id, version, supersedes_id, change_kind, valid_from, valid_until,
      originating_act_ref, change_reason, recorded_by, recorded_by_person_id, recorded_by_principal_id)
    VALUES (_jid, coalesce(_hver,0)+1, _head, _change_kind, _valid_from, _valid_until,
      coalesce(nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''), 'decisao-interna-sem-documento-fonte'),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(),
      CASE WHEN _pr IS NULL THEN public.current_person_id() END, _pr)
    RETURNING id INTO _vid;
  _n := 0;
  FOR i IN SELECT * FROM pg_catalog.jsonb_array_elements(_intervals) LOOP
    IF NOT (i ? 'weekday' AND i ? 'starts_at' AND i ? 'ends_at') THEN RAISE EXCEPTION 'journey:invalid-interval'; END IF;
    INSERT INTO public.class_journey_intervals(version_id, weekday, starts_at, ends_at)
      VALUES (_vid, (i->>'weekday')::smallint, (i->>'starts_at')::time, (i->>'ends_at')::time);
    _n := _n + 1;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('journey_id', _jid, 'version_id', _vid, 'version', coalesce(_hver,0)+1,
    'intervals', _n, 'engagement_id', g, 'actor_kind', CASE WHEN _pr IS NULL THEN 'human' ELSE 'institutional' END);
END $fn$;
REVOKE ALL ON FUNCTION public.record_class_journey_version(text, uuid, text, date, date, text, text, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_class_journey_version(text, uuid, text, date, date, text, text, jsonb) TO authenticated;

-- Profissionais elegíveis: pessoa natural, atuação vigente na escola, vínculo funcional vigente e lotação na escola na data.
CREATE OR REPLACE FUNCTION public.secretariat_teaching_candidates(_school text, _on date)
RETURNS TABLE(engagement_id uuid, person_name text, functional_link_logical_id uuid, functional_registration text, position_label text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'assignment:target-required'; END IF;
  IF NOT public.has_school_capability('manter-atribuicao-docente', _school) THEN RAISE EXCEPTION 'capability:manter-atribuicao-docente'; END IF;
  RETURN QUERY
  SELECT e.id, p.display_name, l.logical_id, l.functional_registration, e.position_label_snapshot
  FROM public.institutional_engagements e
  JOIN public.institutional_persons p ON p.id = e.person_id AND p.actor_nature = 'pessoa-natural'
  JOIN LATERAL (SELECT DISTINCT ON (x.logical_id) x.* FROM public.professional_functional_links x
                WHERE x.person_id = e.person_id ORDER BY x.logical_id, x.version DESC) l
    ON l.valid_from <= _on AND (l.valid_until IS NULL OR l.valid_until >= _on)
  WHERE e.school_id = _school AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.ended_on <= _on)
    AND EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (pp.logical_id) pp.* FROM public.professional_postings pp
                               WHERE pp.functional_link_logical_id = l.logical_id ORDER BY pp.logical_id, pp.version DESC) q
                WHERE q.school_id = _school AND q.valid_from <= _on AND (q.valid_until IS NULL OR q.valid_until >= _on))
  ORDER BY p.display_name, l.functional_registration;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_teaching_candidates(text, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_teaching_candidates(text, date) TO authenticated;

-- Elementos da matriz aplicável à turma na data (sem matriz ⇒ vazio, nunca elemento inventado).
CREATE OR REPLACE FUNCTION public.secretariat_assignment_elements(_class text, _on date)
RETURNS TABLE(matrix_version_id uuid, item_key text, label text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _school text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _class;
  IF _school IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'assignment:class-not-found'; END IF;
  IF NOT public.has_school_capability('manter-atribuicao-docente', _school) THEN RAISE EXCEPTION 'capability:manter-atribuicao-docente'; END IF;
  RETURN QUERY
  SELECT i.matrix_version_id, i.item_key, i.component_label_snapshot
  FROM public.curricular_matrix_items i
  WHERE public.offer_matrix_applicable_throughout(_school, _class, i.matrix_version_id, _on, _on)
  ORDER BY i.position NULLS LAST, i.item_key;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_assignment_elements(text, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_assignment_elements(text, date) TO authenticated;