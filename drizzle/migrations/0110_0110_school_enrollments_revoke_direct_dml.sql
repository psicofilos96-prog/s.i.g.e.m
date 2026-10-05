-- 0110: matrícula escolar só por writers SECURITY DEFINER (humanos B3 ou operação técnica 0100); sem DML direto por app roles nem service_role.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.school_enrollments FROM PUBLIC, anon, authenticated, service_role;
