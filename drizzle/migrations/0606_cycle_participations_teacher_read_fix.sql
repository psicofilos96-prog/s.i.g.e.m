DROP POLICY IF EXISTS "participations by capability" ON public.cycle_participations;
CREATE POLICY "participations by capability" ON public.cycle_participations FOR SELECT TO authenticated
USING (
  public.has_school_capability('consultar-matricula-e-movimentacao', school_id)
  OR EXISTS (SELECT 1 FROM public.class_enrollment_episodes p
             WHERE p.participation_logical_id = cycle_participations.logical_id
               AND p.class_id IN (SELECT public.roster_readable_classes()))
);