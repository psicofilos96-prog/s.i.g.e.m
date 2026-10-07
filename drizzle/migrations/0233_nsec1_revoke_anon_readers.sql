REVOKE EXECUTE ON FUNCTION public.academic_year_operational_state_at FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.class_composition_at FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academic_year_operational_state_at TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.class_composition_at TO authenticated, service_role;