CREATE OR REPLACE FUNCTION public.secretariat_vaccination_deadline_days()
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE value jsonb; days numeric;
BEGIN
  value := coalesce(public.sector_parameter_value('secretaria.prazo-vacinacao'), '30'::jsonb);
  IF jsonb_typeof(value) <> 'number' THEN RAISE EXCEPTION 'parameter:days-invalid'; END IF;
  days := (value #>> '{}')::numeric;
  IF days <> floor(days) OR days < 1 OR days > 365 THEN RAISE EXCEPTION 'parameter:days-invalid'; END IF;
  RETURN days::integer;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_vaccination_deadline_days() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_vaccination_deadline_days() TO authenticated;

CREATE OR REPLACE FUNCTION public.secretariat_record_vaccination(_school text, _student text, _status text, _declared_on date, _note text, _expected_sequence integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE cur integer; nid uuid; days integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'vaccination:capability-missing'; END IF;
  IF _status IS NULL OR _status NOT IN ('em-dia','pendente') THEN RAISE EXCEPTION 'vaccination:status-invalid'; END IF;
  IF _declared_on IS NULL OR _declared_on > current_date THEN RAISE EXCEPTION 'vaccination:date-invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.school_id=_school AND e.student_id=_student) THEN RAISE EXCEPTION 'vaccination:not-a-student'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vaccination:'||_school||':'||_student));
  SELECT coalesce(max(v.sequence),0) INTO cur FROM public.student_vaccination_status_events v WHERE v.school_id=_school AND v.student_id=_student;
  IF cur <> coalesce(_expected_sequence,0) THEN RAISE EXCEPTION 'vaccination:stale-base'; END IF;
  IF _status='pendente' THEN days := public.secretariat_vaccination_deadline_days(); END IF;
  INSERT INTO public.student_vaccination_status_events(school_id,student_id,sequence,status,declared_on,due_on,note,recorded_by)
  VALUES (_school,_student,cur+1,_status,_declared_on, CASE WHEN _status='pendente' THEN _declared_on + days END, nullif(btrim(_note),''), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_record_vaccination(text,text,text,date,text,integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_record_vaccination(text,text,text,date,text,integer) TO authenticated;
COMMENT ON COLUMN public.student_vaccination_status_events.due_on IS 'Prazo calculado com o parâmetro vigente no registro; alterações posteriores de parâmetro não modificam este fato.';