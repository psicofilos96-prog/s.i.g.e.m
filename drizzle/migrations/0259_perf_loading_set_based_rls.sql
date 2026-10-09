-- PERF.LOADING.1 — políticas por linha recalculavam effective_capabilities() a cada linha (quadrático).
-- Mesma semântica, avaliada uma vez por consulta (conjunto em subplano).

CREATE OR REPLACE FUNCTION public.capability_unbound(_capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.effective_capabilities(current_date) c WHERE c.capability_id = _capability AND c.class_id IS NULL) $$;

CREATE OR REPLACE FUNCTION public.readable_class_ids()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  WITH sch AS (
    SELECT s FROM public.school_capability_schools('consultar-organizacao-da-oferta') s
    UNION SELECT s FROM public.school_capability_schools('consultar-matricula-e-movimentacao') s
  ), offer AS (
    SELECT o.school_id, o.academic_year_id,
      public.offer_capability_on(o.school_id, (SELECT v.starts_on FROM public.institutional_academic_year_versions v
        WHERE v.academic_year_id = o.academic_year_id ORDER BY v.version DESC LIMIT 1)) AS ok
    FROM (SELECT DISTINCT c.school_id, c.academic_year_id FROM public.institutional_classes c) o
  )
  SELECT c.id FROM public.institutional_classes c
  LEFT JOIN offer o ON o.school_id IS NOT DISTINCT FROM c.school_id AND o.academic_year_id IS NOT DISTINCT FROM c.academic_year_id
  WHERE c.school_id IN (SELECT s FROM sch)
     OR COALESCE(o.ok, false)
     OR public.can_read_institutional_class(c.id, c.school_id)
     OR public.teaches_class(c.id)
$$;

GRANT EXECUTE ON FUNCTION public.capability_unbound(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.readable_class_ids() TO authenticated;

DROP POLICY IF EXISTS "classes by offer organization boundary" ON public.institutional_classes;
DROP POLICY IF EXISTS "classes by own engagement" ON public.institutional_classes;
CREATE POLICY "classes readable set" ON public.institutional_classes FOR SELECT TO authenticated
  USING (id IN (SELECT public.readable_class_ids()));

DROP POLICY IF EXISTS "class registry by offer organization boundary" ON public.institutional_class_record_versions;
DROP POLICY IF EXISTS "class registry versions by own engagement" ON public.institutional_class_record_versions;
CREATE POLICY "class registry readable set" ON public.institutional_class_record_versions FOR SELECT TO authenticated
  USING (class_id IN (SELECT public.readable_class_ids()));

DROP POLICY IF EXISTS "enrollments by school capability" ON public.school_enrollments;
CREATE POLICY "enrollments by school capability" ON public.school_enrollments FOR SELECT TO authenticated
  USING (school_id IN (SELECT public.school_capability_schools('consultar-matricula-e-movimentacao')));

DROP POLICY IF EXISTS "enrollments by class capability" ON public.school_enrollments;
CREATE POLICY "enrollments by class capability" ON public.school_enrollments FOR SELECT TO authenticated
  USING ((SELECT public.capability_unbound('consultar-matricula-e-movimentacao'))
    OR EXISTS (SELECT 1 FROM public.class_enrollment_episodes p WHERE p.enrollment_id = school_enrollments.id
      AND p.class_id IN (SELECT public.capability_classes('consultar-matricula-e-movimentacao'))));

DROP POLICY IF EXISTS "enrollments via readable episode" ON public.school_enrollments;
CREATE POLICY "enrollments via readable episode" ON public.school_enrollments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.enrollment_id = school_enrollments.id
      AND ((SELECT public.capability_unbound('consultar-estudantes-da-turma')) OR e.class_id IN (SELECT public.roster_readable_classes()))));

DROP POLICY IF EXISTS "leitura por capacidade escolar" ON public.student_school_day_observations;
CREATE POLICY "leitura por capacidade escolar" ON public.student_school_day_observations FOR SELECT TO authenticated
  USING (school_id IN (SELECT public.school_capability_schools('consultar-matricula-e-movimentacao')));

DROP POLICY IF EXISTS "professional_exercises by school capability" ON public.professional_exercises;
CREATE POLICY "professional_exercises by school capability" ON public.professional_exercises FOR SELECT TO authenticated
  USING (school_id IN (SELECT public.school_capability_schools('consultar-registro-funcional')));

DROP POLICY IF EXISTS "Own person" ON public.institutional_persons;
CREATE POLICY "Own person" ON public.institutional_persons FOR SELECT TO authenticated
  USING (id = (SELECT public.current_person_id()));