CREATE OR REPLACE FUNCTION public.calendar_network_sources_at(_known_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE _k timestamptz := coalesce(_known_at, pg_catalog.clock_timestamp());
BEGIN
  IF auth.uid() IS NULL THEN RETURN pg_catalog.jsonb_build_object('contract','b4.6.10/1','state','access-denied'); END IF;
  IF _k > pg_catalog.clock_timestamp() THEN _k := pg_catalog.clock_timestamp(); END IF;
  RETURN pg_catalog.jsonb_build_object('contract','b4.6.10/1','state','lido','knownAt', _k,
    'audience', CASE WHEN public.calendar_has_network_capability('construir-calendario-da-rede') THEN 'construcao' ELSE 'homologados' END,
    'sources', coalesce((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('sourceKey', l.source_key, 'calendarId', l.calendar_id) ORDER BY l.source_key)
      FROM public.calendar_network_source_links l
     WHERE l.created_at <= _k AND (public.calendar_has_network_capability('construir-calendario-da-rede')
        OR EXISTS (SELECT 1 FROM public.calendar_versions v JOIN public.calendar_version_homologations h ON h.calendar_version_id = v.id
                    WHERE v.calendar_id = l.calendar_id AND h.decision = 'homologada'))), '[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_network_sources_at(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_network_sources_at(timestamptz) TO authenticated;