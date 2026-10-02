DO $mig$
DECLARE f record; d text; nd text; t text;
BEGIN
  FOR f IN SELECT p.oid, p.proname FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
             AND p.proname IN ('record_attendance_closing_act','register_infant_experience','record_cycle_closing','register_assessment_results',
               'record_collegial_deliberation','record_collegial_session_event','close_collegial_minute','record_lesson_version',
               'record_attendance_version','register_academic_standings')
  LOOP
    d := pg_get_functiondef(f.oid);
    t := substring(d from 'SELECT id INTO _existing FROM (public\.[a-z_]+) WHERE plan_id = _plan_id;');
    IF t IS NULL THEN RAISE EXCEPTION 'padrão de idempotência não encontrado em %', f.proname; END IF;
    nd := replace(d,
      'SELECT id INTO _existing FROM ' || t || ' WHERE plan_id = _plan_id;',
      'IF EXISTS (SELECT 1 FROM ' || t || ' WHERE plan_id = _plan_id AND author_user_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION ''plan-conflict''; END IF;'
      || chr(10) || '  SELECT id INTO _existing FROM ' || t || ' WHERE plan_id = _plan_id AND author_user_id = auth.uid();');
    EXECUTE nd;
  END LOOP;
END $mig$;