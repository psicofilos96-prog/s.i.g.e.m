-- 0118 — Helpers internos da S só são chamados dentro de writers SECURITY DEFINER; não precisam de EXECUTE para app roles.
REVOKE ALL ON FUNCTION public.s_current_person() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.s_year_open_for_operation(text) FROM PUBLIC, anon, authenticated, service_role;