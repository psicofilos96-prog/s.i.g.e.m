-- 0198: completa 0197 — leitura de vínculos/episódios avaliava a capacidade por linha (16 s por 10 mil vínculos).
CREATE OR REPLACE FUNCTION public.capability_classes(_capability text)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT DISTINCT c.class_id FROM public.effective_capabilities(current_date) c
  WHERE c.capability_id = _capability AND c.class_id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.capability_classes(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.capability_classes(text) TO authenticated, service_role;

ALTER POLICY "leitura por capacidade escolar" ON public.student_class_bond_observations
  USING (school_id IN (SELECT public.school_capability_schools('consultar-matricula-e-movimentacao')));
ALTER POLICY "episodes by school capability" ON public.class_enrollment_episodes
  USING (school_id IN (SELECT public.school_capability_schools('consultar-matricula-e-movimentacao')));
ALTER POLICY "episodes by class capability" ON public.class_enrollment_episodes
  USING (class_id IN (SELECT public.capability_classes('consultar-matricula-e-movimentacao')));
ALTER POLICY "roster episodes by capability" ON public.class_enrollment_episodes
  USING (class_id IN (SELECT public.roster_readable_classes()));