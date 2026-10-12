DROP POLICY IF EXISTS "functional links via posting school" ON public.professional_functional_links;
CREATE POLICY "functional links via posting school" ON public.professional_functional_links
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.professional_postings p
    WHERE p.functional_link_logical_id = professional_functional_links.logical_id
      AND public.has_school_capability('consultar-registro-funcional'::text, p.school_id)
  ));