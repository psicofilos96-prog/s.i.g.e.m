-- Lote 3: mesma lacuna de 0208 nas tabelas de ano letivo e organização de períodos (estrutura não sensível).
CREATE POLICY "sector principals read academic years" ON public.institutional_academic_years
  FOR SELECT TO authenticated USING (public.current_principal_id() IS NOT NULL);
CREATE POLICY "sector principals read academic year versions" ON public.institutional_academic_year_versions
  FOR SELECT TO authenticated USING (public.current_principal_id() IS NOT NULL);
CREATE POLICY "sector principals read period organizations" ON public.institutional_period_organizations
  FOR SELECT TO authenticated USING (public.current_principal_id() IS NOT NULL);
CREATE POLICY "sector principals read period organization versions" ON public.institutional_period_organization_versions
  FOR SELECT TO authenticated USING (public.current_principal_id() IS NOT NULL);