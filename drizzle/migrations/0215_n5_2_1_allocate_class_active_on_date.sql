-- N5.2.1d — enturmação revalida no banco que a turma está ATIVA na data de início (class_at), porque turma sem cadastro vigente naquela data não pode receber estudante.
CREATE OR REPLACE FUNCTION public.sec_allocate_core(_enrollment text, _class text, _valid_from date, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE e record; c record; yv record; nid text;
BEGIN
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
  IF NOT EXISTS (SELECT 1 FROM public.class_at(c.id, _valid_from, NULL) a WHERE a.administrative_status = 'ativa') THEN RAISE EXCEPTION 'secretariat:class-not-active-on-date'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('af-alloc:' || e.id));
  IF EXISTS (SELECT 1 FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id AND public.af_episode_current(p.id)
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id)) THEN
    RAISE EXCEPTION 'secretariat:active-class-exists'; END IF;
  nid := 'enturm-' || pg_catalog.gen_random_uuid();
  INSERT INTO public.class_enrollment_episodes(id, enrollment_id, student_id, school_id, class_id, class_label_snapshot, cycle_id, valid_from,
    originating_act_ref, recorded_by, logical_id)
  VALUES (nid, e.id, e.student_id, e.school_id, c.id, c.name, e.cycle_id, _valid_from, nullif(pg_catalog.btrim(coalesce(_reason,'')), ''), auth.uid(), nid);
  RETURN nid;
END $fn$;
REVOKE ALL ON FUNCTION public.sec_allocate_core(text, text, date, text) FROM PUBLIC, anon, authenticated, service_role;
