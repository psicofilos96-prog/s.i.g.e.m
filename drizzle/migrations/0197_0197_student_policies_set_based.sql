-- 0197: mesmo gargalo (BO.2): policies por linha recalculavam effective_capabilities a cada estudante.
-- Helpers set-based com semântica idêntica a can_read_class_roster / has_school_capability; avaliados uma vez por consulta.
CREATE OR REPLACE FUNCTION public.roster_readable_classes()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT DISTINCT c.class_id FROM public.effective_capabilities(current_date) c
  WHERE c.capability_id = 'consultar-estudantes-da-turma' AND c.class_id IS NOT NULL
$$;
CREATE OR REPLACE FUNCTION public.school_capability_schools(_capability text)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT DISTINCT c.school_id FROM public.effective_scope_capabilities(current_date) c
   WHERE c.capability_id = _capability AND c.scope_level = 'escola' AND c.school_id IS NOT NULL
  UNION
  SELECT s.id FROM public.institutional_schools s
   WHERE EXISTS (SELECT 1 FROM public.effective_scope_capabilities(current_date) c WHERE c.capability_id = _capability AND c.scope_level = 'rede')
$$;
REVOKE ALL ON FUNCTION public.roster_readable_classes(), public.school_capability_schools(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roster_readable_classes(), public.school_capability_schools(text) TO authenticated, service_role;

ALTER POLICY "students via readable episode" ON public.institutional_students
  USING (EXISTS (SELECT 1 FROM public.class_enrollment_episodes e
    WHERE e.student_id = institutional_students.id AND e.class_id IN (SELECT public.roster_readable_classes())));
ALTER POLICY "students via observed bond" ON public.institutional_students
  USING (EXISTS (SELECT 1 FROM public.student_class_bond_observations o
    WHERE o.student_id = institutional_students.id AND o.school_id IN (SELECT public.school_capability_schools('consultar-matricula-e-movimentacao'))));