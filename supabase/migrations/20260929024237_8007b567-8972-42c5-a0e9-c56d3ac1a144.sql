DROP POLICY "Read cycle closings within scope" ON public.cycle_closing_versions;
CREATE POLICY "Read cycle closings within scope" ON public.cycle_closing_versions FOR SELECT TO authenticated
  USING (public.has_capability('encerrar-ciclo-turma', class_id, NULL) OR public.has_capability('consultar-encerramento-do-ciclo', class_id, NULL));