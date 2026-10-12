-- L39: switch da folha não pode ser gravado por nenhum papel de aplicação ou sandbox (default privileges davam INSERT).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    REVOKE ALL ON public.payroll_import_switch_events FROM sandbox_exec;
  END IF;
END $$;
REVOKE ALL ON public.payroll_import_switch_events FROM PUBLIC, anon, authenticated, service_role;
