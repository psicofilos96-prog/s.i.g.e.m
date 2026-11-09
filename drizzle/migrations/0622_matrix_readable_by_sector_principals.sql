DROP POLICY IF EXISTS "matrix items readable by linked accounts" ON public.curricular_matrix_items;
CREATE POLICY "matrix items readable by linked accounts" ON public.curricular_matrix_items FOR SELECT TO authenticated
  USING ((SELECT public.current_person_id()) IS NOT NULL OR (SELECT public.current_principal_id()) IS NOT NULL);
DROP POLICY IF EXISTS "matrix versions readable by linked accounts" ON public.curricular_matrix_versions;
CREATE POLICY "matrix versions readable by linked accounts" ON public.curricular_matrix_versions FOR SELECT TO authenticated
  USING ((SELECT public.current_person_id()) IS NOT NULL OR (SELECT public.current_principal_id()) IS NOT NULL);