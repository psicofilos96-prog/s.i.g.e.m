-- rcq_raise era IMMUTABLE: com argumento constante o planejador pode avaliá-lo antecipadamente (plano genérico
-- em cache do plpgsql), recusando filtros válidos com 'rcq:unknown-operator'. Erro é efeito: VOLATILE.
ALTER FUNCTION public.rcq_raise(text) VOLATILE;
ALTER FUNCTION public.rcq_filter(jsonb, jsonb, jsonb, boolean, integer) STABLE;