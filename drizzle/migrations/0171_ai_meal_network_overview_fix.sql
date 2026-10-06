-- AI: corrige ambiguidade school_id em meal_network_overview (detectada pelo E2E); mesma assinatura, mesmas grandezas.
CREATE OR REPLACE FUNCTION public.meal_network_overview(_from date, _to date)
RETURNS TABLE(school_id text, forecast_total integer, forecast_days integer, served_total integer, served_days integer,
  served_unknown_records integer, menu_days integer, published_menus integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
BEGIN
  PERFORM public.meal_network_grant('acompanhar-alimentacao-rede');
  IF _from IS NULL OR _to IS NULL OR _to < _from OR _to - _from > 370 THEN RAISE EXCEPTION 'meal:period-invalid'; END IF;
  RETURN QUERY WITH f AS (
      SELECT x.school_id sid, sum(x.forecast_count)::int t, count(DISTINCT x.served_on)::int d FROM public.meal_forecasts x
       WHERE x.event_kind <> 'revogacao' AND NOT EXISTS (SELECT 1 FROM public.meal_forecasts y WHERE y.supersedes_id = x.id)
         AND x.served_on BETWEEN _from AND _to GROUP BY 1),
    s AS (
      SELECT x.school_id sid, CASE WHEN count(x.served_count) = 0 THEN NULL ELSE sum(x.served_count)::int END t,
             count(DISTINCT x.served_on) FILTER (WHERE x.served_count IS NOT NULL)::int d,
             count(*) FILTER (WHERE x.served_count IS NULL)::int u FROM public.meal_service_records x
       WHERE x.event_kind <> 'revogacao' AND NOT EXISTS (SELECT 1 FROM public.meal_service_records y WHERE y.supersedes_id = x.id)
         AND x.served_on BETWEEN _from AND _to GROUP BY 1),
    m AS (
      SELECT x.school_id sid, count(DISTINCT (e->>'date'))::int d FROM public.meal_menu_versions x, jsonb_array_elements(x.entries) e
       WHERE x.event_kind <> 'revogacao' AND NOT EXISTS (SELECT 1 FROM public.meal_menu_versions y WHERE y.supersedes_id = x.id)
         AND (e->>'date')::date BETWEEN _from AND _to GROUP BY 1),
    p AS (
      SELECT q.school_id sid, count(*)::int n FROM (SELECT DISTINCT ON (z.menu_logical_id) z.* FROM public.meal_menu_publications z ORDER BY z.menu_logical_id, z.sequence DESC) q
       WHERE q.action = 'publicacao' GROUP BY 1),
    sc AS (SELECT f.sid FROM f UNION SELECT s.sid FROM s UNION SELECT m.sid FROM m UNION SELECT p.sid FROM p)
    SELECT sc.sid, f.t, f.d, s.t, s.d, s.u, m.d, p.n
      FROM sc LEFT JOIN f ON f.sid = sc.sid LEFT JOIN s ON s.sid = sc.sid LEFT JOIN m ON m.sid = sc.sid LEFT JOIN p ON p.sid = sc.sid
     ORDER BY 1;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_network_overview(date,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_network_overview(date,date) TO authenticated;

-- mesma classe de risco nos outros readers novos com colunas homônimas de saída
CREATE OR REPLACE FUNCTION public.family_published_menus(_student text, _on date)
RETURNS TABLE(school_id text, starts_on date, ends_on date, entries jsonb, published_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
DECLARE sch text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:date-required'; END IF;
  SELECT a.school_id INTO sch FROM public.guardian_authorizations a
   WHERE a.guardian_user_id = auth.uid() AND a.student_id = _student AND a.event_kind <> 'revogacao'
     AND NOT EXISTS (SELECT 1 FROM public.guardian_authorizations s WHERE s.supersedes_id = a.id)
     AND a.valid_from <= _on AND (a.valid_until IS NULL OR a.valid_until >= _on)
   ORDER BY a.recorded_at DESC LIMIT 1;
  IF sch IS NULL THEN RAISE EXCEPTION 'family:not-authorized'; END IF;
  RETURN QUERY SELECT m.school_id, m.starts_on, m.ends_on, m.entries, p.recorded_at
    FROM (SELECT DISTINCT ON (q.menu_logical_id) q.* FROM public.meal_menu_publications q WHERE q.school_id = sch ORDER BY q.menu_logical_id, q.sequence DESC) p
    JOIN public.meal_menu_versions m ON m.id = p.menu_version_id
   WHERE p.action = 'publicacao' AND m.event_kind <> 'revogacao'
     AND NOT EXISTS (SELECT 1 FROM public.meal_menu_versions x WHERE x.supersedes_id = m.id)
     AND m.ends_on >= _on - 31 AND m.starts_on <= _on + 62
   ORDER BY m.starts_on;
END $fn$;
REVOKE ALL ON FUNCTION public.family_published_menus(text,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.family_published_menus(text,date) TO authenticated;