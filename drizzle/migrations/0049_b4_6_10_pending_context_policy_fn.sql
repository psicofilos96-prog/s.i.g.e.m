CREATE FUNCTION public.calendar_pending_context_visible(_version_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT public.calendar_has_network_capability('construir-calendario-da-rede')
      OR public.calendar_version_homologated_known(_version_id, pg_catalog.clock_timestamp())
$fn$;
REVOKE ALL ON FUNCTION public.calendar_pending_context_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_pending_context_visible(uuid) TO authenticated;
DROP POLICY "construction or homologated reads pending context" ON public.calendar_version_context_pending;
CREATE POLICY "construction or homologated reads pending context" ON public.calendar_version_context_pending FOR SELECT TO authenticated
  USING (public.calendar_pending_context_visible(version_id));
