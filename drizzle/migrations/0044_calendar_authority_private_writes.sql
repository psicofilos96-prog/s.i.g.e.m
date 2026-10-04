-- A designação é administrativa e imutável; contas clientes apenas consultam a própria.
REVOKE ALL ON public.calendar_authority_designations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.calendar_authority_designations TO authenticated;
GRANT ALL ON public.calendar_authority_designations TO service_role;
