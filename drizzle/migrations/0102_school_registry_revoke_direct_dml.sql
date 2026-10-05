-- Cadastro escolar: escrita só pelos writers SECURITY DEFINER (owner postgres).
-- Revoga DML direto herdado; SELECT authenticated preservado (RLS segue valendo).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.institutional_schools FROM anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.institutional_school_identifiers FROM anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.institutional_school_record_versions FROM anon, authenticated, service_role;
REVOKE SELECT ON public.institutional_schools FROM anon;
REVOKE SELECT ON public.institutional_school_identifiers FROM anon;
REVOKE SELECT ON public.institutional_school_record_versions FROM anon;
GRANT SELECT ON public.institutional_schools, public.institutional_school_identifiers, public.institutional_school_record_versions TO authenticated, service_role;