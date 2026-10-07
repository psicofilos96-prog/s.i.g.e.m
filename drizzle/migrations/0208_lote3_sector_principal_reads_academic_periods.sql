-- Lote 3: contas de setor (principal institucional, sem pessoa) liam calendário mas não os períodos letivos
-- (políticas exigiam current_person_id()), deixando "Períodos letivos" vazio na folha. Mesma amplitude da leitura humana vinculada.
CREATE POLICY "sector principals read academic periods" ON public.institutional_academic_periods
  FOR SELECT TO authenticated USING (public.current_principal_id() IS NOT NULL);
CREATE POLICY "sector principals read academic period versions" ON public.institutional_academic_period_versions
  FOR SELECT TO authenticated USING (public.current_principal_id() IS NOT NULL);