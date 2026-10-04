REVOKE ALL ON public.sigem_installer_designation_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sigem_activator_account_origins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sigem_installer_designation_guard() FROM PUBLIC, anon, authenticated;