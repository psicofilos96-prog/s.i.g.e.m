-- B4.8.2 — privilégios padrão do schema concederam DML a anon/authenticated nas tabelas da 0063; escrita só pelo writer.
REVOKE ALL ON public.teaching_assignments, public.teaching_assignment_versions FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.teaching_assignments, public.teaching_assignment_versions FROM authenticated;
GRANT SELECT ON public.teaching_assignments, public.teaching_assignment_versions TO authenticated;