CREATE OR REPLACE FUNCTION public.secretariat_issue_infrequency_notice(_student text, _from date, _to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s text := public.secretariat_own_school_id(); n public.school_infrequency_notices; ev uuid; deliveries integer := 0; status text; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF s IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', s) THEN RAISE EXCEPTION 'infrequency:capability-missing'; END IF;
  IF _from IS NULL OR _to IS NULL OR _to < _from THEN RAISE EXCEPTION 'infrequency:period-invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('infreq:' || s || ':' || _student));
  SELECT * INTO n FROM public.school_infrequency_notices x WHERE x.school_id=s AND x.student_id=_student AND x.period_from=_from AND x.period_to=_to AND x.recorded_at::date=CURRENT_DATE ORDER BY x.recorded_at DESC, x.id LIMIT 1;
  IF n.id IS NULL THEN
    SELECT * INTO r FROM public.secretariat_own_infrequency(_from,_to) x WHERE x.student_id=_student;
    IF r IS NULL THEN RAISE EXCEPTION 'infrequency:not-below-threshold'; END IF;
    SELECT * INTO n FROM public.school_infrequency_notices WHERE id=public.secretariat_record_infrequency_notice(_student,_from,_to);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notification_delivery_rules ru
    JOIN LATERAL (SELECT t.* FROM public.notification_template_versions t WHERE t.template_key=ru.template_key ORDER BY t.version DESC LIMIT 1) tp ON NOT tp.retired
    WHERE ru.event_kind='infrequencia-aviso' AND NOT ru.retired
      AND NOT EXISTS (SELECT 1 FROM public.notification_delivery_rules newer WHERE newer.supersedes_id=ru.id)
  ) THEN status := 'configuration-missing';
  ELSIF NOT public.has_school_capability('emitir-notificacao', s) THEN status := 'delivery-denied';
  ELSE
    ev := public.emit_notification_event('infrequencia-aviso:' || n.id::text,'infrequencia-aviso',s,_student,'{}'::jsonb,'/avisos',NULL);
    SELECT count(*)::integer INTO deliveries FROM public.notification_deliveries d WHERE d.event_id=ev AND d.channel='in-app';
    status := CASE WHEN deliveries > 0 THEN 'available-in-app' ELSE 'no-authorized-recipient' END;
  END IF;
  RETURN pg_catalog.jsonb_build_object('notice_id',n.id,'delivery_status',status,'deliveries',deliveries,'present',n.present,'absent',n.absent,'threshold',n.threshold,'period_from',n.period_from,'period_to',n.period_to,'recorded_on',n.recorded_at::date);
END $$;
REVOKE ALL ON FUNCTION public.secretariat_issue_infrequency_notice(text,date,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_issue_infrequency_notice(text,date,date) TO authenticated;
COMMENT ON FUNCTION public.secretariat_issue_infrequency_notice(text,date,date) IS 'Explicit secretariat issue action; same-day same-period retry reuses notice. Only canonical rules dispatch in-app; no fabricated recipient, acknowledgement or external delivery.';