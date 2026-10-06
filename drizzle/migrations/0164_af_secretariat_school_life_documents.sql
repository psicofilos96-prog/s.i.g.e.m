-- Frente AF — Secretaria Escolar / Vida Escolar / Documentos.
-- Aditiva. Consome school_enrollments (vínculo anual), class_enrollment_episodes (turma),
-- student_movement_events (movimentação). Nenhuma fonte paralela.

-- 0) Writers humanos legados não podem ser executados por automação.
REVOKE EXECUTE ON FUNCTION public.register_class_enrollment_episode(text, text, text, date, text, text, text) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.record_school_enrollment_ending(text, date, text, text, text) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.record_student_movement(text, uuid, text, text, text, integer, date, jsonb, jsonb, text, text, text, text) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.record_school_document_template_version(text, text, uuid, text, jsonb, jsonb, jsonb, text[], text, text) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.cancel_school_document_emission(uuid, text) FROM service_role;
-- v1 aceitava snapshot montado no navegador (forjável): aposentado.
REVOKE EXECUTE ON FUNCTION public.emit_school_document(uuid, text, text, jsonb, jsonb, uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.emit_school_document(uuid, text, text, jsonb, jsonb, uuid, uuid, text) IS 'DEPRECATED (AF): snapshot vinha do cliente; substituída por emit_school_document_v2 (fatos compostos no banco).';

-- 1) Auxiliares
CREATE FUNCTION public.af_natural_person() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  me := public.s_current_person();
  IF me IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = me AND p.actor_nature = 'pessoa-natural') THEN
    RAISE EXCEPTION 'secretariat:natural-person-required'; END IF;
  RETURN me;
END $fn$;
REVOKE ALL ON FUNCTION public.af_natural_person() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.af_enrollment_current(_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.school_enrollments n WHERE n.supersedes_id = _id) $$;
REVOKE ALL ON FUNCTION public.af_enrollment_current(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.af_episode_current(_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes n WHERE n.supersedes_id = _id) $$;
REVOKE ALL ON FUNCTION public.af_episode_current(text) FROM PUBLIC, anon, authenticated, service_role;

-- 2) Painel da Secretaria (só a própria escola; recusa uniforme)
CREATE FUNCTION public.secretariat_overview_at(_school text, _year text, _on date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE r jsonb; st record; yv record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL OR _year IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'secretariat:arguments-required'; END IF;
  IF NOT public.has_school_capability('consultar-matricula-e-movimentacao', _school) THEN RAISE EXCEPTION 'secretariat:not-authorized'; END IF;
  SELECT * INTO st FROM public.academic_year_operational_state_at(_year) LIMIT 1;
  SELECT v.official_name, v.starts_on, v.ends_on INTO yv FROM public.institutional_academic_year_versions v
   WHERE v.academic_year_id = _year ORDER BY v.version DESC LIMIT 1;
  WITH e AS (
    SELECT se.id, se.opened_on,
      (SELECT min(x.ended_on) FROM public.school_enrollment_endings x WHERE x.enrollment_id = se.id) AS ended_on
    FROM public.school_enrollments se
    WHERE se.school_id = _school AND se.academic_year_id = _year AND public.af_enrollment_current(se.id)
  ), ep AS (
    SELECT c.id, c.enrollment_id, c.class_id FROM public.class_enrollment_episodes c
    WHERE c.school_id = _school AND public.af_episode_current(c.id) AND c.valid_from <= _on
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings x WHERE x.episode_id = c.id AND x.ended_on < _on)
      AND EXISTS (SELECT 1 FROM e WHERE e.id = c.enrollment_id)
  ), mv AS (
    SELECT m.movement_type_id FROM public.student_movement_events m
    WHERE _school = ANY (m.school_scope_ids) AND NOT EXISTS (SELECT 1 FROM public.student_movement_events n WHERE n.supersedes_id = m.id)
      AND (yv.starts_on IS NULL OR m.effective_on BETWEEN yv.starts_on AND yv.ends_on)
  )
  SELECT jsonb_build_object(
    'status', 'ok', 'school_id', _school, 'year_id', _year, 'on', _on,
    'year', jsonb_build_object('label', yv.official_name, 'starts_on', yv.starts_on, 'ends_on', yv.ends_on, 'state', st.state, 'state_sequence', st.sequence),
    'enrollments', jsonb_build_object(
      'total', (SELECT count(*) FROM e),
      'active', (SELECT count(*) FROM e WHERE e.opened_on IS NOT NULL AND e.opened_on <= _on AND (e.ended_on IS NULL OR e.ended_on >= _on)),
      'not_started', (SELECT count(*) FROM e WHERE e.opened_on > _on),
      'start_unknown', (SELECT count(*) FROM e WHERE e.opened_on IS NULL AND e.ended_on IS NULL),
      'ended', (SELECT count(*) FROM e WHERE e.ended_on IS NOT NULL AND e.ended_on < _on)),
    'allocations', jsonb_build_object(
      'active_episodes', (SELECT count(*) FROM ep),
      'classes_with_students', (SELECT count(DISTINCT ep.class_id) FROM ep),
      'enrollments_without_class', (SELECT count(*) FROM e WHERE (e.ended_on IS NULL OR e.ended_on >= _on)
          AND NOT EXISTS (SELECT 1 FROM ep WHERE ep.enrollment_id = e.id))),
    'movements', coalesce((SELECT jsonb_object_agg(t, n) FROM (SELECT mv.movement_type_id t, count(*) n FROM mv GROUP BY 1) z), '{}'::jsonb),
    'transition_decisions', coalesce((SELECT jsonb_object_agg(d, n) FROM (
        SELECT y.decision d, count(*) n FROM public.year_transition_decisions y
        WHERE y.school_id = _school AND y.to_year_id = _year
          AND y.sequence = (SELECT max(y2.sequence) FROM public.year_transition_decisions y2 WHERE y2.school_id = y.school_id AND y2.student_id = y.student_id AND y2.to_year_id = y.to_year_id)
        GROUP BY 1) z), '{}'::jsonb)
  ) INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.secretariat_overview_at(text, text, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_overview_at(text, text, date) TO authenticated;

CREATE FUNCTION public.secretariat_pending_at(_school text, _year text, _on date)
RETURNS TABLE(student_id text, display_name text, enrollment_id text, issue text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT public.has_school_capability('consultar-matricula-e-movimentacao', _school) THEN RAISE EXCEPTION 'secretariat:not-authorized'; END IF;
  RETURN QUERY
  SELECT se.student_id, s.display_name, se.id,
    CASE WHEN se.opened_on IS NULL THEN 'inicio-efetivo-nao-declarado' ELSE 'sem-turma-vigente' END
  FROM public.school_enrollments se JOIN public.institutional_students s ON s.id = se.student_id
  WHERE se.school_id = _school AND se.academic_year_id = _year AND public.af_enrollment_current(se.id)
    AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = se.id AND x.ended_on < _on)
    AND (se.opened_on IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.class_enrollment_episodes c WHERE c.enrollment_id = se.id AND public.af_episode_current(c.id) AND c.valid_from <= _on
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = c.id AND y.ended_on < _on)))
  ORDER BY s.display_name, se.id LIMIT 500;
END $fn$;
REVOKE ALL ON FUNCTION public.secretariat_pending_at(text, text, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_pending_at(text, text, date) TO authenticated;

-- 3) Vida escolar: timeline administrativa canônica (projeção, nada gravado)
CREATE FUNCTION public.student_school_life(_school text, _student text)
RETURNS TABLE(kind text, ref_id text, occurred_on date, school_id text, label text, detail jsonb, recorded_at timestamptz, superseded boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL OR _student IS NULL OR NOT public.has_school_capability('consultar-matricula-e-movimentacao', _school)
     OR NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN
    RAISE EXCEPTION 'secretariat:not-found'; END IF;
  RETURN QUERY
  SELECT 'identidade'::text, s.id, NULL::date, NULL::text, s.display_name, jsonb_build_object('identificador', s.institutional_identifier), s.created_at, false
    FROM public.institutional_students s WHERE s.id = _student
  UNION ALL
  SELECT 'vinculo-anual', e.id, e.opened_on, e.school_id, e.academic_year_id,
    jsonb_build_object('numero', e.institutional_number, 'ano', e.academic_year_id, 'supersedes', e.supersedes_id, 'motivo_correcao', e.correction_reason), e.created_at,
    NOT public.af_enrollment_current(e.id)
    FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school
  UNION ALL
  SELECT 'encerramento-vinculo', x.enrollment_id, x.ended_on, e.school_id, x.bond_status_id,
    jsonb_build_object('motivo', x.reason_text, 'ato', x.originating_act_ref), x.created_at, false
    FROM public.school_enrollment_endings x JOIN public.school_enrollments e ON e.id = x.enrollment_id
   WHERE e.student_id = _student AND e.school_id = _school
  UNION ALL
  SELECT 'turma', c.id, c.valid_from, c.school_id, c.class_label_snapshot,
    jsonb_build_object('turma', c.class_id, 'vinculo', c.enrollment_id, 'supersedes', c.supersedes_id), c.created_at, NOT public.af_episode_current(c.id)
    FROM public.class_enrollment_episodes c WHERE c.student_id = _student AND c.school_id = _school
  UNION ALL
  SELECT 'saida-turma', y.episode_id, y.ended_on, c.school_id, y.reason_label, '{}'::jsonb, y.created_at, false
    FROM public.class_enrollment_episode_endings y JOIN public.class_enrollment_episodes c ON c.id = y.episode_id
   WHERE c.student_id = _student AND c.school_id = _school
  UNION ALL
  SELECT 'movimentacao', m.id::text, m.effective_on, _school, m.movement_type_id,
    jsonb_build_object('origem', m.origin->>'schoolId', 'destino', m.destination->>'schoolId', 'versao', m.version, 'tipo_versao', m.movement_type_version), m.created_at,
    EXISTS (SELECT 1 FROM public.student_movement_events n WHERE n.supersedes_id = m.id)
    FROM public.student_movement_events m WHERE m.student_id = _student AND _school = ANY (m.school_scope_ids)
  ORDER BY 3 NULLS FIRST, 7;
END $fn$;
REVOKE ALL ON FUNCTION public.student_school_life(text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.student_school_life(text, text) TO authenticated;

-- 4) Writers humanos da Secretaria
CREATE FUNCTION public.secretariat_allocate_to_class(_enrollment text, _class text, _valid_from date, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; e record; c record; yv record; nid text;
BEGIN
  me := public.af_natural_person();
  SELECT * INTO e FROM public.school_enrollments WHERE id = _enrollment;
  IF e.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', e.school_id) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  IF NOT public.af_enrollment_current(e.id) THEN RAISE EXCEPTION 'base-superseded'; END IF;
  IF NOT public.s_year_open_for_operation(e.academic_year_id) THEN RAISE EXCEPTION 'secretariat:year-not-open'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'secretariat:date-required'; END IF;
  IF e.opened_on IS NULL THEN RAISE EXCEPTION 'secretariat:enrollment-start-unknown'; END IF;
  IF _valid_from < e.opened_on THEN RAISE EXCEPTION 'secretariat:before-enrollment'; END IF;
  SELECT v.starts_on, v.ends_on INTO yv FROM public.institutional_academic_year_versions v WHERE v.academic_year_id = e.academic_year_id ORDER BY v.version DESC LIMIT 1;
  IF yv.starts_on IS NOT NULL AND (_valid_from < yv.starts_on OR _valid_from > yv.ends_on) THEN RAISE EXCEPTION 'secretariat:outside-year'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = e.id) THEN RAISE EXCEPTION 'secretariat:enrollment-ended'; END IF;
  SELECT * INTO c FROM public.institutional_classes WHERE id = _class;
  IF c.id IS NULL OR c.school_id <> e.school_id OR c.academic_year_id IS DISTINCT FROM e.academic_year_id THEN RAISE EXCEPTION 'secretariat:class-invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('af-alloc:' || e.id));
  IF EXISTS (SELECT 1 FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id AND public.af_episode_current(p.id)
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id)) THEN
    RAISE EXCEPTION 'secretariat:active-class-exists'; END IF;
  nid := 'enturm-' || gen_random_uuid();
  INSERT INTO public.class_enrollment_episodes(id, enrollment_id, student_id, school_id, class_id, class_label_snapshot, cycle_id, valid_from,
    originating_act_ref, recorded_by, logical_id)
  VALUES (nid, e.id, e.student_id, e.school_id, c.id, c.name, e.cycle_id, _valid_from, nullif(btrim(coalesce(_reason,'')), ''), auth.uid(), nid);
  RETURN nid;
END $fn$;
REVOKE ALL ON FUNCTION public.secretariat_allocate_to_class(text, text, date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_allocate_to_class(text, text, date, text) TO authenticated;

CREATE FUNCTION public.secretariat_end_class_episode(_episode text, _ended_on date, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; c record; e record;
BEGIN
  me := public.af_natural_person();
  SELECT * INTO c FROM public.class_enrollment_episodes WHERE id = _episode;
  IF c.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', c.school_id) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  SELECT * INTO e FROM public.school_enrollments WHERE id = c.enrollment_id;
  IF NOT public.s_year_open_for_operation(e.academic_year_id) THEN RAISE EXCEPTION 'secretariat:year-not-open'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'correction-reason-required'; END IF;
  IF _ended_on IS NULL OR _ended_on < c.valid_from THEN RAISE EXCEPTION 'secretariat:date-invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('af-alloc:' || c.enrollment_id));
  IF NOT public.af_episode_current(c.id) OR EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = c.id) THEN
    RAISE EXCEPTION 'base-superseded'; END IF;
  INSERT INTO public.class_enrollment_episode_endings(episode_id, ended_on, reason_label, originating_act_ref) VALUES (c.id, _ended_on, btrim(_reason), NULL);
  RETURN c.id;
END $fn$;
REVOKE ALL ON FUNCTION public.secretariat_end_class_episode(text, date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_end_class_episode(text, date, text) TO authenticated;

-- Saída/transferência: encerra a ORIGEM (vínculo + turma) e registra a movimentação com destino.
-- O destino é constituído pela secretaria de destino (enroll_student_in_school_year); a história nunca é movida.
CREATE FUNCTION public.secretariat_record_exit(_enrollment text, _effective_on date, _movement_type text, _type_version integer,
  _destination_school text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; e record; mid uuid; ep record;
BEGIN
  me := public.af_natural_person();
  SELECT * INTO e FROM public.school_enrollments WHERE id = _enrollment;
  IF e.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', e.school_id)
     OR NOT public.has_school_capability('registrar-movimentacao-escolar', e.school_id) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  IF NOT public.s_year_open_for_operation(e.academic_year_id) THEN RAISE EXCEPTION 'secretariat:year-not-open'; END IF;
  IF _effective_on IS NULL OR (e.opened_on IS NOT NULL AND _effective_on < e.opened_on) THEN RAISE EXCEPTION 'secretariat:date-invalid'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'correction-reason-required'; END IF;
  IF _destination_school IS NOT NULL AND (_destination_school = e.school_id OR NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _destination_school)) THEN
    RAISE EXCEPTION 'secretariat:destination-invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.movement_types_at(_effective_on, NULL) t WHERE t.id = _movement_type AND t.version = _type_version) THEN
    RAISE EXCEPTION 'movement:type-not-current'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('af-alloc:' || e.id));
  IF NOT public.af_enrollment_current(e.id) OR EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = e.id) THEN
    RAISE EXCEPTION 'base-superseded'; END IF;
  FOR ep IN SELECT p.id, p.valid_from FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id AND public.af_episode_current(p.id)
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id) LOOP
    IF _effective_on < ep.valid_from THEN RAISE EXCEPTION 'secretariat:date-invalid'; END IF;
    INSERT INTO public.class_enrollment_episode_endings(episode_id, ended_on, reason_label) VALUES (ep.id, _effective_on, _movement_type);
  END LOOP;
  INSERT INTO public.school_enrollment_endings(enrollment_id, ended_on, bond_status_id, reason_text, recorded_by)
  VALUES (e.id, _effective_on, _movement_type, btrim(_reason), auth.uid());
  INSERT INTO public.student_movement_events(logical_id, version, student_id, enrollment_id, movement_type_id, movement_type_version,
    effective_on, origin, destination, reason_text, recorded_by, school_scope_ids)
  VALUES ('mov-' || gen_random_uuid(), 1, e.student_id, e.id, _movement_type, _type_version, _effective_on,
    jsonb_build_object('schoolId', e.school_id, 'enrollmentId', e.id),
    CASE WHEN _destination_school IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('schoolId', _destination_school) END,
    btrim(_reason), auth.uid(), array_remove(ARRAY[e.school_id, _destination_school], NULL))
  RETURNING id INTO mid;
  RETURN mid;
END $fn$;
REVOKE ALL ON FUNCTION public.secretariat_record_exit(text, date, text, integer, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_record_exit(text, date, text, integer, text, text) TO authenticated;

-- 5) Documentos: fatos compostos NO BANCO, só de fontes canônicas
CREATE FUNCTION public.school_document_composable_kinds() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$ SELECT ARRAY['declaracao-de-matricula','declaracao-escolar']::text[] $$;
REVOKE ALL ON FUNCTION public.school_document_composable_kinds() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_document_composable_kinds() TO authenticated;

CREATE FUNCTION public.af_document_facts(_school text, _student text, _on date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE f jsonb := '{}'::jsonb; src jsonb := '[]'::jsonb; s record; sv record; e record; n int; c record; yv record; eligible text := 'ok';
BEGIN
  f := jsonb_build_object('escola.id', _school, 'aluno.id', _student, 'documento.data_de_referencia', _on::text);
  SELECT * INTO s FROM public.institutional_students WHERE id = _student;
  IF s.id IS NOT NULL THEN
    f := f || jsonb_build_object('aluno.nome', s.display_name);
    IF s.institutional_identifier IS NOT NULL THEN f := f || jsonb_build_object('aluno.identificador', s.institutional_identifier); END IF;
    src := src || jsonb_build_object('fact', 'aluno', 'reader', 'institutional_students', 'ref', s.id);
  END IF;
  SELECT v.* INTO sv FROM public.institutional_school_record_versions v WHERE v.school_id = _school AND v.valid_from <= _on
   ORDER BY v.valid_from DESC, v.version_number DESC LIMIT 1;
  IF sv.id IS NOT NULL THEN f := f || jsonb_build_object('escola.nome', sv.official_name);
    src := src || jsonb_build_object('fact', 'escola.nome', 'reader', 'institutional_school_record_versions', 'ref', sv.id); END IF;
  SELECT count(*) INTO n FROM public.school_enrollments se WHERE se.student_id = _student AND se.school_id = _school AND public.af_enrollment_current(se.id)
     AND se.opened_on IS NOT NULL AND se.opened_on <= _on
     AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = se.id AND x.ended_on < _on);
  IF n = 1 THEN
    SELECT se.* INTO e FROM public.school_enrollments se WHERE se.student_id = _student AND se.school_id = _school AND public.af_enrollment_current(se.id)
       AND se.opened_on IS NOT NULL AND se.opened_on <= _on
       AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = se.id AND x.ended_on < _on);
    f := f || jsonb_build_object('matricula.abertura', e.opened_on::text, 'ano_letivo.id', e.academic_year_id);
    IF e.institutional_number IS NOT NULL THEN f := f || jsonb_build_object('matricula.numero', e.institutional_number); END IF;
    src := src || jsonb_build_object('fact', 'matricula', 'reader', 'school_enrollments', 'ref', e.id);
    SELECT v.official_name INTO yv FROM public.institutional_academic_year_versions v WHERE v.academic_year_id = e.academic_year_id ORDER BY v.version DESC LIMIT 1;
    IF yv.official_name IS NOT NULL THEN f := f || jsonb_build_object('ano_letivo.nome', yv.official_name); END IF;
    SELECT count(*) INTO n FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id AND public.af_episode_current(p.id) AND p.valid_from <= _on
       AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id AND y.ended_on < _on);
    IF n = 1 THEN
      SELECT p.* INTO c FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id AND public.af_episode_current(p.id) AND p.valid_from <= _on
         AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id AND y.ended_on < _on);
      f := f || jsonb_build_object('turma.rotulo', c.class_label_snapshot, 'turma.desde', c.valid_from::text);
      src := src || jsonb_build_object('fact', 'turma', 'reader', 'class_enrollment_episodes', 'ref', c.id);
    END IF;
  ELSIF n = 0 THEN eligible := 'sem-vinculo-ativo-com-inicio-efetivo';
  ELSE eligible := 'vinculo-ambiguo'; END IF;
  RETURN jsonb_build_object('fields', f, 'sources', src, 'eligibility', eligible);
END $fn$;
REVOKE ALL ON FUNCTION public.af_document_facts(text, text, date) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.school_document_facts(_school text, _student text, _on date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL OR _student IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'document:scope-required'; END IF;
  IF NOT (public.has_school_capability('emitir-documento-escolar', _school) OR public.has_school_capability('consultar-documento-escolar', _school))
     OR NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN
    RAISE EXCEPTION 'document:not-found'; END IF;
  RETURN public.af_document_facts(_school, _student, _on);
END $fn$;
REVOKE ALL ON FUNCTION public.school_document_facts(text, text, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.school_document_facts(text, text, date) TO authenticated;

CREATE FUNCTION public.emit_school_document_v2(_template_version_id uuid, _school_id text, _student_id text, _valid_on date,
  _reproduces_id uuid, _retifies_id uuid, _retification_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; tv record; orig record; facts jsonb; snap jsonb; ctx jsonb; num text; seq int; code text;
  pub jsonb := '{}'::jsonb; f text; new_id uuid; sha text;
BEGIN
  me := public.af_natural_person();
  IF _school_id IS NULL OR _student_id IS NULL THEN RAISE EXCEPTION 'document:scope-required'; END IF;
  g := public.school_document_grant('emitir-documento-escolar', _school_id);
  IF _reproduces_id IS NOT NULL THEN
    IF _retifies_id IS NOT NULL THEN RAISE EXCEPTION 'document:reproduction-cannot-retify'; END IF;
    SELECT * INTO orig FROM public.school_document_emissions WHERE id = _reproduces_id;
    IF orig.id IS NULL OR orig.school_id <> _school_id OR orig.student_id <> _student_id THEN RAISE EXCEPTION 'document:emission-not-found'; END IF;
    IF orig.emission_kind = 'reproducao' THEN RAISE EXCEPTION 'document:reproduce-the-original'; END IF;
    IF EXISTS (SELECT 1 FROM public.school_document_emission_events e WHERE e.emission_id = orig.id) THEN RAISE EXCEPTION 'document:emission-not-active'; END IF;
    snap := orig.snapshot; ctx := orig.context; num := orig.emission_number; pub := orig.public_payload;
    SELECT v.*, t.document_kind INTO tv FROM public.school_document_template_versions v JOIN public.school_document_templates t ON t.id = v.template_id
     WHERE v.id = orig.template_version_id;
  ELSE
    IF _valid_on IS NULL OR _valid_on > CURRENT_DATE THEN RAISE EXCEPTION 'document:reference-date-invalid'; END IF;
    SELECT v.*, t.document_kind INTO tv FROM public.school_document_template_versions v JOIN public.school_document_templates t ON t.id = v.template_id
     WHERE v.id = _template_version_id;
    IF tv.id IS NULL THEN RAISE EXCEPTION 'document:template-not-found'; END IF;
    IF NOT (tv.document_kind = ANY (public.school_document_composable_kinds())) THEN RAISE EXCEPTION 'document:not-ready:%', tv.document_kind; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student_id AND e.school_id = _school_id) THEN
      RAISE EXCEPTION 'document:emission-not-found'; END IF;
    facts := public.af_document_facts(_school_id, _student_id, _valid_on);
    IF facts->>'eligibility' <> 'ok' THEN RAISE EXCEPTION 'document:not-eligible:%', facts->>'eligibility'; END IF;
    IF tv.id IS DISTINCT FROM (SELECT v.id FROM public.school_document_template_versions v WHERE v.template_id = tv.template_id ORDER BY v.version_no DESC LIMIT 1) THEN
      RAISE EXCEPTION 'base-superseded'; END IF;
    IF _retifies_id IS NOT NULL THEN
      IF coalesce(btrim(_retification_reason), '') = '' THEN RAISE EXCEPTION 'correction-reason-required'; END IF;
      PERFORM pg_advisory_xact_lock(hashtext('sde:' || _retifies_id::text));
      SELECT * INTO orig FROM public.school_document_emissions WHERE id = _retifies_id;
      IF orig.id IS NULL OR orig.school_id <> _school_id OR orig.student_id <> _student_id OR orig.emission_kind <> 'original' THEN
        RAISE EXCEPTION 'document:emission-not-found'; END IF;
      IF EXISTS (SELECT 1 FROM public.school_document_emission_events e WHERE e.emission_id = orig.id) THEN RAISE EXCEPTION 'base-superseded'; END IF;
    END IF;
    snap := jsonb_build_object('schema', 'sigem.school-document-snapshot.v2',
      'template', jsonb_build_object('template_id', tv.template_id, 'version_id', tv.id, 'version_no', tv.version_no, 'title', tv.title,
        'blocks', tv.blocks, 'identity', tv.identity),
      'fields', facts->'fields', 'absent', '[]'::jsonb, 'sources', facts->'sources',
      'context', jsonb_build_object('school_id', _school_id, 'student_id', _student_id, 'valid_on', _valid_on, 'known_at', now()));
    ctx := jsonb_build_object('valid_on', _valid_on, 'composer', 'af_document_facts.v1');
    FOREACH f IN ARRAY tv.public_fields LOOP
      IF NOT public.school_document_public_field_forbidden(f) AND (snap -> 'fields') ? f AND jsonb_typeof(snap -> 'fields' -> f) IN ('string','number') THEN
        pub := pub || jsonb_build_object(f, snap -> 'fields' -> f); END IF;
    END LOOP;
    IF tv.numbering IS NOT NULL AND coalesce(tv.numbering ->> 'prefix', '') <> '' THEN
      PERFORM pg_advisory_xact_lock(hashtext('sdn:' || tv.template_id || ':' || _school_id));
      SELECT count(*) + 1 INTO seq FROM public.school_document_emissions e JOIN public.school_document_template_versions v ON v.id = e.template_version_id
       WHERE v.template_id = tv.template_id AND e.school_id = _school_id AND e.emission_kind = 'original'
         AND extract(year FROM e.emitted_at) = extract(year FROM now());
      num := (tv.numbering ->> 'prefix') || '-' || to_char(now(), 'YYYY') || '-' || lpad(seq::text, greatest(coalesce((tv.numbering ->> 'digits')::int, 5), 1), '0');
    END IF;
  END IF;
  sha := encode(sha256(convert_to(snap::text, 'UTF8')), 'hex');
  code := upper(substr(encode(extensions.gen_random_bytes(10), 'hex'), 1, 16));
  INSERT INTO public.school_document_emissions(verification_code, emission_kind, reproduces_id, retifies_id, template_version_id,
    document_kind, school_id, student_id, context, snapshot, snapshot_sha256, emission_number, public_payload,
    emitted_by, emitted_by_person, emitted_by_engagement)
  VALUES (code, CASE WHEN _reproduces_id IS NULL THEN 'original' ELSE 'reproducao' END, _reproduces_id, _retifies_id, tv.id, tv.document_kind,
    _school_id, _student_id, ctx, snap, sha, num, pub, auth.uid(), me::text, g)
  RETURNING id INTO new_id;
  IF _retifies_id IS NOT NULL THEN
    INSERT INTO public.school_document_emission_events(emission_id, event_kind, replacement_emission_id, reason, recorded_by, recorded_by_engagement)
    VALUES (_retifies_id, 'retificacao', new_id, btrim(_retification_reason), auth.uid(), g);
  END IF;
  RETURN jsonb_build_object('id', new_id, 'verification_code', code, 'snapshot_sha256', sha, 'emission_number', num);
END $fn$;
REVOKE ALL ON FUNCTION public.emit_school_document_v2(uuid, text, text, date, uuid, uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.emit_school_document_v2(uuid, text, text, date, uuid, uuid, text) TO authenticated;