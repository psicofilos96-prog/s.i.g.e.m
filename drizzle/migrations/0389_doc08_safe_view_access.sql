CREATE OR REPLACE FUNCTION public.admin_case_readable(_case_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_case_files c WHERE c.id = _case_id AND (
    public.case_can_act(c.unit_id, 'instruir-processos') OR c.opened_by_person = public.current_person_id()
    OR EXISTS (SELECT 1 FROM public.admin_case_dispatches d WHERE d.case_id = c.id AND public.case_can_act(d.to_unit_id, 'instruir-processos')))) $$;
REVOKE ALL ON FUNCTION public.admin_case_readable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_case_readable(uuid) TO authenticated;
DROP VIEW public.admin_case_events_safe;
CREATE VIEW public.admin_case_events_safe WITH (security_barrier = true) AS
  SELECT e.id, e.case_id, e.seq, e.event_type, e.document_order,
    CASE WHEN s.case_event_id IS NULL THEN e.document_ref END AS document_ref,
    CASE WHEN s.case_event_id IS NULL THEN e.content_sha256 END AS content_sha256,
    (s.case_event_id IS NOT NULL) AS sensitive,
    e.to_unit_id, e.text_body, e.author_person, e.created_at
  FROM public.admin_case_events e LEFT JOIN public.admin_case_sensitive_documents s ON s.case_event_id = e.id
  WHERE public.admin_case_readable(e.case_id);
REVOKE ALL ON public.admin_case_events_safe FROM anon, PUBLIC;
GRANT SELECT ON public.admin_case_events_safe TO authenticated;