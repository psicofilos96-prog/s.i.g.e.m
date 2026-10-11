CREATE OR REPLACE FUNCTION public.nei_dashboard(_school text DEFAULT NULL)
RETURNS TABLE(school_id text, school_name text, students_with_record bigint, aee_active bigint, aee_sessions_30d bigint, mediations_active bigint, clinical_students bigint, students_in_case_scope bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE net boolean; allowed text[]; is_coord boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT bool_or(s.network), array_agg(s.school_id) FILTER (WHERE s.school_id IS NOT NULL) INTO net, allowed FROM public.nei_scope_schools(auth.uid()) s;
  IF NOT coalesce(net,false) AND coalesce(array_length(allowed,1),0) = 0 THEN
    PERFORM public.nei_log('painel', _school, 'recusado'); RETURN;
  END IF;
  IF _school IS NOT NULL AND NOT coalesce(net,false) AND NOT (_school = ANY(allowed)) THEN
    PERFORM public.nei_log('painel', _school, 'recusado'); RETURN;
  END IF;
  is_coord := public.nei_is_station(auth.uid()) OR EXISTS (SELECT 1 FROM public.nei_active_grants(auth.uid()) g WHERE g.role = 'coordenador');
  PERFORM public.nei_log('painel', _school, 'permitido');
  RETURN QUERY
  WITH sc AS (
    SELECT s.id FROM public.institutional_schools s
     WHERE (_school IS NULL OR s.id = _school) AND (coalesce(net,false) OR s.id = ANY(allowed))
  ), ir AS (SELECT DISTINCT ON (r.logical_id) r.* FROM public.inclusion_records r ORDER BY r.logical_id, r.version DESC
  ), sv AS (SELECT DISTINCT ON (a.logical_id) a.* FROM public.aee_services a ORDER BY a.logical_id, a.version DESC
  ), ma AS (SELECT DISTINCT ON (m.logical_id) m.* FROM public.inclusion_mediation_assignments m ORDER BY m.logical_id, m.version DESC
  ), cr AS (SELECT DISTINCT ON (c.logical_id) c.* FROM public.inclusion_clinical_records c ORDER BY c.logical_id, c.version DESC)
  SELECT sc.id, public.nei_school_name(sc.id),
    (SELECT count(DISTINCT ir.student_id) FROM ir WHERE ir.school_id = sc.id AND ir.event_kind <> 'encerramento' AND (ir.valid_to IS NULL OR ir.valid_to >= CURRENT_DATE)),
    (SELECT count(*) FROM sv WHERE sv.school_id = sc.id AND sv.event_kind <> 'encerramento' AND (sv.valid_to IS NULL OR sv.valid_to >= CURRENT_DATE)),
    (SELECT count(*) FROM public.aee_sessions x WHERE x.school_id = sc.id AND x.event_kind <> 'anulacao' AND x.session_date >= CURRENT_DATE - 30),
    (SELECT count(*) FROM ma WHERE ma.school_id = sc.id AND ma.event_kind <> 'encerramento' AND (ma.valid_to IS NULL OR ma.valid_to >= CURRENT_DATE)),
    CASE WHEN is_coord THEN (SELECT count(DISTINCT cr.student_id) FROM cr WHERE cr.school_id = sc.id AND cr.event_kind <> 'encerramento') END,
    (SELECT count(DISTINCT g.student_id) FROM public.nei_active_grants(auth.uid()) g WHERE g.school_id = sc.id AND g.student_id IS NOT NULL)
  FROM sc ORDER BY 2 NULLS LAST;
END $$;