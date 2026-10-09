-- PERF.LOADING.3 — contagem exata com o alcance calculado UMA vez (conjuntos), espelhando literalmente
-- as políticas SELECT de institutional_students e school_enrollments (OR das políticas). Não amplia
-- acesso: devolve só um número que o chamador já obteria com count(*) sob RLS.
CREATE OR REPLACE FUNCTION public.readable_students_count()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 0::bigint
    WHEN public.has_network_capability('consultar-identidade-cadastral-do-estudante') THEN (SELECT count(*) FROM public.institutional_students)
    ELSE (SELECT count(*) FROM public.institutional_students s WHERE s.id IN (
      SELECT o.student_id FROM public.student_class_bond_observations o
       WHERE o.school_id IN (SELECT public.school_capability_schools('consultar-matricula-e-movimentacao'))
      UNION
      SELECT e.student_id FROM public.class_enrollment_episodes e
       WHERE e.class_id IN (SELECT public.roster_readable_classes())))
  END
$$;

CREATE OR REPLACE FUNCTION public.readable_enrollments_count()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 0::bigint
    WHEN public.has_network_capability('consultar-matricula-e-movimentacao')
      OR public.capability_unbound('consultar-matricula-e-movimentacao') THEN (SELECT count(*) FROM public.school_enrollments)
    WHEN public.capability_unbound('consultar-estudantes-da-turma') THEN (SELECT count(*) FROM public.school_enrollments m WHERE
         m.school_id IN (SELECT public.school_capability_schools('consultar-matricula-e-movimentacao'))
      OR m.id IN (SELECT e.enrollment_id FROM public.class_enrollment_episodes e))
    ELSE (SELECT count(*) FROM public.school_enrollments m WHERE
         m.school_id IN (SELECT public.school_capability_schools('consultar-matricula-e-movimentacao'))
      OR m.id IN (SELECT e.enrollment_id FROM public.class_enrollment_episodes e
                   WHERE e.class_id IN (SELECT public.capability_classes('consultar-matricula-e-movimentacao'))
                      OR e.class_id IN (SELECT public.roster_readable_classes())))
  END
$$;

REVOKE ALL ON FUNCTION public.readable_students_count() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.readable_enrollments_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.readable_students_count() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.readable_enrollments_count() TO authenticated, service_role;