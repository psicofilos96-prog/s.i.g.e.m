-- Origem da designação e da natureza do ator: privadas, além da proteção por RLS.
-- Os writers SECURITY DEFINER mantêm a autoria; não há consumidor de tabela direta.
REVOKE ALL ON public.sigem_installer_designation_origins,
  public.institutional_actor_nature_origins FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sigem_installer_designation_origins,
  public.institutional_actor_nature_origins TO service_role;
