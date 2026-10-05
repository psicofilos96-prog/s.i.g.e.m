-- Frente W: privilégios padrão concederam DML na tabela nova; só leitura (RLS) e escrita pelo writer v2.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.lesson_curricular_references FROM PUBLIC, anon, authenticated, service_role;
REVOKE SELECT ON public.lesson_curricular_references FROM anon;