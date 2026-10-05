-- 0117 — Os testes DB da S revelaram privilégios padrão herdados nas tabelas novas (0113/0115).
-- Somente leitura via RLS para authenticated; escrita exclusivamente pelos writers SECURITY DEFINER.
REVOKE ALL ON public.year_transition_decisions FROM anon, authenticated, service_role;
REVOKE ALL ON public.school_staff_presence FROM anon, authenticated, service_role;
REVOKE ALL ON public.student_registration_events FROM anon, authenticated, service_role;
REVOKE ALL ON public.exact_lookup_events FROM anon, authenticated, service_role;
GRANT SELECT ON public.year_transition_decisions TO authenticated, service_role;
GRANT SELECT ON public.school_staff_presence TO authenticated, service_role;
GRANT SELECT ON public.student_registration_events TO service_role;
GRANT SELECT ON public.exact_lookup_events TO service_role;