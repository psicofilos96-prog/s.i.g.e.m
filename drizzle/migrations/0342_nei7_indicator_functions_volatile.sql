-- Funções que gravam a trilha (nei_log) não podem ser STABLE: a API as executa em transação somente leitura.
ALTER FUNCTION public.nei_indicators(text) VOLATILE;
ALTER FUNCTION public.nei_indicator_drill(text,text) VOLATILE;
ALTER FUNCTION public.nei_network_aggregate() VOLATILE;