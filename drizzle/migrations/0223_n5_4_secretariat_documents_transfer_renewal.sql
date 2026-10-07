-- N5.4 — Documentos, transferências, remanejamento e renovação pela conta da Secretaria (ator institucional).
-- Decisão do usuário 2026-10-07 (N5.4): a Secretaria Escolar emite e consulta documentos da própria escola.
-- Sujeitos (aluno, matrícula, turma) continuam reais; só a AUTORIA passa a aceitar o principal setorial.

INSERT INTO public.sector_station_rule_versions(rules_version, status, valid_from, decision_ref)
VALUES (2, 'homologated', DATE '2026-10-07', 'decisao-usuario-2026-10-07-n5-4-documentos-secretaria');
INSERT INTO public.sector_station_rules(rules_version, station_code, capability_id, decision_ref)
SELECT 2, station_code, capability_id, decision_ref FROM public.sector_station_rules WHERE rules_version = 1;
INSERT INTO public.sector_station_rules(rules_version, station_code, capability_id, decision_ref) VALUES
 (2, 'secretaria_escolar', 'emitir-documento-escolar', 'decisao-usuario-2026-10-07-n5-4-documentos-secretaria'),
 (2, 'secretaria_escolar', 'consultar-documento-escolar', 'decisao-usuario-2026-10-07-n5-4-documentos-secretaria'),
 (2, 'administracao_geral', 'emitir-documento-escolar', 'cobertura-explicita-administrador-geral-bq1'),
 (2, 'administracao_geral', 'consultar-documento-escolar', 'cobertura-explicita-administrador-geral-bq1');

ALTER TABLE public.school_document_emissions ADD COLUMN emitted_by_principal_id uuid REFERENCES public.institutional_sector_principals(id);
ALTER TABLE public.school_document_emissions ALTER COLUMN emitted_by_engagement DROP NOT NULL;
ALTER TABLE public.school_document_emissions ADD CONSTRAINT school_document_emissions_author_xor
  CHECK ((emitted_by_principal_id IS NULL) <> (emitted_by_engagement IS NULL));
ALTER TABLE public.school_document_emission_events ADD COLUMN recorded_by_principal_id uuid REFERENCES public.institutional_sector_principals(id);
ALTER TABLE public.school_document_emission_events ALTER COLUMN recorded_by_engagement DROP NOT NULL;
ALTER TABLE public.school_document_emission_events ADD CONSTRAINT school_document_emission_events_author_xor
  CHECK ((recorded_by_principal_id IS NULL) <> (recorded_by_engagement IS NULL));

CREATE OR REPLACE FUNCTION public.school_document_author(_capability text, _school text)
RETURNS TABLE(engagement_id uuid, principal_id uuid) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE pr uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability IS NULL OR NOT (_capability = ANY (public.school_document_capabilities())) THEN RAISE EXCEPTION 'document:capability-not-allowed'; END IF;
  IF public.current_principal_id() IS NOT NULL THEN
    SELECT g.principal_id INTO pr FROM public.sector_station_grants(CURRENT_DATE) g
     WHERE g.capability_id = _capability AND g.principal_id IS NOT NULL
       AND (g.scope_level = 'rede' OR (_school IS NOT NULL AND g.scope_level = 'escola' AND g.school_id = _school))
     LIMIT 1;
    IF pr IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
    RETURN QUERY SELECT NULL::uuid, pr; RETURN;
  END IF;
  RETURN QUERY SELECT public.school_document_grant(_capability, _school), NULL::uuid;
END $fn$;
REVOKE ALL ON FUNCTION public.school_document_author(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_school_document_emission(_emission_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; pr uuid; e record; new_id uuid;
BEGIN
  SELECT * INTO e FROM public.school_document_emissions WHERE id = _emission_id;
  IF e.id IS NULL THEN RAISE EXCEPTION 'document:emission-not-found'; END IF;
  SELECT a.engagement_id, a.principal_id INTO g, pr FROM public.school_document_author('emitir-documento-escolar', e.school_id) a;
  IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN RAISE EXCEPTION 'correction-reason-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sde:' || _emission_id::text));
  IF EXISTS (SELECT 1 FROM public.school_document_emission_events x WHERE x.emission_id = _emission_id) THEN RAISE EXCEPTION 'base-superseded'; END IF;
  INSERT INTO public.school_document_emission_events(emission_id, event_kind, reason, recorded_by, recorded_by_engagement, recorded_by_principal_id)
  VALUES (_emission_id, 'cancelamento', btrim(_reason), auth.uid(), g, pr) RETURNING id INTO new_id;
  RETURN jsonb_build_object('id', new_id);
END $fn$;

CREATE OR REPLACE FUNCTION public.student_document_emissions(_school_id text, _student_id text)
RETURNS TABLE(id uuid, verification_code text, emission_kind text, reproduces_id uuid, retifies_id uuid,
  template_version_id uuid, document_kind text, context jsonb, snapshot jsonb, snapshot_sha256 text,
  emission_number text, emitted_by_person text, emitted_at timestamptz,
  event_kind text, event_reason text, replacement_emission_id uuid, event_recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school_id IS NULL OR _student_id IS NULL THEN RAISE EXCEPTION 'document:scope-required'; END IF;
  BEGIN PERFORM public.school_document_author('consultar-documento-escolar', _school_id);
  EXCEPTION WHEN raise_exception THEN PERFORM public.school_document_author('emitir-documento-escolar', _school_id); END;
  RETURN QUERY SELECT e.id, e.verification_code, e.emission_kind, e.reproduces_id, e.retifies_id, e.template_version_id,
    e.document_kind, e.context, e.snapshot, e.snapshot_sha256, e.emission_number, e.emitted_by_person, e.emitted_at,
    x.event_kind, x.reason, x.replacement_emission_id, x.recorded_at
   FROM public.school_document_emissions e LEFT JOIN public.school_document_emission_events x ON x.emission_id = e.id
   WHERE e.school_id = _school_id AND e.student_id = _student_id ORDER BY e.emitted_at DESC;
END $fn$;

CREATE OR REPLACE FUNCTION public.emit_school_document_v2(_template_version_id uuid, _school_id text, _student_id text, _valid_on date,
  _reproduces_id uuid, _retifies_id uuid, _retification_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g uuid; pr uuid; tv record; orig record; facts jsonb; snap jsonb; ctx jsonb; num text; seq int; code text;
  pub jsonb := '{}'::jsonb; f text; new_id uuid; sha text;
BEGIN
  IF _school_id IS NULL OR _student_id IS NULL THEN RAISE EXCEPTION 'document:scope-required'; END IF;
  SELECT a.engagement_id, a.principal_id INTO g, pr FROM public.school_document_author('emitir-documento-escolar', _school_id) a;
  IF pr IS NULL THEN me := public.af_natural_person(); END IF;
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
    emitted_by, emitted_by_person, emitted_by_engagement, emitted_by_principal_id)
  VALUES (code, CASE WHEN _reproduces_id IS NULL THEN 'original' ELSE 'reproducao' END, _reproduces_id, _retifies_id, tv.id, tv.document_kind,
    _school_id, _student_id, ctx, snap, sha, num, pub, auth.uid(), me::text, g, pr)
  RETURNING id INTO new_id;
  IF _retifies_id IS NOT NULL THEN
    INSERT INTO public.school_document_emission_events(emission_id, event_kind, replacement_emission_id, reason, recorded_by, recorded_by_engagement, recorded_by_principal_id)
    VALUES (_retifies_id, 'retificacao', new_id, btrim(_retification_reason), auth.uid(), g, pr);
  END IF;
  RETURN jsonb_build_object('id', new_id, 'verification_code', code, 'snapshot_sha256', sha, 'emission_number', num);
END $fn$;

CREATE OR REPLACE FUNCTION public.secretariat_end_class_episode(_episode text, _ended_on date, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; c record; e record;
BEGIN
  PERFORM public.sec_actor();
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

CREATE OR REPLACE FUNCTION public.secretariat_record_exit(_enrollment text, _effective_on date, _movement_type text, _type_version integer,
  _destination_school text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; e record; mid uuid; ep record;
BEGIN
  PERFORM public.sec_actor();
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

CREATE OR REPLACE FUNCTION public.secretariat_reassign_class(_episode text, _new_class text, _effective_on date, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE c record;
BEGIN
  PERFORM public.sec_actor();
  SELECT * INTO c FROM public.class_enrollment_episodes WHERE id = _episode;
  IF c.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', c.school_id) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'correction-reason-required'; END IF;
  IF _new_class IS NULL OR _new_class = c.class_id THEN RAISE EXCEPTION 'secretariat:class-invalid'; END IF;
  IF _effective_on IS NULL OR _effective_on - 1 < c.valid_from THEN RAISE EXCEPTION 'secretariat:date-invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('af-alloc:' || c.enrollment_id));
  IF NOT public.af_episode_current(c.id) OR EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = c.id) THEN
    RAISE EXCEPTION 'base-superseded'; END IF;
  INSERT INTO public.class_enrollment_episode_endings(episode_id, ended_on, reason_label) VALUES (c.id, _effective_on - 1, 'remanejamento');
  RETURN public.sec_allocate_core(c.enrollment_id, _new_class, _effective_on, 'remanejamento: ' || btrim(_reason));
END $fn$;
REVOKE ALL ON FUNCTION public.secretariat_reassign_class(text, text, date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_reassign_class(text, text, date, text) TO authenticated;

ALTER TABLE public.year_transition_decisions ADD COLUMN author_principal_id uuid REFERENCES public.institutional_sector_principals(id);
ALTER TABLE public.year_transition_decisions ALTER COLUMN author_person_id DROP NOT NULL;
ALTER TABLE public.year_transition_decisions ADD CONSTRAINT year_transition_decisions_author_xor
  CHECK ((author_principal_id IS NULL) <> (author_person_id IS NULL));

CREATE OR REPLACE FUNCTION public.record_year_transition_decision(_school text, _student text, _from_year text, _to_year text, _decision text, _expected_sequence integer, _declared_on date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE ac record; cur record; enr text; nid uuid; a record;
BEGIN
  SELECT * INTO ac FROM public.sec_actor();
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'transition:capability-missing'; END IF;
  IF _decision NOT IN ('renovou','transferido-saida','nao-renovou') THEN RAISE EXCEPTION 'transition:decision-invalid'; END IF;
  IF NOT public.s_year_open_for_operation(_to_year) THEN RAISE EXCEPTION 'transition:target-year-not-open'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.school_id = _school AND e.student_id = _student AND e.academic_year_id = _from_year) THEN RAISE EXCEPTION 'transition:not-a-candidate'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('transition:' || _school || ':' || _student || ':' || _to_year));
  SELECT * INTO cur FROM public.year_transition_decisions WHERE school_id = _school AND student_id = _student AND to_year_id = _to_year ORDER BY sequence DESC LIMIT 1;
  IF coalesce(cur.sequence, 0) IS DISTINCT FROM coalesce(_expected_sequence, 0) THEN RAISE EXCEPTION 'transition:stale-base'; END IF;
  IF cur.id IS NOT NULL AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'transition:rectification-reason-required'; END IF;
  IF cur.decision = 'renovou' AND _decision <> 'renovou' THEN
    SELECT * INTO a FROM public.s_active_enrollment(_student, _to_year) WHERE school_id = _school LIMIT 1;
    IF a.enrollment_id IS NOT NULL THEN RAISE EXCEPTION 'transition:renewed-enrollment-must-be-ended-first'; END IF;
  END IF;
  IF _decision = 'renovou' THEN enr := public.s_enroll_core(_student, _school, _to_year, _declared_on, NULL); END IF;
  INSERT INTO public.year_transition_decisions(school_id, student_id, from_year_id, to_year_id, sequence, decision, declared_on, reason, resulting_enrollment_id, author_user_id, author_person_id, author_principal_id)
  VALUES (_school, _student, _from_year, _to_year, coalesce(cur.sequence, 0) + 1, _decision, _declared_on, nullif(pg_catalog.btrim(coalesce(_reason,'')),''), enr, auth.uid(), ac.person_id, ac.principal_id)
  RETURNING id INTO nid;
  RETURN nid;
END $$;