-- PERF.LOADING.4: mesma regra (turma legível), conjunto calculado uma vez por consulta.
DROP POLICY IF EXISTS "leitura conforme turma" ON public.class_census_declarations;
CREATE POLICY "leitura conforme turma" ON public.class_census_declarations
  FOR SELECT TO authenticated
  USING (class_id IN (SELECT public.readable_class_ids()));