-- 0097 — Revisão do Advisor: operational_task_assignee é auxiliar interno (só chamado por funções DEFINER),
-- não deve ser oráculo de responsável por id de tarefa para qualquer sessão.
REVOKE EXECUTE ON FUNCTION public.operational_task_assignee(uuid) FROM PUBLIC, anon, authenticated;