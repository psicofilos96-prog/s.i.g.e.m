-- Ano-base resolvido pela versão vigente do ano letivo cujo intervalo contém o ano; sem ano ⇒ contagem nula (nunca zero).
CREATE OR REPLACE FUNCTION public.educacenso_control_at(_year text, _stage_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE net boolean; rows jsonb; yid text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacenso:session-required'; END IF;
  net := public.census_can_read_network() OR public.has_network_capability('preparar-censo-escolar');
  SELECT v.academic_year_id INTO yid FROM public.institutional_academic_year_versions v
   WHERE extract(year FROM v.starts_on)::text = _year
     AND v.version = (SELECT max(w.version) FROM public.institutional_academic_year_versions w WHERE w.academic_year_id = v.academic_year_id)
   ORDER BY v.academic_year_id LIMIT 1;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'school_id', s.id,
      'inep', (SELECT i.value FROM public.institutional_school_identifiers i WHERE i.school_id = s.id AND i.identifier_kind = 'inep' LIMIT 1),
      'head', (SELECT jsonb_build_object('seq', e.seq, 'state', e.state, 'protocol_ref', e.protocol_ref, 'reason', e.reason, 'actor_scope', e.actor_scope, 'recorded_at', e.recorded_at)
               FROM public.educacenso_school_status_events e WHERE e.census_year = _year AND e.stage_key = _stage_key AND e.school_id = s.id ORDER BY e.seq DESC LIMIT 1),
      'receipt', (SELECT jsonb_build_object('version', r.version, 'issued_at', r.issued_at, 'closed_at', r.closed_at)
               FROM public.census_official_receipt_snapshots r WHERE r.school_id = s.id AND r.census_year = _year ORDER BY r.version DESC LIMIT 1),
      'enrollments_without_start', CASE WHEN yid IS NULL THEN NULL ELSE (SELECT count(*) FROM public.school_enrollments se WHERE se.school_id = s.id AND se.academic_year_id = yid AND se.opened_on IS NULL) END
    ) ORDER BY s.id), '[]'::jsonb) INTO rows
  FROM public.institutional_schools s
  WHERE net OR public.has_school_capability('consultar-pendencias-do-censo', s.id) OR public.has_school_capability('preparar-censo-escolar', s.id);
  RETURN jsonb_build_object('network', net, 'can_configure', public.has_network_capability('preparar-censo-escolar'), 'academic_year_id', yid, 'schools', rows);
END $$;
