-- N5.2.1c — rascunho da matrícula só pelos writers/readers: sem privilégio direto de tabela para papéis de app ou de sandbox.
REVOKE ALL ON public.enrollment_wizard_draft_events, public.enrollment_wizard_events FROM anon, authenticated, sandbox_exec;
REVOKE ALL ON public.enrollment_wizard_draft_events, public.enrollment_wizard_events FROM service_role;
GRANT SELECT ON public.enrollment_wizard_draft_events, public.enrollment_wizard_events TO service_role;
